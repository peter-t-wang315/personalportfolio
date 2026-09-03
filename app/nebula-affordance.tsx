"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useDeviceTier } from "@/lib/device-tier";
import { useSceneStore } from "@/lib/scene-store";
import { useClusterHitRadiusPx } from "@/lib/use-cluster-hit-radius";
import { CLUSTER_RADIUS } from "@/lib/cluster-geometry";
import { FADE_DISTANCE_PX } from "./scroll-cue";

/**
 * Casual, curious phrases — mixed tones (playful, quietly intriguing, terse)
 * matching the lowercase, plain-spoken register of site.positioning
 * (content/index.ts). One is picked at random each time a hover session
 * starts (see the ref-tracked transition in DesktopAffordance below), not
 * cycled through continuously while the hover holds.
 */
const PHRASES = [
  "oh?",
  "what's this?",
  "hm.",
  "curious.",
  "look closer.",
  "there's more here.",
  "psst.",
  "wait—",
  "huh.",
  "keep looking.",
  "not just decoration.",
  "there's a graph here.",
  "go on, click it.",
  "this moves.",
  "it's alive.",
  "peek inside?",
  "worth a look.",
  "hey.",
  "see for yourself.",
  "more than it looks.",
  "there's a map here.",
  "go ahead.",
  "one click away.",
  "promise, it's real.",
  "look inward.",
];

const CURSOR_OFFSET = { x: 18, y: 18 };
// Opacity is linear, not eased — the site's standard ease-out curve front-
// loads the opacity change into the first ~100ms (fine for a 240ms UI
// transition, but on this longer entrance it meant the fade was basically
// finished before it was noticed), and a plain ease-in front-loads the
// *invisible* part instead, so most of the duration reads as nothing
// happening before a late, sudden pop. Linear opacity guarantees the eye
// catches a visibly partial state throughout. The y-drift keeps the site's
// standard easing so the *position* still settles rather than moving at a
// constant rate — only opacity needed the fix. Exit is quicker and smaller,
// a softer motion than the arrival.
const LABEL_TRANSITION_IN = {
  opacity: { duration: 0.42, ease: "linear" as const },
  y: { duration: 0.42, ease: [0.32, 0.72, 0, 1] as const },
};
const LABEL_TRANSITION_OUT = {
  opacity: { duration: 0.26, ease: "linear" as const },
  y: { duration: 0.26, ease: [0.32, 0.72, 0, 1] as const },
};
const LABEL_TRANSITION_INSTANT = { duration: 0 };

/**
 * The cluster (nebula-canvas.tsx) renders on a `position: fixed` canvas, so
 * it never moves with page scroll — it's still sitting behind "Selected
 * work" once you've scrolled past the hero. The hover region below matches
 * that fixed positioning so it never desyncs from what it's supposed to sit
 * on top of, but it stops being interactive past the same scroll distance
 * ScrollCue fades over, rather than lingering as an invisible, giant,
 * clickable circle over unrelated prose.
 */
function usePastHero() {
  const [pastHero, setPastHero] = useState(false);

  useEffect(() => {
    let frame = 0;
    function handleScroll() {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setPastHero(window.scrollY > FADE_DISTANCE_PX);
      });
    }
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return pastHero;
}

/**
 * Replaces the Phase 1 placeholder link per 04-phase-1.md's updated spec.
 * Desktop gets a proximity-hover reveal sized to the real cluster; mobile
 * and tablet (no hover state to gate a reveal on) get an always-present
 * label instead, cycling through the same phrase pool on a timer rather
 * than following a cursor that doesn't exist there. Desktop and tablet also
 * get a slow idle pulse ring inviting a second look at the cluster (see
 * ClusterPulse). Everything here is `position: fixed`, matching the cluster
 * it's paired with — see usePastHero above for why that's correct rather
 * than a bug.
 *
 * Mounted from the root layout, not from `/`'s page component, and
 * self-gates on pathname — the same pattern SiteHeader and NebulaCanvasLoader
 * use. This isn't optional plumbing: Chromium computes a focused element's
 * scroll-into-view target from its *static* (pre-`position:fixed`) flow
 * position, not its rendered one. Nested inside the hero's long DOM flow,
 * this component's hypothetical static position sits hundreds of pixels
 * down the page, so tabbing to it dragged the whole page's content up even
 * though the fixed element itself never visually moved. Mounted here, right
 * after `<body>` opens, its static position is ~0 regardless of route.
 *
 * Mounting this early in the DOM, ahead of `<main className="relative
 * z-10">`, means it needs an explicit z-index above 10 on every interactive
 * element — `main` is a positioned ancestor with its own stacking context,
 * so without one, its content (the hero `<h1>`'s box, transparent
 * background and all) wins hit-testing at every pixel it covers even though
 * the fixed elements paint visually on top. See the `z-20`s below.
 */
