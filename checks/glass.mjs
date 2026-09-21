// Part 6 — "seeing home through the glass".
//
// Answers: does the refraction pass run where the tier table says it does and
// nowhere else, and standing inside the graph facing home, does a node in
// front of the page visibly bend the page?
//
// The bend is measured as the difference between two frames of the *same*
// standing point with the pass on and off — `window.__nebulaGlass.refract`,
// which at 0 skips the pass entirely. Reduced motion throughout, so the only
// thing that differs between the two shots is the glass (checks/README.md,
// "Motion, when comparing pixels").
//
// Writes glass/on.png, glass/off.png, glass/diff.png.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const base = process.env.BASE ?? 'http://localhost:3100';
const outDir = 'glass';
mkdirSync(outDir, { recursive: true });

const b = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log(`  ok   ${label}`); }
  else { fail++; console.log(`  FAIL ${label}`); }
};

/** The graph, on desktop: the pass runs, at half the drawing buffer. */
const page = await b.newPage({
  viewport: { width: 1440, height: 900 },
  reducedMotion: 'reduce',
});
await page.goto(`${base}/nebula`, { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);

const seen = await page.evaluate(() => ({
  glass: { ...window.__nebulaProbe.glass },
  buffer: [
    Math.round(window.innerWidth * Math.min(window.devicePixelRatio, 2)),
    Math.round(window.innerHeight * Math.min(window.devicePixelRatio, 2)),
  ],
}));
console.log(`desktop /nebula: active=${seen.glass.active} refract=${seen.glass.refract} target=${seen.glass.width}x${seen.glass.height} buffer=${seen.buffer[0]}x${seen.buffer[1]}`);
ok(seen.glass.active, 'the pass runs on desktop /nebula');
ok(seen.glass.refract > 0, 'the shells are told to refract');
ok(
  Math.abs(seen.glass.width - seen.buffer[0] / 2) <= 1 &&
    Math.abs(seen.glass.height - seen.buffer[1] / 2) <= 1,
  'the backdrop is half the drawing buffer in each axis',
);

// Turn around until home is ahead. The reader arrives facing away from it —
// the flight in passes the page and carries on to the centre — so this is the
// "turn around and see where you came from" the whole part exists for.
const turn = await (async () => {
  // Heading and home direction as one angle each about the world's y, which
  // is the only axis a look-around drag moves the camera about from the
  // centre. Measured: a 180px drag across a 1440-wide frame turns 72 degrees,
  // so the step is the shortest way round at 2.5px per degree and the aim
  // converges instead of stepping over the target.
  const PX_PER_DEG = 180 / 72;
  for (let i = 0; i < 14; i++) {
    const q = await page.evaluate(() => {
      const p = window.__nebulaProbe;
      const d = [
        p.home.position[0] - p.position[0],
        p.home.position[1] - p.position[1],
        p.home.position[2] - p.position[2],
      ];
      const len = Math.hypot(...d) || 1;
      const deg = (a, b) => (Math.atan2(a, -b) * 180) / Math.PI;
      let error = deg(d[0], d[2]) - deg(p.heading[0], p.heading[2]);
      while (error > 180) error -= 360;
      while (error < -180) error += 360;
      return {
        dot: (d[0] * p.heading[0] + d[1] * p.heading[1] + d[2] * p.heading[2]) / len,
        error,
        opacity: p.home.opacity,
      };
    });
    if (q.dot > 0.99) return q;
    const dx = Math.max(-560, Math.min(560, q.error * PX_PER_DEG));
    await page.mouse.move(720, 450);
    await page.mouse.down();
    for (let s = 1; s <= 8; s++) await page.mouse.move(720 + (dx * s) / 8, 450);
    await page.mouse.up();
    await page.waitForTimeout(450);
  }
  return null;
})();
ok(turn !== null, 'the reader can turn around and face home');
if (turn) console.log(`facing home: dot=${turn.dot.toFixed(4)} plane opacity=${turn.opacity.toFixed(3)}`);

await page.waitForTimeout(800);
const shoot = async (refract, name) => {
  await page.evaluate((r) => { window.__nebulaGlass.refract = r; }, refract);
  await page.waitForTimeout(900);
  const buf = await page.screenshot({ path: `${outDir}/${name}.png` });
  return buf.toString('base64');
};
const on = await shoot(null, 'on');
const off = await shoot(0, 'off');
await page.evaluate(() => { window.__nebulaGlass.refract = null; });

// Decoded in the page rather than in Node, the way part3diff.mjs does it:
// the browser already has a PNG decoder and the checks have no image
// dependency of their own.
const bend = await page.evaluate(async ([aSrc, bSrc]) => {
  const load = async (src) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + src;
    await img.decode();
    const cv = new OffscreenCanvas(img.width, img.height);
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    return { data: g.getImageData(0, 0, img.width, img.height).data, w: img.width, h: img.height };
  };
  const a = await load(aSrc);
  const b = await load(bSrc);
  // Paper is #F4EEE0; the red channel is the one to threshold on, or the
  // background reads as ink (checks/README.md).
  const INK = 0xf4 - 40;
  const cv = new OffscreenCanvas(a.w, a.h);
  const g = cv.getContext('2d');
  const out = g.createImageData(a.w, a.h);
  let moved = 0, movedInk = 0, peak = 0, ink = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    if (b.data[i] < INK) ink++;
    const d = Math.max(
      Math.abs(a.data[i] - b.data[i]),
      Math.abs(a.data[i + 1] - b.data[i + 1]),
      Math.abs(a.data[i + 2] - b.data[i + 2]),
    );
    if (d > peak) peak = d;
    if (d > 4) {
      moved++;
      if (b.data[i] < INK || a.data[i] < INK) movedInk++;
      out.data[i] = 255; out.data[i + 1] = 40; out.data[i + 2] = 40; out.data[i + 3] = 255;
    } else {
      out.data[i] = b.data[i]; out.data[i + 1] = b.data[i + 1];
      out.data[i + 2] = b.data[i + 2]; out.data[i + 3] = 255;
    }
  }
  g.putImageData(out, 0, 0);
  const blob = await cv.convertToBlob({ type: 'image/png' });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return { moved, movedInk, peak, ink, total: a.w * a.h, png: btoa(binary) };
}, [on, off]);
writeFileSync(`${outDir}/diff.png`, Buffer.from(bend.png, 'base64'));
console.log(`bend: ${bend.moved} of ${bend.total} pixels moved (${((bend.moved / bend.total) * 100).toFixed(2)}%), peak channel delta ${bend.peak}; ${bend.movedInk} of them ink; ${bend.ink} ink pixels in frame`);
ok(bend.ink > 2000, 'home is actually on screen to be bent');
ok(bend.moved > 0, 'the glass changes the frame');
ok(bend.peak >= 8, 'the change is visible, not a rounding difference');
ok(bend.movedInk > 200, 'what moved includes the page itself, not only the rims over paper');

