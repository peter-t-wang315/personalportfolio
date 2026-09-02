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
import { getLivePosition } from "./nebula-simulation";

/**
 * Step 2.3 — edges. Runtime and dev-time edges get the drei
 * QuadraticBezierLine treatment per 02-architecture.md's Performance budget
 * (fine up to ~40 production edges); shared-tech edges are batched into one
 * THREE.LineSegments per that same section, since there can be 100+.
 *
 * The runtime/dev-time asymmetry — solid + fast pulse vs. dashed + slow
 * pulse vs. static hairline — is the entire point of the design
 * (05-phase-2.md, Edges) and must read with no legend.
 *
 * Step 2.3a: nodes now drift (see ./nebula-simulation.ts), so endpoints are
 * recomputed every frame from live positions rather than once at mount.
 * Dash/gap/pulse-speed sizing stays pinned to the geometry computed from the
 * seeded (non-live) positions, computed once — wander is small enough
 * relative to edge length that re-deriving those every frame would only
 * introduce jitter into the pulse rhythm for no visible benefit.
 */
const RUNTIME_COLOR = palette.ink;
const RUNTIME_OPACITY = 0.4;
const PULSE_COLOR = palette.lamp;
const PULSE_OPACITY = 0.95;
const TECH_COLOR = palette.inkFaint;
const TECH_OPACITY = 0.2;

// Step 2.4 — hover brightens every edge connected to the hovered node. Tech
// hairlines stay one batched draw call for the other ~100+, so their
// highlight is a tiny second overlay covering just the connected few rather
// than a per-vertex shader — see TechEdgeHighlights. Deliberately short of
// RUNTIME_OPACITY/RUNTIME_COLOR's strength even when highlighted: a
// brightened hairline still reads as "shares a technology," never as a
// message path — that asymmetry is the point of the edge model (05-phase-2.md).
const RUNTIME_HIGHLIGHT_OPACITY = 0.85;
const TECH_HIGHLIGHT_COLOR = palette.inkMuted;
const TECH_HIGHLIGHT_OPACITY = 0.6;
// Same instant-snap-under-reduced-motion idiom as the node hover lerp in
// nebula-constellation.tsx.
const HOVER_EASE = 0.2;

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

/**
 * A node's position — live (current, drifting) or the static seeded
 * position from layout.ts. Falls back to the static position if the
 * simulation hasn't produced a live one yet (e.g. the very first frame).
 */
function nodePosition(id: string, live: boolean): THREE.Vector3 | null {
  if (live) {
    const p = getLivePosition(id);
    if (p) return p;
  }
  const g = nodeGeometry[id];
  return g ? new THREE.Vector3(...g.position) : null;
}

/**
 * Curved (runtime / dev-time) edges. The rendered curve is a quadratic
 * Bezier through start/mid/end, so its initial direction at each endpoint
 * points toward `mid`, not toward the other node's center — trimming along
 * the straight a-to-b direction leaves a start point that's technically
 * outside the sphere, but the curve's actual tangent can immediately bend
 * back through it. Trimming along the direction to `mid` instead matches
 * the curve's real tangent, so it leaves the surface cleanly.
 */
function computeCurveGeometry(edge: Edge, live: boolean): EdgeGeometry | null {
  const from = nodeGeometry[edge.from];
  const to = nodeGeometry[edge.to];
  if (!from || !to) return null;

  const a = nodePosition(edge.from, live);
  const b = nodePosition(edge.to, live);
  if (!a || !b) return null;

  const straightMid = a.clone().add(b).multiplyScalar(0.5);
  const outward =
    straightMid.distanceTo(ORIGIN) > 0.001
      ? straightMid.clone().normalize()
      : b.clone().sub(a).normalize();
  const mid = straightMid.addScaledVector(
    outward,
    a.distanceTo(b) * ARC_BULGE,
  );

  const start = a.clone().addScaledVector(
    mid.clone().sub(a).normalize(),
    from.radius * 1.05,
  );
  const end = b.clone().addScaledVector(
    mid.clone().sub(b).normalize(),
    to.radius * 1.05,
  );

  return { start, mid, end, length: start.distanceTo(mid) + mid.distanceTo(end) };
}

/**
 * Straight (shared-tech) edges. The rendered line is literally start-to-end,
 * so trimming along the direct a-to-b direction is exact — no tangent
 * mismatch to account for.
 */
function computeStraightGeometry(
  edge: Edge,
  live: boolean,
): { start: THREE.Vector3; end: THREE.Vector3 } | null {
  const from = nodeGeometry[edge.from];
  const to = nodeGeometry[edge.to];
  if (!from || !to) return null;

  const a = nodePosition(edge.from, live);
  const b = nodePosition(edge.to, live);
  if (!a || !b) return null;
  const dir = b.clone().sub(a).normalize();

  const start = a.clone().addScaledVector(dir, from.radius * 1.05);
  const end = b.clone().addScaledVector(dir, -to.radius * 1.05);

  return { start, end };
}

