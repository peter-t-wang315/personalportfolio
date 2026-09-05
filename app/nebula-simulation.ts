import * as THREE from "three";
import { edges } from "@/content";
import { nodeList, nodeGeometry } from "@/lib/node-geometry";
import { makeRng } from "@/lib/seeded-random";

/**
 * Step 2.3a — force simulation. A node's base position is its seeded
 * `layout.ts` position (`home`) plus a small bounded wander offset that is
 * a pure function of a shared clock, not integrated velocity state.
 * Message-edge-connected pairs (every runtime/dev-time edge — never
 * shared-tech, same asymmetry as the edge hierarchy itself) blend their
 * offsets toward a shared average each frame, so they drift loosely
 * together; everything else wanders independently. Hover attraction (2.4)
 * is the one part of this file that IS integrated state — see the
 * ATTRACT_* constants below — because a real spring is what makes
 * retargeting between nodes fall out for free.
 *
 * The wander is smooth value noise, not summed sines. Sines — even several
 * desynced ones per axis — are periodic, and a viewer picks up the repeat
 * within one or two cycles: it reads as a formula. Value noise interpolates
 * between a stream of hashed random control values, so the path never
 * repeats and its speed varies along the way, which is what "floating"
 * looks like. Each node also runs on its own time scale so the population
 * doesn't share one underlying clock.
 *
 * Wander being a pure function of time means freezing it is just holding
 * `t` still (freezeSimulation captures the last clock value;
 * resumeSimulation lets it advance again), and reduced motion is just
 * never calling stepSimulation at all — wander offsets are 0 at t=0 (the
 * ramp), so livePositions sit exactly at the seeded layout from the moment
 * the module loads, and the attraction spring never gets stepped either,
 * so it can't reintroduce motion while reduced motion is set.
 */

const SIM_SEED = 0x51a7e5;
// World units, per-node range — small relative to CLUSTER_SPREAD (2.5,
// content/layout.ts) so nothing wanders into a neighbour's slot, but wide
// enough that different nodes visibly drift by different amounts.
const WANDER_AMPLITUDE_MIN = 0.35;
const WANDER_AMPLITUDE_MAX = 0.8;
// Two noise octaves per axis: a slow one that sets the overall path and a
// quicker, quieter one that keeps it from feeling too smooth. Seconds per
// control value, at a node's base speed.
const NOISE_OCTAVES: readonly { period: number; weight: number }[] = [
  { period: 7.5, weight: 0.7 },
  { period: 2.8, weight: 0.3 },
];
// Per-node time-scale range. A node at 0.65 wanders noticeably lazier than
// one at 1.45, so the constellation never reads as one synchronized clock.
const SPEED_MIN = 0.65;
const SPEED_MAX = 1.45;
// Fades wander in from a standing start instead of popping to full
// amplitude on the first frame. Eased (smoothstep) rather than linear so
// the wake-up itself doesn't read as mechanical.
const RAMP_SECONDS = 2.5;
// How strongly message-edge-connected pairs pull toward their shared
// average offset each frame. Recomputed fresh from bounded noise every
// frame (never fed back into itself), so this can't accumulate into
// runaway motion — it only sets how correlated vs. independent the pair's
// drift looks.
const PAIR_BLEND = 0.35;
// Hover attraction is a real damped spring per PULLED NEIGHBOUR (value +
// velocity, integrated every frame), not a curve over normalised progress —
// a spring is what makes retargeting (pointer moving from one node straight
// to another) fall out for free: the integrator just keeps going from
// whatever position and velocity it already has when its target flips
// between 1 (attracting) and 0 (released), so there's never a pop, and
// pulling away *before* it's settled naturally cuts the motion short
// instead of restarting a timer.
//
// Each neighbour's damping ratio, natural frequency, and pull strength are
// seeded from its own node id (see attractionParams below) — not shared
// constants — so when several neighbours of a hovered node all start
// attracting in the same instant, they don't execute the same curve at the
// same speed. Some barely overshoot at all; others ring visibly. That's
// deliberate: real things being pulled toward the same point don't arrive
// in lockstep. Distance to whatever they're being pulled toward plays no
// part in which personality a node gets — the seed is keyed on the node's
// own id, fixed at module load, before any target is known.
const ATTRACT_ZETA_MIN = 0.25; // clearly rings — one strong overshoot, a visible correction wobble
const ATTRACT_ZETA_MAX = 0.9; // critically-damped-ish — smooth slide, no ring
const ATTRACT_OMEGA_MIN = 7; // rad/s — slower to arrive
const ATTRACT_OMEGA_MAX = 14; // rad/s — snappier to arrive
// How far a fully-attracted node moves from its own home toward the
// attractor's home, at the spring's rest value (1) — before its own
// overshoot, which pushes past this. Kept low enough (combined with the max
// zeta-driven overshoot, ~44% at ATTRACT_ZETA_MIN) that even the bounciest,
// strongest-pulling node peaks under 90% of the full separation and never
// reaches — let alone passes through — the attractor itself.
const ATTRACT_PULL_MIN = 0.3;
const ATTRACT_PULL_MAX = 0.6;
// Spring integration sub-step: keeps the integrator stable and the curve
// shaped correctly even if a frame's delta is unusually large (a slow
// device, a backgrounded-tab hiccup) — those just get consumed as several
// small, stable steps instead of one big unstable one.
const ATTRACT_SUBSTEP_SECONDS = 1 / 60;

