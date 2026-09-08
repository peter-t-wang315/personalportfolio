# Architecture

## Stack

- Next.js (App Router), React, TypeScript
- Tailwind CSS
- `three`, `@react-three/fiber`, `@react-three/drei`
- `camera-controls` via drei's `CameraControls`
- `zustand` for cross-boundary state
- `motion` (formerly Framer Motion) for DOM animation
- `maath` for sphere point distribution
- `@react-three/postprocessing` (Phase 3 only, and only if it earns its cost)
- `@vercel/analytics`

Deployed on Vercel. Custom domain to be added later.

## The load-bearing decision: persistent canvas

The landing page shows a distant cluster. Clicking "What's this?" flies the camera into it and lands on `/nebula`. For that to be continuous rather than a page transition, **the `<Canvas>` must live in the root layout, not in any page.**

```
app/layout.tsx
  <SceneProvider>        // zustand store
    <NebulaCanvas />     // fixed, full-viewport, z-0, persists across routes
    <main>{children}</main>  // z-10, DOM content swaps above it
  </SceneProvider>
```

The canvas never unmounts. Routes change the DOM above it and push a camera target into the store; the scene reacts.

This is painful to retrofit. Build it this way from Phase 1, even though Phase 1 only renders the graph small, far off, and inert.

**One constellation, on every route.** The canvas persisting is necessary but
not sufficient: the first version of 2.5 kept a separate 40-sphere decorative
cluster for the Phase 1 routes and swapped it for the real graph on the route
change, so the object the visitor clicked was destroyed and a different object
appeared 64 units and 94 degrees away. The flight that followed was a short
move from wherever that cut had landed, and the persistent canvas was
preserving a WebGL context and nothing else.

So `app/nebula-constellation.tsx` draws the same graph everywhere, inside
`ConstellationPlacement`, whose transform is the only difference between the
routes: shrunk to the landing footprint at `CLUSTER_DEPTH` off `/nebula`,
identity on it. The landing scale is derived, not chosen —
`CLUSTER_BOUNDING_RADIUS / CONSTELLATION_BOUNDING_RADIUS`, where the second is
**measured off the real computed layout** (17.6, not the nominal 20-unit tech
shell) — so what is drawn projects to exactly the pixels the Landing cluster
placement section below has always described, and every DOM overlay measured
against those constants stays correct without knowing the geometry beneath it
changed.

**The arrival flight is what that decision buys.** It starts at the landing
page's own camera pose, looking at the same cluster the visitor just clicked,
and closes to the framing pose over 2000ms while the placement
grows to life-size around it, widening the FOV from 45 to 50 so the two
framings meet rather than snap. Leaving plays the same flight in reverse.

Two properties of that flight are load-bearing:

- **The placement is state the camera rig owns, not a function of the route**
  (`app/nebula-placement.ts`). Derived from the route it flipped to life-size on
  the commit that changed the route, while the camera stayed at the landing pose
  until the effect starting the flight ran — and the landing pose is *inside* a
  life-size constellation, so every navigation slow enough to put a frame
  between commit and effect painted the graph from within it first.
- **The path is an orbit interpolation, not a straight line** (`orbitLerpPose`).
  A straight line between two poses 9 and 41 units from their targets, 94
  degrees apart, passes closer to the subject than it started; measured, the
  camera's distance ran 23 -> 20 -> 44.5 and the approach read as a lurch
  inward. Slerping the direction and lerping the distance makes it monotonic.

There is now exactly **one** camera rig, mounted on every route. There used to
be two, each commented to warn the other off `/nebula`, because two rigs writing
the camera on one commit is a race a flight loses. One rig cannot race itself,
and it is also the only arrangement in which leaving `/nebula` can be a flight
rather than a cut — the rig that has to drive it is no longer the one that
unmounts on the way out.

Import the canvas with `next/dynamic` and `ssr: false`, with a static placeholder that paints immediately. `three` + `drei` is a heavy bundle and LCP will suffer otherwise.

## Routes

