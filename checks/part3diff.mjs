import { chromium } from 'playwright';
import fs from 'node:fs';
const [a, c] = [process.argv[2], process.argv[3]];
const b = await chromium.launch();
const p = await b.newPage(); await p.setContent('<canvas id="x"></canvas>');
const files = fs.readdirSync(`part3-${a}`).filter(f=>f.endsWith('.png')).sort();
let worst = 0;
for (const f of files) {
  if (!fs.existsSync(`part3-${c}/${f}`)) { console.log(`${f.padEnd(40)} missing in ${c}`); continue; }
  const r = await p.evaluate(async ([x,y]) => {
    const L=async(s)=>{const i=new Image();i.src='data:image/png;base64,'+s;await i.decode();
      const cv=document.createElement('canvas');cv.width=i.width;cv.height=i.height;
      const g=cv.getContext('2d',{willReadFrequently:true});g.drawImage(i,0,0);
      return g.getImageData(0,0,i.width,i.height).data;};
    const A=await L(x),B=await L(y); let n=0,ink=0;
    for(let i=0;i<A.length;i+=4){ if(244-A[i]>6||244-B[i]>6) ink++;
      if(Math.abs(A[i]-B[i])+Math.abs(A[i+1]-B[i+1])+Math.abs(A[i+2]-B[i+2])>9) n++; }
    return {n,ink};
  }, [fs.readFileSync(`part3-${a}/${f}`).toString('base64'), fs.readFileSync(`part3-${c}/${f}`).toString('base64')]);
  const pct = r.ink ? (100*r.n/r.ink) : 0; worst = Math.max(worst, pct);
  console.log(`${f.padEnd(40)} ${String(r.n).padStart(7)} px changed of ${String(r.ink).padStart(7)} with ink (${pct.toFixed(2)}%)`);
}
console.log(`\nworst: ${worst.toFixed(2)}%`);
await b.close();