// The cost of the pass, on the tier that pays it. Informational: SwiftShader
// is ~9fps and its ratio is not a desktop GPU's.
const frameMs = async (refract) => {
  await page.evaluate((r) => { window.__nebulaGlass.refract = r; }, refract);
  await page.waitForTimeout(600);
  return page.evaluate(
    () =>
      new Promise((resolve) => {
        const gaps = [];
        let last = performance.now();
        const tick = (now) => {
          gaps.push(now - last);
          last = now;
          if (gaps.length < 40) requestAnimationFrame(tick);
          else {
            gaps.sort((x, y) => x - y);
            resolve(gaps[gaps.length >> 1]);
          }
        };
        requestAnimationFrame(tick);
      }),
  );
};
const withGlass = await frameMs(null);
const withoutGlass = await frameMs(0);
await page.evaluate(() => { window.__nebulaGlass.refract = null; });
console.log(`frame time (SwiftShader, median of 40): ${withGlass.toFixed(1)}ms with the pass, ${withoutGlass.toFixed(1)}ms without`);
await page.close();

/** Off the graph, and off the tiers that do not get it. */
for (const [label, viewport, route] of [
  ['desktop /about', { width: 1440, height: 900 }, '/about'],
  ['desktop /', { width: 1440, height: 900 }, '/'],
  ['portrait phone /nebula', { width: 390, height: 844 }, '/nebula'],
  ['tablet /nebula', { width: 900, height: 1000 }, '/nebula'],
]) {
  const p = await b.newPage({ viewport, reducedMotion: 'reduce' });
  await p.goto(base + route, { waitUntil: 'networkidle' });
  await p.waitForTimeout(2500);
  const g = await p.evaluate(() => ({ ...window.__nebulaProbe.glass }));
  ok(!g.active && g.refract === 0, `${label}: no pass, no refraction`);
  await p.close();
}

await b.close();
console.log(`\n${pass}/${pass + fail} checks`);
process.exit(fail ? 1 : 0);