| Route | Content | Camera state |
|---|---|---|
| `/` | Hero, three metrics, links | Far. Cluster small, behind text. Centred where the hero's text column and the cluster fit side by side; slid right of that column where they don't — see Landing cluster placement below. |
| `/about` | Bio, photo, skills prose, mentoring, on-call, Claude Code | Far, slightly offset |
| `/resume` | Rendered resume + Download PDF | Far, dimmed |
| `/work` | List of all projects grouped by cluster | Far, dimmed |
| `/work/[slug]` | Full project page | Outside the globe, turned so the project's cluster faces the reader. Full scale and lifted opacity, its connected subgraph lit and the rest receded, simulation stopped. See `05-phase-2.md`'s Work-page rotate-to-top |
| `/nebula` | The graph | At the constellation's framing pose — outside it, whole composition in view. `05a-phase-2-sequence.md`'s 2.1 is the authority: "frames the whole constellation at roughly 70% of viewport height" (measured, 65%). Not *inside* it; that is where the node fly-in and hand-dollying go, below. |
| `/nebula/[slug]` | Graph with node open | Depends on how it was reached — see below |
| `/nebula/tech/[id]` | Graph with a technology node open: its blurb and every project that uses it, each linked onward | As `/nebula/[slug]`. Tech nodes have no `/work` page, so no canonical tag; without WebGL it falls back to `/work` |

`/work/[slug]` and `/nebula/[slug]` render the **same content object**. One is a document, one is a node interior. Never duplicate the prose. `/nebula/[slug]` sets a canonical link tag pointing to `/work/[slug]` to avoid duplicate-content SEO; there's no visitor-facing redirect between them under normal conditions.

The `/nebula` row read "Inside the constellation" until it was corrected. That
was a wording error, not a design that changed: the other rows in this column
say "Far", and "Inside" was written to contrast with them rather than to
specify a camera distance. Read literally it contradicts 2.1, which is the line
carrying an actual number, and which the build has always followed — the camera
rests 41.2 units from its target against a constellation bounding radius of
17.6, so it sits ~23.6 units clear of the outermost node.

Going **inside** the constellation is a thing the visitor does, not a thing the
arrival does. Three routes in: the node fly-in stops ~1.9 units off a node's
surface, well within the hull; hand-dollying reaches `DOLLY_MIN_DISTANCE` = 10,
deliberately just inside the 14-unit cluster-centroid radius so zooming reads as
flying toward a cluster; and 2.6 opens a node's interior. Arriving already
inside would spend the overview before there was any reason to explore.

The static `tech` segment wins over the dynamic `[slug]` beside it, so `/nebula/tech/csharp` can never be read as a project called "tech". Twelve of the twenty project ids differ from their slugs (`th-supervisor` is `/station-supervisor`); `lib/nebula-routes.ts` is the one mapping, both directions.

**`/nebula/[slug]` camera behavior depends on entry path**, not a single fixed state — cold entry (direct link or reload) lands already inside the node with no approach flight, exit reverses that same arrival; navigating there from within the graph plays the full approach — 650ms for a
move inside the graph, against 2000ms for the journey between the landing page
and it (`app/nebula-flight.ts`). If WebGL is unavailable or `prefers-reduced-motion` is set, `/nebula/[slug]` redirects to `/work/[slug]` instead — a graph the visitor can't move through has no advantage over the document. Full spec in `05-phase-2.md`'s Deep linking section.

Graph state resets on each visit. No persistence.

### Landing cluster placement

> **Scheduled for replacement.** `07-continuous-space.md` replaces this whole
> model: the constellation stops scaling and stops moving, and the landing view
> becomes a camera standing ~74 units away in a fixed world. The solve below
> does not disappear — it is re-expressed as camera distance and lateral offset,
> and every behaviour named here has to survive that. It is documented as it
> stands because it is what ships today, and because Part 3 needs something to
> be checked against.

The cluster's on-screen size derives from viewport **height** (the camera's
vertical FOV), while the hero's text column is a fixed ~764px wide. Those two
facts disagree on a wide, short laptop: the cluster shrinks, the column does
not, and a centred cluster lands inside the column. Measured before the fix,
with hero text covering 43% of the cluster at 1024x768 and 22% at 1100x768 —
the opposite of what 04-phase-1.md asks for.

The cluster in question is the constellation itself under
`ConstellationPlacement`'s landing transform, so these are the numbers that
transform is built from — but the arithmetic below predates that and is
unchanged by it, which is the point: the landing scale is chosen so the
projection matches.

