"use client";

import { create } from "zustand";

/**
 * Single cross-boundary store. The DOM overlay and the R3F scene both read
 * from this. Context doesn't cross the R3F reconciler boundary reliably,
 * so this is the standard answer. See docs/02-architecture.md.
 *
 * It used to carry a `mode: 'distant' | 'constellation' | 'inside'`, which
 * nothing ever wrote and nothing ever read — the scene takes the route as
 * props and derives the rest from `focusedNodeId`, so `mode` could only ever
 * have been a second copy of facts already held elsewhere, free to go stale.
 * Bring it back when something needs a state the route genuinely cannot
 * express: Phase 3's guided tour and ⌘K search are the candidates, since
 * neither changes the URL.
 */
interface SceneState {
  pointer: { x: number; y: number };
  reducedMotion: boolean;
  /** Step 2.4: the single hovered node, if any. One node hovered at a time. */
  hoveredNodeId: string | null;
  /**
   * Step 2.5: the node the camera has flown to, if any. One at a time, and
   * distinct from `hoveredNodeId` — hovering is a preview that survives the
   * pointer moving on, focusing is a committed state that only Escape, the
   * close control, or focusing something else leaves.
   *
   * Written only by nebula-canvas.tsx's RouteFocus, from the URL: node clicks
   * push `/nebula/[slug]` (or `/nebula/tech/[id]`) and the route sets this,
   * never the reverse. That is what makes back and forward correct. The
   * camera does not read it either — the rig keys its flights on the route
   * directly, because this is synced a beat later than the route changes.
   */
  focusedNodeId: string | null;
  /**
   * Has the approach flight finished? Written by the camera rig, which is the
   * only thing that knows — deriving it from a timer in the consumer would be
   * a second copy of the flight's duration, free to drift from the real one.
   * Consumers that must wait for the arrival (2.5's transmission swap; 2.6's
   * panel) gate on this rather than on `focusedNodeId` alone.
   */
  focusSettled: boolean;
  /**
   * Is a programmatic camera flight running right now — the arrival into the
   * constellation, the departure back out, or a focus approach?
   *
   * Written by the camera rig, the only thing that knows. Two things read it,
   * and both would otherwise have to re-derive the flight's timing: the
   * constellation freezes the float simulation while it is true (05-phase-2.md
   * asks for that during *any* programmatic camera movement, not just focus),
   * and it withholds hover and click while it is true, because a raycast
   * against a scene whose placement is mid-interpolation resolves to a node
   * the viewer never aimed at.
   */
  flying: boolean;
  /**
   * The pair of nodes a sideways flight is travelling between, while it is in
   * the air. The edge layer reads it to light the connection being followed,
   * so moving from one node to another shows you the link you took rather
   * than just arriving somewhere else.
   */
  travellingBetween: { from: string; to: string } | null;
  /**
   * The project the reader is pointing at in the `/work` list, as a node id.
   *
   * The globe begins turning toward it on hover, so the list previews the page
   * it leads to and the turn is already half-made by the time the reader gets
   * there. Cleared on hover-out; superseded by the route once they arrive.
   */
  previewNodeId: string | null;
  /**
   * **Where the graph actually is on screen**, in viewport pixels: the circle
   * its bounding radius occupies, as currently rendered.
   *
   * Written every frame by the camera rig (imperatively, not through a
   * subscription — the rig does not need to re-render off its own write) and
   * guarded by an epsilon, so a lerp that never exactly arrives cannot
   * re-render every subscriber at 60fps forever.
   *
   * DOM overlays read this rather than re-deriving it. There used to be a
   * second implementation in lib/use-cluster-screen.ts working from the
   * parallax offset and the viewport size, which was correct on the landing
   * page and wrong by both the spotlight zoom and the work-page centring
   * anywhere a project is lit. One source of truth: the thing that draws it
   * says where it is.
   *
   * `ready` is false until the scene has published once, which also means the
   * overlays stand down when there is no canvas to overlay.
   */
  clusterScreen: {
    ready: boolean;
    centerX: number;
    centerY: number;
    radiusPx: number;
  };
  /**
   * **The real hero, measured** — the text the landing page draws, as the
   * canvas needs it to paint the plane that stands in for the page while the
   * reader flies past it (nebula-home.tsx). Written by app/hero-layout.ts on
   * mount, on resize, and at the moment the reader clicks to leave; null until
   * the landing page has been seen this session, in which case the plane
   * paints its own approximation of the hero and stands where a desktop hero
   * would.
   *
   * Only the parts that decide what the texture *contains*. Where the column
   * is on screen changes every frame with the pointer parallax and is kept in
   * a per-frame record instead (nebula-home-placement.ts), so a moving column
   * does not re-render every subscriber of this store.
   */
  heroLayout: HeroLayout | null;
  /**
   * A request to leave for the graph, made by the landing page before the
   * route changes. Incremented, not toggled, so two clicks in a row are two
   * requests rather than a request and its cancellation.
   *
   * It exists because the flight has to start while the hero is still in the
   * document. Navigating unmounts the landing page in the same commit, and
   * the cross-fade between the real hero and the plane needs both to exist
   * for a fifth of a second — so the click starts the flight and fades the
   * page, and the route follows once the page has gone (nebula-departure.ts).
   */
  arrivalRequest: number;
  setPointer: (pointer: { x: number; y: number }) => void;
  setReducedMotion: (reducedMotion: boolean) => void;
  setHoveredNodeId: (id: string | null) => void;
  focusNode: (id: string) => void;
  clearFocus: () => void;
  setFocusSettled: (settled: boolean) => void;
  setFlying: (flying: boolean) => void;
  setTravellingBetween: (pair: { from: string; to: string } | null) => void;
  setPreviewNodeId: (id: string | null) => void;
  setClusterScreen: (circle: {
    ready: boolean;
    centerX: number;
    centerY: number;
    radiusPx: number;
  }) => void;
  setHeroLayout: (layout: HeroLayout | null) => void;
  requestArrival: () => void;
}

