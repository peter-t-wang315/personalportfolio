import { projects, tech, layout, selClusterIds, type Vec3 } from "@/content";

/**
 * Shared node geometry — radius, kind, and SEL-core status per node id.
 * Read by both the constellation (2.2) and the edge layer (2.3) so surface
 * trimming and node typing stay in exactly one place.
 */
export const MAJOR_RADIUS = 0.85;
export const STANDARD_RADIUS = 0.6;
export const TECH_RADIUS = 0.34;

export interface NodeGeometry {
  id: string;
  position: Vec3;
  radius: number;
  kind: "project" | "tech";
  hasCore: boolean;
}

export const nodeGeometry: Record<string, NodeGeometry> = (() => {
  const map: Record<string, NodeGeometry> = {};
  for (const p of projects) {
    map[p.id] = {
      id: p.id,
      position: layout[p.id],
      radius: p.size === "major" ? MAJOR_RADIUS : STANDARD_RADIUS,
      kind: "project",
      hasCore: selClusterIds.has(p.clusterId),
    };
  }
  for (const t of tech) {
    map[t.id] = {
      id: t.id,
      position: layout[t.id],
      radius: TECH_RADIUS,
      kind: "tech",
      hasCore: false,
    };
  }
  return map;
})();

export const nodeList = Object.values(nodeGeometry);
