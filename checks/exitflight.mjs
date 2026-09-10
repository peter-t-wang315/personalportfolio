// Does leaving the graph actually animate, and can you see it?
//
// This is the check that did not exist when the docs started making claims
// about the camera. checks/README.md says "trace the camera instead; do not
// judge a transition from screencast frames" and then offered no way to trace
// the camera — the r3f store is not reachable from the page. app/nebula-probe.ts
// is the hook it was assuming; this is the script that reads it.
//
// It answers two separate questions, and the second one is the one that was
// wrong. The camera's own pacing was correct all along — 44/70/91% of the way
// out at each quarter — while the destination document painted at full opacity
// 190ms after the click and covered the remaining 1.9 seconds of it. A trace of
// the camera alone would have said the flight was fine, which is why this reads
// the document's opacity on the same frames.
import { chromium } from 'playwright';

const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const DURATION = 2800;   // FLIGHT_DURATION_MS

async function trace(label, from, to) {
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  await p.goto('http://localhost:3100' + from, { waitUntil: 'networkidle' });
  await p.waitForTimeout(6000);
  await p.evaluate(() => {
    window.__T = [];
    const tick = () => {
      const q = window.__nebulaProbe;
      const m = document.querySelector('main');
      if (q) window.__T.push({ t: q.t, d: q.distance, fov: q.fov, fly: q.flying,
        h: q.heading.slice(),
        curtain: document.documentElement.dataset.arriving === '1',
        opacity: m ? +getComputedStyle(m).opacity : null });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const t0 = await p.evaluate(() => performance.now());
  await p.click(`a[href="${to}"]`);
  await p.waitForTimeout(DURATION + 1800);

  const T = (await p.evaluate(() => window.__T)).filter(r => r.t >= t0);
  const fly = T.filter(r => r.fly);
  console.log(`\n=== ${label} ===`);
  if (!fly.length) { console.log('  FAIL — the camera never moved'); await p.close(); return; }

  // The flight's own clock, not the click's: a route commit under software GL
  // costs 80-240ms before the rig's effect runs, and measuring the schedule
  // from the click blames the flight for the router's latency.
  // Against the far wall, `d + R`, which is what the dive spends geometrically
  // (divePose) — the reader now leaves from the exact centre, where a ratio
  // of distances from it is a ratio with zero in it.
  const R = 12.38;   // CONSTELLATION_BOUNDING_RADIUS
  const start = fly[0].t, d0 = T[0].d + R, d1 = T.at(-1).d + R;
  const span = Math.abs(Math.log(d1 / d0));
  const nearest = q => T.reduce((a, r) =>
    Math.abs(r.t - (start + DURATION * q)) < Math.abs(a.t - (start + DURATION * q)) ? r : a, T[0]);
  const turn = (() => { const a = T[0].h, z = T.at(-1).h;
    return Math.acos(Math.max(-1, Math.min(1, a[0]*z[0] + a[1]*z[1] + a[2]*z[2]))) * 180 / Math.PI; })();

  console.log(`  ${T[0].d.toFixed(2)} -> ${T.at(-1).d.toFixed(2)} units from the graph, fov ${T[0].fov} -> ${T.at(-1).fov}, heading turned ${turn.toFixed(2)}deg`);
  console.log(`  route commit to first camera move: ${(start - t0).toFixed(0)}ms`);
  console.log('  spent, against the flight\'s own clock:');
  for (const q of [0.25, 0.5, 0.75]) {
    const r = nearest(q);
    // Distance is interpolated geometrically (see approachLerpPose), so "how
    // far along" is a ratio of logs, not of distances.
    console.log(`    ${String(q * 100).padStart(2)}%  d=${r.d.toFixed(1).padStart(6)}  ${(100 * Math.abs(Math.log((r.d + R) / d0)) / span).toFixed(0).padStart(3)}% of the way   page ${r.curtain ? 'held' : `at ${r.opacity.toFixed(2)}`}`);
  }
  // Only samples from the route commit onward: before it, `main` is the page
  // being left, which is trivially opaque and says nothing.
  const after = T.filter(r => r.t >= start - 250 && r.opacity !== null);
  const held = after.filter(r => r.curtain);
  // Strictly after the hold ends. Without that this finds a sample from
  // *before* the route commit, when `main` is the page being left and is
  // trivially opaque — which reads as the destination arriving before the
  // flight started.
  const lastHeld = held.length ? held.at(-1).t : start;
  const shown = after.find(r => r.t > lastHeld && !r.curtain && r.opacity >= 0.99);
  console.log(held.length
    ? `  page held from ${(held[0].t - start).toFixed(0)}ms to ${(held.at(-1).t - start).toFixed(0)}ms of the flight`
    : '  FAIL — the page was never held; the flight plays behind a finished document');
  console.log(shown
    ? `  page fully opaque at ${(shown.t - start).toFixed(0)}ms, ${((shown.t - start) / DURATION * 100).toFixed(0)}% through the flight`
    : '  page never reached full opacity within the window');
  await p.close();
}

await trace('leaving the graph', '/nebula', '/');
await trace('leaving an open node', '/nebula/vgclite', '/');
await b.close();
