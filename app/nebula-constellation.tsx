"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { cubicBezier } from "motion/react";
import { makeRng } from "@/lib/seeded-random";
import { palette } from "@/lib/palette";
import { useDeviceTier, type DeviceTier } from "@/lib/device-tier";
import {
  DESKTOP_MIN_WIDTH_PX,
  SHORT_VIEWPORT_HEIGHT_PX,
} from "@/lib/cluster-geometry";
import { useSceneStore } from "@/lib/scene-store";
import {
  focusScroll,
  SCROLL_FADE_MS,
  SCROLL_HOLD_MS,
} from "@/lib/focus-scroll";
import { nodeList, nodeGeometry, type NodeGeometry } from "@/lib/node-geometry";
import { projectById, techById } from "@/content";
import { createFresnelMaterial } from "./fresnel-material";
import { Edges } from "./nebula-edges";
import {
  stepSimulation,
  getLivePosition,
  attractNeighbors,
  releaseAttraction,
  freezeSimulation,
  resumeSimulation,
  neighborsOf,
} from "./nebula-simulation";

/**
 * Step 2.2 — materials. Node typing (translucent --mask core on
 * professional-cluster project nodes, personal-cluster and tech nodes fully
 * hollow — a category, not an ownership signal), low-frequency vertex
 * displacement so silhouettes breathe, and the device-tier switch threaded
 * through material selection.
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

// Professional-cluster cores: a large, translucent --mask sphere inside the
// shell (not a small solid one — see coreMaterial below), sized relative to
// the shell so it survives the radius difference between major and
// standard. Personal-cluster nodes get no core mesh at all; category (not
// an ownership signal) is computed in lib/node-geometry.ts.
// Step 2.5 — focus. Everything that isn't the focused node or one of its
// neighbours drops to this fraction of its own base opacity, per 05a. A
// fraction rather than a flat value so the tech layer stays recessed relative
// to projects instead of every node collapsing onto one grey.
const UNRELATED_OPACITY_FACTOR = 0.25;

/**
 * Off `/`, the constellation is ambient rather than the subject and dims to
 * ~35% — but as a *factor* on each node's own base opacity, not a flat value,
 * so the tech layer stays recessed relative to projects instead of every node
 * collapsing onto one grey. 0.35/PROJECT_OPACITY reproduces exactly the 0.35
 * the decorative cluster faded to, which is what 04-phase-1.md specifies.
 *
 * Below the desktop tier it stands down entirely instead. Ambient only works
 * if there is somewhere to be ambient *in*, and at those widths the content
 * column is nearly the whole viewport, so it would sit squarely behind body
 * prose: measured 55% of the disc under text on /about at 768x1024, 59% on
 * /work at 360x640, with the nodes plainly legible through the paragraphs. No
 * opacity that is still visible survives that, because the problem is texture
 * behind reading text rather than how strong the texture is. Desktop is
 * unaffected and was measured clean (0-4%) — the column is narrow relative to
 * the viewport, which is the whole premise. `/` always keeps its graph: there
 * it is the affordance, not decoration.
 */
const AMBIENT_OPACITY_FACTOR = 0.35 / PROJECT_OPACITY;
/**
 * `/work/[slug]` sits between ambient and subject. The graph there is not
 * decoration the way it is on `/about` — it is showing the reader where the
 * project they are reading about sits, and the turn that brings its cluster
 * forward has to be visible for that to mean anything. So it is lifted above
 * the ambient value, while staying well below the landing page's, since prose
 * is still the thing being read.
 */
const SPOTLIGHT_OPACITY_FACTOR = 0.55 / PROJECT_OPACITY;
/** Route-change easing for the ambient fade. */
const AMBIENT_EASE = 0.06;

const CORE_SCALE = 0.8;
const CORE_OPACITY = 0.22;

// Step 2.4 — hover. Scale and opacity lerp toward these on hover, back to
// their per-node/per-tier base otherwise. Under reduced motion the lerp
// factor becomes 1 (an instant snap rather than an eased transition) — the
// same idiom the Phase 1 cluster already uses — so hover still highlights
// and scales, it just doesn't animate into place.
const HOVER_SCALE_FACTOR = 1.15;
const HOVER_OPACITY = 1;
const HOVER_EASE = 0.2;

