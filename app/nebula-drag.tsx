"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  addDragDelta,
  pointOnCluster,
  resetDrag,
  setDragging,
} from "./nebula-drag-state";

/**
 * Beyond this the pointer is dragging the globe, not clicking it. The same
 * number the landing affordance uses to decide a click is a click, and it has
 * to be: on `/` both handlers watch the same pointer, and one entering the
 * graph while the other spins it would be the reader getting both.
 */
const DRAG_SLOP_PX = 4;

const INTERACTIVE_SELECTOR =
  "a, button, input, textarea, select, summary, label, [role='button'], [contenteditable]";

/**
 * Lets the reader spin the globe on the routes where it is a backdrop.
 *
 * `/nebula` is excluded: camera-controls owns the pointer there, and it moves
 * the camera through the shell rather than turning the sphere in front of it.
 * That is the right verb when you are inside the graph and the wrong one when
 * you are beside an article — orbiting a camera whose framing was solved to
 * clear a text column would swing the globe straight through the prose.
 *
 * So this turns the *graph*, not the camera: the composition the page solved
 * for holds still and the sphere rotates within it, which is also why the
 * spotlight's centring deliberately ignores the spin (nebula-canvas.tsx).
 *
 * **No element, on purpose.** An `<a>` sized to the cluster used to sit over
 * the hero and swallowed 21-24% of the headline's selectable area; the
 * affordance replaced it with a window listener and a circle test, and this
 * follows it rather than reintroducing the surface. It also means the two
 * cannot disagree about what a click is, since they share DRAG_SLOP_PX.
 *
 * Mouse and pen only. On touch the same gesture is the page scroll, and a
 * globe that hijacks a swipe over an article is a worse trade than a globe you
 * cannot spin — `/nebula` is where touch gets to move it, full screen, with
 * nothing behind it to scroll.
 */
export function NebulaDrag() {
  const pathname = usePathname();
  const active = !pathname.startsWith("/nebula");

  // A new route is a new view. Whatever the reader spun the last one to is not
  // an instruction about this one.
  useEffect(() => {
    resetDrag();
    return resetDrag;
  }, [pathname]);

  useEffect(() => {
    if (!active) return;

    let pointerId: number | null = null;
    let lastX = 0;
    let lastY = 0;
    let travelled = 0;

    function onPointerDown(event: PointerEvent) {
      if (event.pointerType === "touch" || event.button !== 0) return;
      if (!pointOnCluster(event.clientX, event.clientY)) return;
      // Text and controls under the globe keep their own behaviour. On a wide
      // viewport the sphere clears the measure entirely and this never fires;
      // on a narrow one they overlap, and selecting a sentence has to win.
      if ((event.target as Element | null)?.closest(INTERACTIVE_SELECTOR)) {
        return;
      }
      pointerId = event.pointerId;
      lastX = event.clientX;
      lastY = event.clientY;
      travelled = 0;
    }

    function onPointerMove(event: PointerEvent) {
      if (pointerId === null || event.pointerId !== pointerId) return;
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      travelled += Math.hypot(dx, dy);
      if (travelled <= DRAG_SLOP_PX) return;
      if (!event.buttons) {
        // The button came up somewhere this listener never saw — over an
        // iframe, or outside the window. Treat it as released rather than
        // leaving the globe stuck to the pointer.
        end();
        return;
      }
      setDragging(true);
      // Only once the drag is real, so a plain click never suppresses the
      // selection or the navigation it was going to make.
      event.preventDefault();
      addDragDelta(dx, dy);
    }

    function end() {
      pointerId = null;
      travelled = 0;
      setDragging(false);
    }

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      setDragging(false);
    };
  }, [active]);

  return null;
}
