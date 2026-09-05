"use client";

import { useEffect } from "react";
import { useSceneStore } from "@/lib/scene-store";

/**
 * Mounted once in the root layout. Writes normalised (-1..1) pointer
 * position and prefers-reduced-motion into the scene store, rAF-throttled
 * so it never fires more than once per frame. Renders nothing.
 *
 * **Touch needs its own listener, and this is not belt-and-braces.** Pointer
 * events stop arriving partway through a finger drag: as soon as the browser
 * decides the gesture is a scroll it claims it, fires `pointercancel`, and
 * sends no further `pointermove`. Measured over one twelve-step drag on a
 * 390x844 touch context: 2 pointermove, 1 pointercancel, 0 pointerup — and 11
 * touchmove. So the parallax used to lurch once as a finger landed and then
 * sit frozen for the rest of the gesture, which is exactly how it looked.
 * `touchmove` keeps reporting throughout, so it is the reliable source while a
 * finger is down.
 *
 * Lifting recentres rather than holding the last position. A mouse cursor
 * stays where it was left, so holding its offset is honest; a finger that has
 * gone leaves nothing to be offset toward.
 */
export function PointerTracker() {
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncReducedMotion = () =>
      useSceneStore.getState().setReducedMotion(mediaQuery.matches);
    syncReducedMotion();
    mediaQuery.addEventListener("change", syncReducedMotion);

    let frame = 0;
    function publish(clientX: number, clientY: number) {
      if (useSceneStore.getState().reducedMotion) return;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        useSceneStore.getState().setPointer({
          x: (clientX / window.innerWidth) * 2 - 1,
          y: (clientY / window.innerHeight) * 2 - 1,
        });
      });
    }

    function handlePointerMove(event: PointerEvent) {
      publish(event.clientX, event.clientY);
    }

    function handleTouchMove(event: TouchEvent) {
      const touch = event.touches[0];
      if (touch) publish(touch.clientX, touch.clientY);
    }

    function handleTouchEnd() {
      if (useSceneStore.getState().reducedMotion) return;
      if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
      useSceneStore.getState().setPointer({ x: 0, y: 0 });
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    window.addEventListener("touchcancel", handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchEnd);
      mediaQuery.removeEventListener("change", syncReducedMotion);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
