import * as THREE from "three";
import { palette } from "@/lib/palette";

/**
 * **What the node shells see through themselves** — the shared state between
 * the backdrop pass (nebula-glass-backdrop.tsx) and the node material
 * (fresnel-material.ts).
 *
 * Module scope for the reason nebula-home-placement.ts is: this is written
 * once per frame and read by 51 materials, and a store `set` would re-render
 * every subscriber to move one texture reference.
 *
 * Part 6 of `07-continuous-space.md`. 2.5 removed transmission from every
 * tier because the canvas is `alpha: true` over a CSS `--paper` background:
 * there was nothing *in the scene* behind the glass, so a transmissive shell
 * transmitted the void and rendered white. Now the home page is an object in
 * the world, so there is. The backdrop pass draws that world — the hero
 * plane, the edges, everything but the shells themselves — into a target
 * cleared to `--paper`, and the shells sample it displaced by their own
 * normal. Paper in the target is what makes white impossible: where nothing
 * is behind a node, what it refracts is the same colour the page already is.
 *
 * Deliberately **not** `MeshPhysicalMaterial`'s `transmission`, nor drei's
 * `MeshTransmissionMaterial`. Both cost a render pass *per transmissive
 * mesh* — the performance budget's standing cap of two such meshes — and
 * both would replace the fresnel shader, which is where the rim, the
 * breathing, the `uOpen` morph and the scroll thumb live. One pass for all
 * 51 shells, and the material keeps everything it already does.
 */

/**
 * The group holding the node shells, set by the constellation.
 *
 * The backdrop pass hides it for the duration of its render. A group rather
 * than a layer because r3f's raycaster carries its own layer mask: putting
 * the shells on a layer the backdrop camera skips would also, silently, take
 * them off the pointer path.
 */
export const glassShells: { group: THREE.Group | null } = { group: null };

/**
 * A single paper pixel, so the sampler is always bound to something real.
 * Sampling an unbound `sampler2D` is undefined behaviour and on some drivers
 * a black frame; this way a shell that draws before the first pass — or on a
 * tier that never runs one — reads exactly the paper it would have shown.
 */
function paperPixel() {
  const paper = new THREE.Color(palette.paper);
  const data = new Uint8Array([
    Math.round(paper.r * 255),
    Math.round(paper.g * 255),
    Math.round(paper.b * 255),
    255,
  ]);
  const texture = new THREE.DataTexture(data, 1, 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/** The backdrop the shells sample. Swapped to the pass's target once it runs. */
export const glassBackdrop: { value: THREE.Texture } = { value: paperPixel() };

/**
 * How far the glass displaces what is behind it, as a fraction of the frame's
 * *height* (the lens is vertical, so is this — see `uAspect` in the shader,
 * which keeps the offset the same number of pixels in both axes).
 *
 * 0.03 is 27px at 900 tall, at the silhouette; the shader weights it by the
 * same rim term the alpha uses, so the middle of a node's face is displaced
 * by almost nothing and the page reads through it as itself. Swept at 0,
 * 0.008, 0.016, 0.03 and 0.05 against the headline seen from the centre: the
 * first two are hard to see at all, and past 0.03 the sample at the edge is
 * coming from so far away that it stops being related to what is behind the
 * node.
 */
export const GLASS_REFRACT = 0.03;

/**
 * How much of the rim is the refracted page rather than the node's own
 * `--mask`. The shell stays a shell: the face is left alone entirely (the
 * fresnel term is near zero there and the straight-through view is doing the
 * work), and the edge — the one place a real lens gathers what is behind it —
 * trades just over half its colour for the bend.
 */
export const GLASS_MIX = 0.55;

/**
 * The target is half the drawing buffer in each axis. It is sampled only
 * through a smear at a rim; a quarter of the pixels is invisible in the
 * result and is a quarter of the fill cost of the extra pass.
 */
export const GLASS_RESOLUTION_SCALE = 0.5;

/** Strength, per frame. 0 is "no backdrop" and costs the shader one branch. */
export const glassRefract: { value: number } = { value: 0 };
export const glassMix: { value: number } = { value: GLASS_MIX };
/** Frame width over height, so a uv offset is the same pixel count in x as y. */
export const glassAspect: { value: number } = { value: 1 };

/** What the probe reports, for `checks/glass.mjs`. */
export const glassState = { active: false, width: 0, height: 0 };

/**
 * A lever for the checks, on `window.__nebulaGlass`: set `refract` to a
 * number and the pass uses it instead of `GLASS_REFRACT`, null to go back.
 *
 * It exists because the only honest way to answer "is home visibly bent" is
 * two frames of the same standing point with the bend on and off, and the
 * scene has no other way to be told. Ungated for the same reason
 * nebula-probe.ts is: the checks run against a production build.
 */
export const glassOverride: { refract: number | null } = { refract: null };

declare global {
  interface Window {
    __nebulaGlass?: typeof glassOverride;
  }
}
