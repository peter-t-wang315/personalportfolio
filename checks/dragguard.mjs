import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const P = () => b.newPage({ viewport: { width: 1440, height: 900 } });

// 1. plain click on the landing cluster still enters the graph
{
  const p = await P();
  await p.goto('http://localhost:3100/', { waitUntil:'networkidle' });
  await p.waitForTimeout(8000);
  // The live centre: the landing cluster has moved with every change to where
  // the camera stands, and a hard-coded point went stale with it.
  const c = await p.evaluate(() => window.__nebulaProbe.cluster);
  await p.mouse.click(c.x, c.y);
  await p.waitForTimeout(2500);
  console.log(`click on landing cluster -> ${new URL(p.url()).pathname} ${new URL(p.url()).pathname==='/nebula'?'PASS':'FAIL'}`);
  await p.close();
}
// 2. text selection on a work page still works
{
  const p = await P();
  await p.goto('http://localhost:3100/work/station-supervisor', { waitUntil:'networkidle' });
  await p.waitForTimeout(6000);
  const box = await (await p.$('main p')).boundingBox();
  await p.mouse.move(box.x + 5, box.y + box.height/2);
  await p.mouse.down();
  await p.mouse.move(box.x + box.width - 20, box.y + box.height/2, { steps: 8 });
  await p.mouse.up();
  const sel = await p.evaluate(() => window.getSelection().toString().trim().length);
  console.log(`text selection on /work/[slug]: ${sel} chars ${sel>10?'PASS':'FAIL'}`);
  await p.close();
}
// 3. nav links still clickable where the globe overlaps nothing
{
  const p = await P();
  await p.goto('http://localhost:3100/work/station-supervisor', { waitUntil:'networkidle' });
  await p.waitForTimeout(5000);
  await p.click('header a[href="/about"]');
  await p.waitForTimeout(2000);
  console.log(`header nav click -> ${new URL(p.url()).pathname} ${new URL(p.url()).pathname==='/about'?'PASS':'FAIL'}`);
  await p.close();
}
// 4. inside /nebula the drag surface stands down; camera-controls still owns it
{
  const p = await P();
  await p.goto('http://localhost:3100/nebula', { waitUntil:'networkidle' });
  await p.waitForTimeout(12000);
  const a = await p.screenshot();
  await p.mouse.move(720, 450); await p.mouse.down();
  for (let i=1;i<=10;i++){ await p.mouse.move(720 - i*18, 450 + i*3); await p.waitForTimeout(40); }
  await p.mouse.up();
  await p.waitForTimeout(2000);
  const c = await p.screenshot();
  const d = await p.evaluate(async ([x,y]) => {
    const L=async(s)=>{const i=new Image();i.src='data:image/png;base64,'+s;await i.decode();
      const cv=document.createElement('canvas');cv.width=i.width;cv.height=i.height;
      const g=cv.getContext('2d',{willReadFrequently:true});g.drawImage(i,0,0);
      return g.getImageData(0,0,i.width,i.height).data;};
    const A=await L(x), B=await L(y); let n=0;
    for(let i=0;i<A.length;i+=4) if(Math.abs(A[i]-B[i])>10) n++;
    return n;
  }, [a.toString('base64'), c.toString('base64')]);
  console.log(`/nebula drag still moves the view: ${d} px changed ${d>5000?'PASS':'FAIL'}`);
  await p.close();
}
await b.close();