export function NebulaAffordance() {
  const pathname = usePathname();
  const tier = useDeviceTier();
  const pastHero = usePastHero();
  const radiusPx = useClusterHitRadiusPx();
  const [desktopHoverActive, setDesktopHoverActive] = useState(false);

  if (pathname !== "/" || pastHero || radiusPx <= 0) return null;

  return (
    <>
      {tier === "desktop" ? (
        <DesktopAffordance
          radiusPx={radiusPx}
          onHoverChange={setDesktopHoverActive}
        />
      ) : (
        <MobileAffordanceLabel radiusPx={radiusPx} />
      )}
      {tier !== "mobile" ? (
        <ClusterPulse paused={tier === "desktop" && desktopHoverActive} />
      ) : null}
    </>
  );
}

const MOBILE_CYCLE_MS = 4000;

/**
 * Mobile and tablet have no hover state to gate a reveal on, so the label is
 * always present — but it still cycles through the phrase pool with the
 * same fade treatment as desktop, just without cursor-following (there's no
 * cursor). Disabled under reduced motion: one phrase, chosen once, with no
 * timer and no entrance animation.
 */
function MobileAffordanceLabel({ radiusPx }: { radiusPx: number }) {
  const reducedMotion = useSceneStore((s) => s.reducedMotion);
  const [phrase, setPhrase] = useState(
    () => PHRASES[Math.floor(Math.random() * PHRASES.length)],
  );

  useEffect(() => {
    if (reducedMotion) return;
    const id = setInterval(() => {
      setPhrase((previous) => {
        let next = previous;
        while (next === previous) {
          next = PHRASES[Math.floor(Math.random() * PHRASES.length)];
        }
        return next;
      });
    }, MOBILE_CYCLE_MS);
    return () => clearInterval(id);
  }, [reducedMotion]);

  return (
    <Link
      href="/nebula"
      aria-label="What's this? Explore the graph."
      className="fixed z-20 left-1/2"
      style={{
        top: "50%",
        transform: `translate(-50%, calc(-50% + ${radiusPx + 16}px))`,
      }}
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={phrase}
          initial={reducedMotion ? false : { opacity: 0, y: 12 }}
          animate={{
            opacity: 1,
            y: 0,
            transition: reducedMotion
              ? LABEL_TRANSITION_INSTANT
              : LABEL_TRANSITION_IN,
          }}
          exit={{
            opacity: 0,
            y: 6,
            transition: reducedMotion
              ? LABEL_TRANSITION_INSTANT
              : LABEL_TRANSITION_OUT,
          }}
          className="block font-display lowercase text-[0.8125rem] tracking-[-0.01em] text-ink-faint"
        >
          {phrase}
        </motion.span>
      </AnimatePresence>
    </Link>
  );
}