So the centre is solved, not fixed (`lib/cluster-geometry.ts`):

- **Horizontally**, the cluster's left edge is placed just past the text
  column, and no further right than the viewport edge allows. Where a centred
  cluster already clears the column, centred wins and nothing moves — which is
  why 1920x800 and 2560x1440 are untouched. Where even the far-right position
  cannot fully clear it, it goes as far as it can.
- **The horizontal solve applies whenever the hero is a column beside the
  cluster rather than stacked above it.** Desktop width is one way to be that.
  A **short** viewport is the other: a landscape phone at 844x390 is a wide,
  short strip with a left-hand text column, and testing width alone left the
  cluster dead centre of the headline at 64% covered. Where neither holds — a
  portrait phone, an upright tablet — it stays centred.
- **Off `/`, below the desktop tier, the cluster is not drawn at all.** It is
  ambient on those routes, and at those widths the content column is nearly the
  whole viewport, so it would sit behind body prose. See 04-phase-1.md.
- **Vertically**, narrow viewports drop it below the hero text rather than
  centring it behind them, for the same reason.
- **Where the spotlight labels are drawn (`/work` and `/work/[slug]`), the
  horizontal solve centres in the space left over instead.** Clearing the text
  column is a floor, not a destination: stopping there parked the graph against
  the prose with the rest of the row empty — 188px of unused width beyond it at
  1440x900. Centred between the column's right edge and the viewport's, it sits
  in its own space. It also reserves `LABEL_OVERHANG_PX` of extra clearance,
  because the names reach past the sphere (measured 6–45px, more on smaller
  globes since the text holds a constant size while the sphere shrinks); without
  that, parallax sliding the graph across the column's edge made names vanish
  and reappear — 12 with the pointer left, 10 with it top-right at 1280x720.
  Where the leftover space is too narrow to centre in, the floor wins and the
  clamp keeps the sphere on screen: at 1024x768 that is a 196px band for a
  cluster needing 458px, so it stays hard against the right margin exactly as
  before.
- **The solved composition is damped, not switched.** Centre, vertical offset
  and scale all move together when a project is spotlit, and on `/work` that
  happens on the first hover — measured as a 191px jump of the graph in one
  frame. Damped on the turn's clock, hovering a row is one movement: the globe
  glides across and grows while it rotates to face the project. The parallax
  offset is added afterwards and keeps its own easing; damping it twice makes
  the pointer feel like it is dragging the graph through treacle. The first
  frame of a route snaps, since a cold load of `/work/[slug]` is already
  spotlit and easing in would animate a change the reader never made.

`lib/use-cluster-screen.ts` and `app/nebula-canvas.tsx` apply these from the
same functions, so the rendered cluster and every DOM overlay measured against
it (hover region, pulse ring, phrase label) cannot drift apart.

Parallax is computed only while the constellation is *in* that landing
placement. During a flight it is held at its last value and carried out
continuously by the placement interpolation, rather than being animated away
separately — and on `/nebula`, where the pointer moves constantly during a drag,
it stops writing to the store for overlays that aren't mounted.

## State

One zustand store. Context does not cross the R3F reconciler boundary reliably; this is the standard answer and it matters here because the DOM overlay and the scene talk constantly.

```ts
interface SceneState {
  focusedNodeId: string | null;
  hoveredNodeId: string | null;
  focusedNodeId: string | null;      // 2.5: the flown-to node
  focusSettled: boolean;             // has the approach flight landed
  flying: boolean;                   // is any programmatic flight running
  hoveredEdgeId: string | null;
  tourActive: boolean;
  tourIndex: number;
  pointer: { x: number; y: number };   // normalised -1..1, for parallax
  reducedMotion: boolean;

  focusNode(id: string): void;
  clearFocus(): void;
  setMode(m: SceneState['mode']): void;
}
```

`flying` is written by the same rig and read by the constellation, which
freezes the float simulation while it is true (05-phase-2.md asks for that
during *any* programmatic camera movement) and withholds hover and click, since
a raycast against a scene whose placement is mid-interpolation resolves to a
node the visitor never aimed at.

