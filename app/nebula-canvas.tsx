"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
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
import { getLivePosition, neighborsOf } from "./nebula-simulation";
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
  FOCUS_FLIGHT_DURATION_MS,
  flightEase,
  focusPose,
  lerpPose,
  orbitLerpPose,
  shellLerpPose,
  type CameraPose,
} from "./nebula-flight";
import { NebulaHome } from "./nebula-home";
import { getPlacement, setPlacement } from "./nebula-placement";
import {
  getDragAngles,
  isDragging,
  resetDrag,
  setClusterCircle,
} from "./nebula-drag-state";
import { FOCUS_CAMERA_FOV, SHELL_CLOSE_MS } from "@/lib/focus-framing";
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
 * Where a spotlit node is turned to, in the group's own space: on the near
 * side and **below** the globe's equator, so the camera looks *down* onto it.
 *
 * This is the part that is easy to get backwards, and was twice. The camera on
 * these routes is fixed and level with the group's centre, so a node's
 * elevation decides which way the surface it sits on is seen: put it high and
 * the reader is underneath looking up at the cluster, however "top" that
 * sounds. A node's outward normal points along this vector, so a negative Y
 * tilts that normal down toward the camera — which is what "looking at the
 * earth from above" actually requires.
 *
 * How far it tilts is a composition decision as much as a viewing one. The
 * globe's centre lies opposite this direction from the node, so the further
 * the facing leans off the view axis, the more of the sphere piles up on one
 * side of the subject: at -0.5 the whole thing stacked above it and left the
 * bottom of the frame empty. Close to the axis, the globe sits centred on the
 * project instead, and the tilt is just enough to be looking down on the
 * surface rather than along it.
 */
const SPOTLIGHT_FACING = new THREE.Vector3(0, -0.3, 0.954).normalize();
/** Layout up, kept as close to screen up as the facing allows — see below. */
const LAYOUT_UP = new THREE.Vector3(0, 1, 0);
/**
 * How much larger the globe is drawn on a spotlit work page. The placement
 * solve is told about it (clusterScaleForViewport), so it still clears the
 * text column by a real margin rather than growing across it.
 */
const SPOTLIGHT_ZOOM = 1.32;

/**
 * Distance from the landing camera to the plane the cluster placement is
 * solved on. The solve works in pixels at that plane; anything drawn nearer
 * has to have its target scaled down to project to the same place.
 */
const CAMERA_TO_CLUSTER = HOME_CAMERA_POSITION[2] - CLUSTER_DEPTH;
/**
 * Roughly how long the globe takes to turn to a new project, in seconds.
 *
 * The turn is a **critically damped spring**, not the fixed-fraction-per-frame
 * slerp this used to be. That slerp was exponential, which has its whole
 * problem in the first frame: it moves fastest when it is furthest away, so a
 * 144-degree swing to the far side of the globe opened with about 350 deg/s
 * and then spent more than a second crawling through the last tenth. Measured
 * per frame it was a genuine ease; watched, it was a snap followed by a drift,
 * which is what "it teleports over rather than flies over" describes.
 *
 * A spring starts from rest instead. It accelerates out of the old
 * orientation, carries its speed across the middle of the turn, and decelerates
 * into the new one — the shape of something travelling. Critical damping is
 * what keeps that from overshooting into a wobble, which on a globe full of
 * labels would read as sloppy rather than lively.
 *
 * It keeps the one property the exponential was chosen for: there is no
 * timeline to restart, so re-aiming mid-turn just moves the target and the
 * existing velocity carries into the new path. Scanning a list of projects
 * stays one continuous movement.
 */
const SPOTLIGHT_TURN_SECONDS = 0.85;

/**
 * Damp `current` toward zero over roughly `smoothTime` seconds, advancing
 * `velocity` with it. The exponential-integrator form of a critically damped
 * spring — unconditionally stable at any frame length, which a plain
 * `v += (kx - cv)dt` is not: this runs at 9fps under software GL in the
 * verification harness, where that form flips sign and oscillates.
 *
 * Works on any vector-like axis set, so the orientation (as a rotation vector)
 * and the centring offset can share one implementation and one duration, and
 * therefore arrive together.
 */
