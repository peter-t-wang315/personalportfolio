/**
 * Phase 1 decorative-cluster geometry, shared between nebula-canvas.tsx (which
 * renders it) and nebula-affordance.tsx (which sizes a hover region to match
 * it). Kept dependency-free of `three`/`@react-three/*` on purpose — the
 * affordance is part of the landing page's eagerly-loaded bundle, and pulling
 * the R3F stack in just for these numbers would defeat the `next/dynamic`,
 * `ssr: false` lazy-loading nebula-canvas-loader.tsx does for the real canvas
 * (see docs/02-architecture.md's LCP note).
 */
export const HOME_CAMERA_POSITION: [number, number, number] = [0, 0, 9];
export const HOME_CAMERA_FOV = 45;
export const CLUSTER_RADIUS = 3;
export const CLUSTER_DEPTH = -14;

/**
 * Bounding radius of the whole drifting cluster from its center: the
 * rejection-sampled sphere nodes sit within CLUSTER_RADIUS, plus the largest
 * possible per-node scale (see nebula-canvas.tsx's generateNodes) and drift
 * amplitude, so the hover region matches what's actually on screen.
 */
export const CLUSTER_BOUNDING_RADIUS = CLUSTER_RADIUS + 0.22 + 0.18;

/**
 * Largest fraction of viewport *width* the cluster's projected diameter may
 * occupy. Its on-screen size derives from viewport *height* (the camera's
 * vertical FOV), which is fine on a landscape desktop but wrong on a tall
 * narrow phone: at 390x844 the natural projection is ~300px across a 390px
 * screen, so the outer nodes run into both gutters and the whole thing reads
 * as cramped and cut off. Wide viewports are already well under this cap and
 * are left completely untouched.
 */
export const MAX_CLUSTER_WIDTH_FRACTION = 0.55;

/** Unscaled pixels per world unit at the cluster's depth, from the real
 * camera distance and vertical FOV — not a guessed value. */
export function pxPerWorldUnitFor(viewportHeight: number) {
  const verticalFovRad = (HOME_CAMERA_FOV * Math.PI) / 180;
  const distance = HOME_CAMERA_POSITION[2] - CLUSTER_DEPTH;
  const halfHeightWorld = distance * Math.tan(verticalFovRad / 2);
  return viewportHeight / 2 / halfHeightWorld;
}

/**
 * Uniform scale applied to the cluster group so it never exceeds
 * MAX_CLUSTER_WIDTH_FRACTION of the viewport width. Returns 1 whenever the
 * natural projection already fits, so this is a no-op on desktop and tablet
 * and only shrinks the cluster on genuinely narrow screens.
 *
 * Both the rendered group (nebula-canvas.tsx) and every DOM overlay measured
 * against it (use-cluster-screen.ts) multiply by this same factor, so the
 * hover region, pulse ring, and label placement stay locked to what's
 * actually drawn.
 */
export function clusterScaleForViewport(
  viewportWidth: number,
  viewportHeight: number,
) {
  const naturalDiameter =
    2 * CLUSTER_BOUNDING_RADIUS * pxPerWorldUnitFor(viewportHeight);
  if (naturalDiameter <= 0) return 1;
  return Math.min(
    1,
    (MAX_CLUSTER_WIDTH_FRACTION * viewportWidth) / naturalDiameter,
  );
}

/**
 * Fraction of viewport height the cluster's centre sits at.
 *
 * Centred (0.5) is right on a landscape desktop, where the hero text is a
 * left-hand column and the cluster shares the row beside it. On a tall
 * narrow phone the layout is a vertical stack instead, and a centred cluster
 * puts its entire top half underneath the headline and stats row — they
 * overlap because the text simply has nowhere else to be. Dropping the
 * centre lower there gives the stack real separation: headline and stats
 * above, cluster below them, nav below that (hero-nav.tsx measures its own
 * clearance from the resulting edge).
 *
 * Keyed off the same condition as the width cap, so "narrow enough that the
 * cluster had to shrink" and "narrow enough that it has to move down" stay
 * one decision rather than two thresholds that can disagree.
 */
export const NARROW_CLUSTER_CENTER_Y_FRACTION = 0.62;

export function clusterCenterYFraction(
  viewportWidth: number,
  viewportHeight: number,
) {
  return clusterScaleForViewport(viewportWidth, viewportHeight) < 1
    ? NARROW_CLUSTER_CENTER_Y_FRACTION
    : 0.5;
}
