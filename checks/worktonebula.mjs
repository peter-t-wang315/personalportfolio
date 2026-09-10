import { chromium } from 'playwright';
import fs from 'node:fs';
fs.mkdirSync('wtn', { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });

// A: /nebula reached directly — the canonical composition
const a = await b.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
await a.goto('http://localhost:3100/nebula', { waitUntil: 'networkidle' });
await a.waitForTimeout(5000);
await a.addStyleTag({ content: 'body > *:not(:has(canvas)) { visibility: hidden !important; }' });
await a.waitForTimeout(300);
await a.screenshot({ path: 'wtn/rm-direct.png' });
await a.close();

// B: /nebula reached from a rotated work page — must land identically.
//
// **This leg is a full page load, and that is a real limitation of this check
// rather than a detail.** Nothing on `/work/[slug]` links to bare `/nebula`
// client-side — the only in-page way into the graph from there is a tech link
// to `/nebula/tech/[id]`, and closing that lands facing the node you left
// (restingPoseFacing), which is a deliberately different composition. So what
// this compares is two cold loads, and what it proves is that a cold `/nebula`
// is deterministic. The unwind it was written to catch — a work page's
// spotlight orientation leaking into the interior framing — is not currently
// reachable by any user path, and is therefore not currently exercised here.
const c = await b.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
await c.goto('http://localhost:3100/work/zentra-web-platform', { waitUntil: 'networkidle' });
await c.waitForTimeout(4000);
await c.screenshot({ path: 'wtn/work-first.png' });
await c.evaluate(() => { document.querySelector('a[href="/nebula"]')?.click(); });
await c.goto('http://localhost:3100/nebula');  // header has no /nebula link; navigate
await c.waitForTimeout(5000);
await c.addStyleTag({ content: 'body > *:not(:has(canvas)) { visibility: hidden !important; }' });
await c.waitForTimeout(300);
await c.screenshot({ path: 'wtn/rm-via-work.png' });
await c.close();
await b.close();
console.log('captured wtn/rm-direct.png and wtn/rm-via-work.png — run wtndiff.mjs');
