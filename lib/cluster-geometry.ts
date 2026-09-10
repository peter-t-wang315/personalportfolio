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
/**
 * **Halved from 3, so the graph stands twice as far away.** With one lens
 * everywhere, on-screen size and distance are one dial: at 72 degrees a
 * 15-unit shell draws at this footprint from 59 units when the radius is 3
 * and from 118 when it is 1.3. The flight's whole sense of distance is the
 * growth from landing size to interior size, and at 3 that was 5x whatever
 * the curve did; at 1.3 it is 9x. Every landing-page overlay derives from
 * this, so they follow. See 07-continuous-space.md, "Twice as far".
 */
export const CLUSTER_RADIUS = 1.3;
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
  /**
   * Multiplier on the drawn radius. `/work/[slug]` enlarges the globe to make
   * the turn and the subgraph readable, and the placement solve has to know:
   * the whole point of it is clearing the text column by a real margin, which
   * it cannot do against a radius that is not the one being rendered.
   */
  radiusScale = 1,
) {
  const naturalDiameter =
    2 * CLUSTER_BOUNDING_RADIUS * radiusScale * pxPerWorldUnitFor(viewportHeight);
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
 * Keyed off whether the layout is a stack (`clusterBesideTextColumn`), not
 * off the width cap. It used to be the cap — "narrow enough that the cluster
 * had to shrink" — and that condition is never true on a real phone: at
 * 390x844 the natural diameter is 150px against a 214px cap, so the cluster
 * never shrank and never dropped, and sat centred on the metrics line at
 * every phone the checks run. A stacked layout is the thing that puts text
 * above the cluster, so it is the thing to key on.
 */
export const NARROW_CLUSTER_CENTER_Y_FRACTION = 0.62;

export function clusterCenterYFraction(
  viewportWidth: number,
  viewportHeight: number,
  // Kept for callers that pass it; the answer no longer depends on the
  // drawn radius, only on whether there is a column beside the cluster.
  _radiusScale = 1,
) {
  return clusterBesideTextColumn(viewportWidth, viewportHeight)
    ? 0.5
    : NARROW_CLUSTER_CENTER_Y_FRACTION;
}

/**
 * Desktop tier floor, per 02-architecture.md's Responsive tiers table. Kept as
 * a local constant rather than imported from device-tier.ts, which is a React
 * hook module — this file is deliberately dependency-free (see the header).
 */
export const DESKTOP_MIN_WIDTH_PX = 1024;
/**
 * Short-viewport threshold, per 02-architecture.md's Orientation and short
 * viewports note. Height, not width, is the trigger there too — landscape
 * phones are its named case.
 */
export const SHORT_VIEWPORT_HEIGHT_PX = 500;

/**
 * Right edge of the hero's text column, in px: page gutter plus measure.
 * Mirrors `px-16` and `max-w-[66ch]` in app/page.tsx (66ch of the body face at
 * its base size measures ~700px), and 01-design-system.md's Layout section.
 * Only has to be approximately right — it feeds a clearance gap, and
 * HERO_CLUSTER_GAP_PX absorbs a few px of drift either way.
 */
const TEXT_MEASURE_PX = 700;

/**
 * Right edge of the page's text column, in px, at a given viewport width.
 *
 * Approximate by design — it feeds clearance decisions that absorb a few px
 * of drift — but shared, because two different things now need it: the hero's
 * cluster placement, and the spotlight labels, which hide rather than draw a
 * project's name across the article beside it.
 */
export function textColumnRightPx(viewportWidth: number) {
  // Mirrors `px-6 md:px-16` — Tailwind's md breakpoint is 768px.
  const gutter = viewportWidth >= 768 ? 64 : 24;
  return Math.min(viewportWidth, gutter + TEXT_MEASURE_PX);
}

const HERO_TEXT_RIGHT_PX = 64 + TEXT_MEASURE_PX;
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
 * The condition for solving at all is "is the hero laid out as a column beside
 * the cluster, or stacked above it". Desktop width is one way to be the former.
 * A **short** viewport is the other, and missing it was a real gap: a landscape
 * phone at 844x390 is only 844px wide, so the tier test alone left the cluster
 * dead centre of the headline, measured at 64% of the disc covered by hero
 * text. It is a wide, short strip with the text in a left-hand column — the
 * exact case this solves — it simply is not a desktop.
 *
 * Where neither holds (a portrait phone, a tablet held upright) the hero really
 * is a vertical stack with no column to clear, and the cluster stays centred.
 */
/**
 * Is the page laid out as a text column with the cluster beside it, rather
 * than as a vertical stack with the cluster behind the prose?
 *
 * Desktop width is one way to be the former. A **short** viewport is the
 * other: a landscape phone is a wide, short strip with its text in a left-hand
 * column, which is this case exactly even though it is not a desktop.
 *
 * Named and exported because it is not only a placement question. Anything
 * that draws next to the globe has to know whether there is clear space to
 * draw into — the spotlight labels ask this before rendering at all, since
 * over a stacked layout they land on the article text.
 */
export function clusterBesideTextColumn(
  viewportWidth: number,
  viewportHeight: number,
) {
  return (
    viewportWidth >= DESKTOP_MIN_WIDTH_PX ||
    viewportHeight < SHORT_VIEWPORT_HEIGHT_PX
  );
}

/**
 * Room a spotlit cluster's names need beyond the sphere itself, in px.
 *
 * Measured, not guessed: across three projects at four viewports the labels
 * reach 6-45px past the drawn radius. Less than a label's width, because the
 * lit subgraph gathers toward its subject rather than spreading to the rim —
 * and *more* on smaller globes, since the text holds a constant screen size
 * while the sphere shrinks. One constant covering the worst case is enough;
 * the alternative is re-deriving the label layout inside the placement solve,
 * which would couple the two far more tightly than 45px of slack is worth.
 */
export const LABEL_OVERHANG_PX = 48;

/**
 * @param withLabels Does this route draw the spotlight labels? Two things
 * change when it does. The cluster reserves LABEL_OVERHANG_PX of extra
 * clearance, because the solve otherwise clears the text column by exactly the
 * sphere's radius and the names hang past that — which is what made them
 * vanish and reappear as parallax slid the globe across the column's edge.
 * And it **centres in the space left over** rather than stopping as soon as it
 * clears the text.
 *
 * That second one is the difference between the graph sitting in its own
 * column and sitting shoved against the prose with dead space to its right. At
 * 1440x900 clearing-and-stopping parked it at 1008 with 188px of unused room
 * beyond it; centred it sits at 1102. The landing page keeps the old
 * behaviour: its composition is a hero with a cluster beside it, tuned in
 * 04-phase-1.md, and it has no labels to make room for.
 */
export function clusterCenterXFraction(
  viewportWidth: number,
  viewportHeight: number,
  radiusScale = 1,
  withLabels = false,
) {
  if (!clusterBesideTextColumn(viewportWidth, viewportHeight)) return 0.5;

  const radiusPx =
    CLUSTER_BOUNDING_RADIUS *
    radiusScale *
    pxPerWorldUnitFor(viewportHeight) *
    clusterScaleForViewport(viewportWidth, viewportHeight, radiusScale);

  const reach = radiusPx + (withLabels ? LABEL_OVERHANG_PX : 0);
  const spaceLeft = HERO_TEXT_RIGHT_PX + HERO_CLUSTER_GAP_PX;
  const spaceRight = viewportWidth - HERO_EDGE_MARGIN_PX;

  // Clearing the text is the floor, not the destination. Where the leftover
  // space is wide enough to centre in, centring is always the further right of
  // the two — it puts an equal gap on both sides where clearing puts the
  // minimum gap on one. Where it is not, the floor wins and the clamp below
  // takes over, which is the 1024x768 case: a 196px band for a cluster that
  // needs 458px, so it stays hard against the right margin exactly as before.
  const clearOfText = spaceLeft + reach;
  const centredInSpace = (spaceLeft + spaceRight) / 2;
  const wanted = withLabels
    ? Math.max(centredInSpace, clearOfText)
    : clearOfText;

  // The sphere itself may never leave the viewport, whatever the above wants.
  // Only the sphere: a name clipped at the edge is a smaller loss than the
  // graph being pushed back over the article to save it.
  const rightmost = viewportWidth - radiusPx - HERO_EDGE_MARGIN_PX;
  const centerX = Math.max(viewportWidth / 2, Math.min(wanted, rightmost));

  return centerX / viewportWidth;
}
