"use client";

import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
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
  CLUSTER_PARALLAX_MAX_PX,
  clusterCenterXFraction,
  clusterCenterYFraction,
  clusterScaleForViewport,
} from "@/lib/cluster-geometry";
import {
  HOME_REST_OPACITY,
  HOME_STANDOFF,
  LANDING_SCALE,
  LANDING_STANDING_DISTANCE,
  REFERENCE_DISTANCE,
  STANDING_FOV,
} from "@/lib/world-scale";
import {
  approachEase,
  diveEase,
  divePose,
  FLIGHT_DURATION_MS,
  FOCUS_FLIGHT_DURATION_MS,
  flightEase,
  focusPose,
  lerpPose,
  approachLerpPose,
  shellLerpPose,
  type CameraPose,
} from "./nebula-flight";
import { NebulaHome } from "./nebula-home";
import { HOME_HANDOFF_MS } from "./nebula-departure";
import { getHeroFrame, homePlane } from "./nebula-home-placement";
import { getPlacement, setPlacement } from "./nebula-placement";
import { publishCameraProbe } from "./nebula-probe";
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
/** Half a pixel: below this the overlays would not move anyway. */
const CIRCLE_WRITE_EPSILON_PX = 0.5;
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
 * The orientation that turns a project's cluster to face the reader.
 *
 * setFromUnitVectors gives the shortest rotation carrying the node onto the
 * facing direction — which fixes where the node lands and says nothing about
 * the twist around it, so the surrounding cluster arrived somewhere different
 * on every project and the graph read as re-shuffling rather than turning.
 * Rolling about the facing axis until the layout's own up is as near screen-up
 * as it can be makes the orientation a function of which node was chosen and
 * nothing else, so the geography holds still between pages.
 *
 * A function because two things need the same answer: the group, which turns
 * to it, and the camera, which centres the lit cluster against it.
 */
function spotlightQuaternion(nodeId: string | null, out: THREE.Quaternion) {
  if (!nodeId || !nodeGeometry[nodeId]) return out.identity();
  _spotDirection.fromArray(nodeGeometry[nodeId].position).normalize();
  out.setFromUnitVectors(_spotDirection, SPOTLIGHT_FACING);
  const facing = SPOTLIGHT_FACING;
  const up = _rollUp.copy(LAYOUT_UP).applyQuaternion(out);
  up.addScaledVector(facing, -up.dot(facing));
  const wanted = _rollWanted
    .copy(LAYOUT_UP)
    .addScaledVector(facing, -LAYOUT_UP.dot(facing));
  if (up.lengthSq() > 1e-6 && wanted.lengthSq() > 1e-6) {
    up.normalize();
    wanted.normalize();
    const angle = Math.acos(THREE.MathUtils.clamp(up.dot(wanted), -1, 1));
    const sign = Math.sign(_rollAxis.crossVectors(up, wanted).dot(facing));
    out.premultiply(_rollQuat.setFromAxisAngle(facing, angle * (sign || 1)));
  }
  return out;
}


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

/**
 * **The graph finishes turning before the reader reaches it.**
 *
 * The turn between the landing face and the interior one is carried by the
 * graph, and it used to be spread across the whole flight in step with the
 * placement. With the flight now ending at the centre, the last stretch is
 * spent inside the shell with nodes a unit or two from the camera, and a
 * graph still rotating there sweeps those nodes sideways across the frame —
 * which reads as the world swinging rather than the reader travelling. So
 * the turn is spent over the first seven tenths of the placement, which on
 * the dive's schedule is done just before the shell is crossed, and the run
 * through the wall and into the middle is against a graph that holds still.
 * Symmetric on the way out: the graph waits until the camera is clear of the
 * shell, then turns back while it is far.
 */
const UNWIND_BY = 0.7;

function unwindShare(placement: number) {
  const u = Math.min(1, placement / UNWIND_BY);
  return u * u * (3 - 2 * u);
}

/** Scratch for the roll solve, the turn and the centring; all run every frame. */
const _dampTemp = new THREE.Vector3();
const _turnDelta = new THREE.Quaternion();
const _turnRel = new THREE.Vector3();
const _turnAxis = new THREE.Vector3();
const _turnStep = new THREE.Quaternion();
const _solvedTarget = new THREE.Vector3();
const _tiltFallbackUp = new THREE.Vector3(1, 0, 0);
/** The direction every camera on this site looks, now that the graph turns. */
const FORWARD = new THREE.Vector3(0, 0, -1);
const _parkForward = new THREE.Vector3();
const _dragQuat = new THREE.Quaternion();
const _dragYaw = new THREE.Quaternion();
const _dragPitch = new THREE.Quaternion();
const SCREEN_UP = new THREE.Vector3(0, 1, 0);
const SCREEN_RIGHT = new THREE.Vector3(1, 0, 0);
const _spotCentre = new THREE.Vector3();
const _spotDirection = new THREE.Vector3();
const _spotQuat = new THREE.Quaternion();
const _spotNode = new THREE.Vector3();
const _rollUp = new THREE.Vector3();
const _rollWanted = new THREE.Vector3();
const _rollAxis = new THREE.Vector3();
const _rollQuat = new THREE.Quaternion();
/** The layout's own orientation, which is what `/nebula` is composed against. */


