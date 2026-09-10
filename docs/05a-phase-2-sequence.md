# Phase 2 — build sequence

## Session status (update each session)

**Where the work is: branch `continuous-space`, 72 commits past `main`.** Not
`nebulustest`, which this block named for several sessions after it stopped
being true.

Last completed in *this* sequence: **2.6** (interior panel and routing), on top
of **2.5** and the **Phase 1 landing page**. Since then the branch has done
**Parts 1, 2 and 3 of `07-continuous-space.md`** — the fog, the hero as an
object in the world, and the fixed life-size world with the camera solved per
route — and then three things that follow from Part 3 rather than from this
sequence: the **`STANDING_FOV` dial turned to 30**, with every distance derived
from it in `lib/world-scale.ts`; the **arrival re-measured**, because the
interior pose put the reader 3.20 units from the centre looking at a flat wall
of nodes with nothing inside 10 units; the **departure made visible**, which was
never a camera problem — the flight was correct and the destination page painted
over it 190ms in; the **flight path re-weighted**, because distance and direction
were sharing a clock and the graph took a 262px detour across the frame on the
way in and out; and the **arrival moved in from 9 units to 5.5**, which was two
complaints with one cause — stopping at the shell wall left the reader
off-centre (lopsidedness 7.2, six nodes behind them) *and* short-changed the
flight (5.3x apparent growth instead of 8.7x).

Then a content pass corrected the project write-ups against what the services
actually do, which added six technology nodes (MQTT, Three.js, Material UI,
MudBlazor, TanStack Query, React Router) and **re-laid out the constellation** —
`content/layout.ts` sizes the technology shell by `tech.length` — so the
interior pose had to be searched again against the moved graph. **Read the
constraints in `app/nebula-canvas.tsx` before re-running that search**: four
runs each optimised what they were told to and missed something they were not,
the last one landing an arrival that faced the personal cluster rather than the
production work the site exists to show. Two projects
were renamed with 301s on the old slugs, and the downloadable resume was
replaced.

**Part 4 (the approach and the string) is next**, and it is the part that
decides how `/work/[slug]` stands and where the home standing point is. Read 07
before 05a's remaining items: it changed what they sit on.

Still outstanding from this document: **a preview deploy — 05a asks for one
after 2.6, and the owner runs `npx vercel` themselves**; 2.7; 2.8; the mobile
pass; and the background particle field, which was designed and never built.

**The measurements are in `checks/`** as of Part 3, with a README. Before
believing any number in these docs, that is where it came from and how to
re-run it.

**2.6 as built.** The URL is the source of truth for focus: node clicks push
`/nebula/[slug]` or `/nebula/tech/[id]`, `RouteFocus` syncs the store from the
route, and the camera rig keys its flights on the route. Cold entry settles at
the focus pose with the panel server-rendered at full opacity; navigation flies
and fades the panel in on `focusSettled`; the two are told apart by whether the
panel mounted during hydration (`lib/hydration.ts`). The panel is real DOM,
sized by CSS from the tier table, a full-height sheet under 500px. The glass
opens in a second 240ms beat after it arrives: a morph target on the sphere
(superellipsoid, n=6) scaled to the panel's rectangle at the node's depth,
turned to face the camera, tint dropped to 12%. Tech nodes got a route and a
panel — the owner's call, over hover-only — listing every project that uses
them. Escape moved out of the canvas to the close control, because the router
is unreachable from inside R3F's reconciler.

Verified, 23 checks at 1280x800 plus 844x390, 900x700 and 390x844: prose in
the server HTML with the canonical tag; cold-entry panel at opacity 1 before
and after settle; Escape → `/nebula`; back and forward restore the node and
the graph; in-graph click pushes a route with the panel hidden during the
flight and visible after; sideways project → tech → project through panel
links; reduced motion redirects both routes to the document; panel measures
70%/85%/100% by tier and height; unknown slug 404s; no console errors; no
hydration warnings on any new route. Measured, the landing is two beats after
the flight: ~20% of pixels for two frames as the glass arrives, ~13% for three
as it opens, then 0.03%.

