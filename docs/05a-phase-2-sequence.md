# Phase 2 — build sequence

## Session status (update each session)

> ### TEMPORARY — hand-off note, delete once read
>
> Written at the end of the session of 2026-09-05. It records what happened
> rather than what the code is; once you have read it and the summary below
> looks right, **delete this blockquote**. The rest of this section is the
> permanent status.
>
> That session did a long run on the **Phase 1 landing page** and then built
> **2.5**. Three things are worth knowing that the code does not say:
>
> 1. **Two tilt-reactive behaviours were built and then deleted** — a phrase
>    nudge and a shader sheen driven by `deviceorientation`. They were not a
>    mistake and they were not a violation: neither moved the scene, so
>    01-design-system.md's prohibition on device-orientation *parallax* was
>    never in play. They went because they were the one piece of the work that
>    could not be verified without real hardware, and the owner did not want
>    the sensor. **Do not rediscover the idea as new.** All movement on touch
>    comes from the drag instead.
> 2. **Verification in that session was headless Chromium**, driven with real
>    events and real touch gestures but no phone. The owner has been testing on
>    a real device in between and reports it good. Anything sensor- or
>    hardware-specific still deserves their eyes, not mine.
> 3. **The landing page has never been deployed.** The owner runs `npx vercel`
>    themselves and knows.

Last completed: **2.5** (fly-in + focus state), and the **Phase 1 landing
page**. Committed and stable on `nebulustest`.

**2.5 as built.** Clicking a node flies the camera along the vector from the
constellation's centre through that node, stopping outside its surface and
looking back at it — never at the node's own position, which would put the
camera inside the shell. 1400ms on 01-design-system.md's standard curve, driven
by hand rather than by camera-controls' `enableTransition`, because that
smooths exponentially with no fixed duration and the spec asks for a specific
curve over a specific time. The dolly clamp lifts for the flight; with it live,
camera-controls drags the camera back out mid-flight and the arrival never
lands. On focus the simulation freezes (2.3a's hook), unrelated nodes drop to
25% of their own base opacity, and on desktop only the focused node swaps to
real transmission once the flight has landed. Escape and a close control both
leave. Reduced motion makes flights instant cuts.

Measured: scene change peaks mid-flight and goes still at ~1450ms; after
arrival the frame-to-frame change is 0.4% of sampled pixels (the shells still
breathe, which is correct — only the float simulation freezes); after exit it
rises again, confirming a clean resume; under reduced motion the change is a
single frame and then exactly zero.

**Watch out for one thing in 2.6.** The transmissive material is a
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
  section is the authority.
- **Parallax** follows a finger on touch and is specified and implemented in
  pixels.

Not yet started: **2.6** (interior panel and routing).

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

Verify the seeded generator produces identical positions across reloads — reload ten times and confirm nothing moves.

**Done when:** nothing overlaps or occludes badly from the default heading, and the SEL clusters occupy the front hemisphere. Full legibility as distinct clusters depends on the edge hierarchy, not this static view — re-evaluate that at 2.3.

**This is the highest-risk step.** If the graph doesn't look good as plain grey spheres, no material work will save it. Tune `CLUSTER_RADIUS`, `CLUSTER_SPREAD`, and `TECH_SHELL_RADIUS` here until the composition is right, before anything else is built on top.

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

Runtime edges as `QuadraticBezierLine`, `--ink` at 40%, amber `--lamp` pulse on a ~4s loop. Dev-time edges dashed with a slower pulse. Shared-tech edges as a single batched `LineSegments`, `--ink-faint` at 20%, static.

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

Camera interpolates to a position offset along the vector from constellation centre through the node, stopping just outside the surface and looking at it. 1400ms, `cubic-bezier(0.32, 0.72, 0, 1)`. **Never fly to the node's exact position** — that clips through geometry.

On focus: the float simulation freezes (per the hook built in 2.3a), unrelated nodes drop to 25% opacity, and on desktop only the focused node's material switches to real transmission.

Escape and a close control both return to the constellation.

**Done when:** the flight feels weighted rather than snappy or floaty, the simulation resumes cleanly on exit, and reduced-motion turns flights into instant cuts.

**Landed.** See the session status block above for how, and for the one trap in the transmissive material.

---

## 2.6 — Interior panel and routing

**Goal:** you can read a project inside its node, and every view has a URL.

Shell expands per the tier table and drops toward near-full transparency, morphing from wobbling sphere toward rounded rectangle. DOM content fades in within the shell's screen-space bounds using `motion`. Real HTML — selectable, scrollable, keyboard-accessible. Content comes from the same object `/work/[slug]` renders. Never duplicate the prose.

Routing: node clicks push `/nebula/[slug]` with `{ scroll: false }` and play the full approach flight. Cold entry — a direct link or a reload — is different: land already inside the node with no approach flight, shell expanded and content visible at first paint; exiting plays the arrival in reverse (camera pulls back, shell contracts). See `05-phase-2.md`'s Deep linking section for the full split, the canonical-tag pairing with `/work/[slug]`, and the no-WebGL/reduced-motion redirect to it.

Sideways navigation: connected nodes stay visible past the panel edges, hoverable and clickable. Clicking one flies directly there without returning to the constellation.

Under 500px viewport height, the panel becomes a full-height sheet with no morph.

**Done when:** every project is readable inside its node, browser back and forward work correctly, a pasted `/nebula/[slug]` link lands already inside the right node with no flight, and clicking that same node from within the graph does play the flight.

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
