// Screenshots /work/[slug] at desktop viewports, with the probe's distance —
// for judging the spotlight zoom. Writes work-shots/<tag>.png.
import { chromium } from 'playwright';
const base = process.env.BASE ?? 'http://localhost:3100';
const tag = process.env.TAG ?? 'now';
const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
for (const [w,h] of [[1440,900],[1280,720],[1920,1080]]) {
  const p = await b.newPage({ viewport:{width:w,height:h} });
  await p.goto(base+'/work/station-supervisor',{waitUntil:'networkidle'}); await p.waitForTimeout(3000);
  const q = await p.evaluate(()=>({ d: window.__nebulaProbe.distance, c: window.__nebulaProbe.cluster }));
  console.log(`${w}x${h} d=${q.d.toFixed(1)} circle=(${q.c.x.toFixed(0)},${q.c.y.toFixed(0)}) r=${q.c.r.toFixed(0)}`);
  await p.screenshot({ path:`work-shots/${tag}-${w}x${h}.png` });
  await p.close();
}
await b.close();