**Two 2.6 defects fixed later, during the globe work.** The shell only opened
on desktop, because the opening was built inside the transmission branch — so
below desktop a focused node stayed a sphere behind the prose, which got worse
once focus began approaching from inside the shell. And the panel arrived at
its final size whatever the shell was doing, which read as a new screen rather
than the node opening; it is now revealed by a clip-path stretching from the
node's own silhouette. Cold entry snaps both to open, as 05-phase-2.md always
asked.

**Three traps 2.6 hit, for 2.7.** A mesh whose geometry carries morph
attributes must have `updateMorphTargets()` called after R3F attaches the
geometry, or the renderer reads an undefined influences array on the first
frame and the whole loop dies — silently, on desktop only, with the panel
looking fine over a blank canvas. A "first mount" flag must be set by
something mounted on every route, not by the component that needs it:
opening a node from bare `/nebula` mounted the first panel the document had
ever had, which read as cold. And a full-viewport sheet paints over corner
chrome that is earlier in the DOM; the corners need their own stacking order.

**A re-foundation is now planned, and it changes what 2.7 and 2.8 sit on.**
`07-continuous-space.md` replaces the placement model this whole sequence is
built over: the constellation stops scaling, the home page becomes an object in
the world, and `/`, `/work/[slug]` and `/nebula` become three places to stand
rather than three transforms of one object. It deletes several mechanisms this
document describes as load-bearing — the rotation unwind, the centring spring,
the split between flight durations — and it is where the remaining 2.6 gap
belongs too: connected nodes are not reachable past the panel edges on every
project (measured, 0 of 717 sampled points on two of them) because the focus
pose frames a small cap of a shell, which is a composition question that the
fixed world re-opens. Sequence it against 2.7 deliberately; building the
information layer twice would be the avoidable mistake.

**Both of this block's open items are now closed.** The `/work/[slug]`
gathering is built — neighbours gather to a ring at `GATHER_RADIUS`, strangers
inside it are pushed out to `CLEAR_RADIUS`. And leaving `/nebula/[slug]`
straight to `/` is a flight rather than a cut: `clearFocus` closes the shell
while a single departure carries the camera out, starting from the
camera's own FOV rather than the graph's, which is what made the exit worth
cutting before — assuming `INSIDE_CAMERA_FOV` opened it by snapping 22 degrees
wider.

**Two behaviours were built and deleted in the landing-page work, deliberately.**
A phrase nudge and a shader sheen driven by `deviceorientation`. They were not a
mistake and not a violation — neither moved the scene, so 01-design-system.md's
prohibition on device-orientation *parallax* was never in play. They went
because they were the one piece that could not be verified without real
hardware, and the owner did not want the sensor. **Do not rediscover the idea as
new.** All movement on touch comes from the drag instead. Anything else
sensor- or hardware-specific deserves the owner's eyes on a real device, not an
agent's headless browser.

**2.5's arrival was rebuilt after it shipped.** As first built, the landing page
drew a separate 40-sphere decorative cluster and `/nebula` swapped it for the
real graph on the route change, so clicking the cluster destroyed the thing you
clicked, cut the camera 64 units and 94 degrees to a synthesised pose outside
the constellation, and flew 18.5 units from there — a cut three and a half times
longer than the flight after it. The persistent canvas was buying nothing.

There is now one constellation on every route, under a placement transform, and
the arrival starts at the landing page's own camera pose. 02-architecture.md's
persistent-canvas section is the authority on the shape of it; three things it
records are worth knowing before touching this again:

- **The placement belongs to the camera rig, not the route.** Derived from the
  route, it went life-size on the commit while the camera was still at the
  landing pose — which sits *inside* a life-size constellation. Every navigation
  slow enough to put a frame between commit and effect painted the graph from
  the inside first. Captured at 900x600 under software GL.
- **There is one camera rig now**, mounted everywhere, because leaving
  `/nebula` has to be a flight too and the rig that drives it can't be the one
  that unmounts on the way out.
- **The arrival path is an orbit interpolation.** A straight line between the
  two poses passes closer to the subject than it started.

