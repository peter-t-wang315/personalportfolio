// Does the graph fade at the start of a phone flight? Shots at DPR 2, which is
// what a phone actually is — the DPR-1 harness draws 3px nodes too faint to
// judge. Writes phonefade/*.png.
import { chromium } from 'playwright';
import fs from 'node:fs';
fs.mkdirSync('phonefade', { recursive: true });
const base = process.env.BASE ?? 'http://localhost:3100';
const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const ctx = () => b.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
async function burst(p, label, t0) {
  for (let i = 0; i < 10; i++) {
    const now = await p.evaluate(() => performance.now());
    const d = await p.evaluate(() => window.__nebulaProbe?.distance);
    await p.screenshot({ path: `phonefade/${label}-${String(Math.round(now - t0)).padStart(4,'0')}ms-d${Math.round(d)}.png` });
    if (now - t0 > 3600) break;
  }
}
let p = await ctx();
await p.goto(base + '/', { waitUntil: 'networkidle' }); await p.waitForTimeout(6000);
await p.screenshot({ path: 'phonefade/in-rest.png' });
let t0 = await p.evaluate(() => performance.now());
await p.evaluate(() => { const c = window.__nebulaProbe.cluster; const o = { clientX: c.x, clientY: c.y, button: 0, bubbles: true }; document.body.dispatchEvent(new PointerEvent('pointerdown', o)); document.body.dispatchEvent(new MouseEvent('click', o)); });
await burst(p, 'in', t0);
await p.close();
p = await ctx();
await p.goto(base + '/nebula', { waitUntil: 'networkidle' }); await p.waitForTimeout(6000);
await p.screenshot({ path: 'phonefade/out-rest.png' });
t0 = await p.evaluate(() => performance.now());
await p.evaluate(() => document.querySelector('a[href="/"]').click());
await burst(p, 'out', t0);
await p.close();
await b.close();
console.log(fs.readdirSync('phonefade').join('\n'));
