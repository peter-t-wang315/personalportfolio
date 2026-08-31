# Project brief

## What this is

A personal portfolio site for Peter Wang, Software Engineer II at Schweitzer Engineering Laboratories. Next.js, deployed on Vercel.

The site has two layers:

1. **A conventional, fast, crawlable site** — landing page, about, resume, and one page per project. This is what a recruiter sees and what Google indexes.
2. **The Nebula** — a 3D node graph at `/nebula` where projects and technologies float as connected nodes in a cream void. This is the exploratory layer.

Both layers render from the same content source. The Nebula is a second way through the same material, never the only way.

## Why a node graph

Most 3D portfolios pick a theme arbitrarily. This one doesn't. Peter builds distributed message-passing systems for factory automation — C# services connected over RabbitMQ, translating machine protocols. A portfolio rendered as a connected topology is a form/content match.

Critically, one region of the graph is **a truthful architecture diagram of production software he built**, not a metaphor. The selective solder cluster and the through-hole automation cluster have edges that represent real runtime message paths. The rest of the graph uses edges to mean "shares a technology."

That asymmetry is the point. It should be visible: real message paths are solid and animated, technology links are faint and static.

## Audience

**Primary: technical recruiters and hiring managers at mid-size and large tech companies.** They spend 30–60 seconds. They must be able to get name, title, positioning, three hard numbers, and a resume link without a single interaction.

**Secondary: engineers who will actually explore.** The Nebula is for them, and for interview conversation.

The site must never make the primary audience work to reach the primary information.

## Non-goals

- Not a WebGL showcase. If the 3D is the most impressive thing here, the site has failed.
- Not a blog.
- No dark mode. The cream is the identity.
- No contact form. `mailto:` and LinkedIn.
- No CMS. Content lives in typed TypeScript files in the repo.

## Constraints

- **NDA.** No screenshots, code, or footage of SEL systems. No vendor names. Architecture-level description only, matching what already appears on the resume.
- **Internal naming.** SEL-internal tool names must not appear publicly. Use descriptive names throughout (see `03-content-model.md`).
- **Time.** Built alongside an active job search. Phase 1 must ship standalone.

## Phases

Each phase ships. Phase 1 is a complete, linkable portfolio on its own.

### Phase 1 — the real site (~12–15 hrs)
Design system, landing page with cursor parallax, `/about`, `/resume`, `/work/[slug]`. The Nebula exists visually in the background of the landing page as a static, slowly drifting cluster with a "What's this?" affordance that leads to a **coming soon** state. No graph functionality.

**Deploy this and put the URL on job applications immediately.**

### Phase 2 — the Nebula (~25–35 hrs)
`/nebula` as a real graph. Persistent canvas across routes so the flight from the landing page is continuous. Nodes, edges, hover, fly-in, node-interior panels, deep linking, mobile fallback.

### Phase 3 — polish (~15–20 hrs)
Guided tour, ⌘K search, edge-hover protocol detail, particle field, audio, analytics.

## Success criteria

- A recruiter who lands on `/` and leaves in 40 seconds still knows what Peter does, sees three concrete numbers, and has the resume.
- An engineer who opens the Nebula can trace a real production message path through software Peter built.
- Nothing on the site would embarrass him in an interview or collapse under a follow-up question.
