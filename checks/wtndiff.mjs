import { chromium } from 'playwright';
import fs from 'node:fs';
const b = await chromium.launch();
const p = await b.newPage();
await p.setContent('<canvas id="a"></canvas><canvas id="b"></canvas>');
const n = await p.evaluate(async ({x,y}) => {
  const l=async(id,d)=>{const i=new Image();i.src='data:image/png;base64,'+d;await i.decode();
    const c=document.getElementById(id);c.width=i.width;c.height=i.height;
    const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(i,0,0);
    return {d:g.getImageData(0,0,i.width,i.height).data,w:i.width,h:i.height};};
  const A=await l('a',x),B=await l('b',y); let n=0,tot=0;
  for(let yy=0;yy<A.h;yy++)for(let xx=0;xx<A.w;xx++){const i=(yy*A.w+xx)*4;
    if(244-A.d[i]>8||244-B.d[i]>8) tot++;
    if(Math.abs(A.d[i]-B.d[i])+Math.abs(A.d[i+1]-B.d[i+1])+Math.abs(A.d[i+2]-B.d[i+2])>18)n++;}
  return {n,tot};
}, { x: fs.readFileSync('wtn/rm-direct.png').toString('base64'),
     y: fs.readFileSync('wtn/rm-via-work.png').toString('base64') });
console.log(`/nebula direct vs via a work page: ${n.n} px differ, of ${n.tot} px of ink`);
console.log(n.n / n.tot < 0.12 ? 'MATCH — same composition' : 'DIFFERENT — orientation leaked');
await b.close();
