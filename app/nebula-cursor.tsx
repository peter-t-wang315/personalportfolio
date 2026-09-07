"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useSceneStore } from "@/lib/scene-store";
import { canDragFrom, isDragging, pointOnCluster } from "./nebula-drag-state";

/**
 * Tells the pointer what the graph will do if it presses.
 *
 * The graph is the one part of this site with no visible controls: a sphere
 * that turns and nodes that open, both looking exactly like the sphere that
 * does neither on a route where dragging is off. The cursor is the only
 * affordance it has, so it carries the whole message — `grab` where the globe
 * will turn, `grabbing` while it is turning, `pointer` over a node that opens.
 *
 * Written as an attribute on the document element rather than a style on
 * whatever is under the pointer. `cursor` inherits, so one attribute plus a
 * rule in globals.css settles it for the whole page — which is what a drag
 * needs anyway: once the globe is moving, the cursor must stay `grabbing` as
 * it crosses prose and links, not flicker into an I-beam over every paragraph
 * it passes. The same rule suppresses selection while it does.
 *
 * The states are computed from the same `canDragFrom` the drag itself uses, so
 * the cursor cannot promise something the press will not deliver: over the
 * hero headline, where text selection wins, it stays an I-beam.
 */
export function NebulaCursor() {
  const pathname = usePathname();
  const isNebula = pathname.startsWith("/nebula");

  useEffect(() => {
    const root = document.documentElement;
    let x = -1;
    let y = -1;
    let overDraggable = false;
    let pressed = false;

    function resting(): string | null {
      const { hoveredNodeId, flying } = useSceneStore.getState();
      let mode: string | null = null;

      if (x < 0) {
        mode = null;
      } else if (isNebula) {
        // Inside the graph the camera is within the shell, so there is no
        // circle to be outside of — the whole viewport turns. A node under the
        // pointer outranks that: it opens, which is the stronger promise.
        if (flying) mode = null;
        else if (hoveredNodeId) mode = "node";
        else if (overDraggable) mode = "grab";
      } else if (overDraggable && pointOnCluster(x, y)) {
        mode = "grab";
      }

      return mode;
    }

    function apply() {
      // `pressed` covers the graph route, where the camera is dragged by
      // camera-controls and nothing tells us it has begun — the press is the
      // only signal we get. Off that route our own drag reports itself, but a
      // press still reads as grabbing before it clears the slop, which is what
      // a reader expects from a cursor that just said `grab`.
      const mode = isDragging() || pressed ? "grabbing" : resting();
      if (mode) root.dataset.globeCursor = mode;
      else delete root.dataset.globeCursor;
    }

    function onMove(event: PointerEvent) {
      // A pointer that never reports as a mouse gets no cursor states; there
      // is nothing to show them on, and on touch the gesture belongs to the
      // page's scroll anyway.
      if (event.pointerType === "touch") return;
      x = event.clientX;
      y = event.clientY;
      // Held while a drag is in flight: the pointer is over whatever it has
      // been dragged across by then, which says nothing about where it began.
      if (!isDragging()) overDraggable = canDragFrom(event.target);
      apply();
    }

    function onDown(event: PointerEvent) {
      if (event.pointerType === "touch" || event.button !== 0) return;
      onMove(event);
      // Only a press that landed somewhere the globe answers. A press on a
      // node is about to open it, not turn the sphere, so it keeps `pointer`.
      pressed = resting() === "grab";
      apply();
    }

    function onUp() {
      pressed = false;
      apply();
    }

    function onLeave() {
      pressed = false;
      x = -1;
      y = -1;
      apply();
    }

    const unsubscribe = useSceneStore.subscribe(apply);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("blur", onLeave);
    document.addEventListener("pointerleave", onLeave);
    return () => {
      unsubscribe();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("blur", onLeave);
      document.removeEventListener("pointerleave", onLeave);
      delete root.dataset.globeCursor;
    };
  }, [isNebula]);

  return null;
}
