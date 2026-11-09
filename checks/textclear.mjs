// Is any reading text drawn over a node or an edge?
//
// For each page and width: measure every line box of text in <main> (Range
// client rects over its text nodes), hide the text, screenshot, and count the
// pixels inside those boxes that are not paper. Paper is sampled from the
// page itself. A line counts as covered when more than MIN_PX of its pixels
// are off-paper by more than TOL; one stray antialiased pixel is not a node.
//   BASE=http://localhost:3100 node checks/textclear.mjs [outdir]
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
const base = process.env.BASE ?? "http://localhost:3100";
const out = process.argv[2] ?? "textclear";
const ONLY = process.env.ONLY ?? "";
mkdirSync(out, { recursive: true });
const TOL = Number(process.env.TOL ?? 18);
const MIN_PX = Number(process.env.MIN_PX ?? 6);

const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
let pass = 0, fail = 0;
const check = (ok, label, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? "  — " + detail : ""}`); ok ? pass++ : fail++; };

const widths = [
  { name: "390", viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
  { name: "1024", viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 },
  { name: "1440", viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
];
// [path, scroll fractions]. The home page is sampled down its length because
// the graph is fixed and the text scrolls past it.
const pages = [
  ["/", [0, 0.25, 0.5, 0.75, 1]],
  ["/work/station-supervisor", [0, 0.5, 1]],
  ["/work/selective-solder-driver", [0]],
  ["/work", [0, 1]],
  ["/about", [0, 1]],
  ["/nebula/station-supervisor", [0]],
  ["/nebula/tech/csharp", [0]],
];

async function measure(p) {
  return p.evaluate(({ TOL, MIN_PX }) => {
    const lines = [];
    // Inside an open node only the card's own text is reading text; the
    // corner links are chrome over the sky.
    const root = document.querySelector("[data-nebula-panel]") ?? document.querySelector("main");
    // Text scrolled under the sticky header is not visible, and the header's
    // own rule would be counted against it.
    const header = document.querySelector("header");
    const top = header ? Math.max(0, header.getBoundingClientRect().bottom + 1) : 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent.trim()) continue;
      const el = n.parentElement;
      if (el.closest("[aria-hidden='true'], .sr-only, [data-nebula-keyboard]")) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || Number(cs.opacity) === 0) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) {
        if (r.width < 2 || r.height < 2) continue;
        // Text scrolled out of the card's own scroll area is clipped, not drawn.
        const clip = el.closest("[data-panel-body]")?.getBoundingClientRect();
        const y0 = Math.max(r.top, top + 1, clip ? clip.top : -Infinity);
        const y1 = Math.min(r.bottom, innerHeight, clip ? clip.bottom : Infinity);
        // A line mostly hidden is not being read; its sliver sits on the
        // header's rule or the card's edge, and that is all it would measure.
        if (y1 - y0 < Math.max(2, r.height * 0.5) || r.right <= 0 || r.left >= innerWidth) continue;
        lines.push({ x: r.left, y: y0, w: r.width, h: y1 - y0, text: n.textContent.trim().slice(0, 40) });
      }
    }
    return lines;
  }, { TOL, MIN_PX });
}

async function hideText(p, on) {
  await p.evaluate((on) => {
    let s = document.getElementById("__hide");
    if (!on) { s?.remove(); return; }
    if (!s) { s = document.createElement("style"); s.id = "__hide"; document.head.appendChild(s); }
    // Text and its decorations go; boxes that are the page's own paper stay.
    s.textContent = `main *, header * { color: transparent !important; text-decoration-color: transparent !important; border-color: transparent !important; caret-color: transparent !important; }
      main img, main svg { visibility: hidden !important; }
      .link-underline::after { display: none !important; }`;
  }, on);
}

async function covered(p, lines, sharp) {
  const buf = await p.screenshot();
  return p.evaluate(async ({ b64, lines, TOL, MIN_PX, sharp }) => {
    const img = new Image();
    img.src = "data:image/png;base64," + b64;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0);
    const k = img.width / innerWidth;
    const paperCss = getComputedStyle(document.body).backgroundColor.match(/\d+/g).map(Number);
    const hits = [];
    for (const l of lines) {
      const x0 = Math.max(0, Math.floor(l.x * k)), y0 = Math.max(0, Math.floor(l.y * k));
      const x1 = Math.min(c.width, Math.ceil((l.x + l.w) * k)), y1 = Math.min(c.height, Math.ceil((l.y + l.h) * k));
      if (x1 <= x0 || y1 <= y0) continue;
      const wpx = x1 - x0, hpx = y1 - y0;
      const d = g.getImageData(x0, y0, wpx, hpx).data;
      let off = 0;
      if (sharp) {
        // On the opened shell the surface is tinted on purpose and shades
        // toward its rim; what must not be there is a *mark* — an edge, a
        // node's outline — so count steep local steps, not distance from paper.
        const at = (x, y) => (y * wpx + x) * 4;
        for (let y = 0; y < hpx - 2; y++) for (let x = 0; x < wpx - 2; x++) {
          const a = at(x, y), r = at(x + 2, y), dn = at(x, y + 2);
          const sx = Math.abs(d[a] - d[r]) + Math.abs(d[a + 1] - d[r + 1]) + Math.abs(d[a + 2] - d[r + 2]);
          const sy = Math.abs(d[a] - d[dn]) + Math.abs(d[a + 1] - d[dn + 1]) + Math.abs(d[a + 2] - d[dn + 2]);
          if (Math.max(sx, sy) > TOL) off++;
        }
      } else {
        for (let i = 0; i < d.length; i += 4) {
          const diff = Math.abs(d[i] - paperCss[0]) + Math.abs(d[i + 1] - paperCss[1]) + Math.abs(d[i + 2] - paperCss[2]);
          if (diff > TOL) off++;
        }
      }
      if (off > MIN_PX) hits.push({ text: l.text, off, at: [Math.round(l.x), Math.round(l.y)] });
    }
    return hits;
  }, { b64: buf.toString("base64"), lines, TOL, MIN_PX, sharp });
}

for (const w of widths) {
  if (ONLY && !ONLY.split(",").includes(w.name)) continue;
  const ctx = await b.newContext(w);
  for (const [path, fractions] of pages) {
    const p = await ctx.newPage();
    await p.goto(base + path, { waitUntil: "networkidle" });
    await p.waitForTimeout(path.startsWith("/nebula") ? 5000 : 3500);
    for (const f of fractions) {
      await p.evaluate((f) => scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * f), f);
      await p.waitForTimeout(1200);
      const lines = await measure(p);
      const tag = `${w.name}${path.replaceAll("/", "_") || "_home"}@${f}`;
      writeFileSync(`${out}/${tag}.png`, await p.screenshot());
      await hideText(p, true);
      await p.waitForTimeout(250);
      const hits = await covered(p, lines, path.startsWith("/nebula/"));
      writeFileSync(`${out}/${tag}_bare.png`, await p.screenshot());
      await hideText(p, false);
      check(hits.length === 0, `${w.name} ${path} @${f}: ${lines.length} lines`,
        hits.length ? `${hits.length} covered: ` + hits.slice(0, 4).map((h) => `"${h.text}" ${h.off}px @${h.at}`).join("; ") : "");
    }
    await p.close();
  }
  await ctx.close();
}
await b.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
