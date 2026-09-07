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
