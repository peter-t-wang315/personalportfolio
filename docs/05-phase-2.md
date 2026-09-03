# Phase 2 — the Nebula

Estimated 25–35 hours. Turns the background cluster into a real graph.

## Layout

Deterministic and seeded — this produces the initial arrangement only. Same seed, same starting positions, every load; the runtime force simulation (see Nodes below) then takes over and positions diverge from there. See `02-architecture.md`'s Content pipeline section for that tradeoff.

1. Place cluster centroids on a Fibonacci sphere, radius ~14 units, ordered by `Cluster.order` so SEL work occupies the front hemisphere at the default camera heading.
2. Within each cluster, place project nodes in a small local sphere (radius ~3), relaxed with a few iterations of force repulsion seeded from a constant.
3. Technology nodes sit in a wider outer shell (radius ~20), positioned near the centroid of the projects that use them.
4. Cache the result. Run once at build, not on mount.

## Nodes

**Project nodes.** `major` radius 0.85, `standard` radius 0.6. Fresnel glass shader — translucent rim, soft falloff, subtly non-spherical (low-frequency vertex displacement so the silhouette breathes). A three-way **category** — professional / personal / tech — drives an inner core. This is purely a professional-vs-personal split, not an ownership or authorship signal. Professional project nodes (the four SEL clusters plus the METER internship — see `content/index.ts`'s `professionalClusterIds` for the exhaustive set) carry a large translucent core, ~80% of the shell's radius, in `--mask` at ~20–25% opacity: a wash of color visible through the shell rather than a solid object. Personal and client-work nodes are fully hollow at the same shell size.

**Technology nodes.** Radius 0.34. Hollow, no core, lower opacity.

**Hover.** Scale to 1.15, raise opacity, brighten every connected edge. The node's `title` — not `oneLine`, which is reserved for the 2.6 interior panel — fades in centered inside the shell, sized via `Html`'s `distanceFactor` so it scales with the node's screen size and camera distance, the same "content lives in 3D space" technique the 2.6 panel needs. Animated with a real underdamped spring, not a flat fade or instant toggle, so it pops in and settles; the same spring mirrors on dismissal. One node at a time.

Also attracts: every node connected to the hovered one is pulled toward it for as long as the hover holds, and released back into the simulation on hover-out — see Motion below for the per-node personality variation on this spring.

**Motion.** Nodes float freely in a lightweight runtime force simulation rather than sitting at fixed positions with idle drift — `layout.ts` supplies the initial arrangement only. Weak springs hold runtime-edge-connected pairs loosely together; everything else wanders via non-repeating value noise, not summed sines — periodic drift reads as mechanical within a cycle or two, however many are layered. The simulation freezes completely during any programmatic camera movement — fly-in focus, the Phase 3 guided tour, ⌘K search — not just while a node is hovered, so nodes hold still while the camera is doing the moving. It resumes when that movement ends.

**Attraction personality.** The hover-attraction spring is not uniform across nodes: each node's damping ratio, natural frequency, and pull strength are drawn from an independent per-node seed at module load, before any hover target is known, so several simultaneous attractions read as varied and organic rather than synchronized. **Distance to the attraction target must never become a deliberate input to these parameters** — any apparent correlation between distance and spring behavior has to be incidental to the seeding, never a designed relationship, or the personality system regresses into something that just re-describes proximity.

## Edges

Per `03-content-model.md`. Runtime edges are `QuadraticBezierLine`, `--ink` at 40%, with an amber pulse traveling a ~4s loop. Shared-tech edges are a single batched `LineSegments`, `--ink-faint` at 20%, static.

Undirected — no arrowheads.

Hovering a runtime edge shows a small DOM tooltip with `protocol` and `detail`. This is where "event-driven architecture," the TCP reconnect/backoff/heartbeat work, and the safe-stop error path live.

## Cluster labels

Faint Geist Sans labels at each cluster centroid, `--ink-faint`, opacity scaling with camera proximity — invisible from far away, legible when you're near. Text is `Cluster.label`, with `Cluster.context` on a second line at smaller size.

## Camera and focus

`CameraControls` from drei. Drag to rotate, scroll to dolly within a clamped range.

**Fly-in.** Clicking a node interpolates the camera to a position offset along the vector from the constellation center through the node, stopping just outside the surface and looking at it. 1400ms, `cubic-bezier(0.32, 0.72, 0, 1)`. **Never fly to the node's exact position** — that clips through the geometry.

Simultaneously: `router.push('/nebula/[slug]', { scroll: false })`, the float simulation freezes, unrelated nodes drop to 25% opacity. Whether the focused node's material switches to real transmission is tier-dependent — see `02-architecture.md`'s Responsive tiers table. Desktop only; tablet and mobile keep the fresnel shader throughout.

**The interior panel.** The node's shell expands and drops toward near-full transparency; see `02-architecture.md`'s Responsive tiers table for exact panel size per device. The silhouette morphs from a wobbling sphere toward a rounded rectangle as it opens — the rim stays curved and glassy, but the content area becomes honest about being a panel, because circular content areas fight lists, code, and links.

Under 500px of viewport height, in any tier, this morph doesn't happen at all: the panel is a full-height sheet instead, with no circular-to-rounded-rect transition. See `02-architecture.md`'s Orientation and short viewports.

DOM content fades in inside the shell's screen-space bounds, rendered with `motion`. Real HTML: selectable, scrollable, keyboard-accessible, crawlable. Contains exactly what `/work/[slug]` contains, from the same content object.

Connected nodes remain visible past the panel edges and stay hoverable and clickable, so you can move sideways through the graph without zooming out. Clicking a connected node flies directly there without returning to the constellation first.

**Exit.** A close control and `Escape` both return to the constellation. `router.push('/nebula')`. The float simulation resumes.

## Work-page gathering

On `/work/[slug]`, the project's connected subgraph — its runtime-edge neighbours plus its tech nodes — gathers toward a focal point using the same attraction mechanic as hover, viewed from outside the constellation rather than flown into. Unrelated nodes stay dimmed and uninvolved. It settles once and the simulation loop stops completely — no ongoing motion or GPU cost beside the body text. Under `prefers-reduced-motion`, it renders already-settled with no animation.

## Deep linking

`/nebula/[slug]` behaves differently depending on how it's reached:

- **Cold entry** (a direct link or a reload): no approach flight. The page lands already inside the node — shell expanded, panel open, content visible at first paint, constellation visible around it. On exit, the camera pulls back and the shell contracts, revealing the constellation — the arrival experience, played in reverse.
- **Reached by navigating within the graph** (clicking a node from `/nebula` or sideways from another open node): the full 1400ms approach flight, as specified above.

`/nebula/[slug]` sets a canonical link tag pointing to `/work/[slug]` — the same prose exists at both URLs, and this is what prevents the duplication from being a duplicate-content SEO problem. There is no visitor-facing redirect between them under normal conditions.

If WebGL is unavailable, or `prefers-reduced-motion` is set, `/nebula/[slug]` redirects to `/work/[slug]` instead — a graph the visitor can't move through has no advantage over the document, and cold-entry's "already inside" state has nothing to animate out of on exit if it can't animate in the first place. Reduced-motion needs no special case for the cold-entry path beyond this redirect: it was already static-on-load, so there's nothing further to disable.

## Device tiers

Tier-specific behavior (particle counts, transmission policy, tech node visibility, navigation model, panel sizing) is defined once, in `02-architecture.md`'s Responsive tiers table. This section doesn't restate it.

## Accessibility

- Every node is a focusable element in a hidden-but-present DOM list mirroring the graph. Tab moves through it, Enter opens.
- A visible "View as list" link is always present in the corner, going to `/work`.
- Under `prefers-reduced-motion`: the float simulation renders frozen at the seeded initial layout, the work-page gathering renders already-settled, no pulses, and camera flights become instant cuts.

## Done when

A visitor can enter the nebula, trace the scanner → board data service → solder driver chain by hovering the edges, open any node, read the full project, and jump sideways to a connected one — and a keyboard-only visitor can do all of it too.
