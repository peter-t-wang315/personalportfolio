"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { cubicBezier } from "motion/react";
import { makeRng } from "@/lib/seeded-random";
import { palette } from "@/lib/palette";
import { useDeviceTier, type DeviceTier } from "@/lib/device-tier";
import {
  DESKTOP_MIN_WIDTH_PX,
  SHORT_VIEWPORT_HEIGHT_PX,
  clusterBesideTextColumn,
  textColumnRightPx,
} from "@/lib/cluster-geometry";
import { useSceneStore } from "@/lib/scene-store";
import {
  SHELL_CLOSE_MS,
  SHELL_OPEN_MS,
} from "@/lib/focus-framing";
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
  GATHER_RADIUS,
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
 * Harder on a spotlit `/work/[slug]`, where the graph has one job: show what
 * this project connects to. Inside the nebula an unrelated node is still
 * somewhere you might go next and stays legible at 0.25; beside an article it
 * is context the reader did not ask for, and letting it recede further is what
 * makes the subgraph the thing you actually see.
 */
const SPOTLIT_UNRELATED_FACTOR = 0.12;
/**
 * What is left of an unrelated node's already-reduced opacity when it lands
 * *on* the lit cluster rather than beside it. Not zero: a node that vanishes
 * as the globe turns reads as a bug, and the far side showing through is what
 * gives the shell its depth everywhere else on the page.
 */
const SPOTLIT_OVERLAP_FACTOR = 0.2;


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
 * Fog band, in world units.
 *
 * **These numbers are for a world that does not exist yet** — see
 * `07-continuous-space.md`. Today they do nothing at all, and that is
 * deliberate and proven rather than hoped: every node on every route currently
 * sits nearer than 28 units, so a band starting at 55 never engages. Measured,
 * moving it from 27–48 to here changes 0 pixels of 67,102 with ink on a work
 * page, 0 of 42,576 on the landing page and 0 of 66,315 inside the graph, with
 * motion frozen so only the fog differs.
 *
 * The band it replaces was not doing anything either, which took some finding.
 * Its 27–48 was measured against an *outside* framing of the constellation —
 * nodes spanning depth 20.1 to 42.5 — and that framing was abandoned when
 * `/nebula` moved inside the shell. From the inside pose the whole graph sits
 * between 7.8 and 14.2 units away, and the landing and work-page placements
 * put it between 18.7 and 27.3. Nothing has reached the old near plane since.
 * The fog has been inert for as long as the camera has been inside, and the
 * docs describing it as grading the far cluster to 90% were describing a
 * composition that no longer ships.
 *
 * That the plumbing works is worth stating too, since inert fog and absent fog
 * look identical: bringing the band in to 5–30 changes 13.8% of the work
 * page's ink, 17.0% of the landing page's and 71.4% of the graph's.
 *
 * What these are chosen for is the fixed world, where the graph is life-size at
 * the origin and the landing viewpoint stands ~74 units away. Near clears the
 * graph seen from inside (14.2 at most) by a wide margin, so fog goes on doing
 * nothing there — from within a shell there is no recession for it to describe.
 * Far is set so an object at 74 units reads about a quarter faded: present and
 * hazed rather than erased, which is the whole reason this part exists. Seen
 * from the landing standing point the graph will span 63–85 and grade from 11%
 * to 40%, which is a first guess at a recession, not a considered one.
 *
 * **Both numbers are provisional and belong to Part 3**, when there is finally
 * something at those distances to tune them against.
 */
const FOG_NEAR = 55;
const FOG_FAR = 130;

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
/**
 * Hover still *registers* while a node is open — the neighbours past the panel
 * edges are the way sideways, so they light and the cursor says they can be
 * clicked. What it stops doing is **moving anything**.
 *
 * The attraction is a browsing affordance: drawing a node's connections in so
 * you can see what it talks to. Inside an open node it is neither wanted nor
 * harmless. The camera is parked inches off one surface, so a stray pointer
 * crossing a neighbour re-targeted every spring in the graph and the whole
 * scene lurched around the thing being read.
 */
function attractionIsWelcome() {
  const { focusedNodeId, flying } = useSceneStore.getState();
  return !focusedNodeId && !flying;
}

