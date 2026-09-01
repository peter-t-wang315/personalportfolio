"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { projects, tech, layout } from "@/content";
import { palette } from "@/lib/palette";
import { createFresnelMaterial } from "./fresnel-material";

/**
 * Step 2.1, revised — layout and static geometry with the shared fresnel
 * node material and paper-matched scene fog for depth. Still no motion and
 * no interaction; node typing, vertex displacement, idle rotation/drift and
 * the material tier switch are step 2.2. See docs/05a-phase-2-sequence.md.
 */
const MAJOR_RADIUS = 0.85;
const STANDARD_RADIUS = 0.6;
const TECH_RADIUS = 0.34;

const PROJECT_OPACITY = 0.9;
// Tech nodes read as a supporting layer around their clusters, not a
// population of their own — recessed to ~55% of project node opacity.
const TECH_OPACITY = PROJECT_OPACITY * 0.55;

/**
 * Fog band, re-measured against actual per-node camera-space depth (not
 * guessed): nodes span depth 28.6–60.5 from this camera. Far was originally
 * 90, well past the real max depth of 60.5, so the falloff curve never got
 * close to completing — the farthest node only reached 51% fade, not
 * enough to read as recession. Far now sits just past the true max depth,
 * so the farthest cluster reaches ~90% fade (visibly receded, not erased)
 * while the nearest nodes stay untouched.
 */
const FOG_NEAR = 30;
const FOG_FAR = 68;

interface NodeDatum {
  id: string;
  position: [number, number, number];
  radius: number;
  kind: "project" | "tech";
}

function useConstellationNodes(): NodeDatum[] {
  return useMemo(() => {
    const projectNodes: NodeDatum[] = projects.map((p) => ({
      id: p.id,
      position: layout[p.id],
      radius: p.size === "major" ? MAJOR_RADIUS : STANDARD_RADIUS,
      kind: "project",
    }));
    const techNodes: NodeDatum[] = tech.map((t) => ({
      id: t.id,
      position: layout[t.id],
      radius: TECH_RADIUS,
      kind: "tech",
    }));
    return [...projectNodes, ...techNodes];
  }, []);
}

export function Constellation() {
  const nodes = useConstellationNodes();
  const geometry = useMemo(() => new THREE.SphereGeometry(1, 32, 32), []);
  const projectMaterial = useMemo(
    () => createFresnelMaterial(PROJECT_OPACITY),
    [],
  );
  const techMaterial = useMemo(() => createFresnelMaterial(TECH_OPACITY), []);

  return (
    <>
      <fog attach="fog" args={[palette.paper, FOG_NEAR, FOG_FAR]} />
      <group>
        {nodes.map((node) => (
          <mesh
            key={node.id}
            position={node.position}
            scale={node.radius}
            geometry={geometry}
            material={node.kind === "project" ? projectMaterial : techMaterial}
          />
        ))}
      </group>
    </>
  );
}
