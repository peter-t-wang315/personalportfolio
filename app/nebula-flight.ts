import * as THREE from "three";
import { cubicBezier } from "motion/react";
import { nodeGeometry } from "@/lib/node-geometry";
import { SURFACE_STANDOFF } from "@/lib/focus-framing";
import { getLivePosition } from "./nebula-simulation";

/**
 * Step 2.5's camera flight — the geometry and the timing, kept out of the
 * component that runs it so both are testable and neither is buried in a
 * frame loop. See docs/05a-phase-2-sequence.md.
 */

/**
 * The journey between the landing page and the graph, in ms.
 *
 * 01-design-system.md specified 1400. Longer now because this flight is the
 * one piece of motion on the site that is supposed to read as *travel* rather
 * than as a transition, and it was over before it registered as either.
 *
 * Worth knowing what actually moves during it: the camera covers very little
 * ground, and almost all of the apparent motion is the constellation growing
 * from its landing footprint to life-size around the viewer. Time makes that
 * growth more legible; it does not make it more like flying. See
 * docs/05-phase-2.md on why a real approach would have to change the path
 * rather than the clock.
 */
export const FLIGHT_DURATION_MS = 2000;

/**
 * How long a move *within* the graph takes: opening a node, closing one, or
 * travelling sideways between two.
 *
 * Shorter than FLIGHT_DURATION_MS because it is a different kind of move. That
 * duration is specified for the journey between the landing page and the
 * graph — a long approach that is the site's signature moment and wants the
 * time it takes. A focus hop crosses a few units and barely turns, and at the
 * same 1400ms it read as sluggish rather than considered: the shell only
 * begins opening once the flight has landed, so opening a node cost 1400ms of
 * travel plus 240ms of opening, in series, before a word could be read.
 */
export const FOCUS_FLIGHT_DURATION_MS = 650;
export const flightEase = cubicBezier(0.32, 0.72, 0, 1);

/**
 * The curve for the journey between the landing page and the graph.
 *
 * The standard curve is right for a UI transition and wrong for travel. It
 * front-loads: measured against the real approach it covers 48% of the journey
 * in the first quarter of the time and then spends the second half creeping
 * through the last 18%. That long tail is what reads as a leisurely drift
 * toward the graph rather than a flight to it.
 *
 * This is close to linear with softened ends — 9%, 33%, 70%, 90%, 97% of the
 * approach at each tenth-quarter of the way through. The rate is roughly
 * constant, which is what sustained speed looks like: it leaves, it travels,
 * it arrives, rather than lunging and then floating.
 */
export const approachEase = cubicBezier(0.25, 0.15, 0.35, 0.85);

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
/**
 * @param baseRotation The graph's own orientation while the reader is inside
 * it. Node positions are stored in the graph's space, and the graph is turned
 * so that the arrival can be a straight line rather than a swing — so a node's
 * real position is its stored one carried through this. Passing it in rather
 * than importing it keeps this module free of the camera composition, which is
 * the reason it is a module of its own.
 */