/** One runtime or dev-time edge: a static base line plus a traveling amber pulse. */
function RuntimeEdgeLine({
  edge,
  devTime,
}: {
  edge: Edge;
  devTime: boolean;
}) {
  const geo = useMemo(() => computeCurveGeometry(edge, false), [edge]);
  const baseRef = useRef<QuadraticBezierLineRef>(null);
  const pulseRef = useRef<QuadraticBezierLineRef>(null);

  const dashSize = geo ? geo.length * PULSE_DASH_FRACTION : 0;
  const gapSize = geo ? geo.length - dashSize : 0;
  const period = devTime ? DEVTIME_PULSE_PERIOD : RUNTIME_PULSE_PERIOD;
  const speed = geo && period > 0 ? geo.length / period : 0;

  useFrame((_state, delta) => {
    const { reducedMotion, hoveredNodeId } = useSceneStore.getState();
    const connected =
      hoveredNodeId !== null &&
      (edge.from === hoveredNodeId || edge.to === hoveredNodeId);

    // Brightening runs regardless of reduced motion — hover still
    // highlights, it just snaps instead of easing (same idiom as the node
    // hover lerp).
    const baseMaterial = baseRef.current?.material;
    if (baseMaterial) {
      baseMaterial.opacity = THREE.MathUtils.lerp(
        baseMaterial.opacity,
        connected ? RUNTIME_HIGHLIGHT_OPACITY : RUNTIME_OPACITY,
        reducedMotion ? 1 : HOVER_EASE,
      );
    }

    if (reducedMotion) return;

    const live = computeCurveGeometry(edge, true);
    if (live) {
      baseRef.current?.setPoints(live.start, live.end, live.mid);
      pulseRef.current?.setPoints(live.start, live.end, live.mid);
    }

    const pulseMaterial = pulseRef.current?.material;
    if (!pulseMaterial || dashSize + gapSize <= 0) return;
    pulseMaterial.dashOffset = THREE.MathUtils.euclideanModulo(
      pulseMaterial.dashOffset - speed * delta,
      dashSize + gapSize,
    );
  });

  if (!geo) return null;

  return (
    <group>
      <QuadraticBezierLine
        ref={baseRef}
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
  const { geometry, positions } = useMemo(() => {
    const positions = new Float32Array(edgeList.length * 6);
    edgeList.forEach((edge, i) => {
      const geo = computeStraightGeometry(edge, false);
      if (!geo) return;
      positions.set([geo.start.x, geo.start.y, geo.start.z], i * 6);
      positions.set([geo.end.x, geo.end.y, geo.end.z], i * 6 + 3);
    });
    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    return { geometry: geom, positions };
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

  useFrame(() => {
    if (useSceneStore.getState().reducedMotion) return;
    edgeList.forEach((edge, i) => {
      const geo = computeStraightGeometry(edge, true);
      if (!geo) return;
      positions.set([geo.start.x, geo.start.y, geo.start.z], i * 6);
      positions.set([geo.end.x, geo.end.y, geo.end.z], i * 6 + 3);
    });
    const attr = geometry.attributes.position as THREE.BufferAttribute;
    attr.needsUpdate = true;
  });

  return <lineSegments geometry={geometry} material={material} />;
}

/**
 * The handful of shared-tech edges touching the currently hovered node,
 * rendered as a tiny second batch on top of TechEdges' static one so hover
 * can brighten just those without a per-vertex-color shader or splitting
 * the main 100+-edge draw call. Rebuilt only when hoveredNodeId changes
 * (a React re-render, not a per-frame cost); positions still track drift
 * every frame while it's non-empty.
 */
function TechEdgeHighlights({ edgeList }: { edgeList: Edge[] }) {
  const hoveredNodeId = useSceneStore((s) => s.hoveredNodeId);
  const connected = useMemo(
    () =>
      hoveredNodeId === null
        ? []
        : edgeList.filter(
            (e) => e.from === hoveredNodeId || e.to === hoveredNodeId,
          ),
    [edgeList, hoveredNodeId],
  );

  const { geometry, positions } = useMemo(() => {
    const positions = new Float32Array(connected.length * 6);
    connected.forEach((edge, i) => {
      const geo = computeStraightGeometry(edge, false);
      if (!geo) return;
      positions.set([geo.start.x, geo.start.y, geo.start.z], i * 6);
      positions.set([geo.end.x, geo.end.y, geo.end.z], i * 6 + 3);
    });
    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    return { geometry: geom, positions };
  }, [connected]);

  const material = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: TECH_HIGHLIGHT_COLOR,
        transparent: true,
        opacity: TECH_HIGHLIGHT_OPACITY,
        fog: true,
      }),
    [],
  );

  useFrame(() => {
    if (connected.length === 0 || useSceneStore.getState().reducedMotion) {
      return;
    }
    connected.forEach((edge, i) => {
      const geo = computeStraightGeometry(edge, true);
      if (!geo) return;
      positions.set([geo.start.x, geo.start.y, geo.start.z], i * 6);
      positions.set([geo.end.x, geo.end.y, geo.end.z], i * 6 + 3);
    });
    (geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  });

  if (connected.length === 0) return null;
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
      {showTech && <TechEdgeHighlights edgeList={techEdges} />}
    </>
  );
}