`focusSettled` is written by the camera rig, the only thing that knows when a
flight has landed. Anything that must wait for the arrival — 2.5's transmission
swap, 2.6's panel — gates on it rather than re-deriving the duration, which
would be a second copy of the flight's timing free to drift from the real one.

Node clicks push a route via `router.push('/nebula/[slug]', { scroll: false })` and **the route drives `focusedNodeId`**, never the reverse — `RouteFocus` in `nebula-canvas.tsx` is the only writer. Back and forward are correct for free. The camera rig keys its flights on the route directly rather than on the store, because the store is synced a beat after the route changes and a cold entry would otherwise read as a focus change.

Entry path is detected without any state: a panel that mounts during hydration is the cold entry, since a client navigation renders after hydration by definition (`lib/hydration.ts`). The rig sees the same thing as "first mount with a node in the URL" and settles at the focus pose instead of flying.

This section used to say route changes drove a `mode: 'distant' | 'constellation' | 'inside'`. Nothing ever did, and the field was removed: the canvas takes the route as props and derives everything else from `focusedNodeId`, so `mode` could only have been a second copy of facts already held elsewhere. Add it back when something needs a state the URL cannot express — Phase 3's guided tour and ⌘K search are the candidates, since neither changes the route.

## Content pipeline

```
content/
  clusters.ts     // cluster definitions
  tech.ts         // technology nodes
  projects.ts     // project nodes, full prose
  edges.ts        // derived + explicit edges
  layout.ts       // computed 3D positions (deterministic, seeded)
```

`layout.ts` runs a deterministic seeded layout at build time, not at runtime, and produces the **initial arrangement only**. Same seed, same starting positions, every load. It places every node on **one hollow shell** — see `05-phase-2.md`'s Layout section, which is the authority on how and why.

Never use `Math.random()` in layout. Use a seeded PRNG.

**The shell is a constraint, not just a starting point.** The runtime simulation's wander, its pair springs and hover attraction are all free 3-D displacements, so `stepSimulation` rescales each node back to its own seeded radius after applying them. That turns every one of those into motion *across* the surface: nodes drift over the sphere, and a neighbour attracted to a node arcs around toward it instead of tunnelling through the interior. Without it the middle refills within seconds and the composition is gone.

**Positions diverge after that, on purpose.** Once mounted, a runtime force simulation takes over: nodes float freely, held only by weak springs between runtime-edge pairs, so the constellation is never at rest reload-to-reload the way `layout.ts`'s output alone would be. This is a deliberate tradeoff — floating nodes read as alive in a way fixed idle-drift positions didn't — traded against the earlier "stable across reloads" goal, which no longer holds past first paint. The seeded layout still guarantees the composition that matters (SEL clusters in the front hemisphere, nothing overlapping at the default heading); only the fine position of each node past that point is allowed to vary. See `05-phase-2.md`'s Nodes section for the simulation's mechanics and freeze rule.

## Scene fog

> **Fog is currently inert, and has been since the camera moved inside the
> shell.** Every node on every route now sits within 28 units, and the band
> starts at 55. This section describes what fog is *for*, which is still true
> and is why `07-continuous-space.md` needs it; it does not describe anything
> visible today. Measured, with motion frozen so only the fog differs: moving
> the band from 27–48 to 55–130 changes 0 pixels of 67,102 with ink on a work
> page, 0 of 42,576 on the landing page, 0 of 66,315 inside the graph. Bringing
> it in to 5–30 changes 13.8%, 17.0% and 71.4% of those — so the wiring works,
> it simply has nothing in range.

Fog matched to `--paper` is the primary depth cue in the constellation — it's what makes distant clusters recede instead of just getting smaller. `<fog attach="fog" args={[palette.paper, FOG_NEAR, FOG_FAR]} />`, wired into the fresnel shader by hand (`ShaderMaterial` doesn't pick up scene fog automatically — the fog chunks and uniforms have to be included explicitly).

**`FOG_FAR` must track real measured scene depth, not an estimate.** Depth varies with the camera heading and the actual computed layout, not some assumed constellation radius — measure per-node camera-space depth from the real camera position against the real `layout.ts` output, then set `FOG_FAR` just past the true max. Guessing too far means the falloff curve never gets close to completing and the farthest cluster barely fades; guessing too near erases nodes that should still read. `FOG_NEAR` can stay conservative — it only has to sit in front of the nearest node.

