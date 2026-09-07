"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useSceneStore } from "@/lib/scene-store";
import { wasHydratedBefore } from "@/lib/hydration";
import { focusedNodeHeightFraction } from "@/lib/focus-framing";
import { clearPanelScroll, reportPanelScroll } from "@/lib/focus-scroll";
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [thumb, setThumb] = useState({ shown: false, top: 0, height: 0 });

  /**
   * The scroll indicator rides the wall of the opened node, and is only there
   * while you are actually scrolling.
   *
   * The native scrollbar cannot do either. It sits at the scrolling element's
   * own rectangular edge, and this node has an organic, breathing outline that
   * wanders away from any rectangle — so wherever the element is put, the bar
   * is a straight line beside a shape rather than part of it. And it is
   * permanent furniture on a surface that otherwise has none.
   *
   * So the native one is hidden and this is drawn instead: a `--mask` thumb
   * flush to the panel's right edge, which is *inside* the silhouette at every
   * point of the wobble, because the blob only ever bulges further out than the
   * panel rectangle, never further in. It spans the panel's full height rather
   * than the padded column's, so it reads as running the length of the wall.
   */
  const trackScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollable = el.scrollHeight - el.clientHeight;
    if (scrollable <= 1) {
      clearPanelScroll();
      setThumb((t) => (t.shown ? { ...t, shown: false } : t));
      return;
    }
    const length = Math.max(el.clientHeight / el.scrollHeight, 0.08);
    const progress = el.scrollTop / scrollable;
    // Where the node should paint it: the thumb's centre, as a fraction of
    // the node's height from the top.
    reportPanelScroll(length / 2 + progress * (1 - length), length);
    // The DOM fallback below only runs on the short-viewport sheet, where
    // there is no opened node to paint on.
    setThumb({ shown: true, top: progress * (1 - length), height: length });
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(
      () => setThumb((t) => ({ ...t, shown: false })),
      900,
    );
  }, []);

  useEffect(() => () => clearTimeout(hideTimer.current), []);
  useEffect(() => clearPanelScroll, []);

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
          // Same 240ms the node spends stretching, and no delay: there is no
          // separate shell that has to arrive first, so the text is revealed
          // by the node's own opening.
          clipPath: { duration: 0.24, ease: [0.32, 0.72, 0, 1] },
        }}
        className={
          "pointer-events-auto relative flex justify-center " +
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
        {/* Scrollable regions need to be reachable by keyboard, and hiding
            the bar does not change that — so it stays a tab stop that arrow
            keys scroll, exactly as the native one would have been. */}
        <div
          ref={scrollRef}
          onScroll={trackScroll}
          tabIndex={0}
          className={
            "h-full w-full max-w-[66ch] overflow-y-auto overscroll-contain pb-6 " +
            "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          }
        >
          {children}
        </div>
        {/*
          The DOM thumb is the **short-viewport fallback only**. Everywhere
          else the node paints its own, onto its rim, from the scroll position
          published in lib/focus-scroll.ts — which is the only way it can be
          occluded by the shape. A DOM element always paints above the canvas,
          so when the breathing outline wandered inward past a thumb laid over
          the top, the thumb was left hanging outside the blob with nowhere to
          go. Painted on the rim it *is* the wall, and stops being drawn
          wherever the wall turns away.

          Under 500px of viewport height the node deliberately does not open,
          so there is no wall to paint on and the sheet — which has its own
          rectangular paper surface — takes an ordinary edge indicator.
        */}
        <div
          className="pointer-events-none absolute right-1.5 top-[8%] h-[84%] w-[3px] [@media(min-height:500px)]:hidden"
        >
          <motion.div
            aria-hidden="true"
            className="absolute w-full rounded-full bg-mask/45"
            style={{
              top: `${thumb.top * 100}%`,
              height: `${thumb.height * 100}%`,
            }}
            animate={{ opacity: thumb.shown ? 1 : 0 }}
            transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
          />
        </div>
      </motion.article>
    </div>
  );
}
