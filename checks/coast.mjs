// Phone: does letting go of a drag keep the globe drifting a little and then
// come to rest? Does a drag that stops before lifting stay put? Does a press
// catch the drift — and does a node opening mid-drift open against a globe
// that has stopped, so its shell stays under the camera?
import { chromium } from "playwright";
import fs from "node:fs";
const base = process.env.BASE ?? 'http://localhost:3100';
fs.mkdirSync('coast', { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
let pass = 0, fail = 0;
const check = (ok, label, detail='') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`); ok ? pass++ : fail++; };

const p = await b.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:1, isMobile:true, hasTouch:true });
await p.goto(base + '/nebula', { waitUntil: 'networkidle' }); await p.waitForTimeout(5000);

// Per-frame turn, optionally doing something in the page at a given time.
const trace = (ms, pushAt = null, url = null) => p.evaluate(([ms, pushAt, url]) => new Promise(res => {
  const out = []; const t0 = performance.now(); let pushed = false;
  (function f() {
    const t = performance.now() - t0; const q = window.__nebulaProbe;
    if (pushAt !== null && !pushed && t > pushAt) { pushed = true; window.next.router.push(url); }
    out.push({ t, q: { ...q.outsideTurn } });
    if (t < ms) requestAnimationFrame(f); else res(out);
  })();
}), [ms, pushAt, url]);
// The probe publishes the turn as a quaternion: the angle between two of them.
const qd = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w)));
const lastChange = (rows) => { let at = -1; for (let i = 1; i < rows.length; i++) if (qd(rows[i].q, rows[i-1].q) > 1e-4) at = rows[i].t; return at; };
async function drag(from, stepPx, steps, gapMs) {
  await p.mouse.move(from, 620); await p.mouse.down();
  for (let i = 1; i <= steps; i++) { await p.mouse.move(from + i * stepPx, 620); await p.waitForTimeout(gapMs); }
}
const turnNow = () => p.evaluate(() => ({ ...window.__nebulaProbe.outsideTurn }));

// 1. A flick drifts on, then rests. Measured from *before* the drag, less the
// drag itself (12 x 20px at 0.006 rad/px): the probe only reads the turn when
// the scene draws, so a reading taken at release misses the last moves the
// harness's ~9fps has not drawn yet — 0.12 rad each, which read as overshoot.
let y0 = await turnNow();
await drag(40, 20, 12, 16);
let tr = trace(2000); await p.mouse.up(); let rows = await tr;
// One axis the whole way (a horizontal drag and its drift), so angles add.
const drift = qd(rows.at(-1).q, y0) - 12 * 20 * 0.006;
const restAt = lastChange(rows);
// A little: the cap is 3 rad/s × 0.2s = 0.6 rad, whatever the frame rate.
check(drift > 0.05 && drift < 0.65, 'flick: the globe drifts on a little after letting go', `${drift.toFixed(3)} rad further`);
check(restAt > 0 && restAt < 1600, 'flick: and comes to rest', `last movement ${restAt.toFixed(0)}ms after release`);
const early = rows.filter(r => r.t < 150), late = rows.filter(r => r.t > 300 && r.t < 450);
const rate = (rs) => rs.length > 1 ? qd(rs.at(-1).q, rs[0].q) / ((rs.at(-1).t - rs[0].t) / 1000) : 0;
check(rate(early) > rate(late), 'flick: slowing down as it goes', `${rate(early).toFixed(2)} -> ${rate(late).toFixed(2)} rad/s`);

// 2. A drag that stops before lifting stays put. The pause is long enough for
// the scene to have drawn the drag's end, so a reading at release is current.
await drag(40, 15, 10, 20);
await p.waitForTimeout(250);
y0 = await turnNow();
tr = trace(1000); await p.mouse.up(); rows = await tr;
check(qd(rows.at(-1).q, y0) < 1e-3, 'placed: a drag that stops before lifting does not drift', `${qd(rows.at(-1).q, y0).toFixed(4)} rad`);

// 3. A press catches the drift. Pressed in the bottom corner, away from nodes.
await drag(40, 20, 12, 16);
await p.mouse.up(); await p.waitForTimeout(120);
const turnBeforePress = await turnNow();
await p.mouse.move(20, 830); await p.mouse.down();
rows = await trace(800); await p.mouse.up();
const caught = qd(rows.at(-1).q, rows[2].q);
check(qd(rows[0].q, turnBeforePress) > 1e-3, 'press: was still drifting when pressed', `${qd(rows[0].q, turnBeforePress).toFixed(3)} rad between reading and press`);
check(caught < 1e-3, 'press: the drift stops dead', `${caught.toFixed(4)} rad after the press`);
await p.waitForTimeout(500);

// 4. A node opening mid-drift (not a press: a route change) holds the globe.
await drag(40, 20, 12, 16);
tr = trace(2500, 100, '/nebula/vgclite'); await p.mouse.up(); rows = await tr;
const afterOpen = rows.filter(r => r.t > 100);
const moved = qd(afterOpen.at(-1).q, afterOpen[2].q);
check(rows.filter(r => r.t <= 100).length > 1 && qd(rows.filter(r => r.t <= 100).at(-1).q, rows[0].q) > 1e-3, 'open: was drifting when the node opened');
check(moved < 1e-3, 'open: the globe held from the moment the node opened', `${moved.toFixed(4)} rad after`);
await p.screenshot({ path: 'coast/opened-mid-drift.png' });

await b.close();
console.log(`\n${pass + fail} checks, ${fail} failed`);
