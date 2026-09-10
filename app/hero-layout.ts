import { useSceneStore, type HeroTextItem } from "@/lib/scene-store";
import { setHeroFrame } from "./nebula-home-placement";

/**
 * **Measures the real hero so the canvas can paint a copy of it.**
 *
 * Part 5 of `07-continuous-space.md`: the plane standing in for the home page
 * has to match the page closely enough that swapping one for the other has
 * nowhere to show. The old plane drew the hero from `content/` at a layout of
 * its own — right words, wrong places — which was fine for a page seen from
 * 150 units off and mirrored, and would be a visible pop at the moment of the
 * hand-off. So the plane's texture is painted from *this*: every run of text
 * in the hero column, with its box, font, size, weight, tracking, leading and
 * colour as the browser computed them. The canvas re-wraps within the same
 * widths using the same fonts, so the lines break where the DOM broke them.
 *
 * Still not `html2canvas` or a `foreignObject` round-trip: those are heavy and
 * get the fonts subtly wrong, and this is a dozen `getBoundingClientRect`
 * calls.
 *
 * Two outputs, on two clocks. The *layout* (what the texture contains) goes to
 * the store and only changes on resize or a font swap. The *frame* (where the
 * column is on screen) goes to a per-frame record, because the pointer
 * parallax moves the column a few pixels every frame and the plane has to sit
 * on it exactly at the moment of the swap.
 */

/** The element the landing page marks as its hero column. */
export const HERO_COLUMN_ID = "hero-column";

function column() {
  if (typeof document === "undefined") return null;
  return document.getElementById(HERO_COLUMN_ID);
}

/**
 * Re-read where the column is. Cheap enough to run per frame.
 * Returns false when there is no hero in the document.
 */
export function measureHeroFrame(): boolean {
  const el = column();
  if (!el) return false;
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return false;
  setHeroFrame({ left: r.left, top: r.top, width: r.width, height: r.height });
  return true;
}

function pxOf(value: string, fallback: number) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

let lastSignature = "";

/**
 * Re-read the whole hero: frame and layout. Runs on mount, on resize, when
 * the fonts finish loading, and at the moment the reader clicks to leave.
 *
 * Text is gathered per *element* rather than per line: each element that
 * directly contains text becomes one item with its box, and the painter wraps
 * within that box. Elements the current tier hides (`display: none`) have no
 * client rect and are skipped, which is how the desktop and compact variants
 * of the stats and nav sort themselves out without this knowing about tiers.
 */
export function measureHero(): boolean {
  const el = column();
  if (!el) return false;
  const frame = el.getBoundingClientRect();
  if (frame.width <= 0 || frame.height <= 0) return false;
  setHeroFrame({
    left: frame.left,
    top: frame.top,
    width: frame.width,
    height: frame.height,
  });

  const items: HeroTextItem[] = [];
  const seen = new Set<Element>();
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (!parent || seen.has(parent)) continue;
    if (!node.textContent || !node.textContent.trim()) continue;
    seen.add(parent);
    const rect = parent.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    const style = getComputedStyle(parent);
    if (style.visibility === "hidden" || pxOf(style.opacity, 1) === 0) continue;
    let text = parent.textContent ?? "";
    if (style.textTransform === "lowercase") text = text.toLowerCase();
    else if (style.textTransform === "uppercase") text = text.toUpperCase();
    const fontSize = pxOf(style.fontSize, 16);
    items.push({
      text: text.replace(/\s+/g, " ").trim(),
      left: rect.left - frame.left,
      top: rect.top - frame.top,
      width: rect.width,
      height: rect.height,
      fontFamily: style.fontFamily,
      fontSize,
      fontWeight: style.fontWeight,
      letterSpacing: pxOf(style.letterSpacing, 0),
      lineHeight: pxOf(style.lineHeight, fontSize * 1.2),
      color: style.color,
    });
  }

  // Only publish a change. The frame moves every frame; the layout does not,
  // and every publish re-renders the plane and repaints its texture.
  const signature =
    `${Math.round(frame.width)}x${Math.round(frame.height)}|` +
    items
      .map(
        (i) =>
          `${i.text}@${Math.round(i.left)},${Math.round(i.top)},` +
          `${Math.round(i.width)},${i.fontSize}`,
      )
      .join(";");
  if (signature !== lastSignature) {
    lastSignature = signature;
    useSceneStore.getState().setHeroLayout({
      width: frame.width,
      height: frame.height,
      items,
    });
  }
  return true;
}
