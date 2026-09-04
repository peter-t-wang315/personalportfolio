# Phase 1 — the real site

**Goal: a complete, deployable portfolio with a URL that can go on job applications.** The Nebula is visible but not functional.

Estimated 12–15 hours.

## Deliverables

### Setup
- Next.js App Router, TypeScript, Tailwind.
- Design tokens from `01-design-system.md` as CSS custom properties in `globals.css`, mirrored into `tailwind.config.ts`.
- Geist Sans and Geist Mono via `next/font`.
- Root layout structured per `02-architecture.md` — canvas in the layout, DOM above it. **Do this now even though the canvas barely does anything yet.**
- zustand store with `pointer`, `mode`, `reducedMotion`.

### Content files
All of `content/` per `03-content-model.md`. Projects that lack final copy get a short honest placeholder, not lorem ipsum. Everything is typed and validated at build.

### The canvas (Phase 1 version only)
- Full-viewport, fixed, `z-0`, transparent over `--paper`.
- A single loose cluster of ~40 small spheres, centered, sitting visually behind the hero text with the text arranged around it so the cluster is never fully occluded.
- Slow continuous drift. No hover, no click on individual nodes, no edges.
- Fresnel material, not transmission.
- Responds to `pointer` from the store for parallax.
- On `/about`, `/resume`, `/work` the cluster is pushed further back and dimmed to ~35% opacity.

### `/` landing page
Above the fold, no interaction required:
- Name.
- `Software Engineer II, Schweitzer Engineering Laboratories`
- Positioning line, in Geist Mono display, lowercase.
- Three metrics from `03-content-model.md`.
- Links: Resume · About · Work · GitHub · LinkedIn · Email.

Below: a short paragraph of orientation and a compact list of the six or seven most significant projects linking to `/work/[slug]`.

**Cursor parallax:** foreground text and background cluster translate in opposite directions, 12px and 28px max respectively, spring-eased. Disabled under `prefers-reduced-motion`.

**The "What's this?" affordance — implemented.** See `app/nebula-affordance.tsx`:

- **Desktop (pointer-capable, per `useDeviceTier()`):** no static label. A short line of casual text, chosen at random from a ~25-phrase pool each time a hover session starts (not cycled while it's held), follows the cursor at a fixed offset, revealed only on proximity hover to the cluster (a circular region sized off the cluster's real on-screen radius, not a guess). Plain colored text (`--mask`), no background pill — a filled pill read as too loud and made re-hover sizing fiddly. Fades and drifts in with a genuine ease-in curve (slow start, so the fade is actually perceptible) and fades out faster and softer on hover-out, from wherever the cursor last was. Keyboard focus reveals the same label in a fixed position below the cluster instead of following a (nonexistent) cursor, underlined rather than pill-boxed to mark the focus state.
- **Mobile/touch and tablet (per the same `useDeviceTier()` gate):** always-present, low-contrast label below the cluster — no hover state to gate a reveal on, so it cycles through the same phrase pool on a slow timer instead, with the same fade treatment, just without cursor-following. The label spawns around the cluster's real computed on-screen radius, so it stays tethered to the graph at any viewport height — the cluster's on-screen size is a fixed fraction of viewport height, not a constant, and a flat pixel offset broke as soon as that height changed. The hero link row does **not** follow the cluster: it anchors to the bottom of the hero viewport (`app/hero-nav.tsx`, `mt-auto` inside the growing flex column `app/page.tsx` sets up below `lg`), so it reads as the page's own footer rather than as something hanging off the graph. It earlier measured the cluster's edge and pushed past it with a computed margin; that both read as an appendage and caused a mobile infinite-scroll bug, since the measurement mixed viewport and document coordinates.
- **Desktop and tablet also get a slow idle pulse:** a faint ring at the cluster's edge that contracts inward and fades on a several-seconds-apart loop, paused while the hover affordance is showing. Disabled under `prefers-reduced-motion`, along with the phrase-cycling and cursor-drift animations elsewhere in this feature.
- **Either way:** clicking/tapping navigates to `/nebula`. Phase 2 is now under construction there, so this no longer lands on a coming-soon placeholder — it lands on the real (in-progress) constellation.

### `/about`
Bio, photo, how Peter works. This is where the non-graph material lives: mentoring, on-call, code review, Claude Code and AI-assisted development, education (WSU), and the honest skill list including the things deliberately kept off the graph.

### `/resume`
Rendered as a real page from the content files. `Download PDF` serves a **pre-built** PDF from `/public` — not client-generated. One combined resume, not the two application variants.

### `/work` and `/work/[slug]`
`/work` lists all projects grouped by cluster, with cluster context lines.

`/work/[slug]` renders one project: title, ownership note stated plainly, one-liner, metrics, body prose, technology list, links. Generated with `generateStaticParams`. Real `metadata` per page for SEO and link previews.

**Ownership is stated in plain text on every project page.** "Sole developer." "Schema and API design lead." "Contributor." Not implied by styling. Drawing that line yourself before an interviewer asks is a credibility asset.

### Quality floor
- Responsive to 360px.
- Verify every route at 360px, 768px, 1024px, and 1440px, plus landscape phone at 844×390, before Phase 1 is considered done.
- Visible keyboard focus everywhere.
- `prefers-reduced-motion` fully respected.
- Works with WebGL unavailable — the canvas fails silently to nothing.
- Lighthouse: LCP under 2.0s on the landing page. If the three bundle blows this, gate the canvas behind an intersection observer or a short delay.
- `sitemap.xml`, `robots.txt`, Open Graph image.

## Done when

The site is deployed, the URL is in the resume header, and a stranger can learn what Peter does in 40 seconds without clicking anything.
