/**
 * Where the constellation currently sits between its two placements: 0 is the
 * landing page's small distant cluster at CLUSTER_DEPTH, 1 is life-size and
 * centred on `/nebula`. A flight interpolates between them.
 *
 * **Owned by the camera rig, exactly like the camera itself, and deliberately
 * not derived from the route.** Deriving it meant it flipped to 1 on the commit
 * that changed the route, while the camera stayed at the landing pose until the
 * effect that starts the flight ran a moment later — and the landing pose is 9
 * units from the origin, inside a life-size constellation whose radius is 17.6.
 * Every navigation that took more than one frame to get from commit to effect
 * therefore painted at least one frame from *inside* the graph, a full screen of
 * two or three enormous nodes, before the flight began. It reproduced reliably
 * at 900x600 under software GL, where the commit's own frame is slow.
 *
 * Holding it here instead means it only ever moves because a flight moved it or
 * because the rig settled it, so between the commit and the effect it stays on
 * the frame the viewer was already looking at.
 *
 * A module of its own rather than a value inside nebula-canvas.tsx because
 * three separate places need it and one of them is the edge layer, which
 * nebula-canvas.tsx already imports through nebula-constellation.tsx.
 */
let placement = 0;

/** Written by the camera rig, at frame priority -2 — ahead of every reader. */
export function setPlacement(value: number) {
  placement = value;
}

export function getPlacement() {
  return placement;
}
