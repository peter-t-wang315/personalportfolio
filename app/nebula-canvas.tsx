"use client";

import { useEffect, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { usePathname, useRouter } from "next/navigation";
import { CameraControls, CameraControlsImpl } from "@react-three/drei";
import { useSceneStore } from "@/lib/scene-store";
import {
  nodeIdForPathname,
  nodeIdForWorkPathname,
  routeForNode,
} from "@/lib/nebula-routes";
import { nodeGeometry } from "@/lib/node-geometry";
import { CONSTELLATION_BOUNDING_RADIUS } from "@/lib/node-geometry";
import {
  CLUSTER_BOUNDING_RADIUS,
  CLUSTER_DEPTH,
  CLUSTER_PARALLAX_MAX_PX,
  HOME_CAMERA_FOV,
  HOME_CAMERA_POSITION,
  clusterCenterXFraction,
  clusterCenterYFraction,
  clusterScaleForViewport,
  pxPerWorldUnitFor,
} from "@/lib/cluster-geometry";
import {
  FLIGHT_DURATION_MS,
  flightEase,
  focusPose,
  lerpPose,
  orbitLerpPose,
  shellLerpPose,
  type CameraPose,
} from "./nebula-flight";
import { getPlacement, setPlacement } from "./nebula-placement";
import { FOCUS_CAMERA_FOV } from "@/lib/focus-framing";
import {
  Constellation,
  SceneEnvironment,
  snapFocusShellOpen,
} from "./nebula-constellation";

/**
 * The canvas lives in the root layout and never unmounts (02-architecture.md),
 * and **so does the constellation itself**. There is exactly one graph, drawn
 * on every route: distant and small behind the landing page's hero, life-size
 * on `/nebula`. The flight between those two states is the whole reason the
 * persistent canvas exists.
 *
 * It did not used to be. Until this step `/` drew a separate 40-sphere
 * decorative cluster with its own seed and `/nebula` swapped it out for the
 * real graph on the route change, so the thing you clicked was deleted and a
 * different thing appeared in its place, 64 units and 94 degrees away — a cut,
 * then a short flight from wherever that cut had landed. The persistent canvas
 * was preserving a WebGL context and nothing else.
 */

/**
 * Shrinks the constellation to exactly the footprint the landing page's
 * cluster has always occupied — `CLUSTER_BOUNDING_RADIUS` at `CLUSTER_DEPTH`.
 *
 * Matching that footprint rather than picking a pleasing size is what keeps
 * `lib/cluster-geometry.ts` true. Every DOM overlay on the landing page (the
 * affordance's hover circle, the idle pulse ring, the phrase label's
 * placement solve) is measured in pixels from those constants, so as long as
 * what's drawn projects to the same pixels, none of that arithmetic has to
 * know the geometry underneath it changed at all.
 *
 * The node sizes fall out of it and confirm the fit: a major project node
 * lands at 0.16 world units here, a standard at 0.12, against the 0.12-0.22
 * range the decorative spheres this replaces were drawn at.
 */
const LANDING_SCALE = CLUSTER_BOUNDING_RADIUS / CONSTELLATION_BOUNDING_RADIUS;

/** Dimming applied off `/`, where the constellation is ambient rather than
 * the subject — see 04-phase-1.md. Opacity's half of this lives in
 * nebula-constellation.tsx; this is the scale half. */
const AMBIENT_SCALE = 0.7;

/**
 * Easing toward the pointer, per frame. Weighted rather than floaty, per
 * 01-design-system.md — but responsive enough to read as following a finger
 * during a drag, which a slower value did not.
 */
const PARALLAX_EASE = 0.09;
// World units — far below anything visible (radiusPx conversion is roughly
// 40-70px per world unit depending on viewport height), just enough to
// collapse the tail of the lerp's asymptotic approach into a single write.
const PARALLAX_WRITE_EPSILON = 0.0005;
/** Route-change easing for the ambient scale, matching the opacity fade. */
const AMBIENT_EASE = 0.06;

/**
 * Where a spotlit node is turned to, in the group's own space: toward the
 * reader and tilted up, so the cluster it belongs to sits in the upper front
 * of the globe rather than dead centre. Looking at the earth from above.
 */
const SPOTLIGHT_FACING = new THREE.Vector3(0, 0.35, 1).normalize();
/**
 * Per-frame slerp toward that orientation. Exponential rather than a fixed
 * curve over a fixed time, matching the ambient scale and the pointer parallax
 * beside it: this is background motion that has to survive being re-aimed
 * mid-turn when the reader moves to another project, which a timed curve
 * would have to restart.
 */
const SPOTLIGHT_EASE = 0.055;

/**
 * Elevated, near-top-down heading, tilted slightly off pure vertical.
 * Cluster.order maps monotonically onto Y in layout.ts's Fibonacci sphere,
 * so "front hemisphere" for the low-order SEL clusters means looking down
 * from above, not straight ahead along Z. A pure top-down heading was tried
 * first and rejected: solder and personal sit at opposite Y poles but
 * nearly identical X/Z, so they collided in screen space (~3.6 units apart
 * vs. ~8 achievable elsewhere). This heading was chosen by searching
 * viewing directions for one that keeps all four SEL centroids comfortably
 * front-facing while maximizing the closest pairwise screen-space distance
 * between all seven cluster centroids — verified against the actual
 * computed layout, not eyeballed.
 *
 * Scaled with the shell when it shrank from 16 to 11 (content/layout.ts), so
 * the framing it was tuned for is preserved: same heading, same fraction of
 * the viewport, 28.9 units from its target instead of 41.2.
 *
 * No route stands here any more — `/nebula` is entered from the inside. It
 * survives because the inside pose is defined by reversing it, and because
 * `/work/[slug]` is going to want the globe from outside with the relevant
 * cluster turned to face the reader. Its field of view was 50, which is what
 * FOCUS_CAMERA_FOV is set to below.
 */
const CONSTELLATION_CAMERA_POSITION: [number, number, number] = [8.4, 30.1, -2.2];


/**
 * Aimed slightly above the origin: the oblique heading projects the nearest
 * (solder) cluster high in the frame, and the sticky header eats the top
 * ~62px, so aiming at y=0 left the constellation riding up under the header
 * and off-center. Raising the target pushes the whole composition down into
 * the usable area.
 */
const CONSTELLATION_CAMERA_TARGET: [number, number, number] = [0, 2.5, 0];

/**
 * `/nebula`'s resting pose: **inside the globe**, looking across the middle.
 *
 * Three numbers, each measured rather than chosen.
 *
 * **Not at the centre.** From dead centre every node is the same distance
 * away, so nothing varies in size and fog has nothing to grade; worse, a 50
 * degree frame there covers 8.1% of the sphere's solid angle, and sampling 400
 * headings against the real layout put the tenth percentile at *zero nodes in
 * frame*. Half the shell radius out, looking back through the centre at the
 * far side, the same sampling never drops below eleven and averages sixteen.
 *
 * **Opposite the front hemisphere.** The heading is the outside pose's,
 * reversed: the composition puts the SEL clusters on the side the outside
 * camera faces, so to look at them from within you have to stand on the other
 * side of the middle. camera-controls orbits about the target, so dragging
 * sweeps the far surface past you and the near shell swings in behind.
 *
 * **Wide, but not a fisheye.** Field of view is the only lever that changes
 * *how many* nodes are in frame — shrinking the shell makes each one bigger
 * but moves none of them into view, since angular position does not care about
 * scale — so it is worth spending. 50 gives seven nodes, 75 gives thirteen, 90
 * gives sixteen.
 *
 * It stops at 72 anyway, because three.js measures field of view vertically
 * and a wide screen multiplies it: 90 vertical is 116 horizontal, and rendered
 * at that width the spheres near the frame edge stretch into obvious ellipses.
 * 72 is about 99 horizontal — wide enough to read as being surrounded, inside
 * the range where a sphere still looks like one.
 */
const INSIDE_DISTANCE = 5.5;
const INSIDE_CAMERA_FOV = 72;

const INSIDE_POSE: CameraPose = (() => {
  const target = new THREE.Vector3(...CONSTELLATION_CAMERA_TARGET);
  const outward = new THREE.Vector3(...CONSTELLATION_CAMERA_POSITION)
    .sub(target)
    .normalize();
  return {
    position: target.clone().addScaledVector(outward, -INSIDE_DISTANCE),
    target,
  };
})();

/**
 * The landing page's pose. Fixed and parallax-only per 01-design-system.md —
 * the cluster moves on the landing page, the camera does not.
 *
 * It is also, now, literally where the arrival flight starts. That is the
 * point: there is no synthesised departure pose any more, so there is nothing
 * for a cut to happen across.
 */
const HOME_POSE: CameraPose = {
  position: new THREE.Vector3(...HOME_CAMERA_POSITION),
  target: new THREE.Vector3(0, 0, 0),
};

// Distance-from-target clamp for the nebula dolly. Both ends now keep the
// camera *inside* the shell, whose nearest node sits at 10.08
// (content/layout.ts): pulling back past it would leave the globe, which on
// this route is the one thing hand-dollying may not do. Min stops short of the
// exact centre, where the view flattens to nothing.
const DOLLY_MIN_DISTANCE = 1.5;
const DOLLY_MAX_DISTANCE = 9.5;

/**
 * The one flight in progress, if any — **module scope on purpose**.
 *
 * A flight moves two things at once: the camera and the constellation's
 * placement. The rig owns both, but the group that *draws* the constellation
 * is a sibling of the rig, so it can't hold the flight; and putting it in the
 * zustand store would mean a `set` on every frame of every flight, with a
 * re-render of every subscriber behind it. The rig advances this record and
 * publishes the placement (nebula-placement.ts) at frame priority -2, ahead of
 * every reader, so nothing is ever a frame behind the camera.
 */
interface Flight {
  from: CameraPose;
  to: CameraPose;
  start: number;
  fovFrom: number;
  fovTo: number;
  /** Constellation placement at each end: 0 = landing footprint, 1 = life-size. */
  placementFrom: number;
  placementTo: number;
  /** Orbit-interpolate the path (see orbitLerpPose) rather than lerp it straight. */
  /**
   * How to get there. `line` is a straight lerp, right for a short hop that
   * barely turns. `orbit` swings around the target, for the arrival and the
   * departure. `shell` sweeps across the surface between two nodes, for a
   * sideways move — see shellLerpPose.
   */
  path: "line" | "orbit" | "shell";
}
let flight: Flight | null = null;

/** Raw (un-eased) progress of a flight, 0..1. Kept raw so completion is an
 * exact `=== 1` rather than a question about the easing curve's endpoint. */
function flightProgress(active: Flight): number {
  return Math.min((performance.now() - active.start) / FLIGHT_DURATION_MS, 1);
}

/** camera-controls owns the camera, but FOV is not something it manages, so
 * this reaches through to the camera and re-derives the projection. */
function applyFov(controls: CameraControlsImpl, fov: number) {
  const camera = controls.camera;
  if (camera instanceof THREE.PerspectiveCamera) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
}

function applyPose(controls: CameraControlsImpl, pose: CameraPose) {
  controls.setLookAt(
    pose.position.x, pose.position.y, pose.position.z,
    pose.target.x, pose.target.y, pose.target.z,
    false,
  );
}

/**
 * Hand-dolly clamps, applied whenever the camera settles.
 *
 * They have to be lifted for every flight and while focused, and they have to
 * be *off* on the landing page too: the home pose sits 9 units from its target,
 * inside DOLLY_MIN_DISTANCE, so a live clamp would quietly drag the camera
 * back out of the framing the whole landing page is composed against.
 */
function applyDollyClamps(
  controls: CameraControlsImpl,
  { free }: { free: boolean },
) {
  controls.minDistance = free ? 0 : DOLLY_MIN_DISTANCE;
  controls.maxDistance = free ? Infinity : DOLLY_MAX_DISTANCE;
}

function currentPose(controls: CameraControlsImpl): CameraPose {
  return {
    position: controls.camera.position.clone(),
    target: controls.getTarget(new THREE.Vector3()),
  };
}

/**
 * Draws the constellation, and places it.
 *
 * Off `/nebula` this applies everything 04-phase-1.md asks of the landing
 * cluster — the solved centre, the viewport-width shrink, the pointer
 * parallax, the ambient scale-down off `/` — as a transform on the real
 * graph rather than as properties of a stand-in for it. On `/nebula` the
 * transform is identity. In between, a flight interpolates it.
 *
 * All three landing-page quantities are converted from pixels here because
 * that is how 01-design-system.md and 02-architecture.md specify them, and
 * lib/use-cluster-screen.ts converts the identical numbers back for the DOM
 * overlays, so the two can't drift.
 */
function ConstellationPlacement({
  isNebula,
  isHome,
  spotlightNodeId,
  children,
}: {
  isNebula: boolean;
  isHome: boolean;
  /** On `/work/[slug]`, the node whose cluster is turned to face the reader. */
  spotlightNodeId: string | null;
  children: ReactNode;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const spotlightTarget = useRef(new THREE.Quaternion());
  const spotlightDirection = useRef(new THREE.Vector3());
  const parallax = useRef(new THREE.Vector2());
  const ambientScale = useRef(1);
  const lastWrittenParallax = useRef({ x: 0, y: 0 });

  useFrame((state) => {
    const group = groupRef.current;
    if (!group) return;
    const { pointer, reducedMotion } = useSceneStore.getState();
    // Written by the rig at frame priority -2, ahead of this callback's
    // default 0, so a flight's camera and its placement are always the same
    // frame's values.
    const placement = getPlacement();

    // Ambient dimming off `/` is eased rather than switched, so moving between
    // the Phase 1 routes doesn't snap the graph's size.
    //
    // `/nebula` counts as undimmed even though it isn't `/`. It scales only
    // the landing placement, which is invisible while the flight has
    // interpolated it away — but it is the placement a *departure* flies back
    // to, and letting it drift to the ambient value while parked in the
    // constellation made the graph land 30% too small and then grow back over
    // the following second. Measured as a spread still shrinking 1.1s after
    // the flight had ended.
    // A spotlit work page keeps full size, like `/`. The graph is doing a job
    // there — showing where the project being read sits — and the turn that
    // brings its cluster forward has to be big enough to read as a turn.
    // Everywhere else off `/` it is decoration and shrinks.
    ambientScale.current = THREE.MathUtils.lerp(
      ambientScale.current,
      isNebula || isHome || spotlightNodeId ? 1 : AMBIENT_SCALE,
      reducedMotion ? 1 : AMBIENT_EASE,
    );

    // Parallax is a landing-page behaviour and is only computed there. Holding
    // it still for the duration of a flight is deliberate: it is folded into
    // the landing placement below, which the flight then interpolates away, so
    // it leaves continuously instead of being separately animated out. It also
    // keeps a drag on /nebula from writing to the store 60 times a second for
    // overlays that aren't mounted.
    if (placement <= 0) {
      if (reducedMotion) {
        parallax.current.set(0, 0);
      } else {
        // The design system specifies this swing in pixels, so it is converted
        // here rather than stored as world units — see CLUSTER_PARALLAX_MAX_PX.
        const maxWorld =
          CLUSTER_PARALLAX_MAX_PX / pxPerWorldUnitFor(state.size.height);
        parallax.current.x = THREE.MathUtils.lerp(
          parallax.current.x,
          -pointer.x * maxWorld,
          PARALLAX_EASE,
        );
        parallax.current.y = THREE.MathUtils.lerp(
          parallax.current.y,
          pointer.y * maxWorld,
          PARALLAX_EASE,
        );
      }

      // Written when it's moved meaningfully, not every frame — a plain
      // per-frame write, even after the lerp has visually settled, still
      // produces a new object each time (floating-point lerp toward a fixed
      // target never exactly reaches it), which would re-render every
      // subscribed DOM component in nebula-affordance.tsx at 60fps forever,
      // even at rest.
      if (
        Math.abs(parallax.current.x - lastWrittenParallax.current.x) >
          PARALLAX_WRITE_EPSILON ||
        Math.abs(parallax.current.y - lastWrittenParallax.current.y) >
          PARALLAX_WRITE_EPSILON
      ) {
        lastWrittenParallax.current.x = parallax.current.x;
        lastWrittenParallax.current.y = parallax.current.y;
        useSceneStore
          .getState()
          .setClusterParallax({ x: parallax.current.x, y: parallax.current.y });
      }
    }

    // The landing placement, in full. Narrow viewports shrink the whole thing
    // so it doesn't fill the width edge to edge (clusterScaleForViewport), and
    // the centre is solved rather than fixed — it slides right of the hero's
    // text column on wide short viewports and drops below the text on narrow
    // ones. 02-architecture.md's Landing cluster placement is the authority.
    //
    // The offsets divide by the *unscaled* px-per-world-unit on purpose: they
    // set the group's parent-space position, and scaling a group about its own
    // origin leaves that untouched. Y is negated because world +Y is up while
    // CSS +Y is down; X needs no flip, since this camera has no roll.
    const pxPerWorldUnit = pxPerWorldUnitFor(state.size.height);
    const landingScale =
      LANDING_SCALE *
      ambientScale.current *
      clusterScaleForViewport(state.size.width, state.size.height);
    const landingX =
      parallax.current.x +
      (state.size.width *
        (clusterCenterXFraction(state.size.width, state.size.height) - 0.5)) /
        pxPerWorldUnit;
    const landingY =
      parallax.current.y -
      (state.size.height *
        (clusterCenterYFraction(state.size.width, state.size.height) - 0.5)) /
        pxPerWorldUnit;

    // `/work/[slug]` turns the globe so its project's cluster faces the
    // reader. The layout is preserved rather than deformed — 05-phase-2.md
    // originally had the connected subgraph *gather* toward a focal point,
    // which moves the nodes; turning the whole sphere instead means a cluster
    // is always in the same place relative to its neighbours, so the geography
    // is learnable across pages rather than rearranged on each one.
    //
    // Aimed at the seeded layout position, not the live wandering one, so the
    // target does not drift while the turn is converging on it.
    if (spotlightNodeId && nodeGeometry[spotlightNodeId]) {
      spotlightDirection.current
        .fromArray(nodeGeometry[spotlightNodeId].position)
        .normalize();
      spotlightTarget.current.setFromUnitVectors(
        spotlightDirection.current,
        SPOTLIGHT_FACING,
      );
    } else {
      spotlightTarget.current.identity();
    }
    if (reducedMotion) group.quaternion.copy(spotlightTarget.current);
    else group.quaternion.slerp(spotlightTarget.current, SPOTLIGHT_EASE);

    group.scale.setScalar(THREE.MathUtils.lerp(landingScale, 1, placement));
    group.position.set(
      THREE.MathUtils.lerp(landingX, 0, placement),
      THREE.MathUtils.lerp(landingY, 0, placement),
      THREE.MathUtils.lerp(CLUSTER_DEPTH, 0, placement),
    );
  });

  return <group ref={groupRef}>{children}</group>;
}

/**
 * The **only** thing that writes the camera, on every route.
 *
 * There used to be two rigs — one parking the camera on the Phase 1 routes,
 * one owning `/nebula` — and a comment on each warning the other off, because
 * two rigs writing the same camera on one commit is a race a flight loses.
 * One rig cannot race itself, and it is also the only arrangement in which
 * leaving `/nebula` can be a flight rather than a cut: the rig that would have
 * to drive it is no longer the one that unmounts on the way out.
 *
 * Flights are driven by hand rather than handed to camera-controls'
 * `enableTransition`, which smooths exponentially toward a target — a curve
 * with no fixed duration and no way to specify one. 01-design-system.md asks
 * for a specific curve over a specific 1400ms, which means owning the
 * interpolation: sample the easing, lerp the pose, push it in with transitions
 * off.
 */
function CameraRig({
  isNebula,
  routeFocusId,
}: {
  isNebula: boolean;
  /**
   * The node the URL names, or null for the bare graph. **Flights key on the
   * route, not on the store's focusedNodeId**, because the URL is the source
   * of truth for focus (02-architecture.md) and the store is synced *from* it
   * a beat later — keying on the store would make a cold entry look like a
   * focus change and fly to a node the camera is already parked at.
   */
  routeFocusId: string | null;
}) {
  const controlsRef = useRef<CameraControlsImpl>(null);
  const reducedMotion = useSceneStore((s) => s.reducedMotion);
  const flying = useSceneStore((s) => s.flying);

  function begin(controls: CameraControlsImpl, next: Flight) {
    flight = next;
    applyPose(controls, next.from);
    applyFov(controls, next.fovFrom);
    // Every flight ends closer in or further out than hand-dollying is allowed
    // to reach, so the clamps come off for the duration and back on at the far
    // end. With them live, camera-controls drags the camera mid-flight and the
    // arrival never lands.
    applyDollyClamps(controls, { free: true });
    useSceneStore.getState().setFlying(true);
    useSceneStore.getState().setFocusSettled(false);
  }

  function settle(
    controls: CameraControlsImpl,
    pose: CameraPose,
    fov: number,
    { free, at }: { free: boolean; at: number },
  ) {
    flight = null;
    setPlacement(at);
    applyPose(controls, pose);
    applyFov(controls, fov);
    applyDollyClamps(controls, { free });
    useSceneStore.getState().setFlying(false);
    useSceneStore.getState().setFocusSettled(true);
  }

  /**
   * The arrival and the departure — the flights 02-architecture.md's
   * persistent-canvas decision exists for.
   *
   * The arrival starts at the landing page's own pose, looking at the same
   * small distant cluster the viewer just clicked, and closes to the framing
   * pose while the constellation grows from its landing footprint to life-size
   * around it. FOV widens 45 -> 50 across the same interval so the two
   * framings meet rather than snap.
   *
   * Route changes are compared against the last value rather than counted,
   * for the same reason the focus effect below is: effects with a dependency
   * array fire on the first commit anyway, and StrictMode runs them twice in
   * development. Tracking the value means the second pass is a no-op instead
   * of restarting the flight the first one began.
   */
  const lastRoute = useRef<boolean | undefined>(undefined);
  const lastFocus = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const wasNebula = lastRoute.current;
    if (wasNebula === isNebula) return;
    lastRoute.current = isNebula;

    const { reducedMotion, focusedNodeId } = useSceneStore.getState();

    if (isNebula) {
      // Cold entry to a node — a direct link or a reload of /nebula/[slug]:
      // no approach flight. The page lands already inside, camera parked at
      // the focus pose, constellation life-size around it (05-phase-2.md,
      // Deep linking). Priming lastFocus is what keeps the focus effect below
      // from reading the same route as a change and flying to where it is.
      const coldFocus = wasNebula === undefined ? routeFocusId : null;
      if (coldFocus) {
        const pose = focusPose(coldFocus);
        if (pose) {
          lastFocus.current = coldFocus;
          // 05-phase-2.md: a cold entry lands "shell expanded, panel open,
          // content visible at first paint". The shell has to be told, or it
          // ramps open from a sphere over its usual two beats.
          snapFocusShellOpen();
          settle(controls, pose, FOCUS_CAMERA_FOV, { free: true, at: 1 });
          return;
        }
      }
      // Reduced motion makes flights instant cuts, per 01-design-system.md.
      if (reducedMotion) {
        settle(controls, INSIDE_POSE, INSIDE_CAMERA_FOV, { free: false, at: 1 });
        return;
      }
      begin(controls, {
        from: HOME_POSE,
        to: INSIDE_POSE,
        start: performance.now(),
        fovFrom: HOME_CAMERA_FOV,
        fovTo: INSIDE_CAMERA_FOV,
        placementFrom: 0,
        placementTo: 1,
        path: "orbit",
      });
      return;
    }

    useSceneStore.getState().clearFocus();
    // A first mount off /nebula has nowhere to depart from, and a departure
    // from a focused node would start with the camera parked inside a shell
    // that is about to shrink around it — leaving from inside the geometry
    // rather than from the framing pose. 2.6 owns that exit properly (it
    // reverses the node's own arrival); until then it stays a cut.
    if (wasNebula === undefined || reducedMotion || focusedNodeId) {
      settle(controls, HOME_POSE, HOME_CAMERA_FOV, { free: true, at: 0 });
      return;
    }
    begin(controls, {
      from: currentPose(controls),
      to: HOME_POSE,
      start: performance.now(),
      fovFrom: INSIDE_CAMERA_FOV,
      fovTo: HOME_CAMERA_FOV,
      placementFrom: 1,
      placementTo: 0,
      path: "orbit",
    });
    // `settle` normally restores the clamps; a departure ends off /nebula,
    // where they must stay off (see applyDollyClamps).
  }, [isNebula, routeFocusId]);

  // Starting a focus flight is an effect on the focus edge, not something the
  // frame loop polls: the departure pose has to be sampled at the instant
  // focus changes, from wherever the viewer had actually dragged the camera to.
  //
  // Same last-value guard as the route effect above, and for the same reason —
  // without it this would overwrite the arrival flight with a focus-shaped one
  // on mount: same destination, but sampled a beat later, from a camera
  // position camera-controls has not applied yet, and carrying no FOV
  // interpolation. That is exactly how the arrival lost its widening and
  // gained a lurch toward the target before settling back out.
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    if (lastFocus.current === undefined || lastFocus.current === routeFocusId) {
      lastFocus.current = routeFocusId;
      return;
    }
    const previousFocus = lastFocus.current;
    lastFocus.current = routeFocusId;
    if (!isNebula) return;

    // Opening a node from the graph, moving sideways to a connected one, or
    // leaving back to the constellation — one flight from wherever the camera
    // is to wherever the route now says. Sideways travel never returns to
    // the framing pose first because `from` is simply the current pose.
    const to = routeFocusId ? focusPose(routeFocusId) : INSIDE_POSE;
    if (!to) return;
    const fovTo = routeFocusId ? FOCUS_CAMERA_FOV : INSIDE_CAMERA_FOV;
    // Moving straight from one open node to another — following a link inside
    // the panel. Both ends sit on the shell, so the flight can travel across
    // its surface, and the edge layer can light the connection being taken.
    const sideways = previousFocus !== null && routeFocusId !== null;
    useSceneStore
      .getState()
      .setTravellingBetween(
        sideways ? { from: previousFocus, to: routeFocusId } : null,
      );

    if (reducedMotion) {
      settle(controls, to, fovTo, { free: routeFocusId !== null, at: 1 });
      return;
    }

    begin(controls, {
      from: currentPose(controls),
      to,
      start: performance.now(),
      fovFrom: (controls.camera as THREE.PerspectiveCamera).fov,
      fovTo,
      placementFrom: 1,
      placementTo: 1,
      // A focus hop is short and barely turns; a straight line is the right
      // path for it, and it is the one 2.5 was tuned against.
      // Node to node follows the surface; anything involving the resting pose
      // is a short hop that barely turns, where a straight line is right and
      // is what 2.5 was tuned against.
      path: sideways ? "shell" : "line",
    });
  }, [routeFocusId, reducedMotion, isNebula]);

  // Priority -2, ahead of camera-controls' own -1 update: a pose pushed in
  // after that update is not on the camera until the *next* frame's update,
  // which would leave the camera a frame behind the placement group below it
  // for the whole flight. Writing first puts both on the same frame.
  useFrame(() => {
    const controls = controlsRef.current;
    const active = flight;
    if (!controls || !active) return;

    const t = flightProgress(active);
    const eased = flightEase(t);
    setPlacement(
      THREE.MathUtils.lerp(active.placementFrom, active.placementTo, eased),
    );
    const pose =
      active.path === "orbit"
        ? orbitLerpPose(active.from, active.to, eased)
        : active.path === "shell"
          ? shellLerpPose(active.from, active.to, eased)
          : lerpPose(active.from, active.to, eased);

    applyPose(controls, pose);
    applyFov(controls, THREE.MathUtils.lerp(active.fovFrom, active.fovTo, eased));

    if (t >= 1) {
      flight = null;
      setPlacement(active.placementTo);
      useSceneStore.getState().setFlying(false);
      useSceneStore.getState().setTravellingBetween(null);
      useSceneStore.getState().setFocusSettled(true);
      // Hand-dollying is only arbitrated inside the constellation, and only
      // when the camera is parked at the framing distance — not on the landing
      // page, and not while focused, where it is legitimately much closer in.
      applyDollyClamps(controls, {
        free:
          active.placementTo < 1 ||
          useSceneStore.getState().focusedNodeId !== null,
      });
    }
  }, -2);

  return (
    // The dolly clamps are deliberately **not** props. They are state a flight
    // and the route both change (applyDollyClamps), and as props any re-render
    // that happened to diff them would quietly put them back.
    <CameraControls
      ref={controlsRef}
      enabled={isNebula && !flying}
      mouseButtons-left={CameraControlsImpl.ACTION.ROTATE}
      mouseButtons-right={CameraControlsImpl.ACTION.NONE}
      mouseButtons-middle={CameraControlsImpl.ACTION.NONE}
      mouseButtons-wheel={CameraControlsImpl.ACTION.DOLLY}
    />
  );
}

