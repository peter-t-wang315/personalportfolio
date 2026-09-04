"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
} from "motion/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useDeviceTier } from "@/lib/device-tier";
import { useSceneStore } from "@/lib/scene-store";
import { useClusterScreen } from "@/lib/use-cluster-screen";
import { CLUSTER_RADIUS } from "@/lib/cluster-geometry";
import { FADE_DISTANCE_PX } from "./scroll-cue";

/**
 * Casual, curious phrases — mixed tones (playful, quietly intriguing, terse)
 * matching the lowercase, plain-spoken register of site.positioning
 * (content/index.ts). One is picked at random per reveal (desktop) or per
 * cycle (mobile), never stepped through in order.
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
/** Small side-to-side drift alongside the fade — arrives from ±this and
 * leaves continuing the same direction rather than snapping back, so it
 * reads as one continuous waft rather than a bounce. */
const DRIFT_AMPLITUDE_PX = 6;
function randomDrift() {
  return (Math.random() * 2 - 1) * DRIFT_AMPLITUDE_PX;
}
function randomPhrase(exclude?: string) {
  let next = exclude;
  while (next === exclude) {
    next = PHRASES[Math.floor(Math.random() * PHRASES.length)];
  }
  return next as string;
}

/**
 * The follower's position spring — a gentle trail behind the cursor while
 * it moves, rather than rigid 1:1 tracking. Note this is only ever a
 * *trailing* effect: on the frame a phrase is revealed the follower is
 * placed exactly (see PhraseFollower's jump), because a spring still
 * travelling toward the cursor would put the first visible frame in the
 * wrong place — which is the jitter, just spread over a few frames instead
 * of one.
 */
const FOLLOW_SPRING = { stiffness: 500, damping: 45, mass: 0.5 };
const LABEL_TRANSITION_IN = {
  opacity: { duration: 0.42, ease: "linear" as const },
  y: { duration: 0.42, ease: [0.32, 0.72, 0, 1] as const },
  x: { duration: 0.42, ease: [0.32, 0.72, 0, 1] as const },
};
const LABEL_TRANSITION_OUT = {
  opacity: { duration: 0.26, ease: "linear" as const },
  y: { duration: 0.26, ease: [0.32, 0.72, 0, 1] as const },
  x: { duration: 0.26, ease: [0.32, 0.72, 0, 1] as const },
};
const INSTANT = { duration: 0 };

/**
 * The cluster (nebula-canvas.tsx) renders on a `position: fixed` canvas, so
 * it never moves with page scroll — it's still sitting behind "Selected
 * work" once you've scrolled past the hero. The affordance matches that
 * fixed positioning so it never desyncs from what it sits on top of, but it
 * stops being interactive past the same scroll distance ScrollCue fades
 * over, rather than lingering as an invisible, giant, clickable circle over
 * unrelated prose.
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
 * Page-wide cursor position, rAF-throttled to match PointerTracker's own
 * pattern. `syncFromEvent` lets the reveal handler seed the position from
 * the very event that triggered it — `pointerenter` fires before the
 * `pointermove` for the same physical movement, so without it the first
 * revealed frame would use the previous move's coordinates.
 */
function useCursorPx() {
  const [cursor, setCursor] = useState({ x: 0, y: 0 });

  useEffect(() => {
    let frame = 0;
    function handlePointerMove(event: PointerEvent) {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setCursor({ x: event.clientX, y: event.clientY });
      });
    }
    window.addEventListener("pointermove", handlePointerMove);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const syncFromEvent = useCallback((event: ReactPointerEvent) => {
    setCursor({ x: event.clientX, y: event.clientY });
  }, []);

  return { cursor, syncFromEvent };
}

/**
 * A phrase that lives at a moving point on screen.
 *
 * The follower is **always mounted** and animates its x/y toward the target
 * continuously, even while no phrase is showing. That's the structural fix
 * for the reveal jitter: the previous version put position on a plain
 * wrapper with raw left/top (no interpolation) *and* remounted the whole
 * subtree on every reveal, so a fresh mount had no current position to
 * animate from and simply appeared whereever the last state update said.
 * Here the element is already sitting at the right place before it becomes
 * visible, and motion interpolates from its real rendered position.
 *
 * `AnimatePresence mode="wait"` owns the phrase swap, so an outgoing phrase
 * always completes its exit before the next one mounts — that sequencing is
 * the library's job now rather than something timed by hand.
 */
