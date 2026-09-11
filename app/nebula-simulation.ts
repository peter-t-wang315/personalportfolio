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
// World units, per-node range — small relative to CLUSTER_SPREAD (3.2,
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
  /**
   * Multiplier on this node's own pull, for the fractional mode below.
   */
  strength: number;
  /**
   * Distance to settle at, in world units, when gathering to a ring instead
   * of pulling by a fraction. Undefined keeps the fractional behaviour.
   */
  gatherRadius?: number;
}

/**
 * One entry per NEIGHBOUR currently being pulled (or still springing back
 * from release) — keyed by the neighbour, not by the hovered target, since
 * each neighbour runs its own spring with its own attractionParams. When
 * several neighbours of a hovered node all activate at once, each is a
 * fully independent integration from that same instant.
 */
const neighborSprings = new Map<string, NeighborSpring>();

/** Scratch for the separation pass, which runs over every pair every frame. */
const _separation = new THREE.Vector3();

/** Given a node id, pull everything connected to it toward it. 2.4 wires this to hover. */
/**
 * How far a gathered neighbour ends up from its subject, and how strictly.
 *
 * The fractional pull that hover uses moves each neighbour a share of *its
 * own* separation, which preserves the spread it started with: a node already
 * beside the subject ends up almost inside it, while one across the globe is
 * still across the globe, only less so. Read as a group that looks lopsided —
 * some nodes crushed in, others barely moved.
 *
 * Gathering to a radius instead gives every neighbour the same destination
 * distance, keeping only the direction it came from, so the subgraph settles
 * as a ring around its subject. Blended rather than absolute, so the original
 * arrangement still shows through and the ring does not read as a dial.
 */
export const GATHER_RADIUS = 3.4;

/**
 * Clear space kept between any two node surfaces, in world units.
 *
 * Sized against what the layout already does rather than picked to taste: the
 * seeded arrangement's tightest pair sits about 0.45 apart and the wander only
 * dips below that occasionally, so this is close enough to the natural floor
 * to leave the composition alone and only act where something has genuinely
 * been pushed too close. On `/work` it reads as about 6px of daylight at the
 * globe's drawn size, which is what separates two nodes from one lumpy one.
 */
const SEPARATION_GAP = 0.35;
/** Enough to clear every overlap measured; see the pass itself for why >1. */
const SEPARATION_PASSES = 3;

/**
 * How much room a gathered ring is given, in world units: anything *not* part
 * of the lit subgraph that sits closer than this to the subject is pushed out
 * to it.
 *
 * Comfortably outside GATHER_RADIUS, so a stranger cannot end up inside the
 * ring its neighbours were gathered into — measured on
 * `/work/station-supervisor`, `tcp` sat 1.9 units from the subject, well
 * within a ring at 3.4, close enough to read as one of its connections.
 *
 * Set past where the node should end up, not at it: the blend is
 * GATHER_EQUALISING and the shell re-projection and collision pass both give a
 * little back, so a target of 4.6 left `tcp` at 3.62 — outside the ring by
 * two tenths of a unit, which is not outside it to look at.
 *
 * This only reaches the handful of nodes genuinely near the subject on the
 * shell — one to three, typically. It is deliberately not the answer to nodes
 * that merely *look* close: those are the far side of the sphere showing
 * through, already 20 units away, and no amount of pushing moves them on
 * screen. nebula-constellation.tsx fades those instead.
 */
const CLEAR_RADIUS = 5.5;
const GATHER_EQUALISING = 0.8;

