import * as THREE from "three";
import { cubicBezier } from "motion/react";
import { CONSTELLATION_BOUNDING_RADIUS, nodeGeometry } from "@/lib/node-geometry";
import { SURFACE_STANDOFF } from "@/lib/focus-framing";
import { getLivePosition } from "./nebula-simulation";

/**
 * Step 2.5's camera flight — the geometry and the timing, kept out of the
 * component that runs it so both are testable and neither is buried in a
 * frame loop. See docs/05a-phase-2-sequence.md.
 */

/**
 * The journey between the landing page and the graph, in ms.
 *
 * 01-design-system.md specified 1400, and it was 2000 through Part 3. It is
 * longer again because the journey is longer: it ends at the centre of the
 * shell rather than two units inside its wall, and the last stretch — through
 * the near nodes and into the middle of the room — is the part that was
 * missing when the flight read as "two steps over to the nebula". The camera
 * now covers 130 units, passes the hero on the way, and crosses the shell at
 * about three fifths of the way through; 2800 is what that takes at the pace
 * `diveEase` sets without the interior half becoming a crawl.
 */
export const FLIGHT_DURATION_MS = 2800;

/**
 * How long a move *within* the graph takes: opening a node, closing one, or
 * travelling sideways between two.
 *
 * Shorter than FLIGHT_DURATION_MS because it is a different kind of move. That
 * duration is specified for the journey between the landing page and the
 * graph — a long approach that is the site's signature moment and wants the
 * time it takes. A focus hop crosses a few units and barely turns, and at the
 * same 1400ms it read as sluggish rather than considered: the shell only
 * begins opening once the flight has landed, so opening a node cost 1400ms of
 * travel plus 240ms of opening, in series, before a word could be read.
 */
export const FOCUS_FLIGHT_DURATION_MS = 650;
export const flightEase = cubicBezier(0.32, 0.72, 0, 1);

/**
 * The curve for the journey between the landing page and the graph.
 *
 * The standard curve is right for a UI transition and wrong for travel. It
 * front-loads: measured against the real approach it covers 48% of the journey
 * in the first quarter of the time and then spends the second half creeping
 * through the last 18%. That long tail is what reads as a leisurely drift
 * toward the graph rather than a flight to it.
 *
 * This is close to linear with softened ends — 9%, 33%, 70%, 90%, 97% of the
 * approach at each tenth-quarter of the way through. The rate is roughly
 * constant, which is what sustained speed looks like: it leaves, it travels,
 * it arrives, rather than lunging and then floating.
 */
export const approachEase = cubicBezier(0.25, 0.15, 0.35, 0.85);

/**
 * The curve for the dive: the flight from the landing page to the centre of
 * the graph and back.
 *
 * Asked for in so many words — "ease in fast and ease back out as the camera
 * lands". A short lean into the launch, then sustained speed, then a long
 * settle into the middle of the room. It is applied to a distance that is
 * already spent geometrically (divePose), so "sustained speed" here means a
 * constant rate of apparent growth, which is what travel looks like, and the
 * settle is on top of that.
 */
export const diveEase = cubicBezier(0.3, 0, 0.15, 1);

/**
 * The constellation's **geometric** centre, which is the origin: content/
 * layout.ts builds every position from a Fibonacci sphere about it and
 * normalises onto a shell about it, so this is the centre of that sphere by
 * construction.
 *
 * It used to be the resting camera's target instead, on the reasoning that the
 * composition is framed about that point. That was defensible for a filled
 * ball and is wrong for a shell: the vector from here to a node is the
 * surface normal, and the approach wants to be along it. Radiating from a
 * point 3.5 units above the origin tilted every approach off-normal by up to
 * twenty degrees, and left this constant stale when the camera target moved
 * with the shrinking shell.
 */
export const CONSTELLATION_CENTER = new THREE.Vector3(0, 0, 0);


/**
 * A fallback direction for the degenerate case where a node sits exactly at
 * the constellation's centre and the approach vector has no direction to
 * normalise. Nothing in the current layout does, but a zero-length vector
 * would silently produce NaN camera coordinates rather than a visible bug.
 */
