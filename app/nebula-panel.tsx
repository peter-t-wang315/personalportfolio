"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useSceneStore } from "@/lib/scene-store";
import { wasHydratedBefore } from "@/lib/hydration";
import { focusedNodeHeightFraction } from "@/lib/focus-framing";
import {
  DESKTOP_MIN_WIDTH_PX,
  SHORT_VIEWPORT_HEIGHT_PX,
} from "@/lib/cluster-geometry";
import { hasWebgl } from "@/lib/webgl";

/**
 * The interior panel: real HTML, sized from 02-architecture.md's tier table,
 * centred, scrollable inside, with the graph still live past its edges.
 *
 * **Sizing is CSS, not a tier hook.** 70% of the viewport on desktop, 85%
 * below (`lg:` is 1024px, the same line useDeviceTier draws), and under 500px
 * of viewport height a full-height sheet with no morph in any tier. Media
 * queries are correct in the very first painted frame, which a JS tier switch
 * is not — the same reason hero-stats.tsx gives for its own layout.
 *
 * **It is revealed by the node opening, not faded in over it.** 05-phase-2.md
 * asks for the content to appear "inside the shell's screen-space bounds", and
 * the first version ignored the bounds half: the panel arrived at its final
 * size whatever the shell was doing, which read as a new screen dropped on top
 * of the graph rather than as the node showing you its inside.
 *
 * So the article is always laid out at its final size — text never reflows —
 * and a `clip-path` reveals it, starting as a circle exactly the size of the
 * focused node's silhouette (lib/focus-framing.ts) and stretching to the
 * panel's rounded rectangle. Because the camera stops at a fixed standoff, that
 * circle is already ~70% of viewport height for a major project node, so the
 * motion is mostly a horizontal stretch — the node pulling open sideways. A
 * technology node starts at ~35% and stretches further, which is right: it is
 * a smaller thing opening.
 *
 * Content and clip run together on the node's own 240ms, so the text appears
 * as the node stretches rather than after it.
 *
 * **It has no surface of its own.** No background, no border, no shadow: the
 * surface under this text is the node, which is still there — its own mesh,
 * turned to face the camera and reshaped into this rectangle
 * (nebula-constellation.tsx). Giving the panel a card background of its own
 * was what made opening a node look like a new object arriving, because it
 * put an opaque plane between the reader and the thing they had opened.
 *
 * The node's fresnel material does the work a card would have done: near
 * transparent across the face, so the text sits on `--paper` and stays
 * legible, and strong at the silhouette, so the opened node keeps a soft
 * `--mask` rim exactly where its edge is.
 *
 * **Two entry paths, per 05-phase-2.md's Deep linking.** On a cold entry —
 * a direct link or a reload — the content must be visible at first paint, so
 * the server renders it at full opacity and nothing waits for anything. On a
 * navigation within the graph the panel mounts while the approach flight is
 * still in the air and fades in once the camera has landed, gating on the
 * `focusSettled` the rig publishes rather than on a timer of its own.
 *
 * Telling the two apart needs no store and no prop: a panel that mounts
 * during hydration *is* the cold entry, because a client navigation renders
 * after hydration by definition. lib/hydration.ts answers that, and is false
 * for exactly that first render on the server and the client alike, so the
 * two agree and there is no hydration mismatch to suppress.
 */

export function NebulaPanel({
  nodeId,
  documentHref,
  children,
}: {
  nodeId: string;
  documentHref: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [cold] = useState(() => !wasHydratedBefore());
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  // The clip is in percentages of the panel, but the circle it starts from is
  // sized against the viewport, so converting between them needs real pixels.
  useEffect(() => {
    const measure = () =>
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  const focusSettled = useSceneStore((s) => s.focusSettled);
  const focusedNodeId = useSceneStore((s) => s.focusedNodeId);

  // A graph the visitor cannot move through has no advantage over the
  // document, and the cold-entry state has nothing to animate out of on exit
  // if it could not animate in. Read from matchMedia directly rather than the
  // store: this must decide before the store has necessarily been synced.
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !hasWebgl()) router.replace(documentHref);
  }, [router, documentHref]);

  // Visible when: cold entry (always), or the flight to *this* node has
  // landed. The second check matters for sideways navigation — the old panel
  // is already unmounted, but focusSettled is still true from the previous
  // landing for one commit before the rig resets it.
  const visible = cold || (focusSettled && focusedNodeId === nodeId);

  // Panel geometry, mirroring the CSS below and 02-architecture.md's tier
  // table: 70% of the viewport on desktop, 85% under it, a full sheet under
  // 500px of height.
  const short = viewport.height > 0 && viewport.height < SHORT_VIEWPORT_HEIGHT_PX;
  const fraction = viewport.width >= DESKTOP_MIN_WIDTH_PX ? 0.7 : 0.85;
  const panelWidth = short ? viewport.width : viewport.width * fraction;
  const panelHeight = short ? viewport.height : viewport.height * fraction;
  const nodeDiameter = focusedNodeHeightFraction(nodeId) * viewport.height;
  const insetX = Math.max(0, (panelWidth - nodeDiameter) / 2);
  const insetY = Math.max(0, (panelHeight - nodeDiameter) / 2);
  // Every value on both ends is a pixel length, which is what lets them
  // interpolate: a `circle()` will not tween into an `inset()`, and a `round`
  // given as a percentage on one end and a length on the other will not
  // either. 9999px is simply "as round as this box allows" — CSS clamps a
  // corner radius to half the shorter side, so on the square closed region it
  // resolves to a circle.
  const closedClip = `inset(${insetY}px ${insetX}px ${insetY}px ${insetX}px round 9999px)`;
  const openClip = `inset(0px 0px 0px 0px round ${short ? 0 : 40}px)`;
  // Until the viewport has been measured there is no circle to open from, and
  // guessing one produces a full-panel ellipse that reads as a corner-radius
  // tween rather than a stretch. The panel is still invisible at that point on
  // every path that animates, so starting open costs nothing.
  const measured = viewport.height > 0;

  return (
    <div className="pointer-events-none fixed inset-0 grid place-items-center">
      <motion.article
        data-nebula-panel
        aria-live="polite"
        initial={cold ? false : { opacity: 0, clipPath: openClip }}
        animate={{
          opacity: visible ? 1 : 0,
          clipPath: visible || !measured ? openClip : closedClip,
        }}
        transition={{
          opacity: { duration: 0.24, ease: [0.32, 0.72, 0, 1] },
          // Delayed by one beat so the content is already legible inside the
          // node before it starts pulling open, and so the clip runs with the
          // shell's own morph rather than against its arrival.
          // No delay any more: there is no separate shell to arrive first, so
          // the text is revealed by the same 240ms the node spends stretching.
          clipPath: { duration: 0.24, ease: [0.32, 0.72, 0, 1] },
        }}
        className={
          "pointer-events-auto overflow-y-auto overscroll-contain " +
          "w-[85vw] h-[85vh] lg:w-[70vw] lg:h-[70vh] " +
          "px-8 py-10 md:px-14 md:py-14 " +

          // Under 500px of height the node does not open at all — there is no
          // room for a rounded rectangle to read — so the sheet has no node
          // behind it to sit on and needs a surface of its own, or the text
          // lands straight on the constellation.
          "[@media(max-height:500px)]:bg-paper/95 " +
          "[@media(max-height:500px)]:w-screen [@media(max-height:500px)]:h-screen " +
          "[@media(max-height:500px)]:pt-20"
        }
      >
        <div className="max-w-[66ch] mx-auto pb-6">{children}</div>
      </motion.article>
    </div>
  );
}