export function attractNeighbors(
  nodeId: string,
  options: { strength?: number; gatherRadius?: number } = {},
) {
  const { strength = 1, gatherRadius } = options;
  const neighbors = new Set(neighborsOf(nodeId));

  // Anything currently active that isn't a neighbour of the new target
  // releases — its own spring, at its own pace, same as letting go.
  for (const [id, spring] of neighborSprings) {
    if (spring.active && !neighbors.has(id)) spring.active = false;
  }

  // Strangers standing inside the ring are moved out of it, using the same
  // spring and the same blend — `wanted` moves toward the target radius from
  // whichever side the node starts on, so gathering in and pushing out are one
  // piece of arithmetic. Only those already inside are touched; the rest of
  // the globe keeps its arrangement.
  if (gatherRadius !== undefined) {
    const subject = nodeGeometry[nodeId]?.position;
    if (subject) {
      for (const node of nodeList) {
        if (node.id === nodeId || neighbors.has(node.id)) continue;
        const distance = Math.hypot(
          node.position[0] - subject[0],
          node.position[1] - subject[1],
          node.position[2] - subject[2],
        );
        if (distance >= CLEAR_RADIUS) continue;
        const existing = neighborSprings.get(node.id);
        if (existing) {
          existing.targetId = nodeId;
          existing.active = true;
          existing.strength = strength;
          existing.gatherRadius = CLEAR_RADIUS;
        } else {
          neighborSprings.set(node.id, {
            value: 0,
            velocity: 0,
            targetId: nodeId,
            active: true,
            strength,
            gatherRadius: CLEAR_RADIUS,
          });
        }
      }
    }
  }

  for (const id of neighbors) {
    const existing = neighborSprings.get(id);
    if (existing) {
      // Retarget in place — the spring's current value/velocity carry over,
      // so a node that's a neighbour of both the old and new hovered node
      // never pops, it just continues toward the new direction.
      existing.targetId = nodeId;
      existing.active = true;
      existing.strength = strength;
      existing.gatherRadius = gatherRadius;
    } else {
      neighborSprings.set(id, {
        value: 0,
        velocity: 0,
        targetId: nodeId,
        active: true,
        strength,
        gatherRadius,
      });
    }
  }
}

/** Releases whatever attraction is active, each neighbour easing out on its own spring. */
export function releaseAttraction() {
  for (const spring of neighborSprings.values()) spring.active = false;
}

/**
 * **The settle after looking around** (07-continuous-space.md, the
 * empty-paper decision). Letting go of a look-around drag that has left the
 * reader facing a sparse part of the sky draws the few nodes nearest the
 * middle of the view a little way toward it, eases them there, and rests.
 * SETTLE_MAX_UNITS at most — about six degrees seen from the centre, never
 * enough to leave a cluster — and never more than SETTLE_SHARE of the way,
 * so the layout is still a truthful diagram. It does not touch the drag:
 * nothing happens until the hand is off and the view has come to rest, and
 * nebula-canvas.tsx decides both that and whether the view is sparse.
 *
 * Its own springs rather than the hover attraction's: those pull toward a
 * node with personalities that ring, and this is a quiet slide toward a point
 * in the sky. Critically damped, so nothing overshoots, and a vector spring,
 * so a new settle or a release retargets from wherever a node already is.
 *
 * **Held while a node is open** (holdViewSettle). The camera parks against a
 * node's live position at the moment it opens and the shell is that node, so
 * a settle still easing in would carry the shell out from under the camera —
 * the failure the outside turn's hold exists for.
 */
const SETTLE_NODES = 3;
const SETTLE_MAX_UNITS = 1.5;
const SETTLE_SHARE = 0.35;
/** rad/s, critically damped: most of the way in about a second. */
const SETTLE_OMEGA = 4.5;

interface SettleSpring {
  target: THREE.Vector3;
  offset: THREE.Vector3;
  velocity: THREE.Vector3;
}
const settleSprings = new Map<string, SettleSpring>();
let settleHeld = false;
const _settlePull = new THREE.Vector3();
const _settleHome = new THREE.Vector3();
const _settleAccel = new THREE.Vector3();

/**
 * Settle the nodes nearest a direction — the middle of the view, in the
 * layout's own frame — toward it. Nearest by seeded position, so the choice
 * does not depend on where the wander happens to have put things.
 */
