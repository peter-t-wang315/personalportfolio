// Phone: does one tap on "Home" from the graph go home, in every state the
// reader can tap it from? Real touch taps (touchscreen.tap), a portrait phone.
// For each state: the link's box, what element is actually under the tap
// point, and where the page is 1.2s later.
import { chromium } from "playwright";
const base = process.env.BASE ?? 'http://localhost:3100';
const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
let pass = 0, fail = 0;
const check = (ok, label, detail='') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`); ok ? pass++ : fail++; };

async function graph() {
  const p = await ctx.newPage();
  await p.goto(base + '/nebula', { waitUntil: 'networkidle' });
  await p.waitForTimeout(5000);
  return p;
}
async function homeBox(p) {
  return p.evaluate(() => {
    const a = [...document.querySelectorAll('a[href="/"]')].find(el => el.getBoundingClientRect().width > 0);
    if (!a) return null;
    const r = a.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  });
}
async function tapHome(p, dx = 0, dy = 0) {
  const box = await homeBox(p);
  if (!box) return { box: null, hit: 'no Home link', path: new URL(p.url()).pathname };
  const x = box.x + box.w / 2 + dx, y = box.y + box.h / 2 + dy;
  const hit = await p.evaluate(([x, y]) => {
    const el = document.elementFromPoint(x, y);
    if (!el) return 'nothing';
    const a = el.closest('a');
    const cls = typeof el.className === 'string' ? el.className.split(' ').slice(0, 3).join('.') : '';
    return `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}${a ? ` inside <a href="${a.getAttribute('href')}">` : ''}`;
  }, [x, y]);
  const t0 = Date.now();
  await p.touchscreen.tap(x, y);
  let path = new URL(p.url()).pathname;
  while (Date.now() - t0 < 1200 && path !== '/') { await p.waitForTimeout(100); path = new URL(p.url()).pathname; }
  return { box, hit, path, at: [Math.round(x), Math.round(y)] };
}
const show = (r) => `box ${r.box ? `${r.box.w.toFixed(0)}x${r.box.h.toFixed(0)} at (${r.box.x.toFixed(0)}, ${r.box.y.toFixed(0)})` : 'none'}, tap (${r.at}) hits ${r.hit}, now ${r.path}`;

// A. Standing on the graph, nothing happening.
let p = await graph();
let r = await tapHome(p);
check(r.path === '/', 'idle: one tap goes home', show(r));
await p.close();

// B. Right after a flick, while the globe is still drifting.
p = await graph();
await p.mouse.move(40, 600); await p.mouse.down();
for (let i = 1; i <= 12; i++) { await p.mouse.move(40 + i * 20, 600); await p.waitForTimeout(16); }
await p.mouse.up();
r = await tapHome(p);
check(r.path === '/', 'drifting: one tap goes home', show(r));
await p.close();

// C. With a node open.
p = await graph();
await p.evaluate(() => window.next.router.push('/nebula/vgclite'));
await p.waitForTimeout(3000);
r = await tapHome(p);
check(r.path === '/', 'node open: one tap goes home', show(r));
await p.close();

// D. Just arrived: tapped the landing cluster, Home tapped as soon as it shows.
p = await ctx.newPage();
await p.goto(base + '/', { waitUntil: 'networkidle' }); await p.waitForTimeout(5000);
await p.evaluate(() => { const c = window.__nebulaProbe.cluster; const o = { clientX: c.x, clientY: c.y, button: 0, bubbles: true }; document.body.dispatchEvent(new PointerEvent('pointerdown', o)); document.body.dispatchEvent(new MouseEvent('click', o)); });
const arrivedAt = Date.now();
while (Date.now() - arrivedAt < 4000 && !(await homeBox(p))) await p.waitForTimeout(100);
const flyingWhenTapped = await p.evaluate(() => window.__nebulaProbe.flying);
r = await tapHome(p);
check(r.path === '/', `arriving (flying ${flyingWhenTapped}): one tap goes home`, show(r));
// E. And the second round trip from the same page.
await p.waitForTimeout(4500);
await p.evaluate(() => { const c = window.__nebulaProbe.cluster; const o = { clientX: c.x, clientY: c.y, button: 0, bubbles: true }; document.body.dispatchEvent(new PointerEvent('pointerdown', o)); document.body.dispatchEvent(new MouseEvent('click', o)); });
await p.waitForTimeout(5000);
r = await tapHome(p);
check(r.path === '/', 'second visit from the same page: one tap goes home', show(r));
await p.close();

// F. Near misses: a finger lands a little off the text.
for (const [dx, dy, label] of [[0, 12, 'below'], [0, -12, 'above'], [-30, 0, 'left'], [30, 0, 'right of the word']]) {
  p = await graph();
  const box = await homeBox(p);
  const off = label === 'below' ? box.h / 2 + 6 : label === 'above' ? -(box.h / 2 + 6) : label === 'left' ? -(box.w / 2 + 6) : box.w / 2 + 6;
  r = await tapHome(p, dx ? off : 0, dy ? off : 0);
  console.log(`      near miss ${label} by 6px: ${show(r)}`);
  await p.close();
}

await b.close();
console.log(`\n${pass + fail} checks, ${fail} failed`);
