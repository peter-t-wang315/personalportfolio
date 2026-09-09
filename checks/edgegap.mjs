import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
for (const slug of ['selective-solder-driver','station-supervisor','preventive-maintenance-services']) {
  const p = await b.newPage({ viewport:{width:1440,height:900} });
  await p.goto(`http://localhost:3100/work/${slug}`, { waitUntil:'networkidle' });
  await p.mouse.move(720,450); await p.waitForTimeout(13000);
  const r = await p.evaluate(() => {
    const els=[...document.querySelectorAll('div')].filter(d=>d.className&&String(d.className).includes('max-w-[130px]'));
    const vis=els.filter(d=>d.style.opacity==='1');
    const rows = vis.map(d=>{
      const q=d.getBoundingClientRect();
      const m=/translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(d.style.transform);
      const tx=m?+m[1]:0, ty=m?+m[2]:0;
      // Html center puts the box centre at the node before the transform
      const nx=q.x+q.width/2-tx, ny=q.y+q.height/2-ty;
      // distance from the node point to the label rectangle
      const ddx=Math.max(q.x-nx, 0, nx-(q.x+q.width));
      const ddy=Math.max(q.y-ny, 0, ny-(q.y+q.height));
      return { t:d.textContent.trim(), gap: Math.hypot(ddx,ddy) };
    }).sort((a,c)=>c.gap-a.gap);
    let worst=0,pair='';
    const bx=vis.map(d=>d.getBoundingClientRect());
    for(let i=0;i<bx.length;i++)for(let j=i+1;j<bx.length;j++){
      const a=bx[i],c=bx[j];
      const ox=Math.min(a.right,c.right)-Math.max(a.left,c.left);
      const oy=Math.min(a.bottom,c.bottom)-Math.max(a.top,c.top);
      if(ox>0&&oy>0&&ox*oy>worst){worst=ox*oy;pair=`${vis[i].textContent.trim()} / ${vis[j].textContent.trim()}`;}
    }
    return { rows, worst: Math.round(worst), pair };
  });
  console.log(`\n=== ${slug} ===  worst label overlap ${r.worst}px^2 ${r.pair?'('+r.pair+')':''}`);
  for (const x of r.rows.slice(0,4)) console.log(`   node-to-label gap ${x.gap.toFixed(0).padStart(3)}px  ${x.t}`);
  await p.close();
}
await b.close();
