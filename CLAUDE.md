# CLAUDE.md — Operating instructions

You are building Peter's personal engineering portfolio. Read every file in `docs/`
before doing anything. They are the source of truth.

## Skills to use

- `frontend-design` — read before any visual decision
- `taste` — read before any visual decision
- `awesome-design` — reference during the design pass
- `emil-kowalski` — governs all motion; read before writing a single animation
- Figma MCP — Phase 1 only
- Playwright MCP — Phase 3 QA, screenshot every route and critique your own output
- Vercel skill — Phase 4 deployment

## Phased workflow — do not skip ahead

### Phase 1 — Design exploration in Figma. STOP AT THE END.

1. Read `docs/01-brief.md`, `docs/02-design-direction.md`, `docs/03-ia-and-routes.md`.
2. Produce the token system and layout plan described in the `frontend-design` skill:
   4–6 named hex values, the three type roles, layout concept, and the signature element.
   Critique it against the brief before committing. If any part reads like a default you'd
   produce for any portfolio, revise it and say what you changed.
3. Build Figma mockups via the Figma MCP for, at minimum:
   - Landing page, desktop, full scroll
   - Landing page, mobile (390px)
   - Project detail page, desktop
   - The pipeline simulator in three states: idle, running, failure injected
   - The project storage grid
4. **Stop. Present the mockups and your token system to Peter and wait for feedback.**
   Do not write application code in Phase 1. Do not proceed on your own judgment.
   Expect two or three rounds of revision here. That is normal and desired.

### Phase 2 — Implementation

Only after Peter approves a direction.

1. Scaffold per `docs/03-ia-and-routes.md`.
2. Build static pages first, real content from `docs/04-content.md`, no lorem ipsum ever.
3. Build the pipeline simulator last — it is the hardest piece. Spec is
   `docs/05-pipeline-simulator.md`.
4. Motion goes in after layout is correct, never simultaneously.

### Phase 3 — QA

Use Playwright to screenshot every route at 390px, 768px, and 1440px. Look at the
screenshots and critique them. Check: keyboard focus visible everywhere, `prefers-reduced-motion`
honored, no layout shift, Lighthouse accessibility ≥ 95, no console errors.

### Phase 4 — Deploy

Vercel. Preview deploy first, share the URL, wait for sign-off before production.

## Non-negotiables

- **No Nintendo or Pokémon intellectual property.** No official sprites, no Pokémon names,
  no Pokémon typefaces, no trademarked terms in shipped copy. Original creature art and
  generic vocabulary ("storage", "box", "roster") only. This is a legal and professional
  requirement, not a style preference.
- **Never invent metrics, dates, or technical claims.** Anything marked `[NEEDS PETER]` in
  `docs/04-content.md` stays as a visible TODO until he fills it. Do not guess a number to
  make a layout look finished.
- **The theme never gates access to evidence.** Every project must be reachable in one click
  from the landing page and readable without understanding any reference.
- Accessibility floor: semantic HTML, real headings, visible focus rings, alt text,
  4.5:1 contrast on body text, full keyboard operation of the simulator.

## Stack

Next.js (App Router) · TypeScript · Tailwind v4 · Motion (`motion/react`) · MDX for project
content · deployed on Vercel. No CMS, no database, no auth. Content lives in the repo.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
