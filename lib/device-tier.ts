"use client";

import { useSyncExternalStore } from "react";

/**
 * Device tier per 02-architecture.md's Responsive tiers table — that table is
 * the authority on what each tier means; this hook only answers which one the
 * viewport is in right now, and re-renders on breakpoint crossings.
 */
export type DeviceTier = "desktop" | "tablet" | "mobile";

const DESKTOP_QUERY = "(min-width: 1024px)";
const TABLET_QUERY = "(min-width: 768px)";

function getTier(): DeviceTier {
  if (window.matchMedia(DESKTOP_QUERY).matches) return "desktop";
  if (window.matchMedia(TABLET_QUERY).matches) return "tablet";
  return "mobile";
}

function subscribe(onChange: () => void) {
  const queries = [
    window.matchMedia(DESKTOP_QUERY),
    window.matchMedia(TABLET_QUERY),
  ];
  queries.forEach((q) => q.addEventListener("change", onChange));
  return () => queries.forEach((q) => q.removeEventListener("change", onChange));
}

export function useDeviceTier(): DeviceTier {
  return useSyncExternalStore(subscribe, getTier, () => "desktop");
}

/** The mobile tier's upper bound, as a number the rig can compare a size to. */
export const MOBILE_MAX_WIDTH_PX = 768;

/**
 * **Does this viewport stand outside the graph on `/nebula`?**
 *
 * 07-continuous-space.md, "Mobile — the outside standing point": the graph is
 * a hollow shell, and from its centre a tall narrow frame with a fixed
 * vertical field of view sees a slice barely three nodes wide. From outside
 * the same shell is a ball, and a ball fits a tall frame. So a portrait phone
 * stands outside and turns the globe; everything else stands at the centre
 * and looks around.
 *
 * Portrait *and* the mobile tier, not one or the other. A landscape phone is
 * wide enough for the interior to work, which is why width alone is wrong;
 * an upright tablet at 768x1024 is tall enough that the interior still shows
 * a graph, which is why orientation alone is wrong. Taken from the canvas
 * size rather than `useDeviceTier` because the rig solves against pixels
 * every frame and the two must never disagree about which pose is current.
 */
export function standsOutside(width: number, height: number): boolean {
  return width < MOBILE_MAX_WIDTH_PX && height > width;
}
