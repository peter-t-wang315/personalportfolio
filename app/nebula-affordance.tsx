"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  type Transition,
} from "motion/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
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
/**
 * Side-to-side drift alongside the fade. A phrase arrives offset by ±this and
 * leaves continuing in the same direction rather than snapping back, so one
 * appearance reads as a single uninterrupted pass rather than a bounce. The
 * sign is redrawn per phrase, so successive phrases cross in random
 * directions.
 *
 * Desktop keeps this small — the label is pinned to a moving cursor there, and
 * a wide horizontal travel on top of that reads as lag, not drift. The
 * mobile/tablet label has no cursor to belong to, so it gets the full
 * amplitude and no vertical component at all: a phrase slides across, which
 * reads as a thought passing through rather than a tooltip popping up.
 */
const DRIFT_AMPLITUDE_PX = 6;
const MOBILE_DRIFT_AMPLITUDE_PX = 22;
/** Vertical rise on entry; halved on exit. Zero for a purely lateral drift. */
const DESKTOP_DRIFT_RISE_PX = 12;

function randomDrift(amplitude: number = DRIFT_AMPLITUDE_PX) {
  // Never near zero: a phrase that barely moves reads as a plain fade and
  // breaks the alternation the random sign is there to create.
  const magnitude = amplitude * (0.65 + Math.random() * 0.35);
  return Math.random() < 0.5 ? -magnitude : magnitude;
}

/**
 * Where a phrase sits at each stage of its life, as an offset from the point
 * the follower is parked on. `rest` is not usually the origin: on mobile the
 * phrase is still travelling toward it when the exit takes over, which is what
 * keeps it moving the whole time it is legible.
 */
interface DriftOffsets {
  enter: { x: number; y: number };
  rest: { x: number; y: number };
  exit: { x: number; y: number };
}

/**
 * Desktop: the label is pinned to a live cursor, so it arrives, settles, and
 * waits. Wide or continuous travel on top of cursor-following reads as lag.
 */
function desktopDrift(drift: number): DriftOffsets {
  return {
    enter: { x: drift, y: DESKTOP_DRIFT_RISE_PX },
    rest: { x: 0, y: 0 },
    exit: { x: -drift, y: DESKTOP_DRIFT_RISE_PX / 2 },
  };
}

/**
 * Mobile and tablet: one long lateral pass, purely horizontal. The phrase
 * enters offset to one side and is still crossing when it leaves — `rest` sits
 * well past the origin and MOBILE_DRIFT_DURATION_S outlasts the hold, so the
 * animation never completes and the text is never parked. A phrase that sat
 * still for the three seconds between its fade in and its fade out read as
 * stale; this reads as a thought passing through.
 */
/**
 * Extra lateral distance covered during the fade in and the fade out, as a
 * multiple of the drift amplitude. The entrance is front-loaded by the x
 * curve below, so this travel is spent almost entirely inside the ~0.34s of
 * the fade rather than bleeding into the hold — the phrase arrives moving,
 * then settles into the slow crossing. The exit gets the same treatment in
 * reverse, sliding away as it goes rather than fading in place.
 */
const MOBILE_ENTER_LEAD = 2.1;
const MOBILE_EXIT_LEAD = 1.1;

