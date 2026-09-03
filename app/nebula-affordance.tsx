"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useDeviceTier } from "@/lib/device-tier";
import { useSceneStore } from "@/lib/scene-store";
import {
  CLUSTER_BOUNDING_RADIUS,
  CLUSTER_DEPTH,
  HOME_CAMERA_FOV,
  HOME_CAMERA_POSITION,
} from "@/lib/cluster-geometry";
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
const LABEL_TRANSITION = { duration: 0.28, ease: [0.32, 0.72, 0, 1] as const };
const LABEL_TRANSITION_INSTANT = { duration: 0 };

/**
 * World (0,0) always projects to the exact viewport center regardless of FOV
 * or aspect ratio, since the home camera looks straight down -z at the
 * origin (see CameraRig in nebula-canvas.tsx) — the cluster's parallax drift
 * is small enough (max 1.4 world units) to ignore for centering purposes.
 * Only the hover region's radius needs real trig, from the actual camera
 * distance and vertical FOV, so it tracks the cluster's true on-screen size
 * rather than a guessed pixel value.
 */
function useClusterHitRadiusPx() {
  const [radiusPx, setRadiusPx] = useState(0);

  useEffect(() => {
    function recompute() {
      const verticalFovRad = (HOME_CAMERA_FOV * Math.PI) / 180;
      const distance = HOME_CAMERA_POSITION[2] - CLUSTER_DEPTH;
      const halfHeightWorld = distance * Math.tan(verticalFovRad / 2);
      const pxPerWorldUnit = window.innerHeight / 2 / halfHeightWorld;
      setRadiusPx(CLUSTER_BOUNDING_RADIUS * pxPerWorldUnit);
    }
    recompute();
    window.addEventListener("resize", recompute);
    return () => window.removeEventListener("resize", recompute);
  }, []);

  return radiusPx;
}

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
 * and tablet (no hover state to reveal anything) get a static always-visible
 * label instead. Desktop and tablet also get a slow idle pulse ring inviting
 * a second look at the cluster (see ClusterPulse). Everything here is
 * `position: fixed`, matching the cluster it's paired with — see usePastHero
 * above for why that's correct rather than a bug.
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
        <StaticAffordanceLabel radiusPx={radiusPx} />
      )}
      {tier !== "mobile" ? (
        <ClusterPulse
          radiusPx={radiusPx}
          paused={tier === "desktop" && desktopHoverActive}
        />
      ) : null}
    </>
  );
}

function StaticAffordanceLabel({ radiusPx }: { radiusPx: number }) {
  return (
    <Link
      href="/nebula"
      className="fixed z-20 left-1/2 font-display lowercase text-[0.8125rem] tracking-[-0.01em] text-ink-faint"
      style={{
        top: "50%",
        transform: `translate(-50%, calc(-50% + ${radiusPx + 16}px))`,
      }}
    >
      what&apos;s this?
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
  const wasShowing = useRef(false);

  const showing = pointerActive || focusActive;

  useEffect(() => {
    onHoverChange(showing);
  }, [showing, onHoverChange]);

  // A fresh random phrase each time a hover session *starts*, not a cycle
  // through the list while it's held — picking on the false→true edge means
  // the phrase stays put for the duration of one hover/focus and only
  // changes on the next one.
  useEffect(() => {
    if (showing && !wasShowing.current) {
      setPhrase(PHRASES[Math.floor(Math.random() * PHRASES.length)]);
    }
    wasShowing.current = showing;
  }, [showing]);

  // Keyboard focus has no cursor position to follow, so the label sits just
  // below the hit region instead, statically — the wrapper here only ever
  // sets a static left/top/transform for positioning; the animated
  // enter/exit (opacity + drift) lives entirely on the inner motion.span
  // below, so the two never fight over the `transform` property.
  const wrapperStyle: CSSProperties = pointerActive
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
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={
                reducedMotion ? LABEL_TRANSITION_INSTANT : LABEL_TRANSITION
              }
              className={
                "block font-display lowercase text-[0.8125rem] tracking-[-0.01em] text-mask bg-mask-tint rounded px-2 py-1" +
                (focusActive && !pointerActive
                  ? " outline-2 outline-mask outline-offset-2"
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
 * A slow, low-amplitude "look inward" cue: a faint hairline ring at the
 * cluster's boundary that contracts and fades on a long, several-second-gap
 * loop (see the `cluster-pulse` keyframes in globals.css) — an invitation,
 * not an attention-grab. Desktop and tablet only, paused entirely on desktop
 * while the hover affordance is showing so the two never compete, and
 * unmounted outright under reduced motion rather than merely paused.
 */
function ClusterPulse({
  radiusPx,
  paused,
}: {
  radiusPx: number;
  paused: boolean;
}) {
  const reducedMotion = useSceneStore((s) => s.reducedMotion);

  if (reducedMotion || paused) return null;

  return (
    <div
      aria-hidden="true"
      className="cluster-pulse-ring pointer-events-none fixed z-0 left-1/2 top-1/2 rounded-full"
      style={{ width: radiusPx * 2, height: radiusPx * 2 }}
    />
  );
}
