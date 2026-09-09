import { chromium } from 'playwright';
import fs from 'node:fs';
fs.mkdirSync('wtn', { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });

// A: /nebula reached directly — the canonical composition
const a = await b.newPage({ viewport: { width: 1440, height: 900 } });
await a.goto('http://localhost:3100/nebula', { waitUntil: 'networkidle' });
await a.waitForTimeout(5000);
await a.screenshot({ path: 'wtn/direct.png' });
await a.close();

// B: /nebula reached from a rotated work page — must land identically
const c = await b.newPage({ viewport: { width: 1440, height: 900 } });
await c.goto('http://localhost:3100/work/zentra-web-platform', { waitUntil: 'networkidle' });
await c.waitForTimeout(4000);
await c.screenshot({ path: 'wtn/work-first.png' });
await c.evaluate(() => { document.querySelector('a[href="/nebula"]')?.click(); });
await c.goto('http://localhost:3100/nebula');  // header has no /nebula link; navigate
await c.waitForTimeout(5000);
await c.screenshot({ path: 'wtn/after-work.png' });
await c.close();
await b.close();
console.log('captured');
