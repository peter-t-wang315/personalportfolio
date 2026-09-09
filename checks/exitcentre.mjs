import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
for (const slug of ['station-supervisor','vgclite','thai-ginger','selective-solder-driver']) {
  const p = await b.newPage({ viewport:{width:1280,height:800} });
  await p.goto(`http://localhost:3100/nebula/${slug}`, { waitUntil:'networkidle' });
  await p.waitForTimeout(12000);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(3000);
  // is a node under the centre of the frame?
  let found = null;
  for (const r of [0, 12, 24, 40, 60]) {
    for (const [dx,dy] of [[0,0],[r,0],[-r,0],[0,r],[0,-r]]) {
      await p.mouse.move(640+dx, 400+dy); await p.waitForTimeout(120);
      const c = await p.evaluate(()=>document.documentElement.dataset.globeCursor);
      if (c === 'node') { found = Math.hypot(dx,dy); break; }
    }
    if (found !== null) break;
  }
  console.log(`${slug.padEnd(26)} after Escape, nearest node to frame centre: ${found === null ? 'none within 60px' : found.toFixed(0)+'px'}`);
  await p.close();
}
await b.close();
