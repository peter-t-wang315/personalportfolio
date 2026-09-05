"use client";

import { useSceneStore } from "@/lib/scene-store";

/**
 * The pointer half of leaving a focused node; Escape is the other, bound in
 * nebula-constellation.tsx. 05a asks for both, and they are genuinely
 * different affordances rather than a duplicate: Escape is invisible unless
 * you already know it, and a touch device has no Escape at all.
 *
 * A real `<button>` in the DOM, not an `Html` billboard inside the canvas.
 * Being outside the scene means it keeps its own focus ring, tab order and
 * hit area for free, and it cannot be occluded by the very geometry the
 * camera is parked against.
 *
 * Top-right, opposite HomeLink's top-left corner, for the same reason that
 * one is cornered — 2.6's interior panel is 70-85% of the viewport and always
 * centred, so both corners stay clear at every tier.
 */
export function NebulaCloseControl() {
  const focusedNodeId = useSceneStore((s) => s.focusedNodeId);
  const clearFocus = useSceneStore((s) => s.clearFocus);

  if (!focusedNodeId) return null;

  return (
    <div className="pointer-events-auto absolute right-6 top-8 md:right-16 md:top-10">
      <button
        type="button"
        onClick={clearFocus}
        className="text-[0.875rem] text-ink-muted link-underline"
      >
        Back to the graph
      </button>
    </div>
  );
}