/**
 * Fog band, re-measured against actual per-node camera-space depth (not
 * guessed) after the shell shrank to 11: from the outside framing the nodes
 * span depth 20.1–42.5, so far sits just past the true maximum and the
 * farthest cluster reaches ~90% fade — visibly receded, not erased.
 *
 * Near is set by the *landing page* rather than by that framing. The landing
 * cluster sits 19.6–26.4 from the home camera, and anything below 27 would
 * start fogging its far edge, which has never had fog and is composed without
 * it. So near clears that, and the outside framing gets its gradient over
 * 27–42.5 instead of the whole range.
 *
 * Inside the globe fog does nothing at all, and shouldn't: from the inside
 * pose every visible node lies between 13 and 17 units away — a depth ratio of
 * 1.26 — so there is no recession for it to describe.
 */
const FOG_NEAR = 27;
const FOG_FAR = 48;

/** One shared clock uniform drives every breathing material. */
const breatheTime = { value: 0 };

// 48 segments rather than 32. A sphere only ever needs enough to look round,
// but the same vertices have to describe a superellipsoid when a node opens,
// and its corners curve far more tightly than anything on a sphere does —
// at 32 they creased visibly. 45 nodes at this density is still trivial.
const sphereGeometry = new THREE.SphereGeometry(1, 48, 48);
const coreMaterial = new THREE.MeshBasicMaterial({
  color: palette.mask,
  transparent: true,
  opacity: CORE_OPACITY,
  depthWrite: false,
});

// Every node gets its own material instance — tech nodes don't breathe
// (displacement is a project-node trait — 05-phase-2.md, Nodes — and the
// stillness helps the hierarchy read) and share one opacity formula, but
// each needs an independently mutable opacity uniform so hover (2.4) can
// raise one node's without affecting the rest of the tech population.
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
        : createFresnelMaterial({ opacity: TECH_OPACITY });
  }
  return map;
})();

/** A node's opacity absent hover: fixed for project nodes, tier-dimmed for tech. */
function baseOpacity(node: NodeGeometry, tier: DeviceTier): number {
  if (node.kind === "project") return PROJECT_OPACITY;
  return TECH_OPACITY * (tier === "tablet" ? TABLET_TECH_FACTOR : 1);
}

/**
 * **Opening a node reshapes the node.** 05-phase-2.md asks for the shell to
 * expand and morph toward a rounded rectangle, and the first build did it with
 * a second mesh: the node faded out, a separate shell faded in and morphed,
 * then that faded out too and left a DOM card. Three objects in sequence, so
 * of course it read as a new one arriving — by the time there was anything to
 * read, the node itself was gone.
 *
 * There is one object now. The node's own mesh turns to face the camera,
 * scales to the interior panel's rectangle, and reshapes from sphere toward
 * rounded box through its own material's `uOpen` uniform
 * (app/fresnel-material.ts). Same mesh, same material, same `--mask` colour it
 * had as a sphere; the panel's text simply appears across it. Nothing is
 * swapped, so there is nothing for the eye to notice being swapped.
 *
 * Panel size is the tier table's (02-architecture.md): 70% of the viewport on
 * desktop, 85% below, taken as a fraction of the frustum at the node's own
 * depth — the same numbers nebula-panel.tsx uses in CSS, so the mesh and the
 * DOM agree without either measuring the other. Under 500px of viewport height
 * there is no morph at all: the panel is a full-height sheet and the node stays
 * a sphere (Orientation and short viewports).
 */
const OPEN_MS = 240;
const easeStandard = cubicBezier(0.32, 0.72, 0, 1);
const PANEL_FRACTION_DESKTOP = 0.7;
const PANEL_FRACTION_COMPACT = 0.85;
/** Depth of the opened node relative to its own radius — flattened, not gone,
 * so the rim still turns away from the viewer and catches the fresnel term. */
const OPEN_DEPTH_FACTOR = 0.35;

