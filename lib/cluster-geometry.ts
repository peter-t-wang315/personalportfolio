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
