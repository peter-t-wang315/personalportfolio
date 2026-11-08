"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

/**
 * **Is the page on screen the 404?**
 *
 * The persistent chrome (the canvas, the header, the cursor, the drag, the
 * curtain) decides what to be from the pathname alone, and a missing page has
 * a pathname that lies. `/nebula/bogus` starts with `/nebula`, so without this
 * the camera flew into the shell, the header hid itself and the cursor offered
 * to grab a globe that was behind the "not found" message. `/work/nope` asked
 * the canvas to spotlight a project that does not exist.
 *
 * So the 404 page says so itself, by mounting `MissingPageMarker`, and the
 * chrome reads the route through `useRoutePathname`, which reports
 * `MISSING_PATHNAME` while the marker is up. Nothing matches that pathname, so
 * every component falls into its plain-document branch without each one
 * needing to know a 404 exists.
 *
 * A counter rather than a flag: on a client navigation from one missing URL to
 * another, the new marker can mount before the old one unmounts.
 */
let mounted = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return mounted > 0;
}

function getServerSnapshot() {
  return false;
}

/** The pathname a missing page reports. Matches no route on purpose. */
export const MISSING_PATHNAME = "/404";

export function usePageMissing() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** `usePathname`, except that a missing page reads as `MISSING_PATHNAME`. */
export function useRoutePathname() {
  const pathname = usePathname();
  return usePageMissing() ? MISSING_PATHNAME : pathname;
}

/** Mounted by `app/not-found.tsx` and nothing else. */
export function MissingPageMarker() {
  useEffect(() => {
    mounted += 1;
    emit();
    return () => {
      mounted -= 1;
      emit();
    };
  }, []);
  return null;
}
