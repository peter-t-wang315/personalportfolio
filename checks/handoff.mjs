// Does the plane sit on the page at the moment of the hand-off home? Round
// trip home -> graph -> home from one page, then compares where the DOM hero
// column is with where the plane projects, in px. VIEWPORT=390x844 for the
// phone; default 1440x900. Shots in handoff/.
import { chromium } from 'playwright';
import fs from 'node:fs';
fs.mkdirSync('handoff', { recursive: true });
const base = process.env.BASE ?? 'http://localhost:3100';
const m = /^(\d+)x(\d+)$/.exec(process.env.VIEWPORT ?? '');
const V = m ? { width: +m[1], height: +m[2] } : { width: 1440, height: 900 };
const mobile = V.width < 768;
const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: V, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
await p.goto(base + '/', { waitUntil: 'networkidle' }); await p.waitForTimeout(5000);
const measure = () => p.evaluate(() => {
  const q = window.__nebulaProbe; const H = innerHeight, W = innerWidth;
  const K = H / 2 / Math.tan(q.fov * Math.PI / 360);
  const dz = q.position[2] - q.home.position[2];
  const cx = W / 2 + (q.home.position[0] - q.position[0]) * K / dz;
  const cy = H / 2 - (q.home.position[1] - q.position[1]) * K / dz;
  const w = q.home.width * K / dz, h = q.home.height * K / dz;
  const r = document.getElementById('hero-column')?.getBoundingClientRect();
  return { plane: { cx, cy, w, h, op: q.home.opacity }, dom: r ? { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width, h: r.height } : null, cam: q.position, d: q.distance, scrollY };
});
console.log('at home, before:', JSON.stringify(await measure()));
await p.evaluate(() => { const c = window.__nebulaProbe.cluster; const o = { clientX: c.x, clientY: c.y, button: 0, bubbles: true }; document.body.dispatchEvent(new PointerEvent('pointerdown', o)); document.body.dispatchEvent(new MouseEvent('click', o)); });
await p.waitForTimeout(4500);
await p.evaluate(() => document.querySelector('a[href="/"]').click());
await p.waitForTimeout(3150);
for (let i = 0; i < 4; i++) {
  const s = await measure();
  const dx = s.dom ? (s.plane.cx - s.dom.cx).toFixed(1) : '-', dy = s.dom ? (s.plane.cy - s.dom.cy).toFixed(1) : '-';
  console.log(`landed+${i}: plane op ${s.plane.op.toFixed(2)} plane-dom dx ${dx} dy ${dy} | plane ${s.plane.w.toFixed(0)}x${s.plane.h.toFixed(0)} dom ${s.dom?.w.toFixed(0)}x${s.dom?.h.toFixed(0)} | cam (${s.cam.map(v=>v.toFixed(1)).join(',')}) scrollY ${s.scrollY}`);
  await p.screenshot({ path: `handoff/${V.width}x${V.height}-${i}.png` });
  await p.waitForTimeout(150);
}
await p.close(); await b.close();
