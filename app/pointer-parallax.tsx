"use client";

import { useEffect } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";
import { useSceneStore } from "@/lib/scene-store";

const MAX_OFFSET_PX = 12;
const SPRING = { stiffness: 120, damping: 20, mass: 0.6 };

/**
 * Cursor parallax for landing-page text, opposite the background cluster
 * (see nebula-canvas.tsx). Translates up to 12px, spring-eased with high
 * damping so it reads as weighted rather than floaty. Used by both the hero
 * and the section below it. Fully inert under prefers-reduced-motion.
 */
export function PointerParallax({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const pointer = useSceneStore((s) => s.pointer);
  const reducedMotion = useSceneStore((s) => s.reducedMotion);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, SPRING);
  const springY = useSpring(y, SPRING);

  useEffect(() => {
    if (reducedMotion) {
      x.set(0);
      y.set(0);
      return;
    }
    x.set(pointer.x * MAX_OFFSET_PX);
    y.set(pointer.y * MAX_OFFSET_PX);
  }, [pointer, reducedMotion, x, y]);

  return (
    <motion.div className={className} style={{ x: springX, y: springY }}>
      {children}
    </motion.div>
  );
}
