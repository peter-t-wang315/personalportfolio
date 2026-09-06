import {
  projects,
  tech,
  layout,
  professionalClusterIds,
  type Vec3,
} from "@/content";

/**
 * Shared node geometry — radius, kind, and category per node id. Read by
 * both the constellation (2.2) and the edge layer (2.3) so surface trimming
 * and node typing stay in exactly one place.
 */
export const MAJOR_RADIUS = 0.85;
export const STANDARD_RADIUS = 0.6;
export const TECH_RADIUS = 0.34;

export type NodeCategory = "professional" | "personal" | "tech";

export interface NodeGeometry {
  id: string;
  position: Vec3;
  radius: number;
  kind: "project" | "tech";
  category: NodeCategory;
}

export const nodeGeometry: Record<string, NodeGeometry> = (() => {
  const map: Record<string, NodeGeometry> = {};
  for (const p of projects) {
    map[p.id] = {
      id: p.id,
      position: layout[p.id],
      radius: p.size === "major" ? MAJOR_RADIUS : STANDARD_RADIUS,
      kind: "project",
      category: professionalClusterIds.has(p.clusterId)
        ? "professional"
        : "personal",
    };
  }
  for (const t of tech) {
    map[t.id] = {
      id: t.id,
      position: layout[t.id],
      radius: TECH_RADIUS,
      kind: "tech",
      category: "tech",
    };
  }
  return map;
})();

export const nodeList = Object.values(nodeGeometry);

/**
 * Radius of the sphere that contains the whole constellation, node surfaces
 * included — **measured off the real computed layout**, not derived from
 * `layout.ts`'s CLUSTER_RADIUS/TECH_SHELL_RADIUS inputs. Those are targets the
 * relaxation pass and the "tech sits near the projects that use it" rule both
 * pull away from: the nominal 20-unit tech shell actually lands at 17.6, and
 * assuming 20 would scale the constellation 14% too small everywhere this is
 * used.
 *
 * The landing page's cluster footprint is defined against this (see
 * nebula-canvas.tsx's LANDING_SCALE), so it has to track the layout rather
 * than an intention about the layout.
 */
export const CONSTELLATION_BOUNDING_RADIUS = nodeList.reduce(
  (max, node) => Math.max(max, Math.hypot(...node.position) + node.radius),
  0,
);