function smoothDampToZero(
  current: THREE.Vector3,
  velocity: THREE.Vector3,
  smoothTime: number,
  dt: number,
) {
  const omega = 2 / smoothTime;
  const x = omega * dt;
  const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  // `temp` is where an undamped spring would carry the offset this step. The
  // velocity is corrected by it *before* both are decayed, which is what makes
  // this stable at any frame length rather than merely accurate at short ones.
  _dampTemp.copy(velocity).addScaledVector(current, omega).multiplyScalar(dt);
  velocity.addScaledVector(_dampTemp, -omega).multiplyScalar(decay);
  current.add(_dampTemp).multiplyScalar(decay);
}

/** Scratch for the roll solve, the turn and the centring; all run every frame. */
const _dampTemp = new THREE.Vector3();
const _turnDelta = new THREE.Quaternion();
const _turnRel = new THREE.Vector3();
const _turnAxis = new THREE.Vector3();
const _turnStep = new THREE.Quaternion();
const _solvedTarget = new THREE.Vector3();
const _tiltFallbackUp = new THREE.Vector3(1, 0, 0);
const _parkForward = new THREE.Vector3();
const _dragQuat = new THREE.Quaternion();
const _dragYaw = new THREE.Quaternion();
const _dragPitch = new THREE.Quaternion();
const SCREEN_UP = new THREE.Vector3(0, 1, 0);
const SCREEN_RIGHT = new THREE.Vector3(1, 0, 0);
const _spotCentre = new THREE.Vector3();
const _spotNode = new THREE.Vector3();
const _rollUp = new THREE.Vector3();
const _rollWanted = new THREE.Vector3();
const _rollAxis = new THREE.Vector3();
const _rollQuat = new THREE.Quaternion();
/** The layout's own orientation, which is what `/nebula` is composed against. */
const UNROTATED = new THREE.Quaternion();

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

/**
 * How far in front of the camera its pivot sits while parked inside the graph,
 * in world units.
 *
 * camera-controls has no first-person mode: it orbits the camera around a
 * target, so the view always points at that target. With the target at the
 * graph's centre the reader could circle the graph and never turn their back
 * on it — measured, the angle to anything outside the shell never fell below
 * 83.8 degrees against a 36-degree half-field. Putting the pivot a hand's
 * breadth ahead of the camera instead turns the same drag into looking around:
 * the camera sweeps a sphere this small, which is standing still, and the view
 * goes wherever it is pointed.
 *
 * Not zero, because a zero-length offset has no direction to rotate and the
 * controls lose the heading entirely.
 */
const LOOK_DISTANCE = 0.1;

/**
 * How far the interior heading tilts up off the composed one, in degrees.
 *
 * The composed heading looks straight through the graph's centre, and a node
 * sits on that line: measured, `solder-driver` was 2.26 degrees off the view
 * axis at rest, which at a 72-degree field of view is dead centre. Arriving
 * therefore looked like flying *at* that project rather than into the graph —
 * a hard focus nobody asked for, on whichever node happened to be on the axis.
 *
 * A tilt is the cheapest fix that keeps the composition: azimuth is untouched,
 * so the clusters stay arranged left-to-right exactly as they were, and only
 * the horizon moves. Searched over headings within 12 degrees of the composed
 * one, the graph is dense enough that no small move buys much room — 2 degrees
 * of tilt buys a 4.2-degree gap, 5 buys 7.1, and 12 buys only 12.8. Twelve is
 * the whole of what is available: it puts the nearest node 95px off centre at
 * 1280x800 and 125px at 1440x900, which reads as *a* node rather than as *the*
 * subject. Eight was tried first and left it 70px out, still close enough to
 * look chosen.
 *
 * The cost is a slightly emptier lower frame, since tilting off a node
 * necessarily leaves room on the side you tilted away from. That is the trade:
 * a composition with a gap in it, against one that appears to have picked a
 * favourite project.
 */
const INTERIOR_TILT_DEGREES = 12;

