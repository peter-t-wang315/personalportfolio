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
  setMode: (mode: SceneMode) => void;
  setPointer: (pointer: { x: number; y: number }) => void;
  setReducedMotion: (reducedMotion: boolean) => void;
  setHoveredNodeId: (id: string | null) => void;
}

export const useSceneStore = create<SceneState>((set) => ({
  mode: "distant",
  pointer: { x: 0, y: 0 },
  reducedMotion: false,
  hoveredNodeId: null,
  setMode: (mode) => set({ mode }),
  setPointer: (pointer) => set({ pointer }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  setHoveredNodeId: (hoveredNodeId) => set({ hoveredNodeId }),
}));
