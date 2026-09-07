# Phase 2 — the Nebula

Estimated 25–35 hours. Turns the background cluster into a real graph.

## Layout

Deterministic and seeded — this produces the initial arrangement only. Same seed, same starting positions, every load; the runtime force simulation (see Nodes below) then takes over and positions diverge from there. See `02-architecture.md`'s Content pipeline section for that tradeoff.

**The constellation is a hollow sphere.** Every node, project and technology alike, sits on one shell at ~16 units, give or take ~1.2 of radial thickness. Nothing is inside it. This is an information-design rule before it is a look: on a single surface nothing can hide behind anything else, so the graph has no bad angle — and it gives `/nebula` an interior worth flying into and `/work/[slug]` an exterior worth rotating.

1. Place cluster centroids on a Fibonacci sphere at the shell radius, ordered by `Cluster.order` so SEL work occupies the front hemisphere at the default camera heading.
2. Within each cluster, place project nodes as a **patch on the surface**: local offsets laid out in the tangent plane at the centroid, with only a fraction of the third component becoming radial thickness.
3. Technology nodes sit on the **same** shell, biased toward the projects that use them. The bias decides a *direction*, never a radius — it is projected back onto the surface, so a technology shared across many clusters keeps its Fibonacci slot rather than collapsing to the middle.
4. One relaxation pass over all 45 nodes together, re-projecting to the shell each iteration so the repulsion stays tangential. Per-cluster relaxation is not enough: on one surface a technology pulled toward a popular cluster lands on top of the projects that attracted it.
5. Cache the result. Run once at build, not on mount.

This replaced a filled ball, where technology nodes were placed as `shell · 0.3 + averageOfUsers · 0.7` and the average of positions spread over a sphere lands near its centre. Measured on that layout: tech averaged r = 9.2 against a nominal shell of 20, TypeScript sat at r = 1.8, and ten of forty-five nodes were inside r = 8 — the middle was full of exactly what a visitor most wants to see.

## Nodes