function smoothstep(t: number): number {
  const c = THREE.MathUtils.clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
}

/** Integer hash → [-1, 1]. Deterministic, no state, cheap. */
function hashNoise(seed: number, i: number): number {
  let h = (seed ^ Math.imul(i, 0x27d4eb2d)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return ((h >>> 0) / 0xffffffff) * 2 - 1;
}

/**
 * Smooth 1D value noise at time `t` (in control-value units): Catmull-Rom
 * through four hashed neighbours, so velocity is continuous across control
 * points instead of stalling at each one.
 */
function valueNoise(seed: number, t: number): number {
  const i = Math.floor(t);
  const f = t - i;
  const p0 = hashNoise(seed, i - 1);
  const p1 = hashNoise(seed, i);
  const p2 = hashNoise(seed, i + 1);
  const p3 = hashNoise(seed, i + 2);
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * f +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f +
      (-p0 + 3 * p1 - 3 * p2 + p3) * f * f * f)
  );
}

interface WanderParams {
  amplitude: number;
  speed: number;
  /** Per octave, per axis. */
  seeds: [number, number, number][];
  /** Per octave, per axis — offsets each stream so control points don't align. */
  offsets: [number, number, number][];
}

const wanderParams: Record<string, WanderParams> = (() => {
  const rng = makeRng(SIM_SEED);
  const map: Record<string, WanderParams> = {};
  const nextSeed = () => Math.floor(rng() * 0x7fffffff);
  for (const node of nodeList) {
    const seeds: [number, number, number][] = [];
    const offsets: [number, number, number][] = [];
    for (let o = 0; o < NOISE_OCTAVES.length; o++) {
      seeds.push([nextSeed(), nextSeed(), nextSeed()]);
      offsets.push([rng() * 1000, rng() * 1000, rng() * 1000]);
    }
    map[node.id] = {
      amplitude:
        WANDER_AMPLITUDE_MIN +
        rng() * (WANDER_AMPLITUDE_MAX - WANDER_AMPLITUDE_MIN),
      speed: SPEED_MIN + rng() * (SPEED_MAX - SPEED_MIN),
      seeds,
      offsets,
    };
  }
  return map;
})();

const ATTRACT_SEED = 0x0a771ac7;

interface AttractionParams {
  zeta: number;
  omegaN: number;
  pull: number;
}

/**
 * Each node's own attraction "personality" — how it arrives when pulled,
 * regardless of what it's being pulled toward or from how far. Seeded once
 * from the node's id, independent of wanderParams' own seed stream (a
 * separate makeRng call) and computed before any hover ever happens, so
 * there's no way for distance-to-target to factor into which zeta/omegaN/
 * pull a node gets.
 */
const attractionParams: Record<string, AttractionParams> = (() => {
  const rng = makeRng(ATTRACT_SEED);
  const map: Record<string, AttractionParams> = {};
  for (const node of nodeList) {
    map[node.id] = {
      zeta: ATTRACT_ZETA_MIN + rng() * (ATTRACT_ZETA_MAX - ATTRACT_ZETA_MIN),
      omegaN:
        ATTRACT_OMEGA_MIN + rng() * (ATTRACT_OMEGA_MAX - ATTRACT_OMEGA_MIN),
      pull: ATTRACT_PULL_MIN + rng() * (ATTRACT_PULL_MAX - ATTRACT_PULL_MIN),
    };
  }
  return map;
})();

// Every message edge (runtime + dev-time), never shared-tech — the spring
// carries the same hierarchy the edge rendering already draws.
const springPairs: [string, string][] = edges
  .filter((e) => e.kind !== "shared-tech")
  .map((e) => [e.from, e.to]);

const livePositions: Record<string, THREE.Vector3> = (() => {
  const map: Record<string, THREE.Vector3> = {};
  for (const node of nodeList) map[node.id] = new THREE.Vector3(...node.position);
  return map;
})();

const offsets: Record<string, THREE.Vector3> = (() => {
  const map: Record<string, THREE.Vector3> = {};
  for (const node of nodeList) map[node.id] = new THREE.Vector3();
  return map;
})();

const neighborCache: Record<string, string[]> = {};
/** Runtime-edge neighbours of a node. Exported so 2.5's focus dimming asks the
 * same question hover attraction does, rather than deriving "related" twice. */
export function neighborsOf(id: string): string[] {
  return (neighborCache[id] ??= (() => {
    const set = new Set<string>();
    for (const e of edges) {
      if (e.from === id) set.add(e.to);
      else if (e.to === id) set.add(e.from);
    }
    return [...set];
  })());
}

interface NeighborSpring {
  value: number;
  velocity: number;
  /** Whichever node this one is currently being pulled toward. */
  targetId: string;
  active: boolean;
}

