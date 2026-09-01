"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import {
  QuadraticBezierLine,
  type QuadraticBezierLineRef,
} from "@react-three/drei";
import { edges, type Edge } from "@/content";
import { palette } from "@/lib/palette";
import { nodeGeometry } from "@/lib/node-geometry";
import { useSceneStore } from "@/lib/scene-store";

/**
 * Step 2.3 — edges. Runtime and dev-time edges get the drei
 * QuadraticBezierLine treatment per 02-architecture.md's Performance budget
 * (fine up to ~40 production edges); shared-tech edges are batched into one
 * THREE.LineSegments per that same section, since there can be 100+.
 *
 * The runtime/dev-time asymmetry — solid + fast pulse vs. dashed + slow
 * pulse vs. static hairline — is the entire point of the design
 * (05-phase-2.md, Edges) and must read with no legend.
 */
const RUNTIME_COLOR = palette.ink;
const RUNTIME_OPACITY = 0.4;
const PULSE_COLOR = palette.lamp;
const PULSE_OPACITY = 0.95;
const TECH_COLOR = palette.inkFaint;
const TECH_OPACITY = 0.2;

const RUNTIME_PULSE_PERIOD = 4; // seconds for one full traversal
const DEVTIME_PULSE_PERIOD = 7; // "a slower pulse" — 05-phase-2.md, Edges

// Fraction of an edge's own length occupied by the traveling pulse dash.
const PULSE_DASH_FRACTION = 0.06;
// Dev-time base line: small fixed dash pattern (world units), independent
// of edge length, so it reads as "dashed" rather than "one long dash."
const DEVTIME_DASH_SIZE = 0.22;
const DEVTIME_GAP_SIZE = 0.16;

// How far the control point bulges outward from the constellation center,
// as a fraction of the edge's straight-line length. Keeps arcs from
// stacking directly on top of each other near the center.
const ARC_BULGE = 0.18;

const ORIGIN = new THREE.Vector3(0, 0, 0);

interface EdgeGeometry {
  start: THREE.Vector3;
  mid: THREE.Vector3;
  end: THREE.Vector3;
  /** Straight-segment approximation, close enough to size the pulse dash. */
  length: number;
}

function computeEdgeGeometry(edge: Edge): EdgeGeometry | null {
  const from = nodeGeometry[edge.from];
  const to = nodeGeometry[edge.to];
  if (!from || !to) return null;

  const a = new THREE.Vector3(...from.position);
  const b = new THREE.Vector3(...to.position);
  const dir = b.clone().sub(a).normalize();

  // Trim endpoints to just outside each node's surface so lines don't cut
  // through the shell — or the solid SEL core inside it.
  const start = a.clone().addScaledVector(dir, from.radius * 1.05);
  const end = b.clone().addScaledVector(dir, -to.radius * 1.05);

  const straightMid = a.clone().add(b).multiplyScalar(0.5);
  const outward =
    straightMid.distanceTo(ORIGIN) > 0.001
      ? straightMid.clone().normalize()
      : dir;
  const mid = straightMid.addScaledVector(
    outward,
    a.distanceTo(b) * ARC_BULGE,
  );

  return { start, mid, end, length: start.distanceTo(mid) + mid.distanceTo(end) };
}

/** One runtime or dev-time edge: a static base line plus a traveling amber pulse. */
function RuntimeEdgeLine({
  edge,
  devTime,
}: {
  edge: Edge;
  devTime: boolean;
}) {
  const geo = useMemo(() => computeEdgeGeometry(edge), [edge]);
  const pulseRef = useRef<QuadraticBezierLineRef>(null);

  const dashSize = geo ? geo.length * PULSE_DASH_FRACTION : 0;
  const gapSize = geo ? geo.length - dashSize : 0;
  const period = devTime ? DEVTIME_PULSE_PERIOD : RUNTIME_PULSE_PERIOD;
  const speed = geo && period > 0 ? geo.length / period : 0;

  useFrame((_state, delta) => {
    if (useSceneStore.getState().reducedMotion) return;
    const material = pulseRef.current?.material;
    if (!material || dashSize + gapSize <= 0) return;
    material.dashOffset = THREE.MathUtils.euclideanModulo(
      material.dashOffset - speed * delta,
      dashSize + gapSize,
    );
  });

  if (!geo) return null;

  return (
    <group>
      <QuadraticBezierLine
        start={geo.start}
        mid={geo.mid}
        end={geo.end}
        color={RUNTIME_COLOR}
        lineWidth={1.4}
        transparent
        opacity={RUNTIME_OPACITY}
        fog
        dashed={devTime}
        dashSize={devTime ? DEVTIME_DASH_SIZE : 0}
        gapSize={devTime ? DEVTIME_GAP_SIZE : 0}
      />
      <QuadraticBezierLine
        ref={pulseRef}
        start={geo.start}
        mid={geo.mid}
        end={geo.end}
        color={PULSE_COLOR}
        lineWidth={2}
        transparent
        opacity={PULSE_OPACITY}
        fog
        dashed
        dashSize={dashSize}
        gapSize={gapSize}
      />
    </group>
  );
}

/** All shared-tech edges batched into a single LineSegments draw call. */
function TechEdges({ edgeList }: { edgeList: Edge[] }) {
  const geometry = useMemo(() => {
    const positions: number[] = [];
    for (const edge of edgeList) {
      const geo = computeEdgeGeometry(edge);
      if (!geo) continue;
      positions.push(geo.start.x, geo.start.y, geo.start.z);
      positions.push(geo.end.x, geo.end.y, geo.end.z);
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    return geom;
  }, [edgeList]);

  const material = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: TECH_COLOR,
        transparent: true,
        opacity: TECH_OPACITY,
        fog: true,
      }),
    [],
  );

  return <lineSegments geometry={geometry} material={material} />;
}

export function Edges({ showTech }: { showTech: boolean }) {
  const runtimeEdges = useMemo(
    () => edges.filter((e) => e.kind === "runtime"),
    [],
  );
  const devTimeEdges = useMemo(
    () => edges.filter((e) => e.kind === "dev-time"),
    [],
  );
  const techEdges = useMemo(
    () => edges.filter((e) => e.kind === "shared-tech"),
    [],
  );

  return (
    <>
      {runtimeEdges.map((edge) => (
        <RuntimeEdgeLine key={edge.id} edge={edge} devTime={false} />
      ))}
      {devTimeEdges.map((edge) => (
        <RuntimeEdgeLine key={edge.id} edge={edge} devTime />
      ))}
      {showTech && <TechEdges edgeList={techEdges} />}
    </>
  );
}
