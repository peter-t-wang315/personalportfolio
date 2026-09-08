"use client";

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { heroMetrics, site } from "@/content";
import { useDeviceTier } from "@/lib/device-tier";
import { palette } from "@/lib/palette";

/**
 * The home page, as an object in the world.
 *
 * Part 2 of `07-continuous-space.md`. The point of the whole plan is that the
 * site should be one space rather than two transforms of one object: you fly
 * past the home page into the graph, and turning around inside it, home is
 * still there where you left it. This is the cheapest possible test of whether
 * that reads — a static thing in the right place, no camera changes at all.
 *
 * **It is scenery, not content.** The real hero is HTML and stays the thing
 * that gets read, selected, indexed and tabbed through. This is what that page
 * looks like from a long way off, which is a different job.
 */

/**
 * Distance from the graph's centre to where home stands, in world units.
 *
 * From `07-continuous-space.md`: the shell has to sit ~74 units from the
 * landing viewpoint for it to draw at the size it draws today. Nothing stands
 * there yet — the landing camera is still at (0, 0, 9) with the graph shrunk
 * and pushed back to meet it — so for now this is where home *will* be, and
 * the plane is placed at it rather than in front of it. The plan's `p`, the
 * hero's offset ahead of the standing point, is a Part 3 quantity and does not
 * exist until there is a standing point to be ahead of.
 *
 * Along +z because that is the direction the landing camera looks from: the
 * graph is at the origin and `HOME_CAMERA_POSITION` is at +9z, so "back the
 * way you came" from inside the shell is +z.
 */
export const HOME_DISTANCE = 150;

/**
 * The plane's height in world units, which is what sets how large home reads
 * from inside the graph.
 *
 * At `HOME_DISTANCE` and the interior's 72° field of view, the full viewport
 * spans about 108 world units, so this covers a bit under a third of the
 * frame's height. Large enough to be unmistakably a page rather than a speck;
 * small enough to still be *over there*. Very much a number to look at rather
 * than derive — it and `HOME_DISTANCE` are the two dials this part exists to
 * let us turn.
 */
const PLANE_HEIGHT = 40;

/**
 * Texture resolution. The plane is far away and fogged, so this is not about
 * legibility of the body text — that is gone at any resolution from 74 units.
 * It is about the wordmark and the headline holding their shape instead of
 * turning to mush, which is what tells you it is a page.
 */
const TEXTURE_WIDTH = 1024;
const TEXTURE_HEIGHT = 720;
/**
 * Halved below desktop. The plane is a third of the frame at most and a
 * quarter faded, so the resolution buys nothing there, while a full-size
 * texture is around 2.8MB of GPU memory on the tier with the least of it —
 * and 2.8's budget is 30fps on a mid-range phone.
 */
const COMPACT_TEXTURE_SCALE = 0.5;

/** Matches the hero's own left gutter as a fraction of the column. */
const PADDING = 0.06;

function familyFor(token: string, fallback: string) {
  if (typeof document === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(token)
    .trim();
  return value || fallback;
}

/**
 * Paints the hero onto a canvas.
 *
 * Drawn rather than photographed. Rendering the real DOM to an image needs
 * `html2canvas` or a `foreignObject` round-trip, both of which are heavy, both
 * of which get the fonts subtly wrong, and neither of which is worth it for
 * something that will be a third of the frame tall and a quarter faded. This
 * reads the same strings from `content/` that the hero does, so the two cannot
 * describe different people.
 */
function paintHero(canvas: HTMLCanvasElement, scale: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = (canvas.width = Math.round(TEXTURE_WIDTH * scale));
  const H = (canvas.height = Math.round(TEXTURE_HEIGHT * scale));
  // Everything below is authored against the full-size canvas and scaled as a
  // whole, so a smaller texture is the same picture rather than a different
  // layout with the same words.
  ctx.scale(scale, scale);
  const display = familyFor("--font-display", "ui-monospace, monospace");
  const body = familyFor("--font-body", "ui-sans-serif, sans-serif");

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = palette.paper;
  ctx.fillRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);

  const authoredW = TEXTURE_WIDTH;
  const x = authoredW * PADDING;
  const maxWidth = authoredW * (1 - PADDING * 2);
  let y = TEXTURE_HEIGHT * 0.14;

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = palette.ink;
  ctx.font = `500 34px ${body}`;
  ctx.fillText(site.name, x, y);

  y += 34;
  ctx.fillStyle = palette.inkMuted;
  ctx.font = `24px ${body}`;
  ctx.fillText(site.role, x, y);

  // The headline, wrapped the way the hero wraps it — by width, not by a
  // hardcoded break, so a change to the positioning line cannot silently push
  // a word off the edge of the texture.
  y += 96;
  ctx.fillStyle = palette.ink;
  ctx.font = `76px ${display}`;
  const words = site.positioning.toLowerCase().split(" ");
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      y += 88;
      line = word;
    } else {
      line = next;
    }
  }
  if (line) ctx.fillText(line, x, y);

  // The metrics row: values only. Their labels are a sentence each and would
  // be illegible grey noise at this distance, where the numbers still read as
  // numbers.
  y += 96;
  ctx.font = `56px ${body}`;
  let metricX = x;
  for (const metric of heroMetrics) {
    ctx.fillStyle = palette.ink;
    ctx.fillText(metric.value, metricX, y);
    metricX += ctx.measureText(metric.value).width + 64;
  }
}

export function NebulaHome({ visible }: { visible: boolean }) {
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  const tier = useDeviceTier();

  const scale = tier === "desktop" ? 1 : COMPACT_TEXTURE_SCALE;

  useEffect(() => {
    const canvas = document.createElement("canvas");
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    // Anisotropy is the difference between a page seen at a glancing angle and
    // a smear; the plane is only ever seen from far off-axis until Part 4.
    map.anisotropy = 8;

    let live = true;
    const draw = () => {
      if (!live) return;
      paintHero(canvas, scale);
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
  }, [scale]);

  const aspect = TEXTURE_WIDTH / TEXTURE_HEIGHT;
  const geometry = useMemo(
    () => new THREE.PlaneGeometry(PLANE_HEIGHT * aspect, PLANE_HEIGHT),
    [aspect],
  );

  if (!texture) return null;

  return (
    <mesh
      geometry={geometry}
      // **Not** turned to face the graph. A plane's front is +z and home sits
      // at +z, so leaving it alone means the reader inside the shell sees its
      // *back* — the page mirrored, the way anything reads once you have gone
      // past it. Turned around it was a sign that happened to be pointed at
      // whoever was looking, which is the opposite of having left it behind.
      position={[0, 0, HOME_DISTANCE]}
      visible={visible}
      // Never raycast: it is scenery, and a page-sized invisible click target
      // behind the graph would swallow drags aimed at the nodes in front of it.
      raycast={() => null}
    >
      <meshBasicMaterial
        map={texture}
        transparent
        // Fog is what makes it *distant* rather than merely small — at this
        // range the band from Part 1 takes it to about a quarter faded, and
        // since it fogs toward paper it recedes into the page rather than
        // greying out.
        fog
        // Depth-tested so nodes in front occlude it, but writing no depth of
        // its own: it is drawn before the transparent shells and must not stop
        // them blending over it, which is the whole "seen through the glass"
        // effect this is groundwork for.
        depthWrite={false}
        toneMapped={false}
        // The back face is the one being looked at, so it has to be drawn.
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
