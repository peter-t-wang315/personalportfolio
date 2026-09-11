// How much empty paper can the reader face from the centre of the graph?
//
//   node --experimental-strip-types --no-warnings --import ./checks/ts-register.mjs checks/emptypaper.mjs
//
// Offline, over the shipping layout (07-continuous-space.md, the empty-paper
// decision). For every heading on the sphere, through the interior lens at a
// desktop viewport: how many nodes are in frame, and how far the middle of the
// view is from the nearest node. Before/after numbers for any change to the
// layout or anything added to fill the gaps.
//
// Banded two ways, because they disagree. **Layout frame**: ±y of
// content/layout.ts, where its Fibonacci spheres start and end. **Reader's
// frame**: what the reader sees as up and down. The graph is turned so the
// arrival looks along INTERIOR_HEADING (nebula-canvas.tsx,
// NEBULA_BASE_ROTATION), and that heading is close to the layout's +y — so
// the layout's poles sit ahead of and behind the reader, and the reader's
// zenith and nadir are somewhere on the layout's equator. camera-controls
// keeps world +y up while looking around, so "top and bottom" in the docs
// means the reader's frame.
import { nodeList } from "@/lib/node-geometry";

const FOV = 72; // INSIDE_CAMERA_FOV, vertical
const INTERIOR_HEADING = [-0.083, 0.908, 0.411]; // nebula-canvas.tsx
const [W, H] = (process.env.VIEWPORT ?? "1440x900").split("x").map(Number);
const SAMPLES = 6000;

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (v) => { const l = Math.hypot(...v); return l < 1e-9 ? [1, 0, 0] : v.map((x) => x / l); };
const deg = (r) => (r * 180) / Math.PI;

// The arrival camera's basis in layout coordinates (three's lookAt, up = +y).
// NEBULA_BASE_ROTATION is its inverse, so a layout direction's reader-frame
// coordinates are its dot products with these.
const hz = norm(INTERIOR_HEADING).map((v) => -v);
const hx = norm(cross([0, 1, 0], hz));
const hy = cross(hz, hx);
const toReader = (d) => [dot(d, hx), dot(d, hy), dot(d, hz)];

const tanV = Math.tan((FOV * Math.PI) / 360);
const tanH = tanV * (W / H);
// Node directions in the reader's frame; headings are sampled there too, so
// "up" is the reader's up and the camera basis below matches camera-controls.
const dirs = nodeList.map((n) => ({
  id: n.id,
  kind: n.kind,
  layout: norm(n.position),
  d: toReader(norm(n.position)),
  r: Math.hypot(...n.position),
  size: n.radius,
}));

function view(h) {
  const up = Math.abs(h[1]) > 0.99 ? [0, 0, 1] : [0, 1, 0];
  const x = norm(cross(h, up));
  const y = cross(x, h);
  let inFrame = 0;
  let projects = 0;
  let nearest = Math.PI;
  for (const n of dirs) {
    nearest = Math.min(nearest, Math.acos(Math.max(-1, Math.min(1, dot(n.d, h)))));
    const z = dot(n.d, h);
    if (z <= 0) continue;
    const pad = n.size / n.r;
    if (Math.abs(dot(n.d, x) / z) <= tanH + pad && Math.abs(dot(n.d, y) / z) <= tanV + pad) {
      inFrame++;
      if (n.kind === "project") projects++;
    }
  }
  return { inFrame, projects, nearest: deg(nearest) };
}

const rows = [];
const phi = Math.PI * (3 - Math.sqrt(5));
for (let i = 0; i < SAMPLES; i++) {
  const y = 1 - (i / (SAMPLES - 1)) * 2;
  const r = Math.sqrt(1 - y * y);
  const h = [Math.cos(phi * i) * r, y, Math.sin(phi * i) * r]; // reader's frame
  // The same heading's latitude in the layout frame: invert toReader.
  const layoutH = [0, 1, 2].map((k) => hx[k] * h[0] + hy[k] * h[1] + hz[k] * h[2]);
  rows.push({ h, lat: deg(Math.asin(h[1])), layoutLat: deg(Math.asin(layoutH[1])), ...view(h) });
}

const pct = (xs, f) => xs.length ? ((100 * xs.filter(f).length) / xs.length).toFixed(1) + "%" : "-";
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const BANDS = [[60, 90], [30, 60], [0, 30], [-30, 0], [-60, -30], [-90, -60]];
const inBand = (l, [lo, hi]) => l >= lo && (hi === 90 ? l <= hi : l < hi);

console.log(`${nodeList.length} nodes, ${W}x${H}, vertical fov ${FOV}, horizontal ${deg(2 * Math.atan(tanH)).toFixed(0)}`);
console.log(`headings with 0 nodes in frame: ${pct(rows, (r) => r.inFrame === 0)}   ≤2: ${pct(rows, (r) => r.inFrame <= 2)}   ≤4: ${pct(rows, (r) => r.inFrame <= 4)}   0 projects: ${pct(rows, (r) => r.projects === 0)}`);
console.log(`view centre to nearest node: median ${median(rows.map((r) => r.nearest)).toFixed(1)}°, worst ${Math.max(...rows.map((r) => r.nearest)).toFixed(1)}°`);

for (const [label, latOf, nodeLat] of [
  ["READER'S frame (up = what the reader sees as up)", (r) => r.lat, (n) => deg(Math.asin(n.d[1]))],
  ["LAYOUT frame (±y of content/layout.ts)", (r) => r.layoutLat, (n) => deg(Math.asin(n.layout[1]))],
]) {
  console.log(`\n${label}`);
  console.log("heading band   in frame (median)  ≤2 in frame  nearest node median/worst   nodes in band (even share)");
  for (const band of BANDS) {
    const rs = rows.filter((r) => inBand(latOf(r), band));
    const count = dirs.filter((n) => inBand(nodeLat(n), band)).length;
    const area = (Math.sin((band[1] * Math.PI) / 180) - Math.sin((band[0] * Math.PI) / 180)) / 2;
    console.log(
      `${String(band[0]).padStart(4)}..${String(band[1]).padEnd(4)}    ${String(median(rs.map((r) => r.inFrame))).padStart(6)}          ${pct(rs, (r) => r.inFrame <= 2).padStart(6)}      ${median(rs.map((r) => r.nearest)).toFixed(1).padStart(5)}° / ${Math.max(...rs.map((r) => r.nearest)).toFixed(1)}°          ${String(count).padStart(3)} (${(nodeList.length * area).toFixed(1)})`,
    );
  }
}

const gaps = [];
for (const r of [...rows].sort((a, b) => b.nearest - a.nearest)) {
  if (gaps.every((g) => deg(Math.acos(dot(g.h, r.h))) > 25)) gaps.push(r);
  if (gaps.length === 6) break;
}
console.log("\nemptiest distinct directions:");
for (const g of gaps) console.log(`  reader-frame elevation ${g.lat.toFixed(0).padStart(4)}°   layout-frame lat ${g.layoutLat.toFixed(0).padStart(4)}°   nearest node ${g.nearest.toFixed(1)}°   ${g.inFrame} in frame`);
