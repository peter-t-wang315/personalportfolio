// Pixel-exact composition baseline for Part 3. Reduced motion freezes the
// wander, zeroes parallax and makes flights cuts, so two captures of the same
// build are identical and any difference is a real change.
import { chromium } from 'playwright';
import fs from 'node:fs';
const tag = process.argv[2];
const dir = `part3-${tag}`; fs.mkdirSync(dir, { recursive: true });
const routes = ['/', '/work', '/work/station-supervisor', '/about', '/nebula'];
const viewports = [[1440,900],[1280,720],[1024,768],[900,700],[844,390],[390,844]];
const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
for (const [w,h] of viewports) {
  const p = await b.newPage({ viewport:{width:w,height:h}, reducedMotion:'reduce' });
  for (const route of routes) {
    await p.goto('http://localhost:3100'+route, { waitUntil:'networkidle' });
    // Scene only. Everything that is not the canvas is hidden: the affordance
    // label spawns at Math.random() positions on the tablet tier and the scroll
    // cue is a CSS animation, neither of which Part 3 touches, and both of
    // which made two captures of one build differ.
    await p.addStyleTag({ content: 'body > *:not(:has(canvas)) { visibility: hidden !important; }' });
    await p.mouse.move(3, 3);
    await p.waitForTimeout(route === '/nebula' ? 6000 : 4000);
    await p.screenshot({ path: `${dir}/${w}x${h}${route.replace(/\//g,'_')||'_'}.png` });
  }
  await p.close();
}
await b.close();
console.log(`captured ${routes.length * viewports.length} frames into ${dir}/`);
