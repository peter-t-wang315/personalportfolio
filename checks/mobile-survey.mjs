import { chromium, devices } from 'playwright';
const base = 'http://localhost:3100';
const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const routes = ['/', '/about', '/work', '/resume', '/work/station-supervisor', '/nebula', '/nebula/station-supervisor', '/nebula/tech/csharp'];
const vps = [[390,844],[360,800],[844,390],[768,1024]];
for (const [w,h] of vps) for (const route of routes) {
  const p = await b.newPage({ viewport:{width:w,height:h}, hasTouch:true, isMobile:true, deviceScaleFactor:2 });
  const msgs=[]; p.on('console',m=>{ if(m.type()==='error') msgs.push(m.text()); }); p.on('pageerror',e=>msgs.push('PAGEERROR '+e.message));
  await p.goto(base+route,{waitUntil:'networkidle'}); await p.waitForTimeout(2500);
  const info = await p.evaluate(()=>({
    sw: document.documentElement.scrollWidth, iw: window.innerWidth, sh: document.documentElement.scrollHeight, ih: window.innerHeight,
    canvas: !!document.querySelector('canvas'),
    probe: window.__nebulaProbe ? { placement: window.__nebulaProbe.placement, fov: window.__nebulaProbe.fov, dist: window.__nebulaProbe.distance } : null,
    scene: window.__nebulaScene ? Object.keys(window.__nebulaScene) : null,
  }));
  const tag = `${w}x${h}${route.replace(/\//g,'_')||'_root'}`;
  await p.screenshot({ path:`mobile/${tag}.png`, fullPage: route.startsWith('/nebula') ? false : true });
  console.log(tag, JSON.stringify(info), msgs.length? 'ERR '+msgs[0].slice(0,200):'');
  await p.close();
}
// tap-through on a phone: land, tap the cluster, watch the flight land on /nebula
const p = await b.newPage({ viewport:{width:390,height:844}, hasTouch:true, isMobile:true, deviceScaleFactor:2 });
await p.goto(base+'/',{waitUntil:'networkidle'}); await p.waitForTimeout(2500);
const circle = await p.evaluate(()=> window.__nebulaProbe?.cluster ?? window.__nebulaProbe);
console.log('cluster', JSON.stringify(circle));
const c = circle?.cluster ?? circle;
if (c && c.x!=null) { await p.touchscreen.tap(c.x, c.y); }
for (let i=0;i<6;i++){ await p.waitForTimeout(500); await p.screenshot({path:`mobile/tap-${i}.png`}); }
await p.waitForTimeout(2000);
console.log('after tap url', p.url());
await p.screenshot({path:'mobile/tap-final.png'});
await p.close();
await b.close();