Measured after the rebuild, at 900x600: entering, the constellation's projected
spread grows monotonically from 69.8px to 140px with no frame from inside the
graph; leaving, it shrinks back to 69.9px and is dead steady from 1550ms, with
no step in the pixel count where the edge layer unmounts. Reduced motion is an
instant cut in both directions, verified at 120ms after the click. Focus,
transmission swap, and Escape all still behave as below.

**A residual worth not re-investigating:** measuring the landing page by pixel
mask picks up the affordance's idle pulse ring, a DOM element, which contracts
and fades on a several-second loop. It looks exactly like the constellation
still shrinking for a second after the flight lands. It isn't.

Clicking a node flies the camera along the vector from the
constellation's centre through that node, stopping outside its surface and
looking back at it — never at the node's own position, which would put the
camera inside the shell. 650ms on 01-design-system.md's standard curve, driven
by hand rather than by camera-controls' `enableTransition`, because that
smooths exponentially with no fixed duration and the spec asks for a specific
curve over a specific time. The dolly clamp lifts for the flight; with it live,
camera-controls drags the camera back out mid-flight and the arrival never
lands. It is off on the Phase 1 routes too, now that `CameraControls` is mounted
on all of them: the landing pose sits 9 units from its target, inside
`DOLLY_MIN_DISTANCE`, so a live clamp would quietly pull the camera out of the
framing the whole landing page is composed against. On focus the simulation freezes (2.3a's hook), unrelated nodes drop to
25% of their own base opacity, and on desktop only the focused node swaps to
real transmission once the flight has landed. Escape and a close control both
leave. Reduced motion makes flights instant cuts.

Measured, after the arrival flinch below was fixed — these supersede an
earlier set taken while that bug was still present:

- **Node fly-in:** frame-to-frame change decays 31% -> 25 -> 17 -> 9 -> 2.9 ->
  0.78%, then holds at 0.3-0.85%. The shells still breathe at rest, which is
  correct — only the float simulation freezes.
- **Exit:** decays to 0.03% at 1648ms, then rises gently to 0.15% as the wander
  restarts. A clean resume, with no jump at the hand-off.
- **Reduced motion:** exactly one frame of change, then exactly 0.00% for every
  frame after. Both directions.
- **Landing arrival:** projected spread grows monotonically 69.8 -> 140px with
  no frame from inside the graph; leaving returns it to 69.9px, steady from
  1550ms.

**The arrival flinch, and why it was not what it looked like.** A 30%-of-pixels
single-frame change at the moment the fly-in landed looked like the transmission
material swapping in. It was not: it reproduced identically at tablet width,
where transmission is never used, and a per-frame camera trace showed the camera
decelerating smoothly through it (steps of 0.067 down to 0.001, no
discontinuity) with the changed pixels spread across the whole frame rather than
localised. It was `freezeSimulation()` re-stamping `frozenAt` on a second call —
the effect fires once on focus and again when the flight ends — which advanced
the wander clock by exactly the flight's duration at the instant the camera came
to rest. `resumeSimulation` had the mirror-image bug and now accumulates frozen
time. **When a whole-frame change appears, check the camera before the
materials.**

**The transmission swap is cross-faded** (240ms, standard curve) even though it
turned out not to be the pop. It cannot be done with opacity — `transparent` on
a transmissive material double-counts its blending and washes the glass out — so
the glass fades in by *becoming* glass: thickness and attenuation ramp from
nothing, which is a clear sphere, while the fresnel shell fades out over it.

**Two traps for 2.6.** First, effect ordering: the focus-flight effect fires on
mount like any dependency-array effect, and StrictMode fires it twice in dev, so
it silently overwrote the arrival flight until it was made to track focus's
*value* rather than count runs. Anything else that starts a flight needs the
same discipline. Second: The transmissive material is a
`MeshPhysicalMaterial` in an otherwise unlit scene — every other shell is a
custom `ShaderMaterial` that ignores lights. It needs the two lights added for
it, and its `color` must stay white with the green in `attenuationColor`: put
`--mask` in `color` and it tints everything seen through the glass toward black
and renders as a flat opaque disc.

The landing page as it now stands:

- **The affordance** reveals by proximity without capturing pointer events;
  clicking or tapping the cluster navigates through a window-level handler
  gated on its circle, which defers to drags, selections and real controls.
- **The mobile label** drifts laterally the whole time it is legible, spawns at
  a point solved against its own box so it clears the graph, and rides the
  cluster's parallax during a drag.
- **The hero** anchors its link row to the bottom at every size, scales its
  display type and spacing with viewport height, and gives phones their own
  compact metrics phrasing.
- **The cluster's placement is solved, not fixed** — it slides right of the text
  column when centring would bury it, drops below the text on narrow
  viewports, and is not drawn at all off `/` below the desktop tier, where it
  would sit behind body prose. 02-architecture.md's Landing cluster placement
  section is the authority. All of it now applies as a transform on the real
  constellation, and none of its arithmetic changed to make that work.
- **Parallax** follows a finger on touch and is specified and implemented in
  pixels.

**Cleared before 2.6, so they are not inherited:** the store's `mode` field and
`isSimulationFrozen()` were both dead — never written, never read — and are
gone. 02-architecture.md's State section records when `mode` should come back.

**In progress, ahead of 2.7 — the globe.** The owner's direction: the nebula is
a hollow sphere with everything on the surface and nothing hidden underneath,
"like the clouds over a globe". Entering `/nebula` should fly *into* the middle
and let you look around from inside; `/work/[slug]` keeps the outside view and
rotates the relevant cluster to face the viewer. Nodes wander across the
surface on their own clocks, gather on hover, and disperse on release.

Landed so far: the layout, the edges, the camera — `/nebula` now rests inside
the globe — focus, which approaches a node from the middle rather than from
beyond it, so opening one no longer punches the camera out through the shell,
and `/work/[slug]`, which sees the globe from outside and turns it so the
project's cluster faces the reader. The shell shrank 16 -> 11 in the same pass, which is what
makes a node read at ~5 degrees from in there rather than 3.5; every constant
downstream was rescaled with it and re-measured (see the commit).

Still to do, in order:

- **Mobile**, where the tier table makes the 3D ambient behind a bottom sheet,
  and being inside a globe you can only leave by dragging may not suit.

Not yet started: **2.7** (cluster labels and edge detail). The owner has said
what they want from it: hover an edge and see the projects and technologies it
connects — "look at C# and see all that I've done". The tech panel already
serves the second half; 2.7's edge tooltips (`protocol`, `detail`) are the
first.

Next session should: read this file plus 00, 01, 02, 04, 05 in full before
continuing, then confirm current git state matches this summary before starting
2.6.

---

Nine steps. Each one ends with something visible in the browser and something specific to verify. Build them in order; each depends on the one before.

Commit after every step. Deploy a preview after 2.2, 2.6, and 2.8.

Full behavioural spec is in `05-phase-2.md`. Device tier rules are in `02-architecture.md` and are authoritative — never restate them here or in code comments.

---

## 2.1 — Layout and static geometry

**Goal:** every node on screen in its final position. No motion, no interaction.

Build `layout.ts` into the scene. The shared fresnel node material and `--paper`-matched scene fog for depth (both pulled forward from 2.2 by revision), correct radius per type. Project nodes at `major` 0.85 and `standard` 0.6, tech nodes at 0.34. Camera parked at a fixed position that frames the whole constellation at roughly 70% of viewport height.

~~**This sentence is the authority on the `/nebula` resting camera**~~ — **it is not, any more.** It was written for 2.1, when the constellation was a filled ball framed from outside at 65% of viewport height, camera 41.2 units out against a bounding radius of 17.6. The layout is now a hollow shell of radius 11 and `/nebula` rests *inside* it, at half that radius. Every number in the struck sentence describes a composition that was replaced, including the `DOLLY_MIN_DISTANCE` it cites, which no longer exists on any route.

Left in place rather than rewritten, because 2.1 is a record of what was built at 2.1 and the correction is the interesting part. `05-phase-2.md`'s Camera section is the authority now.

Verify the seeded generator produces identical positions across reloads — reload ten times and confirm nothing moves.

**Done when:** nothing overlaps or occludes badly from the default heading, and the SEL clusters occupy the front hemisphere. Full legibility as distinct clusters depends on the edge hierarchy, not this static view — re-evaluate that at 2.3.

**This is the highest-risk step.** If the graph doesn't look good as plain grey spheres, no material work will save it. Tune `SHELL_RADIUS`, `SHELL_THICKNESS` and `CLUSTER_SPREAD` here until the composition is right, before anything else is built on top.

**Revised after 2.6**, which is what that warning was for. The layout was a filled ball; it is now a hollow shell — see 05-phase-2.md's Layout section. Measured before and after: nodes inside r = 8 went from ten of forty-five to zero, tech mean radius from 9.2 to 16.0, and the bounding radius landed at 17.62 against the old 17.60, so the landing-page footprint (derived from it) and the tuned fog band both survived untouched.

---

## 2.2 — Materials

**Goal:** it looks like the finished thing, standing still.

The fresnel base landed in 2.1; this step extends it — low-frequency vertex displacement so silhouettes breathe. No `MeshPhysicalMaterial` transmission anywhere yet.

Node typing: a three-way category — professional / personal / tech, not an ownership signal — drives an inner core. Professional project nodes (the four SEL clusters plus METER) carry a large translucent `--mask` core (~80% of shell radius, ~20–25% opacity) visible through the shell; personal and client work is fully hollow at the same shell size; tech nodes are hollow, smaller, lower opacity.

Do not build rotation, drift, or the force simulation here — that's 2.3a, after edges exist to spring against.

**Write the material with a tier switch from the start.** Transmission is desktop-only and arrives in 2.5 — the branch should exist now so it isn't retrofitted into a shader later.

**Done when:** it holds up as a still image, and it holds framerate with every node's vertex displacement running.

Deploy a preview. This is the first version worth looking at on a phone.

---

## 2.3 — Edges

**Goal:** the graph is connected and the edge hierarchy is legible without a legend.

Runtime edges as `QuadraticBezierLine`, `--ink` at 52% and 1.9px, amber `--lamp` pulse on a ~4s loop. Dev-time edges dashed with a slower pulse. Shared-tech edges as a single batched `LineSegments`, `--ink-faint` at 45%, static. Those were 40% and 20% and were raised after measuring — see 05-phase-2.md's Edges section for why, and for why the two no longer move together.

**Done when:** you can tell at a glance which edges carry messages and which only mean "shares a technology," with no explanation. If the hairlines compete visually with the runtime edges, drop their opacity until they don't — that asymmetry is the entire point of the design.

---

## 2.3a — Force simulation

**Goal:** the constellation floats instead of sitting still.

Nodes stop being static after `layout.ts` places them. A lightweight runtime force simulation takes over: weak springs hold runtime-edge-connected pairs loosely together, everything else wanders freely. Build the attraction mechanic here too — given a node id, pull everything it's connected to toward it, release on request — but leave it unwired to pointer events; 2.4 is where hover actually calls it. Also build the freeze/resume hook now, even though nothing calls it until fly-in lands in 2.5: the simulation must be able to stop completely and hold position during any programmatic camera movement.

This step needs edges (2.3) to exist first, since the springs attach to runtime-edge pairs.

**Done when:** the constellation reads as alive rather than posed, spring-held runtime-edge pairs stay loosely together while everything else wanders without drifting apart or off-screen, and `prefers-reduced-motion` renders the whole thing frozen at the seeded initial layout.

---

## 2.4 — Camera control and hover

**Goal:** first real interaction.

`CameraControls` with drag-to-rotate and clamped dolly. `onPointerOver` scales the node to 1.15, raises opacity, brightens every connected edge, shows a projected DOM label with `title` and `oneLine`, and attracts connected nodes per 2.3a. One node hovered at a time.

**Done when:** hovering any node makes its neighbourhood obvious, and the dolly clamp prevents both flying outside the constellation and clipping through it.

---

## 2.5 — Fly-in and focus state

**Goal:** clicking a node takes you to it. No panel content yet.

**Two flights, not one.** This step owes the node fly-in described below *and* the landing-page arrival that 02-architecture.md's persistent-canvas decision exists for — 2.1 explicitly deferred that one here. Building only the node half leaves the canvas living in the root layout for a transition that never happens.

Camera interpolates to a position offset along the vector from constellation centre through the node, stopping just outside the surface and looking at it. 650ms, `cubic-bezier(0.32, 0.72, 0, 1)` (1400ms as originally specified; split into two durations later — see 05-phase-2.md). **Never fly to the node's exact position** — that clips through geometry.

On focus: the float simulation freezes (per the hook built in 2.3a), unrelated nodes drop to 25% opacity, and on desktop only the focused node's material switches to real transmission.

Escape and a close control both return to the constellation.

**Done when:** the flight feels weighted rather than snappy or floaty, the simulation resumes cleanly on exit, and reduced-motion turns flights into instant cuts.

**Landed**, both flights — the node fly-in first, the landing-page arrival
initially in a form that only looked like one. See the session status block
above for the rebuild, and for the traps in the transmissive material and in
effect ordering.

---

## 2.6 — Interior panel and routing

**Goal:** you can read a project inside its node, and every view has a URL.

Shell expands per the tier table and drops toward near-full transparency, morphing from wobbling sphere toward rounded rectangle. DOM content fades in within the shell's screen-space bounds using `motion`. Real HTML — selectable, scrollable, keyboard-accessible. Content comes from the same object `/work/[slug]` renders. Never duplicate the prose.

Routing: node clicks push `/nebula/[slug]` with `{ scroll: false }` and play the full approach flight. Cold entry — a direct link or a reload — is different: land already inside the node with no approach flight, shell expanded and content visible at first paint; exiting plays the arrival in reverse (camera pulls back, shell contracts). See `05-phase-2.md`'s Deep linking section for the full split, the canonical-tag pairing with `/work/[slug]`, and the no-WebGL/reduced-motion redirect to it.

Sideways navigation: connected nodes stay visible past the panel edges, hoverable and clickable. Clicking one flies directly there without returning to the constellation.

Under 500px viewport height, the panel becomes a full-height sheet with no morph.

**Done when:** every project is readable inside its node, browser back and forward work correctly, a pasted `/nebula/[slug]` link lands already inside the right node with no flight, and clicking that same node from within the graph does play the flight.

**Landed.** See the session status block above for how, the three traps, and
what it deliberately does not cover.

Deploy a preview. This is the first genuinely complete version.

---

## 2.7 — Cluster labels and edge detail

**Goal:** the information layer.

Cluster labels at each centroid in `--ink-faint`, opacity scaling with camera proximity — invisible from far, legible when near. `Cluster.label` with `Cluster.context` smaller beneath.

Edge hover tooltips on runtime and dev-time edges showing `protocol` and `detail`. This is where the TCP reconnect work, the structured error exchange, and the safe-stop path live.

**Done when:** hovering the scanner → board data → solder driver chain tells you the protocol and the reasoning at each hop.

Build this carefully. It is the only place where the interaction model itself surfaces engineering depth.

---

## 2.8 — Tiers and accessibility

**Goal:** it works for everyone, on everything.

Apply the tier table from `02-architecture.md` — particle counts, transmission policy, tech node visibility, navigation model, panel sizing. Bottom sheet on mobile as primary navigation, toggleable on tablet.

Accessibility: every node focusable in a hidden-but-present DOM list mirroring the graph, tab to move, Enter to open. Always-visible "View as list" link to `/work`. Confirm reduced-motion has been handled in every prior step rather than bolted on here.

**Done when:** the site is fully navigable by keyboard alone, usable with all motion disabled, holds 30fps on a mid-range phone, and every route works at 360px, 768px, 1024px, 1440px, and 844×390 landscape.

Deploy to production.

---

## Notes

**Reduced motion is not a step.** Handle it inline at 2.2, 2.3a, 2.5, and 2.6. If it reaches 2.8 unhandled, it means motion was written in a way that assumes it's always on, and that's harder to unpick than to prevent.

**Performance is measured, not assumed.** Check framerate at 2.2, 2.3, 2.3a, and 2.6 — the steps that add real GPU or CPU cost. Do not wait until 2.8 to discover the particle field, the edge pulses, or the force simulation are too expensive.

**If a step reveals the design is wrong, stop and say so** rather than building the next step on top of it. 2.1 and 2.3 are the two most likely to surface that.