export function focusPose(
  nodeId: string,
  baseRotation: THREE.Quaternion,
): CameraPose | null {
  const node = nodeGeometry[nodeId];
  if (!node) return null;

  const nodePosition = (
    getLivePosition(nodeId)?.clone() ?? new THREE.Vector3(...node.position)
  ).applyQuaternion(baseRotation);

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

const _slerpA = new THREE.Vector3();
const _slerpB = new THREE.Vector3();

/** Slerps a point about the origin, lerping its distance — an arc across the
 * shell rather than a chord through the middle of it. */
function slerpPoint(a: THREE.Vector3, b: THREE.Vector3, t: number): THREE.Vector3 {
  const ra = a.length();
  const rb = b.length();
  if (ra < 1e-6 || rb < 1e-6) return a.clone().lerp(b, t);
  _slerpA.copy(a).divideScalar(ra);
  _slerpB.copy(b).divideScalar(rb);
  const angle = Math.acos(THREE.MathUtils.clamp(_slerpA.dot(_slerpB), -1, 1));
  const sin = Math.sin(angle);
  if (sin < 1e-4) return a.clone().lerp(b, t);
  return _slerpA
    .clone()
    .multiplyScalar(Math.sin((1 - t) * angle) / sin)
    .addScaledVector(_slerpB, Math.sin(t * angle) / sin)
    .multiplyScalar(ra + (rb - ra) * t);
}

/**
 * Interpolation for travelling from one node to another without leaving the
 * shell — the flight that follows a link inside an open panel.
 *
 * Both endpoints sit just inside the surface, so a straight line between them
 * is a chord: it cuts through the hollow middle the layout exists to keep
 * empty, and arrives from the wrong side. Slerping instead sweeps the camera
 * around the inside of the shell along the great circle joining the two nodes
 * — which is the same path the edge between them takes, since edges are drawn
 * on the surface too. The trip reads as travelling along the connection,
 * because geometrically it is.
 */
export function shellLerpPose(from: CameraPose, to: CameraPose, t: number): CameraPose {
  return {
    position: slerpPoint(from.position, to.position, t),
    target: slerpPoint(from.target, to.target, t),
  };
}

/** Linear interpolation between two poses, for the flight's own easing to drive. */
export function lerpPose(from: CameraPose, to: CameraPose, t: number): CameraPose {
  return {
    position: from.position.clone().lerp(to.position, t),
    target: from.target.clone().lerp(to.target, t),
  };
}

/** Scratch vectors for approachLerpPose — it runs every frame of a flight. */
const _fromDir = new THREE.Vector3();
const _toDir = new THREE.Vector3();
const _lookFrom = new THREE.Vector3();
const _lookTo = new THREE.Vector3();

/**
 * Interpolation for the journey between the landing page and the graph.
 *
 * Everything here is measured from the **graph's centre**, which is the only
 * quantity that means anything on this flight: how far the reader is from the
 * thing they are flying to or away from. The pose's own target is not that. A
 * camera parked inside the graph has its target a tenth of a unit ahead of it,
 * because that is what makes a drag look around rather than orbit — so a path
 * that interpolated distance-from-target ran the departure from 0.1 to 84,
 * which put the camera still 2.9 units out at half time and then threw it to
 * the landing pose in the last few frames. It read as nothing happening and
 * then a snap.
 *
 * Distance from the centre is interpolated **geometrically**. Apparent size
 * goes as 1/d, so equal steps of distance are wildly unequal steps of what the
 * reader sees: over an 84-to-3 approach the first half of the distance buys
 * almost no change and the last tenth buys most of it. A constant ratio per
 * unit time is a constant apparent rate, which is what sustained travel looks
 * like — and it is monotonic by construction, so the graph only ever grows on
 * the way in and only ever shrinks on the way out.
 *
 * Direction and heading are slerped separately: where the camera is around the
 * graph, and where it is pointing. On the arrival the heading is already
 * constant — the graph turns instead of the camera (nebula-canvas.tsx) — so
 * that term does nothing and the flight is a straight run. Leaving a node it
 * carries the turn off the node's surface.
 */
export function approachLerpPose(
  from: CameraPose,
  to: CameraPose,
  t: number,
): CameraPose {
  const fromLen = from.position.length();
  const toLen = to.position.length();
  const distance =
    fromLen > 1e-3 && toLen > 1e-3
      ? fromLen * Math.pow(toLen / fromLen, t)
      : THREE.MathUtils.lerp(fromLen, toLen, t);

  // Where the camera sits around the graph.
  _fromDir.copy(from.position);
  _toDir.copy(to.position);
  const position =
    fromLen > 1e-3 && toLen > 1e-3
      ? slerpDirection(_fromDir.divideScalar(fromLen), _toDir.divideScalar(toLen), t)
          .multiplyScalar(distance)
      : from.position.clone().lerp(to.position, t);

  // Where it points, and how far ahead its pivot sits — the second only so
  // camera-controls has a sane radius to hand over to on arrival.
  _lookFrom.copy(from.target).sub(from.position);
  _lookTo.copy(to.target).sub(to.position);
  const lookLen = THREE.MathUtils.lerp(_lookFrom.length(), _lookTo.length(), t);
  const heading = slerpDirection(
    _lookFrom.normalize(),
    _lookTo.normalize(),
    t,
  );

  return {
    position,
    target: position.clone().addScaledVector(heading, lookLen),
  };
}

/** Slerps between two unit vectors, falling back to a lerp when parallel. */
function slerpDirection(a: THREE.Vector3, b: THREE.Vector3, t: number) {
  const dot = THREE.MathUtils.clamp(a.dot(b), -1, 1);
  const angle = Math.acos(dot);
  if (angle < 1e-4) return a.clone();
  const sin = Math.sin(angle);
  return a
    .clone()
    .multiplyScalar(Math.sin((1 - t) * angle) / sin)
    .addScaledVector(b, Math.sin(t * angle) / sin)
    .normalize();
}