**Project nodes.** `major` radius 0.85, `standard` radius 0.6. Fresnel glass shader — translucent rim, soft falloff, subtly non-spherical (low-frequency vertex displacement so the silhouette breathes). A three-way **category** — professional / personal / tech — drives an inner core. This is purely a professional-vs-personal split, not an ownership or authorship signal. Professional project nodes (the four SEL clusters plus the METER internship — see `content/index.ts`'s `professionalClusterIds` for the exhaustive set) carry a large translucent core, ~80% of the shell's radius, in `--mask` at ~20–25% opacity: a wash of color visible through the shell rather than a solid object. Personal and client-work nodes are fully hollow at the same shell size.

**Technology nodes.** Radius 0.34. Hollow, no core, lower opacity.

**Hover.** Scale to 1.15, raise opacity, brighten every connected edge. The node's `title` — not `oneLine`, which is reserved for the 2.6 interior panel — fades in centered inside the shell, sized via `Html`'s `distanceFactor` so it scales with the node's screen size and camera distance, the same "content lives in 3D space" technique the 2.6 panel needs. Animated with a real underdamped spring, not a flat fade or instant toggle, so it pops in and settles; the same spring mirrors on dismissal. One node at a time.

Also attracts: every node connected to the hovered one is pulled toward it for as long as the hover holds, and released back into the simulation on hover-out — see Motion below for the per-node personality variation on this spring.

**Motion.** Nodes float freely in a lightweight runtime force simulation rather than sitting at fixed positions with idle drift — `layout.ts` supplies the initial arrangement only. Weak springs hold runtime-edge-connected pairs loosely together; everything else wanders via non-repeating value noise, not summed sines — periodic drift reads as mechanical within a cycle or two, however many are layered. The simulation freezes completely during any programmatic camera movement — fly-in focus, the Phase 3 guided tour, ⌘K search — not just while a node is hovered, so nodes hold still while the camera is doing the moving. It resumes when that movement ends.

**Attraction personality.** The hover-attraction spring is not uniform across nodes: each node's damping ratio, natural frequency, and pull strength are drawn from an independent per-node seed at module load, before any hover target is known, so several simultaneous attractions read as varied and organic rather than synchronized. **Distance to the attraction target must never become a deliberate input to these parameters** — any apparent correlation between distance and spring behavior has to be incidental to the seeding, never a designed relationship, or the personality system regresses into something that just re-describes proximity.

## Edges

Per `03-content-model.md`. Runtime edges are `QuadraticBezierLine`, `--ink` at 52% and 1.9px wide, with an amber pulse traveling a ~4s loop. Shared-tech edges are a single batched `LineSegments`, `--ink-faint` at 45%, static.

Those opacities started at 40% and 20% and measured too faint on a real screen — at 1440x900 only two or three runtime edges registered and the shared-tech layer was effectively invisible, worst in the far half where scene fog is already pulling everything toward paper. The original figures were picked against a still with no fog behind them. The ratio between the two is not preserved on purpose: `LineBasicMaterial.linewidth` is ignored by WebGL, so the batched hairlines can only be lifted by opacity while runtime edges can be lifted by width. The hierarchy the design depends on now lives in colour and width — a runtime edge sits ~110 luminance below paper against a hairline's ~35 — which is what 2.3's done-when is actually about.

**Edges follow the surface**, rather than chording through the hollow interior. Runtime and dev-time edges are quadratic Beziers whose control point is solved so the curve's midpoint lands exactly on the shell — `shell · (2 − cos(θ/2))` along the outward axis, where θ is the pair's angular separation. A fixed outward bulge cannot do this: the push needed grows from almost nothing for neighbours to half the chord for antipodes. The shared-tech batch is interpolated spherically into ten pieces per edge, which puts it on the surface exactly and still costs one draw call.

Undirected — no arrowheads.

Hovering a runtime edge shows a small DOM tooltip with `protocol` and `detail`. This is where "event-driven architecture," the TCP reconnect/backoff/heartbeat work, and the safe-stop error path live.

## Cluster labels

Faint Geist Sans labels at each cluster centroid, `--ink-faint`, opacity scaling with camera proximity — invisible from far away, legible when you're near. Text is `Cluster.label`, with `Cluster.context` on a second line at smaller size.

## Camera and focus

`CameraControls` from drei. Drag to rotate, scroll to dolly within a clamped range.

**`/nebula` is inside the globe.** The camera rests at half the shell radius, on the opposite side of the middle from the front hemisphere, looking back across it — so the SEL clusters are what you face on arrival and dragging sweeps the far surface past you while the near shell swings in behind. Both dolly clamps keep the camera within the shell; leaving it is not something hand-dollying may do on this route.

Three numbers, each measured against the real layout rather than chosen:

- **Not dead centre.** From the exact middle every node is equidistant, so nothing varies in size and fog has nothing to grade. Worse, sampling 400 headings put the tenth percentile at *zero nodes in frame* at 50° fov. At half the shell radius the same sampling never drops below eleven and averages sixteen.
- **Field of view is the only lever that changes how many nodes are in frame.** Shrinking the shell makes each node bigger but moves none into view — angular position is scale-invariant. 50° gives seven nodes, 75° thirteen, 90° sixteen.
- **72°, not 90°.** three.js measures fov vertically and a wide screen multiplies it: 90 vertical is 116 horizontal, at which spheres near the frame edge stretch into visible ellipses. 72 is ~99 horizontal.

Focus narrows back to 50° — a node approached at 72 sits in too much periphery — so the widening and narrowing become part of entering and reading.

**Fly-in.** Clicking a node interpolates the camera along the surface normal at that node — the vector from the constellation's geometric centre, the origin, through the node — stopping just short of the surface **on the inner side** and looking outward at it. Inner because `/nebula` is a place you are inside: stopping beyond the node would punch the camera out through the shell and leave it hanging outside the globe. It frames better too, since the backdrop is then open paper and the node's own neighbours rather than the entire rest of the constellation. 1400ms, `cubic-bezier(0.32, 0.72, 0, 1)`. **Never fly to the node's exact position** — that clips through the geometry.

Simultaneously: `router.push('/nebula/[slug]', { scroll: false })`, the float simulation freezes, unrelated nodes drop to 25% opacity. Whether the focused node's material switches to real transmission is tier-dependent — see `02-architecture.md`'s Responsive tiers table. Desktop only; tablet and mobile keep the fresnel shader throughout.

**The interior panel — the node itself opens.** There is one object, not two: the node's own mesh turns to face the camera, scales to the panel's rectangle, and reshapes from sphere toward rounded box through a `uOpen` uniform in its own material. It keeps the `--mask` colour it had as a sphere, and the panel's text simply appears across it. The DOM panel has no background, border or shadow of its own — the surface under the text *is* the node.

This replaced a version that used a second mesh, and the difference is the whole point. There, the node faded out, a separate shell faded in and morphed, and that faded out too leaving a DOM card: three objects in sequence, so opening a node read as a new object arriving rather than as the node opening. By the time there was anything to read, the node was gone.

The fresnel material does the work a card would have done: near-transparent across the face, so text sits on `--paper` and stays legible, and gathering to a soft `--mask` rim exactly where the edge is. Measured across an opened panel, alpha runs 0.10 at the centre to 0.42 at the rim — the same falloff the node has as a sphere.

That gradient has to be recovered deliberately, because flattening destroys it. The normal matrix is an inverse-transpose, so squashing a sphere toward the camera makes every normal point at the viewer and the fresnel term collapses into one flat wash — which is what made an opened node read as a slab of colour rather than the translucent thing it had been. The shape still knows where its own edge is, though: the mesh faces the camera when it opens, so the sphere's own `z` runs along the view axis, and `1 − |z|` is 0 at the centre of the face and 1 all the way around the outline. The gradient comes from geometry the flattening cannot touch.

**It keeps breathing while open, and should.** An opened node is still a node: its outline goes on drifting rather than settling into a drawn rectangle. The displacement rides the mesh's own non-uniform scale, so a wobble that is a few percent of a sphere's radius stays a few percent of the opened panel's width — the same amount of life at either size.

Two consequences worth knowing. The shared sphere geometry went from 32 to 48 segments: a sphere needs only enough to look round, but the same vertices must describe a superellipsoid's far tighter corners when a node opens, and at 32 they creased. And under 500px of viewport height, where the node deliberately does not open, the full-height sheet has no node behind it and so does carry its own `--paper` background.

The shell expands and drops toward near-full transparency; see `02-architecture.md`'s Responsive tiers table for exact panel size per device. The silhouette morphs from a wobbling sphere toward a rounded rectangle as it opens — the rim stays curved and glassy, but the content area becomes honest about being a panel, because circular content areas fight lists, code, and links.

Under 500px of viewport height, in any tier, this morph doesn't happen at all: the panel is a full-height sheet instead, with no circular-to-rounded-rect transition. See `02-architecture.md`'s Orientation and short viewports.

DOM content is revealed **by the node opening**, inside the shell's screen-space bounds, rendered with `motion`. Real HTML: selectable, scrollable, keyboard-accessible, crawlable.

**The scroll indicator is painted by the node, onto its own rim.** The native bar is hidden and the shader draws the thumb, from the position the panel publishes in `lib/focus-scroll.ts`.

It has to be drawn there rather than laid over the top, and the reason is occlusion. DOM always paints above the canvas, so a thumb positioned against the panel's edge has no way to go *behind* the node: when the breathing outline wanders inward past it — and it does, since the wobble is a few percent of the panel's width — the thumb is left hanging outside the shape. Painted onto the rim it **is** the wall. It moves with the breathing, and wherever the wall turns away it simply stops being drawn.

The strip is measured along the shaped x rather than along the rim term. Flattening collapses the whole front hemisphere onto the plate, so the rim occupies almost no screen pixels: gating on it gave either a sliver too thin to see or, opened up, a wash across the entire right-hand side. Shaped x maps linearly to screen x once the node faces the camera, so `smoothstep(0.955, 0.995)` is a strip of predictable width — about 4% of the half-width — hugging the outline and fading inward. It bounds itself vertically for free, since on a superellipsoid the edge only reaches x = 1 near the middle of the height and falls to 0.88 by |y| = 0.9, so the mark stops before the corners.

Under 500px of viewport height the node deliberately does not open, so there is no wall to paint on; the sheet has its own rectangular paper surface and takes an ordinary DOM edge indicator instead. Either way the scroll container keeps a tab stop, so arrow keys still scroll it exactly as the native bar would have. Contains exactly what `/work/[slug]` contains, from the same content object.

The article is always laid out at its final size, so text never reflows; a `clip-path` reveals it, starting as a circle exactly the size of the focused node's silhouette and stretching to the panel's rounded rectangle. Because the camera stops at a fixed standoff, that circle is already ~70% of viewport height for a major project node and ~53% for a standard one, so the motion is mostly a **horizontal stretch** — the node pulling open sideways to show its inside, rather than a new screen arriving over the graph. A technology node starts at ~35% and stretches further, which is right: it is a smaller thing opening.

Two beats, matching the shell behind it: the content fades up inside the closed circle while the shell arrives, then the clip opens as the shell morphs. `lib/focus-framing.ts` holds the geometry all three share.

**The shell opens on every tier, with one material.** The tier table gated transmission, not the morph — tablet and mobile get an 85% panel and need the same silhouette behind it — and transmission has since been removed from every tier (see 02-architecture.md), because a transparent canvas over a CSS background gives it nothing to transmit and the opened shell rendered white. The shell is a `--mask` `MeshPhysicalMaterial` with transmission off: the colour the node already is, arriving as a soft form, morphing, then fading out and handing its edge to the panel's own rim so the opened node keeps the node's colour rather than becoming a new object.

**Sideways navigation runs through the panel's own links.** A project's technology list links into each technology's node, and a technology lists every project that uses it; clicking one flies directly there without returning to the constellation first.

Those links must be `next/link`, not plain anchors. A document navigation reloads the app, remounts the canvas, and turns the flight into a cold landing with no movement at all — which is exactly what it did until it was caught.

**The flight follows the surface**, not a straight line (`shellLerpPose`). Both ends sit just inside the shell, so a chord between them cuts through the hollow middle the layout exists to keep empty. Measured on real pairs, `th-supervisor` to `this-site` is 133° apart and a straight interpolation dips to 3.32 from the centre — a third of the way in — where slerping holds at 8.22. Nearby pairs barely differ, so this only matters for the long links, which the technology panels produce constantly. It is also the same great circle the edge between the two nodes is drawn on, so the trip reads as travelling along the connection because geometrically it is. **The edge being travelled lights up** for the duration, in both edge populations.

This section used to ask instead for connected nodes to remain visible past the panel edges, hoverable and clickable. That is not achievable at this framing, and the deviation is deliberate: the camera stops 2.75 units from a node on a shell of radius 11, so the nearest other node is a median of 50° off the view axis against a 36.7° horizontal half-angle, and only 8 of 45 focus poses have any node in frame at all — all of them behind the panel. Pulling back far enough to fix it would shrink the node to about a third of the frame and break the relationship where it opens *into* the panel. The panel's links do the same job, labelled and keyboard-reachable, which the 3-D version never was.

**Exit.** A close control and `Escape` both return to the constellation. `router.push('/nebula')` — both go through the route, because the route is what clears focus. The float simulation resumes.

**Technology nodes open too**, at `/nebula/tech/[id]`: the blurb, and every project that uses the technology grouped by cluster, each linked to its own node. There is no `/work` counterpart, so it is the one place a technology is read — and it is the "follow C# out of a project and see everything else written in it" move that makes sideways navigation mean something. The project panel's technology line links into it.

## Work-page rotate-to-top

On `/work/[slug]` the globe is seen **from outside** — the counterpart to `/nebula`, where you are inside it — and it **turns so the project's cluster faces the reader**, as if looking at the earth from above. Its connected subgraph stays lit and everything else recedes to a quarter of its own opacity. It settles once and the simulation stops completely: no ongoing motion or GPU cost beside the body text, and drifting nodes behind prose are the texture-behind-reading-text problem the ambient rules exist to avoid anyway. Under `prefers-reduced-motion` it renders already-turned, with no animation.

**Turning, not gathering.** This section previously asked for the connected subgraph to *gather* toward a focal point using the hover attraction. Turning the whole sphere is better: gathering moves the nodes, so a cluster is somewhere different on every page, while a rotation preserves the layout and leaves each cluster in the same place relative to its neighbours. The geography becomes learnable across pages instead of rearranged on each one.

The node is aimed at its seeded layout position rather than its live wandering one, so the target does not drift while the turn is converging, and the orientation is eased per-frame rather than run over a fixed duration — it has to survive being re-aimed mid-turn when the reader moves to another project, which a timed curve would have to restart.

**The facing direction tops the globe rather than centring it.** Mostly toward the viewer put the project dead centre of the disc, which reads as facing, not topping; it is high on the sphere and tilted forward instead.

**The roll has to be solved, not left to fall out.** `setFromUnitVectors` gives the shortest rotation carrying the node onto that direction: it fixes where the node lands and says nothing about the twist around it, so the surrounding cluster arrived somewhere different on every project — sometimes below the node, sometimes behind it — and the graph read as re-shuffling rather than turning. After the facing rotation, the layout's own up axis is rolled about that axis until it is as near screen-up as it can be, making the orientation a function of the chosen node and nothing else.

**And the turn must be exactly undone by the time the reader is inside.** `/nebula`'s heading was chosen against the layout's own orientation — the one keeping all four SEL centroids front-facing and the seven centroids furthest apart in screen space — so arriving with the globe still turned for some work page puts every cluster where that composition does not expect it. The rotation is therefore tied to the placement rather than eased separately: at placement 1 the orientation is exactly the layout's, whatever the reader came from, and a departure winds it back up in step. Verified with motion frozen, a client route from a turned work page through the landing page into `/nebula` lands pixel-identical to arriving directly — 0 differing pixels of 59,223 of ink.

**The list previews it.** Hovering a row in `/work` — or tabbing to it, so a keyboard reader gets the same thing — starts the globe turning toward that project, so the list shows where each entry sits and the turn is already half-made by the time the reader arrives. The route wins over the preview once they do.

**Nothing is cleared on hover-out**, and that is the difference between reading as a turn and reading as a jitter: clearing aimed the globe back at the layout's own orientation in the gap between one row and the next, so scanning the list made it lurch toward neutral and reverse for every row crossed. The last previewed node is held instead, so moving down the list is one continuous re-aim. The preview is confined to `/work`, or the last row touched would follow the reader onto `/about`.

**Turning and gathering are split.** Only the route gathers; a hovered row only turns. The turn is cheap to redo and previews well, but the gather is a spring with a tenth-of-a-second time constant, and re-aiming that at every row a reader crosses makes the graph snap rather than move. Measured: hovering a row changes 8.5k pixels of the graph region against idle, and two different rows differ from each other by 9.9k.

**A spotlit page draws its subgraph in**, using 2.3a's attraction — the "gathering" this section originally asked for, kept alongside the turn rather than instead of it, because turning alone left the subgraph as sparse as the rest of the shell and gave the eye nothing to land on. **It gathers to a ring, not by a fraction.** Hover's attraction moves each neighbour a share of *its own* separation, which preserves whatever spread the nodes started with — so a node already beside the subject ended up almost inside it while one across the globe was still across the globe, and the group read as lopsided rather than assembled. Gathering to a radius gives every neighbour the same destination distance, keeping only the direction it came from. It is blended at 0.8 rather than absolute, so the original arrangement still shows through and the ring does not read as a dial.

Measured on `solder-driver`'s eleven neighbours, distance from it: 2.8–16.1 before (sd 4.67), 1.5–8.8 under the fractional pull (sd 2.57), and 3.3–5.9 gathered to a ring (sd 0.93). The minimum is what matters as much as the spread — the fractional pull put the nearest neighbours 1.1 to 1.5 units away, and node radii reach 0.85.

It works despite the freeze, and not by accident of ordering: freezing holds the *wander* clock still while the attraction springs integrate against real delta time. So the neighbours slide in and everything else stays exactly where it was — which is the "settles once, then stops" this section asks for, rather than a page of drifting nodes behind prose.

**A spotlit page draws that project's connections**, and only those. The whole edge population would be wrong beside prose — a hundred-plus shared-tech hairlines over an article is a texture, not information — so `Edges` takes a `subgraphOf` and renders what touches the node. Those edges also need their own weight: everywhere else the layer is scaled by the constellation's placement so it fades out with the departure flight, but a work page sits at the landing placement where that value is zero, and the subgraph would be drawn perfectly and invisibly.

**A spotlit page sits between ambient and subject.** It keeps full scale, like `/`, rather than the 0.7 every other non-landing route gets, and its opacity is lifted from 0.35 to 0.55 — the graph is doing a job there, and the turn has to be large enough to read as a turn. It stays well below the landing page's weight, since the prose is still what is being read. Below the desktop tier it is not drawn at all, as everywhere else off `/`.

## Deep linking

`/nebula/[slug]` behaves differently depending on how it's reached:

- **Cold entry** (a direct link or a reload): no approach flight. The page lands already inside the node — shell expanded, panel open, content visible at first paint, constellation visible around it. On exit, the camera pulls back and the shell contracts, revealing the constellation — the arrival experience, played in reverse.
- **Reached by navigating within the graph** (clicking a node from `/nebula` or sideways from another open node): the full 1400ms approach flight, as specified above.

`/nebula/[slug]` sets a canonical link tag pointing to `/work/[slug]` — the same prose exists at both URLs, and this is what prevents the duplication from being a duplicate-content SEO problem. There is no visitor-facing redirect between them under normal conditions.

If WebGL is unavailable, or `prefers-reduced-motion` is set, `/nebula/[slug]` redirects to `/work/[slug]` (and `/nebula/tech/[id]` to `/work`) instead — a graph the visitor can't move through has no advantage over the document, and cold-entry's "already inside" state has nothing to animate out of on exit if it can't animate in the first place. Reduced-motion needs no special case for the cold-entry path beyond this redirect: it was already static-on-load, so there's nothing further to disable.

## Device tiers

Tier-specific behavior (particle counts, transmission policy, tech node visibility, navigation model, panel sizing) is defined once, in `02-architecture.md`'s Responsive tiers table. This section doesn't restate it.

## Accessibility

- Every node is a focusable element in a hidden-but-present DOM list mirroring the graph. Tab moves through it, Enter opens.
- A visible "View as list" link is always present in the corner, going to `/work`.
- Under `prefers-reduced-motion`: the float simulation renders frozen at the seeded initial layout, the work-page gathering renders already-settled, no pulses, and camera flights become instant cuts.

## Done when

A visitor can enter the nebula, trace the scanner → board data service → solder driver chain by hovering the edges, open any node, read the full project, and jump sideways to a connected one — and a keyboard-only visitor can do all of it too.