/**
 * Syncs the store's focus *from* the route. The URL is the source of truth
 * (02-architecture.md); this is the one place it is written into the store,
 * for the things that read focus there — dimming, the freeze, the glass, the
 * panel's fade gate. The camera does not read it: CameraRig keys on the route
 * directly, see routeFocusId.
 *
 * Rendered before the rig so its effect runs first in the same commit.
 */
function RouteFocus({ id }: { id: string | null }) {
  useEffect(() => {
    const { focusNode, clearFocus, focusedNodeId } = useSceneStore.getState();
    if (id && id !== focusedNodeId) focusNode(id);
    else if (!id && focusedNodeId) clearFocus();
  }, [id]);
  return null;
}

export function NebulaCanvas() {
  const pathname = usePathname();
  const router = useRouter();
  const isNebula = pathname === "/nebula" || pathname.startsWith("/nebula/");
  const isHome = pathname === "/";
  const routeFocusId = isNebula ? nodeIdForPathname(pathname) : null;
  // The route wins; a hovered row in the list stands in until there is one.
  const previewNodeId = useSceneStore((s) => s.previewNodeId);
  const spotlightNodeId = nodeIdForWorkPathname(pathname) ?? previewNodeId;

  // Node clicks push a route rather than setting focus; the route then sets
  // focus. Defined here, outside <Canvas>, because next/navigation's router
  // is not reachable from inside R3F's reconciler — the same boundary the
  // zustand store exists to cross. A function prop crosses it fine.
  function openNode(id: string) {
    const href = routeForNode(id);
    if (href && href !== pathname) router.push(href, { scroll: false });
  }

  return (
    <Canvas
      className="!fixed inset-0 z-0"
      gl={{ alpha: true }}
      dpr={[1, 2]}
      camera={{ position: HOME_CAMERA_POSITION, fov: HOME_CAMERA_FOV }}
    >
      {/* Scene-level, and outside the placement group on purpose: `attach="fog"`
          writes to its parent's `fog` property, which on a group is a field
          nothing reads, and the lights' positions are in their parent's space,
          so inside the group they would shrink with the landing placement. */}
      <SceneEnvironment />
      <RouteFocus id={routeFocusId} />
      <CameraRig isNebula={isNebula} routeFocusId={routeFocusId} />
      <ConstellationPlacement
        isNebula={isNebula}
        isHome={isHome}
        spotlightNodeId={spotlightNodeId}
      >
        <Constellation
          isNebula={isNebula}
          isHome={isHome}
          spotlightNodeId={spotlightNodeId}
          onOpenNode={openNode}
        />
      </ConstellationPlacement>
    </Canvas>
  );
}
