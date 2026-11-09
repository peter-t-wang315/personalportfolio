// The 404: is every missing URL on paper, in the site's type, with a way home,
// and with nothing from the scene drawn over the message? Cold loads at a
// phone and a laptop, plus one client navigation out of the graph.
//   BASE=http://localhost:3200 node checks/notfound.mjs [outdir]
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
const base = process.env.BASE ?? "http://localhost:3100";
const out = process.argv[2] ?? "checks/notfound";
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
let pass = 0, fail = 0;
const check = (ok, label, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? "  — " + detail : ""}`); ok ? pass++ : fail++; };

// Paper behind the message: sample the canvas region under the text through
// the page, i.e. what the reader sees, as pixels of the screenshot.
async function inspect(p, label) {
  const info = await p.evaluate(() => {
    const h1 = document.querySelector("main h1");
    const home = [...document.querySelectorAll("main a")].find((a) => a.textContent.trim() === "Home");
    const header = document.querySelector("header");
    const r = h1?.closest("div.max-w-\\[66ch\\]")?.getBoundingClientRect();
    return {
      title: document.title,
      h1: h1?.textContent.trim(),
      font: h1 ? getComputedStyle(h1).fontFamily : null,
      home: home?.getAttribute("href") ?? null,
      header: !!header && header.getBoundingClientRect().height > 0,
      cursor: document.documentElement.dataset.globeCursor ?? null,
      arriving: document.documentElement.dataset.arriving ?? null,
      box: r ? { x: r.left, y: r.top, w: r.width, h: r.height } : null,
    };
  });
  check(info.h1 === "not found", `${label}: heading`, info.h1);
  check(info.title.startsWith("Not found"), `${label}: title`, info.title);
  check(/geist/i.test(info.font ?? ""), `${label}: site type`, info.font);
  check(info.home === "/", `${label}: a way home`);
  check(info.header, `${label}: site header shown`);
  check(info.arriving === null, `${label}: page not held behind the curtain`);
  // Every pixel in the text column must be paper or ink — no scene colours.
  const shot = await p.screenshot({ clip: { x: 0, y: 0, ...p.viewportSize() } });
  return { info, shot };
}

async function paperOnly(p, label) {
  // Hide the text and header, then the whole viewport must be one paper colour.
  await p.addStyleTag({ content: "main *:not([aria-hidden]), header { visibility: hidden !important; }" });
  await p.waitForTimeout(300);
  const stats = await p.evaluate(async () => {
    const bg = getComputedStyle(document.body).backgroundColor;
    return bg;
  });
  const buf = await p.screenshot();
  await p.addStyleTag({ content: "main *:not([aria-hidden]), header { visibility: visible !important; }" });
  // Decode with the browser itself to count non-paper pixels.
  const off = await p.evaluate(async (b64) => {
    const img = new Image();
    img.src = "data:image/png;base64," + b64;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    const r0 = d[0], g0 = d[1], b0 = d[2];
    let off = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (Math.abs(d[i] - r0) + Math.abs(d[i + 1] - g0) + Math.abs(d[i + 2] - b0) > 6) off++;
    }
    return { off, total: d.length / 4, paper: [r0, g0, b0] };
  }, buf.toString("base64"));
  check(off.off === 0, `${label}: nothing from the scene drawn`, `${off.off}/${off.total} off-paper px, paper rgb(${off.paper}) body ${stats}`);
}

const sizes = [
  { name: "phone", viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  { name: "laptop", viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
];
const urls = ["/nonexistent", "/work/nope", "/nebula/bogus", "/nebula/tech/bogus"];

for (const size of sizes) {
  const ctx = await b.newContext(size);
  for (const url of urls) {
    const p = await ctx.newPage();
    const res = await p.goto(base + url, { waitUntil: "networkidle" });
    await p.waitForTimeout(2500);
    const label = `${size.name} ${url}`;
    check(res.status() === 404, `${label}: status 404`, String(res.status()));
    const { shot } = await inspect(p, label);
    await import("node:fs").then((fs) => fs.writeFileSync(`${out}/${size.name}${url.replaceAll("/", "_")}.png`, shot));
    await paperOnly(p, label);
    // The way home goes home.
    await p.locator("main a", { hasText: "Home" }).first().click();
    await p.waitForURL(base + "/", { timeout: 5000 }).catch(() => {});
    check(new URL(p.url()).pathname === "/", `${label}: Home goes home`);
    await p.close();
  }
  await ctx.close();
}

// Client navigation from inside the graph to a missing node URL: the chrome
// must let go of graph mode (cursor, curtain) and the page must arrive.
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(base + "/nebula", { waitUntil: "networkidle" });
  await p.waitForTimeout(4000);
  await p.evaluate(() => {
    const a = document.createElement("a");
    a.href = "/nebula/bogus";
    a.textContent = "x";
    a.id = "__probe";
    document.body.appendChild(a);
  });
  // A plain anchor is a full load; drive Next's router instead.
  await p.evaluate(() => window.next?.router?.push("/nebula/bogus"));
  await p.waitForTimeout(3500);
  const label = "laptop /nebula → /nebula/bogus (client)";
  check(new URL(p.url()).pathname === "/nebula/bogus", `${label}: url`);
  const { shot } = await inspect(p, label);
  (await import("node:fs")).writeFileSync(`${out}/laptop_client_nebula_bogus.png`, shot);
  const opacity = await p.evaluate(() => getComputedStyle(document.querySelector("main")).opacity);
  check(opacity === "1", `${label}: page visible`, opacity);
  await paperOnly(p, label);
  await ctx.close();
}

await b.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
