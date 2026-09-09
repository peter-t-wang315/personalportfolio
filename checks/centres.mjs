import { chromium } from 'playwright';
const slugs = ['station-supervisor','machine-client','flying-probe-dashboard','sonder-barber','vgclite','thai-ginger','this-site'];
const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
for (const slug of slugs) {
  await p.goto(`http://localhost:3100/work/${slug}`, { waitUntil: 'networkidle' });
  await p.mouse.move(720, 450);
  await p.waitForTimeout(11000);
  const buf = await p.screenshot();
  const r = await p.evaluate(async (b64) => {
    const img=new Image(); img.src='data:image/png;base64,'+b64; await img.decode();
    const c=document.createElement('canvas'); c.width=img.width; c.height=img.height;
    const g=c.getContext('2d',{willReadFrequently:true}); g.drawImage(img,0,0);
    const d=g.getImageData(0,0,img.width,img.height).data; const W=img.width,H=img.height;
    let n=0,sx=0,sy=0;
    for(let y=100;y<H-40;y++)for(let x=760;x<W-20;x++){
      const i=(y*W+x)*4; if(244-Math.min(d[i],d[i+1],d[i+2])<70) continue; n++;sx+=x;sy+=y;}
    return n? {n,cx:Math.round(sx/n),cy:Math.round(sy/n)} : null;
  }, buf.toString('base64'));
  // Expected centre computed from the same solve the scene uses, not a
  // hard-coded number: clusterCenterXFraction centres the graph in the space
  // beside the article on label-drawing routes, so the old literal 1008 was
  // the pre-centring target and had been stale ever since.
  const px = 450/(23*Math.tan(22.5*Math.PI/180));
  const BR = 3.4, zoom = 1.32, W = 1440;
  const scale = Math.min(1, (0.55*W)/(2*BR*zoom*px));
  const radiusPx = BR*zoom*px*scale;
  const spaceLeft = 764+32, spaceRight = W-32;
  const wanted = Math.max((spaceLeft+spaceRight)/2, spaceLeft+radiusPx+48);
  const EX = Math.round(Math.max(W/2, Math.min(wanted, W-radiusPx-32)));
  const EY = 450;
  console.log(r ? `${slug.padEnd(24)} centroid (${r.cx},${r.cy})  off (${r.cx-EX>=0?'+':''}${r.cx-EX}, ${r.cy-EY>=0?'+':''}${r.cy-EY}) vs solved ${EX}  n=${r.n}` : `${slug} — nothing lit`);
}
await b.close();