const FALLBACK_APPROACH = new THREE.Vector3(0, 0, 1);

export interface CameraPose {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

/**
 * The pose to fly to for a given node: stopped just short of its surface on
 * the **inner** side, looking outward at it.
 *
 * Inner, not outer, because `/nebula` is now a place you are inside. The
 * camera used to stop beyond the node, on the far side from the centre — which
 * was right while the graph was approached from outside, and became wrong the
 * moment the resting pose moved within the shell: opening a node punched the
 * camera out through the surface and left it hanging outside the globe, and
 * closing it pulled back in again. Approaching from the middle keeps the whole
 * interaction inside.
 *
 * It also frames better. From outside, the backdrop behind a focused node was
 * the entire rest of the constellation; from inside it is mostly open paper,
 * with that node's own neighbours around it — a calmer field for the interior
 * panel to sit on.
 *
 * Reads the node's **live** simulation position rather than its seeded layout
 * position — the constellation floats, so by the time anything is clicked the
 * two have diverged (02-architecture.md is explicit that they do). Falling
 * back to the layout position keeps this correct under reduced motion, where
 * the simulation never steps and live positions never exist.
 */
/**
 * @param baseRotation The graph's own orientation while the reader is inside
 * it. Node positions are stored in the graph's space, and the graph is turned
 * so that the arrival can be a straight line rather than a swing — so a node's
 * real position is its stored one carried through this. Passing it in rather
 * than importing it keeps this module free of the camera composition, which is
 * the reason it is a module of its own.
 */
export function focusPose(
  nodeId: string,
  baseRotation: THREE.Quaternion,
): CameraPose | null {
  const node = nodeGeometry[nodeId];
  if (!node) return null;

  const nodePosition = (
    getLivePosition(nodeId)?.clone() ?? new THREE.Vector3(...node.position)
  ).applyQuaternion(baseRotation);

  const approach = nodePosition.clone().sub(CONSTELLATION_CENTER);
  if (approach.lengthSq() < 1e-6) approach.copy(FALLBACK_APPROACH);
  approach.normalize();

  return {
    // Negative: back along the normal toward the middle, not out past the node.
    position: nodePosition
      .clone()
      .addScaledVector(approach, -(node.radius + SURFACE_STANDOFF)),
    target: nodePosition,
  };
}

const _slerpA = new THREE.Vector3();
const _slerpB = new THREE.Vector3();

/** Slerps a point about the origin, lerping its distance — an arc across the
 * shell rather than a chord through the middle of it. */
function slerpPoint(a: THREE.Vector3, b: THREE.Vector3, t: number): THREE.Vector3 {
  const ra = a.length();
  const rb = b.length();
  if (ra < 1e-6 || rb < 1e-6) return a.clone().lerp(b, t);
  _slerpA.copy(a).divideScalar(ra);
  _slerpB.copy(b).divideScalar(rb);
  const angle = Math.acos(THREE.MathUtils.clamp(_slerpA.dot(_slerpB), -1, 1));
  const sin = Math.sin(angle);
  if (sin < 1e-4) return a.clone().lerp(b, t);
  return _slerpA
    .clone()
    .multiplyScalar(Math.sin((1 - t) * angle) / sin)
    .addScaledVector(_slerpB, Math.sin(t * angle) / sin)
    .multiplyScalar(ra + (rb - ra) * t);
}

/**
 * Interpolation for travelling from one node to another without leaving the
 * shell — the flight that follows a link inside an open panel.
 *
 * Both endpoints sit just inside the surface, so a straight line between them
 * is a chord: it cuts through the hollow middle the layout exists to keep
 * empty, and arrives from the wrong side. Slerping instead sweeps the camera
 * around the inside of the shell along the great circle joining the two nodes
 * — which is the same path the edge between them takes, since edges are drawn
 * on the surface too. The trip reads as travelling along the connection,
 * because geometrically it is.
 */
export function shellLerpPose(from: CameraPose, to: CameraPose, t: number): CameraPose {
  return {
    position: slerpPoint(from.position, to.position, t),
    target: slerpPoint(from.target, to.target, t),
  };
}

/** Linear interpolation between two poses, for the flight's own easing to drive. */
export function lerpPose(from: CameraPose, to: CameraPose, t: number): CameraPose {
  return {
    position: from.position.clone().lerp(to.position, t),
    target: from.target.clone().lerp(to.target, t),
  };
}

/** Scratch vectors for approachLerpPose — it runs every frame of a flight. */
const _fromDir = new THREE.Vector3();
const _toDir = new THREE.Vector3();
const _lookFrom = new THREE.Vector3();
const _lookTo = new THREE.Vector3();

/**
 * **How the direction half of the journey is spent: by proximity, not by time.**
 *
 * The camera's distance from the graph and its direction *around* the graph are
 * two separate interpolations, and running both on the same clock is what made
 * the arrival read as off-centre. Measured at 1440x900, the constellation's
 * on-screen centroid climbed 206px in the first fifth of the flight and then
 * came back down — a vertical excursion 262px off the direct path between where
 * it starts and where it ends. It arrives in the right place; it takes a detour
 * to get there, and the detour is what you see.
 *
 * The cause is a mismatch of rates. Distance collapses fast and early — 47 of
 * the 131 units are gone in the first fifth — while a lateral offset's effect
 * on screen goes as `offset / (distance * tan(fov/2))`. So the same few degrees
 * of arc that are invisible at 131 units throw the graph across the frame at
 * 20. Spending the arc evenly in time spends most of it while it is still
 * cheap to see, and none of it when it matters.
 *
 * So the arc is spent as a function of **distance alone**: `d^-3`, normalised
 * over the journey. One expression, and it is automatically right in both
 * directions — going in, `d^-3` barely moves until the camera is close, so the
 * graph grows in place and only swings as the shell arrives; coming out, the
 * same function front-loads, so the camera slides to its heading while it is
 * still inside and then simply recedes. "Do the turning while you are close to
 * the thing you are turning around" is the rule, and distance is the only
 * quantity that has to be consulted to obey it.
 *
 * That symmetry is the reason to prefer it over tuning the two journeys apart.
 * Measured against the same centroid excursion, weighting by eased time gives
 * 262px in and 270px out; weighting by proximity gives 56px in and 58px out.
 * The two directions land within two pixels of each other at every exponent
 * tried, which is what a rule looks like as opposed to a pair of fixes.
 *
 * The exponent itself is fitted rather than derived: 1 gives 162px, 2 gives 84,
 * 3 gives 56, 4 gives 39. It is 3 because 4 buys 17px at the cost of finishing
 * the whole arc inside the last tenth of the approach, and an arc that
 * completes in 200ms is a flick rather than a move. Re-measure with
 * `checks/flightpath.mjs` before changing it.
 */
const DIRECTION_PROXIMITY_POWER = 3;

/**
 * Where the direction interpolation has got to, given how far out the camera
 * currently is. 0 at the start of the journey, 1 at the end.
 */
function directionProgress(
  distance: number,
  fromLen: number,
  toLen: number,
  fallback: number,
) {
  const h = (d: number) => Math.pow(d, -DIRECTION_PROXIMITY_POWER);
  const h0 = h(fromLen);
  const h1 = h(toLen);
  // A journey that does not change distance has no proximity to spend the arc
  // against. Nothing in the product does this, but a division by zero here
  // would be a camera at NaN, which renders as a blank canvas and no error.
  if (!Number.isFinite(h0) || !Number.isFinite(h1) || Math.abs(h1 - h0) < 1e-12) {
    return fallback;
  }
  return THREE.MathUtils.clamp((h(distance) - h0) / (h1 - h0), 0, 1);
}

/**
 * Interpolation for the journey between the landing page and the graph.
 *
 * Everything here is measured from the **graph's centre**, which is the only
 * quantity that means anything on this flight: how far the reader is from the
 * thing they are flying to or away from. The pose's own target is not that. A
 * camera parked inside the graph has its target a tenth of a unit ahead of it,
 * because that is what makes a drag look around rather than orbit — so a path
 * that interpolated distance-from-target ran the departure from 0.1 to 84,
 * which put the camera still 2.9 units out at half time and then threw it to
 * the landing pose in the last few frames. It read as nothing happening and
 * then a snap.
 *
 * Distance from the centre is interpolated **geometrically**. Apparent size
 * goes as 1/d, so equal steps of distance are wildly unequal steps of what the
 * reader sees: over an 84-to-3 approach the first half of the distance buys
 * almost no change and the last tenth buys most of it. A constant ratio per
 * unit time is a constant apparent rate, which is what sustained travel looks
 * like — and it is monotonic by construction, so the graph only ever grows on
 * the way in and only ever shrinks on the way out.
 *
 * Direction and heading are slerped separately from the distance, and on a
 * different clock: both are spent against **proximity** rather than time, so
 * the arc happens while the camera is close enough for it to be the move it
 * looks like. See DIRECTION_PROXIMITY_POWER for what that fixes and how it was
 * measured. On the arrival the heading is already constant — the graph turns
 * instead of the camera (nebula-canvas.tsx) — so that term does nothing and the
 * flight is a straight run. Leaving a node it carries the turn off the node's
 * surface.
 */
export function approachLerpPose(
  from: CameraPose,
  to: CameraPose,
  t: number,
): CameraPose {
  const fromLen = from.position.length();
  const toLen = to.position.length();
  const distance =
    fromLen > 1e-3 && toLen > 1e-3
      ? fromLen * Math.pow(toLen / fromLen, t)
      : THREE.MathUtils.lerp(fromLen, toLen, t);

  // Distance is spent in time; direction is spent in proximity. See
  // DIRECTION_PROXIMITY_POWER — this split is the whole of it.
  const dirT = directionProgress(distance, fromLen, toLen, t);

  // Where the camera sits around the graph.
  _fromDir.copy(from.position);
  _toDir.copy(to.position);
  const position =
    fromLen > 1e-3 && toLen > 1e-3
      ? slerpDirection(_fromDir.divideScalar(fromLen), _toDir.divideScalar(toLen), dirT)
          .multiplyScalar(distance)
      : from.position.clone().lerp(to.position, t);

  // Where it points, and how far ahead its pivot sits — the second only so
  // camera-controls has a sane radius to hand over to on arrival. The heading
  // is a direction too, so it goes on the same clock: leaving an open node, the
  // camera turns off the node's surface while it is still against it rather
  // than halfway back to the landing page.
  _lookFrom.copy(from.target).sub(from.position);
  _lookTo.copy(to.target).sub(to.position);
  const lookLen = THREE.MathUtils.lerp(_lookFrom.length(), _lookTo.length(), t);
  const heading = slerpDirection(
    _lookFrom.normalize(),
    _lookTo.normalize(),
    dirT,
  );

  return {
    position,
    target: position.clone().addScaledVector(heading, lookLen),
  };
}

/**
 * **The dive: the flight between a standing point outside the graph and the
 * centre of it**, in either direction. Part 4 of `07-continuous-space.md`.
 *
 * What it is asked to be: a straight run. The camera holds one heading for
 * the whole journey — the graph turns to meet it (NEBULA_BASE_ROTATION) — and
 * arrives at the exact centre of the shell, so what the reader sees on landing
 * is nodes on every side, at one distance, like being in the middle of a
 * hollow cloud. `approachLerpPose` cannot end there: it measures distance
 * geometrically from the centre and a geometric schedule never reaches zero.
 *
 * Three things are spent against three different clocks, and each is a
 * function of **distance from the centre** so that one rule serves both
 * directions.
 *
 * **Distance is geometric against the far wall.** Apparent size goes as
 * `1 / d`, and from inside the graph the thing whose size the eye measures is
 * the far side of the shell — `r + R` away, never zero. So `r + R` decays at a
 * constant ratio per unit of eased time: the wall grows at a steady rate all
 * the way in, and the schedule reaches the centre. The shell itself is
 * crossed at about 73% of the eased progress, which leaves the last quarter
 * for the interior — the wall doubling from 22 units to 11, which is the part
 * of the journey the old pose skipped and the part that makes it a room.
 *
 * **The lateral glide is spent while far.** The landing camera stands off
 * the axis so the graph sits beside the hero; the centre is on the axis. The
 * slide between them is spent over the outer 70% of the distance, so the
 * graph drifts to the middle of the frame while it is still small and then
 * the run in is dead straight. The reverse holds going out: the graph recedes
 * straight, then settles beside the hero as the camera settles.
 * `approachLerpPose` found the opposite rule for its swing — do the turning
 * while close — but that was a *turn around* the graph, and a glide across
 * the frame is not one: spent early it is an aim, spent late it is a lurch.
 *
 * **The lens widens over the inner 45%.** 30 degrees standing, 72 inside.
 * Widening shrinks everything, so wherever it happens it eats into the sense
 * of approach — a dolly zoom — and the place to spend it is where the near
 * nodes are streaming past and the widening reads as the room opening up
 * around the reader rather than the wall pulling away. Measured against the
 * far wall, the growth never reverses: the slowest stretch is 1.03x per
 * 100ms, at the crossing.
 */
export interface DivePose extends CameraPose {
  /** Distance from the graph's centre. */
  r: number;
  /** The outer endpoint's distance. */
  outer: number;
  /** How far the lens has gone from `from`'s field of view to `to`'s, 0..1. */
  lens: number;
}

const DIVE_SHELL = CONSTELLATION_BOUNDING_RADIUS;
/** The glide is finished once `r` is inside this fraction of the outer distance. */
const DIVE_GLIDE_INNER = 0.3;
/** The lens widens over this innermost fraction of the outer distance. */
const DIVE_LENS_OUTER = 0.45;

function smoothstep(u: number) {
  const x = THREE.MathUtils.clamp(u, 0, 1);
  return x * x * (3 - 2 * x);
}

/** Geometric interpolation of `r + R` between the two endpoints. */
export function diveDistance(rFrom: number, rTo: number, s: number) {
  const a = rFrom + DIVE_SHELL;
  const b = rTo + DIVE_SHELL;
  return a * Math.pow(b / a, s) - DIVE_SHELL;
}

const _diveDirA = new THREE.Vector3();
const _diveDirB = new THREE.Vector3();
const _diveHeadA = new THREE.Vector3();
const _diveHeadB = new THREE.Vector3();

export function divePose(from: CameraPose, to: CameraPose, s: number): DivePose {
  const rA = from.position.length();
  const rB = to.position.length();
  const outer = Math.max(rA, rB, 1e-3);
  const innerIsTo = rB < rA;
  const r = diveDistance(rA, rB, s);

  _diveHeadA.copy(from.target).sub(from.position).normalize();
  _diveHeadB.copy(to.target).sub(to.position).normalize();
  // Where each endpoint sits around the graph. A pose at the centre has no
  // direction of its own, so it takes the one it is looking along, reversed:
  // the camera reaches the centre by flying in along its own heading.
  if (rA > 1e-3) _diveDirA.copy(from.position).divideScalar(rA);
  else _diveDirA.copy(_diveHeadA).negate();
  if (rB > 1e-3) _diveDirB.copy(to.position).divideScalar(rB);
  else _diveDirB.copy(_diveHeadB).negate();

  // 1 at the outer end, 0 once inside the glide band.
  const far = smoothstep((r / outer - DIVE_GLIDE_INNER) / (1 - DIVE_GLIDE_INNER));
  const w = innerIsTo ? 1 - far : far;
  const position = slerpDirection(_diveDirA, _diveDirB, w).multiplyScalar(r);

  const heading = slerpDirection(_diveHeadA, _diveHeadB, w);
  const lookLen = THREE.MathUtils.lerp(
    from.target.distanceTo(from.position),
    to.target.distanceTo(to.position),
    s,
  );

  const insideLens = 1 - smoothstep(r / (outer * DIVE_LENS_OUTER));
  const lens = innerIsTo ? insideLens : 1 - insideLens;

  return {
    position,
    target: position.clone().addScaledVector(heading, lookLen),
    r,
    outer,
    lens,
  };
}

/**
 * **Where the camera looks on the way out: at the page it is flying to.**
 *
 * The arrival holds one heading because the graph turns to meet it. The
 * departure cannot be its mirror — backing out of the graph facing the graph
 * reads as being reeled in on a string, and what was asked for is "flying
 * directly out of the nebula straight towards the hero page, and then the
 * camera rotates at the end to get us centred on the home page again". A
 * first version faced straight down +z and flew through empty paper: the page
 * is off the axis, so it slid out of the side of the frame a third of the way
 * home. So the camera *aims at the page*, and everything below is against
 * distance from the centre like the rest of the flight:
 *
 * - **Turn to face the page** over the first TURN_OUT_BY of the distance,
 *   which is still inside the shell: the reader turns round in the middle of
 *   the cloud and flies out through the wall looking at where they are going.
 *   The short way round from wherever a drag left the heading; from dead
 *   ahead, which is opposite the page, toward the page's own side.
 * - **Track it.** The page sits centred and grows, drifting to one side as
 *   the camera glides off the axis toward its standing point.
 * - **Settle onto the landing heading** from TURN_BACK_FROM, blending out of
 *   the tracked aim toward straight ahead, continuing the same way round —
 *   so the page sweeps from beside the camera to its place on the left of
 *   the frame as the graph comes in on the right, and the camera arrives
 *   looking past the hero at the graph it just left.
 *
 * Yaw and pitch rather than a slerp, because the headings at the two ends are
 * exactly opposite each other and a slerp between opposites has no plane to
 * turn in. Yaw is kept on [0, 2π) with the landing heading at 0 and 2π, so
 * tracking the page as it passes from ahead to beside to behind is one
 * increasing angle rather than a wrap.
 */
const TURN_OUT_BY = 0.12;
const TURN_BACK_FROM = 0.5;
const TWO_PI = Math.PI * 2;

/** Yaw about +y with −z at 0, on [0, 2π). */
function yawOf(x: number, z: number) {
  const yaw = Math.atan2(x, -z);
  return yaw < 0 ? yaw + TWO_PI : yaw;
}

export function departureHeading(
  fromHeading: THREE.Vector3,
  /** From the camera to the hero plane, world units. */
  toPage: THREE.Vector3,
  r: number,
  outer: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  const yaw0 = yawOf(fromHeading.x, fromHeading.z);
  const pitch0 = Math.asin(THREE.MathUtils.clamp(fromHeading.y, -1, 1));
  const pageLen = Math.max(toPage.length(), 1e-6);
  const yawPage = yawOf(toPage.x, toPage.z);
  const pitchPage = Math.asin(THREE.MathUtils.clamp(toPage.y / pageLen, -1, 1));

  // The first turn takes the short way; a dead tie goes the page's way, which
  // is also the way the final settle continues.
  let delta = yawPage - yaw0;
  if (delta > Math.PI) delta -= TWO_PI;
  if (delta < -Math.PI) delta += TWO_PI;
  if (Math.abs(Math.abs(delta) - Math.PI) < 1e-6) delta = Math.PI;

  const u1 = smoothstep(r / (outer * TURN_OUT_BY));
  const u2 = smoothstep((r / outer - TURN_BACK_FROM) / (1 - TURN_BACK_FROM));

  const tracked = yaw0 + delta * u1;
  // Continue increasing to the next multiple of 2π: the landing heading,
  // reached the same way round the page is being passed.
  const remaining = ((TWO_PI - (tracked % TWO_PI)) % TWO_PI);
  const yaw = tracked + remaining * u2;
  const pitch = pitch0 * (1 - u1) + pitchPage * u1 * (1 - u2);
  return out.set(
    Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    -Math.cos(yaw) * Math.cos(pitch),
  );
}

/** Slerps between two unit vectors, falling back to a lerp when parallel. */
function slerpDirection(a: THREE.Vector3, b: THREE.Vector3, t: number) {
  const dot = THREE.MathUtils.clamp(a.dot(b), -1, 1);
  const angle = Math.acos(dot);
  if (angle < 1e-4) return a.clone();
  const sin = Math.sin(angle);
  return a
    .clone()
    .multiplyScalar(Math.sin((1 - t) * angle) / sin)
    .addScaledVector(b, Math.sin(t * angle) / sin)
    .normalize();
}
