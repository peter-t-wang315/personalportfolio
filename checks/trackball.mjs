// Phone: does dragging the globe keep going, in every direction? The outside
// turn was a yaw and a pitch with the pitch stopped at 88°, so a long drag
// down stopped a quarter-turn in, and after a sideways quarter-turn a vertical
// drag rolled the globe in the plane of the screen instead of tipping it.
// Reads window.__nebulaProbe.outsideTurn, a quaternion.
import { chromium } from "playwright";
const base = process.env.BASE ?? 'http://localhost:3100';
const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
let pass = 0, fail = 0;
const check = (ok, label, detail='') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`); ok ? pass++ : fail++; };

const p = await b.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:1, isMobile:true, hasTouch:true });
await p.goto(base + '/nebula', { waitUntil: 'networkidle' }); await p.waitForTimeout(5000);

const RADIANS_PER_PX = 0.006;
const turnNow = () => p.evaluate(() => ({ ...window.__nebulaProbe.outsideTurn, cam: [...window.__nebulaProbe.position] }));
// The step a drag made: after = step · before, so step = after · before⁻¹.
const mul = (a, b) => ({
  w: a.w*b.w - a.x*b.x - a.y*b.y - a.z*b.z,
  x: a.w*b.x + a.x*b.w + a.y*b.z - a.z*b.y,
  y: a.w*b.y - a.x*b.z + a.y*b.w + a.z*b.x,
  z: a.w*b.z + a.x*b.y - a.y*b.x + a.z*b.w,
});
const conj = (q) => ({ w: q.w, x: -q.x, y: -q.y, z: -q.z });
function step(before, after) {
  const s = mul(after, conj(before));
  const len = Math.hypot(s.x, s.y, s.z);
  return { angle: 2 * Math.atan2(len, Math.abs(s.w)), axis: len > 1e-9 ? [s.x / len, s.y / len, s.z / len] : [0, 0, 0] };
}
async function drag(dx, dy) {
  const x0 = 195 - dx / 2, y0 = 422 - dy / 2;
  await p.mouse.move(x0, y0); await p.mouse.down();
  for (let i = 1; i <= 24; i++) { await p.mouse.move(x0 + dx * i / 24, y0 + dy * i / 24); await p.waitForTimeout(25); }
  // Held before lifting, so it is placed rather than thrown: no drift to muddy the step.
  await p.waitForTimeout(200); await p.mouse.up(); await p.waitForTimeout(600);
}

// 1. Three long drags straight down, each far past the old 88° stop on its own.
const down = [];
for (let i = 0; i < 3; i++) {
  const before = await turnNow();
  await drag(0, 400);
  const after = await turnNow();
  down.push(step(before, after));
}
const expected = 400 * RADIANS_PER_PX;
check(down.every(s => Math.abs(s.angle - expected) < 0.1), 'dragging down keeps turning, drag after drag', down.map(s => `${s.angle.toFixed(2)} rad`).join(', ') + ` (each should be ${expected.toFixed(2)})`);
check(down.every(s => Math.abs(s.axis[0]) > 0.99), 'and always about the screen\'s horizontal axis', down.map(s => `axis (${s.axis.map(v => v.toFixed(2)).join(', ')})`).join('; '));

// 2. A sideways quarter-turn, then a vertical drag: still a tip, not a roll.
await drag(260, 0);
const before = await turnNow();
await drag(0, 150);
const after = await turnNow();
const tip = step(before, after);
check(Math.abs(tip.angle - 150 * RADIANS_PER_PX) < 0.08, 'after turning side-on, a vertical drag turns the globe as far as it should', `${tip.angle.toFixed(2)} rad`);
check(Math.abs(tip.axis[0]) > 0.99 && Math.abs(tip.axis[2]) < 0.1, 'and tips it rather than rolling it in the screen plane', `axis (${tip.axis.map(v => v.toFixed(2)).join(', ')})`);
check(Math.abs(after.cam[0]) < 0.01 && Math.abs(after.cam[1]) < 0.01, 'the camera never left the axis', `(${after.cam.map(v => v.toFixed(2)).join(', ')})`);
check(new URL(p.url()).pathname === '/nebula', 'no drag opened a node', new URL(p.url()).pathname);

await b.close();
console.log(`\n${pass + fail} checks, ${fail} failed`);
