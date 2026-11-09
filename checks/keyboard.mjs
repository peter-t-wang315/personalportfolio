// The graph from the keyboard alone: can every node be focused, named and
// opened, is the focused node visible in the scene, does focus go into the
// panel and on through it, and does Escape put focus back on the node?
//   BASE=http://localhost:3200 node checks/keyboard.mjs [outdir]
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
const base = process.env.BASE ?? "http://localhost:3100";
const out = process.argv[2] ?? "checks/keyboard";
const only = process.env.ONLY; // "laptop" | "phone"
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
let pass = 0, fail = 0;
const check = (ok, label, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? "  — " + detail : ""}`); ok ? pass++ : fail++; };

const focusInfo = (p) => p.evaluate(() => {
  const el = document.activeElement;
  return {
    tag: el?.tagName.toLowerCase(),
    text: el?.textContent?.trim().slice(0, 60) ?? "",
    href: el?.getAttribute?.("href") ?? null,
    inList: !!el?.closest?.("[data-nebula-keyboard]"),
    inPanel: !!el?.closest?.("[data-nebula-panel]"),
    body: el?.hasAttribute?.("data-panel-body") ?? false,
  };
});

// The scene's own focus indicator: the floating hover title, as drei's Html
// renders it, on screen and opaque.
const sceneLabel = (p, name) => p.evaluate((name) => {
  const vw = innerWidth, vh = innerHeight;
  for (const el of document.querySelectorAll("div")) {
    if (el.children.length || el.textContent.trim() !== name) continue;
    if (el.closest("[data-nebula-keyboard]") || el.closest("[data-nebula-panel]")) continue;
    let hidden = false;
    for (let a = el; a; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.display === "none" || cs.visibility === "hidden") hidden = true;
    }
    const r = el.getBoundingClientRect();
    const opacity = Number(getComputedStyle(el).opacity);
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    return { found: true, hidden, opacity, x: Math.round(cx), y: Math.round(cy), onScreen: cx > 0 && cx < vw && cy > 0 && cy < vh };
  }
  return { found: false };
}, name);

const caption = (p) => p.evaluate(() => {
  const nav = document.querySelector("[data-nebula-keyboard]");
  const cap = nav?.querySelector('[aria-hidden="true"]');
  return cap ? cap.textContent.trim() : null;
});

const sizes = [
  { name: "laptop", viewport: { width: 1440, height: 900 } },
  { name: "phone", viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
].filter((s) => !only || s.name === only);

for (const size of sizes) {
  const ctx = await b.newContext(size);
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e)));
  await p.goto(base + "/nebula", { waitUntil: "networkidle" });
  await p.waitForTimeout(5000);
  const L = (s) => `${size.name}: ${s}`;

  await p.keyboard.press("Tab");
  let f = await focusInfo(p);
  check(f.text === "Home", L("first Tab is Home"), f.text);
  await p.keyboard.press("Tab");
  f = await focusInfo(p);
  check(f.inList, L("second Tab enters the graph"), `${f.text} ${f.href}`);
  await p.waitForTimeout(400);
  check(((await caption(p)) ?? "").length > 0, L("caption names the node"), await caption(p));

  const total = await p.evaluate(() => document.querySelectorAll("[data-nebula-keyboard] a").length);
  const tabStops = await p.evaluate(() => [...document.querySelectorAll("[data-nebula-keyboard] a")].filter((a) => a.tabIndex === 0).length);
  check(tabStops === 1, L("one tab stop for the whole list"), `${tabStops} of ${total}`);

  // Every node: focus it, wait for any turn, and find its title in the scene.
  const unseen = [];
  for (let i = 0; i < total; i++) {
    if (i > 0) await p.keyboard.press("ArrowRight");
    await p.waitForTimeout(size.name === "phone" ? 1000 : 700);
    f = await focusInfo(p);
    const name = f.text.replace(/, (project|technology)$/, "");
    const label = await sceneLabel(p, name);
    if (!(label.found && !label.hidden && label.onScreen && label.opacity > 0.5)) unseen.push(`${name} ${JSON.stringify(label)}`);
    if (i === 3 || i === 30) writeFileSync(`${out}/${size.name}_focus_${i}.png`, await p.screenshot());
  }
  check(unseen.length === 0, L(`all ${total} nodes visible in the scene when focused`), unseen.slice(0, 5).join(" | "));

  // Wraps round, and Home/End.
  await p.keyboard.press("ArrowRight");
  f = await focusInfo(p);
  const first = await p.evaluate(() => document.querySelector("[data-nebula-keyboard] a").textContent.trim());
  check(f.text === first, L("ArrowRight wraps to the first node"), f.text);
  await p.keyboard.press("End");
  await p.keyboard.press("Home");
  await p.keyboard.press("ArrowRight");
  await p.waitForTimeout(800);
  f = await focusInfo(p);
  const openedName = f.text.replace(/, (project|technology)$/, "");
  const openedHref = f.href;

  // Open it.
  await p.keyboard.press("Enter");
  await p.waitForTimeout(4500);
  check(new URL(p.url()).pathname === openedHref, L("Enter opens the node"), `${new URL(p.url()).pathname} vs ${openedHref}`);
  f = await focusInfo(p);
  check(f.body, L("focus moves into the panel"), JSON.stringify(f));
  writeFileSync(`${out}/${size.name}_open.png`, await p.screenshot());

  // Tab onward through the article: does it reach the links inside?
  const seq = [];
  for (let i = 0; i < 6; i++) {
    await p.keyboard.press("Tab");
    const g = await focusInfo(p);
    seq.push(`${g.tag}:${g.text.slice(0, 24)}${g.inPanel ? "[panel]" : ""}`);
  }
  console.log("      tab sequence after panel body:", seq.join(" → "));
  check(seq.some((s) => s.includes("[panel]") && s.startsWith("a:")), L("Tab reaches links inside the article"));

  // Back into the panel body, then Escape.
  await p.evaluate(() => document.querySelector("[data-panel-body]")?.focus());
  await p.keyboard.press("Escape");
  await p.waitForTimeout(3500);
  check(new URL(p.url()).pathname === "/nebula", L("Escape closes the node"));
  f = await focusInfo(p);
  check(f.inList && f.href === openedHref, L("focus returns to the node that was open"), `${f.text} ${f.href}`);
  const back = await sceneLabel(p, openedName);
  check(back.found && back.onScreen, L("and it is lit in the scene"), JSON.stringify(back));

  // Tab out of the list goes on, not round.
  await p.keyboard.press("Tab");
  f = await focusInfo(p);
  check(!f.inList, L("Tab leaves the list"), `${f.tag} ${f.text}`);
  await p.waitForTimeout(300);
  check((await caption(p)) === null, L("caption gone once focus leaves"));

  check(errors.length === 0, L("no page errors"), errors.join(" | "));
  await ctx.close();
}

await b.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
