/**
 * The handshake between the pointer and the globe, for the routes where the
 * globe is a backdrop rather than the whole screen.
 *
 * Module state, not the zustand store, for the same reason nebula-placement.ts
 * is: both sides touch this every frame or every pointer event, and a store
 * write is a re-render. Nothing here renders.
 *
 * **Deliberately free of `three`.** The DOM half of this is mounted by the
 * root layout on every route, and the renderer is loaded behind a
 * `ssr: false` dynamic import precisely so it is not in that bundle. So the
 * drag is carried as two angles and turned into a rotation on the scene side,
 * where three already is.
 */

/** Where the globe is actually drawn, in viewport pixels. */
let circle = { centerX: 0, centerY: 0, radiusPx: 0, ready: false };

/**
 * Published every frame from the scene, because the scene is the only thing
 * that knows: the drawn position is the landing solve plus parallax plus the
 * work page's centring offset, and its size is that solve's scale times the
 * spotlight zoom. lib/use-cluster-screen.ts re-derives an approximation of
 * this for the landing overlays and is wrong by both of those terms anywhere
 * a project is spotlit, which is exactly where dragging matters most.
 */
export function setClusterCircle(
  centerX: number,
  centerY: number,
  radiusPx: number,
) {
  circle = { centerX, centerY, radiusPx, ready: true };
}

/** The circle as last published, for app/nebula-probe.ts. */
export function getClusterCircle() {
  return circle;
}

/** Is this viewport point on the globe? */
export function pointOnCluster(x: number, y: number) {
  if (!circle.ready) return false;
  return Math.hypot(x - circle.centerX, y - circle.centerY) <= circle.radiusPx;
}

/**
 * Where a drag may not begin.
 *
 * Controls, obviously — but prose too, and that is the important half. The
 * landing page's affordance gave up being an element precisely so the hero
 * headline stayed selectable underneath it; a drag that started on a sentence
 * would take that back, since spinning the globe and selecting a line are the
 * same gesture. Over text the text wins, and the cursor says so by not
 * changing.
 */
const NON_DRAGGABLE_SELECTOR =
  "a, button, input, textarea, select, summary, label, [role='button']," +
  " [contenteditable], p, h1, h2, h3, h4, li, blockquote, figcaption, code, pre";

/** Would a drag beginning on this element be allowed to move the globe? */
export function canDragFrom(target: EventTarget | null) {
  const el = target as Element | null;
  if (!el || typeof el.closest !== "function") return true;
  return !el.closest(NON_DRAGGABLE_SELECTOR);
}

/**
 * How far the reader has spun the globe, in radians: yaw about the screen's
 * vertical axis, pitch about its horizontal one.
 */
let yaw = 0;
let pitch = 0;
let dragging = false;

/**
 * Pitch stops short of the poles. There is no fixed up axis on a sphere of
 * nodes, so nothing breaks past 90 degrees — it just stops being legible,
 * because the layout's own vertical ordering inverts and the cluster you were
 * reading is suddenly upside down.
 */
const MAX_PITCH = (80 * Math.PI) / 180;
/** Radians per pixel dragged. A 300px sweep turns the globe about 100 degrees. */
const RADIANS_PER_PX = 0.006;

export function addDragDelta(dx: number, dy: number) {
  yaw += dx * RADIANS_PER_PX;
  pitch = Math.max(
    -MAX_PITCH,
    Math.min(MAX_PITCH, pitch + dy * RADIANS_PER_PX),
  );
}

export function getDragAngles() {
  return { yaw, pitch };
}

export function isDragging() {
  return dragging;
}

export function setDragging(value: boolean) {
  dragging = value;
}

