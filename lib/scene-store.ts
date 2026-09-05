"use client";

import { create } from "zustand";

/**
 * Single cross-boundary store. The DOM overlay and the R3F scene both read
 * from this. Context doesn't cross the R3F reconciler boundary reliably,
 * so this is the standard answer. See docs/02-architecture.md.
 *
 * `mode` tracks the constellation/inside states Phase 2 needs; Phase 1 never
 * leaves 'distant'.
 */
export type SceneMode = "distant" | "constellation" | "inside";

interface SceneState {
  mode: SceneMode;
  pointer: { x: number; y: number };
  reducedMotion: boolean;
  /** Step 2.4: the single hovered node, if any. One node hovered at a time. */
  hoveredNodeId: string | null;
  /**
   * Step 2.5: the node the camera has flown to, if any. One at a time, and
   * distinct from `hoveredNodeId` — hovering is a preview that survives the
   * pointer moving on, focusing is a committed state that only Escape, the
   * close control, or focusing something else leaves.
   *
   * 2.6 pairs this with a route push to `/nebula/[slug]`; today it is purely
   * scene state, so setting it is the whole interaction.
   */
  focusedNodeId: string | null;
  /**
   * Has the approach flight finished? Written by the camera rig, which is the
   * only thing that knows — deriving it from a timer in the consumer would be
   * a second copy of the flight's duration, free to drift from the real one.
   * Consumers that must wait for the arrival (2.5's transmission swap; 2.6's
   * panel) gate on this rather than on `focusedNodeId` alone.
   */
  focusSettled: boolean;
  /**
   * The Phase 1 decorative cluster's current parallax offset, in world
   * units — written every frame from nebula-canvas.tsx's Cluster component
   * (imperative `getState().setClusterParallax(...)`, not a subscription;
   * that component doesn't need to re-render off its own write). Exists so
   * DOM overlays (nebula-affordance.tsx's hover region, hover label, and
   * idle pulse ring) can track the cluster's real, currently-rendered
   * on-screen position instead of assuming it always sits at viewport
   * center — true only when the eased parallax offset happens to be zero.
   */
  clusterParallax: { x: number; y: number };
  setMode: (mode: SceneMode) => void;
  setPointer: (pointer: { x: number; y: number }) => void;
  setReducedMotion: (reducedMotion: boolean) => void;
  setHoveredNodeId: (id: string | null) => void;
  focusNode: (id: string) => void;
  clearFocus: () => void;
  setFocusSettled: (settled: boolean) => void;
  setClusterParallax: (offset: { x: number; y: number }) => void;
}

export const useSceneStore = create<SceneState>((set) => ({
  mode: "distant",
  pointer: { x: 0, y: 0 },
  reducedMotion: false,
  hoveredNodeId: null,
  focusedNodeId: null,
  focusSettled: false,
  clusterParallax: { x: 0, y: 0 },
  setMode: (mode) => set({ mode }),
  setPointer: (pointer) => set({ pointer }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  setHoveredNodeId: (hoveredNodeId) => set({ hoveredNodeId }),
  // Focusing clears the hover with it: the pointer is about to be somewhere
  // else entirely once the camera moves, so leaving a hover highlight behind
  // would strand it on a node the viewer is no longer anywhere near.
  focusNode: (focusedNodeId) =>
    set({ focusedNodeId, hoveredNodeId: null, focusSettled: false }),
  clearFocus: () => set({ focusedNodeId: null, focusSettled: false }),
  setFocusSettled: (focusSettled) => set({ focusSettled }),
  setClusterParallax: (clusterParallax) => set({ clusterParallax }),
}));
