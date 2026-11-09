"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { projects, tech } from "@/content";
import { nodeIdForPathname, routeForNode } from "@/lib/nebula-routes";
import { useSceneStore } from "@/lib/scene-store";

/**
 * **The graph, for the keyboard.**
 *
 * Every node is a mesh in a canvas, and a canvas has no tab stops: before
 * this, Tab on `/nebula` found "Home" and nothing else, so no node could be
 * opened without a pointer. The fix is not to teach the scene about focus but
 * to give it a DOM twin: one real link per node, to the same URL a click
 * pushes, so Enter opens it by the very route change the click makes and a
 * screen reader hears a list of named links.
 *
 * **One tab stop, not fifty-one.** The links are a roving-tabindex group:
 * Tab enters at one node, the arrow keys move through the rest, Tab leaves.
 * Fifty-one stops between "Home" and the panel would make the panel the last
 * thing a keyboard reader could reach.
 *
 * **The focus indicator is the scene.** The links are visually hidden; the
 * node they name is lit exactly as a pointer lights it (`hoveredNodeId`: the
 * glow, its edges, its floating title), and the camera rig turns the view to
 * it if it is off screen (`keyFocusNodeId`). A caption at the foot of the
 * frame names it and says which keys do what, for a sighted reader who could
 * not have guessed that arrows move through a picture.
 *
 * **Focus follows the reader in and back out.** Opening a node from the
 * keyboard moves focus into the panel once it has arrived, so the next Tab or
 * arrow reads the article rather than the list behind it. Leaving the node
 * (Escape, or "Back to the graph") unmounts the panel and focus with it; it is
 * put back on the node that was open, so the reader is where they left off.
 * Both only when the last thing the reader did was press a key: a pointer
 * reader closing a node did not come from this list and should not suddenly
 * find a caption and a lit node waiting for them.
 */

type GraphNode = { id: string; name: string; kind: string; href: string };

const nodes: GraphNode[] = [
  ...projects.map((p) => ({ id: p.id, name: p.title, kind: "project" })),
  ...tech.map((t) => ({ id: t.id, name: t.label, kind: "technology" })),
].flatMap((node) => {
  const href = routeForNode(node.id);
  return href ? [{ ...node, href }] : [];
});

const HINT_ID = "nebula-keyboard-hint";
const PANEL_FOCUS_TIMEOUT_MS = 4000;

/** Was the last thing the reader did a key press? Written by one listener. */
let lastInputWasKey = false;

export function NebulaKeyboard() {
  const pathname = usePathname();
  const openId = nodeIdForPathname(pathname);
  const links = useRef<(HTMLAnchorElement | null)[]>([]);
  const [active, setActive] = useState(() =>
    Math.max(0, nodes.findIndex((n) => n.id === openId)),
  );
  const [focused, setFocused] = useState<number | null>(null);
  const previousOpen = useRef<string | null>(openId);

  useEffect(() => {
    const onKey = () => {
      lastInputWasKey = true;
    };
    const onPointer = () => {
      lastInputWasKey = false;
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onPointer, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onPointer, true);
    };
  }, []);

  // In and back out. Keyed on the route, which is the only thing that knows a
  // node opened or closed (02-architecture.md: the URL is the source of truth).
  useEffect(() => {
    const was = previousOpen.current;
    previousOpen.current = openId;
    if (was === openId || !lastInputWasKey) return;

    if (openId === null) {
      // Closed. The panel took focus with it when it unmounted.
      const index = nodes.findIndex((n) => n.id === was);
      if (index < 0) return;
      const inside = document.activeElement;
      if (inside && inside !== document.body) return;
      setActive(index);
      links.current[index]?.focus({ preventScroll: true });
      return;
    }

    // Opened, or moved sideways: into the article once the node has arrived
    // and the panel is showing, which the rig says through focusSettled.
    const index = nodes.findIndex((n) => n.id === openId);
    if (index >= 0) setActive(index);
    const started = performance.now();
    let frame = 0;
    const tryFocus = () => {
      const { focusSettled, focusedNodeId } = useSceneStore.getState();
      const body = document.querySelector<HTMLElement>(
        "[data-nebula-panel] [data-panel-body]",
      );
      if (body && focusSettled && focusedNodeId === openId) {
        body.focus({ preventScroll: true });
        return;
      }
      if (performance.now() - started > PANEL_FOCUS_TIMEOUT_MS) {
        body?.focus({ preventScroll: true });
        return;
      }
      frame = requestAnimationFrame(tryFocus);
    };
    frame = requestAnimationFrame(tryFocus);
    return () => cancelAnimationFrame(frame);
  }, [openId]);

  // Leaving the route with a node still lit from the keyboard.
  useEffect(
    () => () => {
      const store = useSceneStore.getState();
      store.setKeyFocusNodeId(null);
    },
    [],
  );

  function light(index: number) {
    const node = nodes[index];
    const store = useSceneStore.getState();
    setActive(index);
    setFocused(index);
    // The open node is the panel's backdrop; lighting it would put its title
    // across the article, which is the rule pointer hover follows too. Read
    // off the route, not the store: focus comes back on close in the same
    // commit as the route change, a beat before the store's focus is cleared.
    store.setHoveredNodeId(node.id === openId ? null : node.id);
    store.setKeyFocusNodeId(node.id);
  }

  function unlight(next: EventTarget | null) {
    if (next instanceof Element && next.closest("[data-nebula-keyboard]")) return;
    const store = useSceneStore.getState();
    const node = focused === null ? null : nodes[focused];
    if (node && store.hoveredNodeId === node.id) store.setHoveredNodeId(null);
    store.setKeyFocusNodeId(null);
    setFocused(null);
  }

  function onKeyDown(event: KeyboardEvent<HTMLAnchorElement>, index: number) {
    let next: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      next = (index + 1) % nodes.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      next = (index - 1 + nodes.length) % nodes.length;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = nodes.length - 1;
    }
    if (next === null) return;
    event.preventDefault();
    links.current[next]?.focus({ preventScroll: true });
  }

  const shown = focused === null ? null : nodes[focused];

  return (
    <nav aria-label="Nodes in the graph" data-nebula-keyboard>
      <p id={HINT_ID} className="sr-only">
        Arrow keys move between nodes. Enter opens one.
      </p>
      <ul className="sr-only">
        {nodes.map((node, index) => (
          <li key={node.id}>
            <Link
              ref={(el) => {
                links.current[index] = el;
              }}
              href={node.href}
              scroll={false}
              tabIndex={index === active ? 0 : -1}
              aria-describedby={HINT_ID}
              aria-current={node.id === openId ? "page" : undefined}
              onFocus={() => light(index)}
              onBlur={(event) => unlight(event.relatedTarget)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              {node.name}, {node.kind}
            </Link>
          </li>
        ))}
      </ul>
      {/* The visible half of the focus indicator. aria-hidden: the link
          already says all of this to a screen reader. */}
      {shown && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-x-0 bottom-6 z-10 flex justify-center px-6"
        >
          <div className="flex flex-col items-center rounded-2xl border border-ink-faint/40 bg-paper/90 px-4 py-2 text-center text-[0.8125rem] leading-snug text-ink">
            <p>
              <span className="font-medium">{shown.name}</span>
              <span className="text-ink-muted"> · {shown.kind}</span>
            </p>
            <p className="text-[0.75rem] text-ink-muted">
              ← → to move · Enter to open
            </p>
          </div>
        </div>
      )}
    </nav>
  );
}
