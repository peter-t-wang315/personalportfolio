import { chromium } from 'playwright';
import fs from 'node:fs';
const base = 'http://localhost:3100';
const OUT = 'v26'; fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT);
const args = ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'];
const b = await chromium.launch({ args });
const results = [];
const ok = (name, pass, note='') => { results.push({ name, pass, note }); console.log(`${pass?'PASS':'FAIL'}  ${name}${note?'  — '+note:''}`); };

async function page(opts = {}) {
  const p = await b.newPage({ viewport: { width: 1280, height: 800 }, ...opts });
  p.errors = [];
  p.on('console', m => { if (m.type()==='error') p.errors.push(m.text()); });
  p.on('pageerror', e => p.errors.push('PAGEERROR '+e.message));
  return p;
}
const probe = async (p) => p.evaluate(() => ({
  url: location.pathname,
  panel: !!document.querySelector('[data-nebula-panel]'),
  panelOpacity: getComputedStyle(document.querySelector('[data-nebula-panel]') ?? document.body).opacity,
  h1: document.querySelector('[data-nebula-panel] h1')?.textContent ?? null,
  canonical: document.querySelector('link[rel=canonical]')?.getAttribute('href') ?? null,
  close: !!document.querySelector('button'),
}));

// ---- 1. Cold entry: SSR panel at first paint, canonical, no flight ----
{
  const p = await page();
  const html = await (await fetch(base + '/nebula/station-supervisor')).text();
  ok('cold: prose is in the server HTML', /data-nebula-panel/.test(html) && /Station Supervisor|station supervisor/i.test(html));
  ok('cold: SSR panel is not opacity 0', !/data-nebula-panel[^>]*style="[^"]*opacity:\s*0[;"]/.test(html));
  ok('cold: canonical → /work/[slug]', /rel="canonical" href="[^"]*\/work\/station-supervisor"/.test(html));
  await p.goto(base + '/nebula/station-supervisor', { waitUntil: 'networkidle' });
  const t0 = await probe(p);
  await p.waitForTimeout(3500);
  await p.screenshot({ path: `${OUT}/cold-settled.png` });
  const t1 = await probe(p);
  ok('cold: panel visible immediately and after settle', t0.panel && t0.panelOpacity === '1' && t1.panelOpacity === '1', `h1=${t1.h1}`);
  ok('cold: no console errors', p.errors.length === 0, p.errors[0]?.slice(0,200));
  // Escape → /nebula, camera pulls back
  await p.keyboard.press('Escape');
  await p.waitForTimeout(2200);
  const t2 = await probe(p);
  await p.screenshot({ path: `${OUT}/cold-escaped.png` });
  ok('escape: route is /nebula and panel gone', t2.url === '/nebula' && !t2.panel);
  // back → node again (navigated this time, so it flies)
  await p.goBack(); await p.waitForTimeout(2200);
  const t3 = await probe(p);
  ok('history back: node route restored with panel', t3.url === '/nebula/station-supervisor' && t3.panel && t3.panelOpacity === '1');
  await p.goForward(); await p.waitForTimeout(1800);
  ok('history forward: back to /nebula', (await probe(p)).url === '/nebula');
  await p.close();
}

// ---- 2. In-graph navigation: click a node → route push → flight → panel fades in ----
{
  const p = await page();
  await p.goto(base + '/nebula', { waitUntil: 'networkidle' });
  await p.waitForTimeout(3000);
  let hit = null;
  outer: for (let y = 140; y < 640 && !hit; y += 10)
    for (let x = 300; x < 900; x += 10) {
      await p.mouse.move(x, y); await p.waitForTimeout(25);
      if (await p.evaluate(() => !!document.querySelector('div[style*="translate3d"]'))) { hit = {x,y}; break outer; }
    }
  await p.mouse.click(hit.x, hit.y);
  await p.waitForTimeout(150);
  const early = await probe(p);
  await p.waitForTimeout(2600);
  const late = await probe(p);
  await p.screenshot({ path: `${OUT}/nav-settled.png` });
  ok('nav: click pushed a /nebula/… route', /^\/nebula\/.+/.test(early.url), early.url);
  ok('nav: panel mounted hidden during flight, visible after', early.panel && early.panelOpacity !== '1' && late.panelOpacity === '1', `early=${early.panelOpacity} late=${late.panelOpacity}`);
  ok('nav: close control present', late.close);
  ok('nav: no console errors', p.errors.length === 0, p.errors[0]?.slice(0,200));

  // ---- 3. Sideways: follow a tech link inside the panel ----
  // Which kind of node the scan lands on depends on the screen layout, and the
  // layout moves. Follow whichever link the panel offers: a project panel goes
  // sideways to a technology, a technology panel goes sideways to a project.
  // Same capability either way, and it does not break when the framing changes.
  const openedTech = /^\/nebula\/tech\//.test(late.url);
  const outSelector = openedTech
    ? '[data-nebula-panel] a[href^="/nebula/"]:not([href^="/nebula/tech/"])'
    : '[data-nebula-panel] a[href^="/nebula/tech/"]';
  const backSelector = openedTech
    ? '[data-nebula-panel] a[href^="/nebula/tech/"]'
    : '[data-nebula-panel] a[href^="/nebula/"]:not([href^="/nebula/tech/"])';
  const techLink = await p.$(outSelector);
  if (techLink) {
    const href = await techLink.getAttribute('href');
    await techLink.click();
    await p.waitForTimeout(200);
    const mid = await probe(p);
    await p.waitForTimeout(2600);
    const done = await probe(p);
    await p.screenshot({ path: `${OUT}/sideways-tech.png` });
    ok('sideways: tech route reached without leaving the graph', mid.url === href && done.panelOpacity === '1', `h1=${done.h1}`);
    const projLink = await p.$(backSelector);
    if (projLink) {
      await projLink.click(); await p.waitForTimeout(2800);
      const back = await probe(p);
      const backOk = openedTech
        ? /^\/nebula\/tech\//.test(back.url)
        : /^\/nebula\/(?!tech\/)/.test(back.url);
      ok('sideways: and back the other way', backOk && back.panelOpacity === '1', back.url);
    } else ok('sideways: return link in the panel', false, 'no return link found');
  } else ok('sideways: onward link in the panel', false, `none in ${late.url}`);
  await p.close();
}

// ---- 4. Reduced motion → redirect to the document ----
{
  const p = await page({ reducedMotion: 'reduce' });
  await p.goto(base + '/nebula/station-supervisor', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  ok('reduced motion: /nebula/[slug] → /work/[slug]', (await probe(p)).url === '/work/station-supervisor');
  await p.goto(base + '/nebula/tech/csharp', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  ok('reduced motion: /nebula/tech/[id] → /work', (await probe(p)).url === '/work');
  await p.close();
}

// ---- 5. Short viewport sheet, and tablet sizing ----
for (const [w,h,name] of [[844,390,'landscape-phone'],[900,700,'tablet'],[390,844,'phone']]) {
  const p = await page({ viewport: { width: w, height: h } });
  await p.goto(base + '/nebula/selective-solder-driver', { waitUntil: 'networkidle' });
  await p.waitForTimeout(3000);
  const r = await p.evaluate(() => { const el = document.querySelector('[data-nebula-panel]'); const b = el.getBoundingClientRect(); return { w: b.width, h: b.height, radius: getComputedStyle(el).borderRadius }; });
  await p.screenshot({ path: `${OUT}/${name}.png` });
  const expectFrac = h < 500 ? 1 : (w >= 1024 ? 0.7 : 0.8);
  const fw = r.w / w, fh = r.h / h;
  ok(`${name} ${w}x${h}: panel ${Math.round(fw*100)}%×${Math.round(fh*100)}% (expect ${expectFrac*100}%)`, Math.abs(fw-expectFrac) < 0.02 && Math.abs(fh-expectFrac) < 0.02, `radius=${r.radius}`);
  ok(`${name}: no console errors`, p.errors.length === 0, p.errors[0]?.slice(0,200));
  await p.close();
}

// ---- 6. 404 for an unknown slug ----
{
  const r = await fetch(base + '/nebula/not-a-project');
  ok('unknown slug → 404', r.status === 404, String(r.status));
}
await b.close();
const fails = results.filter(r => !r.pass).length;
console.log(`\n${results.length} checks, ${fails} failed`);
