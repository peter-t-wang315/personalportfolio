"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { makeRng } from "@/lib/seeded-random";
import { palette } from "@/lib/palette";
import { useDeviceTier, type DeviceTier } from "@/lib/device-tier";
import { useSceneStore } from "@/lib/scene-store";
import { nodeList, type NodeGeometry } from "@/lib/node-geometry";
import { createFresnelMaterial } from "./fresnel-material";
import { Edges } from "./nebula-edges";
import { stepSimulation, getLivePosition } from "./nebula-simulation";

/**
 * Step 2.2 — materials. Node typing (solid --mask core on SEL project nodes,
 * everything else hollow), low-frequency vertex displacement so silhouettes
 * breathe, and the device-tier switch threaded through material selection.
 * Step 2.3 adds edges (see ./nebula-edges.tsx). Step 2.3a adds the force
 * simulation (see ./nebula-simulation.ts) that drives node positions here.
 * See docs/05a-phase-2-sequence.md.
 *
 * Everything here is a static singleton — content is fixed at build time and
 * this file is client-only — so geometry, materials, and node data live at
 * module scope. The frame loop then mutates plain module objects, never
 * values owned by hooks.
 */
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

const materialByNodeId: Record<string, THREE.ShaderMaterial> = (() => {
  const rng = makeRng(BREATHE_SEED);
  const map: Record<string, THREE.ShaderMaterial> = {};
  for (const node of nodeList) {
    map[node.id] =
      node.kind === "project"
        ? createFresnelMaterial({
            opacity: PROJECT_OPACITY,
            displacementAmplitude: BREATHE_AMPLITUDE,
            seed: rng() * Math.PI * 2 * 10,
            timeUniform: breatheTime,
          })
        : techMaterial;
  }
  return map;
})();

/**
 * The tier-dependent material branch, in place from the start so 2.5's
 * transmission swap extends it instead of retrofitting the render path.
 * Transmission policy per tier lives in 02-architecture.md's Responsive
 * tiers table; nothing is focusable yet, so today every path is fresnel.
 */
function shellMaterial(node: NodeGeometry, _tier: DeviceTier): THREE.Material {
  // 2.5 adds: desktop + focused + fly-in complete -> real transmission.
  return materialByNodeId[node.id];
}

export function Constellation() {
  const tier = useDeviceTier();
  const meshRefs = useRef<Record<string, THREE.Mesh | null>>({});

  // Tech node visibility and opacity are tier-dependent — see
  // 02-architecture.md's Responsive tiers. The mobile/tablet toggle arrives
  // in 2.8; these are the defaults it will toggle from.
  const showTech = tier !== "mobile";
  useEffect(() => {
    techMaterial.uniforms.opacity.value =
      TECH_OPACITY * (tier === "tablet" ? TABLET_TECH_FACTOR : 1);
  }, [tier]);

  useFrame((state, delta) => {
    // Reduced motion: stop advancing the clock and the displacement freezes
    // in place — silhouettes stay organic but hold still. Skipping
    // stepSimulation the same way leaves every node at its seeded layout
    // position, since livePositions starts there and nothing ever moves it.
    if (useSceneStore.getState().reducedMotion) return;
    breatheTime.value = state.clock.elapsedTime;

    stepSimulation(state.clock.elapsedTime, delta);
    for (const node of nodeList) {
      const mesh = meshRefs.current[node.id];
      const live = getLivePosition(node.id);
      if (mesh && live) mesh.position.copy(live);
    }
  });

  return (
    <>
      <fog attach="fog" args={[palette.paper, FOG_NEAR, FOG_FAR]} />
      <group>
        <Edges showTech={showTech} />
        {nodeList.map((node) => {
          if (node.kind === "tech" && !showTech) return null;
          return (
            <mesh
              key={node.id}
              ref={(el) => {
                meshRefs.current[node.id] = el;
              }}
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
