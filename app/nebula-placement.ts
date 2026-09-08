/**
 * How far the view has travelled between standing outside the graph and being
 * inside it: 0 is the standing pose, 1 is `/nebula`. A flight interpolates it.
 *
 * **It used to be a transform**, and the constellation was drawn shrunk to a
 * landing footprint at CLUSTER_DEPTH at 0 and life-size at the origin at 1.
 * That is gone: the graph is life-size at the origin on every route and the
 * *camera* stands where the composition asks (07-continuous-space.md, Part 3).
 * What is left is the progress itself, which two things still need — the edge
 * layer fades with it, and the spotlight turn unwinds against it so a work
 * page's heading is exactly undone by the time the reader is inside.
 *
 * **Owned by the camera rig, exactly like the camera itself, and deliberately
 * not derived from the route.** Deriving it meant it flipped to 1 on the commit
 * that changed the route, while the camera stayed at the standing pose until
 * the effect that starts the flight ran a moment later — so every navigation
 * that took more than one frame from commit to effect painted at least one
 * frame with the graph in the wrong state. It reproduced reliably at 900x600
 * under software GL, where the commit's own frame is slow.
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