/**
 * One entry per NEIGHBOUR currently being pulled (or still springing back
 * from release) — keyed by the neighbour, not by the hovered target, since
 * each neighbour runs its own spring with its own attractionParams. When
 * several neighbours of a hovered node all activate at once, each is a
 * fully independent integration from that same instant.
 */
const neighborSprings = new Map<string, NeighborSpring>();

/** Given a node id, pull everything connected to it toward it. 2.4 wires this to hover. */
export function attractNeighbors(nodeId: string) {
  const neighbors = new Set(neighborsOf(nodeId));

  // Anything currently active that isn't a neighbour of the new target
  // releases — its own spring, at its own pace, same as letting go.
  for (const [id, spring] of neighborSprings) {
    if (spring.active && !neighbors.has(id)) spring.active = false;
  }

  for (const id of neighbors) {
    const existing = neighborSprings.get(id);
    if (existing) {
      // Retarget in place — the spring's current value/velocity carry over,
      // so a node that's a neighbour of both the old and new hovered node
      // never pops, it just continues toward the new direction.
      existing.targetId = nodeId;
      existing.active = true;
    } else {
      neighborSprings.set(id, { value: 0, velocity: 0, targetId: nodeId, active: true });
    }
  }
}

/** Releases whatever attraction is active, each neighbour easing out on its own spring. */
export function releaseAttraction() {
  for (const spring of neighborSprings.values()) spring.active = false;
}

let frozenAt: number | null = null;
let lastClockTime = 0;

/** Stops the simulation completely, holding position. 2.5's fly-in wires this. */
export function freezeSimulation() {
  frozenAt = lastClockTime;
}

/** Resumes advancing from wherever freezeSimulation left off. */
export function resumeSimulation() {
  frozenAt = null;
}

export function isSimulationFrozen() {
  return frozenAt !== null;
}

function wanderOffset(id: string, t: number, out: THREE.Vector3) {
  const p = wanderParams[id];
  const ramp = smoothstep(t / RAMP_SECONDS);
  const localT = t * p.speed;

  out.set(0, 0, 0);
  for (let o = 0; o < NOISE_OCTAVES.length; o++) {
    const { period, weight } = NOISE_OCTAVES[o];
    const seeds = p.seeds[o];
    const offs = p.offsets[o];
    out.x += weight * valueNoise(seeds[0], localT / period + offs[0]);
    out.y += weight * valueNoise(seeds[1], localT / period + offs[1]);
    out.z += weight * valueNoise(seeds[2], localT / period + offs[2]);
  }
  // Slightly flatter vertically than horizontally — an aesthetic choice
  // carried over from the original version.
  out.y *= 0.85;
  out.multiplyScalar(p.amplitude * ramp);
}

const _pairAvg = new THREE.Vector3();
const _pull = new THREE.Vector3();

/**
 * Advances the simulation and writes the result into `livePositions`. Call
 * once per frame from the constellation's own useFrame; the edge layer
 * reads the same map from its own (a frame of lag between the two is
 * imperceptible at continuous-motion speeds, so no ordering dependency
 * between them is enforced).
 */
export function stepSimulation(clockTime: number, delta: number) {
  lastClockTime = clockTime;
  const t = frozenAt ?? clockTime;

  for (const node of nodeList) {
    wanderOffset(node.id, t, offsets[node.id]);
  }

  for (const [a, b] of springPairs) {
    const oa = offsets[a];
    const ob = offsets[b];
    _pairAvg.copy(oa).add(ob).multiplyScalar(0.5);
    oa.lerp(_pairAvg, PAIR_BLEND);
    ob.lerp(_pairAvg, PAIR_BLEND);
  }

  for (const [neighborId, spring] of neighborSprings) {
    const params = attractionParams[neighborId];
    const stiffness = params.omegaN * params.omegaN;
    const damping = 2 * params.zeta * params.omegaN;
    const restValue = spring.active ? 1 : 0;

    const steps = Math.max(1, Math.ceil(delta / ATTRACT_SUBSTEP_SECONDS));
    const stepDt = delta / steps;
    for (let s = 0; s < steps; s++) {
      const force =
        -stiffness * (spring.value - restValue) - damping * spring.velocity;
      spring.velocity += force * stepDt;
      spring.value += spring.velocity * stepDt;
    }

    if (
      !spring.active &&
      Math.abs(spring.value) < 0.001 &&
      Math.abs(spring.velocity) < 0.001
    ) {
      neighborSprings.delete(neighborId);
      continue;
    }

    const targetHome = nodeGeometry[spring.targetId]?.position;
    const home = nodeGeometry[neighborId]?.position;
    if (!targetHome || !home) continue;
    _pull
      .set(
        targetHome[0] - home[0],
        targetHome[1] - home[1],
        targetHome[2] - home[2],
      )
      .multiplyScalar(params.pull * spring.value);
    offsets[neighborId].add(_pull);
  }

  for (const node of nodeList) {
    const home = node.position;
    const offset = offsets[node.id];
    livePositions[node.id].set(
      home[0] + offset.x,
      home[1] + offset.y,
      home[2] + offset.z,
    );
  }
}

export function getLivePosition(id: string): THREE.Vector3 | undefined {
  return livePositions[id];
}