/**
 * **Where the reader stands inside the graph: the centre of it.**
 *
 * This is a decision, not a measurement, and the measurements argued the
 * other way. `07-continuous-space.md` records four searches over standing
 * points inside the shell, and every one of them avoided the middle for the
 * same reason: on a hollow shell every node is the same distance from the
 * centre, so from there nothing is near and nothing is far — "a flat wall,
 * approached from the other side". The searched poses stood 5.5 to 9 units
 * out to buy depth, and the price was that the reader arrived off-centre,
 * with two nodes filling one edge of the frame and the mass of the graph
 * piled in the opposite corner, and the flight in felt like it stopped at a
 * doorway.
 *
 * The brief, restated by the person whose site it is: land in the centre, so
 * that looking around is looking around from the middle of a cloud of nodes,
 * and fly *straight* there — the camera holds its heading, and it is the
 * graph that turns to put something worth seeing in front of the reader on
 * arrival. Uniform depth is the thing being asked for. So the standing point
 * is the origin, and what is searched now is only the heading.
 */
const INTERIOR_STANDING_POINT = new THREE.Vector3(0, 0, 0);

/**
 * Which way the reader faces on arrival, in the graph's own space — and
 * therefore which face of the constellation the graph turns toward the
 * approaching camera.
 *
 * Searched from the centre (`checks/interiorheading.mjs`), over the whole
 * sphere of headings, scored on nodes in frame across six desktop viewports,
 * production projects in frame, and total apparent area, with the frame's
 * centroid held near the middle and no node within 6 degrees of the axis, so
 * the arrival is not pointed at one project. Two more constraints exist only
 * because the flight is now a straight line *through* the shell: the camera
 * enters along the reverse of this heading, so no node may sit within 1.5
 * units of that line — the reader passes nodes, not through them.
 *
 * At 1440x900 this puts 18 nodes in frame, six of them projects and all six
 * production work, with the sparsest of the six viewports at 17. Re-run the
 * search when `content/layout.ts` moves; a heading measured against a layout
 * that has since changed is indistinguishable from one that was never right.
 */
const INTERIOR_HEADING = new THREE.Vector3(-0.083, 0.908, 0.411).normalize();

/**
 * How far the pose's target sits ahead of the camera on the interior poses.
 *
 * Not a distance from anything, and named carefully because its predecessor
 * was not: the reader stands still inside the graph and the pivot ends up
 * `LOOK_DISTANCE` ahead of them anyway (parkForLookingAround). This is only
 * the radius a flight interpolates its heading against, and it wants to be
 * about the size of the room rather than a tenth of a unit — see
 * approachLerpPose on what happens when a pose's target is mistaken for the
 * graph.
 */
const INSIDE_DISTANCE = 9;

/**
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
 *
 * Unlike STANDING_FOV this is **not** a dial. The interior composition was
 * searched against it and home's apparent size from inside is held against it
 * (lib/world-scale.ts), so moving it moves two compositions at once.
 */
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
 * **The orientation the graph turns to as the reader arrives, and the reason
 * the arrival is a straight line.**
 *
 * `/` and `/nebula` want different faces of the constellation toward the
 * camera, so between them *something* has to rotate. It used to be the camera:
 * the interior heading is an oblique direction chosen against the layout, so
 * flying in swung the view about 111 degrees and the reader ended up looking
 * somewhere quite different from where they had started. That reads as being
 * carried around a corner, and it makes flying *past* anything impossible,
 * which Part 4 needs.
 *
 * So the graph turns instead. This is the rotation that carries
 * INTERIOR_HEADING onto straight down −z, which is where the standing camera
 * already looks — so the camera keeps one heading for the whole journey and
 * only travels. The picture at either end is identical; a rigid rotation of
 * the world and the camera together cannot change what is rendered, which is
 * what the pixel gate checks.
 *
 * The unwind in ConstellationOrientation interpolates toward this value, so
 * whatever a work page had turned the globe to is exactly undone by the time
 * the reader is inside. That is what makes arriving through a turned work page
 * identical to arriving directly, and it holds for any orientation this is.
 */
const NEBULA_BASE_ROTATION = (() => {
  // A camera, not a plain Object3D. `lookAt` points an object's +z at its
  // target but a camera's −z, and three special-cases that on `isCamera` — so
  // deriving this from an Object3D gives an orientation flipped 180 degrees
  // and the interior composition comes out inside-out. Measured that way, all
  // of /nebula changed at every viewport.
  const look = new THREE.PerspectiveCamera();
  look.position.copy(INTERIOR_STANDING_POINT);
  look.lookAt(
    INTERIOR_STANDING_POINT.clone().addScaledVector(
      INTERIOR_HEADING,
      INSIDE_DISTANCE,
    ),
  );
  return look.quaternion.clone().invert();
})();

