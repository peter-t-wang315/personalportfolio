"use client";

import { useEffect, useLayoutEffect } from "react";
import { useSceneStore } from "@/lib/scene-store";
import { HERO_COLUMN_ID, measureHero, measureHeroFrame } from "./hero-layout";

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Keeps the hero measured while the landing page is mounted — see
 * hero-layout.ts for what the measurement is for.
 *
 * Before first paint, so the return flight has the layout from its first
 * frame: the landing page mounts hidden behind `data-arriving` the moment the
 * reader leaves the graph, and the plane it is flying back to has to already
 * be painted with the page it will become. Then on resize, and again once the
 * fonts are in, because a texture painted in the fallback font is a texture
 * nothing repaints.
 *
 * While a flight is running the *frame* is re-read every animation frame. The
 * column carries the pointer parallax (pointer-parallax.tsx), a spring that is
 * still settling when the page appears, and a plane placed from a stale rect
 * would be a few pixels off the page at the one moment that matters.
 */
export function HeroMeasure() {
  const flying = useSceneStore((s) => s.flying);

  useIsomorphicLayoutEffect(() => {
    measureHero();
    const el = document.getElementById(HERO_COLUMN_ID);
    const observer =
      el && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => measureHero())
        : null;
    if (el && observer) observer.observe(el);
    window.addEventListener("resize", measureHero);
    document.fonts?.ready.then(() => measureHero()).catch(() => {});
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measureHero);
    };
  }, []);

  useEffect(() => {
    if (!flying) return;
    let raf = 0;
    const tick = () => {
      measureHeroFrame();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [flying]);

  return null;
}