function PhraseFollower({
  targetX,
  targetY,
  phrase,
  driftX,
  reducedMotion,
  spanClassName,
  href,
  positionMode,
  anchor,
  onExitComplete,
}: {
  targetX: number;
  targetY: number;
  phrase: string | null;
  driftX: number;
  reducedMotion: boolean;
  spanClassName: string;
  href?: string;
  /** "follow" trails the target with a spring (desktop, tracking a live
   * cursor). "instant" places it outright — mobile only ever moves it while
   * nothing is visible, so travelling there would just drag the next phrase
   * in from the previous spot. */
  positionMode: "follow" | "instant";
  /** Where the target point sits on the label. "top-left" reads as text set
   * beside the cursor; "center" balances the label on a point, which is what
   * the mobile spawn placement assumes when it clamps against the viewport
   * edges — anchoring top-left there let long phrases run off the right. */
  anchor: "top-left" | "center";
  onExitComplete?: () => void;
}) {
  const x = useMotionValue(targetX);
  const y = useMotionValue(targetY);
  const springX = useSpring(x, FOLLOW_SPRING);
  const springY = useSpring(y, FOLLOW_SPRING);
  const wasHidden = useRef(phrase === null);

  const instant = positionMode === "instant" || reducedMotion;

  useLayoutEffect(() => {
    x.set(targetX);
    y.set(targetY);

    const isHidden = phrase === null;
    // Place the follower exactly — no spring travel — whenever it becomes
    // visible, or whenever position changes at all in instant mode. Done in
    // a layout effect so it lands before the browser paints, meaning the
    // first frame the phrase is visible in is already in the right place.
    if (instant || (wasHidden.current && !isHidden)) {
      springX.jump(targetX);
      springY.jump(targetY);
    }
    wasHidden.current = isHidden;
  }, [targetX, targetY, phrase, instant, x, y, springX, springY]);

  const span =
    phrase === null ? null : (
      <motion.span
        key={phrase}
        initial={reducedMotion ? false : { opacity: 0, y: 12, x: driftX }}
        animate={{
          opacity: 1,
          y: 0,
          x: 0,
          transition: reducedMotion ? INSTANT : LABEL_TRANSITION_IN,
        }}
        exit={{
          opacity: 0,
          y: 6,
          x: -driftX,
          transition: reducedMotion ? INSTANT : LABEL_TRANSITION_OUT,
        }}
        className={spanClassName}
      >
        {phrase}
      </motion.span>
    );

  const presence = (
    <AnimatePresence mode="wait" onExitComplete={onExitComplete}>
      {span}
    </AnimatePresence>
  );

  return (
    <motion.div
      aria-hidden={href ? undefined : "true"}
      className="pointer-events-none fixed left-0 top-0 z-20"
      style={{ x: springX, y: springY }}
    >
      <div className={anchor === "center" ? "-translate-x-1/2 -translate-y-1/2" : undefined}>
        {href ? (
          <Link
            href={href}
            aria-label="What's this? Explore the graph."
            className="pointer-events-auto block"
          >
            {presence}
          </Link>
        ) : (
          presence
        )}
      </div>
    </motion.div>
  );
}

/**
 * Replaces the Phase 1 placeholder link per 04-phase-1.md's updated spec.
 * Desktop gets a proximity-hover reveal sized to the real cluster; mobile
 * and tablet (no hover state to gate a reveal on) get an always-present
 * label that cycles through the same phrase pool on a timer. Desktop and
 * tablet also get a slow idle pulse ring (see ClusterPulse).
 *
 * Everything anchors to the cluster's *live* screen position via
 * useClusterScreen — not a hardcoded viewport-centre assumption. World (0,0)
 * only lands at viewport centre when the cluster's parallax offset is zero,
 * which is most of the time it isn't.
 *
 * Mounted from the root layout rather than `/`'s page component, self-gating
 * on pathname, like SiteHeader and NebulaCanvasLoader. That isn't optional:
 * Chromium computes a focused element's scroll-into-view target from its
 * *static* (pre-`position:fixed`) flow position, so nested in the hero's long
 * DOM flow, tabbing to it dragged the whole page up even though the fixed
 * element never moved. Mounted here its static position is ~0 on every route.
 *
 * Mounting early, ahead of `<main className="relative z-10">`, also means
 * every interactive element here needs an explicit z-index above 10 —
 * `main` is a positioned ancestor with its own stacking context, so without
 * one its content wins hit-testing at every pixel it covers even though
 * these paint on top.
 */
