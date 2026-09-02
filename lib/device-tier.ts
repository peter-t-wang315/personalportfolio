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
