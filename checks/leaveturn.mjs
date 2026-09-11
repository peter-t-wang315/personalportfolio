// Phone: leaving the graph for home after turning the globe. Does the globe
// leave from where the reader turned it, unwinding with the flight, or does it
// jump to the orientation it arrived in on the first frame? Traces the outside
// turn, the placement and the flight on every frame from the tap on Home.
import { chromium } from "playwright";
const base = process.env.BASE ?? 'http://localhost:3100';
const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
let pass = 0, fail = 0;
const check = (ok, label, detail='') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`); ok ? pass++ : fail++; };
const turned = (q) => 2 * Math.acos(Math.min(1, Math.abs(q.w)));
const qd = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w)));

const p = await b.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:1, isMobile:true, hasTouch:true });
await p.goto(base + '/', { waitUntil: 'networkidle' }); await p.waitForTimeout(5000);
// In from home, as a reader would, so the way out is the real round trip.
await p.evaluate(() => { const c = window.__nebulaProbe.cluster; const o = { clientX: c.x, clientY: c.y, button: 0, bubbles: true }; document.body.dispatchEvent(new PointerEvent('pointerdown', o)); document.body.dispatchEvent(new MouseEvent('click', o)); });
await p.waitForTimeout(5000);
// Turn the globe well away from its arrival orientation, placed (no drift).
await p.mouse.move(80, 520); await p.mouse.down();
for (let i = 1; i <= 20; i++) { await p.mouse.move(80 + i * 12, 520 + i * 4); await p.waitForTimeout(25); }
await p.waitForTimeout(250); await p.mouse.up(); await p.waitForTimeout(800);
const before = await p.evaluate(() => ({ ...window.__nebulaProbe.outsideTurn }));

const tr = p.evaluate(() => new Promise(res => {
  const out = []; const t0 = performance.now();
  (function f() { const q = window.__nebulaProbe; out.push({ t: performance.now() - t0, q: { ...q.outsideTurn }, placement: q.placement, flying: q.flying }); if (performance.now() - t0 < 4000) requestAnimationFrame(f); else res(out); })();
}));
const box = await p.evaluate(() => { const a = [...document.querySelectorAll('a[href="/"]')].find(el => el.getBoundingClientRect().width > 0); const r = a.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
await p.touchscreen.tap(box.x, box.y);
const rows = await tr;

console.log(`turned ${turned(before).toFixed(2)} rad before leaving`);
for (const r of rows.filter((_, i) => i < 8 || i % 6 === 0)) console.log(`   ${r.t.toFixed(0).padStart(5)}ms  turn ${turned(r.q).toFixed(3)}  from-before ${qd(r.q, before).toFixed(3)}  placement ${r.placement.toFixed(3)}  ${r.flying ? 'flying' : ''}`);
// While the graph is still mostly placed (placement > 0.5), the turn it
// carries must be the reader's; the placement's own slerp does the unwinding.
const early = rows.filter(r => r.placement > 0.5);
const jumped = early.filter(r => qd(r.q, before) > 1e-3);
check(early.length > 0, 'the departure was traced while the graph was still placed', `${early.length} frames`);
check(jumped.length === 0, 'the globe leaves from where the reader turned it', jumped.length ? `turn reset ${jumped[0].t.toFixed(0)}ms after the tap, at placement ${jumped[0].placement.toFixed(3)}` : `turn held on all ${early.length} frames`);
const end = rows.at(-1);
check(end.placement < 0.01 && turned(end.q) < 1e-3, 'and is forgotten once home', `placement ${end.placement.toFixed(3)}, turn ${turned(end.q).toFixed(4)}`);
await b.close();
console.log(`\n${pass + fail} checks, ${fail} failed`);