const UNROTATED = NEBULA_BASE_ROTATION;

const INSIDE_POSE: CameraPose = (() => {
  // The composed standing point, carried into the rotated world. Rotating the
  // graph and the camera by the same amount leaves the view untouched, so this
  // is the same place in the shell as before — it simply now has the reader
  // facing −z, like every other route.
  const position = INTERIOR_STANDING_POINT.clone().applyQuaternion(
    NEBULA_BASE_ROTATION,
  );
  return {
    position,
    target: position.clone().addScaledVector(FORWARD, INSIDE_DISTANCE),
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
  // Node positions are in the graph's own space, and the graph is turned by
  // NEBULA_BASE_ROTATION once the reader is inside — so where a node actually
  // is, is its local position carried through that turn.
  const direction = new THREE.Vector3()
    .fromArray(node.position)
    .applyQuaternion(NEBULA_BASE_ROTATION)
    .sub(position);
  if (direction.lengthSq() < 1e-6) return INSIDE_POSE;
  direction.normalize();
  return {
    position,
    target: position.clone().addScaledVector(direction, INSIDE_DISTANCE),
  };
}



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
  /** Orbit-interpolate the path (see approachLerpPose) rather than lerp it straight. */
  /**
   * How to get there. `line` is a straight lerp, right for a short hop that
   * barely turns. `approach` is the journey between the landing page and the
   * graph, measured from the graph's centre — see approachLerpPose. `shell`
   * sweeps across the surface between two nodes, for a sideways move.
   */
  path: "line" | "approach" | "shell" | "dive";
  /**
   * How long it takes. Carried per flight rather than read from a constant,
   * because the two kinds of move want different times — see
   * FOCUS_FLIGHT_DURATION_MS.
   */
  duration: number;
  /**
   * The curve, when the standard one is not right. The journey between the
   * landing page and the graph uses `approachEase`; everything else is a UI
   * transition and keeps `flightEase`.
   */
  ease?: (t: number) => number;
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
  /**
   * Where the destination document is allowed to appear, as a fraction of
   * raw progress — see ARRIVAL_REVEAL_AT. Only meaningful for a departure.
   */
  revealAt: number;
  /**
   * Does this flight end at the home standing point? Then the hero plane
   * has to be exactly where the real hero is by the end, and dissolve into
   * it as the document appears.
   */
  toHome: boolean;
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
 * Draws the constellation, and turns it.
 *
 * Turns it and nothing else. The graph sits at the origin at life size on
 * every route; what used to be a per-route transform — shrunk to the landing
 * footprint and pushed back off `/nebula`, identity on it — is now where the
 * *camera* stands, solved in the rig. 07-continuous-space.md, Part 3: the
 * scale was always a distance in disguise, and moving the camera to that
 * distance projects every point identically.
 *
 * What is left here is orientation: the spotlight turn toward a project, the
 * reader's own drag, and the spring that carries the group between them.
 */
function ConstellationOrientation({
  spotlightNodeId,
  children,
}: {
  /** On `/work/[slug]`, the node whose cluster is turned to face the reader. */
  spotlightNodeId: string | null;
  children: ReactNode;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const spotlightTarget = useRef(new THREE.Quaternion());
  /** spotlightTarget with the reader's drag applied — what the globe aims at. */
  const orientationTarget = useRef(new THREE.Quaternion());
  /** Angular velocity of the turn, as a rotation vector in radians/second. */
  const turnVelocity = useRef(new THREE.Vector3());
  // Aiming at a different project is a request for a particular view of it,
  // so it starts from the orientation that view specifies rather than from
  // wherever the reader last left the sphere. The route half of this lives in
  // nebula-drag.tsx, which resets on navigation.
  useEffect(() => {
    resetDrag();
  }, [spotlightNodeId]);

  useFrame((_state, delta) => {
    const group = groupRef.current;
    if (!group) return;
    // Clamped so a dropped frame or a backgrounded tab cannot fire the spring
    // through its target in one step.
    const dt = Math.min(delta, 1 / 20);
    const { reducedMotion } = useSceneStore.getState();
    const placement = getPlacement();

    // `/work/[slug]` turns the globe so its project's cluster faces the
    // reader. The layout is preserved rather than deformed — 05-phase-2.md
    // originally had the connected subgraph *gather* toward a focal point,
    // which moves the nodes; turning the whole sphere instead means a cluster
    // is always in the same place relative to its neighbours, so the geography
    // is learnable across pages rather than rearranged on each one.
    //
    // Aimed at the seeded layout position, not the live wandering one, so the
    // target does not drift while the turn is converging on it.
    spotlightQuaternion(spotlightNodeId, spotlightTarget.current);

    // **The reader's own spin, applied on top.** Composed in screen axes and
    // premultiplied, so a horizontal drag turns the globe about the vertical
    // axis of the *viewport* rather than of the layout — the sphere follows
    // the pointer whatever orientation a project has already put it in.
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
    // orientation, so arriving with the globe still turned for some work page
    // puts every cluster somewhere that composition does not expect. Tying
    // the rotation to the placement means the two cannot disagree: at
    // placement 1 the orientation is exactly the layout's, whatever the reader
    // was looking at before.
    if (placement > 0) {
      group.quaternion
        .copy(orientationTarget.current)
        .slerp(UNROTATED, unwindShare(placement));
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
  isHome,
  spotlightNodeId,
  routeFocusId,
}: {
  isNebula: boolean;
  isHome: boolean;
  /** On `/work/[slug]`, the node whose cluster the standing camera centres. */
  spotlightNodeId: string | null;
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
  const size = useThree((s) => s.size);
  const scene = useThree((s) => s.scene);

  /**
   * **The standing pose: where the camera is on every route but the graph.**
   *
   * Off `/nebula` the camera does not move on its own; it stands somewhere
   * the page composed, and this is the solve for where. Everything
   * 04-phase-1.md asks of the landing cluster — the solved centre, the
   * viewport-width shrink, the pointer parallax, the ambient scale-down off
   * `/` — used to be a transform on the graph. It is the same arithmetic
   * here, producing a distance and a lateral offset for the camera instead,
   * and it projects identically (see REFERENCE_DISTANCE).
   *
   * Solved every frame, whether or not it is being applied, so that when a
   * departure lands the springs and the parallax are already where they would
   * have been rather than catching up from wherever the flight began.
   */
  const standing = useRef<CameraPose>({
    position: new THREE.Vector3(),
    target: new THREE.Vector3(),
  });
  /** The solved composition — centre x, centre y in px, distance — damped as one thing. */
  const solved = useRef(new THREE.Vector3());
  const solvedVelocity = useRef(new THREE.Vector3());
  const solvedReady = useRef(false);
  const ambientSize = useRef(1);
  /** Pointer parallax in screen px, with world-like signs: +x right, +y up. */
  const parallaxPx = useRef(new THREE.Vector2());
  const lastPublished = useRef({ ready: false, centerX: 0, centerY: 0, radiusPx: 0 });

  /**
   * Tell the DOM overlays where the graph is, when it has moved enough to
   * matter. Guarded because the solve springs and a spring never exactly
   * arrives: an unguarded per-frame write would re-render every subscriber at
   * 60fps forever, even at rest.
   */
  function publishCircle(
    ready: boolean,
    centerX: number,
    centerY: number,
    radiusPx: number,
  ) {
    const last = lastPublished.current;
    if (
      last.ready === ready &&
      Math.abs(last.centerX - centerX) < CIRCLE_WRITE_EPSILON_PX &&
      Math.abs(last.centerY - centerY) < CIRCLE_WRITE_EPSILON_PX &&
      Math.abs(last.radiusPx - radiusPx) < CIRCLE_WRITE_EPSILON_PX
    ) {
      return;
    }
    lastPublished.current = { ready, centerX, centerY, radiusPx };
    useSceneStore.getState().setClusterScreen({ ready, centerX, centerY, radiusPx });
  }
  /** Damped camera offset that centres the lit cluster rather than the globe. */
  const centreOffset = useRef(new THREE.Vector3());
  const centreVelocity = useRef(new THREE.Vector3());
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

  const solveStanding = useCallback(
    (dt: number, reducedMotion: boolean) => {
    const { width: W, height: H } = size;
    if (W <= 0 || H <= 0) return;
    const { pointer } = useSceneStore.getState();
    const spotlit = spotlightNodeId !== null;

    // Ambient dimming off `/` is eased rather than switched, so moving between
    // the Phase 1 routes doesn't snap the graph's size. `/nebula` counts as
    // undimmed: it is the size a departure flies back to, and letting it drift
    // to the ambient value while parked in the graph made the landing 30% too
    // small and then grow back over the following second. A spotlit work page
    // keeps full size too — the graph is doing a job there.
    ambientSize.current = THREE.MathUtils.lerp(
      ambientSize.current,
      isNebula || isHome || spotlit ? 1 : AMBIENT_SCALE,
      reducedMotion ? 1 : AMBIENT_EASE,
    );

    // Parallax is a landing-page behaviour and only advances while standing
    // there. Holding it still for the duration of a flight is deliberate: the
    // departure's destination is sampled once, so it leaves continuously
    // instead of being separately animated out.
    if (!isNebula && !flight) {
      if (reducedMotion) {
        parallaxPx.current.set(0, 0);
      } else {
        // The design system specifies this swing in pixels — see
        // CLUSTER_PARALLAX_MAX_PX — so it is kept in pixels.
        parallaxPx.current.x = THREE.MathUtils.lerp(
          parallaxPx.current.x,
          -pointer.x * CLUSTER_PARALLAX_MAX_PX,
          PARALLAX_EASE,
        );
        parallaxPx.current.y = THREE.MathUtils.lerp(
          parallaxPx.current.y,
          pointer.y * CLUSTER_PARALLAX_MAX_PX,
          PARALLAX_EASE,
        );
      }
    }

    // The composition, in full. The size rules yield a factor on the
    // reference projection; the camera stands REFERENCE_DISTANCE divided by
    // that factor away, which projects the same picture. Centre and distance
    // are sprung together (SPOTLIGHT_TURN_SECONDS), because spotlighting a
    // project moves all three at once and on `/work` that happens on the
    // first hover — measured as a 191px jump of the graph in one frame when it
    // was switched rather than damped. Parallax is added afterwards and keeps
    // its own easing; damping it twice makes the pointer feel like it is
    // dragging the graph through treacle.
    const zoom = spotlit ? SPOTLIGHT_ZOOM : 1;
    const sizeFactor =
      LANDING_SCALE *
      zoom *
      ambientSize.current *
      clusterScaleForViewport(W, H, zoom);
    _solvedTarget.set(
      W * clusterCenterXFraction(W, H, zoom, spotlit),
      H * clusterCenterYFraction(W, H, zoom),
      REFERENCE_DISTANCE / sizeFactor,
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

    const D = solved.current.z;
    // Pixels per world unit at unit distance, and at the graph's distance.
    const K = H / 2 / Math.tan((STANDING_FOV * Math.PI) / 360);
    const k = K / D;
    const centreXPx = solved.current.x + parallaxPx.current.x;
    const centreYPx = solved.current.y - parallaxPx.current.y;
    // Where the camera stands to put the graph's *origin* on that point.
    // Looking straight down -z, so a lateral offset of the camera is a
    // lateral offset of the picture and nothing else — a rotation would have
    // introduced perspective the composition was never solved for.
    const plainX = -(centreXPx - W / 2) / k;
    const plainY = (centreYPx - H / 2) / k;

    // **Centre the project, not the globe.** Turning the sphere puts the node
    // in the right place *on* it, but the sphere itself stays where the solve
    // puts it, so the gathered cluster used to sit off to one side of the
    // space beside the article. This is a screen-space question and is solved
    // in screen space: each lit node's share of the group's on-screen middle
    // is its offset divided by its own distance from the camera, weighted by
    // projected area (r²/d²), since a project node covers several times the
    // pixels of a technology node beside it. Solved against the orientation
    // the globe is turning *to*, so the target is fixed the moment the hover
    // changes and the spring can actually catch it.
    let targetOffsetX = 0;
    let targetOffsetY = 0;
    if (spotlightGroup.length > 0) {
      spotlightQuaternion(spotlightNodeId, _spotQuat);
      let sumW = 0;
      let sumWoverD = 0;
      let sumXoverD = 0;
      let sumYoverD = 0;
      for (const id of spotlightGroup) {
        const live = getLivePosition(id);
        _spotCentre
          .copy(live ?? _spotNode.fromArray(nodeGeometry[id].position))
          .applyQuaternion(_spotQuat);
        const d = Math.max(D - _spotCentre.z, 1);
        const r = nodeGeometry[id].radius;
        const w = (r * r) / (d * d);
        sumW += w;
        sumWoverD += w / d;
        sumXoverD += (w * _spotCentre.x) / d;
        sumYoverD += (w * _spotCentre.y) / d;
      }
      // Solve mean(w·(o - c)/d)·K = target - centre for the camera offset c.
      const camX =
        (sumXoverD - ((centreXPx - W / 2) / K) * sumW) / sumWoverD;
      const camY =
        (sumYoverD - ((H / 2 - centreYPx) / K) * sumW) / sumWoverD;
      targetOffsetX = camX - plainX;
      targetOffsetY = camY - plainY;
    }
    // Damped on the same clock as the turn, so the globe stops sliding at the
    // moment it stops rotating.
    if (reducedMotion) {
      centreOffset.current.set(targetOffsetX, targetOffsetY, 0);
      centreVelocity.current.set(0, 0, 0);
    } else {
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

    const camX = plainX + centreOffset.current.x;
    const camY = plainY + centreOffset.current.y;
    standing.current.position.set(camX, camY, D);
    standing.current.target.set(camX, camY, 0);

    // Hand the pointer half the circle the globe actually occupies: the
    // origin projected through the standing camera, and the bounding radius
    // at its distance. Inside the graph there is no circle to speak of.
    if (isNebula) {
      setClusterCircle(0, 0, 0);
      publishCircle(false, 0, 0, 0);
    } else {
      const cx = W / 2 - camX * k;
      const cy = H / 2 + camY * k;
      const r = CONSTELLATION_BOUNDING_RADIUS * k;
      setClusterCircle(cx, cy, r);
      publishCircle(true, cx, cy, r);
    }
    },
    [isNebula, isHome, spotlightNodeId, spotlightGroup, size],
  );

  /** Scratch for the home solve; runs every frame. */
  const homeCamera = useRef(new THREE.Vector3());

  /**
   * **Where the hero plane is this frame**, and how present it is.
   *
   * The plane hangs HOME_STANDOFF ahead of the home standing point, sized and
   * placed so that from that point it covers the hero column's measured
   * pixels exactly — so the swap between page and plane has nowhere to show.
   * On `/` the standing pose *is* the home point, parallax and all, and the
   * column's live rect carries the same parallax on the DOM side. Anywhere
   * else, home is solved from the landing composition for this viewport with
   * nothing moving, which is where the page will be when the reader gets
   * back to it.
   *
   * Presence follows the flight, by distance from the centre so one rule
   * serves both directions: full at the standing point, down to
   * HOME_REST_OPACITY by half way in. Arriving home, it fades out over the
   * same window the document fades in. Off `/nebula` at rest it is not drawn
   * at all — it would sit on top of the real page.
   */
  function solveHomePlane(
    cameraPosition: THREE.Vector3,
    active: Flight | null,
  ) {
    const { width: W, height: H } = size;
    if (W <= 0 || H <= 0) return;
    const K = H / 2 / Math.tan((STANDING_FOV * Math.PI) / 360);

    if (isHome) {
      homeCamera.current.copy(standing.current.position);
    } else {
      const sizeFactor = LANDING_SCALE * clusterScaleForViewport(W, H, 1);
      const D = REFERENCE_DISTANCE / sizeFactor;
      const k = K / D;
      homeCamera.current.set(
        -(W * clusterCenterXFraction(W, H, 1, false) - W / 2) / k,
        (H * clusterCenterYFraction(W, H, 1) - H / 2) / k,
        D,
      );
    }

    const frame = getHeroFrame() ?? {
      left: 0.048 * W,
      top: 0.045 * H,
      width: Math.min(0.44 * W, 700),
      height: 0.72 * H,
    };
    const p = HOME_STANDOFF;
    homePlane.position.set(
      homeCamera.current.x + ((frame.left + frame.width / 2 - W / 2) / K) * p,
      homeCamera.current.y - ((frame.top + frame.height / 2 - H / 2) / K) * p,
      homeCamera.current.z - p,
    );
    homePlane.width = (frame.width / K) * p;
    homePlane.height = (frame.height / K) * p;

    if (!active) {
      if (isNebula) {
        homePlane.opacity = HOME_REST_OPACITY;
      } else if (handoffOut.current > 0) {
        const u = (performance.now() - handoffOut.current) / HOME_HANDOFF_OUT_MS;
        homePlane.opacity = THREE.MathUtils.clamp(1 - u, 0, 1);
        if (u >= 1) handoffOut.current = 0;
      } else {
        homePlane.opacity = 0;
      }
      return;
    }
    const outer = Math.max(
      active.from.position.length(),
      active.to.position.length(),
      1e-3,
    );
    const r = cameraPosition.length();
    const inward = THREE.MathUtils.clamp((1 - r / outer) / 0.5, 0, 1);
    homePlane.opacity = THREE.MathUtils.lerp(
      1,
      HOME_REST_OPACITY,
      inward * inward * (3 - 2 * inward),
    );
  }

  function clonePose(pose: CameraPose): CameraPose {
    return { position: pose.position.clone(), target: pose.target.clone() };
  }

  /**
   * **How much of the departure passes before the page you are arriving at
   * shows up.**
   *
   * Leaving the graph is the one flight whose destination is a document, and
   * the document used to win: measured, the landing page painted at full
   * opacity 190ms after the click, and the remaining 1.9 seconds of retreat
   * played out behind a page that had already finished arriving. The flight
   * was there the whole time — 44%, 70% and 91% of the way out at each
   * quarter, exactly as specified — and nothing was ever looking at it.
   *
   * At 0.55 the reveal starts at 1100ms and its 620ms fade completes at
   * 1720ms, comfortably before the camera settles at 2000ms. So the retreat
   * has the frame to itself while it is worth watching, and the page is
   * finished and readable by the time the camera stops rather than beginning
   * to appear then. The alternative — waiting for the landing and fading
   * afterwards — makes the journey 2620ms and puts a pause in the middle of
   * it.
   *
   * Driven off the flight's own progress rather than a `setTimeout`, for the
   * reason the flight's `delay` is a hold rather than a timer: it cannot race
   * a route change, and it cannot desync from a flight that was interrupted.
   */
  const ARRIVAL_REVEAL_AT = 0.55;

  /**
   * When the destination is home there is no early reveal at all. The page
   * is *already visible* for the whole retreat, as the plane the camera is
   * backing away toward, and the document only has to take over from it —
   * a swap that is invisible only while the plane sits on the page pixel for
   * pixel, which is once the camera has stopped. So the document is revealed
   * at the moment of landing and the plane dissolves out over the document's
   * own 620ms fade (globals.css), the arrival's hand-off in reverse.
   */
  const HOME_REVEAL_AT = 1;
  /** Matches the document's fade-in in globals.css. */
  const HOME_HANDOFF_OUT_MS = 620;
  /** When the plane began dissolving into the document, or 0. */
  const handoffOut = useRef(0);

  /**
   * Let the page the reader is flying to appear.
   *
   * `route-curtain.tsx` raises `data-arriving` on `<html>` when a navigation
   * leaves the graph, before the browser can paint the destination; this is the
   * other edge of it. Written to the document rather than the store because it
   * is read by CSS and changes in the middle of a frame loop — a `set` here
   * would re-render every subscriber of the store to schedule a transition.
   * The cursor layer writes to the same element for the same reason.
   */
  function revealDocument() {
    if (typeof document === "undefined") return;
    // Guarded because the frame loop asks every frame once a departure is past
    // its reveal point, and `delete` on <html> is a real DOM write that would
    // otherwise happen sixty times a second for the rest of the flight.
    if (document.documentElement.dataset.leaving !== undefined) {
      delete document.documentElement.dataset.leaving;
    }
    if (document.documentElement.dataset.arriving === undefined) return;
    delete document.documentElement.dataset.arriving;
  }

  function begin(controls: CameraControlsImpl, next: Flight) {
    flight = next;
    handoffOut.current = 0;
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
    // Any settle is an end to travelling, however it was reached — a cold
    // mount, a reduced-motion cut, or a route change that overtook a flight.
    // Clearing it here rather than only on completion is what stops an
    // interrupted departure leaving the document permanently invisible.
    revealDocument();
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

  /**
   * The flight in. One place, because it can start from two triggers: the
   * landing page's click, before the route has changed (the hero has to still
   * be in the document for the hand-off), and the route itself, for every
   * other way of arriving — a work page, the browser's forward button.
   */
  function beginArrival(controls: CameraControlsImpl, delay: number) {
    begin(controls, {
      from: clonePose(standing.current),
      to: INSIDE_POSE,
      start: performance.now(),
      fovFrom: STANDING_FOV,
      fovTo: INSIDE_CAMERA_FOV,
      placementFrom: 0,
      placementTo: 1,
      path: "dive",
      duration: FLIGHT_DURATION_MS,
      ease: diveEase,
      delay,
      revealAt: 1,
      toHome: false,
    });
  }

  /**
   * **The landing page asked to leave.** Start the flight now, while the
   * hero is still mounted and dissolving into the plane; when the route
   * follows a fifth of a second later, the route effect below sees a flight
   * already bound for the graph and leaves it alone.
   */
  const arrivalRequest = useSceneStore((s) => s.arrivalRequest);
  useEffect(() => {
    if (arrivalRequest === 0) return;
    const controls = controlsRef.current;
    if (!controls || isNebula || lastRoute.current === true) return;
    const { reducedMotion } = useSceneStore.getState();
    if (reducedMotion) return;
    solveStanding(0, reducedMotion);
    lastRoute.current = true;
    // Held for the hand-off. The page dissolves into the plane over
    // HOME_HANDOFF_MS, and the two only match while the camera is at the
    // standing point: measured with the flight starting on the click, the
    // camera had covered seven units by the end of the dissolve and the plane
    // was 14% larger than the page fading out over it — a double image at
    // the one moment the swap is supposed to be invisible. So the picture
    // holds still while the page becomes the plane, then the flight goes.
    beginArrival(controls, HOME_HANDOFF_MS);
    // `isNebula` and `solveStanding` are read, not reacted to: this fires on
    // a request and nothing else.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrivalRequest]);
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const wasNebula = lastRoute.current;
    if (wasNebula === isNebula) return;
    lastRoute.current = isNebula;

    const { reducedMotion } = useSceneStore.getState();
    // Effects run before the next frame, so on a cold mount the standing pose
    // has not been solved yet. Solve it now; with nothing to spring from it
    // snaps straight to the composition.
    solveStanding(0, reducedMotion);
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
        const pose = focusPose(coldFocus, NEBULA_BASE_ROTATION);
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
      beginArrival(controls, 0);
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
      settle(controls, clonePose(standing.current), STANDING_FOV, {
        free: true,
        at: 0,
      });
      return;
    }
    begin(controls, {
      from: currentPose(controls),
      to: clonePose(standing.current),
      start: performance.now(),
      // Read off the camera rather than assumed to be the graph's. Leaving
      // from inside a node starts at FOCUS_CAMERA_FOV, not INSIDE_CAMERA_FOV,
      // and assuming the latter opened the departure by snapping 22 degrees
      // wider — which is what made this exit worth cutting rather than flying
      // in the first place.
      fovFrom: (controls.camera as THREE.PerspectiveCamera).fov,
      fovTo: STANDING_FOV,
      placementFrom: 1,
      placementTo: 0,
      duration: FLIGHT_DURATION_MS,
      // Only when there is a shell to close. Leaving the graph itself has no
      // second beat to wait for.
      delay: leavingNode ? SHELL_CLOSE_MS : 0,
      // From the centre, the dive in reverse: the same straight line the
      // reader came in on. From a node, the approach path — it measures from
      // the graph's centre too, so the retreat is monotonic, and it turns the
      // camera off the node's surface early, which a line from the middle has
      // no need to do.
      path: leavingNode ? "approach" : "dive",
      ease: leavingNode ? approachEase : diveEase,
      revealAt: isHome ? HOME_REVEAL_AT : ARRIVAL_REVEAL_AT,
      toHome: isHome,
    });
    // `settle` normally restores the clamps; a departure ends off /nebula,
    // where they must stay off (see applyDollyClamps).
    // `solveStanding` is listed because the effect calls it. Re-running when it
    // changes identity is harmless: the guard above returns immediately unless
    // the route actually crossed into or out of the graph.
  }, [isNebula, routeFocusId, solveStanding]);

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
      ? focusPose(routeFocusId, NEBULA_BASE_ROTATION)
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
      // Never a departure: there is no document to reveal and no home to
      // arrive at inside the graph.
      revealAt: 1,
      toHome: false,
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
  useFrame((_state, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;
    const dt = Math.min(delta, 1 / 20);
    solveStanding(dt, useSceneStore.getState().reducedMotion);

    const active = flight;
    if (!active) {
      // Standing somewhere the page composed. Written every frame because the
      // composition is live — parallax, the ambient ease, a hover on `/work`
      // re-centring the graph — and camera-controls is disabled here, so
      // nothing else will.
      // **Only once the route effect has caught up.** Between the commit
      // that changes the route and the effect that starts the departure
      // there is at least one frame, and under software GL several. Writing
      // the standing pose in that gap moved the camera to its destination
      // before the flight began, so the flight then started from where it
      // was meant to end and did nothing — the departure trace showed the
      // camera at 130 units on its first flying frame. The rig's own record
      // of the last route it handled is the gate: until it matches, the
      // camera stays wherever the graph left it.
      if (!isNebula && lastRoute.current === isNebula) {
        applyPose(controls, standing.current);
        applyFov(controls, STANDING_FOV);
      }
      solveHomePlane(controls.camera.position, null);
      return;
    }

    const t = flightProgress(active);
    const eased = (active.ease ?? flightEase)(t);
    if (active.placementTo === 0 && t >= active.revealAt) revealDocument();
    setPlacement(
      THREE.MathUtils.lerp(active.placementFrom, active.placementTo, eased),
    );
    let pose: CameraPose;
    let fovMix = eased;
    if (active.path === "dive") {
      const dive = divePose(active.from, active.to, eased);
      pose = dive;
      fovMix = dive.lens;
    } else if (active.path === "approach") {
      pose = approachLerpPose(active.from, active.to, eased);
    } else if (active.path === "shell") {
      pose = shellLerpPose(active.from, active.to, eased);
    } else {
      pose = lerpPose(active.from, active.to, eased);
    }

    applyPose(controls, pose);
    applyFov(controls, THREE.MathUtils.lerp(active.fovFrom, active.fovTo, fovMix));
    solveHomePlane(pose.position, active);

    if (t >= 1) {
      flight = null;
      if (active.toHome) handoffOut.current = performance.now();
      revealDocument();
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

  // Default priority, so it runs *after* camera-controls' own -1 update and
  // reports the pose that was actually rendered rather than the one the rig
  // asked for. Positive priority would disable r3f's automatic render.
  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    publishCameraProbe(
      controls.camera as THREE.PerspectiveCamera,
      flight !== null,
      scene,
    );
  });

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
      // The rig writes the real pose before the first render, so this is only
      // ever the value one frame could be composed against — but it was still
      // `HOME_CAMERA_POSITION`, nine units from a graph that has been life-size
      // at the origin since Part 3, which is *inside the shell*. The standing
      // lens and the landing distance, so the fallback is the composition
      // rather than a leftover of the projection it is written against.
      camera={{ position: [0, 0, LANDING_STANDING_DISTANCE], fov: STANDING_FOV }}
    >
      {/* Scene-level, and outside the constellation's group on purpose:
          `attach="fog"` writes to its parent's `fog` property, which on a
          group is a field nothing reads. */}
      <SceneEnvironment />
      {/* Home, as a thing in the world rather than a route you came from.
          On every route but the graph it sits behind the camera, so the gate
          is about not paying for it rather than about hiding it. */}
      <NebulaHome />
      <RouteFocus id={routeFocusId} />
      <CameraRig
        isNebula={isNebula}
        isHome={isHome}
        spotlightNodeId={spotlightNodeId}
        routeFocusId={routeFocusId}
      />
      <ConstellationOrientation spotlightNodeId={spotlightNodeId}>
        <Constellation
          isNebula={isNebula}
          isHome={isHome}
          spotlightNodeId={spotlightNodeId}
          gatherNodeId={routeSpotlight}
          onOpenNode={openNode}
        />
      </ConstellationOrientation>
    </Canvas>
  );
}
