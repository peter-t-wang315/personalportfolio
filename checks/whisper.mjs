// Desktop whisper: cycles beside the graph, comes to the cursor on hover and
// keeps cycling there, goes back beside the graph on leaving. No pulse ring.
import { chromium } from "playwright";
import fs from "node:fs";
const base = process.env.BASE ?? 'http://localhost:3100';
fs.mkdirSync('whisper', { recursive: true });
const [W, H] = (process.env.VIEWPORT ?? '1440x900').split('x').map(Number);
const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: W, height: H } });
const errors = []; p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); p.on('pageerror', e => errors.push(String(e)));
let pass = 0, fail = 0;
const check = (ok, label, detail='') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`); ok ? pass++ : fail++; };

await p.goto(base + '/', { waitUntil: 'networkidle' }); await p.waitForTimeout(5000);
const sample = () => p.evaluate(() => {
  const a = document.querySelector('a.nebula-affordance-hit');
  const span = a?.querySelector('span');
  const c = window.__nebulaProbe.cluster;
  const hero = document.getElementById('hero-column')?.getBoundingClientRect();
  if (!span) return { text: null, c, hero: hero && { l: hero.left, t: hero.top, r: hero.right, b: hero.bottom } };
  const r = span.getBoundingClientRect();
  return { text: span.textContent, op: +getComputedStyle(span).opacity, l: r.left, t: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2, c, hero: hero && { l: hero.left, t: hero.top, r: hero.right, b: hero.bottom }, ring: !!document.querySelector('.cluster-pulse-ring') };
});
async function watch(ms, every = 200) { const out = []; const end = Date.now() + ms; while (Date.now() < end) { out.push(await sample()); await p.waitForTimeout(every); } return out; }
const visible = (rows) => rows.filter(r => r.text && r.op > 0.6);
const phrases = (rows) => [...new Set(visible(rows).map(r => r.text))];

// 1. Idle, pointer parked in a far corner.
await p.mouse.move(W - 5, H - 5);
const idle = await watch(9500);
await p.screenshot({ path: `whisper/whisper-idle.png` });
const s0 = idle[0];
console.log(`cluster (${s0.c.x.toFixed(0)}, ${s0.c.y.toFixed(0)}) r ${s0.c.r.toFixed(0)}; hero column ${JSON.stringify(s0.hero)}`);
const idleP = phrases(idle);
check(idleP.length >= 2, 'idle: phrases cycle without a hover', idleP.join(' | '));
const overHero = visible(idle).filter(r => r.hero && r.l < r.hero.r && r.l + r.w > r.hero.l && r.t < r.hero.b && r.t + r.h > r.hero.t);
check(overHero.length === 0, 'idle: no phrase over the hero column', `${overHero.length} samples over it`);
const overGraph = visible(idle).filter(r => Math.hypot(Math.max(Math.abs(r.cx - r.c.x) - r.w / 2, 0), Math.max(Math.abs(r.cy - r.c.y) - r.h / 2, 0)) < r.c.r * 0.9);
check(overGraph.length === 0, 'idle: phrases sit beside the graph, not on it', `${overGraph.length} samples on it`);
check(!idle.some(r => r.ring), 'no pulse ring on desktop');
for (const t of idleP) { const r = visible(idle).find(x => x.text === t); console.log(`   "${t}" at (${r.cx.toFixed(0)}, ${r.cy.toFixed(0)}) — ${(Math.hypot(r.cx - r.c.x, r.cy - r.c.y) / r.c.r).toFixed(2)} radii out`); }

// 2. Hover: move in, then wander inside the cluster.
const c = s0.c;
for (let i = 0; i <= 12; i++) { await p.mouse.move(W - 5 + (c.x - (W - 5)) * i / 12, H - 5 + (c.y - (H - 5)) * i / 12); await p.waitForTimeout(40); }
await p.waitForTimeout(700);
const hoverRows = [];
for (let i = 0; i < 40; i++) {
  const a = i / 40 * Math.PI * 4;
  const mx = c.x + Math.cos(a) * c.r * 0.4, my = c.y + Math.sin(a) * c.r * 0.4;
  await p.mouse.move(mx, my);
  await p.waitForTimeout(200);
  hoverRows.push({ ...(await sample()), mx, my });
}
await p.screenshot({ path: `whisper/whisper-hover.png` });
const hv = visible(hoverRows);
const near = hv.filter(r => Math.abs(r.l - (r.mx + 18)) < 60 && Math.abs(r.t - (r.my + 18)) < 40);
check(hv.length > 0 && near.length / hv.length > 0.7, 'hover: the phrase sits beside the cursor', `${near.length}/${hv.length} visible samples within reach of the cursor`);
check(phrases(hoverRows).length >= 2, 'hover: phrases keep cycling at the cursor', phrases(hoverRows).join(' | '));

// 3. Leave to the empty right edge and watch. Leave just after a phrase is
// born at the cursor, so most of its beat is still to come.
{ const t = (await sample()).text; const end = Date.now() + 5000; while (Date.now() < end && (await sample()).text === t) await p.waitForTimeout(100); }
await p.waitForTimeout(600);
const leaveX = Math.min(W - 10, c.x + c.r * 1.6), leaveY = c.y;
for (let i = 1; i <= 8; i++) { await p.mouse.move(c.x + (leaveX - c.x) * i / 8, c.y); await p.waitForTimeout(40); }
const after = await watch(5500, 150);
await p.screenshot({ path: `whisper/whisper-left.png` });
const lastHover = visible(after)[0]?.text;
// Held somewhere on the cursor's way out: past the cluster's edge, short of
// where the pointer stopped, at the cursor's height.
const held = visible(after).filter(r => r.text === lastHover);
const heldNear = held.filter(r => r.l > c.x + c.r - 10 && r.l < leaveX + 60 && Math.abs(r.t - (leaveY + 18)) < 40);
check(held.length >= 8 && heldNear.length === held.length, 'leaving: the phrase stays where the cursor left it', `${heldNear.length}/${held.length} samples there, "${lastHover}"`);
const firstNew = visible(after).find(r => r.text !== lastHover);
check(!!firstNew, 'leaving: the next phrase arrives once its beat is up', firstNew?.text ?? '');
if (firstNew) {
  const d = Math.hypot(firstNew.cx - leaveX, firstNew.cy - leaveY);
  const dg = Math.hypot(firstNew.cx - firstNew.c.x, firstNew.cy - firstNew.c.y) / firstNew.c.r;
  console.log(`   "${firstNew.text}" at (${firstNew.cx.toFixed(0)}, ${firstNew.cy.toFixed(0)}), ${dg.toFixed(2)} radii from the graph's centre, ${d.toFixed(0)}px from the cursor`);
  // Measured box to disc, not centre to centre: a long phrase beside a small
  // cluster is legitimately more than two radii out (1280x800, r 71).
  const gap = Math.hypot(Math.max(Math.abs(firstNew.cx - firstNew.c.x) - firstNew.w / 2, 0), Math.max(Math.abs(firstNew.cy - firstNew.c.y) - firstNew.h / 2, 0)) - firstNew.c.r;
  check(gap > -0.1 * firstNew.c.r && gap < 90, 'leaving: the next phrase is beside the graph', `box ${gap.toFixed(0)}px off the disc`);
}
const stay = await watch(5000, 250);
check(phrases(stay).length >= 2, 'after leaving: the whisper keeps cycling', phrases(stay).join(' | '));
check(errors.length === 0, 'no console errors', errors.join(' / '));
await b.close();
console.log(`\n${pass + fail} checks, ${fail} failed`);
