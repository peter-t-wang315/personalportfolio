"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useSceneStore, type HeroLayout } from "@/lib/scene-store";
import { heroMetrics, site } from "@/content";
import { useDeviceTier } from "@/lib/device-tier";
import { palette } from "@/lib/palette";
import { homePlane } from "./nebula-home-placement";

/**
 * The home page, as an object in the world.
 *
 * Part 2 of `07-continuous-space.md` built it as scenery seen from inside the
 * graph: a plane far off along +z carrying a drawing of the hero. Parts 4 and
 * 5 make it the thing you fly past. It now hangs `HOME_STANDOFF` units in
 * front of the home standing point, sized and placed each frame so that from
 * that point it covers exactly the pixels the real hero covers
 * (nebula-canvas.tsx solves it against the measured column); the real page
 * dissolves into it as the flight begins and out of it as the flight home
 * ends, and in between it is the page going past on the left, then the page
 * back there when the reader turns around.
 *
 * **It is scenery, not content.** The real hero is HTML and stays the thing
 * that gets read, selected, indexed and tabbed through. This is what that page
 * looks like from anywhere but the one place you read it.
 *
 * Painted from the measured DOM (hero-layout.ts) rather than from `content/`
 * at a layout of its own, because the swap only has nowhere to show if the
 * two are the same picture. Still drawn, not photographed: `html2canvas` and
 * `foreignObject` round-trips are heavy and get the fonts subtly wrong, and
 * the measurement is a dozen rects.
 */

/**
 * The texture is painted at the column's CSS size times this, capped so a
 * tall column on a 2x display does not become a 16MB texture. At the moment of
 * the swap the plane covers the column pixel for pixel, so anything under the
 * device pixel ratio is a visible softening of the text.
 */
const MAX_TEXTURE_SCALE = 2;
const MAX_TEXTURE_HEIGHT = 2048;
/**
 * Halved below desktop. The swap is the only time the resolution shows, and
 * that tier has the least GPU memory; a fifth of the frame and hazed, it buys
 * nothing.
 */
const COMPACT_TEXTURE_SCALE = 0.5;

