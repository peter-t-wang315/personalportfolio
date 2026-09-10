"use client";

import { CLUSTER_BOUNDING_RADIUS } from "@/lib/cluster-geometry";
import { useSceneStore } from "@/lib/scene-store";

/**
 * Where the graph is on screen right now, in viewport pixels, and how big —
 * everything a DOM overlay needs to sit on top of it.
 *
 * A read of what the scene published, not a second derivation of it. This used
 * to recompute the circle from the parallax offset and the viewport size,
 * which matched on the landing page and was wrong by two terms anywhere a
 * project is spotlit: the zoom that enlarges the graph on a work page, and the
 * offset that centres its lit cluster in the space beside the article. The
 * camera rig knows all of it because it solves it, so it says so and this
 * repeats it.
 *
 * Returns absolute coordinates rather than an offset from centre so callers
 * can hand them straight to motion's `animate` as x/y targets.
 */
export function useClusterScreen(
  /**
   * The world radius to report, for overlays measured against something other
   * than the bounding radius — the idle pulse ring sits on the node cloud
   * itself rather than its outer edge. Scaled from the published circle, so it
   * still tracks whatever the scene is actually drawing.
   */
  worldRadius: number = CLUSTER_BOUNDING_RADIUS,
) {
  const circle = useSceneStore((s) => s.clusterScreen);
  return {
    ready: circle.ready,
    centerX: circle.centerX,
    centerY: circle.centerY,
    radiusPx: (circle.radiusPx * worldRadius) / CLUSTER_BOUNDING_RADIUS,
  };
}
