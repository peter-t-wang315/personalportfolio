"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { usePathname } from "next/navigation";
import { useSceneStore } from "@/lib/scene-store";
import { makeRng } from "@/lib/seeded-random";

/**
 * Phase 1 version: a static-feeling drifting cluster, not the real graph.
 * No hover, no click, no edges. See docs/04-phase-1.md.
 */
const CLUSTER_SEED = 0xc105a7;
const NODE_COUNT = 40;
const CLUSTER_RADIUS = 3;
const CLUSTER_DEPTH = -14;
const PARALLAX_MAX = 1.4;

interface NodeDatum {
  base: THREE.Vector3;
  driftPhase: number;
  driftSpeed: number;
  driftAmplitude: number;
  scale: number;
}

function generateNodes(): NodeDatum[] {
  const rng = makeRng(CLUSTER_SEED);
  const nodes: NodeDatum[] = [];
  for (let i = 0; i < NODE_COUNT; i++) {
    let x = 0;
    let y = 0;
    let z = 0;
    let lengthSq = 2;
    while (lengthSq > 1) {
      x = rng() * 2 - 1;
      y = rng() * 2 - 1;
      z = rng() * 2 - 1;
      lengthSq = x * x + y * y + z * z;
    }
    nodes.push({
      base: new THREE.Vector3(x, y, z).multiplyScalar(CLUSTER_RADIUS),
      driftPhase: rng() * Math.PI * 2,
      driftSpeed: 0.15 + rng() * 0.1,
      driftAmplitude: 0.08 + rng() * 0.1,
      scale: 0.12 + rng() * 0.1,
    });
  }
  return nodes;
}

/** Rim-lit translucent sphere with a soft inner core, the default node material. */
function useFresnelMaterial() {
  return useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          color: { value: new THREE.Color("#1f4a3a") },
          opacity: { value: 0.9 },
        },
        vertexShader: `
          varying vec3 vNormal;
          varying vec3 vViewPosition;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            vViewPosition = -mvPosition.xyz;
            gl_Position = projectionMatrix * mvPosition;
          }
        `,
        fragmentShader: `
          uniform vec3 color;
          uniform float opacity;
          varying vec3 vNormal;
          varying vec3 vViewPosition;
          void main() {
            vec3 viewDir = normalize(vViewPosition);
            float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 2.2);
            float core = 0.12;
            gl_FragColor = vec4(color, (fresnel * 0.8 + core) * opacity);
          }
        `,
        transparent: true,
        depthWrite: false,
      }),
    [],
  );
}

function Cluster() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  const nodes = useMemo(() => generateNodes(), []);
  const geometry = useMemo(() => new THREE.SphereGeometry(1, 16, 16), []);
  const material = useFresnelMaterial();

  const groupRef = useRef<THREE.Group>(null);
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const parallax = useRef(new THREE.Vector2());
  const currentScale = useRef(1);

  useFrame((state) => {
    const { pointer, reducedMotion } = useSceneStore.getState();
    const elapsed = state.clock.elapsedTime;

    const targetOpacity = isHome ? 0.9 : 0.35;
    const targetScale = isHome ? 1 : 0.7;
    const ease = reducedMotion ? 1 : 0.06;

    material.uniforms.opacity.value = THREE.MathUtils.lerp(
      material.uniforms.opacity.value,
      targetOpacity,
      ease,
    );
    currentScale.current = THREE.MathUtils.lerp(
      currentScale.current,
      targetScale,
      ease,
    );

    if (!groupRef.current) return;
    groupRef.current.scale.setScalar(currentScale.current);

    if (reducedMotion) {
      parallax.current.set(0, 0);
    } else {
      parallax.current.x = THREE.MathUtils.lerp(
        parallax.current.x,
        -pointer.x * PARALLAX_MAX,
        0.05,
      );
      parallax.current.y = THREE.MathUtils.lerp(
        parallax.current.y,
        pointer.y * PARALLAX_MAX,
        0.05,
      );
    }
    groupRef.current.position.x = parallax.current.x;
    groupRef.current.position.y = parallax.current.y;

    if (!reducedMotion) {
      nodes.forEach((node, i) => {
        const mesh = meshRefs.current[i];
        if (!mesh) return;
        const drift =
          Math.sin(elapsed * node.driftSpeed + node.driftPhase) *
          node.driftAmplitude;
        mesh.position.set(node.base.x, node.base.y + drift, node.base.z);
      });
    }
  });

  return (
    <group ref={groupRef} position={[0, 0, CLUSTER_DEPTH]}>
      {nodes.map((node, i) => (
        <mesh
          key={i}
          ref={(el) => {
            meshRefs.current[i] = el;
          }}
          position={node.base}
          scale={node.scale}
          geometry={geometry}
          material={material}
        />
      ))}
    </group>
  );
}

export function NebulaCanvas() {
  return (
    <Canvas
      className="!fixed inset-0 z-0"
      gl={{ alpha: true }}
      dpr={[1, 2]}
      camera={{ position: [0, 0, 9], fov: 45 }}
    >
      <Cluster />
    </Canvas>
  );
}
