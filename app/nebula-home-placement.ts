import * as THREE from "three";

/**
 * **Where the hero plane is, per frame** — the home-page stand-in's position,
 * size and presence, written by the camera rig and read by nebula-home.tsx.
 *
 * Module scope for the reason nebula-placement.ts is: the rig solves this
 * every frame from the standing pose and the measured hero column, and a
 * `set` on the store per frame would re-render every subscriber to move one
 * mesh. The rig writes at frame priority -2; the mesh reads at default
 * priority, so it is never a frame behind the camera.
 */
export interface HomePlane {
  position: THREE.Vector3;
  /** World-unit size of the plane. */
  width: number;
  height: number;
  /** 0..1. The rig fades this with the flight; 0 also means "do not draw". */
  opacity: number;
}

export const homePlane: HomePlane = {
  position: new THREE.Vector3(),
  width: 1,
  height: 1,
  opacity: 0,
};

/**
 * **Where the hero column is on screen right now**, in CSS px — its client
 * rect, pointer parallax and all.
 *
 * Kept apart from the store's `heroLayout` on purpose. The layout decides what
 * the plane's texture *contains* and changes on resize; this decides where the
 * plane *is* and changes every frame the landing page's parallax moves, which
 * during the return flight is the whole time. The rig reads it per frame and
 * nothing re-renders.
 *
 * Null until the landing page has been measured this session. The rig then
 * places the plane where a desktop hero would be, which is only ever seen on
 * a cold load of `/nebula` that then flies home.
 */
export interface HeroFrame {
  left: number;
  top: number;
  width: number;
  height: number;
}

let heroFrame: HeroFrame | null = null;

export function setHeroFrame(frame: HeroFrame | null) {
  heroFrame = frame;
}

export function getHeroFrame() {
  return heroFrame;
}

