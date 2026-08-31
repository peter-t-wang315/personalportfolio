"use client";

import { motion, useScroll, useTransform } from "motion/react";

/** How far the user has to scroll before the cue is fully gone. */
const FADE_DISTANCE_PX = 240;

export function ScrollCue() {
  const { scrollY } = useScroll();
  const opacity = useTransform(scrollY, [0, FADE_DISTANCE_PX], [1, 0]);

  return (
    <motion.a
      href="#selected-work"
      aria-label="Scroll to selected work"
      style={{ opacity }}
      className="self-start flex flex-row items-center gap-2 text-ink-muted hover:text-ink"
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