const INSIDE_POSE: CameraPose = (() => {
  const target = new THREE.Vector3(...CONSTELLATION_CAMERA_TARGET);
  const outward = new THREE.Vector3(...CONSTELLATION_CAMERA_POSITION)
    .sub(target)
    .normalize();
  // The camera keeps the position the composition put it in; only where it
  // looks changes. Building the pose from a tilted *target* instead would move
  // the camera too, since its position is derived from that target.
  const position = target.clone().addScaledVector(outward, -INSIDE_DISTANCE);
  const heading = target.clone().sub(position).normalize();
  const right = new THREE.Vector3()
    .crossVectors(heading, Math.abs(heading.y) > 0.9 ? _tiltFallbackUp : LAYOUT_UP)
    .normalize();
  heading.applyAxisAngle(
    right,
    (INTERIOR_TILT_DEGREES * Math.PI) / 180,
  );
  return {
    position,
    target: position.clone().addScaledVector(heading, INSIDE_DISTANCE),
  };
})();

/**
 * The graph's resting framing, aimed at a given node instead of at the heading
 * INSIDE_POSE was composed for.
 *
 * Same construction as INSIDE_POSE — camera one INSIDE_DISTANCE back from the
 * target, looking through it at the far wall — with the node's direction
 * substituted for the composed one. So it is the same shot, pointed somewhere
 * else, and dragging afterwards still orbits the graph's centre rather than
 * some point on its surface.
 *
 * Leaving a node used to fly to INSIDE_POSE flat, which meant every exit ended
 * looking at the same cluster no matter which node you had been reading. That
 * reads as the camera changing its mind: you close something and are somewhere
 * unrelated. Backing out along the way you came in and finding what you left
 * still in front of you is what "close this and look around" should do.
 */
function restingPoseFacing(nodeId: string | null): CameraPose {
  const node = nodeId ? nodeGeometry[nodeId] : null;
  if (!node) return INSIDE_POSE;
  // The camera does not move: there is one place to stand inside the graph and
  // this is it. Only the heading changes, which is the whole difference
  // between looking around a room and being carried around it.
  const position = INSIDE_POSE.position.clone();
  const direction = new THREE.Vector3().fromArray(node.position).sub(position);
  if (direction.lengthSq() < 1e-6) return INSIDE_POSE;
  direction.normalize();
  return {
    position,
    target: position.clone().addScaledVector(direction, INSIDE_DISTANCE),
  };
}

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
  /**
   * How long it takes. Carried per flight rather than read from a constant,
   * because the two kinds of move want different times — see
   * FOCUS_FLIGHT_DURATION_MS.
   */
  duration: number;
  /**
   * How long the camera holds still before it starts, in ms.
   *
   * Leaving a node is two beats, the arrival's two in reverse: the shell
   * closes, *then* the camera pulls back. Without the hold they ran together
   * and the camera won — its easing is front-loaded, so measured on an exit it
   * had travelled from 8.2 units out through the middle of the shell and away
   * again while the node was still a tenth open. The node finished closing
   * somewhere behind the reader, which is what "it closes after we have
   * already zoomed out" describes.
   *
   * A hold rather than a `setTimeout`, so it cannot race a route change: the
   * flight exists from the moment it is asked for, it simply has not started.
   */
  delay: number;
}
let flight: Flight | null = null;

/** Raw (un-eased) progress of a flight, 0..1. Kept raw so completion is an
 * exact `=== 1` rather than a question about the easing curve's endpoint. */
