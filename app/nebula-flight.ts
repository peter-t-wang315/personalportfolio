import * as THREE from "three";
import { cubicBezier } from "motion/react";
import { nodeGeometry } from "@/lib/node-geometry";
import { getLivePosition } from "./nebula-simulation";

/**
 * Step 2.5's camera flight — the geometry and the timing, kept out of the
 * component that runs it so both are testable and neither is buried in a
 * frame loop. See docs/05a-phase-2-sequence.md.
 */

/** 01-design-system.md's camera-flight duration and standard easing. */
export const FLIGHT_DURATION_MS = 1400;
export const flightEase = cubicBezier(0.32, 0.72, 0, 1);

/**
 * Where the constellation is centred. Matches the resting camera target in
 * nebula-canvas.tsx — the composition is framed about this point, so it is
 * also the point every approach vector radiates from.
 */
export const CONSTELLATION_CENTER = new THREE.Vector3(0, 3.5, 0);

/**
 * How far outside a node's own surface the camera stops, in world units.
 *
 * **Never fly to the node's exact position** (05a is emphatic, and it is
 * right): the camera would end up inside the shell, which clips through the
 * geometry and renders the inside of a sphere. So the stopping point is the
 * node's live position pushed back along the approach vector by its radius
 * plus this — far enough that the shell reads as a whole object rather than
 * a wall, close enough that it fills the frame.
 */
const SURFACE_STANDOFF = 1.9;

/**
 * A fallback direction for the degenerate case where a node sits exactly at
 * the constellation's centre and the approach vector has no direction to
 * normalise. Nothing in the current layout does, but a zero-length vector
 * would silently produce NaN camera coordinates rather than a visible bug.
 */
const FALLBACK_APPROACH = new THREE.Vector3(0, 0, 1);

export interface CameraPose {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

/**
 * The pose to fly to for a given node: outside its surface, on the far side
 * from the constellation's centre, looking back at it.
 *
 * Reads the node's **live** simulation position rather than its seeded layout
 * position — the constellation floats, so by the time anything is clicked the
 * two have diverged (02-architecture.md is explicit that they do). Falling
 * back to the layout position keeps this correct under reduced motion, where
 * the simulation never steps and live positions never exist.
 */
export function focusPose(nodeId: string): CameraPose | null {
  const node = nodeGeometry[nodeId];
  if (!node) return null;

  const nodePosition =
    getLivePosition(nodeId)?.clone() ?? new THREE.Vector3(...node.position);

  const approach = nodePosition.clone().sub(CONSTELLATION_CENTER);
  if (approach.lengthSq() < 1e-6) approach.copy(FALLBACK_APPROACH);
  approach.normalize();

  return {
    position: nodePosition
      .clone()
      .addScaledVector(approach, node.radius + SURFACE_STANDOFF),
    target: nodePosition,
  };
}

/** Linear interpolation between two poses, for the flight's own easing to drive. */
export function lerpPose(from: CameraPose, to: CameraPose, t: number): CameraPose {
  return {
    position: from.position.clone().lerp(to.position, t),
    target: from.target.clone().lerp(to.target, t),
  };
}