/**
 * How far the focused node has opened, 0 to 1, and which node it is.
 *
 * Module scope because the frame loop that drives it and the render that reads
 * it are the same component, and because nothing outside this file needs it —
 * the DOM panel stays in step by running the same duration and curve rather
 * than by being told a number sixty times a second.
 */
const focusOpen = { value: 0, nodeId: null as string | null, snap: false };

/**
 * Tells the shell to be open already rather than opening. Called by the camera
 * rig when it settles a cold entry, which is the one arrival with nothing to
 * animate from — the panel is server-rendered at full opacity and the camera
 * never flies, so a shell ramping out of a sphere behind it is the only thing
 * still moving, and it reads as the page assembling itself late.
 */
export function snapFocusShellOpen() {
  focusOpen.snap = true;
}

/**
 * Hovering a node sets the single global hoveredNodeId and attracts its
 * neighbours (2.3a's mechanic, wired up here); leaving it clears both — but
 * only if this node is still the one the store thinks is hovered, guarding
 * against a stale pointerout firing after the pointer has already moved on
 * to another node (standard pointer-event ordering fires the old node's
 * "out" before the new node's "over", but this makes the handler correct
 * either way rather than depending on that ordering).
 */
function handlePointerOver(e: ThreeEvent<PointerEvent>, nodeId: string) {
  e.stopPropagation();
  useSceneStore.getState().setHoveredNodeId(nodeId);
  attractNeighbors(nodeId);
}

function handlePointerOut(e: ThreeEvent<PointerEvent>, nodeId: string) {
  e.stopPropagation();
  if (useSceneStore.getState().hoveredNodeId === nodeId) {
    useSceneStore.getState().setHoveredNodeId(null);
    releaseAttraction();
  }
}

/**
 * A node's hover-title. 05-phase-2.md's hover spec also lists oneLine
 * alongside title, written with a floating card in mind — read inside the
 * node itself instead (see HoverLabel below), a small sphere has no room
 * for two lines at a legible size, so only the title shows; the fuller
 * description is what the 2.6 interior panel is for.
 */
function hoverLabelTitle(nodeId: string): string | null {
  return projectById(nodeId)?.title ?? techById(nodeId)?.label ?? null;
}

// The title sits slightly below the sphere's own centre rather than dead
// on it — a small aesthetic offset, not a dodge: the professional-cluster
// core is translucent (CORE_OPACITY 0.22) and large enough (CORE_SCALE 0.8)
// that plain ink-coloured text reads fine sitting directly on top of it,
// unlike the small solid core this replaced, which needed a text-shadow
// halo to stay legible — confirmed by testing with the halo removed once
// the core became translucent, and it's no longer needed.
const LABEL_Y_OFFSET_FACTOR = -0.5;
// Scales the label with the node's own (hover-grown) radius and camera
// distance via Html's distanceFactor, the same "content sized as if it
// lived in 3D space" technique 2.6's interior panel will need for content
// that has to grow along with an expanding shell — simpler and smaller
// here, but the same idea: read the node from inside, not a UI overlay
// bolted on top of it.
const LABEL_DISTANCE_FACTOR = 26;

// A critically-underdamped pop, not a fade: quick to arrive, a small
// overshoot past full size before settling, matching the same
// spring-driven character as the drift/attraction work rather than a flat
// instant toggle or a slow linear fade. ζ ≈ 0.46 → ~20% overshoot,
// settling within ~2/3s — snappy enough to read as "alive," not bouncy
// enough to look silly on a small line of text.
const LABEL_STIFFNESS = 170;
const LABEL_DAMPING = 12;
const LABEL_SUBSTEP_SECONDS = 1 / 60;

/**
 * The hover title from 05-phase-2.md's hover spec — the one piece of 2.4's
 * hover behaviour that was still missing (scale/opacity/edge
 * brightening/attraction shipped earlier). A single instance, not one per
 * node, mounted only while some node is hovered or still popping out from
 * having just been released.
 *
 * Deliberately not nested inside the hovered node's own mesh: that would
 * inherit the mesh's hover-grow scale directly, which is the right amount
 * for a sphere but not for text sized independently via distanceFactor. A
 * standalone group with its own live-copied position tracks the same
 * getLivePosition every other moving piece reads — ambient wander and
 * attraction both — without inheriting anything else from the mesh.
 */