function mobileDrift(drift: number): DriftOffsets {
  const rest = -drift * 0.55;
  return {
    enter: { x: drift * MOBILE_ENTER_LEAD, y: 0 },
    rest: { x: rest, y: 0 },
    exit: { x: rest - drift * MOBILE_EXIT_LEAD, y: 0 },
  };
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
/**
 * One stage of the label's animation. Opacity and position are always given
 * their own timing, because the two tempos differ — most sharply on mobile,
 * where the fade is a third of a second and the travel runs for five.
 */
type LabelTransition = Transition;

const LABEL_TRANSITION_IN: LabelTransition = {
  opacity: { duration: 0.42, ease: "linear" as const },
  y: { duration: 0.42, ease: [0.32, 0.72, 0, 1] as const },
  x: { duration: 0.42, ease: [0.32, 0.72, 0, 1] as const },
};
const LABEL_TRANSITION_OUT: LabelTransition = {
  opacity: { duration: 0.26, ease: "linear" as const },
  y: { duration: 0.26, ease: [0.32, 0.72, 0, 1] as const },
  x: { duration: 0.26, ease: [0.32, 0.72, 0, 1] as const },
};

/**
 * Mobile's separate tempo: quick in, a long slow crossing, quicker out.
 *
 * Opacity and position are deliberately on different clocks. The fade is short
 * at both ends so the phrase reads as arriving and leaving decisively, while
 * the lateral travel runs for longer than the phrase is even on screen — see
 * mobileDrift. The x curve keeps a little velocity at its end (its second
 * control point stops short of 1) rather than the site's standard ease, which
 * lands at zero and would leave the text visibly parked.
 */
const MOBILE_DRIFT_DURATION_S = 5.2;
const MOBILE_LABEL_TRANSITION_IN: LabelTransition = {
  opacity: { duration: 0.34, ease: "linear" as const },
  y: { duration: MOBILE_DRIFT_DURATION_S, ease: "linear" as const },
  // Sharply front-loaded, so most of the entrance lead is spent while the
  // phrase is still fading in and the hold keeps the slow crossing it had
  // before. The second control point stops short of 1 so the curve still has
  // velocity at its end — the site's standard ease lands at zero and would
  // leave the text visibly parked, which is the thing this whole treatment
  // exists to avoid.
  x: {
    duration: MOBILE_DRIFT_DURATION_S,
    ease: [0.03, 0.62, 0.38, 0.9] as const,
  },
};
const MOBILE_LABEL_TRANSITION_OUT: LabelTransition = {
  // Distinctly quicker than the entrance, so the rhythm is arrive, linger,
  // gone — not a symmetric pulse. The travel is kept close to the fade's own
  // length: `AnimatePresence mode="wait"` holds the next phrase until the
  // slowest exiting property finishes, so a long x here would just be dead
  // time with nothing on screen.
  opacity: { duration: 0.22, ease: "linear" as const },
  y: { duration: 0.34, ease: "linear" as const },
  x: { duration: 0.34, ease: "linear" as const },
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
 * pattern. It is the single source for both where the label sits *and*
 * whether the label should be showing at all — see DesktopAffordance, which
 * derives proximity from these coordinates rather than from pointer events
 * on an element.
 *
 * `inWindow` replaces what the old hit region's `onPointerLeave` used to do.
 * With proximity computed from a remembered coordinate, a cursor that leaves
 * the page entirely would otherwise leave its last position — possibly still
 * inside the cluster — standing, and the phrase revealed behind it.
 */
function useCursorPx() {
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [inWindow, setInWindow] = useState(false);

  useEffect(() => {
    let frame = 0;
    function handlePointerMove(event: PointerEvent) {
      if (frame) return;
      const { clientX, clientY } = event;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setCursor({ x: clientX, y: clientY });
        setInWindow(true);
      });
    }
    // A null relatedTarget on pointerout means the pointer left the document
    // rather than moving between two elements inside it.
    function handlePointerOut(event: PointerEvent) {
      if (event.relatedTarget === null) setInWindow(false);
    }
    window.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerout", handlePointerOut);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerout", handlePointerOut);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return { cursor, inWindow };
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
  offsets,
  transitionIn,
  transitionOut,
  reducedMotion,
  spanClassName,
  href,
  linkClassName,
  onFocus,
  onBlur,
  positionMode,
  anchor,
  onExitComplete,
}: {
  targetX: number;
  targetY: number;
  phrase: string | null;
  offsets: DriftOffsets;
  transitionIn: LabelTransition;
  transitionOut: LabelTransition;
  reducedMotion: boolean;
  spanClassName: string;
  href?: string;
  /** Extra classes for the anchor itself, when there is one. Desktop uses it
   * to suppress the focus outline in favour of underlining the phrase; mobile
   * deliberately does not, since there the label is a visible, ordinarily
   * focusable link. */
  linkClassName?: string;
  onFocus?: () => void;
  onBlur?: () => void;
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
        initial={
          reducedMotion
            ? false
            : { opacity: 0, y: offsets.enter.y, x: offsets.enter.x }
        }
        animate={{
          opacity: 1,
          y: reducedMotion ? 0 : offsets.rest.y,
          x: reducedMotion ? 0 : offsets.rest.x,
          transition: reducedMotion ? INSTANT : transitionIn,
        }}
        exit={{
          opacity: 0,
          y: offsets.exit.y,
          x: offsets.exit.x,
          transition: reducedMotion ? INSTANT : transitionOut,
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
            className={
              "pointer-events-auto block" +
              (linkClassName ? ` ${linkClassName}` : "")
            }
            onFocus={onFocus}
            onBlur={onBlur}
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
/** Distance beyond whatever clearance the label needs, in px — tight enough
 * that every spawn point still reads as tethered to the graph rather than
 * floating loose on the page. */
const MOBILE_LABEL_GAP_MIN = 10;
const MOBILE_LABEL_GAP_MAX = 28;
/** Keeps the label's box off the viewport edges. */
const MOBILE_LABEL_SAFE_MARGIN_PX = 14;
/** Degrees of arc, centred on straight up, excluded from the spawn angle.
 * Below has HeroNav's clearance and the sides have open page, but directly
 * above is the headline. */
const MOBILE_LABEL_EXCLUDED_TOP_ARC_DEG = 90;
/** Advance width of one character of the label's face — Geist Mono at
 * 0.8125rem with -0.01em tracking. Mono, so a phrase's width is just its
 * length times this; measured against the rendered box, the longest phrase in
 * the pool comes to ~153px and this predicts 153px. */
const MOBILE_LABEL_CHAR_PX = 7.67;
const MOBILE_LABEL_LINE_PX = 20;
/** How many spawn directions to try before giving up and going below. */
const MOBILE_LABEL_SPAWN_ATTEMPTS = 32;

/**
 * Does a label box centred here clear the cluster's disc?
 *
 * The box is grown by the lateral drift on both sides, because the phrase
 * spends its life sliding across that range — a point that clears only while
 * the text is at rest is not clear.
 */
function boxClearsCluster(
  x: number,
  y: number,
  halfWidth: number,
  halfHeight: number,
  cluster: ClusterScreen,
) {
  const dx = Math.max(Math.abs(x - cluster.centerX) - halfWidth, 0);
  const dy = Math.max(Math.abs(y - cluster.centerY) - halfHeight, 0);
  return Math.hypot(dx, dy) >= cluster.radiusPx;
}

/**
 * Where the next mobile phrase should appear.
 *
 * The label used to be centred on a point a fixed gap outside the cluster's
 * radius, which sounds like it clears the graph and doesn't: the box is up to
 * ~153px wide against a ~214px cluster on a 390px screen, so centring it
 * ~135px out still left half of it lying over the nodes, and text over the
 * densest part of the graph is genuinely hard to read.
 *
 * So the clearance is solved against the label's real box rather than a point.
 * Candidate directions are tried in random order; for each, the distance is
 * pushed out until the whole box — widened by the drift range it will travel —
 * clears the disc, and the candidate is taken only if it also fits the
 * viewport. That naturally uses the sides on a tablet, where there is room
 * beside the graph, and falls to below it on a phone, where there is not.
 *
 * The fallback is directly below rather than a best-effort overlap: a label
 * that has to give up should sit somewhere legible, not merely somewhere less
 * bad.
 *
 * Returns an **offset from the cluster's centre**, not an absolute point, plus
 * the half-width the clearance was solved against. The caller adds the live
 * centre every render, so the label rides the cluster's parallax while a
 * finger drags it instead of standing still on a graph that has slid out from
 * under it — and the clearance holds automatically, since both move together.
 */
function randomLabelPoint(
  cluster: ClusterScreen,
  viewportWidth: number,
  phrase: string,
) {
  const halfWidth =
    (phrase.length * MOBILE_LABEL_CHAR_PX) / 2 + MOBILE_DRIFT_AMPLITUDE_PX;
  const halfHeight = MOBILE_LABEL_LINE_PX / 2;
  const minX = MOBILE_LABEL_SAFE_MARGIN_PX + halfWidth;
  const maxX = viewportWidth - MOBILE_LABEL_SAFE_MARGIN_PX - halfWidth;

  const availableDeg = 360 - MOBILE_LABEL_EXCLUDED_TOP_ARC_DEG;
  const startDeg = 270 + MOBILE_LABEL_EXCLUDED_TOP_ARC_DEG / 2;

  for (let attempt = 0; attempt < MOBILE_LABEL_SPAWN_ATTEMPTS; attempt++) {
    const angle =
      (((startDeg + Math.random() * availableDeg) % 360) * Math.PI) / 180;
    const gap =
      MOBILE_LABEL_GAP_MIN +
      Math.random() * (MOBILE_LABEL_GAP_MAX - MOBILE_LABEL_GAP_MIN);

    // Walk outward along this direction until the box is off the disc. The
    // step is coarse because the gap above is already randomised — this only
    // has to find the first clearing distance, not the exact one.
    let dist = cluster.radiusPx;
    let x = 0;
    let y = 0;
    let cleared = false;
    for (let step = 0; step < 60; step++) {
      x = cluster.centerX + Math.cos(angle) * dist;
      y = cluster.centerY + Math.sin(angle) * dist;
      if (boxClearsCluster(x, y, halfWidth, halfHeight, cluster)) {
        cleared = true;
        break;
      }
      dist += 6;
    }
    if (!cleared) continue;

    x = cluster.centerX + Math.cos(angle) * (dist + gap);
    y = cluster.centerY + Math.sin(angle) * (dist + gap);
    if (x >= minX && x <= maxX) {
      return {
        dx: x - cluster.centerX,
        dy: y - cluster.centerY,
        halfWidth,
      };
    }
  }

  // Nothing beside the graph fits — sit under it, with the same random gap so
  // successive phrases still don't land in exactly the same spot.
  const gap =
    MOBILE_LABEL_GAP_MIN +
    Math.random() * (MOBILE_LABEL_GAP_MAX - MOBILE_LABEL_GAP_MIN);
  return {
    dx: Math.min(Math.max(cluster.centerX, minX), maxX) - cluster.centerX,
    dy: cluster.radiusPx + halfHeight + gap,
    halfWidth,
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
  const [driftX, setDriftX] = useState(() =>
    randomDrift(MOBILE_DRIFT_AMPLITUDE_PX),
  );
  const [offset, setOffset] = useState(() =>
    randomLabelPoint(cluster, window.innerWidth, phrase),
  );
  // The next point depends on the next *phrase*, since clearance is solved
  // against that phrase's own box width. Read through a ref so picking one
  // stays a plain statement rather than a side effect inside a state updater.
  const phraseRef = useRef(phrase);
  useEffect(() => {
    phraseRef.current = phrase;
  }, [phrase]);
  const pending = useRef<{
    offset: ReturnType<typeof randomLabelPoint>;
    drift: number;
  }>({ offset, drift: driftX });

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
      const next = randomPhrase(phraseRef.current);
      setPhrase(next);
      pending.current = {
        offset: randomLabelPoint(clusterRef.current, window.innerWidth, next),
        drift: randomDrift(MOBILE_DRIFT_AMPLITUDE_PX),
      };
    }, MOBILE_CYCLE_MS);
    return () => clearInterval(id);
  }, [reducedMotion]);

  const commitPending = useCallback(() => {
    setOffset(pending.current.offset);
    setDriftX(pending.current.drift);
  }, []);

  // Resolved against the *live* centre, so a drag carries the label along with
  // the cluster. Re-clamped here rather than only at spawn: parallax can shift
  // the centre by up to CLUSTER_PARALLAX_MAX_PX after the fact, which is
  // enough to push a long phrase past the viewport edge it was cleared for.
  const targetX = Math.min(
    Math.max(
      cluster.centerX + offset.dx,
      MOBILE_LABEL_SAFE_MARGIN_PX + offset.halfWidth,
    ),
    window.innerWidth - MOBILE_LABEL_SAFE_MARGIN_PX - offset.halfWidth,
  );
  const targetY = cluster.centerY + offset.dy;

  useClusterTapNavigation(cluster);

  return (
    <PhraseFollower
      targetX={targetX}
      targetY={targetY}
      phrase={phrase}
      offsets={mobileDrift(driftX)}
      transitionIn={MOBILE_LABEL_TRANSITION_IN}
      transitionOut={MOBILE_LABEL_TRANSITION_OUT}
      reducedMotion={reducedMotion}
      href="/nebula"
      positionMode="instant"
      anchor="center"
      onExitComplete={commitPending}
      spanClassName="block font-display lowercase text-[0.8125rem] tracking-[-0.01em] text-ink-faint"
    />
  );
}

/** How far a pointer may travel between press and release and still count as
 * a click rather than a drag. Dragging out a text selection that happens to
 * start inside the cluster's circle must not navigate. */
const CLICK_SLOP_PX = 4;
/** Things that own their own click. Nothing on the landing page currently
 * sits under the cluster, but the circle is a quarter of the viewport across
 * and the hero is not frozen — a link that ends up under it later has to keep
 * working. */
const INTERACTIVE_SELECTOR =
  "a, button, input, textarea, select, summary, label, [role='button'], [contenteditable]";

/**
 * Click or tap the cluster to open the graph.
 *
 * Bound to the window and gated on the cluster's circle rather than attached
 * to an element, because there is no element: the affordance stopped using one
 * so it would stop swallowing clicks and text selection on the hero behind it
 * (see DesktopAffordance below). This restores the navigation that element
 * used to provide, without restoring what was wrong with it.
 *
 * Used by both tiers. On desktop it is one of two ways in, alongside the
 * keyboard-reachable phrase label. On mobile and tablet it is effectively the
 * only one: the label there is a ~150x20px line of text that moves to a new
 * point every few seconds, which is not a tap target anyone should have to
 * hit, and 04-phase-1.md asks for tap-to-open on every tier.
 *
 * It defers rather than competes — a drag past a few pixels (a scroll, or a
 * text selection), a modified click, and anything genuinely interactive under
 * the pointer all keep their own behaviour. A touch scroll never reaches it at
 * all, since browsers only synthesise `click` for a tap.
 */
function useClusterTapNavigation(cluster: ClusterScreen) {
  const router = useRouter();

  // The cluster drifts with parallax every frame; the listener only needs its
  // value at the moment a click lands, not a reason to be torn down and
  // rebound continuously.
  const clusterRef = useRef(cluster);
  useEffect(() => {
    clusterRef.current = cluster;
  }, [cluster]);

  useEffect(() => {
    let downX = 0;
    let downY = 0;
    let downInside = false;

    function inside(x: number, y: number) {
      const { centerX, centerY, radiusPx } = clusterRef.current;
      return Math.hypot(x - centerX, y - centerY) <= radiusPx;
    }

    function handlePointerDown(event: PointerEvent) {
      downX = event.clientX;
      downY = event.clientY;
      downInside = event.button === 0 && inside(event.clientX, event.clientY);
    }

    function handleClick(event: MouseEvent) {
      if (!downInside || !inside(event.clientX, event.clientY)) return;
      if (
        Math.hypot(event.clientX - downX, event.clientY - downY) >
        CLICK_SLOP_PX
      ) {
        return;
      }
      if (window.getSelection()?.toString()) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      if ((event.target as Element | null)?.closest(INTERACTIVE_SELECTOR)) {
        return;
      }
      router.push("/nebula");
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("click", handleClick);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("click", handleClick);
    };
  }, [router]);
}

/**
 * The proximity reveal is a **sensor, not a surface**.
 *
 * It used to be an `<a>` sized to the cluster's bounding radius sitting at
 * `z-20`, above `main`. That is 257–514px across on a desktop viewport, and
 * as a real element it swallowed every pointer event inside it: the headline
 * underneath could not be selected (measured: 21–24% of the `<h1>`'s box
 * covered between 1024px and 1440px wide), and a click meant for the page
 * navigated to /nebula instead. A region whose only job is to notice the
 * pointer has no business consuming it.
 *
 * So nothing here captures pointer events at all any more. Proximity is plain
 * geometry against the page-wide cursor useCursorPx already tracks, which
 * keeps 04-phase-1.md's requirement — a circular region sized off the
 * cluster's real on-screen radius — while leaving every pixel behind it
 * clickable, selectable and hoverable.
 *
 * The two things that element also provided are kept, separately:
 *
 * - **Clicking the cluster still navigates**, through a window-level handler
 *   gated on the same circle. It stands down for a genuine drag, an
 *   in-progress text selection, a modified click, and anything interactive
 *   under the pointer, so it adds a behaviour rather than taking one away.
 * - **Keyboard reach** is the phrase label itself (PhraseFollower's `href`),
 *   which is exactly the size of the rendered text. Tab reveals the phrase
 *   below the cluster; Enter follows it.
 */
function DesktopAffordance({
  cluster,
  onHoverChange,
}: {
  cluster: ClusterScreen;
  onHoverChange: (active: boolean) => void;
}) {
  const reducedMotion = useSceneStore((s) => s.reducedMotion);
  const { cursor, inWindow } = useCursorPx();
  const [focusActive, setFocusActive] = useState(false);
  const [phrase, setPhrase] = useState(() => PHRASES[0]);
  const [driftX, setDriftX] = useState(0);
  // Locked when a reveal starts, not read live: pointerActive flips false the
  // instant the pointer leaves, which is exactly when the exit begins — so
  // reading it live would swing the follower to the focus-fallback point
  // mid-fade instead of letting the phrase leave from where it was.
  const [revealMode, setRevealMode] = useState<"pointer" | "focus">("pointer");
  const wasShowing = useRef(false);

  const pointerActive =
    inWindow &&
    Math.hypot(cursor.x - cluster.centerX, cursor.y - cluster.centerY) <=
      cluster.radiusPx;

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

  useClusterTapNavigation(cluster);

  // A pointer cursor is the only signal left that the cluster is clickable,
  // now that no element is there to carry one. Set on <html>, where it costs
  // nothing; globals.css hands the caret back to the headline, the one piece
  // of real content the circle actually overlaps.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("nebula-affordance-armed", pointerActive);
    return () => root.classList.remove("nebula-affordance-armed");
  }, [pointerActive]);

  const target =
    revealMode === "pointer"
      ? { x: cursor.x + CURSOR_OFFSET.x, y: cursor.y + CURSOR_OFFSET.y }
      : {
          x: cluster.centerX,
          y: cluster.centerY + cluster.radiusPx + 16,
        };

  return (
    <PhraseFollower
      targetX={target.x}
      targetY={target.y}
      phrase={showing ? phrase : null}
      offsets={desktopDrift(driftX)}
      transitionIn={LABEL_TRANSITION_IN}
      transitionOut={LABEL_TRANSITION_OUT}
      reducedMotion={reducedMotion}
      href="/nebula"
      linkClassName="nebula-affordance-hit"
      onFocus={() => setFocusActive(true)}
      onBlur={() => setFocusActive(false)}
      positionMode="follow"
      anchor="top-left"
      spanClassName={
        "block font-display lowercase text-[0.8125rem] tracking-[-0.01em] text-mask" +
        (focusActive && !pointerActive
          ? " underline decoration-mask underline-offset-4"
          : "")
      }
    />
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
