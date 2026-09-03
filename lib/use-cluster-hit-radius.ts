"use client";

import { useEffect, useState } from "react";
import {
  CLUSTER_BOUNDING_RADIUS,
  CLUSTER_DEPTH,
  HOME_CAMERA_FOV,
  HOME_CAMERA_POSITION,
} from "@/lib/cluster-geometry";

/**
 * World (0,0) always projects to the exact viewport center regardless of FOV
 * or aspect ratio, since the home camera looks straight down -z at the
 * origin (see CameraRig in nebula-canvas.tsx) — the cluster's parallax drift
 * is small enough (max 1.4 world units) to ignore for centering purposes.
 * This hook computes the one thing that does need real trig: the on-screen
 * radius of a sphere of the given world radius around the cluster's center,
 * from the real camera distance and vertical FOV, so it tracks the cluster's
 * true size rather than a guessed pixel value — and, because that radius is
 * a fixed fraction of window.innerHeight, it scales correctly across
 * viewport heights without a separate breakpoint per device.
 *
 * Defaults to CLUSTER_BOUNDING_RADIUS (includes per-node scale and drift
 * margin) for hit-testing use — an invisible click target should err
 * generous. Pass CLUSTER_RADIUS instead for anything *visible*, like the
 * idle pulse ring in nebula-affordance.tsx: that margin reads as a
 * mismatched, oversized circle once it's actually drawn rather than just
 * clickable.
 */
export function useClusterHitRadiusPx(
  worldRadius: number = CLUSTER_BOUNDING_RADIUS,
) {
  const [radiusPx, setRadiusPx] = useState(0);

  useEffect(() => {
    function recompute() {
      const verticalFovRad = (HOME_CAMERA_FOV * Math.PI) / 180;
      const distance = HOME_CAMERA_POSITION[2] - CLUSTER_DEPTH;
      const halfHeightWorld = distance * Math.tan(verticalFovRad / 2);
      const pxPerWorldUnit = window.innerHeight / 2 / halfHeightWorld;
      setRadiusPx(worldRadius * pxPerWorldUnit);
    }
    recompute();
    window.addEventListener("resize", recompute);
    return () => window.removeEventListener("resize", recompute);
  }, [worldRadius]);

  return radiusPx;
}