function familyFor(token: string, fallback: string) {
  if (typeof document === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(token)
    .trim();
  return value || fallback;
}

/**
 * What to paint when the landing page has never been measured this session
 * — a cold load of `/nebula`. An approximation of the desktop hero at a
 * common viewport, in the hero's own fonts, reading the same strings from
 * `content/` that the page does so the two cannot describe different people.
 * Only ever seen from far off and hazed; the moment the reader flies home the
 * real page mounts and measures itself.
 */
function fallbackLayout(): HeroLayout {
  const display = familyFor("--font-display", "ui-monospace, monospace");
  const body = familyFor("--font-body", "ui-sans-serif, sans-serif");
  const W = 700;
  const items: HeroLayout["items"] = [];
  const push = (
    text: string,
    top: number,
    size: number,
    opts: Partial<HeroLayout["items"][number]> = {},
  ) =>
    items.push({
      text,
      left: 0,
      top,
      width: W,
      height: opts.lineHeight ?? size * 1.5,
      fontFamily: body,
      fontSize: size,
      fontWeight: "400",
      letterSpacing: 0,
      lineHeight: size * 1.5,
      color: palette.ink,
      ...opts,
    });
  push(site.name, 0, 20, { fontWeight: "500" });
  push(site.role, 34, 14, { color: palette.inkMuted });
  push(site.positioning.toLowerCase(), 96, 76, {
    fontFamily: display,
    letterSpacing: -3,
    lineHeight: 87,
    height: 261,
  });
  let x = 0;
  for (const metric of heroMetrics) {
    const width = Math.max(120, metric.value.length * 24);
    items.push({
      text: metric.value,
      left: x,
      top: 450,
      width,
      height: 54,
      fontFamily: display,
      fontSize: 36,
      fontWeight: "400",
      letterSpacing: -0.7,
      lineHeight: 54,
      color: palette.ink,
    });
    items.push({
      text: metric.label,
      left: x,
      top: 508,
      width: 320,
      height: 20,
      fontFamily: body,
      fontSize: 13,
      fontWeight: "400",
      letterSpacing: 0,
      lineHeight: 20,
      color: palette.inkMuted,
    });
    x += 330;
  }
  return { width: W, height: 740, items };
}

/**
 * Paints the hero onto a canvas from its measured layout.
 *
 * Each item is one element's text, re-wrapped within that element's width in
 * that element's font, so it breaks where the browser broke it. Baselines are
 * placed the way CSS places them — the glyph box centred in the line box —
 * from the font's own ascent and descent, which is what keeps a 76px headline
 * from sitting a few pixels high of the real one.
 */
function paintHero(canvas: HTMLCanvasElement, layout: HeroLayout, scale: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = Math.max(1, Math.round(layout.width * scale));
  canvas.height = Math.max(1, Math.round(layout.height * scale));
  ctx.scale(scale, scale);
  // Text on nothing, not text on paper. The plane used to be filled with the
  // page colour first, which on desktop was invisible — the hero column and
  // the cluster are side by side, so the plane never covered anything. On a
  // phone the column is the full width and the cluster sits *inside* it, so
  // an opaque plane hid the graph for the whole first half of the flight in
  // and the last half of the flight out: the nebula was "lost to the fog"
  // the moment the page became the plane. The page's own background is the
  // same paper the plane was painted, so nothing is lost by leaving it out.
  ctx.clearRect(0, 0, layout.width, layout.height);
  ctx.textBaseline = "alphabetic";

  for (const item of layout.items) {
    ctx.font = `${item.fontWeight} ${item.fontSize}px ${item.fontFamily}`;
    // Tracking is part of the measured layout; where the canvas cannot apply
    // it the lines wrap a little differently and nothing worse.
    if ("letterSpacing" in ctx) {
      (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
        `${item.letterSpacing}px`;
    }
    ctx.fillStyle = item.color;
    const probe = ctx.measureText("Hg");
    const ascent = probe.fontBoundingBoxAscent || item.fontSize * 0.9;
    const descent = probe.fontBoundingBoxDescent || item.fontSize * 0.25;
    const lead = (item.lineHeight - (ascent + descent)) / 2 + ascent;

    const lines: string[] = [];
    let line = "";
    for (const word of item.text.split(" ")) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > item.width + 0.5) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
    lines.forEach((text, i) => {
      ctx.fillText(text, item.left, item.top + i * item.lineHeight + lead);
    });
  }
}

export function NebulaHome() {
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  const tier = useDeviceTier();
  const heroLayout = useSceneStore((s) => s.heroLayout);
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);

  useEffect(() => {
    const canvas = document.createElement("canvas");
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    // Anisotropy is the difference between a page seen at a glancing angle and
    // a smear, and the plane is seen edge-on as it goes past.
    map.anisotropy = 8;

    let live = true;
    const draw = () => {
      if (!live) return;
      const layout = heroLayout ?? fallbackLayout();
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_TEXTURE_SCALE);
      const cap = MAX_TEXTURE_HEIGHT / Math.max(layout.height, 1);
      const scale =
        Math.min(dpr, cap) * (tier === "desktop" ? 1 : COMPACT_TEXTURE_SCALE);
      paintHero(canvas, layout, scale);
      map.needsUpdate = true;
      setTexture(map);
    };
    // Waiting for the fonts matters more here than anywhere else on the site:
    // canvas has no fallback-swap, so painting early bakes the system font
    // into a texture that never gets repainted.
    if (document.fonts?.status === "loaded") draw();
    else document.fonts?.ready.then(draw).catch(draw);

    return () => {
      live = false;
      map.dispose();
    };
  }, [heroLayout, tier]);

  const geometry = useMemo(() => new THREE.PlaneGeometry(1, 1), []);

  // Default priority: after the rig has solved this frame's placement.
  useFrame(() => {
    const mesh = meshRef.current;
    const material = materialRef.current;
    if (!mesh || !material) return;
    mesh.position.copy(homePlane.position);
    mesh.scale.set(homePlane.width, homePlane.height, 1);
    material.opacity = homePlane.opacity;
    mesh.visible = homePlane.opacity > 0.002;
  });

  if (!texture) return null;

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      visible={false}
      // **Not** turned to face the graph. A plane's front is +z, which is the
      // side the home standing point sees, so from there it reads as the page.
      // From inside the graph the reader sees its *back* — the page mirrored,
      // the way anything reads once you have gone past it.
      // Never raycast: it is scenery, and a page-sized click target would
      // swallow drags aimed at the nodes in front of it.
      raycast={() => null}
    >
      <meshBasicMaterial
        ref={materialRef}
        map={texture}
        transparent
        opacity={0}
        // The haze is opacity now (HOME_REST_OPACITY): home sits inside the
        // fog's near plane. Fog is left on so the band still has it if the
        // dial ever pushes the near plane past it.
        fog
        // Depth-tested so nodes in front occlude it, but writing no depth of
        // its own: it is drawn before the transparent shells and must not stop
        // them blending over it, which is the "seen through the glass" effect
        // Part 6 is groundwork for.
        depthWrite={false}
        toneMapped={false}
        // Double-sided, and the back is the page mirrored: from inside the
        // graph the reader is behind a page they flew past, and that is what
        // the back of a page looks like. (It was briefly drawn un-mirrored
        // and read as the page turned round to face the reader.)
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