function flightProgress(active: Flight): number {
  const elapsed = performance.now() - active.start - active.delay;
  return Math.min(Math.max(elapsed, 0) / active.duration, 1);
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
 * Pivot clamps, applied whenever the camera settles.
 *
 * They pin the orbit radius rather than bounding it. Inside the graph the
 * reader stands still and looks around, so the only distance the controls may
 * hold is the small one that makes rotation happen in place; there is no
 * hand-dolly left to bound. Everywhere else they come off entirely — the
 * landing pose sits 9 units from its target and a live clamp would quietly
 * drag the camera out of the framing the landing page is composed against.
 */
function applyDollyClamps(
  controls: CameraControlsImpl,
  { free }: { free: boolean },
) {
  controls.minDistance = free ? 0 : LOOK_DISTANCE;
  controls.maxDistance = free ? Infinity : LOOK_DISTANCE;
}

/**
 * Park the camera for looking around: same position, same heading, pivot moved
 * to `LOOK_DISTANCE` ahead of it.
 *
 * Called on landing rather than baked into `INSIDE_POSE`, so the flights keep
 * interpolating between poses a comfortable distance from their targets. A
 * pose whose target sits 0.1 units from its own camera would drag the orbit
 * path's interpolated radius down to nothing on the way in.
 *
 * Position and direction are read off the camera and written straight back, so
 * this cannot move the picture — it only changes what a subsequent drag
 * rotates about.
 */
function parkForLookingAround(
  controls: CameraControlsImpl,
  pose: CameraPose,
) {
  // Derived from the pose just applied, **not** read back off the camera.
  // camera-controls writes `camera.position` during its own update, so
  // immediately after a `setLookAt` the camera object still holds wherever it
  // was before — and aiming the pivot from there put the reader at the centre
  // of the graph instead of at the standing point. Measured, that changed
  // 99.7% of the interior's pixels.
  _parkForward.copy(pose.target).sub(pose.position);
  if (_parkForward.lengthSq() < 1e-9) return;
  _parkForward.normalize();
  // Clamps first: `setLookAt` would otherwise be pulled back to the old
  // minimum distance the moment it is applied.
  controls.minDistance = LOOK_DISTANCE;
  controls.maxDistance = LOOK_DISTANCE;
  controls.setLookAt(
    pose.position.x,
    pose.position.y,
    pose.position.z,
    pose.position.x + _parkForward.x * LOOK_DISTANCE,
    pose.position.y + _parkForward.y * LOOK_DISTANCE,
    pose.position.z + _parkForward.z * LOOK_DISTANCE,
    false,
  );
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
  /** spotlightTarget with the reader's drag applied — what the globe aims at. */
  const orientationTarget = useRef(new THREE.Quaternion());
  const spotlightDirection = useRef(new THREE.Vector3());
  /** The subject and everything gathered around it — what "centred" means. */
  const spotlightGroup = useMemo(
    () =>
      spotlightNodeId
        ? [spotlightNodeId, ...neighborsOf(spotlightNodeId)].filter(
            (id) => nodeGeometry[id],
          )
        : [],
    [spotlightNodeId],
  );
  // Aiming at a different project is a request for a particular view of it,
  // so it starts from the orientation that view specifies rather than from
  // wherever the reader last left the sphere. The route half of this lives in
  // nebula-drag.tsx, which resets on navigation.
  useEffect(() => {
    resetDrag();
  }, [spotlightNodeId]);

  /** The solved landing composition — (x, y, scale) — damped as one thing. */
  const solved = useRef(new THREE.Vector3());
  const solvedVelocity = useRef(new THREE.Vector3());
  const solvedReady = useRef(false);
  const parallax = useRef(new THREE.Vector2());
  /** Damped distance from the landing solve's centre to the lit cluster's. */
  const centreOffset = useRef(new THREE.Vector3());
  const centreVelocity = useRef(new THREE.Vector3());
  /** Angular velocity of the turn, as a rotation vector in radians/second. */
  const turnVelocity = useRef(new THREE.Vector3());
  const ambientScale = useRef(1);
  const lastWrittenParallax = useRef({ x: 0, y: 0 });

  useFrame((state, delta) => {
    const group = groupRef.current;
    if (!group) return;
    // Clamped so a dropped frame or a backgrounded tab cannot fire the spring
    // through its target in one step.
    const dt = Math.min(delta, 1 / 20);
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
    // **The solved composition is sprung, because it changes under the reader.**
    // Spotlighting a project moves all three of these at once: the zoom goes
    // to SPOTLIGHT_ZOOM, and with labels to make room for, the centre moves
    // from hugging the text column to the middle of the space beside it. On
    // `/work` that transition happens on the *first hover*, where it landed as
    // a 191px jump of the graph in a single frame — the old solve jumped 51px
    // there and centring tripled it.
    //
    // Damped on the same clock as the turn, so hovering a row starts one
    // movement: the globe glides across and grows while it rotates to face the
    // project, and the three finish together. Only the solved part; the
    // parallax offset is added afterwards and keeps its own easing, since
    // damping it twice makes the pointer feel like it is dragging the graph
    // through treacle.
    const zoom = spotlightNodeId ? SPOTLIGHT_ZOOM : 1;
    _solvedTarget.set(
      (state.size.width *
        (clusterCenterXFraction(
          state.size.width,
          state.size.height,
          zoom,
          spotlightNodeId !== null,
        ) -
          0.5)) /
        pxPerWorldUnit,
      -(
        state.size.height *
        (clusterCenterYFraction(state.size.width, state.size.height, zoom) - 0.5)
      ) / pxPerWorldUnit,
      LANDING_SCALE *
        zoom *
        ambientScale.current *
        clusterScaleForViewport(state.size.width, state.size.height, zoom),
    );
    if (!solvedReady.current || reducedMotion) {
      // The first frame of a route is not a transition. A cold load of
      // `/work/[slug]` is already spotlit, and easing in from the unspotlit
      // composition would animate a change the reader never made.
      solved.current.copy(_solvedTarget);
      solvedVelocity.current.set(0, 0, 0);
      solvedReady.current = true;
    } else {
      solved.current.sub(_solvedTarget);
      smoothDampToZero(
        solved.current,
        solvedVelocity.current,
        SPOTLIGHT_TURN_SECONDS,
        dt,
      );
      solved.current.add(_solvedTarget);
    }

    const landingScale = solved.current.z;
    const landingX = parallax.current.x + solved.current.x;
    const landingY = parallax.current.y + solved.current.y;

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

      // ...and then settle the roll, which the step above leaves undecided.
      //
      // setFromUnitVectors returns the *shortest* rotation carrying one
      // direction onto another. That fixes where the node lands and says
      // nothing about the twist around it, so the surrounding cluster arrived
      // somewhere different on every project — sometimes below the node,
      // sometimes behind it — and the graph read as re-shuffling rather than
      // turning. Rolling about the facing axis until the layout's own up axis
      // is as near screen-up as it can be makes the orientation a function of
      // which node was chosen and nothing else, so the geography holds still
      // between pages.
      const facing = SPOTLIGHT_FACING;
      const up = _rollUp.copy(LAYOUT_UP).applyQuaternion(spotlightTarget.current);
      up.addScaledVector(facing, -up.dot(facing));
      const wanted = _rollWanted
        .copy(LAYOUT_UP)
        .addScaledVector(facing, -LAYOUT_UP.dot(facing));
      if (up.lengthSq() > 1e-6 && wanted.lengthSq() > 1e-6) {
        up.normalize();
        wanted.normalize();
        const angle = Math.acos(THREE.MathUtils.clamp(up.dot(wanted), -1, 1));
        const sign = Math.sign(_rollAxis.crossVectors(up, wanted).dot(facing));
        spotlightTarget.current.premultiply(
          _rollQuat.setFromAxisAngle(facing, angle * (sign || 1)),
        );
      }
    } else {
      spotlightTarget.current.identity();
    }

    // **The reader's own spin, applied on top.** Composed in screen axes and
    // premultiplied, so a horizontal drag turns the globe about the vertical
    // axis of the *viewport* rather than of the layout — the sphere follows
    // the pointer whatever orientation a project has already put it in.
    //
    // Held apart from spotlightTarget rather than folded into it, because the
    // centring solve below reads that one and must not see the spin: centring
    // the lit cluster against a dragged orientation slides the whole globe
    // sideways as you turn it, when what the gesture asks for is a sphere
    // rotating in place inside the composition the page already solved.
    const drag = getDragAngles();
    orientationTarget.current.copy(spotlightTarget.current);
    if (drag.yaw !== 0 || drag.pitch !== 0) {
      _dragQuat
        .copy(_dragYaw.setFromAxisAngle(SCREEN_UP, drag.yaw))
        .multiply(_dragPitch.setFromAxisAngle(SCREEN_RIGHT, drag.pitch));
      orientationTarget.current.premultiply(_dragQuat);
    }
    // **The turn unwinds as the flight goes in, and is exactly undone by the
    // time it lands.** `/nebula`'s heading was chosen against the layout's own
    // orientation — it is the one that keeps all four SEL centroids
    // front-facing and the seven cluster centroids furthest apart in screen
    // space — so arriving with the globe still turned for some work page puts
    // every cluster somewhere that composition does not expect. Tying the
    // rotation to the placement rather than easing it separately means the two
    // cannot disagree: at placement 1 the orientation is exactly the layout's,
    // whatever the reader was looking at before, and a departure winds it back
    // up in step.
    if (placement > 0) {
      // `orientationTarget`, not `spotlightTarget`: the reader's own spin is
      // part of where the globe is, so a flight unwinds it along with the
      // route's turn instead of dropping it on the first frame. It still lands
      // exactly at UNROTATED, which is what keeps arriving at `/nebula` the
      // same composition however you got there.
      group.quaternion.copy(orientationTarget.current).slerp(UNROTATED, placement);
      turnVelocity.current.set(0, 0, 0);
    } else if (reducedMotion || isDragging()) {
      // A drag is direct manipulation: the sphere is under the pointer and has
      // to track it exactly. Running it through the turn's spring would put
      // 0.85s of lag between the hand and the globe, which reads as the thing
      // being heavy rather than smooth. The velocity is cleared so releasing
      // does not fling it.
      group.quaternion.copy(orientationTarget.current);
      turnVelocity.current.set(0, 0, 0);
    } else {
      // The spring runs in the tangent space around the target: express where
      // the globe currently is as a rotation vector *from* the orientation it
      // wants, damp that toward zero, and put it back. Recomputed from the
      // real quaternion every frame, so it cannot drift out of step with what
      // is drawn, and re-aiming is just a different target next frame.
      _turnDelta
        .copy(orientationTarget.current)
        .invert()
        .multiply(group.quaternion);
      // Shortest arc: q and -q are the same orientation, and only one of them
      // is the short way round. Without this a swing across the far side of
      // the globe sometimes took the 250-degree path.
      if (_turnDelta.w < 0) {
        _turnDelta.set(-_turnDelta.x, -_turnDelta.y, -_turnDelta.z, -_turnDelta.w);
      }
      const sinHalf = Math.sqrt(Math.max(1 - _turnDelta.w * _turnDelta.w, 0));
      if (sinHalf > 1e-6) {
        const angle = 2 * Math.atan2(sinHalf, _turnDelta.w);
        _turnRel
          .set(_turnDelta.x, _turnDelta.y, _turnDelta.z)
          .multiplyScalar(angle / sinHalf);
      } else {
        _turnRel.set(0, 0, 0);
      }
      smoothDampToZero(
        _turnRel,
        turnVelocity.current,
        SPOTLIGHT_TURN_SECONDS,
        dt,
      );
      const remaining = _turnRel.length();
      if (remaining > 1e-6) {
        _turnStep.setFromAxisAngle(
          _turnAxis.copy(_turnRel).divideScalar(remaining),
          remaining,
        );
        group.quaternion.copy(orientationTarget.current).multiply(_turnStep);
      } else {
        group.quaternion.copy(orientationTarget.current);
      }
    }

    const scale = THREE.MathUtils.lerp(landingScale, 1, placement);
    group.scale.setScalar(scale);

    // **Centre the project, not the globe.** Turning the sphere puts the node
    // in the right place *on* it, but the sphere itself stays where the
    // landing solve puts it — so the gathered cluster ended up parked off to
    // one side of the space beside the article rather than sitting in it.
    // Placing the group so that its lit cluster lands on the solved centre
    // puts the project in the middle of that space and lets the globe hang
    // around it. Faded out by placement, so a departure toward `/nebula`
    // unwinds it in step with everything else.
    // Where the lit group should sit is a **screen-space** question, so it is
    // solved in screen space. A node's contribution to the on-screen middle of
    // the group is its offset divided by its own distance from the camera, and
    // those distances differ by a third of the globe's diameter across a
    // cluster turned to face the reader. Averaging the group's positions in
    // world space and matching that to the landing solve's world point — the
    // obvious thing, and what this did first — therefore missed twice over:
    // 48px right, because the cluster sits nearer the camera than the plane
    // the solve is written for, and 44px high, because the near half of the
    // cluster projects further from the view axis than the far half.
    //
    // Weights are projected area, r²/d²: what reads as the middle of a group
    // is its centre of visual mass, and a project node covers several times
    // the pixels of a technology node beside it.
    //
    // Only x and y. Shifting z would move the globe toward or away from the
    // camera and change its apparent size, which is not what centring means.
    //
    // Solved against the orientation the globe is turning *to*, not the one it
    // currently holds. Against the current one the target moves for as long as
    // the turn does, and a spring chasing a moving target never catches it —
    // measured, the offset was still 0.6 world units short a second after the
    // rotation had finished, so the composition kept creeping. Aiming at the
    // settled orientation makes it a fixed target the moment the hover
    // changes, so the slide across and the turn are one movement that ends at
    // one moment. The two agree once the turn lands, which is when it matters.
    let placedX = landingX;
    let placedY = landingY;
    if (spotlightGroup.length > 0) {
      let sumW = 0;
      let sumWoverD = 0;
      let sumXoverD = 0;
      let sumYoverD = 0;
      for (const id of spotlightGroup) {
        const live = getLivePosition(id);
        _spotCentre
          .copy(live ?? _spotNode.fromArray(nodeGeometry[id].position))
          .applyQuaternion(spotlightTarget.current)
          .multiplyScalar(scale);
        const d = Math.max(CAMERA_TO_CLUSTER - _spotCentre.z, 1);
        const r = nodeGeometry[id].radius;
        const w = (r * r) / (d * d);
        sumW += w;
        sumWoverD += w / d;
        sumXoverD += (w * _spotCentre.x) / d;
        sumYoverD += (w * _spotCentre.y) / d;
      }
      // Solve mean(w·(P + o)/d) = mean(w)·landing/CAMERA_TO_CLUSTER for P:
      // the group offset that lands the group's visual centre on exactly the
      // screen point the landing solve asked for.
      placedX =
        ((landingX / CAMERA_TO_CLUSTER) * sumW - sumXoverD) / sumWoverD;
      placedY =
        ((landingY / CAMERA_TO_CLUSTER) * sumW - sumYoverD) / sumWoverD;
    }

    // **The centring is eased, not applied.** Solved directly it is a
    // single-frame jump, and that jump is what made moving between projects
    // read as a teleport: the moment the hover changed, the offset that
    // centres the new cluster was applied whole, so the new project arrived
    // already lit and already in the middle of the frame and the only thing
    // left to watch was the globe turning behind it. Nothing travelled.
    //
    // Easing the offset toward its solved value at the same rate the turn
    // eases means the cluster is carried across the frame as the sphere brings
    // it around — the two converge together, so the project swings in and
    // settles instead of appearing. Only the centring is smoothed; the landing
    // solve underneath keeps its own parallax easing, which must not be
    // double-damped.
    const targetOffsetX = placedX - landingX;
    const targetOffsetY = placedY - landingY;
    if (reducedMotion) {
      centreOffset.current.set(targetOffsetX, targetOffsetY, 0);
      centreVelocity.current.set(0, 0, 0);
    } else {
      // Damped on the same clock as the turn, so the globe stops sliding at
      // the moment it stops rotating. Under the old per-frame fraction the
      // offset was still 0.5 world units short of its target eight seconds
      // after the turn had visually finished, and the composition crept.
      centreOffset.current.x -= targetOffsetX;
      centreOffset.current.y -= targetOffsetY;
      smoothDampToZero(
        centreOffset.current,
        centreVelocity.current,
        SPOTLIGHT_TURN_SECONDS,
        dt,
      );
      centreOffset.current.x += targetOffsetX;
      centreOffset.current.y += targetOffsetY;
    }

    group.position.set(
      THREE.MathUtils.lerp(landingX + centreOffset.current.x, 0, placement),
      THREE.MathUtils.lerp(landingY + centreOffset.current.y, 0, placement),
      THREE.MathUtils.lerp(CLUSTER_DEPTH, 0, placement),
    );

    // Hand the pointer half the circle the globe actually occupies. Derived
    // here because this is the only place that knows all three terms — the
    // solved centre, the parallax and centring offsets on top of it, and the
    // scale after the spotlight zoom. Inside the graph there is no circle to
    // speak of: the camera is within the shell and camera-controls owns the
    // pointer, so the drag surface stands down rather than guessing.
    if (placement < 1) {
      setClusterCircle(
        state.size.width / 2 + group.position.x * pxPerWorldUnit,
        state.size.height / 2 - group.position.y * pxPerWorldUnit,
        CONSTELLATION_BOUNDING_RADIUS * scale * pxPerWorldUnit,
      );
    } else {
      setClusterCircle(0, 0, 0);
    }
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
    if (!free) parkForLookingAround(controls, pose);
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

    const { reducedMotion } = useSceneStore.getState();
    // **Not the store's focusedNodeId.** RouteFocus is rendered ahead of this
    // rig precisely so its effect runs first, which means by the time this
    // reads the store the focus has already been cleared and every exit looks
    // like it came from the bare graph. The rig's own record of where it last
    // flew is still intact here, because the focus effect that maintains it is
    // declared after this one.
    const leavingNode = lastFocus.current != null;

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
        duration: FLIGHT_DURATION_MS,
        delay: 0,
      });
      return;
    }

    // Clearing focus first is what closes the shell: the node reads its own
    // open state from the store, so by the time the flight below starts, the
    // panel has gone and the rectangle is already contracting back toward a
    // sphere. That is the "shell contracts" half of the exit; the flight is
    // the "camera pulls back" half, and they run together.
    useSceneStore.getState().clearFocus();
    // A first mount off /nebula has nowhere to depart from.
    if (wasNebula === undefined || reducedMotion) {
      settle(controls, HOME_POSE, HOME_CAMERA_FOV, { free: true, at: 0 });
      return;
    }
    begin(controls, {
      from: currentPose(controls),
      to: HOME_POSE,
      start: performance.now(),
      // Read off the camera rather than assumed to be the graph's. Leaving
      // from inside a node starts at FOCUS_CAMERA_FOV, not INSIDE_CAMERA_FOV,
      // and assuming the latter opened the departure by snapping 22 degrees
      // wider — which is what made this exit worth cutting rather than flying
      // in the first place.
      fovFrom: (controls.camera as THREE.PerspectiveCamera).fov,
      fovTo: HOME_CAMERA_FOV,
      placementFrom: 1,
      placementTo: 0,
      duration: FLIGHT_DURATION_MS,
      // Only when there is a shell to close. Leaving the graph itself has no
      // second beat to wait for.
      delay: leavingNode ? SHELL_CLOSE_MS : 0,
      // Orbits out around the shell rather than cutting across its middle,
      // which matters more from a focused node than from the graph's resting
      // pose: the camera is parked against the inside of the surface there, so
      // a straight line to the landing pose would leave through the wall.
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
    const to = routeFocusId
      ? focusPose(routeFocusId)
      : restingPoseFacing(previousFocus);
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
      duration: FOCUS_FLIGHT_DURATION_MS,
      // Closing one waits for the shell; opening one has nothing to wait for,
      // and a sideways move carries its shell with it.
      delay: routeFocusId === null ? SHELL_CLOSE_MS : 0,
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
      const free =
        active.placementTo < 1 ||
        useSceneStore.getState().focusedNodeId !== null;
      applyDollyClamps(controls, { free });
      // Landed inside with nothing open: hand the drag over to looking around.
      if (!free) parkForLookingAround(controls, active.to);
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
      // Nothing. Inside the graph there is one place to stand, and the reader
      // looks around from it — a dolly would either push them through the
      // shell or shrink the room, and neither is a thing the space offers.
      mouseButtons-wheel={CameraControlsImpl.ACTION.NONE}
      touches-two={CameraControlsImpl.ACTION.NONE}
      touches-three={CameraControlsImpl.ACTION.NONE}
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
  // The preview is confined to `/work` — it is never cleared on hover-out, so
  // that a reader scanning the list gets one continuous re-aim rather than a
  // lurch toward neutral between every row, and without this gate the last row
  // they happened to touch would follow them onto `/about`.
  const previewNodeId = useSceneStore((s) => s.previewNodeId);
  const routeSpotlight = nodeIdForWorkPathname(pathname);
  const spotlightNodeId =
    routeSpotlight ?? (pathname === "/work" ? previewNodeId : null);

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
      {/* Home, as a thing in the world rather than a route you came from.
          Outside the placement group on purpose: it is fixed in space while
          the constellation is still the one that scales and moves. On every
          route but the graph it sits squarely behind the camera, so the gate
          is about not paying for it rather than about hiding it. */}
      <NebulaHome visible={isNebula} />
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
          gatherNodeId={routeSpotlight}
          onOpenNode={openNode}
        />
      </ConstellationPlacement>
    </Canvas>
  );
}
