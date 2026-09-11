// Desktop: what does the whisper do after the cursor leaves the graph? Records
// the phrase's box and opacity, the pointer, and the cluster's live circle on
// every animation frame in the page itself — Playwright round trips are slower
// than a jump — through a hover, the exit, and several beats after, in a few
// ways of leaving. Reports every visible frame-to-frame jump with the frames
// leading up to it, so a jump can be told apart from a phrase following the
// pointer back in.
import { chromium } from "playwright";
import fs from "node:fs";
const base = process.env.BASE ?? 'http://localhost:3100';
fs.mkdirSync('whisperleave', { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
let pass = 0, fail = 0;
const check = (ok, label, detail='') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`); ok ? pass++ : fail++; };

const startRecording = (p) => p.evaluate(() => {
  window.__whisperRec = [];
  window.__ptr = { x: -1, y: -1 };
  window.addEventListener('pointermove', (e) => { window.__ptr = { x: e.clientX, y: e.clientY }; });
  const t0 = performance.now();
  (function f() {
    if (!window.__whisperRec) return;
    const span = document.querySelector('a.nebula-affordance-hit span');
    const c = window.__nebulaProbe.cluster;
    const row = { t: performance.now() - t0, px: window.__ptr.x, py: window.__ptr.y, cx: c.x, cy: c.y, r: c.r, text: null };
    if (span) {
      const r = span.getBoundingClientRect();
      Object.assign(row, { text: span.textContent, op: +getComputedStyle(span).opacity, x: r.left + r.width / 2, y: r.top + r.height / 2, left: r.left });
    }
    window.__whisperRec.push(row);
    requestAnimationFrame(f);
  })();
});
const stopRecording = (p) => p.evaluate(() => { const r = window.__whisperRec; window.__whisperRec = null; return r; });
const inside = (row) => Math.hypot(row.px - row.cx, row.py - row.cy) <= row.r;

function jumps(rows) {
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1], c = rows[i];
    if (!a.text || !c.text || a.text !== c.text) continue;
    if (Math.min(a.op, c.op) < 0.15) continue;
    const d = Math.hypot(c.x - a.x, c.y - a.y);
    if (d > 25) out.push({ i, t: c.t, d, dt: c.t - a.t, text: c.text });
  }
  return out;
}

for (const [name, leave] of [
  ['exit and stop', async (p, c) => { for (let i = 1; i <= 10; i++) { await p.mouse.move(c.x + c.r * 0.3 + i * c.r * 0.15, c.y); await p.waitForTimeout(30); } }],
  // Out the way a mouse goes, a few pixels per event, then wandering outside.
  // The first version teleported the pointer ~100px out of the circle in one
  // event, and the follow spring gliding after it to where the pointer left
  // read as a jump — the same glide a hover makes, after a move no mouse makes.
  ['exit and keep moving', async (p, c) => { const x0 = c.x + c.r * 0.39, y0 = c.y - c.r * 0.08; for (let i = 1; i <= 14; i++) { await p.mouse.move(x0 + (c.x + c.r * 1.2 - x0) * i / 14, y0 + (c.y - y0) * i / 14); await p.waitForTimeout(30); } for (let i = 1; i <= 80; i++) { await p.mouse.move(c.x + c.r * 1.2 + Math.sin(i / 6) * 60 + i * 3, c.y + Math.cos(i / 5) * 80); await p.waitForTimeout(40); } }],
  ['exit slowly along the edge', async (p, c) => { for (let i = 0; i <= 60; i++) { const a = i / 60 * Math.PI; await p.mouse.move(c.x + Math.cos(a) * c.r * (1.0 + i / 200), c.y + Math.sin(a) * c.r * (1.0 + i / 200)); await p.waitForTimeout(50); } }],
]) {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(base + '/', { waitUntil: 'networkidle' }); await p.waitForTimeout(5000);
  await p.mouse.move(1400, 880);
  await p.waitForTimeout(500);
  const c = await p.evaluate(() => ({ ...window.__nebulaProbe.cluster }));
  await startRecording(p);
  for (let i = 0; i <= 10; i++) { await p.mouse.move(1400 + (c.x - 1400) * i / 10, 880 + (c.y - 880) * i / 10); await p.waitForTimeout(40); }
  for (let i = 0; i < 30; i++) { const a = i / 30 * Math.PI * 2; await p.mouse.move(c.x + Math.cos(a) * c.r * 0.4, c.y + Math.sin(a) * c.r * 0.4); await p.waitForTimeout(80); }
  const leftAtT = await p.evaluate(() => window.__whisperRec.at(-1).t);
  await leave(p, c);
  await p.waitForTimeout(9000);
  const rows = await stopRecording(p);
  const firstOut = rows.findIndex(r => r.t > leftAtT && !inside(r));
  const after = rows.slice(Math.max(firstOut, 0));
  // Re-entries: the pointer counted as inside the live circle again after leaving.
  let flips = 0;
  for (let i = 1; i < after.length; i++) if (inside(after[i]) !== inside(after[i - 1])) flips++;
  const js = jumps(after);
  const phrases = [...new Set(after.filter(r => r.text && r.op > 0.5).map(r => r.text))];
  console.log(`\n${name}: ${after.length} frames after leaving, ${flips} in/out flips, phrases ${phrases.join(' | ')}`);
  for (const j of js.slice(0, 6)) {
    console.log(`   +${(j.t - after[0].t).toFixed(0)}ms  "${j.text}" jumped ${j.d.toFixed(0)}px in ${j.dt.toFixed(0)}ms`);
    for (const r of after.slice(Math.max(j.i - 4, 0), j.i + 1)) {
      const dist = Math.hypot(r.px - r.cx, r.py - r.cy) / r.r;
      console.log(`        pointer ${dist.toFixed(2)} radii ${inside(r) ? 'IN ' : 'out'}  phrase at (${r.x?.toFixed(0)}, ${r.y?.toFixed(0)})  pointer (${r.px.toFixed(0)}, ${r.py.toFixed(0)})  circle centre (${r.cx.toFixed(0)}, ${r.cy.toFixed(0)})`);
    }
  }
  check(js.length === 0, `${name}: no visible phrase jumps after the cursor leaves`, `${js.length} jumps over 25px`);
  fs.writeFileSync(`whisperleave/${name.replace(/ /g, '-')}.json`, JSON.stringify(after));
  await p.close();
}
await b.close();
console.log(`\n${pass + fail} checks, ${fail} failed`);
