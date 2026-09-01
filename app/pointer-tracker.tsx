"use client";

import { useEffect } from "react";
import { useSceneStore } from "@/lib/scene-store";

/**
 * Mounted once in the root layout. Writes normalised (-1..1) pointer
 * position and prefers-reduced-motion into the scene store, rAF-throttled
 * so it never fires more than once per frame. Renders nothing.
 */
export function PointerTracker() {
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncReducedMotion = () =>
      useSceneStore.getState().setReducedMotion(mediaQuery.matches);
    syncReducedMotion();
    mediaQuery.addEventListener("change", syncReducedMotion);

    let frame = 0;
    function handlePointerMove(event: PointerEvent) {
      if (useSceneStore.getState().reducedMotion) return;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        useSceneStore.getState().setPointer({
          x: (event.clientX / window.innerWidth) * 2 - 1,
          y: (event.clientY / window.innerHeight) * 2 - 1,
        });
      });
    }

    window.addEventListener("pointermove", handlePointerMove);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      mediaQuery.removeEventListener("change", syncReducedMotion);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
