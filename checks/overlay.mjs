import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
for (const [w,h] of [[1440,900],[1280,720],[1024,768],[390,844]]) {
  const p = await b.newPage({ viewport:{width:w,height:h} });
  await p.goto('http://localhost:3100/', { waitUntil:'networkidle' });
  await p.mouse.move(3,3);
  await p.waitForTimeout(7000);
  // where the pulse ring thinks the graph is
  const ring = await p.evaluate(() => {
    const el = document.querySelector('.cluster-pulse-ring');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { cx: r.x + r.width/2, cy: r.y + r.height/2, d: r.width };
  });
  // where the graph actually is, from the canvas
  const ink = await p.evaluate(async (b64) => {
    const img=new Image(); img.src='data:image/png;base64,'+b64; await img.decode();
    const c=document.createElement('canvas'); c.width=img.width;c.height=img.height;
    const g=c.getContext('2d',{willReadFrequently:true}); g.drawImage(img,0,0);
    const d=g.getImageData(0,0,img.width,img.height).data,W=img.width,H=img.height;
    let n=0,sx=0,sy=0,minX=1e9,maxX=-1;
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){
      const i=(y*W+x)*4; const v=244-d[i]; if(v<10) continue;
      n++;sx+=x;sy+=y; if(x<minX)minX=x; if(x>maxX)maxX=x; }
    return n?{cx:sx/n,cy:sy/n,span:maxX-minX}:null;
  }, (await p.evaluate(()=>{document.querySelectorAll('body > *:not(:has(canvas))').forEach(e=>e.style.visibility='hidden');}), (await p.screenshot()).toString('base64')));
  console.log(`${w}x${h}  ring ${ring?`centre (${ring.cx.toFixed(0)},${ring.cy.toFixed(0)}) d=${ring.d.toFixed(0)}`:'(none)'}   graph ink centre (${ink?ink.cx.toFixed(0):'?'},${ink?ink.cy.toFixed(0):'?'}) span=${ink?ink.span:'?'}`);
  if (ring && ink) console.log(`${''.padEnd(9)}overlay vs graph: ${Math.hypot(ring.cx-ink.cx, ring.cy-ink.cy).toFixed(0)}px apart`);
  await p.close();
}
await b.close();
