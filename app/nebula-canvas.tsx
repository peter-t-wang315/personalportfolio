"use client";

import { Canvas } from "@react-three/fiber";

/**
 * Lives in the root layout, not in any page, so it persists across route
 * changes. Renders nothing yet — this just proves the mount point exists
 * before the scene is built. See docs/02-architecture.md.
 */
export function NebulaCanvas() {
  return (
    <Canvas
      className="!fixed inset-0 z-0"
      gl={{ alpha: true }}
      dpr={[1, 2]}
    />
  );
}