function handlePointerOver(e: ThreeEvent<PointerEvent>, nodeId: string) {
  e.stopPropagation();
  useSceneStore.getState().setHoveredNodeId(nodeId);
  if (attractionIsWelcome()) attractNeighbors(nodeId);
}

function handlePointerOut(e: ThreeEvent<PointerEvent>, nodeId: string) {
  e.stopPropagation();
  if (useSceneStore.getState().hoveredNodeId === nodeId) {
    useSceneStore.getState().setHoveredNodeId(null);
    // Releasing while focused would be the same lurch in reverse.
    if (attractionIsWelcome()) releaseAttraction();
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
/** Scratch for the spotlight labels' facing test, which runs every frame. */
const _labelCentre = new THREE.Vector3();
const _labelWorld = new THREE.Vector3();
const _labelEdge = new THREE.Vector3();
const _labelRight = new THREE.Vector3();
const _labelScale = new THREE.Vector3();
const _screen = new THREE.Vector3();
/** Scratch for the lit group's screen extent: x,y pairs, one per lit node. */
const _litPoints = new Float64Array(128);
/** Scratch for the label de-collision pass; reused so it allocates nothing. */
const placed: {
  label: HTMLDivElement;
  anchorX: number;
  anchorY: number;
  idealX: number;
  idealY: number;
  x: number;
  y: number;
  width: number;
  height: number;
  hidden: boolean;
}[] = [];
/**
 * The separation and the pull compete, so this runs to a settling point rather
 * than to the first frame with no overlap — and cannot exit early, since the
 * pull reintroduces overlaps the separation just resolved.
 */
const SPOTLIGHT_LABEL_PASSES = 12;
/** How hard each pass drags a name back toward its own node. */
const SPOTLIGHT_LABEL_PULL = 0.3;
/** Trailing passes that separate without pulling, so separation wins the tie. */
const SPOTLIGHT_LABEL_SETTLE_PASSES = 3;
/**
 * Clear space between two names. Smaller than the gap they keep from the nodes
 * themselves: a name touching another name is only untidy, while a name
 * touching a node claims to belong to it.
 */
const SPOTLIGHT_LABEL_SPACING_PX = 5;
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
 * Clearance between a node's drawn edge and its name, in screen pixels.
 *
 * Added to the node's *measured* on-screen radius rather than used as a flat
 * offset. The nodes here are 5-11px across depending on kind and route, and a
 * single offset that clears the big ones wastes space around the small ones
 * while a single offset that suits the small ones lands text on top of the
 * big ones — which is what a flat 16px did to the subject node.
 */
const SPOTLIGHT_LABEL_GAP_PX = 9;

/**
 * The names of a spotlit project and everything it connects to, drawn beside
 * the nodes themselves.
 *
 * **Always visible, not on hover.** The whole reason the graph is on a work
 * page is to show what the project is built from, and a connection you have to
 * discover one node at a time does not say that — it makes the reader do
 * lookup work to recover something the page already knows. Hover also has no
 * answer on touch, where there is nothing to hover with, and it would hide the
 * labels behind the one gesture that route now uses to spin the globe.
 *
 * Only the lit subgraph is named. All 45 at once is not a diagram, it is a
 * wall of text over a sphere — and the other 36 are dimmed to an eighth of
 * their opacity precisely because they are not part of this project's story.
 *
 * Sized in CSS rather than through `Html`'s `distanceFactor`, which is what
 * the hover label inside `/nebula` uses. That one is read from within the
 * shell, where a node fills much of the view and text should grow with it.
 * Here the globe is a small object beside an article and its nodes are 5-11px
 * across; text scaled to *them* would be unreadable, so the label keeps a
 * constant screen size and only its position tracks the node.
 */
function SpotlightLabels({
  nodeIds,
  subjectId,
}: {
  nodeIds: string[];
  subjectId: string;
}) {
  const size = useThree((state) => state.size);
  const groupRef = useRef<THREE.Group>(null);
  const holders = useRef<Record<string, THREE.Group | null>>({});
  const labels = useRef<Record<string, HTMLDivElement | null>>({});
  /**
   * Each label's rendered box, measured once and then read from here every
   * frame. `offsetWidth` forces a synchronous layout, and eight of those per
   * frame for text whose size never changes is a reflow loop for nothing.
   */
  const sizes = useRef<Record<string, { width: number; height: number }>>({});

  // Cleared when the spotlight moves, so the next frame re-measures the new
  // set's text rather than laying it out against the old one's boxes.
  useEffect(() => {
    sizes.current = {};
  }, [nodeIds]);

  useFrame((state) => {
    const group = groupRef.current;
    if (!group) return;
    // The globe's own centre, as a distance from the camera. Anything further
    // than this is on the far side of the sphere, where its node is behind the
    // shell and a name floating over the front would point at nothing.
    group.getWorldPosition(_labelCentre);
    const centreDistance = _labelCentre.distanceTo(state.camera.position);
    const scale = group.getWorldScale(_labelScale).x;
    const halfWidth = state.size.width / 2;
    // The camera's own right vector, so a node's radius can be measured across
    // the screen rather than along whichever world axis happens to face it.
    _labelRight.setFromMatrixColumn(state.camera.matrixWorld, 0);

    for (const id of nodeIds) {
      const holder = holders.current[id];
      if (!holder) continue;
      const live = getLivePosition(id);
      if (live) holder.position.copy(live);
      else holder.position.fromArray(nodeGeometry[id].position);
    }

    placed.length = 0;

    // The subject's projected position is the origin every other label is
    // pushed away from, so it has to be resolved before any of them.
    const subjectHolder = holders.current[subjectId];
    let subjectX = 0;
    let subjectY = 0;
    if (subjectHolder) {
      subjectHolder.getWorldPosition(_labelWorld).project(state.camera);
      subjectX = (_labelWorld.x * 0.5 + 0.5) * state.size.width;
      subjectY = (-_labelWorld.y * 0.5 + 0.5) * state.size.height;
    }

    for (const id of nodeIds) {
      const holder = holders.current[id];
      const label = labels.current[id];
      if (!holder || !label) continue;

      holder.getWorldPosition(_labelWorld);
      const behind =
        _labelWorld.distanceTo(state.camera.position) > centreDistance;

      // How big this node actually is on screen: project its centre and a
      // point one radius to the camera's right, and measure between them.
      _labelEdge
        .copy(_labelWorld)
        .addScaledVector(_labelRight, nodeGeometry[id].radius * scale);
      _labelWorld.project(state.camera);
      _labelEdge.project(state.camera);
      const x = (_labelWorld.x * 0.5 + 0.5) * state.size.width;
      const y = (-_labelWorld.y * 0.5 + 0.5) * state.size.height;
      const radiusPx = Math.abs(_labelEdge.x - _labelWorld.x) * halfWidth;

      // **Pushed outward from the subject, not downward.** The neighbours
      // settle as a ring around it, so radial offsets fan out with the ring
      // and the names separate on their own; a shared downward offset stacked
      // them into each other and onto the node in the middle.
      let dx = x - subjectX;
      let dy = y - subjectY;
      const length = Math.hypot(dx, dy);
      if (length < 1) {
        // The subject itself, and anything sitting on top of it: straight down.
        dx = 0;
        dy = 1;
      } else {
        dx /= length;
        dy /= length;
      }
      // Offset the label's *near edge*, not its centre. These boxes are up to
      // 130px wide and two lines tall, so pushing the centre out by the node's
      // radius alone left half a label lying across the node it names.
      // Measured on the first frame the label has a box, not in an effect:
      // drei's Html mounts its portal in an effect of its own, so an effect
      // here runs while the div still has no layout and every label caches a
      // zero-sized box — which silently disabled both the offset below and the
      // de-collision pass, leaving names overlapping by up to 730px^2.
      let size = sizes.current[id];
      if (!size && label.offsetWidth > 0) {
        size = { width: label.offsetWidth, height: label.offsetHeight };
        sizes.current[id] = size;
      }
      // How far the label's own edge is depends on which way it is pushed, and
      // the answer is where the ray leaves the box — min(w/2/|dx|, h/2/|dy|) —
      // not |dx|·w/2 + |dy|·h/2, which is what this did first. The sum is right
      // only for a push straight along an axis; on a diagonal it adds half the
      // width to half the height when the ray in fact exits through whichever
      // edge it reaches first. On a 130x28 label pushed at 45° it claims 55px
      // where the true answer is 20, and every diagonally-placed name was
      // shoved out by the difference.
      let ownExtent = 0;
      if (size) {
        const toSide =
          Math.abs(dx) > 1e-6 ? size.width / 2 / Math.abs(dx) : Infinity;
        const toCap =
          Math.abs(dy) > 1e-6 ? size.height / 2 / Math.abs(dy) : Infinity;
        ownExtent = Math.min(toSide, toCap);
      }
      const distance = radiusPx + SPOTLIGHT_LABEL_GAP_PX + ownExtent;
      placed.push({
        label,
        anchorX: x,
        anchorY: y,
        idealX: x + dx * distance,
        idealY: y + dy * distance,
        x: x + dx * distance,
        y: y + dy * distance,
        width: size ? size.width : 0,
        height: size ? size.height : 0,
        hidden: behind,
      });
    }

    // **Then push the names off each other.** Fanning them outward separates
    // the ring, but two neighbours that happen to share a bearing from the
    // subject get the same direction and land on top of each other anyway.
    // This is the node separation pass in two dimensions: resolve each
    // overlapping pair along its shallower axis, half the correction each, a
    // few times. The labels drift off their exact radial line rather than
    // overlapping, which is the right trade — a name a few pixels off its
    // spoke still reads as belonging to its node; two names on top of each
    // other read as neither.
    for (let pass = 0; pass < SPOTLIGHT_LABEL_PASSES; pass++) {
      for (let i = 0; i < placed.length; i++) {
        const a = placed[i];
        if (a.hidden) continue;
        for (let j = i + 1; j < placed.length; j++) {
          const b = placed[j];
          if (b.hidden) continue;
          const overlapX =
            (a.width + b.width) / 2 + SPOTLIGHT_LABEL_SPACING_PX - Math.abs(a.x - b.x);
          const overlapY =
            (a.height + b.height) / 2 + SPOTLIGHT_LABEL_SPACING_PX - Math.abs(a.y - b.y);
          if (overlapX <= 0 || overlapY <= 0) continue;
          if (overlapY <= overlapX) {
            const push = (Math.sign(a.y - b.y) || 1) * (overlapY / 2);
            a.y += push;
            b.y -= push;
          } else {
            const push = (Math.sign(a.x - b.x) || 1) * (overlapX / 2);
            a.x += push;
            b.x -= push;
          }
        }
      }
      // **Then pull every name back toward its own node.** Resolving overlaps
      // alone only ever pushes labels apart, so each pass moved them further
      // out and never back: the worst drifted 92px from the node it names,
      // past other nodes, and stopped reading as a label for anything. Pulling
      // toward the ideal spot after each resolution makes the two forces
      // compete instead, and they settle where the name is as close to its
      // node as the other names allow.
      // ...except on the last passes, which separate only. The pull is applied
      // after the resolution, so whatever it does last is what ships — and
      // dragging labels back together was reintroducing overlaps the pass had
      // just cleared (45px² of them, measured). Letting separation have the
      // final word costs a pixel or two of closeness and guarantees the thing
      // that actually matters.
      if (pass < SPOTLIGHT_LABEL_PASSES - SPOTLIGHT_LABEL_SETTLE_PASSES) {
        for (const p of placed) {
          if (p.hidden) continue;
          p.x += (p.idealX - p.x) * SPOTLIGHT_LABEL_PULL;
          p.y += (p.idealY - p.y) * SPOTLIGHT_LABEL_PULL;
        }
      }
    }

    // A name may not be drawn across the article. Even where the globe itself
    // clears the measure, its labels reach up to 130px further in, and on the
    // narrower desktop widths that is enough to put half of them over the
    // prose — measured, 6 of 12 at 1024x768 and 11 of 12 at 844x390. Hiding
    // only the ones that cross keeps every name there is room for, rather than
    // dropping the whole set at a breakpoint.
    const textRight = textColumnRightPx(state.size.width);
    for (const p of placed) {
      p.label.style.transform = `translate(${(p.x - p.anchorX).toFixed(1)}px, ${(p.y - p.anchorY).toFixed(1)}px)`;
      p.label.style.opacity =
        p.hidden || p.x - p.width / 2 < textRight ? "0" : "1";
    }
  });

  // Nothing at all where the page is a vertical stack: there the globe sits
  // *behind* the prose rather than beside it, so every name lands on top of a
  // sentence and neither can be read. Measured at 390x844, all twelve.
  if (!clusterBesideTextColumn(size.width, size.height)) return null;

  return (
    <group ref={groupRef}>
      {nodeIds.map((id) => {
        const node = nodeGeometry[id];
        const title = hoverLabelTitle(id);
        if (!node || !title) return null;
        return (
          <group
            key={id}
            ref={(el) => {
              holders.current[id] = el;
            }}
            position={node.position}
          >
            <Html center style={{ pointerEvents: "none" }} zIndexRange={[5, 0]}>
              <div
                ref={(el) => {
                  labels.current[id] = el;
                }}
                className="w-max max-w-[130px] text-center text-[0.6875rem] font-medium leading-tight text-ink-muted transition-opacity duration-300"
                style={{ opacity: 0 }}
              >
                {title}
              </div>
            </Html>
          </group>
        );
      })}
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
  gatherNodeId,
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
  /**
   * The project whose neighbours are drawn in — the route's, never the hover
   * preview's.
   *
   * Turning and gathering are deliberately split. The turn is cheap to redo
   * and previews well, so a hovered row gets it; the gather is a spring with a
   * tenth-of-a-second time constant, so re-aiming it at every row a reader
   * crosses makes the graph snap rather than move. Opening the project is what
   * pulls its neighbours in.
   */
  gatherNodeId: string | null;
  /** Pushes the node's route. Focus follows from the route, never from here. */
  onOpenNode: (id: string) => void;
}) {
  const tier = useDeviceTier();
  const meshRefs = useRef<Record<string, THREE.Mesh | null>>({});
  const groupRef = useRef<THREE.Group>(null);
  /** The lit group's circle on screen, recomputed each frame. */
  const litScreen = useRef({ x: 0, y: 0, radius: 0 });
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

  /**
   * **Closing a node lets its neighbours go.**
   *
   * The hover that preceded the click drew them in, and nothing released it:
   * the pointer never left the node in a way `handlePointerOut` saw, because
   * what moved was the camera. So the graph stayed in the shape the hover had
   * pulled it into long after the reader had left, and the next hover
   * re-targeted every spring at once — the whole constellation snapping from
   * one cluster to another with nothing on screen to explain it.
   *
   * Released on the way out rather than on the way in, so the connections stay
   * gathered around the panel while it is open, which is what makes them
   * legible past its edges (05a's sideways navigation).
   *
   * Work pages are excluded: their gather is owned by the effect below, and a
   * blanket release here would undo it on every render.
   */
  useEffect(() => {
    if (!spotlightNodeId && !focusedNodeId) releaseAttraction();
  }, [focusedNodeId, spotlightNodeId]);

  /**
   * A spotlit project draws its neighbours in, using 2.3a's attraction — the
   * same mechanic hover uses, and the "gathering" 05-phase-2.md originally
   * asked this page for. The turn alone left the subgraph as sparse as the
   * rest of the shell, which made it hard to see what was being highlighted
   * and gave the composition nothing to aim at.
   *
   * It works despite the freeze above, and that is not an accident of
   * ordering: freezing holds the *wander* clock still, while the attraction
   * springs integrate against real delta time. So the neighbours slide in and
   * everything else stays exactly where it was — which is precisely the
   * "settles once, then stops" the spec wants, rather than a page of drifting
   * nodes behind prose.
   */
  useEffect(() => {
    if (!gatherNodeId) return;
    // To a ring rather than a share of each node's own distance — see
    // GATHER_RADIUS. The fractional pull hover uses keeps whatever spread the
    // nodes started with, so the ones already beside the subject ended up
    // almost inside it while the far ones stayed far, and the group looked
    // lopsided rather than assembled.
    attractNeighbors(gatherNodeId, { gatherRadius: GATHER_RADIUS });
    return () => releaseAttraction();
  }, [gatherNodeId]);

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
    const openStep = reducedMotion
      ? 1
      : (delta * 1000) / (openTarget ? SHELL_OPEN_MS : SHELL_CLOSE_MS);
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

    // Where the lit group sits on screen, and how wide it is — resolved once
    // before the node pass below, which needs it for every unrelated node.
    litScreen.current.radius = 0;
    if (related && related.size > 0) {
      let sx = 0;
      let sy = 0;
      let seen = 0;
      for (const id of related) {
        const mesh = meshRefs.current[id];
        if (!mesh) continue;
        mesh.getWorldPosition(_screen).project(state.camera);
        _litPoints[seen * 2] = (_screen.x * 0.5 + 0.5) * state.size.width;
        _litPoints[seen * 2 + 1] = (-_screen.y * 0.5 + 0.5) * state.size.height;
        sx += _litPoints[seen * 2];
        sy += _litPoints[seen * 2 + 1];
        seen++;
      }
      if (seen > 0) {
        litScreen.current.x = sx / seen;
        litScreen.current.y = sy / seen;
        let far = 0;
        for (let i = 0; i < seen; i++) {
          far = Math.max(
            far,
            Math.hypot(
              _litPoints[i * 2] - litScreen.current.x,
              _litPoints[i * 2 + 1] - litScreen.current.y,
            ),
          );
        }
        litScreen.current.radius = far;
      }
    }

    // Stop advancing the clock and the breathing displacement freezes in
    // place. The step itself keeps running: freezing the *clock* is what stops
    // the wander, while the attraction springs integrate on the frame delta
    // and must keep doing so, since a spotlit work page gathers its subgraph
    // while frozen. Which is why hover attraction has to be withheld by hand
    // when a node is open (attractionIsWelcome) — the freeze does not, and was
    // never going to, hold it still.
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
      const spotlit = node.id === spotlightNodeId;
      const targetScale =
        node.radius *
        ((hovered && !focused) || spotlit ? HOVER_SCALE_FACTOR : 1);

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
      let unrelatedFactor = spotlightNodeId
        ? SPOTLIT_UNRELATED_FACTOR
        : UNRELATED_OPACITY_FACTOR;
      // **Nodes that bleed through the lit cluster recede further still.**
      // The confusing ones are not neighbours crowding the subject — measured
      // on /work/selective-solder-driver, all five unrelated nodes landing
      // inside the lit cluster's screen box were 18.6 to 22.6 units away on a
      // shell 22 across, i.e. the *far side*, showing through. Nothing can be
      // moved to fix that; they are already as distant as this sphere allows,
      // and the only thing they share with the cluster is a screen position.
      // So the answer is screen-space too: fade by how far a node lands from
      // the lit group, not by how far it is from it.
      if (unrelated && litScreen.current.radius > 0) {
        const mesh = meshRefs.current[node.id];
        if (mesh) {
          mesh.getWorldPosition(_screen).project(state.camera);
          const sx = (_screen.x * 0.5 + 0.5) * state.size.width;
          const sy = (-_screen.y * 0.5 + 0.5) * state.size.height;
          const distance = Math.hypot(
            sx - litScreen.current.x,
            sy - litScreen.current.y,
          );
          unrelatedFactor *= THREE.MathUtils.lerp(
            SPOTLIT_OVERLAP_FACTOR,
            1,
            THREE.MathUtils.smoothstep(
              distance,
              litScreen.current.radius,
              litScreen.current.radius * 1.6,
            ),
          );
        }
      }
      // The professional core goes as the node opens: a --mask sphere
      // floating behind the text is exactly the "solid object" it was designed
      // not to read as.
      const core = mesh.children[0];
      if (core) core.visible = open < 0.01;
      const targetOpacity =
        ambient.current *
        (unrelated
          ? baseOpacity(node, tier) * unrelatedFactor
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
      {/* Names for the spotlit subgraph. Not inside the graph, where the
          hover label already answers this at a size suited to reading a node
          from within the shell, and not while a flight is in the air, where
          they would be text pinned to nodes mid-flight. */}
      {!isNebula && !flying && spotlightNodeId && related && (
        <SpotlightLabels nodeIds={[...related]} subjectId={spotlightNodeId} />
      )}
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
