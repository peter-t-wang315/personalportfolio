import * as THREE from "three";
import { RADIANS_PER_PX } from "./nebula-drag-state";

/**
 * **The outside turn: how a portrait phone has spun the globe on `/nebula`.**
 *
 * Standing outside the graph (lib/device-tier.ts, standsOutside) the camera
 * never leaves the flight axis. A drag turns the *globe* rather than orbiting
 * the camera round it, so that leaving is always the same straight pull back
 * along the axis the reader came in on, whatever they turned to look at.
 *
 * **One orientation, turned about the screen's own axes** — a trackball. It
 * was a yaw and a pitch with the pitch stopped at 88°, which had two faults.
 * Dragging down stopped dead a quarter-turn in ("when I try to continually
 * drag downwards it gets stopped at a certain point"). And because the pitch
 * sat under the yaw, once the globe had been turned side-on a vertical drag
 * rolled it in the plane of the screen instead of tipping it. Now every step
 * of a drag is a small rotation about screen-up and screen-right,
 * premultiplied onto the orientation: down always tips the near face down,
 * sideways always turns it, and nothing stops. The globe can end up upside
 * down, which is what not stopping means.
 *
 * Its own module rather than part of nebula-drag-state.ts, which the root
 * layout loads and is kept free of `three`; this is only ever loaded with the
 * scene. The quaternion is the orientation *as drawn*: a pose composed against
 * it is composed against what the reader sees this frame.
 */

const SCREEN_UP = new THREE.Vector3(0, 1, 0);
const SCREEN_RIGHT = new THREE.Vector3(1, 0, 0);

const turn = new THREE.Quaternion();
let dragging = false;

/**
 * A turn on a clock. Closing a node that has ended up round the back of the
 * globe turns it to the front *on the close flight's own schedule*, so the
 * globe and the camera land on the same frame; a spring was measured still
 * turning two seconds after the camera had stopped, which read as the graph
 * spinning on after the reader was back.
 */
interface OutsideGlide {
  from: THREE.Quaternion;
  to: THREE.Quaternion;
  /** The flight's clock: performance.now() at the start, a hold, a length. */
  start: number;
  delay: number;
  duration: number;
  ease: (t: number) => number;
}
let glide: OutsideGlide | null = null;

/**
 * **The drift after letting go.** Stopping dead the instant the finger lifted
 * felt unnatural: a ball flicked by hand keeps turning a little. So the drag
 * remembers its last moments and, on release, the globe carries on at the
 * speed it was going and decays to rest.
 *
 * Exponential decay, integrated exactly, so the distance it coasts is simply
 * release speed times COAST_SECONDS whatever the frame rate — a relaxed
 * 400px/s drag drifts about 27 degrees further, a slow one about 10, and the
 * cap keeps a hard flick to about a tenth of a turn. The first build (0.3s,
 * 3.5 rad/s, stepped per frame) carried a flick 70 degrees on, which is a
 * spin rather than "a little bit of continued drift". A finger that stops
 * before it lifts gets no drift at all: that is someone placing the globe,
 * not throwing it.
 *
 * Any press catches it (catchOutsideCoast), which is also what keeps a tapped
 * node's shell under the camera: the globe has stopped before the tap becomes
 * a click.
 */
const COAST_SECONDS = 0.2;
/** Only the last stretch of the drag says how fast it was going at release. */
const COAST_WINDOW_MS = 90;
/** Held still this long before lifting: placed, not flicked. */
const COAST_STALE_MS = 60;
const COAST_MAX_RADIANS_PER_S = 3;
/** Below this the drift is invisible, so it ends rather than creeping. */
const COAST_STOP_RADIANS_PER_S = 0.03;
/** Per pointer move: radians about screen-up and about screen-right. */
const dragSamples: { t: number; since: number; up: number; right: number }[] =
  [];
const coast = { up: 0, right: 0, active: false };

const _step = new THREE.Quaternion();
const _stepRight = new THREE.Quaternion();

/** Turn the globe by these angles about the screen's up and right axes. */
function turnBy(up: number, right: number) {
  _step
    .setFromAxisAngle(SCREEN_UP, up)
    .multiply(_stepRight.setFromAxisAngle(SCREEN_RIGHT, right));
  turn.premultiply(_step).normalize();
}

