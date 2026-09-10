"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { FLIGHT_DURATION_MS } from "./nebula-flight";

/**
 * `useLayoutEffect` warns when it runs during SSR, and this component has no
 * server output to warn about — it renders null and only ever touches the
 * document. Picking the hook by environment keeps the pre-paint timing that is
 * the whole reason it is a layout effect, without the warning. Module scope so
 * it is a stable identity rather than something a dependency array has to
 * carry.
 */
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

function isGraph(pathname: string) {
  return pathname === "/nebula" || pathname.startsWith("/nebula/");
}

/**
 * **Holds the document back for the flight out of the graph.**
 *
 * Leaving `/nebula` is a 2000ms retreat: out through the shell, back to the
 * standing point the landing page is composed from. Measured before this
 * existed, the destination painted at full opacity 190ms after the click and
 * the remaining 1.9 seconds played out behind a page that had already finished
 * arriving. The camera was doing exactly what it was specified to do — 44%,
 * 70% and 91% of the way out at each quarter — and none of it was visible.
 * That is the whole of "leaving the graph doesn't have a real animation".
 *
 * This raises `data-arriving` on `<html>`; `globals.css` holds `<main>` and the
 * header behind it, and the camera rig drops it partway through the flight so
 * the page fades in and is finished before the camera settles.
 *
 * **Why the raise lives here and the drop lives in the rig.** They are two
 * edges of one attribute answering to different clocks. The raise has to beat
 * the browser's first paint of the new route, which means a layout effect on
 * the route change — the rig's own route effect is a passive `useEffect` and
 * runs *after* that paint, so raising it there showed one full-opacity frame of
 * the destination before it vanished, which is worse than not doing it at all.
 * The drop has to answer to the flight's real progress, which only the rig
 * knows. So: this owns "we are going somewhere", the rig owns "we have nearly
 * arrived", and the rig's `settle()` clears it unconditionally so no path —
 * an interrupted flight, a reduced-motion cut, a route change that overtakes
 * another — can leave the document hidden.
 *
 * **Only ever the graph.** Every other navigation on this site is a document
 * replacing a document, with no camera travel to make room for, and a fade
 * there would just be latency with a curve on it.
 */
export function RouteCurtain() {
  const pathname = usePathname();
  const previous = useRef<string | null>(null);

  useIsomorphicLayoutEffect(() => {
    const was = previous.current;
    previous.current = pathname;
    // A first mount has nowhere to have come from: a cold load of `/` is not
    // an arrival, and hiding it would be a blank page waiting on a flight that
    // is never going to start.
    if (was === null) return;
    // The other direction. The landing page raised `data-leaving` on itself
    // when the reader clicked (nebula-departure.ts) and has now gone; the
    // graph's own chrome is about to paint and must not inherit the fade.
    if (isGraph(pathname) && !isGraph(was)) {
      delete document.documentElement.dataset.leaving;
      return;
    }
    if (!isGraph(was) || isGraph(pathname)) return;
    // Reduced motion makes every flight an instant cut (01-design-system.md),
    // so there is no journey to hold the page back for — raising it here would
    // put a blank frame in front of what should be an immediate page. Read off
    // the media query rather than the store: this runs before the rig's effect
    // and needs an answer now, and it is the same source the store is filled
    // from.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    document.documentElement.dataset.arriving = "1";

    // **The only way the page can be permanently invisible is if no rig ever
    // runs**, which is a real state: the canvas is behind an error boundary
    // and does not mount at all without WebGL (canvas-error-boundary.tsx).
    // Nothing else on the page would reveal the document, so this does, one
    // full flight later. It can only ever reveal, never hide, and in the
    // normal case the rig has already dropped the attribute well before it
    // fires — so it is a floor under the effect rather than the thing driving
    // it, and it cannot desync the way a timer that owned the reveal would.
    // A little past the flight: leaving from an open node holds for the shell
    // to close first, and the reveal at home is at the moment of landing.
    const failsafe = window.setTimeout(() => {
      delete document.documentElement.dataset.arriving;
    }, FLIGHT_DURATION_MS + 400);
    return () => window.clearTimeout(failsafe);
  }, [pathname]);

  return null;
}
