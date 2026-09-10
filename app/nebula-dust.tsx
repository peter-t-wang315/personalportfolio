"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { CONSTELLATION_BOUNDING_RADIUS } from "@/lib/node-geometry";
import { LANDING_STANDING_DISTANCE } from "@/lib/world-scale";
import { useDeviceTier } from "@/lib/device-tier";
import { palette } from "@/lib/palette";
import { makeRng } from "@/lib/seeded-random";
import { flightMotion } from "./nebula-home-placement";

/**
 * **Dust between home and the graph, seen only while moving.**
 *
 * "It still feels like we've travelled basically nowhere." With one lens
 * everywhere the graph's growth across the flight is fixed by the two
 * compositions — nothing about the curve or the duration can add distance.
 * What sells travel is things going past, and the only thing that went past
 * was the hero. So: a sparse field of motes in the space the flight crosses,
 * each drawn as a short streak stretched along the direction of travel in
 * proportion to the camera's speed. At rest they have no length and no
 * opacity, so the landing page and the interior are untouched; the moment
 * the camera moves they appear, stream past, and are gone when it stops.
 *
 * Kept out of the shell so nothing drifts among the nodes, and kept off the
 * axis close to the camera so a mote never crosses the middle of the frame as
 * a smear. `06-phase-3.md` warns that dark dots at low opacity on cream read
 * as dirt; these are never seen still, which is the case that warning is
 * about. Desktop only, per the tier budget — it is 2×COUNT vertices updated
 * every frame of a flight.
 */
const COUNT = 420;
/** World units of streak per unit of speed (units per second). */
const STREAK_PER_SPEED = 0.018;
const MAX_STREAK = 3.2;
/** Speed at which the field reaches full opacity. */
const FULL_SPEED = 40;
const MAX_OPACITY = 0.55;
/** Radius of the corridor around the flight axis, and the axis clearance. */
const CORRIDOR = 34;
const AXIS_CLEAR = 3;

function makeField() {
  const rng = makeRng(0x0d05_7e11);
  const near = CONSTELLATION_BOUNDING_RADIUS + 2;
  const far = LANDING_STANDING_DISTANCE + 12;
  const points: THREE.Vector3[] = [];
  while (points.length < COUNT) {
    const z = near + rng() * (far - near);
    const angle = rng() * Math.PI * 2;
    const radius = AXIS_CLEAR + Math.sqrt(rng()) * (CORRIDOR - AXIS_CLEAR);
    const p = new THREE.Vector3(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius * 0.7,
      z,
    );
    if (p.length() < near) continue;
    points.push(p);
  }
  return points;
}

export function NebulaDust() {
  const tier = useDeviceTier();
  const field = useMemo(makeField, []);
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const positions = new Float32Array(COUNT * 2 * 3);
    field.forEach((p, i) => {
      positions.set([p.x, p.y, p.z, p.x, p.y, p.z], i * 6);
    });
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return g;
  }, [field]);
  const materialRef = useRef<THREE.LineBasicMaterial>(null);
  const linesRef = useRef<THREE.LineSegments>(null);

  useFrame(() => {
    const material = materialRef.current;
    const lines = linesRef.current;
    if (!material || !lines) return;
    const speed = flightMotion.speed;
    const opacity =
      MAX_OPACITY * THREE.MathUtils.clamp(speed / FULL_SPEED, 0, 1);
    material.opacity = opacity;
    lines.visible = opacity > 0.01;
    if (!lines.visible) return;
    // Streak along the direction of travel, trailing behind the motion.
    const len = Math.min(speed * STREAK_PER_SPEED, MAX_STREAK);
    const d = flightMotion.direction;
    const attr = geometry.getAttribute("position") as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < COUNT; i++) {
      const p = field[i];
      arr[i * 6 + 3] = p.x - d.x * len;
      arr[i * 6 + 4] = p.y - d.y * len;
      arr[i * 6 + 5] = p.z - d.z * len;
    }
    attr.needsUpdate = true;
  });

  if (tier !== "desktop") return null;

  return (
    <lineSegments ref={linesRef} geometry={geometry} visible={false} frustumCulled={false}>
      <lineBasicMaterial
        ref={materialRef}
        color={palette.inkFaint}
        transparent
        opacity={0}
        depthWrite={false}
        toneMapped={false}
      />
    </lineSegments>
  );
}
