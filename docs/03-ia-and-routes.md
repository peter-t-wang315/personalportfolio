# 03 — Information architecture and routes

## Routes

```
/                       Landing
/work/[slug]            Project case study (7 pages, one per project)
/about                  Longer bio, background, what he's looking for
/resume                 Inline resume view + PDF download
```

Four routes. Resist adding more. No blog, no /uses, no /now unless Peter asks.

## Landing page — section order

The order below is the argument the page makes. Do not reorder without a reason.

**1. Hero — balanced credibility and character**

Above the fold, no scrolling required. Contains:
- Name and role: backend / distributed systems engineer, currently at SEL
- One sentence of what he actually builds, in software vocabulary
- A single original creature sprite, small, sitting in the layout as a considered element
  rather than a mascot banner
- Two links: see the work, see the resume

The creature is what makes this "balanced" rather than "serious." It should be present and
confident and small. Not a hero image. Not centered and huge.

**2. The pipeline simulator**

Immediately after the hero. This is the highest-value screen real estate on the site and it
goes to the thing nobody else has. Full-bleed or near-full-bleed. Spec in `docs/05`.

Under it, one line of context: this models a production system Peter owns at SEL.

**3. Project storage — the roster**

**Seven projects in one flat grid.** Every tile is the same size — there is no featured tier,
no secondary row, no collapsed storage box. Peter cut the box; do not reintroduce it.

Each tile carries a creature sprite, the project name, a three-to-five word descriptor, and
stack tags in Departure Mono. Click a tile, go to the case study. Hover raises the tile
slightly and the sprite does a two-frame idle bob.

Seven equal tiles reads as a complete, curated set rather than a ranked list with an
afterthought attached. Grid: 2 columns at 390px, 3 at 768px, 4 at 1440px with the last row
left-aligned rather than stretched.

**Accessibility requirement:** this is a semantic list of links. It works with a screen reader
and with keyboard-only navigation. The creature art is decorative (`alt=""`); the project name
is the accessible name of the link.

**4. Capabilities**

A compact, honest summary of what he works in. Grouped: languages, messaging and protocols,
infrastructure, frontend. Departure Mono, dense, scannable. No skill bars, no percentages, no
star ratings — those read as junior and are unfalsifiable.

**5. About strip + contact**

Short. Two or three sentences of who he is, a photo or a stylized trainer-card treatment,
email, GitHub, LinkedIn. One link to `/about` for the longer version.

## Project case study template — `/work/[slug]`

Every case study uses the same structure so they are comparable:

1. **Title + one-line problem statement**
2. **Fast facts strip** — role, timeline, stack, scale. Mono, single row on desktop.
3. **The problem** — 2–3 paragraphs. What was broken or missing, and why it was hard.
4. **What I built** — the architecture. Include a diagram. Systems vocabulary.
5. **Hard parts** — the failure modes, the edge cases, the thing that took three weeks.
   This section is what separates a portfolio from a résumé. Do not skip it.
6. **Outcome** — measurable where honest, architectural properties where not.
7. **What I'd do differently** — short, genuine. Signals seniority.
8. Prev/next project navigation.

Case studies are MDX files in `content/work/`. Frontmatter carries the title, slug, stack
array, sprite path, descriptor, and featured boolean.

## Components to build

```
Hero
PipelineSimulator/          (see docs/05 — its own subtree)
ProjectGrid
  ProjectTile
CapabilityList
AboutStrip
CaseStudyLayout
  FactsStrip
  ArchDiagram               (static SVG per project, hand-authored)
  PrevNext
Footer
GrainOverlay                (fixed, pointer-events-none, aria-hidden)
```

## Performance targets

- Largest Contentful Paint under 2.0s on a throttled 4G connection
- No cumulative layout shift from font loading — self-host all three faces, `font-display: swap`
- Seven sprites, PNG at 1x and 2x, or inline SVG if the four-value quantization allows it
- The simulator is dynamically imported and does not block first paint
