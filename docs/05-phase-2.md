# Phase 2 — the Nebula

Estimated 25–35 hours. Turns the background cluster into a real graph.

## Layout

Deterministic and seeded. Positions must be identical across reloads.

1. Place cluster centroids on a Fibonacci sphere, radius ~14 units, ordered by `Cluster.order` so SEL work occupies the front hemisphere at the default camera heading.
2. Within each cluster, place project nodes in a small local sphere (radius ~3), relaxed with a few iterations of force repulsion seeded from a constant.
3. Technology nodes sit in a wider outer shell (radius ~20), positioned near the centroid of the projects that use them.
4. Cache the result. Run once at build, not on mount.

## Nodes

**Project nodes.** `major` radius 0.85, `standard` radius 0.6. Fresnel glass shader — translucent rim, soft falloff, subtly non-spherical (low-frequency vertex displacement so the silhouette breathes). SEL work carries a small solid core in `--mask` visible through the shell; personal and client work is hollow. That reads as "this one has something inside it" without a label doing credibility hierarchy explicitly.

**Technology nodes.** Radius 0.22. Hollow, no core, lower opacity.

**Hover.** Scale to 1.15, raise opacity, brighten every connected edge, and show a DOM label with `title` and `oneLine` projected to screen space. One node at a time.

**Idle.** Whole constellation rotates on Y at ~0.02 rad/s. Individual nodes have a small independent drift. Rotation pauses on focus.

## Edges

Per `03-content-model.md`. Runtime edges are `QuadraticBezierLine`, `--ink` at 40%, with an amber pulse traveling a ~4s loop. Shared-tech edges are a single batched `LineSegments`, `--ink-faint` at 20%, static.

Undirected — no arrowheads.

Hovering a runtime edge shows a small DOM tooltip with `protocol` and `detail`. This is where "event-driven architecture," the TCP reconnect/backoff/heartbeat work, and the safe-stop error path live.

## Cluster labels

Faint Geist Sans labels at each cluster centroid, `--ink-faint`, opacity scaling with camera proximity — invisible from far away, legible when you're near. Text is `Cluster.label`, with `Cluster.context` on a second line at smaller size.

## Camera and focus

`CameraControls` from drei. Drag to rotate, scroll to dolly within a clamped range.

**Fly-in.** Clicking a node interpolates the camera to a position offset along the vector from the constellation center through the node, stopping just outside the surface and looking at it. 1400ms, `cubic-bezier(0.32, 0.72, 0, 1)`. **Never fly to the node's exact position** — that clips through the geometry.

Simultaneously: `router.push('/nebula/[slug]', { scroll: false })`, idle rotation pauses, unrelated nodes drop to 25% opacity, the focused node's material switches to real transmission.

**The interior panel.** The node's shell expands to occupy ~70% of the viewport and drops toward near-full transparency. The silhouette morphs from a wobbling sphere toward a rounded rectangle as it opens — the rim stays curved and glassy, but the content area becomes honest about being a panel, because circular content areas fight lists, code, and links.

DOM content fades in inside the shell's screen-space bounds, rendered with `motion`. Real HTML: selectable, scrollable, keyboard-accessible, crawlable. Contains exactly what `/work/[slug]` contains, from the same content object.

Connected nodes remain visible past the panel edges and stay hoverable and clickable, so you can move sideways through the graph without zooming out. Clicking a connected node flies directly there without returning to the constellation first.

**Exit.** A close control and `Escape` both return to the constellation. `router.push('/nebula')`.

## Deep linking

`/nebula/[slug]` entered directly starts the camera outside the constellation and plays the full approach before opening the node. Never cut straight in.

## Mobile

Per `02-architecture.md`. Technology nodes hidden by default. No transmission. 200 particles. Persistent bottom sheet listing all nodes is the primary navigation; the 3D is ambient. Tap to select, tap again to open.

## Accessibility

- Every node is a focusable element in a hidden-but-present DOM list mirroring the graph. Tab moves through it, Enter opens.
- A visible "View as list" link is always present in the corner, going to `/work`.
- Under `prefers-reduced-motion`: no rotation, no drift, no pulses, and camera flights become instant cuts.

## Done when

A visitor can enter the nebula, trace the scanner → board data service → solder driver chain by hovering the edges, open any node, read the full project, and jump sideways to a connected one — and a keyboard-only visitor can do all of it too.
