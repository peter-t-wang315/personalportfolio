// Which way should the reader face on arriving at the centre of the graph?
//
// Searches every heading on the sphere from the origin and scores the view
// through the interior lens, for a camera standing exactly at the centre
// (nebula-canvas.tsx, INTERIOR_STANDING_POINT). The winner is what
// INTERIOR_HEADING should be; it is printed alongside the heading the rig
// currently uses, so a layout change shows up as a gap between them.
//
//   node --experimental-strip-types --no-warnings --import ./checks/ts-register.mjs checks/interiorheading.mjs
//
// Offline, no browser: the view is arithmetic over the layout. Re-run whenever
// content/layout.ts moves — a heading measured against a layout that has
// since changed is indistinguishable from one that was never right.
//
// What it scores, per viewport: nodes in frame, projects in frame,
// *production* projects in frame (the site's argument lives in the SEL
// clusters, and a search told to count projects once pointed the arrival at a
// Pokémon team builder), and total apparent area. Constraints: no node within
// AXIS_CLEAR_DEG of the view axis, so the arrival is not aimed at one
// project; the frame's centroid within CENTROID_MAX of the middle; and —
// because the flight is now a straight line through the shell along the
// reverse of this heading — no node within ENTRY_CLEAR_UNITS of that line, so
// the reader passes nodes on the way in rather than through them.
import { nodeList } from "@/lib/node-geometry";

const FOV = 72; // INSIDE_CAMERA_FOV
const CURRENT = [-0.083, 0.908, 0.411]; // INTERIOR_HEADING, for comparison
const VIEWPORTS = [
  [1440, 900],
  [1280, 800],
  [1920, 1080],
  [1024, 768],
  [1536, 864],
  [1366, 768],
];
const AXIS_CLEAR_DEG = 6;
const CENTROID_MAX = 0.15;
const ENTRY_CLEAR_UNITS = 1.5;
const SAMPLES = 4000;

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (v) => {
  const l = Math.hypot(...v);
  return l < 1e-9 ? [1, 0, 0] : v.map((x) => x / l);
};

/** Camera basis for a heading, with three.js's lookAt semantics and up = +y. */
function basis(h) {
  const z = [-h[0], -h[1], -h[2]];
  const x = norm(cross([0, 1, 0], z));
  const y = cross(z, x);
  return { x, y, z };
}

function score(h) {
  const { x, y, z } = basis(h);
  const tanH = Math.tan((FOV * Math.PI) / 360);
  let minAxisDeg = 90;
  let minEntryClear = Infinity;
  const entry = [-h[0], -h[1], -h[2]];
  for (const n of nodeList) {
    const p = n.position;
    const d = Math.hypot(...p);
    const forward = -dot(p, z);
    if (forward > 0) {
      minAxisDeg = Math.min(minAxisDeg, (Math.acos(forward / d) * 180) / Math.PI);
    }
    const along = dot(p, entry);
    if (along > 0) {
      const perp = Math.sqrt(Math.max(d * d - along * along, 0)) - n.radius;
      minEntryClear = Math.min(minEntryClear, perp);
    }
  }
  const per = VIEWPORTS.map(([W, H]) => {
    const tanW = (tanH * W) / H;
    let count = 0;
    let projects = 0;
    let production = 0;
    let area = 0;
    let cx = 0;
    let cy = 0;
    for (const n of nodeList) {
      const p = n.position;
      const d = Math.hypot(...p);
      const forward = -dot(p, z);
      if (forward <= 0) continue;
      const sx = dot(p, x) / forward / tanW;
      const sy = dot(p, y) / forward / tanH;
      if (Math.abs(sx) > 1 || Math.abs(sy) > 1) continue;
      count++;
      if (n.kind === "project") {
        projects++;
        if (n.category === "professional") production++;
      }
      area += ((n.radius * n.radius) / (d * d)) * 1000;
      cx += sx;
      cy += sy;
    }
    return {
      W,
      H,
      count,
      projects,
      production,
      area,
      cx: cx / (count || 1),
      cy: cy / (count || 1),
    };
  });
  return { per, minAxisDeg, minEntryClear };
}

function total(s) {
  const worst = Math.min(...s.per.map((p) => p.count));
  return (
    s.per.reduce(
      (acc, p) => acc + p.count + 2 * p.production + p.projects + p.area / 10,
      0,
    ) /
      s.per.length +
    worst * 0.5
  );
}

const candidates = [];
const golden = Math.PI * (3 - Math.sqrt(5));
for (let i = 0; i < SAMPLES; i++) {
  const yy = 1 - (i / (SAMPLES - 1)) * 2;
  const r = Math.sqrt(1 - yy * yy);
  const t = golden * i;
  const h = [Math.cos(t) * r, yy, Math.sin(t) * r];
  const s = score(h);
  if (s.minAxisDeg < AXIS_CLEAR_DEG) continue;
  if (s.minEntryClear < ENTRY_CLEAR_UNITS) continue;
  const main = s.per[0];
  if (Math.hypot(main.cx, main.cy) > CENTROID_MAX) continue;
  candidates.push({ h, s, total: total(s) });
}
candidates.sort((a, b) => b.total - a.total);

function describe(label, h, s) {
  const main = s.per[0];
  console.log(
    `${label} heading (${h.map((v) => v.toFixed(3)).join(", ")})` +
      `  score ${total(s).toFixed(1)}` +
      `  at ${main.W}x${main.H}: ${main.count} nodes, ${main.projects} projects, ` +
      `${main.production} production, area ${main.area.toFixed(1)}, ` +
      `centroid (${main.cx.toFixed(2)}, ${main.cy.toFixed(2)})` +
      `  fewest across viewports ${Math.min(...s.per.map((p) => p.count))}` +
      `  axis clear ${s.minAxisDeg.toFixed(1)}°  entry clear ${s.minEntryClear.toFixed(2)}`,
  );
}

console.log(`${candidates.length} of ${SAMPLES} headings pass the constraints\n`);
for (const c of candidates.slice(0, 8)) describe("  ", c.h, c.s);
console.log();
describe("current", CURRENT, score(norm(CURRENT)));
const best = candidates[0];
if (best) {
  const gap = (Math.acos(Math.min(1, dot(norm(CURRENT), best.h))) * 180) / Math.PI;
  console.log(`best is ${gap.toFixed(1)}° from current`);
}
