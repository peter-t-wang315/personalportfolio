// Does flying into the graph land at its centre, pass the hero on the way,
// and hand the page over to the plane and back without a gap?
//
// Three things on the same frames, because each of them was wrong on its own
// at some point: the camera (from app/nebula-probe.ts), the hero plane the rig
// places every frame (the same probe), and the document's opacity. It runs the
// journey in both directions and saves a screenshot every time it can — at
// ~9fps under SwiftShader that is five or six per flight, which is enough to
// see the plane go past and not enough to judge its pace. Judge pace from the
// trace, pictures from the shots.
//
//   node checks/flyin.mjs            # against http://localhost:3100
//   BASE=http://localhost:3000 node checks/flyin.mjs
//
// Screenshots land in ./flyin/.
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:3100';
const DURATION = 3000;   // FLIGHT_DURATION_MS
// VIEWPORT=390x844 node checks/flyin.mjs traces the portrait phone, which
// stands outside the graph rather than at its centre (lib/device-tier.ts,
// standsOutside); the shots then land in flyin-390x844/.
const VIEWPORT = (() => {
  const m = /^(\d+)x(\d+)$/.exec(process.env.VIEWPORT ?? '');
  return m ? { width: +m[1], height: +m[2] } : { width: 1440, height: 900 };
})();
const OUT = process.env.VIEWPORT ? `flyin-${VIEWPORT.width}x${VIEWPORT.height}` : 'flyin';
fs.mkdirSync(OUT, { recursive: true });

const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });

function installTracer(p) {
  return p.evaluate(() => {
    window.__T = [];
    const tick = () => {
      const q = window.__nebulaProbe;
      const m = document.querySelector('main');
      if (q) window.__T.push({
        t: q.t, d: q.distance, x: q.position[0], y: q.position[1], z: q.position[2],
        fov: q.fov, fly: q.flying, placement: q.placement, h: q.heading.slice(),
        home: { z: q.home.position[2], x: q.home.position[0], w: q.home.width, h: q.home.height, op: q.home.opacity },
        leaving: document.documentElement.dataset.leaving === '1',
        arriving: document.documentElement.dataset.arriving === '1',
        path: location.pathname,
        opacity: m ? +getComputedStyle(m).opacity : null,
      });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

async function shots(p, label, t0) {
  const taken = [];
  for (let i = 0; i < 40; i++) {
    const now = await p.evaluate(() => performance.now());
    const q = await p.evaluate(() => ({ fly: window.__nebulaProbe?.flying, d: window.__nebulaProbe?.distance }));
    const file = `${OUT}/${label}-${String(Math.round(now - t0)).padStart(4, '0')}ms.png`;
    await p.screenshot({ path: file });
    taken.push({ at: Math.round(now - t0), file, d: q.d });
    if (now - t0 > DURATION + 900) break;
  }
  return taken;
}

function report(label, T, t0, taken) {
  const fly = T.filter(r => r.fly);
  console.log(`\n=== ${label} ===`);
  if (!fly.length) { console.log('  FAIL — the camera never moved'); return; }
  const start = fly[0].t;
  console.log(`  click to first camera move: ${(start - t0).toFixed(0)}ms; ${T.length} samples`);
  console.log('  ms    d      z      x     fov  place  home.op  home.z home.x  page   yaw   flags');
  const rows = T.filter(r => r.t >= t0 - 50);
  let last = -1000;
  for (const r of rows) {
    if (r.t - last < 180 && r.fly) continue;
    last = r.t;
    const flags = [r.leaving ? 'leaving' : '', r.arriving ? 'held' : '', r.path].filter(Boolean).join(' ');
    console.log(`  ${String(Math.round(r.t - start)).padStart(5)} ${r.d.toFixed(1).padStart(6)} ${r.z.toFixed(1).padStart(6)} ${r.x.toFixed(1).padStart(6)}  ${r.fov.toFixed(0).padStart(3)}  ${r.placement.toFixed(2)}   ${r.home.op.toFixed(2)}    ${r.home.z.toFixed(1).padStart(5)} ${r.home.x.toFixed(1).padStart(6)}  ${r.opacity === null ? '  -  ' : r.opacity.toFixed(2).padStart(5)}  ${String(Math.round(Math.atan2(r.h[0], -r.h[2]) * 180 / Math.PI)).padStart(4)}  ${flags}`);
  }
  const end = fly.at(-1);
  console.log(`  landed at d=${end.d.toFixed(2)} (${end.x.toFixed(2)}, ${end.y.toFixed(2)}, ${end.z.toFixed(2)}) fov ${end.fov.toFixed(0)} after ${(end.t - start).toFixed(0)}ms`);
  console.log(`  shots: ${taken.map(s => `${s.at}ms(d=${s.d?.toFixed(0)})`).join(', ')}`);
}

async function flyIn() {
  const p = await b.newPage({ viewport: VIEWPORT });
  await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(6000);
  await installTracer(p);
  const t0 = await p.evaluate(() => performance.now());
  // The cluster's own click handler, at the circle the rig published.
  await p.evaluate(() => {
    const c = window.__nebulaProbe.cluster;
    const opts = { clientX: c.x, clientY: c.y, button: 0, bubbles: true };
    document.body.dispatchEvent(new PointerEvent('pointerdown', opts));
    document.body.dispatchEvent(new MouseEvent('click', opts));
  });
  const taken = await shots(p, 'in', t0);
  await p.waitForTimeout(500);
  const T = await p.evaluate(() => window.__T);
  report('flying in from home', T, t0, taken);
  const events = await p.evaluate(() => window.__nebulaProbe.events);
  console.log('  rig events: ' + events.filter(e => e.t >= t0 - 100).map(e => `${Math.round(e.t - t0)}ms ${e.kind} ${e.detail}`).join(' | '));
  await p.close();
}

async function flyHome(from, label, { drag = false } = {}) {
  const p = await b.newPage({ viewport: VIEWPORT });
  await p.goto(BASE + from, { waitUntil: 'networkidle' });
  await p.waitForTimeout(6000);
  if (drag) {
    // Look around first — a departure after a drag once flew out sideways.
    const cx = VIEWPORT.width / 2, cy = VIEWPORT.height / 2;
    const step = Math.round(VIEWPORT.width / 24);
    await p.mouse.move(cx, cy);
    await p.mouse.down();
    for (let i = 1; i <= 12; i++) { await p.mouse.move(cx + i * step, cy - i * 15); await p.waitForTimeout(40); }
    await p.mouse.up();
    await p.waitForTimeout(1200);
  }
  await installTracer(p);
  const t0 = await p.evaluate(() => performance.now());
  await p.evaluate(() => document.querySelector('a[href="/"]').click());
  const taken = await shots(p, label, t0);
  await p.waitForTimeout(800);
  const T = await p.evaluate(() => window.__T);
  report(`flying home from ${from}${drag ? ' after a drag' : ''}`, T, t0, taken);
  await p.close();
}

await flyIn();
await flyHome('/nebula', 'out');
await flyHome('/nebula/vgclite', 'outnode');
await flyHome('/nebula', 'outdrag', { drag: true });
await b.close();
