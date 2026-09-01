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

/**
 * Fog band chosen against the actual scene depths: camera sits ~41.6 units
 * from the origin, so nodes span roughly 24–60 units of view depth. Near at
 * 30 leaves the front of the constellation untouched; far at 90 lands the
 * far side at ~50% faded — receded, still countable.
 */
const FOG_NEAR = 30;
const FOG_FAR = 90;

interface NodeDatum {
  id: string;
  position: [number, number, number];
  radius: number;
}

function useConstellationNodes(): NodeDatum[] {
  return useMemo(() => {
    const projectNodes: NodeDatum[] = projects.map((p) => ({
      id: p.id,
      position: layout[p.id],
      radius: p.size === "major" ? MAJOR_RADIUS : STANDARD_RADIUS,
    }));
    const techNodes: NodeDatum[] = tech.map((t) => ({
      id: t.id,
      position: layout[t.id],
      radius: TECH_RADIUS,
    }));
    return [...projectNodes, ...techNodes];
  }, []);
}

export function Constellation() {
  const nodes = useConstellationNodes();
  const geometry = useMemo(() => new THREE.SphereGeometry(1, 32, 32), []);
  const material = useMemo(() => createFresnelMaterial(), []);

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
            material={material}
          />
        ))}
      </group>
    </>
  );
}
