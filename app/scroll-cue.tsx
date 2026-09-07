"use client";

import { motion, useScroll, useTransform } from "motion/react";

/**
 * How far the user has to scroll before the cue is fully gone. Also reused
 * by nebula-affordance.tsx: the cluster it hovers-reveal-triggers off of is
 * a `position: fixed` canvas layer, glued to the viewport rather than
 * scrolling with the page (see nebula-canvas.tsx), so its hover region uses
 * the same threshold to stop being interactive once the user has committed
 * to scrolling past the hero, rather than lingering over unrelated content.
 */
export const FADE_DISTANCE_PX = 240;

/**
 * The top margin is what separates the arrows from the hero's link row, which
 * is bottom-anchored directly above them (hero-nav.tsx). It is real spacing
 * rather than something absorbed by the growing column above: the column claims
 * the hero's *remaining* height, so a margin here is subtracted before that and
 * pushes the links up by exactly this much. Trimmed on short viewports, where
 * there is no spare height for it to come out of.
 */
export function ScrollCue() {
  const { scrollY } = useScroll();
  const opacity = useTransform(scrollY, [0, FADE_DISTANCE_PX], [1, 0]);

  return (
    <motion.a
      href="#selected-work"
      aria-label="Scroll to selected work"
      style={{ opacity }}
      className="self-start flex flex-row items-center gap-2 text-ink-muted hover:text-ink mt-10 [@media(max-height:500px)]:mt-4"
    >
      {[0, 1, 2].map((i) => (
        <svg
          key={i}
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          className="scroll-cue-caret"
          style={{ animationDelay: `${i * 0.15}s` }}
          aria-hidden="true"
        >
          <path
            d="M4 7L10 13L16 7"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ))}
    </motion.a>
  );
}
