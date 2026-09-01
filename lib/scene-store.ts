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
  setMode: (mode: SceneMode) => void;
  setPointer: (pointer: { x: number; y: number }) => void;
  setReducedMotion: (reducedMotion: boolean) => void;
}

export const useSceneStore = create<SceneState>((set) => ({
  mode: "distant",
  pointer: { x: 0, y: 0 },
  reducedMotion: false,
  setMode: (mode) => set({ mode }),
  setPointer: (pointer) => set({ pointer }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
}));
