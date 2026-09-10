import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
for (const [w,h,name] of [[1440,900,'desktop'],[1280,720,'laptop'],[1024,768,'small desktop'],[900,700,'tablet'],[844,390,'landscape phone'],[390,844,'phone']]) {
  const p = await b.newPage({ viewport:{width:w,height:h} });
  await p.goto('http://localhost:3100/work/selective-solder-driver', { waitUntil:'networkidle' });
  await p.waitForTimeout(12000);
  const r = await p.evaluate(() => {
    const els=[...document.querySelectorAll('div')].filter(d=>d.className&&String(d.className).includes('max-w-[130px]'));
    const vis=els.filter(d=>d.style.opacity==='1');
    const bx=vis.map(d=>{const q=d.getBoundingClientRect();return {x:q.x,y:q.y,w:q.width,h:q.height};});
    let worst=0; for(let i=0;i<bx.length;i++)for(let j=i+1;j<bx.length;j++){
      const a=bx[i],c=bx[j];
      const ox=Math.min(a.x+a.w,c.x+c.w)-Math.max(a.x,c.x), oy=Math.min(a.y+a.h,c.y+c.h)-Math.max(a.y,c.y);
      if(ox>0&&oy>0) worst=Math.max(worst,ox*oy); }
    // do any labels sit over the article column?
    const art=document.querySelector('main .max-w-\\[66ch\\]')?.getBoundingClientRect();
    let overText=0;
    if(art) for(const a of bx){ const ox=Math.min(a.x+a.w,art.x+art.width)-Math.max(a.x,art.x);
      const oy=Math.min(a.y+a.h,art.y+art.height)-Math.max(a.y,art.y); if(ox>0&&oy>0) overText++; }
    return { visible: vis.length, worst: Math.round(worst), overText };
  });
  console.log(`${name.padEnd(16)} ${String(w)+'x'+h}`.padEnd(30) + `${r.visible} labels, worst overlap ${r.worst}px^2, ${r.overText} over the article`);
  await p.close();
}
await b.close();
