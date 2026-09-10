// Does the graph stay centred while you fly in and out, or does it take a
// detour?
//
// The complaint this exists for was "it is completely off-centred when trying
// to fly in". The camera was not off-centred — it started and ended exactly
// where the compositions put it, and `exitflight.mjs` said the schedule was
// correct. What was wrong was the middle: the constellation's on-screen
// centroid climbed 206px in the first fifth of the arrival and then came back
// down, an excursion 262px off the direct path between where it starts and
// where it ends.
//
// So this measures the thing a camera trace cannot see — where the graph
// actually *is* on screen, frame by frame, in ink. It reports how far the
// centroid strays from the straight path between its endpoints. Under 60px is
// a slide; over 150px is a detour you can see.
//
// Sampling is the whole difficulty, and the bottleneck is not where it looks.
// JPEG instead of PNG and a stride-3 scan made no difference at all: under
// SwiftShader each screenshot forces a fresh composite of the WebGL scene at
// around 9fps, so the cost is fragments, not encoding. A 2000ms flight at
// 1440x900 sampled five times either way, which can miss an excursion whole.
//
// Dropping to 900x700 — 2.3x fewer fragments, and a tier the rest of the suite
// already covers — bought one extra frame. So the cost is the screenshot
// round-trip itself, and six samples of a 2000ms flight is what this method
// gets.
//
// **That makes the number here a lower bound, and it is reported as one.** The
// precise figure comes from the model instead: `approachLerpPose` is pure
// arithmetic over the layout, so the path can be evaluated at any resolution
// offline, and that is where "262px before, 56px after" is measured. This
// script exists to confirm the model matches what the browser actually draws —
// it caught nothing the model missed, and it would have caught the model being
// wrong about which code path ships.
import { chromium } from 'playwright';

const DURATION = 1400;   // JUMP_DURATION_MS
const VIEWPORT = { w: 900, h: 700 };
const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });

/** Ink centroid of the canvas, in page pixels. Red channel: paper's blue is
 *  224, so a threshold on blue counts the background (checks/README.md). */
async function centroid(page) {
  const shot = (await page.screenshot({ type: 'jpeg', quality: 40 })).toString('base64');
  return page.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/jpeg;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, img.width, img.height).data;
    let n = 0, sx = 0, sy = 0;
    const STRIDE = 3;
    for (let y = 0; y < img.height; y += STRIDE) for (let x = 0; x < img.width; x += STRIDE) {
      const i = (y * img.width + x) * 4;
      if (244 - d[i] < 12) continue;   // 12, not 10: jpeg ringing on flat paper
      n++; sx += x; sy += y;
    }
    return n ? { x: sx / n, y: sy / n, n } : null;
  }, shot);
}

async function run(label, from, to) {
  const p = await b.newPage({ viewport: { width: VIEWPORT.w, height: VIEWPORT.h } });
  await p.goto('http://localhost:3100' + from, { waitUntil: 'networkidle' });
  // Everything but the canvas, so the hero's text is not in the centroid — the
  // same isolation baseline.mjs uses, and the reason it has to be a style tag
  // rather than the route curtain is that the curtain only covers a departure.
  await p.addStyleTag({ content: 'body > *:not(:has(canvas)) { visibility: hidden !important; }' });
  await p.mouse.move(3, 3);
  await p.waitForTimeout(6000);

  const samples = [];
  const t0 = Date.now();
  // Dispatched rather than clicked: the isolation style above hides the
  // affordance, and Playwright refuses to click what it cannot see. The
  // navigation is the thing under test, not the hit target — dragguard.mjs
  // covers whether the link is clickable.
  await p.evaluate((href) => document.querySelector(`a[href="${href}"]`).click(), to);
  while (Date.now() - t0 < DURATION + 600) {
    const c = await centroid(p);
    if (c) samples.push({ t: Date.now() - t0, ...c });
  }

  console.log(`\n=== ${label} ===  ${samples.length} frames`);
  if (samples.length < 4) { console.log('  too few frames to judge'); await p.close(); return; }
  const a = samples[0], z = samples.at(-1);
  const ax = z.x - a.x, ay = z.y - a.y, L = Math.hypot(ax, ay) || 1;
  let worst = 0, worstT = 0, ymin = 1e9, ymax = -1e9;
  for (const s of samples) {
    const stray = Math.abs((s.x - a.x) * ay - (s.y - a.y) * ax) / L;
    if (stray > worst) { worst = stray; worstT = s.t; }
    ymin = Math.min(ymin, s.y); ymax = Math.max(ymax, s.y);
  }
  console.log(`  centroid (${a.x.toFixed(0)},${a.y.toFixed(0)}) -> (${z.x.toFixed(0)},${z.y.toFixed(0)})`);
  console.log(`  strays at least ${worst.toFixed(0)}px off the direct path, worst seen at ${worstT}ms`);
  console.log(`  (a lower bound: ${samples.length} samples of a ${DURATION}ms flight, see the header)`);
  console.log(`  vertical range ${ymin.toFixed(0)}..${ymax.toFixed(0)} (endpoints ${a.y.toFixed(0)}, ${z.y.toFixed(0)})`);
  for (const s of samples) {
    console.log(`    ${String(s.t).padStart(5)}ms  (${s.x.toFixed(0).padStart(4)},${s.y.toFixed(0).padStart(4)})  ${s.n} ink px`);
  }
  await p.close();
}

await run('flying in', '/', '/nebula');
await run('flying out', '/nebula', '/');
await b.close();
