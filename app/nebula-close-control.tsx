"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * The way out of a node, both halves: a visible control for the pointer and
 * a touch device that has no Escape, and Escape for the keyboard. 05a asks
 * for both, and they are genuinely different affordances rather than a
 * duplicate.
 *
 * Both do the same thing — `router.push('/nebula')` — because the URL is the
 * source of truth for focus (02-architecture.md): the route change is what
 * clears the store, and the camera rig reacts to that by pulling back to the
 * constellation. Calling `clearFocus` directly would leave the URL still
 * naming a node the viewer has left.
 *
 * Escape used to be bound inside the canvas. It moved here because the
 * router is not reachable from inside R3F's reconciler — the same boundary
 * that makes the zustand store necessary — and because nothing in the scene
 * holds DOM focus anyway; the listener was already on `window`.
 *
 * A real `<button>` in the DOM, not an `Html` billboard inside the canvas.
 * Being outside the scene means it keeps its own focus ring, tab order and
 * hit area for free, and it cannot be occluded by the very geometry the
 * camera is parked against. Top-right, opposite HomeLink's top-left; both
 * corners stay clear of the centred panel at every tier.
 */
export function NebulaCloseControl() {
  const pathname = usePathname();
  const router = useRouter();
  const open = pathname !== "/nebula";

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") router.push("/nebula", { scroll: false });
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, router]);

  if (!open) return null;

  return (
    <div className="pointer-events-auto absolute right-6 top-8 md:right-16 md:top-10 z-10">
      <button
        type="button"
        onClick={() => router.push("/nebula", { scroll: false })}
        className="text-[0.875rem] text-ink-muted link-underline"
      >
        Back to the graph
      </button>
    </div>
  );
}
