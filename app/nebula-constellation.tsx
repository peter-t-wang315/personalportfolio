"use client";

import { useEffect } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { projects, tech, layout, selClusterIds } from "@/content";
import { palette } from "@/lib/palette";
import { makeRng } from "@/lib/seeded-random";
import { useDeviceTier, type DeviceTier } from "@/lib/device-tier";
import { useSceneStore } from "@/lib/scene-store";
import { createFresnelMaterial } from "./fresnel-material";

/**
 * Step 2.2 — materials. Node typing (solid --mask core on SEL project nodes,
 * everything else hollow), low-frequency vertex displacement so silhouettes
 * breathe, and the device-tier switch threaded through material selection.
 * Still no edges, motion simulation, or interaction; those are 2.3 onward.
 * See docs/05a-phase-2-sequence.md.
 *
 * Everything here is a static singleton — content is fixed at build time and
 * this file is client-only — so geometry, materials, and node data live at
 * module scope. The frame loop then mutates plain module objects, never
 * values owned by hooks.
 */
const MAJOR_RADIUS = 0.85;
const STANDARD_RADIUS = 0.6;
const TECH_RADIUS = 0.34;

const PROJECT_OPACITY = 0.9;
// Tech nodes read as a supporting layer around their clusters, not a
// population of their own — recessed to ~55% of project node opacity.
const TECH_OPACITY = PROJECT_OPACITY * 0.55;
// On tablet the tier table calls for tech nodes at reduced opacity
// (02-architecture.md, Responsive tiers); this is the reduction factor.
const TABLET_TECH_FACTOR = 0.7;

// Breathing displacement, as a fraction of each node's radius. The waveform
// peaks around ±1.5, so this keeps the silhouette within ~7% of spherical —
// enough to read as organic, not enough to read as damaged.
const BREATHE_AMPLITUDE = 0.045;
const BREATHE_SEED = 0xb4ea7e;

// SEL project cores: solid --mask sphere inside the shell, sized relative to
// the shell so it survives the radius difference between major and standard.
const CORE_SCALE = 0.38;

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

/** One shared clock uniform drives every breathing material. */
const breatheTime = { value: 0 };

const sphereGeometry = new THREE.SphereGeometry(1, 32, 32);
const coreMaterial = new THREE.MeshBasicMaterial({ color: palette.mask });

// One material for all tech nodes: they share opacity, don't breathe
// (displacement is a project-node trait — 05-phase-2.md, Nodes — and the
// stillness helps the hierarchy read), and dim as a group per tier.
const techMaterial = createFresnelMaterial({ opacity: TECH_OPACITY });

interface NodeDatum {
  id: string;
  position: [number, number, number];
  radius: number;
  kind: "project" | "tech";
  /** SEL project nodes only — the solid core the shell reveals. */
  hasCore: boolean;
  material: THREE.ShaderMaterial;
}

const nodes: NodeDatum[] = (() => {
  const rng = makeRng(BREATHE_SEED);
  const projectNodes: NodeDatum[] = projects.map((p) => ({
    id: p.id,
    position: layout[p.id],
    radius: p.size === "major" ? MAJOR_RADIUS : STANDARD_RADIUS,
    kind: "project",
    hasCore: selClusterIds.has(p.clusterId),
    material: createFresnelMaterial({
      opacity: PROJECT_OPACITY,
      displacementAmplitude: BREATHE_AMPLITUDE,
      seed: rng() * Math.PI * 2 * 10,
      timeUniform: breatheTime,
    }),
  }));
  const techNodes: NodeDatum[] = tech.map((t) => ({
    id: t.id,
    position: layout[t.id],
    radius: TECH_RADIUS,
    kind: "tech",
    hasCore: false,
    material: techMaterial,
  }));
  return [...projectNodes, ...techNodes];
})();

/**
 * The tier-dependent material branch, in place from the start so 2.5's
 * transmission swap extends it instead of retrofitting the render path.
 * Transmission policy per tier lives in 02-architecture.md's Responsive
 * tiers table; nothing is focusable yet, so today every path is fresnel.
 */
function shellMaterial(node: NodeDatum, tier: DeviceTier): THREE.Material {
  switch (tier) {
    case "desktop":
      // 2.5 adds: focused node, after fly-in completes -> real transmission.
      return node.material;
    case "tablet":
    case "mobile":
      return node.material;
  }
}

export function Constellation() {
  const tier = useDeviceTier();

  // Tech node visibility and opacity are tier-dependent — see
  // 02-architecture.md's Responsive tiers. The mobile/tablet toggle arrives
  // in 2.8; these are the defaults it will toggle from.
  const showTech = tier !== "mobile";
  useEffect(() => {
    techMaterial.uniforms.opacity.value =
      TECH_OPACITY * (tier === "tablet" ? TABLET_TECH_FACTOR : 1);
  }, [tier]);

  useFrame((state) => {
    // Reduced motion: stop advancing the clock and the displacement freezes
    // in place — silhouettes stay organic but hold still.
    if (useSceneStore.getState().reducedMotion) return;
    breatheTime.value = state.clock.elapsedTime;
  });

  return (
    <>
      <fog attach="fog" args={[palette.paper, FOG_NEAR, FOG_FAR]} />
      <group>
        {nodes.map((node) => {
          if (node.kind === "tech" && !showTech) return null;
          return (
            <mesh
              key={node.id}
              position={node.position}
              scale={node.radius}
              geometry={sphereGeometry}
              material={shellMaterial(node, tier)}
            >
              {node.hasCore && (
                <mesh
                  scale={CORE_SCALE}
                  geometry={sphereGeometry}
                  material={coreMaterial}
                />
              )}
            </mesh>
          );
        })}
      </group>
    </>
  );
}