function HoverLabel() {
  const hoveredNodeId = useSceneStore((s) => s.hoveredNodeId);
  const [mountedNodeId, setMountedNodeId] = useState<string | null>(null);
  const activeNodeIdRef = useRef<string | null>(null);
  const groupRef = useRef<THREE.Group>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const spring = useRef({ value: 0, velocity: 0 });

  useFrame((_state, delta) => {
    // A direct hand-off from one node to another (no gap in between)
    // resets the spring instead of letting the label jump while staying
    // fully visible — every hover change gets the same pop, consistently.
    if (hoveredNodeId && hoveredNodeId !== activeNodeIdRef.current) {
      activeNodeIdRef.current = hoveredNodeId;
      spring.current.value = 0;
      spring.current.velocity = 0;
      setMountedNodeId(hoveredNodeId);
    }

    const targetId = activeNodeIdRef.current;
    if (!targetId) return;

    const { reducedMotion } = useSceneStore.getState();
    const restValue = hoveredNodeId ? 1 : 0;
    if (reducedMotion) {
      spring.current.value = restValue;
      spring.current.velocity = 0;
    } else {
      const steps = Math.max(1, Math.ceil(delta / LABEL_SUBSTEP_SECONDS));
      const stepDt = delta / steps;
      for (let s = 0; s < steps; s++) {
        const force =
          -LABEL_STIFFNESS * (spring.current.value - restValue) -
          LABEL_DAMPING * spring.current.velocity;
        spring.current.velocity += force * stepDt;
        spring.current.value += spring.current.velocity * stepDt;
      }
    }

    if (groupRef.current) {
      const live = getLivePosition(targetId);
      if (live) groupRef.current.position.copy(live);
    }
    if (textRef.current) {
      const opacity = THREE.MathUtils.clamp(spring.current.value, 0, 1);
      textRef.current.style.opacity = String(opacity);
      textRef.current.style.transform = `scale(${Math.max(spring.current.value, 0)})`;
    }

    if (
      !hoveredNodeId &&
      Math.abs(spring.current.value) < 0.01 &&
      Math.abs(spring.current.velocity) < 0.01
    ) {
      activeNodeIdRef.current = null;
      setMountedNodeId(null);
    }
  });

  if (!mountedNodeId) return null;
  const node = nodeGeometry[mountedNodeId];
  const title = hoverLabelTitle(mountedNodeId);
  if (!node || !title) return null;

  return (
    <group ref={groupRef} position={node.position}>
      <Html
        center
        position={[0, node.radius * LABEL_Y_OFFSET_FACTOR, 0]}
        distanceFactor={node.radius * HOVER_SCALE_FACTOR * LABEL_DISTANCE_FACTOR}
        style={{ pointerEvents: "none" }}
      >
        <div
          ref={textRef}
          className="w-[130px] text-center text-[0.8125rem] font-medium leading-tight text-ink"
          style={{ opacity: 0, transform: "scale(0)" }}
        >
          {title}
        </div>
      </Html>
    </group>
  );
}

/**
 * The constellation, on every route.
 *
 * `isNebula` and `isHome` are the route, not a scene mode: the same graph is
 * the landing page's distant cluster, the ambient texture behind `/about`, and
 * the thing you fly into. What changes between them is what it costs and what
 * it responds to — off `/nebula` it draws no edges, raycasts nothing, and
 * fades toward ambient — not which nodes exist. nebula-canvas.tsx's
 * ConstellationPlacement owns where it sits and how big it is.
 */
