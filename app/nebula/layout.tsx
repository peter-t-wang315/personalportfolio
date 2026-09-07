import { HomeLink } from "../home-link";
import { NebulaCloseControl } from "../nebula-close-control";

/**
 * The DOM chrome over the graph, shared by `/nebula`, `/nebula/[slug]` and
 * `/nebula/tech/[id]`. A layout rather than something each page repeats
 * because layouts persist across navigation between their children: opening
 * a node swaps the panel beneath this and leaves the corner links exactly
 * where they were, which is what "sideways through the graph" should feel
 * like from the chrome's point of view.
 *
 * The constellation itself is the canvas persisted in the root layout (see
 * nebula-canvas.tsx). This is a full-viewport layer sitting above it, so it
 * must stay `pointer-events-none` itself — otherwise it silently captures
 * every drag and hover meant for the graph, with no console error to reveal
 * why. Interactive pieces (the corner links, the panel) opt back in with
 * `pointer-events-auto` individually.
 *
 * SiteHeader hides itself on every /nebula* route (see site-header.tsx) —
 * immersive full-viewport canvas, no chrome competing with it — so HomeLink
 * here is the sole way out. Pinned to the top-left corner; the close control
 * takes the top-right. Both corners stay clear of the panel at every tier,
 * since it is 70-85% of the viewport and always centred.
 *
 * No `min-h-dvh` on the wrapper: a full-100dvh child would push the document
 * taller than the viewport and produce a page scrollbar that shouldn't exist
 * on a fixed, non-scrolling canvas route.
 */
export default function NebulaLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="pointer-events-none relative px-6 pt-8 md:px-16 md:pt-10">
      {/* Above the panel, not beside it: under 500px of viewport height the
          panel is a full-viewport sheet, and without the stacking order these
          two corners sat underneath it — dimmed by its wash and unclickable,
          which on a landscape phone made "Back to the graph" decorative. */}
      <div className="pointer-events-auto relative z-10 inline-block">
        <HomeLink />
      </div>
      <NebulaCloseControl />
      {children}
    </div>
  );
}
