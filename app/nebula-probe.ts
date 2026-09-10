import type * as THREE from "three";
import { getClusterCircle } from "./nebula-drag-state";
import { homePlane } from "./nebula-home-placement";
import { jumpWash } from "./nebula-jump";
import { getPlacement } from "./nebula-placement";

/**
 * A read-only window onto the camera, for the scripts in `checks/`.
 *
 * Every claim in `07-continuous-space.md` about *where the camera is* — the
 * 0.00 degrees of heading change across the arrival, the 44/70/91% of the
 * departure spent at each quarter — was measured by instrumenting the rig by
 * hand and throwing the instrument away afterwards. `checks/README.md` says
 * "trace the camera instead; do not judge a transition from screencast
 * frames", and then offers no way to trace the camera: the r3f store is not
 * reachable from the page, and nothing in the scene is on `window`.
 *
 * So this is the hook those scripts were always assuming. It is deliberately
 * the smallest thing that answers the question — one assignment on mount, one
 * object written per frame the rig already runs, no allocation, no listeners.
 *
 * **Not gated on NODE_ENV.** The checks run against a production build, by
 * necessity: they measure a composition that only exists once the real bundle
 * has hydrated. A hook that vanished in production would be a hook that never
 * ran in the one build worth measuring.
 */
export interface CameraProbe {
  /** ms since the page loaded, on the same clock as a flight's own schedule. */
  t: number;
  /** World position and the unit heading, both in the scene's own space. */
  position: [number, number, number];
  heading: [number, number, number];
  /** Distance from the constellation's centre — the quantity a flight means. */
  distance: number;
  fov: number;
  /** 0 standing outside, 1 inside the graph; see nebula-placement.ts. */
  placement: number;
  flying: boolean;
  /** The hero plane, as the rig placed it this frame (nebula-home-placement.ts). */
  home: { position: [number, number, number]; width: number; height: number; opacity: number };
  /** The graph's on-screen circle, so a script can click it where the rig drew it. */
  cluster: { x: number; y: number; r: number; ready: boolean };
  /** The paper wash over the scene, 0..1 (nebula-jump.ts). */
  wash: number;
}

declare global {
  interface Window {
    __nebulaProbe?: CameraProbe;
    /** The live scene graph, for the same scripts. Read-only by convention. */
    __nebulaScene?: THREE.Scene;
  }
}

const HEADING: [number, number, number] = [0, 0, 0];
const POSITION: [number, number, number] = [0, 0, 0];
const HOME_POSITION: [number, number, number] = [0, 0, 0];
const probe: CameraProbe = {
  t: 0,
  position: POSITION,
  heading: HEADING,
  distance: 0,
  fov: 0,
  placement: 0,
  flying: false,
  home: { position: HOME_POSITION, width: 0, height: 0, opacity: 0 },
  cluster: { x: 0, y: 0, r: 0, ready: false },
  wash: 0,
};

/**
 * Called once per frame from the rig, after it has written the pose.
 *
 * Reads the camera object rather than the pose the rig applied, on purpose:
 * the thing worth measuring is what was actually rendered, and the gap between
 * those two is exactly the trap `checks/README.md` warns about
 * (camera-controls writes `camera.position` during its own update). By this
 * point in the frame it has.
 */
export function publishCameraProbe(
  camera: THREE.PerspectiveCamera,
  flying: boolean,
  scene?: THREE.Scene,
) {
  if (typeof window === "undefined") return;
  if (scene) window.__nebulaScene = scene;
  probe.t = performance.now();
  POSITION[0] = camera.position.x;
  POSITION[1] = camera.position.y;
  POSITION[2] = camera.position.z;
  // -z through the camera's own rotation: the direction it is looking.
  const e = camera.matrixWorld.elements;
  HEADING[0] = -e[8];
  HEADING[1] = -e[9];
  HEADING[2] = -e[10];
  probe.distance = camera.position.length();
  probe.fov = camera.fov;
  probe.placement = getPlacement();
  probe.flying = flying;
  HOME_POSITION[0] = homePlane.position.x;
  HOME_POSITION[1] = homePlane.position.y;
  HOME_POSITION[2] = homePlane.position.z;
  probe.home.width = homePlane.width;
  probe.home.height = homePlane.height;
  probe.home.opacity = homePlane.opacity;
  const circle = getClusterCircle();
  probe.cluster.x = circle.centerX;
  probe.cluster.y = circle.centerY;
  probe.cluster.r = circle.radiusPx;
  probe.cluster.ready = circle.ready;
  probe.wash = jumpWash.opacity;
  window.__nebulaProbe = probe;
}