export function Constellation({
  isNebula,
  isHome,
  spotlightNodeId,
  onOpenNode,
}: {
  isNebula: boolean;
  isHome: boolean;
  /**
   * On `/work/[slug]`, the project the page is about. Its connected subgraph
   * stays lit while everything else recedes, and the placement turns the globe
   * so it faces the reader. Distinct from `focusedNodeId`: nothing is opened,
   * no camera flies, and the panel is not involved — the graph is here to say
   * where this project sits, beside prose that is doing the explaining.
   */
  spotlightNodeId: string | null;
  /** Pushes the node's route. Focus follows from the route, never from here. */
  onOpenNode: (id: string) => void;
}) {
  const tier = useDeviceTier();
  const meshRefs = useRef<Record<string, THREE.Mesh | null>>({});
  const groupRef = useRef<THREE.Group>(null);
  const ambient = useRef(isHome || isNebula ? 1 : 0);
  const focusedNodeId = useSceneStore((s) => s.focusedNodeId);
  const flying = useSceneStore((s) => s.flying);

  /**
   * Hover and click are withheld off `/nebula` and for the duration of every
   * flight. Off the route because the landing page's way in is the affordance's
   * window-level handler over the whole cluster (nebula-affordance.tsx), and a
   * node that swallowed the pointer first would take the click from it; during
   * a flight because a raycast against a scene whose placement is still
   * interpolating resolves to whatever node happens to be under the cursor at
   * that instant, which is not the one the viewer aimed at.
   *
   * Omitting the handlers rather than ignoring them inside is the point: R3F
   * only raycasts objects that have them, so this is also what keeps 45 meshes
   * off the pointer path on every non-nebula route.
   */
  const interactive = isNebula && !flying;

  // Who stays lit: the focused node and whatever it actually talks to.
  const related = useMemo(() => {
    const subject = focusedNodeId ?? spotlightNodeId;
    if (!subject) return null;
    return new Set([subject, ...neighborsOf(subject)]);
  }, [focusedNodeId, spotlightNodeId]);

  /**
   * The simulation holds still while focused, per 2.3a's freeze hook and 05a's
   * done-when. Two reasons it has to: the camera is parked a couple of units
   * off a specific node's surface, and a node that drifts out from under it
   * ruins the framing; and the neighbours are dimmed by identity, which only
   * reads as a stable statement if they stop moving too.
   *
   * It holds still for any flight as well, which is what 05-phase-2.md
   * actually asks for — "during any programmatic camera movement", not just
   * focus. Reading the rig's own `flying` rather than re-deriving it from a
   * duration keeps this one effect the single writer, so there is no ordering
   * question between the freeze and the flight that caused it.
   */
  useEffect(() => {
    // A spotlit work page freezes too. 05-phase-2.md asks for that page to
    // settle once and then stop completely — "no ongoing motion or GPU cost
    // beside the body text" — and drifting nodes behind prose is exactly the
    // texture-behind-reading-text problem the ambient rules exist to avoid.
    if (focusedNodeId || flying || spotlightNodeId) freezeSimulation();
    else resumeSimulation();
  }, [focusedNodeId, flying, spotlightNodeId]);

  // Tech node visibility is tier-dependent — see 02-architecture.md's
  // Responsive tiers. The mobile/tablet toggle arrives in 2.8; this is the
  // default it will toggle from. Tech opacity's tier-dimming is folded into
  // the per-frame hover loop below (baseOpacity reads `tier` directly), so
  // it doesn't need its own effect.
  // Off /nebula this is a texture rather than a graph, and the tier rule is
  // about keeping the graph legible on a small screen — so the whole
  // population is drawn there. A phone's landing cluster would otherwise be
  // 20 nodes where every other device sees 45, which reads as sparse rather
  // than as restrained.
  const showTech = !isNebula || tier !== "mobile";

  useFrame((state, delta) => {
    const { reducedMotion, hoveredNodeId, focusedNodeId: focused } =
      useSceneStore.getState();

    // The opening, driven here because the thing that opens is one of the
    // nodes this loop already walks.
    const settled = useSceneStore.getState().focusSettled;
    const openTarget = isNebula && focused && settled ? focused : null;
    if (focusOpen.snap) {
      focusOpen.snap = false;
      if (openTarget) focusOpen.value = 1;
    }
    const openStep = reducedMotion ? 1 : (delta * 1000) / OPEN_MS;
    focusOpen.value = THREE.MathUtils.clamp(
      focusOpen.value + (openTarget ? openStep : -openStep),
      0,
      1,
    );
    if (openTarget) focusOpen.nodeId = openTarget;
    else if (focusOpen.value <= 0) focusOpen.nodeId = null;
    const openEased = easeStandard(focusOpen.value);
    // No morph under 500px of viewport height: there the panel is a
    // full-height sheet and there is nothing for a rounded rectangle to be.
    const canOpen = state.size.height >= SHORT_VIEWPORT_HEIGHT_PX;
    const panelFraction =
      state.size.width >= DESKTOP_MIN_WIDTH_PX
        ? PANEL_FRACTION_DESKTOP
        : PANEL_FRACTION_COMPACT;
    // Reduced motion: an instant snap to target instead of an eased lerp —
    // hover still highlights and scales, it just doesn't animate into place
    // (same idiom the Phase 1 cluster uses for its own opacity/scale lerp).
    const ease = reducedMotion ? 1 : HOVER_EASE;

    // Ambient dimming off `/` (see AMBIENT_OPACITY_FACTOR), eased across route
    // changes rather than switched. Applied as a multiplier on whatever each
    // node's opacity would otherwise be, below, so hover and focus keep their
    // relationships intact underneath it.
    ambient.current = THREE.MathUtils.lerp(
      ambient.current,
      isNebula || isHome
        ? 1
        : state.size.width < DESKTOP_MIN_WIDTH_PX
          ? 0
          : spotlightNodeId
            ? SPOTLIGHT_OPACITY_FACTOR
            : AMBIENT_OPACITY_FACTOR,
      reducedMotion ? 1 : AMBIENT_EASE,
    );
    // Once faded out, stop drawing it: 45 transparent spheres a phone can't
    // see are 45 draw calls it doesn't need. A threshold rather than equality
    // because the fade is eased, so it fades and then goes quiet.
    if (groupRef.current) {
      groupRef.current.visible = ambient.current > 0.01;
    }

    // Stop advancing the clock and the breathing displacement freezes in
    // place. Skipping stepSimulation the same way leaves every node at its
    // seeded layout position, since livePositions starts there and nothing
    // ever moves it — attractNeighbors/releaseAttraction (below) still get
    // called on hover, but with stepSimulation never running, that state
    // never gets read, so it can't reintroduce drift.
    if (!reducedMotion) {
      breatheTime.value = state.clock.elapsedTime;
      stepSimulation(state.clock.elapsedTime, delta);
    }

    for (const node of nodeList) {
      const mesh = meshRefs.current[node.id];
      if (!mesh) continue;

      if (!reducedMotion) {
        const live = getLivePosition(node.id);
        if (live) mesh.position.copy(live);
      }

      const hovered = hoveredNodeId === node.id;
      // While focused, hover scaling stands down: the camera is inches from
      // one node and a neighbour swelling under a stray pointer reads as the
      // scene twitching, not as a preview.
      const targetScale =
        node.radius * (hovered && !focused ? HOVER_SCALE_FACTOR : 1);

      const material = materialByNodeId[node.id];
      const open = node.id === focusOpen.nodeId && canOpen ? openEased : 0;
      material.uniforms.uOpen.value = open;
      // The opened node draws the panel's scroll thumb on its own rim, so the
      // indicator is part of the wall rather than laid over it — see
      // lib/focus-scroll.ts. Held while scrolling, then faded.
      if (open > 0) {
        const since = performance.now() - focusScroll.lastMoveAt;
        material.uniforms.uScrollPos.value = focusScroll.position;
        material.uniforms.uScrollLen.value = focusScroll.length;
        material.uniforms.uScrollFade.value =
          focusScroll.length > 0
            ? THREE.MathUtils.clamp(
                1 - (since - SCROLL_HOLD_MS) / SCROLL_FADE_MS,
                0,
                1,
              )
            : 0;
      } else if (material.uniforms.uScrollFade.value !== 0) {
        material.uniforms.uScrollFade.value = 0;
      }
      if (open > 0) {
        // Face the camera, so "flattened along Z" means flattened toward the
        // viewer, and scale to the panel's rectangle at this node's depth.
        mesh.quaternion.copy(state.camera.quaternion);
        const distance = state.camera.position.distanceTo(mesh.position);
        const halfHeight =
          distance *
          Math.tan(
            ((state.camera as THREE.PerspectiveCamera).fov * Math.PI) / 360,
          );
        const halfWidth = halfHeight * (state.size.width / state.size.height);
        mesh.scale.set(
          THREE.MathUtils.lerp(targetScale, halfWidth * panelFraction, open),
          THREE.MathUtils.lerp(targetScale, halfHeight * panelFraction, open),
          THREE.MathUtils.lerp(
            targetScale,
            node.radius * OPEN_DEPTH_FACTOR,
            open,
          ),
        );
      } else {
        mesh.quaternion.identity();
        mesh.scale.setScalar(
          THREE.MathUtils.lerp(mesh.scale.x, targetScale, ease),
        );
      }

      const unrelated = related !== null && !related.has(node.id);
      // The professional core goes as the node opens: a --mask sphere
      // floating behind the text is exactly the "solid object" it was designed
      // not to read as.
      const core = mesh.children[0];
      if (core) core.visible = open < 0.01;
      const targetOpacity =
        ambient.current *
        (unrelated
          ? baseOpacity(node, tier) * UNRELATED_OPACITY_FACTOR
          : hovered && !focused
            ? HOVER_OPACITY
            : baseOpacity(node, tier));
      material.uniforms.opacity.value = THREE.MathUtils.lerp(
        material.uniforms.opacity.value,
        targetOpacity,
        ease,
      );
    }
  });

  return (
    <group ref={groupRef}>
      {/* Edges are the graph's information layer, and 04-phase-1.md is
          explicit that the landing cluster has none. A spotlit work page is
          the exception: there they are the answer to "what does this project
          talk to", so its own subgraph is drawn and nothing else. Unmounting rather than
          hiding them also keeps their line geometry and pulse loop off every
          non-nebula route, which is where the LCP budget is.
          They outlast the route by one flight on the way out: dropping them on
          the commit put a visible pop at the head of the departure, with the
          graph still life-size. Kept until it lands, they go while it is a
          cluster of hairlines too small to see them leave. */}
      {(isNebula || flying || spotlightNodeId) && (
        <Edges
          showTech={showTech}
          // On a work page, only what this project connects to.
          subgraphOf={!isNebula && !flying ? spotlightNodeId : null}
        />
      )}
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
              material={materialByNodeId[node.id]}
              onPointerOver={
                interactive ? (e) => handlePointerOver(e, node.id) : undefined
              }
              onPointerOut={
                interactive ? (e) => handlePointerOut(e, node.id) : undefined
              }
              onClick={
                interactive
                  ? (e) => {
                      e.stopPropagation();
                      onOpenNode(node.id);
                    }
                  : undefined
              }
            >
              {node.category === "professional" && (
                <mesh
                  scale={CORE_SCALE}
                  geometry={sphereGeometry}
                  material={coreMaterial}
                />
              )}
            </mesh>
          );
        })}
      {interactive && <HoverLabel />}
    </group>
  );
}

