import { chromium } from 'playwright';
const base = 'http://localhost:3100';
const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
let bad = 0, n = 0;
for (const route of ['/', '/about', '/work', '/resume', '/work/station-supervisor', '/nebula'])
  for (const [w, h] of [[1440,900], [1024,768], [768,1024], [390,844], [844,390]])
    for (const rm of [false, true]) {
      n++;
      const p = await b.newPage({ viewport: { width: w, height: h }, ...(rm ? { reducedMotion: 'reduce' } : {}) });
      const msgs = [];
      p.on('console', m => { if (m.type() === 'error') msgs.push(m.text()); });
      p.on('pageerror', e => msgs.push('PAGEERROR ' + e.message));
      await p.goto(base + route, { waitUntil: 'networkidle' });
      await p.waitForTimeout(1200);
      const hasCanvas = await p.evaluate(() => !!document.querySelector('canvas'));
      const scrollX = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      if (msgs.length || !hasCanvas || scrollX) {
        bad++;
        console.log(`FAIL ${route} ${w}x${h} rm=${rm}`, !hasCanvas ? '(no canvas)' : '', scrollX ? '(h-scroll)' : '');
        msgs.slice(0,1).forEach(m => console.log('   ', m.slice(0,300)));
      }
      await p.close();
    }
console.log(`\n${n} combinations checked, ${bad} failures`);
await b.close();
