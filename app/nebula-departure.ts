import { useSceneStore } from "@/lib/scene-store";
import { measureHero } from "./hero-layout";

/** Something with `push`, so this does not depend on next/navigation's type. */
interface Pusher {
  push: (href: string) => void;
}

/**
 * How long the real hero takes to dissolve into the plane standing in for it,
 * in ms. The route changes when it is done.
 *
 * Short, because the two are drawn in the same place from the same measured
 * layout and the only thing the fade hides is the difference between DOM text
 * and canvas text. Long enough to be a dissolve rather than a cut: below about
 * 150ms a change in rendering reads as a flicker.
 */
export const HOME_HANDOFF_MS = 220;

/**
 * **Leave the landing page for the graph.** Every way in goes through here.
 *
 * Order matters. The hero is measured *now*, so the plane is painted from the
 * page as it is under the pointer at this instant; the flight is requested,
 * so the camera starts moving on the next frame; the document is told it is
 * leaving, so the page fades over the plane; and the route follows once the
 * fade is done. Navigating first would unmount the hero in the same commit,
 * and there would be nothing to cross-fade from.
 *
 * Reduced motion skips all of it: flights are cuts there, and a fade in front
 * of a cut is latency with a curve on it.
 */
export function departForNebula(router: Pusher) {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    router.push("/nebula");
    return;
  }
  measureHero();
  useSceneStore.getState().requestArrival();
  document.documentElement.dataset.leaving = "1";
  window.setTimeout(() => {
    router.push("/nebula");
  }, HOME_HANDOFF_MS);
  // The rig clears the attribute when the route lands. If no rig ever runs —
  // the canvas is behind an error boundary — nothing else would, so this does,
  // late enough never to matter in the normal case.
  window.setTimeout(() => {
    delete document.documentElement.dataset.leaving;
  }, HOME_HANDOFF_MS * 6);
}
