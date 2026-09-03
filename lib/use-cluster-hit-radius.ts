"use client";

import { useEffect, useState } from "react";
import {
  CLUSTER_BOUNDING_RADIUS,
  CLUSTER_DEPTH,
  HOME_CAMERA_FOV,
  HOME_CAMERA_POSITION,
} from "@/lib/cluster-geometry";
import { useSceneStore } from "@/lib/scene-store";

/**
 * Pixels per world unit at the cluster's depth, from the real camera
 * distance and vertical FOV — not a guessed value, and not a fixed pixel
 * count, since it's a constant fraction of window.innerHeight and so scales
 * correctly across viewport heights without a separate breakpoint per
 * device. Shared by the radius and offset hooks below so the trig is
 * computed once.
 */
function usePxPerWorldUnit() {
  const [pxPerWorldUnit, setPxPerWorldUnit] = useState(0);

  useEffect(() => {
    function recompute() {
      const verticalFovRad = (HOME_CAMERA_FOV * Math.PI) / 180;
      const distance = HOME_CAMERA_POSITION[2] - CLUSTER_DEPTH;
      const halfHeightWorld = distance * Math.tan(verticalFovRad / 2);
      setPxPerWorldUnit(window.innerHeight / 2 / halfHeightWorld);
    }
    recompute();
    window.addEventListener("resize", recompute);
    return () => window.removeEventListener("resize", recompute);
  }, []);

  return pxPerWorldUnit;
}

/**
 * On-screen radius of a sphere of the given world radius around the
 * cluster's center. Defaults to CLUSTER_BOUNDING_RADIUS (includes per-node
 * scale and drift margin) for hit-testing use — an invisible click target
 * should err generous. Pass CLUSTER_RADIUS instead for anything *visible*,
 * like the idle pulse ring in nebula-affordance.tsx: that margin reads as a
 * mismatched, oversized circle once it's actually drawn rather than just
 * clickable.
 */
export function useClusterHitRadiusPx(
  worldRadius: number = CLUSTER_BOUNDING_RADIUS,
) {
  const pxPerWorldUnit = usePxPerWorldUnit();
  return worldRadius * pxPerWorldUnit;
}

/**
 * Live pixel offset of the cluster's visual center from the viewport
 * center. World (0,0) projects to viewport center only when the cluster's
 * parallax offset (nebula-canvas.tsx's Cluster component, up to ±1.4 world
 * units, eased toward the pointer) happens to be zero — everywhere else,
 * which is most of the time the pointer isn't dead-center, it doesn't. This
 * reads the exact same offset the 3D scene is currently rendering (written
 * to the store every frame from that component — see scene-store.ts) rather
 * than re-deriving an approximation, so a DOM overlay built on top of it can
 * never drift out of sync with the real, currently-rendered cluster.
 *
 * The Y sign flip is real, not a typo: world +Y is up, CSS +Y is down.
 * X needs no flip — this camera has no roll, so +world X is screen-right,
 * matching CSS +X directly.
 */
export function useClusterOffsetPx() {
  const parallax = useSceneStore((s) => s.clusterParallax);
  const pxPerWorldUnit = usePxPerWorldUnit();

  return {
    xPx: parallax.x * pxPerWorldUnit,
    yPx: -parallax.y * pxPerWorldUnit,
  };
}