export function settleTowardView(direction: THREE.Vector3) {
  const view = direction.clone().normalize();
  const nearest = nodeList
    .map((node) => ({
      node,
      angle: _settleHome.fromArray(node.position).angleTo(view),
    }))
    .sort((a, b) => a.angle - b.angle)
    .slice(0, SETTLE_NODES);
  const chosen = new Set(nearest.map((entry) => entry.node.id));
  for (const [id, spring] of settleSprings) {
    if (!chosen.has(id)) spring.target.set(0, 0, 0);
  }
  for (const { node } of nearest) {
    _settleHome.fromArray(node.position);
    // Toward the view's point on this node's own sphere; the shell
    // re-projection in stepSimulation turns it into a slide over the surface.
    _settlePull.copy(view).multiplyScalar(_settleHome.length()).sub(_settleHome);
    const distance = _settlePull.length();
    const amount = Math.min(SETTLE_MAX_UNITS, distance * SETTLE_SHARE);
    if (distance > 1e-4) _settlePull.multiplyScalar(amount / distance);
    else _settlePull.set(0, 0, 0);
    const spring = settleSprings.get(node.id);
    if (spring) spring.target.copy(_settlePull);
    else {
      settleSprings.set(node.id, {
        target: _settlePull.clone(),
        offset: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
      });
    }
  }
}

/** Let settled nodes ease home: the reader is looking around again, or has left. */
export function releaseViewSettle() {
  for (const spring of settleSprings.values()) spring.target.set(0, 0, 0);
}

/** Hold settled nodes exactly where they are (true), or let them move again. */
export function holdViewSettle(held: boolean) {
  settleHeld = held;
  if (held) for (const spring of settleSprings.values()) spring.velocity.set(0, 0, 0);
}

/** For app/nebula-probe.ts: which nodes are settling, and how far the furthest has gone. */
export function getViewSettle() {
  let units = 0;
  const nodes: string[] = [];
  for (const [id, spring] of settleSprings) {
    units = Math.max(units, spring.offset.length());
    if (spring.target.lengthSq() > 0) nodes.push(id);
  }
  return { nodes, units, held: settleHeld };
}

let frozenAt: number | null = null;
let lastClockTime = 0;
/**
 * Total time spent frozen, subtracted from the clock so the wander resumes
 * from where it stopped rather than from where it *would* have been.
 *
 * Without it, `resumeSimulation` handed the noise functions the live clock
 * again and every node teleported to the position it would have wandered to
 * during the freeze — a 1.4-second jump after a fly-in, in a single frame.
 */
let frozenTotal = 0;

/**
 * Stops the simulation completely, holding position. 2.5's fly-in wires this.
 *
 * Idempotent, and that matters: the effect that calls it fires both on focus
 * and on the flight ending, so a second call re-stamping the freeze point
 * would advance the wander by exactly the flight's duration at the instant
 * the camera came to rest. Measured, that was 29% of the frame's pixels
 * changing in one frame, spread across the whole viewport, with the camera
 * provably still — which reads as the whole graph flinching on arrival.
 */
export function freezeSimulation() {
  if (frozenAt === null) frozenAt = lastClockTime;
}