export function NebulaAffordance() {
  const pathname = usePathname();
  const tier = useDeviceTier();
  const pastHero = usePastHero();
  const cluster = useClusterScreen();
  const [desktopHoverActive, setDesktopHoverActive] = useState(false);

  if (pathname !== "/" || pastHero || !cluster.ready) return null;

  return (
    <>
      {tier === "desktop" ? (
        <DesktopAffordance
          cluster={cluster}
          onHoverChange={setDesktopHoverActive}
        />
      ) : (
        <MobileAffordanceLabel cluster={cluster} />
      )}
      {tier !== "mobile" ? (
        <ClusterPulse
          centerX={cluster.centerX}
          centerY={cluster.centerY}
          paused={tier === "desktop" && desktopHoverActive}
        />
      ) : null}
    </>
  );
}

interface ClusterScreen {
  centerX: number;
  centerY: number;
  radiusPx: number;
}

const MOBILE_CYCLE_MS = 4000;
/** Distance beyond the cluster's own edge for the mobile label, in px —
 * tight enough that every spawn point reads as tethered to the graph rather
 * than floating loose on the page. */
const MOBILE_LABEL_GAP_MIN = 8;
const MOBILE_LABEL_GAP_MAX = 26;
/** Rough half-width of the longest phrase, so a spawn near the left or right
 * of the circle can't clip text off a narrow viewport — the label is centred
 * on its point, so it needs clearance on both sides. */
const MOBILE_LABEL_SAFE_MARGIN_PX = 90;
/** Degrees of arc, centred on straight up, excluded from the spawn angle.
 * The tight gap leaves little headroom in that one direction: below has
 * HeroNav's computed clearance and the sides have open page, but directly
 * above is the headline. */
const MOBILE_LABEL_EXCLUDED_TOP_ARC_DEG = 90;

function randomLabelPoint(cluster: ClusterScreen, viewportWidth: number) {
  const availableDeg = 360 - MOBILE_LABEL_EXCLUDED_TOP_ARC_DEG;
  const startDeg = 270 + MOBILE_LABEL_EXCLUDED_TOP_ARC_DEG / 2;
  const angle = (((startDeg + Math.random() * availableDeg) % 360) * Math.PI) / 180;

  const gap =
    MOBILE_LABEL_GAP_MIN +
    Math.random() * (MOBILE_LABEL_GAP_MAX - MOBILE_LABEL_GAP_MIN);
  const dist = cluster.radiusPx + gap;

  const x = cluster.centerX + Math.cos(angle) * dist;
  const y = cluster.centerY + Math.sin(angle) * dist;

  return {
    x: Math.min(
      Math.max(x, MOBILE_LABEL_SAFE_MARGIN_PX),
      viewportWidth - MOBILE_LABEL_SAFE_MARGIN_PX,
    ),
    y,
  };
}

/**
 * Mobile and tablet have no hover to gate a reveal on, so the label is always
 * present and cycles instead, picking a fresh phrase and a fresh point around
 * the cluster each time. The next point is computed when the timer fires but
 * only *committed* once the outgoing phrase has finished exiting — moving the
 * follower earlier would drag the still-fading phrase along with it. Reduced
 * motion holds one phrase at one point, with no timer.
 */
function MobileAffordanceLabel({ cluster }: { cluster: ClusterScreen }) {
  const reducedMotion = useSceneStore((s) => s.reducedMotion);
  const [phrase, setPhrase] = useState(() => randomPhrase());
  const [driftX, setDriftX] = useState(() => randomDrift());
  const [point, setPoint] = useState(() =>
    randomLabelPoint(cluster, window.innerWidth),
  );
  const pending = useRef<{ point: { x: number; y: number }; drift: number }>({
    point,
    drift: driftX,
  });

  // The cluster drifts with parallax; the timer shouldn't restart every time
  // it does, so its latest value is read through a ref at fire time rather
  // than being a dependency.
  const clusterRef = useRef(cluster);
  useEffect(() => {
    clusterRef.current = cluster;
  }, [cluster]);

  useEffect(() => {
    if (reducedMotion) return;
    const id = setInterval(() => {
      setPhrase((previous) => randomPhrase(previous));
      pending.current = {
        point: randomLabelPoint(clusterRef.current, window.innerWidth),
        drift: randomDrift(),
      };
    }, MOBILE_CYCLE_MS);
    return () => clearInterval(id);
  }, [reducedMotion]);

  const commitPending = useCallback(() => {
    setPoint(pending.current.point);
    setDriftX(pending.current.drift);
  }, []);

  return (
    <PhraseFollower
      targetX={point.x}
      targetY={point.y}
      phrase={phrase}
      driftX={driftX}
      reducedMotion={reducedMotion}
      href="/nebula"
      positionMode="instant"
      anchor="center"
      onExitComplete={commitPending}
      spanClassName="block font-display lowercase text-[0.8125rem] tracking-[-0.01em] text-ink-faint"
    />
  );
}

