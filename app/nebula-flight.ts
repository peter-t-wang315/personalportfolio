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
 * The constellation's **geometric** centre, which is the origin: content/
 * layout.ts builds every position from a Fibonacci sphere about it and
 * normalises onto a shell about it, so this is the centre of that sphere by
 * construction.
 *
 * It used to be the resting camera's target instead, on the reasoning that the
 * composition is framed about that point. That was defensible for a filled
 * ball and is wrong for a shell: the vector from here to a node is the
 * surface normal, and the approach wants to be along it. Radiating from a
 * point 3.5 units above the origin tilted every approach off-normal by up to
 * twenty degrees, and left this constant stale when the camera target moved
 * with the shrinking shell.
 */
export const CONSTELLATION_CENTER = new THREE.Vector3(0, 0, 0);

/**
 * How far off a node's own surface the camera stops, in world units.
 *
 * **Never fly to the node's exact position** (05a is emphatic, and it is
 * right): the camera would end up inside the node's shell, which clips through
 * the geometry and renders the inside of a sphere. So the stopping point is the
 * node's live position pushed back along the approach vector by its radius
 * plus this — far enough that the node reads as a whole object rather than a
 * wall, close enough that it fills the frame.
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
 * The pose to fly to for a given node: stopped just short of its surface on
 * the **inner** side, looking outward at it.
 *
 * Inner, not outer, because `/nebula` is now a place you are inside. The
 * camera used to stop beyond the node, on the far side from the centre — which
 * was right while the graph was approached from outside, and became wrong the
 * moment the resting pose moved within the shell: opening a node punched the
 * camera out through the surface and left it hanging outside the globe, and
 * closing it pulled back in again. Approaching from the middle keeps the whole
 * interaction inside.
 *
 * It also frames better. From outside, the backdrop behind a focused node was
 * the entire rest of the constellation; from inside it is mostly open paper,
 * with that node's own neighbours around it — a calmer field for the interior
 * panel to sit on.
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
    // Negative: back along the normal toward the middle, not out past the node.
    position: nodePosition
      .clone()
      .addScaledVector(approach, -(node.radius + SURFACE_STANDOFF)),
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

/** Scratch vectors for orbitLerpPose — it runs every frame of a flight. */
const _fromDir = new THREE.Vector3();
const _toDir = new THREE.Vector3();
const _axis = new THREE.Vector3();
const _quat = new THREE.Quaternion();

/**
 * Interpolation for a flight that crosses a large distance **and** a large
 * heading change — the arrival from the landing page and its reverse.
 *
 * `lerpPose` walks the camera along a straight line, which is right for a
 * focus hop (a short move that barely changes heading) and wrong here. The
 * landing pose sits 9 units from its target and the constellation's resting
 * pose sits 41 units from its, on a heading 94 degrees away; a straight line
 * between them passes closer to the subject at t≈0.1 than it started, so the
 * approach reads as a lurch inward before it pulls back out. Measured, the
 * camera's distance from the constellation's centre went 23 -> 20 -> 44.5.
 *
 * Interpolating the orbit instead — slerp the direction, lerp the distance,
 * both about the (also interpolating) target — makes that distance
 * monotonic by construction, so the subject's apparent size only ever grows.
 * Same endpoints, same duration, same easing: only the path between them
 * differs.
 */
export function orbitLerpPose(
  from: CameraPose,
  to: CameraPose,
  t: number,
): CameraPose {
  const target = from.target.clone().lerp(to.target, t);

  _fromDir.copy(from.position).sub(from.target);
  _toDir.copy(to.position).sub(to.target);
  const distance = THREE.MathUtils.lerp(_fromDir.length(), _toDir.length(), t);
  _fromDir.normalize();
  _toDir.normalize();

  // Rotate one direction toward the other about their common perpendicular.
  // Parallel directions have no such axis to find, and a normalised cross
  // product of two parallel vectors is NaN rather than zero, so that case
  // takes the straight lerp it degenerates to anyway.
  _axis.crossVectors(_fromDir, _toDir);
  const direction =
    _axis.lengthSq() < 1e-12
      ? _fromDir.clone()
      : _fromDir
          .clone()
          .applyQuaternion(
            _quat.setFromAxisAngle(
              _axis.normalize(),
              _fromDir.angleTo(_toDir) * t,
            ),
          );

  return {
    position: target.clone().addScaledVector(direction, distance),
    target,
  };
}
