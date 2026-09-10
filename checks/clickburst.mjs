import { chromium } from 'playwright';
import fs from 'node:fs';
fs.mkdirSync('burst', { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
async function run(label, from, click) {
  const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  await p.goto('http://localhost:3100' + from, { waitUntil: 'networkidle' });
  await p.waitForTimeout(5000);
  const t0 = await p.evaluate(() => performance.now());
  await p.evaluate(click);
  for (let i = 0; i < 14; i++) {
    const now = await p.evaluate(() => performance.now());
    await p.screenshot({ path: `burst/${label}-${String(Math.round(now - t0)).padStart(4,'0')}.png` });
  }
  await p.close();
}
await run('in', '/', () => { const c = window.__nebulaProbe.cluster; const o = { clientX: c.x, clientY: c.y, button: 0, bubbles: true }; document.body.dispatchEvent(new PointerEvent('pointerdown', o)); document.body.dispatchEvent(new MouseEvent('click', o)); });
await run('out', '/nebula', () => document.querySelector('a[href="/"]').click());
await b.close();
console.log(fs.readdirSync('burst').join(' '));
