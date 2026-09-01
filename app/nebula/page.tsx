import type { Metadata } from "next";
import { HomeLink } from "../home-link";

export const metadata: Metadata = {
  title: "Nebula | Peter Wang",
  description:
    "The same projects and technologies, connected as a 3D constellation.",
};

/**
 * Under construction, build-sequence step 2.1: layout and static geometry
 * only. The constellation itself is the canvas persisted in the root
 * layout (see nebula-canvas.tsx) — this page is just the DOM chrome around
 * it. No hover, no click, no edges yet. See docs/05a-phase-2-sequence.md.
 */
export default function Nebula() {
  return (
    <div className="min-h-dvh px-6 pt-8 md:px-16 md:pt-10">
      <HomeLink />
    </div>
  );
}
