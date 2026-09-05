"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { usePathname } from "next/navigation";
import { CameraControls, CameraControlsImpl } from "@react-three/drei";
import { useSceneStore } from "@/lib/scene-store";
import { makeRng } from "@/lib/seeded-random";
import {
  CLUSTER_DEPTH,
  CLUSTER_PARALLAX_MAX_PX,
  CLUSTER_RADIUS,
  HOME_CAMERA_FOV,
  HOME_CAMERA_POSITION,
  clusterCenterXFraction,
  clusterCenterYFraction,
  clusterScaleForViewport,
  pxPerWorldUnitFor,
} from "@/lib/cluster-geometry";
import { createFresnelMaterial } from "./fresnel-material";
import { Constellation } from "./nebula-constellation";

/**
 * Phase 1 version: a static-feeling drifting cluster, not the real graph.
 * No hover, no click, no edges. See docs/04-phase-1.md. CLUSTER_RADIUS,
 * CLUSTER_DEPTH, and the home camera constants live in lib/cluster-geometry.ts
 * — nebula-affordance.tsx needs those same numbers without pulling in three.js.
 */
const CLUSTER_SEED = 0xc105a7;
const NODE_COUNT = 40;
/**
 * Easing toward the pointer, per frame. Weighted rather than floaty, per
 * 01-design-system.md — but responsive enough to read as following a finger
 * during a drag, which a slower value did not.
 */
const PARALLAX_EASE = 0.09;
// World units — far below anything visible (radiusPx conversion is roughly
// 40-70px per world unit depending on viewport height), just enough to
// collapse the tail of the lerp's asymptotic approach into a single write.
const PARALLAX_WRITE_EPSILON = 0.0005;

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

