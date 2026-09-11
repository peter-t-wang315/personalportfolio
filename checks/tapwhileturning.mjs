// Phone: tapping a node while the globe is still turning. The camera parks
// against the globe as it is at the tap; if the turn carries on after that,
// the node — and the shell it opens into — slides out from under the camera.
// Staged with the one code-set turn left: close a node round the back (the
// globe turns it to the front over ~0.8s) and open another partway through.
// By route push, because a tap is switched off while that flight runs; a
// panel link or back/forward is not, and before the close turn rode the
// flight's clock its spring ran on for two seconds after landing, when taps
// were live.
import { chromium } from "playwright";
import fs from "node:fs";
const base = process.env.BASE ?? 'http://localhost:3100';
fs.mkdirSync('tapwhileturning', { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
let pass = 0, fail = 0;
const check = (ok, label, detail='') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`); ok ? pass++ : fail++; };

const p = await b.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
await p.goto(base + '/nebula', { waitUntil: 'networkidle' }); await p.waitForTimeout(5000);
await p.mouse.move(60, 620); await p.mouse.down();
for (let i = 1; i <= 20; i++) { await p.mouse.move(60 + 330 * i / 20, 620); await p.waitForTimeout(25); }
await p.mouse.up(); await p.waitForTimeout(1500);
await p.evaluate(() => window.next.router.push('/nebula/vgclite'));
await p.waitForTimeout(3000);

// Close, then open another node 450ms in — mid-turn — and trace the turn.
const rows = await p.evaluate(() => new Promise(res => {
  const out = []; const t0 = performance.now(); let opened = false;
  [...document.querySelectorAll('button')].find(b => /back to the graph/i.test(b.textContent))?.click();
  (function f() {
    const q = window.__nebulaProbe; const t = performance.now() - t0;
    if (!opened && t > 450) { opened = true; window.next.router.push('/nebula/timesense'); }
    out.push({ t, q: { ...q.outsideTurn }, flying: q.flying, url: location.pathname });
    if (t < 3500) requestAnimationFrame(f); else res(out);
  })();
}));
// The probe publishes the turn as a quaternion: the angle between two of them.
const qd = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w)));
const beforeOpen = rows.filter(r => r.t <= 450);
const turning = beforeOpen.length > 2 && qd(beforeOpen.at(-1).q, beforeOpen.at(-3).q) > 1e-3;
check(turning, 'staged: the globe was still turning at the tap', beforeOpen.length > 2 ? `${qd(beforeOpen.at(-1).q, beforeOpen.at(-3).q).toFixed(4)} rad over two frames` : '');
// From two frames after the tap (the route effect has run) to the end.
const afterOpen = rows.filter(r => r.t > 450);
const from = afterOpen[2], to = afterOpen.at(-1);
const moved = qd(to.q, from.q);
check(moved < 1e-3, 'the turn held once the node opened', `${moved.toFixed(5)} rad after`);
check(to.url === '/nebula/timesense', 'landed on the node', to.url);
await p.screenshot({ path: 'tapwhileturning/opened.png' });
await b.close();
console.log(`\n${pass + fail} checks, ${fail} failed`);
