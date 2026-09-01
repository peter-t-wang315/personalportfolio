# Phase 2 — build sequence

Eight steps. Each one ends with something visible in the browser and something specific to verify. Build them in order; each depends on the one before.

Commit after every step. Deploy a preview after 2.2, 2.6, and 2.8.

Full behavioural spec is in `05-phase-2.md`. Device tier rules are in `02-architecture.md` and are authoritative — never restate them here or in code comments.

---

## 2.1 — Layout and static geometry

**Goal:** every node on screen in its final position. No motion, no interaction.

Build `layout.ts` into the scene. The shared fresnel node material and `--paper`-matched scene fog for depth (both pulled forward from 2.2 by revision), correct radius per type. Project nodes at `major` 0.85 and `standard` 0.6, tech nodes at 0.34. Camera parked at a fixed position that frames the whole constellation at roughly 70% of viewport height.

Verify the seeded generator produces identical positions across reloads — reload ten times and confirm nothing moves.

**Done when:** the constellation reads as seven distinct clusters, nothing overlaps or occludes badly from the default heading, and the SEL clusters occupy the front hemisphere.

**This is the highest-risk step.** If the graph doesn't look good as plain grey spheres, no material work will save it. Tune `CLUSTER_RADIUS`, `CLUSTER_SPREAD`, and `TECH_SHELL_RADIUS` here until the composition is right, before anything else is built on top.

---

## 2.2 — Materials and idle motion

**Goal:** it looks like the finished thing, standing still.

The fresnel base landed in 2.1; this step extends it — low-frequency vertex displacement so silhouettes breathe. No `MeshPhysicalMaterial` transmission anywhere yet.

Node typing: SEL project nodes carry a solid `--mask` core visible through the shell; personal and client work is hollow; tech nodes are hollow, smaller, lower opacity.

Idle: constellation rotates on Y at ~0.02 rad/s, individual nodes drift slightly.

**Write the material with a tier switch from the start.** Transmission is desktop-only and arrives in 2.5 — the branch should exist now so it isn't retrofitted into a shader later.

**Done when:** it holds up as a still image, and `prefers-reduced-motion` stops all rotation and drift.

Deploy a preview. This is the first version worth looking at on a phone.

---

## 2.3 — Edges

**Goal:** the graph is connected and the edge hierarchy is legible without a legend.

Runtime edges as `QuadraticBezierLine`, `--ink` at 40%, amber `--lamp` pulse on a ~4s loop. Dev-time edges dashed with a slower pulse. Shared-tech edges as a single batched `LineSegments`, `--ink-faint` at 20%, static.

**Done when:** you can tell at a glance which edges carry messages and which only mean "shares a technology," with no explanation. If the hairlines compete visually with the runtime edges, drop their opacity until they don't — that asymmetry is the entire point of the design.

---

## 2.4 — Camera control and hover

**Goal:** first real interaction.

`CameraControls` with drag-to-rotate and clamped dolly. `onPointerOver` scales the node to 1.15, raises opacity, brightens every connected edge, and shows a projected DOM label with `title` and `oneLine`. One node hovered at a time.

**Done when:** hovering any node makes its neighbourhood obvious, and the dolly clamp prevents both flying outside the constellation and clipping through it.

---

## 2.5 — Fly-in and focus state

**Goal:** clicking a node takes you to it. No panel content yet.

Camera interpolates to a position offset along the vector from constellation centre through the node, stopping just outside the surface and looking at it. 1400ms, `cubic-bezier(0.32, 0.72, 0, 1)`. **Never fly to the node's exact position** — that clips through geometry.

On focus: idle rotation pauses, unrelated nodes drop to 25% opacity, and on desktop only the focused node's material switches to real transmission.

Escape and a close control both return to the constellation.

**Done when:** the flight feels weighted rather than snappy or floaty, rotation resumes cleanly on exit, and reduced-motion turns flights into instant cuts.

---

## 2.6 — Interior panel and routing

**Goal:** you can read a project inside its node, and every view has a URL.

Shell expands per the tier table and drops toward near-full transparency, morphing from wobbling sphere toward rounded rectangle. DOM content fades in within the shell's screen-space bounds using `motion`. Real HTML — selectable, scrollable, keyboard-accessible. Content comes from the same object `/work/[slug]` renders. Never duplicate the prose.

Routing: node clicks push `/nebula/[slug]` with `{ scroll: false }`. Direct entry to `/nebula/[slug]` starts outside the constellation and plays the full approach — never cut in.

Sideways navigation: connected nodes stay visible past the panel edges, hoverable and clickable. Clicking one flies directly there without returning to the constellation.

Under 500px viewport height, the panel becomes a full-height sheet with no morph.

**Done when:** every project is readable inside its node, browser back and forward work correctly, and a pasted `/nebula/[slug]` link lands on the right node having played the approach.

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

**Reduced motion is not a step.** Handle it inline at 2.2, 2.5, and 2.6. If it reaches 2.8 unhandled, it means motion was written in a way that assumes it's always on, and that's harder to unpick than to prevent.

**Performance is measured, not assumed.** Check framerate at 2.2, 2.3, and 2.6 — the three steps that add real GPU cost. Do not wait until 2.8 to discover the particle field or the edge pulses are too expensive.

**If a step reveals the design is wrong, stop and say so** rather than building the next step on top of it. 2.1 and 2.3 are the two most likely to surface that.