/**
 * **The outside turn: how a portrait phone has spun the globe on `/nebula`.**
 *
 * Standing outside the graph (lib/device-tier.ts, standsOutside) the camera
 * never leaves the flight axis. A drag turns the *globe*, exactly as the
 * landing page's does, rather than orbiting the camera round it — so that
 * leaving is always the same straight pull back along the axis the reader
 * came in on, whatever they turned to look at. Orbiting the camera made the
 * departure a swing from wherever the drag had left it round to the standing
 * point, which read as anything but straight back.
 *
 * Separate from the landing spin above because the two live at opposite
 * ends of a flight: the landing spin is what the globe shows at placement 0
 * and unwinds on the way in; this is what it shows at placement 1 and
 * unwinds on the way out. One pair of angles could not be both.
 *
 * Two values, not one. `target` is where the turn is asked to be; `current`
 * is where it is, and follows the target through a spring except under a
 * live drag, where it tracks exactly. The spring is for the one case the
 * turn is set by code rather than by a finger: closing a node turns the
 * globe so that node faces the camera, and that has to be a motion.
 */
const outsideTarget = { yaw: 0, pitch: 0 };
const outsideCurrent = { yaw: 0, pitch: 0 };
const outsideVelocity = { yaw: 0, pitch: 0 };
let outsideDragging = false;
/** A little past the landing drag's stop, so a node near a pole can be faced. */
const MAX_OUTSIDE_PITCH = (88 * Math.PI) / 180;
/** Matches the spotlight turn's tempo in nebula-canvas.tsx. */
const OUTSIDE_TURN_SECONDS = 0.85;

export function addOutsideDragDelta(dx: number, dy: number) {
  outsideTarget.yaw += dx * RADIANS_PER_PX;
  outsideTarget.pitch = Math.max(
    -MAX_OUTSIDE_PITCH,
    Math.min(MAX_OUTSIDE_PITCH, outsideTarget.pitch + dy * RADIANS_PER_PX),
  );
}

/** Aim the turn, to be reached through the spring. */
export function setOutsideTurn(yaw: number, pitch: number) {
  outsideTarget.yaw = yaw;
  outsideTarget.pitch = Math.max(
    -MAX_OUTSIDE_PITCH,
    Math.min(MAX_OUTSIDE_PITCH, pitch),
  );
}

export function setOutsideDragging(value: boolean) {
  outsideDragging = value;
}

export function isOutsideDragging() {
  return outsideDragging;
}

/** Where the turn actually is this frame. */
export function getOutsideTurn() {
  return outsideCurrent;
}

function shortestArc(delta: number) {
  const tau = Math.PI * 2;
  return delta - tau * Math.round(delta / tau);
}

/**
 * Advance `current` toward `target`. Critically damped, on the same clock
 * the spotlight turn uses, so a node closing from outside settles into the
 * middle of the frame at the tempo the reader already knows. Yaw takes the
 * short way round: a facing set by code can be on the far side of ±π from
 * wherever a drag left the globe.
 */
export function stepOutsideTurn(dt: number, instant: boolean) {
  if (instant || outsideDragging) {
    outsideCurrent.yaw = outsideTarget.yaw;
    outsideCurrent.pitch = outsideTarget.pitch;
    outsideVelocity.yaw = 0;
    outsideVelocity.pitch = 0;
    return;
  }
  const omega = 2 / OUTSIDE_TURN_SECONDS;
  const x = omega * dt;
  const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  for (const axis of ["yaw", "pitch"] as const) {
    let delta = outsideCurrent[axis] - outsideTarget[axis];
    if (axis === "yaw") delta = shortestArc(delta);
    const v = outsideVelocity[axis];
    const temp = (v + omega * delta) * dt;
    outsideVelocity[axis] = (v - omega * temp) * decay;
    const next = (delta + temp) * decay;
    outsideCurrent[axis] = outsideTarget[axis] + next;
  }
}

/** Forget the outside turn: the reader has left the graph. */
export function resetOutsideTurn() {
  outsideTarget.yaw = 0;
  outsideTarget.pitch = 0;
  outsideCurrent.yaw = 0;
  outsideCurrent.pitch = 0;
  outsideVelocity.yaw = 0;
  outsideVelocity.pitch = 0;
  outsideDragging = false;
}

/**
 * Forget the spin. Called when the route changes and when the globe is aimed
 * at a different project: both are the reader asking for a particular view,
 * and honouring that means starting from the orientation that view specifies
 * rather than from wherever they last left the sphere.
 */
export function resetDrag() {
  yaw = 0;
  pitch = 0;
  dragging = false;
}