**And it must track the framing that actually ships.** The band this replaced was measured correctly against an *outside* view of the constellation, nodes spanning depth 20.1 to 42.5 — and then `/nebula` moved inside the shell and nobody re-measured. Inert fog and absent fog look identical, so it went unnoticed until the distances were recomputed for `07-continuous-space.md`. A depth cue tuned against a composition that has been replaced is not a depth cue.

## Performance budget

- **Do not use `MeshPhysicalMaterial` with `transmission` on more than 2 nodes.** Each transmissive mesh triggers an additional scene render pass. Default node material is a custom fresnel shader — a rim-lit translucent sphere with a soft inner core. Real transmission is reserved for the focused node only, on desktop, after the fly-in completes. See Responsive tiers below — tablet and mobile never use it.
- Background particles: one `InstancedMesh` per tier, positions computed once, drift applied in the vertex shader — not per-instance on the CPU. Instance count varies by device tier — see Responsive tiers below, not a fixed number here.
- Edges: batch into as few draw calls as possible. Drei's `QuadraticBezierLine` is fine for the ~40 production edges; technology edges (potentially 100+) should be a single `LineSegments` with a custom shader.
- Target: 60fps desktop, 30fps mid-range mobile. Measure before adding postprocessing.
- Cap `dpr` at `[1, 2]`.

## Responsive tiers

`/nebula` is a fixed, non-scrolling, full-viewport canvas, so drag-to-rotate has no page scroll to conflict with. Scrolling happens only inside an opened node panel.

**This table is the single authority for tier-specific behavior.** Particle counts, transmission policy, tech node visibility, navigation model, and panel sizing are defined here once. Other docs (`05-phase-2.md`, `06-phase-3.md`) reference it by tier name rather than restating values — if a tier value needs to change, this is the only table to edit.

| | Desktop — 1024px+ | Tablet — 768–1024px | Mobile — under 768px |
|---|---|---|---|
| Tech nodes | Always visible | Visible, reduced opacity, toggleable | Hidden by default, toggleable |
| Transmission | **None, on any tier — see below.** The focused node's shell is a `--mask` `MeshPhysicalMaterial` with transmission off | None | None |
| Particle count | ~600 | 350 | 200 |
| Interaction | `CameraControls`: drag to rotate, scroll to dolly. Hover to preview, click to open. | Drag-to-rotate. The mobile tier's bottom sheet is also available, as a toggle rather than always-present. | Persistent bottom sheet is the primary navigation; the 3D is ambient. Tap to select, tap again to open. |
| Interior panel size | 70% of viewport | 85% of viewport | 85% of viewport — no separate mobile value has been specified; inherits the tablet override |

**Real transmission was removed from every tier**, having been desktop-only before. It cannot work in this scene: the canvas is `alpha: true` over the page's `--paper` background, so the paper is CSS *behind* a transparent canvas and is not in the WebGL scene — transmission had nothing to transmit. It looked correct on the focused sphere only because a thick, short attenuation distance tinted the result `--mask` whatever lay behind it. The moment the shell flattened into a panel and cleared for legibility that tint went, the empty backdrop came through, and the opened node rendered as a bright white plate over the paper — the one colour not in the palette. Moving the camera inside the shell made it worse, since a focused node's backdrop is now mostly nothing.

The performance budget's cap on transmissive meshes therefore no longer binds anything, and the two lights added for that material now light the shell that replaced it. Giving the scene an opaque backdrop would make transmission workable again, but that is a change to how the canvas composites over the page rather than a material swap.

### Orientation and short viewports

Under 500px of viewport height, in any tier: the node interior panel becomes a full-height sheet instead of a centered masked panel, with no circular-to-rounded-rect morph. There's no room for the morph to read at that height.

Height, not width, is the trigger — this covers landscape phones (e.g. 844×390) as much as any tier boundary above.

## Analytics

`@vercel/analytics` plus custom events: `node_opened` (with slug), `tour_started`, `tour_completed`, `resume_downloaded`, `nebula_entered`. This answers whether anyone actually explores, which determines whether Phase 3 is worth building.
