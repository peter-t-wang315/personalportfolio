// Desktop, inside the graph: does letting go of a look-around drag in a sparse
// part of the sky settle the nearest nodes a little toward the middle of the
// view, and only there? Does the next drag let them go, does a plain press
// leave them alone, and does opening a node mid-settle hold them still, so its
// shell stays under the camera? Reads window.__nebulaProbe.viewSettle and the
// rig's "look" events.
import { chromium } from "playwright";
import fs from "node:fs";
const base = process.env.BASE ?? 'http://localhost:3100';
fs.mkdirSync('settle', { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
let pass = 0, fail = 0;
const check = (ok, label, detail='') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`); ok ? pass++ : fail++; };

const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto(base + '/nebula', { waitUntil: 'networkidle' }); await p.waitForTimeout(9000);

const settleNow = () => p.evaluate(() => { const s = window.__nebulaProbe.viewSettle; return { nodes: [...s.nodes], units: s.units, held: s.held, url: location.pathname }; });
const looks = () => p.evaluate(() => window.__nebulaProbe.events.filter(e => e.kind === 'look').map(e => e.detail));
const trace = (ms) => p.evaluate((ms) => new Promise(res => { const out = []; const t0 = performance.now(); (function f() { const s = window.__nebulaProbe.viewSettle; out.push({ t: performance.now() - t0, units: s.units, held: s.held, n: s.nodes.length }); if (performance.now() - t0 < ms) requestAnimationFrame(f); else res(out); })(); }), ms);
async function drag(dx, dy, lift = true) {
  await p.mouse.move(720, 450); await p.mouse.down();
  for (let i = 1; i <= 12; i++) { await p.mouse.move(720 + dx * i / 12, 450 + dy * i / 12); await p.waitForTimeout(30); }
  if (lift) await p.mouse.up();
}

// Look around until both a dense and a sparse view have been judged.
const plan = [[0, -140], [0, -140], [0, -140], [0, 280], [0, 280], [0, 280], [260, 0], [260, 0], [260, 0], [260, 0], [0, -200], [260, 0], [260, 0]];
let dense = null, sparse = null;
for (const [dx, dy] of plan) {
  const before = (await looks()).length;
  await drag(dx, dy);
  await p.waitForTimeout(1800);
  const all = await looks();
  const latest = all.length > before ? all.at(-1) : null;
  if (!latest) continue;
  const s = await settleNow();
  if (latest.includes('settle')) { if (!sparse) sparse = { detail: latest, ...s }; break; }
  else if (!dense) dense = { detail: latest, ...s };
}
check((await looks()).length > 0, 'a drag that comes to rest is judged', (await looks()).join(' | '));
check(!!dense && dense.nodes.length === 0, 'dense view: nothing settles', dense ? `${dense.detail}; settling ${dense.nodes.length}` : 'no dense view reached');
check(!!sparse && sparse.nodes.length === 3, 'sparse view: the three nearest nodes settle', sparse ? `${sparse.detail}; ${sparse.nodes.join(', ')}` : 'no sparse view reached');
if (!sparse) { await b.close(); console.log(`\n${pass + fail} checks, ${fail} failed`); process.exit(1); }

// It eases to a small offset and rests.
let rows = await trace(2500);
const peak = Math.max(...rows.map(r => r.units));
const tail = rows.filter(r => r.t > 2000);
check(peak > 0.3 && peak <= 1.55, 'settles a little', `furthest node ${peak.toFixed(2)} units`);
check(tail.length > 1 && Math.abs(tail.at(-1).units - tail[0].units) < 0.01, 'and comes to rest', `${tail[0]?.units.toFixed(3)} -> ${tail.at(-1)?.units.toFixed(3)} over the last 500ms`);
await p.screenshot({ path: 'settle/settled.png' });

// A plain press, no movement, leaves it alone.
const beforePress = (await settleNow()).units;
await p.mouse.move(8, 892); await p.mouse.down(); await p.waitForTimeout(150); await p.mouse.up();
await p.waitForTimeout(1000);
const afterPress = await settleNow();
check(afterPress.nodes.length === 3 && Math.abs(afterPress.units - beforePress) < 0.02, 'a press is not a drag', `${beforePress.toFixed(3)} -> ${afterPress.units.toFixed(3)}, url ${afterPress.url}`);

// The next drag lets go: held down mid-drag, the settled nodes ease home.
if (afterPress.url === '/nebula') {
  const start = (await settleNow()).units;
  await drag(60, 0, false);
  await p.waitForTimeout(900);
  const mid = await settleNow();
  await p.mouse.up();
  check(mid.nodes.length === 0 && mid.units < start * 0.6, 'the next drag lets them go', `${start.toFixed(2)} -> ${mid.units.toFixed(2)} units while dragging`);
}

// Settle again, then open one of the settling nodes while it is still easing.
let settledAgain = null;
for (const [dx, dy] of [[0, 0], [30, 0], [-30, 0], [0, 30], [0, -30], [60, 0]]) {
  const before = (await looks()).length;
  if (dx || dy) { await drag(dx, dy); } else { await drag(8, 0); }
  // As soon as it is judged, not after it has rested.
  for (let i = 0; i < 30; i++) { const all = await looks(); if (all.length > before) break; await p.waitForTimeout(50); }
  const s = await settleNow();
  if (s.nodes.length === 3) { settledAgain = s; break; }
  await p.waitForTimeout(1500);
}
check(!!settledAgain, 'settles again after a small drag in the same sparse view');
if (settledAgain) {
  const id = settledAgain.nodes[0];
  // lib/nebula-routes.ts, routeForNode: a project opens at its *slug*, which
  // is not always its id; anything else is a technology, at its id.
  const slugs = Object.fromEntries([...fs.readFileSync('content/projects.ts', 'utf8').matchAll(/id: '([^']+)',\s*slug: '([^']+)'/g)].map(m => [m[1], m[2]]));
  const route = slugs[id] ? `/nebula/${slugs[id]}` : `/nebula/tech/${id}`;
  const unitsAtOpen = (await settleNow()).units;
  const tr = trace(2500);
  await p.evaluate((r) => window.next.router.push(r), route);
  rows = await tr;
  const after = rows.filter(r => r.t > 150);
  const drift = after.length > 1 ? Math.abs(after.at(-1).units - after[0].units) : 1;
  check(after.every(r => r.held), 'opening a node holds the settle', `held on ${after.filter(r => r.held).length}/${after.length} frames`);
  check(drift < 1e-4, 'and the settling nodes stop dead while it is open', `${unitsAtOpen.toFixed(3)} at open, moved ${drift.toFixed(5)} after`);
  await p.waitForTimeout(500);
  await p.screenshot({ path: 'settle/opened-mid-settle.png' });
  await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /back to the graph/i.test(b.textContent))?.click());
  rows = await trace(3500);
  const end = rows.at(-1);
  check(!end.held && end.n === 0 && end.units < 0.05, 'closing lets them go home', `units ${end.units.toFixed(3)}, held ${end.held}`);
}

await b.close();
console.log(`\n${pass + fail} checks, ${fail} failed`);
