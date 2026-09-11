// Does a drag on a portrait phone turn the globe rather than the camera, does
// closing a node bring the camera back to the axis, and does the turn unwind by the time the reader is
// home? Reads window.__nebulaProbe.outsideTurn. Also the round trip's hand-off:
// home -> graph -> home from one page, shot during the plane's dissolve.
import { chromium } from 'playwright';
import fs from 'node:fs';
fs.mkdirSync('outsideturn', { recursive: true });
const base = process.env.BASE ?? 'http://localhost:3100';
const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const page = () => b.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
const probe = (p) => p.evaluate(() => { const q = window.__nebulaProbe; return { d: q.distance, x: q.position[0], y: q.position[1], z: q.position[2], turn: { ...q.outsideTurn }, flying: q.flying }; });
// How far the globe is turned from where it started, in radians: the probe publishes the turn as a quaternion.
const turned = (t) => 2 * Math.acos(Math.min(1, Math.abs(t.w)));
let pass = 0, fail = 0;
const check = (ok, label, detail='') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`); ok ? pass++ : fail++; };

let p = await page();
await p.goto(base + '/nebula', { waitUntil: 'networkidle' }); await p.waitForTimeout(5000);
let q = await probe(p);
check(Math.abs(q.x) < 0.01 && Math.abs(q.y) < 0.01 && q.z > 40, 'outside pose is on the axis', `(${q.x.toFixed(2)}, ${q.y.toFixed(2)}, ${q.z.toFixed(1)})`);
await p.mouse.move(195, 500); await p.mouse.down();
for (let i = 1; i <= 10; i++) { await p.mouse.move(195 + i * 15, 500 - i * 4); await p.waitForTimeout(30); }
await p.mouse.up(); await p.waitForTimeout(800);
q = await probe(p);
check(turned(q.turn) > 0.3, 'drag turned the globe', `${turned(q.turn).toFixed(2)} rad`);
check(Math.abs(q.x) < 0.01 && Math.abs(q.y) < 0.01, 'and the camera stayed on the axis', `(${q.x.toFixed(2)}, ${q.y.toFixed(2)}, ${q.z.toFixed(1)})`);
await p.screenshot({ path: 'outsideturn/after-drag.png' });
// Open a node by tapping one: find a project mesh hit by tapping the centre area is unreliable,
// so navigate and close instead — closing is the code-set turn.
await p.evaluate(() => history.pushState({}, '', '/nebula/vgclite'));
await p.goto(base + '/nebula/vgclite', { waitUntil: 'networkidle' }); await p.waitForTimeout(5000);
await p.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('Back to the graph'))?.click());
await p.waitForTimeout(2500);
q = await probe(p);
check(Math.abs(q.x) < 0.01 && Math.abs(q.y) < 0.01 && q.z > 40, 'closing a node returns the camera to the axis', `(${q.x.toFixed(2)}, ${q.y.toFixed(2)}, ${q.z.toFixed(1)}) turned ${turned(q.turn).toFixed(2)} rad`);
await p.screenshot({ path: 'outsideturn/after-close.png' });
await p.close();

// Round trip from one page: home -> graph -> drag -> home.
p = await page();
await p.goto(base + '/', { waitUntil: 'networkidle' }); await p.waitForTimeout(5000);
await p.evaluate(() => { const c = window.__nebulaProbe.cluster; const o = { clientX: c.x, clientY: c.y, button: 0, bubbles: true }; document.body.dispatchEvent(new PointerEvent('pointerdown', o)); document.body.dispatchEvent(new MouseEvent('click', o)); });
await p.waitForTimeout(4500);
await p.mouse.move(195, 500); await p.mouse.down();
for (let i = 1; i <= 10; i++) { await p.mouse.move(195 + i * 15, 500); await p.waitForTimeout(30); }
await p.mouse.up(); await p.waitForTimeout(800);
q = await probe(p);
check(turned(q.turn) > 0.3, 'round trip: drag turned the globe', `${turned(q.turn).toFixed(2)} rad`);
const t0 = await p.evaluate(() => performance.now());
await p.evaluate(() => document.querySelector('a[href="/"]').click());
await p.waitForTimeout(3300);
await p.screenshot({ path: 'outsideturn/round-home-3300.png' });
await p.waitForTimeout(1200);
q = await probe(p);
check(turned(q.turn) < 1e-3, 'home again: the turn is forgotten', `${turned(q.turn).toFixed(4)} rad`);
check(p.url().endsWith('/'), 'round trip finished at home', p.url());
await p.screenshot({ path: 'outsideturn/round-home-rest.png' });
await p.close();
await b.close();
console.log(`\n${pass + fail} checks, ${fail} failed`);
