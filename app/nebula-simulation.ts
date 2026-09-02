import * as THREE from "three";
import { edges } from "@/content";
import { nodeList, nodeGeometry } from "@/lib/node-geometry";
import { makeRng } from "@/lib/seeded-random";

/**
 * Step 2.3a — force simulation. Live position is a pure function of a
 * shared clock, not integrated velocity state: each node's position is its
 * seeded `layout.ts` position (`home`) plus a small bounded wander offset
 * built from a few desynced sine waves. Message-edge-connected pairs (every
 * runtime/dev-time edge — never shared-tech, same asymmetry as the edge
 * hierarchy itself) blend their offsets toward a shared average each frame,
 * so they drift loosely together; everything else wanders independently.
 *
 * Being a pure function of time means freezing is just holding `t` still
 * (freezeSimulation captures the last clock value; resumeSimulation lets it
 * advance again), and reduced motion is just never calling stepSimulation —
 * offsets are 0 at t=0, so livePositions sit exactly at the seeded layout
 * from the moment the module loads, with no special-case code needed here.
 */

const SIM_SEED = 0x51a7e5;
// World units. Small relative to CLUSTER_SPREAD (2.5, content/layout.ts) —
// visible drift without wandering into a neighbouring node's slot.
const WANDER_AMPLITUDE = 0.45;
// Fades wander in from a standing start instead of popping to full
// amplitude on the first frame (sin(phase) at t~0 is not ~0 for most seeded
// phases).
const RAMP_SECONDS = 2.5;
// How strongly message-edge-connected pairs pull toward their shared
// average offset each frame. Recomputed fresh from bounded sine values
// every frame (never fed back into itself), so this can't accumulate into
// runaway motion — it only sets how correlated vs. independent the pair's
// drift looks.
const PAIR_BLEND = 0.35;
// Hover attraction ramp rate (2.4 wires the calls); unwired until then.
const ATTRACT_RATE = 3;
// How far a released-toward node moves from its own home toward the
// attractor's home, at full attraction strength.
const ATTRACT_PULL = 0.6;

interface WanderParams {
  freq: THREE.Vector3;
  phase: THREE.Vector3;
}

const wanderParams: Record<string, WanderParams> = (() => {
  const rng = makeRng(SIM_SEED);
  const map: Record<string, WanderParams> = {};
  for (const node of nodeList) {
    map[node.id] = {
      freq: new THREE.Vector3(
        0.12 + rng() * 0.06,
        0.1 + rng() * 0.05,
        0.14 + rng() * 0.05,
      ),
      phase: new THREE.Vector3(
        rng() * Math.PI * 2,
        rng() * Math.PI * 2,
        rng() * Math.PI * 2,
      ),
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

let attractionTarget: string | null = null;
let attractionActive = false;
let attractionStrength = 0;

/** Given a node id, pull everything connected to it toward it. 2.4 wires this to hover. */
export function attractNeighbors(nodeId: string) {
  attractionTarget = nodeId;
  attractionActive = true;
}

/** Releases whatever attraction is active, ramping back out rather than snapping. */
export function releaseAttraction() {
  attractionActive = false;
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
  const ramp = Math.min(t / RAMP_SECONDS, 1);
  out
    .set(
      Math.sin(t * p.freq.x + p.phase.x),
      Math.sin(t * p.freq.y + p.phase.y) * 0.85,
      Math.sin(t * p.freq.z + p.phase.z),
    )
    .multiplyScalar(WANDER_AMPLITUDE * ramp);
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

  if (attractionTarget) {
    attractionStrength = THREE.MathUtils.clamp(
      attractionStrength + (attractionActive ? 1 : -1) * ATTRACT_RATE * delta,
      0,
      1,
    );
    const targetHome = nodeGeometry[attractionTarget]?.position;
    if (targetHome && attractionStrength > 0) {
      for (const id of neighborsOf(attractionTarget)) {
        const home = nodeGeometry[id].position;
        _pull
          .set(
            targetHome[0] - home[0],
            targetHome[1] - home[1],
            targetHome[2] - home[2],
          )
          .multiplyScalar(ATTRACT_PULL * attractionStrength);
        offsets[id].add(_pull);
      }
    } else if (attractionStrength === 0) {
      attractionTarget = null;
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