function DesktopAffordance({
  cluster,
  onHoverChange,
}: {
  cluster: ClusterScreen;
  onHoverChange: (active: boolean) => void;
}) {
  const reducedMotion = useSceneStore((s) => s.reducedMotion);
  const { cursor, syncFromEvent } = useCursorPx();
  const [pointerActive, setPointerActive] = useState(false);
  const [focusActive, setFocusActive] = useState(false);
  const [phrase, setPhrase] = useState(() => PHRASES[0]);
  const [driftX, setDriftX] = useState(0);
  // Locked when a reveal starts, not read live: pointerActive flips false the
  // instant the pointer leaves, which is exactly when the exit begins — so
  // reading it live would swing the follower to the focus-fallback point
  // mid-fade instead of letting the phrase leave from where it was.
  const [revealMode, setRevealMode] = useState<"pointer" | "focus">("pointer");
  const wasShowing = useRef(false);

  const showing = pointerActive || focusActive;

  useEffect(() => {
    onHoverChange(showing);
  }, [showing, onHoverChange]);

  useEffect(() => {
    if (showing && !wasShowing.current) {
      setPhrase((previous) => randomPhrase(previous));
      setRevealMode(pointerActive ? "pointer" : "focus");
      setDriftX(randomDrift());
    }
    wasShowing.current = showing;
  }, [showing, pointerActive]);

  const target =
    revealMode === "pointer"
      ? { x: cursor.x + CURSOR_OFFSET.x, y: cursor.y + CURSOR_OFFSET.y }
      : {
          x: cluster.centerX,
          y: cluster.centerY + cluster.radiusPx + 16,
        };

  return (
    <>
      <Link
        href="/nebula"
        aria-label="What's this? Explore the graph."
        className="nebula-affordance-hit fixed z-20 rounded-full"
        style={{
          left: cluster.centerX - cluster.radiusPx,
          top: cluster.centerY - cluster.radiusPx,
          width: cluster.radiusPx * 2,
          height: cluster.radiusPx * 2,
          clipPath: "circle(50% at 50% 50%)",
        }}
        onPointerEnter={(event) => {
          // Seed position from the event that triggers the reveal, so the
          // first visible frame is already correct rather than using the
          // previous pointermove's coordinates.
          syncFromEvent(event);
          setPointerActive(true);
        }}
        onPointerLeave={() => setPointerActive(false)}
        onFocus={() => setFocusActive(true)}
        onBlur={() => setFocusActive(false)}
      />
      <PhraseFollower
        targetX={target.x}
        targetY={target.y}
        phrase={showing ? phrase : null}
        driftX={driftX}
        reducedMotion={reducedMotion}
        positionMode="follow"
        anchor="top-left"
        spanClassName={
          "block font-display lowercase text-[0.8125rem] tracking-[-0.01em] text-mask" +
          (focusActive && !pointerActive
            ? " underline decoration-mask underline-offset-4"
            : "")
        }
      />
    </>
  );
}

/**
 * A slow, low-amplitude "look inward" cue: a faint hairline ring that
 * contracts past the cluster's edge and fades on a long, several-second-gap
 * loop (see the `cluster-pulse` keyframes in globals.css) — an invitation,
 * not an attention-grab. Desktop and tablet only, paused on desktop while
 * the hover affordance is showing so the two never compete, and unmounted
 * outright under reduced motion rather than merely paused.
 *
 * Sized off CLUSTER_RADIUS, not the hit region's CLUSTER_BOUNDING_RADIUS —
 * that margin is deliberately generous for an *invisible* click target, but
 * drawn as a visible ring it read as a circle sitting outside the cluster
 * rather than hugging it.
 */
function ClusterPulse({
  centerX,
  centerY,
  paused,
}: {
  centerX: number;
  centerY: number;
  paused: boolean;
}) {
  const reducedMotion = useSceneStore((s) => s.reducedMotion);
  const cluster = useClusterScreen(CLUSTER_RADIUS);

  if (reducedMotion || paused || !cluster.ready) return null;

  return (
    <div
      aria-hidden="true"
      className="cluster-pulse-ring pointer-events-none fixed z-0 rounded-full"
      style={
        {
          left: centerX,
          top: centerY,
          width: cluster.radiusPx * 2,
          height: cluster.radiusPx * 2,
        } as CSSProperties
      }
    />
  );
}