function useFresnelMaterial() {
  return useMemo(() => createFresnelMaterial(), []);
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
  const lastWrittenParallax = useRef({ x: 0, y: 0 });

  const sheen = useRef(0);

  useFrame((state) => {
    const { pointer, reducedMotion, tilt, tiltActive } =
      useSceneStore.getState();
    const elapsed = state.clock.elapsedTime;

    // Tilt drives where the highlight falls on the shells, and nothing else.
    // No position, no camera — see 01-design-system.md's Tilt-reactive
    // behaviours section, and note that the device-orientation *parallax*
    // prohibition above it still holds. uSheen ramps rather than snapping, so
    // granting the sensor permission mid-session fades the effect in instead
    // of popping it, and reduced motion fades it back out.
    const targetSheen = tiltActive && !reducedMotion ? 1 : 0;
    sheen.current = THREE.MathUtils.lerp(sheen.current, targetSheen, 0.05);
    material.uniforms.uSheen.value = sheen.current;
    if (sheen.current > 0.001) {
      (material.uniforms.uTilt.value as THREE.Vector2).set(tilt.x, tilt.y);
    }

    const targetOpacity = isHome ? 0.9 : 0.35;
    // Narrow viewports shrink the whole cluster so it doesn't fill the width
    // edge to edge — see clusterScaleForViewport. No-op on desktop/tablet.
    // Every DOM overlay measured against the cluster applies the same factor
    // (lib/use-cluster-screen.ts), so they can't drift apart.
    const targetScale =
      (isHome ? 1 : 0.7) *
      clusterScaleForViewport(state.size.width, state.size.height);
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
      // The design system specifies this swing in pixels, so it is converted
      // here rather than stored as world units — see CLUSTER_PARALLAX_MAX_PX.
      // Unscaled rate on purpose: this sets the group's position, which the
      // group's own scale does not affect (same reasoning as the centre
      // offsets below, and as use-cluster-screen.ts on the DOM side).
      const maxWorld =
        CLUSTER_PARALLAX_MAX_PX / pxPerWorldUnitFor(state.size.height);
      parallax.current.x = THREE.MathUtils.lerp(
        parallax.current.x,
        -pointer.x * maxWorld,
        PARALLAX_EASE,
      );
      parallax.current.y = THREE.MathUtils.lerp(
        parallax.current.y,
        pointer.y * maxWorld,
        PARALLAX_EASE,
      );
    }
    // The cluster is not always centred on the viewport. On narrow ones it
    // drops below the hero text (clusterCenterYFraction); on wide, short ones
    // it slides right of the hero's text column (clusterCenterXFraction).
    // Both are px fractions, converted into world units here;
    // use-cluster-screen.ts applies the identical shifts on the DOM side, so
    // the hover region, pulse ring and label stay locked to what's drawn.
    //
    // Both divide by the *unscaled* px-per-world-unit on purpose: this sets
    // the group's parent-space position, and scaling a group about its own
    // origin leaves that untouched. Y is negated because world +Y is up while
    // CSS +Y is down; X needs no flip, since this camera has no roll.
    const centerXFraction = clusterCenterXFraction(
      state.size.width,
      state.size.height,
    );
    const centerYFraction = clusterCenterYFraction(
      state.size.width,
      state.size.height,
    );
    const centerOffsetWorldX =
      (state.size.width * (centerXFraction - 0.5)) /
      pxPerWorldUnitFor(state.size.height);
    const centerOffsetWorldY =
      -(state.size.height * (centerYFraction - 0.5)) /
      pxPerWorldUnitFor(state.size.height);

    groupRef.current.position.x = parallax.current.x + centerOffsetWorldX;
    groupRef.current.position.y = parallax.current.y + centerOffsetWorldY;

    // Written when it's moved meaningfully, not every frame — a plain
    // per-frame write, even after the lerp has visually settled, still
    // produces a new object each time (floating-point lerp toward a fixed
    // target never exactly reaches it), which would re-render every
    // subscribed DOM component in nebula-affordance.tsx at 60fps forever,
    // on every non-nebula route, even at rest. Not subscribed to here —
    // this component doesn't need to react to its own write.
    if (
      Math.abs(parallax.current.x - lastWrittenParallax.current.x) >
        PARALLAX_WRITE_EPSILON ||
      Math.abs(parallax.current.y - lastWrittenParallax.current.y) >
        PARALLAX_WRITE_EPSILON
    ) {
      lastWrittenParallax.current.x = parallax.current.x;
      lastWrittenParallax.current.y = parallax.current.y;
      useSceneStore
        .getState()
        .setClusterParallax({ x: parallax.current.x, y: parallax.current.y });
    }

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

/**
 * Elevated, near-top-down heading, tilted slightly off pure vertical.
 * Cluster.order maps monotonically onto Y in layout.ts's Fibonacci sphere,
 * so "front hemisphere" for the low-order SEL clusters means looking down
 * from above, not straight ahead along Z. A pure top-down heading was tried
 * first and rejected: solder and personal sit at opposite Y poles but
 * nearly identical X/Z, so they collided in screen space (~3.6 units apart
 * vs. ~8 achievable elsewhere). This heading was chosen by searching
 * viewing directions for one that keeps all four SEL centroids comfortably
 * front-facing while maximizing the closest pairwise screen-space distance
 * between all seven cluster centroids — verified against the actual
 * computed layout, not eyeballed.
 */
const CONSTELLATION_CAMERA_POSITION: [number, number, number] = [11.9, 42.8, -3.1];
const CONSTELLATION_CAMERA_FOV = 50;

/**
 * Aimed slightly above the origin: the oblique heading projects the nearest
 * (solder) cluster high in the frame, and the sticky header eats the top
 * ~62px, so aiming at y=0 left the constellation riding up under the header
 * and off-center. Raising the target pushes the whole composition down into
 * the usable area.
 */
const CONSTELLATION_CAMERA_TARGET: [number, number, number] = [0, 3.5, 0];

/**
 * Step 2.1: an instant, fixed camera swap between the Phase 1 decorative
 * cluster and the Phase 2 constellation. The canvas never unmounts across
 * routes (see docs/02-architecture.md), so <Canvas>'s camera prop only sets
 * the very first position — this is what actually moves it afterward. No
 * interpolation yet; that's fly-in, step 2.5.
 */
function CameraRig({ isNebula }: { isNebula: boolean }) {
  const { camera } = useThree();

  useEffect(() => {
    const [x, y, z] = isNebula
      ? CONSTELLATION_CAMERA_POSITION
      : HOME_CAMERA_POSITION;
    const [tx, ty, tz] = isNebula ? CONSTELLATION_CAMERA_TARGET : [0, 0, 0];
    camera.position.set(x, y, z);
    camera.lookAt(tx, ty, tz);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = isNebula ? CONSTELLATION_CAMERA_FOV : HOME_CAMERA_FOV;
      camera.updateProjectionMatrix();
    }
  }, [isNebula, camera]);

  return null;
}

// Distance-from-target clamp for the nebula dolly. Min sits just inside the
// project-cluster radius (CLUSTER_RADIUS 14, content/layout.ts) so zooming in
// reads as "flying toward a cluster," not literally passing through node
// geometry; max keeps the whole seven-cluster composition on screen rather
// than shrinking to a speck. Verified visually, not just computed.
const DOLLY_MIN_DISTANCE = 10;
const DOLLY_MAX_DISTANCE = 58;

/**
 * Step 2.4: drag-to-rotate, scroll-to-dolly, clamped. Only mounted for the
 * nebula view — the Phase 1 cluster stays a fixed, parallax-only camera per
 * 01-design-system.md. Only the position/target need setting here; FOV isn't
 * something camera-controls owns, so CameraRig above still handles that.
 */
function NebulaCameraRig() {
  const controlsRef = useRef<CameraControlsImpl>(null);

  useEffect(() => {
    controlsRef.current?.setLookAt(
      ...CONSTELLATION_CAMERA_POSITION,
      ...CONSTELLATION_CAMERA_TARGET,
      false,
    );
  }, []);

  return (
    <CameraControls
      ref={controlsRef}
      minDistance={DOLLY_MIN_DISTANCE}
      maxDistance={DOLLY_MAX_DISTANCE}
      mouseButtons-left={CameraControlsImpl.ACTION.ROTATE}
      mouseButtons-right={CameraControlsImpl.ACTION.NONE}
      mouseButtons-middle={CameraControlsImpl.ACTION.NONE}
      mouseButtons-wheel={CameraControlsImpl.ACTION.DOLLY}
    />
  );
}

export function NebulaCanvas() {
  const pathname = usePathname();
  const isNebula = pathname === "/nebula" || pathname.startsWith("/nebula/");

  return (
    <Canvas
      className="!fixed inset-0 z-0"
      gl={{ alpha: true }}
      dpr={[1, 2]}
      camera={{ position: HOME_CAMERA_POSITION, fov: HOME_CAMERA_FOV }}
    >
      <CameraRig isNebula={isNebula} />
      {isNebula ? (
        <>
          <NebulaCameraRig />
          <Constellation />
        </>
      ) : (
        <Cluster />
      )}
    </Canvas>
  );
}
