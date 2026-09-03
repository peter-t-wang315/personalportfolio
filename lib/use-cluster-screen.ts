"use client";

import { useEffect, useState } from "react";
import {
  CLUSTER_BOUNDING_RADIUS,
  clusterCenterYFraction,
  clusterScaleForViewport,
  pxPerWorldUnitFor,
} from "@/lib/cluster-geometry";
import { useSceneStore } from "@/lib/scene-store";

/**
 * Where the cluster actually is on screen right now, in absolute viewport
 * pixels, and how big it is — everything a DOM overlay needs to sit on top
 * of it. Returns absolute coordinates rather than an offset-from-center so
 * callers can hand them straight to motion's `animate` as x/y targets
 * without re-deriving the centre themselves.
 *
 * Two separate conversions are involved and they are not interchangeable:
 *
 * - The **radius** scales with the cluster group's own scale
 *   (clusterScaleForViewport), because that scale shrinks the geometry.
 * - The **parallax offset** does not. Parallax is applied to the group's
 *   *position*, and scaling a group about its own origin leaves its parent-
 *   space position untouched — so the offset converts at the unscaled rate.
 *
 * The parallax value itself is read from the store, written every frame by
 * the component that actually renders the cluster (nebula-canvas.tsx), so
 * this can never drift out of sync with what's really drawn. The Y sign flip
 * is real, not a typo: world +Y is up, CSS +Y is down. X needs no flip —
 * this camera has no roll, so +world X is screen-right.
 */
export function useClusterScreen(
  worldRadius: number = CLUSTER_BOUNDING_RADIUS,
) {
  const parallax = useSceneStore((s) => s.clusterParallax);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  useEffect(() => {
    function recompute() {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    }
    recompute();
    window.addEventListener("resize", recompute);
    return () => window.removeEventListener("resize", recompute);
  }, []);

  if (viewport.height <= 0) {
    return { ready: false, centerX: 0, centerY: 0, radiusPx: 0 };
  }

  const pxPerWorldUnit = pxPerWorldUnitFor(viewport.height);
  const scale = clusterScaleForViewport(viewport.width, viewport.height);

  const centerYFraction = clusterCenterYFraction(
    viewport.width,
    viewport.height,
  );

  return {
    ready: true,
    centerX: viewport.width / 2 + parallax.x * pxPerWorldUnit,
    centerY: viewport.height * centerYFraction - parallax.y * pxPerWorldUnit,
    radiusPx: worldRadius * pxPerWorldUnit * scale,
  };
}
