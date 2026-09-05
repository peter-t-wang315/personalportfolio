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
/**
 * Maximum parallax displacement of the cluster, **in pixels**, per
 * 01-design-system.md's motion item 1 ("12px for text, 28px for the cluster").
 *
 * In pixels because that is how the design system specifies it. It used to be
 * a world-unit constant, which is not the same thing: world units project
 * through the camera's vertical FOV, so the on-screen swing scaled with
 * viewport height and matched the spec at no height at all — measured ±59px at
 * 1440x900 against a specified 28, and worse on a taller screen. The text half
 * was always correct, since PointerParallax works in real pixels.
 */
export const CLUSTER_PARALLAX_MAX_PX = 28;
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

/**
 * Desktop tier floor, per 02-architecture.md's Responsive tiers table. Kept as
 * a local constant rather than imported from device-tier.ts, which is a React
 * hook module — this file is deliberately dependency-free (see the header).
 */
const DESKTOP_MIN_WIDTH_PX = 1024;

/**
 * Right edge of the hero's text column, in px: page gutter plus measure.
 * Mirrors `px-16` and `max-w-[66ch]` in app/page.tsx (66ch of the body face at
 * its base size measures ~700px), and 01-design-system.md's Layout section.
 * Only has to be approximately right — it feeds a clearance gap, and
 * HERO_CLUSTER_GAP_PX absorbs a few px of drift either way.
 */
const HERO_TEXT_RIGHT_PX = 64 + 700;
/** Breathing room between the text column and the cluster's near edge. */
const HERO_CLUSTER_GAP_PX = 32;
/** Keeps the cluster off the right edge when it is pushed as far as it goes. */
const HERO_EDGE_MARGIN_PX = 32;

/**
 * Fraction of viewport width the cluster's centre sits at.
 *
 * Centred is right whenever the hero's text column and the cluster genuinely
 * fit side by side. On a wide, short laptop they do not: the cluster's
 * on-screen size comes from viewport *height*, so a short viewport shrinks it,
 * while the text column stays a fixed ~764px wide. Centred, the cluster then
 * lands inside the column — measured 43% of it covered by hero text at
 * 1024x768 and 22% at 1100x768 — which is the opposite of 04-phase-1.md's
 * "the text arranged around it so the cluster is never fully occluded".
 *
 * So this solves the constraint rather than guessing a breakpoint: put the
 * cluster's left edge just past the text column, and no further right than the
 * viewport edge allows. Where a centred cluster already clears the column the
 * first term wins and nothing moves, which is why tall or very wide screens
 * (1920x800, 2560x1440) are untouched. Where even the far-right position can't
 * fully clear it (1024 wide, where the column is most of the viewport) it goes
 * as far as it can, which is still a large improvement on centred.
 *
 * Below the desktop tier the hero is a vertical stack with no left-hand column
 * to clear, so there is nothing to solve and the cluster stays centred — the
 * same reasoning that gives narrow viewports their own centre-Y fraction
 * above, keyed off the same tier boundary the rest of the site uses.
 */
export function clusterCenterXFraction(
  viewportWidth: number,
  viewportHeight: number,
) {
  if (viewportWidth < DESKTOP_MIN_WIDTH_PX) return 0.5;

  const radiusPx =
    CLUSTER_BOUNDING_RADIUS *
    pxPerWorldUnitFor(viewportHeight) *
    clusterScaleForViewport(viewportWidth, viewportHeight);

  const clearOfText = HERO_TEXT_RIGHT_PX + HERO_CLUSTER_GAP_PX + radiusPx;
  const rightmost = viewportWidth - radiusPx - HERO_EDGE_MARGIN_PX;
  const centerX = Math.max(
    viewportWidth / 2,
    Math.min(clearOfText, rightmost),
  );

  return centerX / viewportWidth;
}
