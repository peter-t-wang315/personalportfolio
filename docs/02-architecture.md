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

This is painful to retrofit. Build it this way from Phase 1, even though Phase 1 only renders a static drifting cluster.

Import the canvas with `next/dynamic` and `ssr: false`, with a static placeholder that paints immediately. `three` + `drei` is a heavy bundle and LCP will suffer otherwise.

## Routes

| Route | Content | Camera state |
|---|---|---|
| `/` | Hero, three metrics, links | Far. Cluster small, centered, behind text. |
| `/about` | Bio, photo, skills prose, mentoring, on-call, Claude Code | Far, slightly offset |
| `/resume` | Rendered resume + Download PDF | Far, dimmed |
| `/work` | List of all projects grouped by cluster | Far, dimmed |
| `/work/[slug]` | Full project page | Far, dimmed |
| `/nebula` | The graph | Inside the constellation |
| `/nebula/[slug]` | Graph with node open | Flown into that node |

`/work/[slug]` and `/nebula/[slug]` render the **same content object**. One is a document, one is a node interior. Never duplicate the prose.

Deep links to `/nebula/[slug]` play the fly-in from the outside rather than cutting in.

Graph state resets on each visit. No persistence.

## State

One zustand store. Context does not cross the R3F reconciler boundary reliably; this is the standard answer and it matters here because the DOM overlay and the scene talk constantly.

```ts
interface SceneState {
  mode: 'distant' | 'constellation' | 'inside';
  focusedNodeId: string | null;
  hoveredNodeId: string | null;
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

Route changes drive `mode`. Node clicks drive `focusedNodeId` **and** push a route via `router.push('/nebula/[slug]', { scroll: false })` so the URL always reflects the view.

## Content pipeline

```
content/
  clusters.ts     // cluster definitions
  tech.ts         // technology nodes
  projects.ts     // project nodes, full prose
  edges.ts        // derived + explicit edges
  layout.ts       // computed 3D positions (deterministic, seeded)
```

`layout.ts` runs a deterministic seeded layout at build time, not at runtime. Positions must be stable across reloads or the graph feels random. Use a Fibonacci sphere for cluster centroids, then a small local force relaxation within each cluster, seeded from a constant.

Never use `Math.random()` in layout. Use a seeded PRNG.

## Performance budget

- **Do not use `MeshPhysicalMaterial` with `transmission` on more than 2 nodes.** Each transmissive mesh triggers an additional scene render pass. Default node material is a custom fresnel shader — a rim-lit translucent sphere with a soft inner core. Real transmission is reserved for the focused node only, after the fly-in completes.
- Background particles: one `InstancedMesh`, ~600 instances, positions computed once, drift applied in the vertex shader — not per-instance on the CPU.
- Edges: batch into as few draw calls as possible. Drei's `QuadraticBezierLine` is fine for the ~40 production edges; technology edges (potentially 100+) should be a single `LineSegments` with a custom shader.
- Target: 60fps desktop, 30fps mid-range mobile. Measure before adding postprocessing.
- Cap `dpr` at `[1, 2]`.

## Mobile

`/nebula` is a fixed, non-scrolling, full-viewport canvas, so drag-to-rotate has no page scroll to conflict with. Scrolling happens only inside an opened node panel.

On viewports under 768px:
- Technology nodes hidden by default, toggleable.
- No transmission at all, ever.
- Particle count reduced to 200.
- A persistent bottom sheet lists all nodes and is the primary navigation. The 3D becomes ambient.

## Analytics

`@vercel/analytics` plus custom events: `node_opened` (with slug), `tour_started`, `tour_completed`, `resume_downloaded`, `nebula_entered`. This answers whether anyone actually explores, which determines whether Phase 3 is worth building.
