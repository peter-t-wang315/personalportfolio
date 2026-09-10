// Does a drag on a portrait phone turn the globe rather than the camera, does
// closing a node face it, and does the turn unwind by the time the reader is
// home? Reads window.__nebulaProbe.outsideTurn. Also the round trip's hand-off:
// home -> graph -> home from one page, shot during the plane's dissolve.
import { chromium } from 'playwright';
import fs from 'node:fs';
fs.mkdirSync('outsideturn', { recursive: true });
const base = process.env.BASE ?? 'http://localhost:3100';
const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const page = () => b.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
const probe = (p) => p.evaluate(() => { const q = window.__nebulaProbe; return { d: q.distance, x: q.position[0], y: q.position[1], z: q.position[2], turn: q.outsideTurn, flying: q.flying }; });
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
check(Math.abs(q.turn.yaw) > 0.3, 'drag turned the globe', `yaw ${q.turn.yaw.toFixed(2)} pitch ${q.turn.pitch.toFixed(2)}`);
check(Math.abs(q.x) < 0.01 && Math.abs(q.y) < 0.01, 'and the camera stayed on the axis', `(${q.x.toFixed(2)}, ${q.y.toFixed(2)}, ${q.z.toFixed(1)})`);
await p.screenshot({ path: 'outsideturn/after-drag.png' });
// Open a node by tapping one: find a project mesh hit by tapping the centre area is unreliable,
// so navigate and close instead — closing is the code-set turn.
await p.evaluate(() => history.pushState({}, '', '/nebula/vgclite'));
await p.goto(base + '/nebula/vgclite', { waitUntil: 'networkidle' }); await p.waitForTimeout(5000);
await p.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('Back to the graph'))?.click());
await p.waitForTimeout(2500);
q = await probe(p);
check(Math.abs(q.x) < 0.01 && Math.abs(q.y) < 0.01 && q.z > 40, 'closing a node returns the camera to the axis', `(${q.x.toFixed(2)}, ${q.y.toFixed(2)}, ${q.z.toFixed(1)}) turn yaw ${q.turn.yaw.toFixed(2)} pitch ${q.turn.pitch.toFixed(2)}`);
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
check(Math.abs(q.turn.yaw) > 0.3, 'round trip: drag turned the globe', `yaw ${q.turn.yaw.toFixed(2)}`);
const t0 = await p.evaluate(() => performance.now());
await p.evaluate(() => document.querySelector('a[href="/"]').click());
await p.waitForTimeout(3300);
await p.screenshot({ path: 'outsideturn/round-home-3300.png' });
await p.waitForTimeout(1200);
q = await probe(p);
check(Math.abs(q.turn.yaw) < 1e-6 && Math.abs(q.turn.pitch) < 1e-6, 'home again: the turn is forgotten', `yaw ${q.turn.yaw.toFixed(3)}`);
check(p.url().endsWith('/'), 'round trip finished at home', p.url());
await p.screenshot({ path: 'outsideturn/round-home-rest.png' });
await p.close();
await b.close();
console.log(`\n${pass + fail} checks, ${fail} failed`);