function noteDragSample(up: number, right: number) {
  const t = performance.now();
  const previous = dragSamples[dragSamples.length - 1];
  dragSamples.push({ t, since: previous ? previous.t : t - 1000 / 60, up, right });
  while (t - dragSamples[0].t > COAST_WINDOW_MS) dragSamples.shift();
}

/**
 * A drag moved by this many pixels. Right turns the near face right, down
 * tips it down — the same signs the yaw and pitch had.
 */
export function addOutsideDragDelta(dx: number, dy: number) {
  glide = null;
  const up = dx * RADIANS_PER_PX;
  const right = dy * RADIANS_PER_PX;
  turnBy(up, right);
  noteDragSample(up, right);
}

/** Let go: carry on at the drag's last speed, if it was still moving. */
export function flingOutsideTurn() {
  const last = dragSamples[dragSamples.length - 1];
  if (!last || performance.now() - last.t > COAST_STALE_MS) return;
  let up = 0;
  let right = 0;
  for (const sample of dragSamples) {
    up += sample.up;
    right += sample.right;
  }
  const seconds = Math.max((last.t - dragSamples[0].since) / 1000, 1 / 120);
  let vUp = up / seconds;
  let vRight = right / seconds;
  const speed = Math.hypot(vUp, vRight);
  if (speed < COAST_STOP_RADIANS_PER_S) return;
  if (speed > COAST_MAX_RADIANS_PER_S) {
    vUp *= COAST_MAX_RADIANS_PER_S / speed;
    vRight *= COAST_MAX_RADIANS_PER_S / speed;
  }
  coast.up = vUp;
  coast.right = vRight;
  coast.active = true;
}

/** A press lands: the drift stops where it is. */
export function catchOutsideCoast() {
  coast.active = false;
}

/** Put the globe at this orientation now. */
export function setOutsideTurn(orientation: THREE.Quaternion) {
  glide = null;
  coast.active = false;
  turn.copy(orientation).normalize();
}

/** Turn the globe to this orientation on the given flight clock. */
export function glideOutsideTurn(
  orientation: THREE.Quaternion,
  clock: Pick<OutsideGlide, "start" | "delay" | "duration" | "ease">,
) {
  coast.active = false;
  // Slerp takes the short way round on its own.
  glide = {
    from: turn.clone(),
    to: orientation.clone().normalize(),
    ...clock,
  };
}

export function setOutsideDragging(value: boolean) {
  if (value && !dragging) {
    dragSamples.length = 0;
    coast.active = false;
  }
  dragging = value;
}

export function isOutsideDragging() {
  return dragging;
}

/** The orientation as drawn this frame. Read it; do not write to it. */
export function getOutsideTurn(): THREE.Quaternion {
  return turn;
}

/**
 * Advance a close turn along its clock, or a drift along its decay. A live
 * drag or reduced motion finishes either at once: a glide jumps to where it
 * was going, a drift simply stops.
 */
export function stepOutsideTurn(dt: number, instant: boolean) {
  if (glide) {
    if (instant || dragging) {
      turn.copy(glide.to);
      glide = null;
    } else {
      const elapsed = performance.now() - glide.start - glide.delay;
      const t = Math.min(Math.max(elapsed, 0) / glide.duration, 1);
      turn.slerpQuaternions(glide.from, glide.to, glide.ease(t));
      if (t >= 1) glide = null;
      return;
    }
  }
  if (!coast.active) return;
  if (instant || dragging) {
    coast.active = false;
    return;
  }
  // The exact distance a velocity decaying at this rate covers in dt, so a
  // slow frame does not overshoot and the total is speed × COAST_SECONDS.
  const decay = Math.exp(-dt / COAST_SECONDS);
  const reach = COAST_SECONDS * (1 - decay);
  turnBy(coast.up * reach, coast.right * reach);
  coast.up *= decay;
  coast.right *= decay;
  if (Math.hypot(coast.up, coast.right) < COAST_STOP_RADIANS_PER_S) {
    coast.active = false;
  }
}

/**
 * Stop the turn exactly where it is drawn. Opening a node composes the
 * camera's pose against the globe as it stands at that instant, and the node
 * is part of the globe: a turn still gliding or drifting after that carries
 * the node — and the shell it opens into — out from under the parked camera.
 */
export function holdOutsideTurn() {
  glide = null;
  coast.active = false;
}

/** Forget the outside turn: the reader has left the graph. */
export function resetOutsideTurn() {
  glide = null;
  coast.active = false;
  dragSamples.length = 0;
  turn.identity();
  dragging = false;
}
