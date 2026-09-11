// Phone: does a drag stay a drag, does closing a front node leave the globe
// alone, and does closing a node round the back turn it and stop with the camera?
import { chromium } from "playwright";
import fs from "node:fs";
const base = process.env.BASE ?? 'http://localhost:3100';
fs.mkdirSync('closeturn', { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
let pass = 0, fail = 0;
const check = (ok, label, detail='') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`); ok ? pass++ : fail++; };

async function drag(p, dx, dy) {
  // A strip below the globe's middle, stepped so the harness sees every move.
  await p.mouse.move(60, 620); await p.mouse.down();
  const steps = 20;
  for (let i = 1; i <= steps; i++) { await p.mouse.move(60 + dx * i / steps, 620 + dy * i / steps); await p.waitForTimeout(25); }
  await p.mouse.up(); await p.waitForTimeout(1500);
}
const turn = (p) => p.evaluate(() => ({ ...window.__nebulaProbe.outsideTurn, url: location.pathname }));
// The probe publishes the turn as a quaternion: the angle between two, and from none.
const qd = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w)));
const turned = (t) => qd(t, { x: 0, y: 0, z: 0, w: 1 });

async function closeTrace(p) {
  const trace = p.evaluate(() => new Promise(res => { const out = []; const t0 = performance.now(); (function f(){ const q = window.__nebulaProbe; out.push({ t: performance.now()-t0, q: { ...q.outsideTurn }, z: q.position[2], x: q.position[0], flying: q.flying }); if (performance.now()-t0 < 3500) requestAnimationFrame(f); else res(out); })(); }));
  await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /back to the graph/i.test(b.textContent))?.click());
  const rows = await trace;
  const landed = rows.findIndex((r, i) => i > 2 && !r.flying && rows.slice(0, i).some(s => s.flying));
  let lastMove = -1;
  for (let i = 1; i < rows.length; i++) if (qd(rows[i].q, rows[i-1].q) > 1e-4) lastMove = i;
  return { rows, landed, lastMove, first: rows[0], end: rows[rows.length - 1] };
}

async function scenario(name, dragPx) {
  const p = await b.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:1, isMobile:true, hasTouch:true });
  await p.goto(base + '/nebula', { waitUntil: 'networkidle' }); await p.waitForTimeout(5000);
  await drag(p, dragPx, 0);
  const t0 = await turn(p);
  check(t0.url === '/nebula', `${name}: the drag did not open a node`, `url ${t0.url}, turned ${turned(t0).toFixed(2)} rad`);
  await p.evaluate(() => window.next.router.push('/nebula/vgclite'));
  await p.waitForTimeout(3000);
  const open = await p.evaluate(() => window.__nebulaProbe.position.map(v => +v.toFixed(1)));
  const r = await closeTrace(p);
  console.log(`   ${name}: opened at (${open}), turn moved ${qd(r.first.q, r.end.q).toFixed(3)} rad on close; landed ${r.landed >= 0 ? r.rows[r.landed].t.toFixed(0) : '?'}ms, last turn frame ${r.lastMove >= 0 ? r.rows[r.lastMove].t.toFixed(0) : 'none'}ms; camera end (${r.end.x.toFixed(2)}, ${r.end.z.toFixed(1)})`);
  check(Math.abs(r.end.x) < 0.01 && r.end.z > 40, `${name}: camera back on the axis`);
  await p.screenshot({ path: `closeturn/${name}-closed.png` });
  await p.close();
  return r;
}

const front = await scenario('front', 60);
check(front.lastMove === -1, 'front: closing did not turn the globe', `${qd(front.first.q, front.end.q).toFixed(4)} rad`);
const back = await scenario('back', 330);
const backTurn = qd(back.first.q, back.end.q);
check(backTurn > 0.3, 'back: a hidden node was turned to the front', `${backTurn.toFixed(2)} rad`);
check(back.landed >= 0 && back.lastMove <= back.landed + 1, 'back: the turn stopped with the camera', `landed frame ${back.landed}, last turn frame ${back.lastMove}`);
await b.close();
console.log(`\n${pass + fail} checks, ${fail} failed`);