function DesktopAffordance({
  radiusPx,
  onHoverChange,
}: {
  radiusPx: number;
  onHoverChange: (active: boolean) => void;
}) {
  const reducedMotion = useSceneStore((s) => s.reducedMotion);
  const [pointerActive, setPointerActive] = useState(false);
  const [focusActive, setFocusActive] = useState(false);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [phrase, setPhrase] = useState(() => PHRASES[0]);
  // Locked at the moment a reveal *starts*, not read live off pointerActive
  // — see the wrapperStyle comment below for why that distinction is the
  // whole fix for the hover-out teleport bug.
  const [revealMode, setRevealMode] = useState<"pointer" | "focus">(
    "pointer",
  );
  const wasShowing = useRef(false);

  const showing = pointerActive || focusActive;

  useEffect(() => {
    onHoverChange(showing);
  }, [showing, onHoverChange]);

  // A fresh random phrase, and a locked-in reveal mode, each time a hover
  // session *starts* — picking on the false→true edge means both stay put
  // for the duration of one hover/focus and only change on the next one.
  useEffect(() => {
    if (showing && !wasShowing.current) {
      setPhrase(PHRASES[Math.floor(Math.random() * PHRASES.length)]);
      setRevealMode(pointerActive ? "pointer" : "focus");
    }
    wasShowing.current = showing;
  }, [showing, pointerActive]);

  // Keyboard focus has no cursor position to follow, so the label sits just
  // below the hit region instead, statically — the wrapper here only ever
  // sets a static left/top/transform for positioning; the animated
  // enter/exit (opacity + drift) lives entirely on the inner motion.span
  // below, so the two never fight over the `transform` property.
  //
  // Branching on `revealMode` (locked at reveal start) rather than the live
  // `pointerActive` is load-bearing: `pointerActive` flips false the instant
  // the pointer leaves, which is exactly when the exit animation begins — if
  // this branched on it directly, the wrapper would snap to the static
  // focus-fallback position (bottom of the hit region) the same frame the
  // fade-out starts, so the exit played out in the wrong place instead of
  // from wherever the cursor actually was. `cursor` itself keeps its last
  // value once the pointer leaves (nothing resets it), so continuing to use
  // it through the exit is exactly "fade out from the last tracked
  // position."
  const wrapperStyle: CSSProperties =
    revealMode === "pointer"
      ? {
          left: cursor.x + CURSOR_OFFSET.x,
          top: cursor.y + CURSOR_OFFSET.y,
        }
      : {
          left: "50%",
          top: "50%",
          transform: `translate(-50%, calc(-50% + ${radiusPx + 16}px))`,
        };

  return (
    <>
      <Link
        href="/nebula"
        aria-label="What's this? Explore the graph."
        className="nebula-affordance-hit fixed z-20 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: radiusPx * 2,
          height: radiusPx * 2,
          clipPath: "circle(50% at 50% 50%)",
        }}
        onPointerEnter={() => setPointerActive(true)}
        onPointerLeave={() => setPointerActive(false)}
        onPointerMove={(e) => setCursor({ x: e.clientX, y: e.clientY })}
        onFocus={() => setFocusActive(true)}
        onBlur={() => setFocusActive(false)}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed z-20"
        style={wrapperStyle}
      >
        <AnimatePresence>
          {showing ? (
            <motion.span
              key={phrase}
              initial={reducedMotion ? false : { opacity: 0, y: 12 }}
              animate={{
                opacity: 1,
                y: 0,
                transition: reducedMotion
                  ? LABEL_TRANSITION_INSTANT
                  : LABEL_TRANSITION_IN,
              }}
              exit={{
                opacity: 0,
                y: 6,
                transition: reducedMotion
                  ? LABEL_TRANSITION_INSTANT
                  : LABEL_TRANSITION_OUT,
              }}
              className={
                "block font-display lowercase text-[0.8125rem] tracking-[-0.01em] text-mask" +
                (focusActive && !pointerActive
                  ? " underline decoration-mask underline-offset-4"
                  : "")
              }
            >
              {phrase}
            </motion.span>
          ) : null}
        </AnimatePresence>
      </div>
    </>
  );
}

/**
 * A slow, low-amplitude "look inward" cue: a faint hairline ring that
 * contracts and fades on a long, several-second-gap loop (see the
 * `cluster-pulse` keyframes in globals.css) — an invitation, not an
 * attention-grab. Desktop and tablet only, paused entirely on desktop while
 * the hover affordance is showing so the two never compete, and unmounted
 * outright under reduced motion rather than merely paused.
 *
 * Sized off CLUSTER_RADIUS, not the hit-region's CLUSTER_BOUNDING_RADIUS —
 * that extra margin is deliberately generous for an *invisible* click
 * target, but drawn as an actual visible ring it read as a plain circle
 * sitting outside the cluster rather than hugging it.
 */
function ClusterPulse({ paused }: { paused: boolean }) {
  const reducedMotion = useSceneStore((s) => s.reducedMotion);
  const radiusPx = useClusterHitRadiusPx(CLUSTER_RADIUS);

  if (reducedMotion || paused || radiusPx <= 0) return null;

  return (
    <div
      aria-hidden="true"
      className="cluster-pulse-ring pointer-events-none fixed z-0 left-1/2 top-1/2 rounded-full"
      style={{ width: radiusPx * 2, height: radiusPx * 2 }}
    />
  );
}
