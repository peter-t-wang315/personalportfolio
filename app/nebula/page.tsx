import type { Metadata } from "next";
import { HomeLink } from "../home-link";

export const metadata: Metadata = {
  title: "Nebula | Peter Wang",
  description:
    "The same projects and technologies, connected as a 3D constellation.",
};

/**
 * The constellation itself is the canvas persisted in the root layout (see
 * nebula-canvas.tsx) — this page is just the DOM chrome on top of it, per
 * 05-phase-2.md. That chrome is a full-viewport layer sitting above the
 * canvas (root layout's <main> is z-10, the canvas is z-0), so it must stay
 * `pointer-events-none` itself — otherwise it silently captures every drag
 * and hover meant for the graph, with no console error to reveal why.
 * Interactive pieces (HomeLink now; the interior panel and "View as list"
 * link in later steps) opt back in with `pointer-events-auto` individually.
 *
 * No `min-h-dvh` here either: the sticky header already accounts for its
 * own height in the document flow, so a full-100dvh child below it pushes
 * the document taller than the viewport and produces a page scrollbar that
 * shouldn't exist on a fixed, non-scrolling canvas route.
 */
export default function Nebula() {
  return (
    <div className="pointer-events-none px-6 pt-8 md:px-16 md:pt-10">
      <div className="pointer-events-auto inline-block">
        <HomeLink />
      </div>
    </div>
  );
}
