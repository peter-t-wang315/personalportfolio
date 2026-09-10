"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { palette } from "@/lib/palette";
import { jumpWash } from "./nebula-jump";

/**
 * A sheet of paper held in front of the lens for the middle of a jump.
 *
 * Drawn in the scene rather than as a DOM overlay so it covers exactly the
 * canvas — the graph's chrome and the dissolving page are DOM and stay
 * above it. A quad parked just past the near plane, facing the camera,
 * scaled to fill the frame at whatever the lens is doing, with its opacity
 * written by the rig each frame (nebula-jump.ts). Draws nothing at all when
 * that is zero, which is every frame the reader is not mid-jump.
 */
export function NebulaWash() {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const camera = useThree((s) => s.camera);
  const geometry = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const forward = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const mesh = meshRef.current;
    const material = materialRef.current;
    if (!mesh || !material) return;
    const opacity = jumpWash.opacity;
    material.opacity = opacity;
    mesh.visible = opacity > 0.002;
    if (!mesh.visible) return;
    const cam = camera as THREE.PerspectiveCamera;
    const distance = cam.near * 4;
    forward.set(0, 0, -1).applyQuaternion(cam.quaternion);
    mesh.position.copy(cam.position).addScaledVector(forward, distance);
    mesh.quaternion.copy(cam.quaternion);
    const h = 2 * distance * Math.tan((cam.fov * Math.PI) / 360) * 1.1;
    mesh.scale.set(h * cam.aspect, h, 1);
  });

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      visible={false}
      renderOrder={1000}
      frustumCulled={false}
      raycast={() => null}
    >
      <meshBasicMaterial
        ref={materialRef}
        color={palette.paper}
        transparent
        opacity={0}
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}
