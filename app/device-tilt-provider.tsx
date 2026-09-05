"use client";

import { useSyncExternalStore } from "react";
import { useDeviceTilt } from "@/lib/device-tilt";

const COARSE_POINTER = "(pointer: coarse)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(COARSE_POINTER);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * Touch capability, not viewport width. A narrow desktop window is still a
 * mouse and should not start tilting anything; a large tablet is still a hand
 * holding a slab of glass and should. That is a different question from
 * useDeviceTier's, which is about layout, so it gets its own query rather than
 * borrowing that one.
 *
 * The server snapshot is `false`: rendering as "no tilt" and enabling it after
 * hydration is the safe direction, since the listener has to be installed
 * client-side anyway and nothing about first paint depends on it.
 */
function useCoarsePointer() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(COARSE_POINTER).matches,
    () => false,
  );
}

/**
 * Mounted once in the root layout, beside PointerTracker. Renders nothing —
 * it exists to own the device-orientation listener and publish to the scene
 * store, where both consumers read it (the mobile phrase label's nudge in
 * nebula-affordance.tsx, and the node shells' sheen in fresnel-material.ts).
 *
 * Neither consumer moves the scene. See lib/device-tilt.ts and
 * 01-design-system.md's Tilt-reactive behaviours section for why that
 * distinction is the whole point.
 */
export function DeviceTiltProvider() {
  useDeviceTilt(useCoarsePointer());
  return null;
}
