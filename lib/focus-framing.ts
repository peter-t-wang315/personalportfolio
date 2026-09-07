import { nodeGeometry } from "./node-geometry";

/**
 * How a focused node sits in the frame. Shared by the camera (which flies to
 * the pose), the shell (which opens into it) and the DOM panel (which is
 * revealed by that opening), so all three agree without measuring each other.
 *
 * Deliberately free of `three`: the panel is DOM and has no business pulling
 * the renderer into its chunk just to ask how big a sphere looks.
 */

/**
 * Field of view while a node is focused. Narrower than the 72 degrees of the
 * inside pose — a node approached at 72 sits in too much distorted periphery,
 * and the widening and narrowing become part of entering and reading.
 */
export const FOCUS_CAMERA_FOV = 50;

/**
 * How far off a node's surface the camera stops, in world units. Applied
 * toward the middle of the shell rather than away from it — see focusPose.
 */
export const SURFACE_STANDOFF = 1.9;

/**
 * The focused node's silhouette diameter, as a fraction of viewport height.
 *
 * This is the number that makes the interior panel look like the node opening
 * rather than a new screen: the panel is revealed from a circle of exactly
 * this size, so the shape the content emerges from is the shape that was
 * already on screen.
 *
 * Silhouette, not radius. A sphere's outline is where the view ray grazes it,
 * slightly wider than a flat disc of the same radius at the same distance —
 * `r·d / sqrt(d² − r²)` — and at this standoff the node is close enough that
 * the difference is visible: 0.894 against 0.85 for a major node.
 *
 * A major project node comes out at ~0.70 of viewport height, a technology
 * node at ~0.35, so the smaller the node the further it has to stretch.
 */
export function focusedNodeHeightFraction(nodeId: string): number {
  const node = nodeGeometry[nodeId];
  if (!node) return 0.5;
  const r = node.radius;
  const d = r + SURFACE_STANDOFF;
  const silhouette = (r * d) / Math.sqrt(Math.max(d * d - r * r, 1e-6));
  const halfHeight = d * Math.tan((FOCUS_CAMERA_FOV * Math.PI) / 360);
  return silhouette / halfHeight;
}