/**
 * Scene-level environment, rendered outside the placement group that scales
 * the constellation down for the landing page (nebula-canvas.tsx).
 *
 * It has to be outside it for two unrelated reasons. `attach="fog"` writes to
 * its parent's `fog` property, and a group has no such property that anything
 * reads — inside the group the fog silently stops existing. And a light's
 * position is in its parent's space, so inside the group both lights would be
 * scaled and translated along with the flight.
 *
 * Fog is also why the landing page looks unchanged by all of this: at the
 * landing placement the whole graph sits 19.6-26.4 units from the camera,
 * entirely in front of FOG_NEAR, so no fog applies. It engages over the course
 * of the arrival as the constellation grows into its real depth.
 */
export function SceneEnvironment() {
  return (
    <>
      <fog attach="fog" args={[palette.paper, FOG_NEAR, FOG_FAR]} />
      {/*
        The only lit material in the scene is the focused node's transmissive
        shell — every other shell is a custom ShaderMaterial that computes its
        own rim and ignores lights entirely. So this is two lights for one mesh,
        and they cost nothing anywhere else: without them a MeshPhysicalMaterial
        has no specular to catch and reads as a dead silhouette.
      */}
      <ambientLight intensity={1.6} />
      <directionalLight position={[4, 8, 6]} intensity={1.1} />
    </>
  );
}