/** Resumes advancing from wherever freezeSimulation left off. */
export function resumeSimulation() {
  if (frozenAt === null) return;
  frozenTotal += lastClockTime - frozenAt;
  frozenAt = null;
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
  const t = (frozenAt ?? clockTime) - frozenTotal;

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
    if (spring.gatherRadius === undefined) {
      // Fractional: a share of this node's own separation. Hover's behaviour.
      _pull
        .set(
          targetHome[0] - home[0],
          targetHome[1] - home[1],
          targetHome[2] - home[2],
        )
        .multiplyScalar(params.pull * spring.strength * spring.value);
    } else {
      // To a radius: same destination distance for every neighbour, keeping
      // only the direction it came from, so they settle as a ring rather than
      // a squashed copy of how they were already arranged.
      _pull.set(
        home[0] - targetHome[0],
        home[1] - targetHome[1],
        home[2] - targetHome[2],
      );
      const distance = _pull.length();
      if (distance > 1e-4) {
        const wanted =
          distance + (spring.gatherRadius - distance) * GATHER_EQUALISING;
        _pull.multiplyScalar((wanted / distance - 1) * spring.value);
      } else {
        _pull.set(0, 0, 0);
      }
    }
    offsets[neighborId].add(_pull);
  }

  // The settle after looking around (settleTowardView). Integrated on the
  // frame delta like the attraction, so the wander's freeze does not stop it;
  // holdViewSettle does.
  for (const [id, spring] of settleSprings) {
    if (!settleHeld) {
      const steps = Math.max(1, Math.ceil(delta / ATTRACT_SUBSTEP_SECONDS));
      const stepDt = delta / steps;
      for (let s = 0; s < steps; s++) {
        _settleAccel
          .subVectors(spring.target, spring.offset)
          .multiplyScalar(SETTLE_OMEGA * SETTLE_OMEGA)
          .addScaledVector(spring.velocity, -2 * SETTLE_OMEGA);
        spring.velocity.addScaledVector(_settleAccel, stepDt);
        spring.offset.addScaledVector(spring.velocity, stepDt);
      }
      if (
        spring.target.lengthSq() === 0 &&
        spring.offset.lengthSq() < 1e-6 &&
        spring.velocity.lengthSq() < 1e-6
      ) {
        settleSprings.delete(id);
        continue;
      }
    }
    offsets[id].add(spring.offset);
  }

  for (const node of nodeList) {
    const home = node.position;
    const offset = offsets[node.id];
    const live = livePositions[node.id];
    live.set(home[0] + offset.x, home[1] + offset.y, home[2] + offset.z);

    // **Everything above moves nodes in three dimensions; this puts them back
    // on the shell.** The constellation is a hollow sphere (content/layout.ts)
    // and the wander, the pair springs and hover attraction are all free 3-D
    // displacements, so left alone they would push nodes through the surface —
    // outward, and worse, inward, refilling the empty middle the layout exists
    // to create. Rescaling to the node's *own* seeded radius turns every one
    // of those into motion across the surface instead: the wander becomes a
    // drift over the sphere, and a neighbour attracted to a node arcs around
    // toward it rather than tunnelling through the interior.
    //
    // Per-node radius rather than one shared constant, because the shell has
    // deliberate thickness (SHELL_THICKNESS) and flattening that would cost
    // the surface its depth under fog.
    const radius = Math.hypot(home[0], home[1], home[2]);
    const length = live.length();
    if (length > 1e-6) live.multiplyScalar(radius / length);
  }

  // **Nothing above stops two nodes occupying the same place.** The wander is
  // per-node noise that knows nothing of its neighbours, and the gather is
  // worse: it holds each neighbour's *direction* from the subject and only
  // equalises the distance, so two neighbours that happen to lie on the same
  // bearing are sent to the same point. Measured on /work, that put
  // maintenance-client and rest 0.19 units *inside* each other, and the
  // ambient wander alone closed a pair to a 0.09 gap.
  //
  // So the surface gets a collision pass: push any overlapping pair apart
  // along the line between them, half the correction each, then put everyone
  // back on the shell. Re-projecting can reintroduce a shallower overlap, so
  // it repeats — three passes clears every case measured, and the loop exits
  // early on the common frame where nothing touches at all.
  for (let pass = 0; pass < SEPARATION_PASSES; pass++) {
    let collided = false;
    for (let i = 0; i < nodeList.length; i++) {
      const a = livePositions[nodeList[i].id];
      for (let j = i + 1; j < nodeList.length; j++) {
        const b = livePositions[nodeList[j].id];
        const minimum =
          nodeList[i].radius + nodeList[j].radius + SEPARATION_GAP;
        _separation.subVectors(a, b);
        const distance = _separation.length();
        if (distance >= minimum || distance < 1e-6) continue;
        collided = true;
        _separation.multiplyScalar((minimum - distance) / distance / 2);
        a.add(_separation);
        b.sub(_separation);
      }
    }
    if (!collided) break;
    for (const node of nodeList) {
      const live = livePositions[node.id];
      const radius = Math.hypot(
        node.position[0],
        node.position[1],
        node.position[2],
      );
      const length = live.length();
      if (length > 1e-6) live.multiplyScalar(radius / length);
    }
  }
}

export function getLivePosition(id: string): THREE.Vector3 | undefined {
  return livePositions[id];
}
