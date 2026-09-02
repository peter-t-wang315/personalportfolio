import * as THREE from "three";
import { edges } from "@/content";
import { nodeList, nodeGeometry } from "@/lib/node-geometry";
import { makeRng } from "@/lib/seeded-random";

/**
 * Step 2.3a — force simulation. Live position is a pure function of a
 * shared clock, not integrated velocity state: each node's position is its
 * seeded `layout.ts` position (`home`) plus a small bounded wander offset.
 * Message-edge-connected pairs (every runtime/dev-time edge — never
 * shared-tech, same asymmetry as the edge hierarchy itself) blend their
 * offsets toward a shared average each frame, so they drift loosely
 * together; everything else wanders independently.
 *
 * The wander is smooth value noise, not summed sines. Sines — even several
 * desynced ones per axis — are periodic, and a viewer picks up the repeat
 * within one or two cycles: it reads as a formula. Value noise interpolates
 * between a stream of hashed random control values, so the path never
 * repeats and its speed varies along the way, which is what "floating"
 * looks like. Each node also runs on its own time scale so the population
 * doesn't share one underlying clock.
 *
 * Being a pure function of time means freezing is just holding `t` still
 * (freezeSimulation captures the last clock value; resumeSimulation lets it
 * advance again), and reduced motion is just never calling stepSimulation —
 * offsets are 0 at t=0 (the ramp), so livePositions sit exactly at the
 * seeded layout from the moment the module loads.
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
// Hover attraction: seconds for a pull to ramp fully in or out. Each target
// keeps its own strength and cross-fades, so moving the pointer from one
// node straight to another never snaps — the old neighbourhood eases back
// while the new one eases in. The pull applied is smoothstep(strength).
const ATTRACT_IN_SECONDS = 0.7;
const ATTRACT_OUT_SECONDS = 0.9;
// How far an attracted node moves from its own home toward the attractor's
// home, at full strength.
const ATTRACT_PULL = 0.6;

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
function neighborsOf(id: string): string[] {
  return (neighborCache[id] ??= (() => {
    const set = new Set<string>();
    for (const e of edges) {
      if (e.from === id) set.add(e.to);
      else if (e.to === id) set.add(e.from);
    }
    return [...set];
  })());
}

/** One entry per node currently pulling (or still easing out). */
const attractions = new Map<string, { strength: number; active: boolean }>();

/** Given a node id, pull everything connected to it toward it. 2.4 wires this to hover. */
export function attractNeighbors(nodeId: string) {
  for (const entry of attractions.values()) entry.active = false;
  const existing = attractions.get(nodeId);
  if (existing) existing.active = true;
  else attractions.set(nodeId, { strength: 0, active: true });
}

/** Releases whatever attraction is active, easing out rather than snapping. */
export function releaseAttraction() {
  for (const entry of attractions.values()) entry.active = false;
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

  for (const [targetId, entry] of attractions) {
    const rate = entry.active ? 1 / ATTRACT_IN_SECONDS : -1 / ATTRACT_OUT_SECONDS;
    entry.strength = THREE.MathUtils.clamp(entry.strength + rate * delta, 0, 1);
    if (entry.strength === 0 && !entry.active) {
      attractions.delete(targetId);
      continue;
    }
    const targetHome = nodeGeometry[targetId]?.position;
    if (!targetHome) continue;
    const eased = smoothstep(entry.strength);
    for (const id of neighborsOf(targetId)) {
      const home = nodeGeometry[id].position;
      _pull
        .set(
          targetHome[0] - home[0],
          targetHome[1] - home[1],
          targetHome[2] - home[2],
        )
        .multiplyScalar(ATTRACT_PULL * eased);
      offsets[id].add(_pull);
    }
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