/** One run of text on the hero, as the canvas repaints it. */
export interface HeroTextItem {
  text: string;
  /** The element's box in CSS px, from the column's top-left corner. */
  left: number;
  top: number;
  width: number;
  height: number;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  letterSpacing: number;
  lineHeight: number;
  color: string;
}

export interface HeroLayout {
  /** The column's box in CSS px, so the texture keeps the column's aspect. */
  width: number;
  height: number;
  items: HeroTextItem[];
}

export const useSceneStore = create<SceneState>((set) => ({
  pointer: { x: 0, y: 0 },
  reducedMotion: false,
  hoveredNodeId: null,
  focusedNodeId: null,
  focusSettled: false,
  flying: false,
  travellingBetween: null,
  previewNodeId: null,
  clusterScreen: { ready: false, centerX: 0, centerY: 0, radiusPx: 0 },
  heroLayout: null,
  arrivalRequest: 0,
  setPointer: (pointer) => set({ pointer }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  setHoveredNodeId: (hoveredNodeId) => set({ hoveredNodeId }),
  // Focusing clears the hover with it: the pointer is about to be somewhere
  // else entirely once the camera moves, so leaving a hover highlight behind
  // would strand it on a node the viewer is no longer anywhere near.
  focusNode: (focusedNodeId) =>
    set({ focusedNodeId, hoveredNodeId: null, focusSettled: false }),
  clearFocus: () => set({ focusedNodeId: null, focusSettled: false }),
  setFocusSettled: (focusSettled) => set({ focusSettled }),
  setFlying: (flying) => set({ flying }),
  setTravellingBetween: (travellingBetween) => set({ travellingBetween }),
  setPreviewNodeId: (previewNodeId) => set({ previewNodeId }),
  setClusterScreen: (clusterScreen) => set({ clusterScreen }),
  setHeroLayout: (heroLayout) => set({ heroLayout }),
  requestArrival: () =>
    set((state) => ({ arrivalRequest: state.arrivalRequest + 1 })),
}));
