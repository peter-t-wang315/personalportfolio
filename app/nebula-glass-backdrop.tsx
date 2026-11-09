"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useSceneStore } from "@/lib/scene-store";
import { useDeviceTier } from "@/lib/device-tier";
import { palette } from "@/lib/palette";
import {
  GLASS_REFRACT,
  GLASS_RESOLUTION_SCALE,
  glassAspect,
  glassBackdrop,
  glassOverride,
  glassRefract,
  glassShells,
  glassState,
} from "./nebula-glass";

/**
 * **The pass that gives the glass something to bend.**
 *
 * Once a frame, before the frame that is seen: the whole scene minus the node
 * shells, into a half-resolution target cleared to `--paper`. The shells then
 * sample it displaced by their own normals (fresnel-material.ts), so a node
 * standing in front of the home page gathers the page at its edge.
 *
 * **It must run last.** r3f runs every `useFrame` subscriber in priority
 * order and then renders, so a pass that renders the scene itself has to be
 * the final subscriber or it draws a backdrop one frame behind the thing it
 * is a backdrop for — visible during a flight, where the hero plane crosses
 * the frame. Priority stays 0 and the element is the last child of the
 * canvas: same priority sorts by subscription order, and effects run
 * children-first, so the rig (-2), the simulation, the edges and the hero
 * plane have all written this frame's state by the time this is called. A
 * positive priority would have been the obvious way to say "last" and is the
 * one thing that cannot be used: in r3f any subscriber above 0 takes over the
 * render loop and the canvas stops drawing itself.
 *
 * **Desktop only**, per the tier table, and only where the graph is: the
 * shells are a handful of pixels across on the landing page, where there is
 * no bend to see and the pass would be a second render of the scene for it.
 * Off, the uniform is 0 and the shader skips the sample entirely — the
 * material on a phone is the material as it was before Part 6.
 */

/** 1024px+, per 02-architecture.md's Responsive tiers table. */
export function GlassBackdrop({ isNebula }: { isNebula: boolean }) {
  const { gl, scene, camera } = useThree();
  const tier = useDeviceTier();
  const flying = useSceneStore((s) => s.flying);
  // The graph's own routes, plus the flights to and from them — the same
  // gate the edges use, and for the same reason: the departure is still the
  // graph until it lands.
  const active = tier === "desktop" && (isNebula || flying);

  const target = useMemo(() => {
    const rt = new THREE.WebGLRenderTarget(1, 1, {
      depthBuffer: true,
      stencilBuffer: false,
    });
    // sRGB, so the sampled value linearises on its way into the shader the
    // way every other texture in the scene does. Left linear, the page came
    // through the glass visibly darker than the page beside it.
    rt.texture.colorSpace = THREE.SRGBColorSpace;
    rt.texture.minFilter = THREE.LinearFilter;
    rt.texture.magFilter = THREE.LinearFilter;
    rt.texture.generateMipmaps = false;
    return rt;
  }, []);

  useEffect(() => () => target.dispose(), [target]);

  useEffect(() => {
    window.__nebulaGlass = glassOverride;
  }, []);

  const paper = useMemo(() => new THREE.Color(palette.paper), []);
  const previousClear = useMemo(() => new THREE.Color(), []);
  const drawingBuffer = useMemo(() => new THREE.Vector2(), []);

  useEffect(() => {
    if (active) return;
    // Leaving the route, or crossing down a tier mid-flight.
    glassRefract.value = 0;
    glassState.active = false;
  }, [active]);

  useFrame(() => {
    // Zero strength skips the pass, not just the sample: the shader reads
    // nothing at 0, so rendering a backdrop for it would be a second render
    // of the scene for a texture no fragment touches. It is also what lets a
    // check measure the cost of the whole thing by setting one number.
    const strength = glassOverride.refract ?? GLASS_REFRACT;
    if (!active || strength <= 0) {
      glassRefract.value = 0;
      glassState.active = false;
      return;
    }

    gl.getDrawingBufferSize(drawingBuffer);
    const width = Math.max(
      1,
      Math.round(drawingBuffer.x * GLASS_RESOLUTION_SCALE),
    );
    const height = Math.max(
      1,
      Math.round(drawingBuffer.y * GLASS_RESOLUTION_SCALE),
    );
    if (target.width !== width || target.height !== height) {
      target.setSize(width, height);
    }
    glassAspect.value = width / height;

    const shells = glassShells.group;
    const wasVisible = shells?.visible ?? false;
    if (shells) shells.visible = false;

    gl.getClearColor(previousClear);
    const previousAlpha = gl.getClearAlpha();
    // Opaque paper, not the canvas's own transparent clear. This is the whole
    // reason transmission is possible again: the page's background is CSS
    // behind a transparent canvas and is not in the scene, so a glass that
    // sampled the real frame would sample nothing and render white — which is
    // exactly what 2.5 saw and why it removed transmission from every tier.
    // Here the void is painted the colour the void actually is.
    gl.setClearColor(paper, 1);
    gl.setRenderTarget(target);
    gl.clear(true, true, false);
    gl.render(scene, camera);
    gl.setRenderTarget(null);
    gl.setClearColor(previousClear, previousAlpha);

    if (shells) shells.visible = wasVisible;

    glassBackdrop.value = target.texture;
    glassRefract.value = strength;
    glassState.active = true;
    glassState.width = width;
    glassState.height = height;
  });

  return null;
}
