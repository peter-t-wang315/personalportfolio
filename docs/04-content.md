# 04 — Content inventory

All content confirmed by Peter. A small number of items remain flagged `[VERIFY]` — these are
things Peter should check against his actual system before they ship, not things to invent.

## Honesty rules for this build

Peter's resume work established a hard rule: **every claim must survive an interview
question.** That applies here more than on the resume, because a portfolio invites people to
dig in.

Specifically:

- **Do not claim delivery guarantees.** Peter's services consume every message they receive and
  act on it, but he has not built dedup, idempotency keys, or drop detection. Language like
  "at-least-once delivery," "exactly-once," "no message loss," or "guaranteed delivery" is
  forbidden anywhere on the site. Where a mechanism is provided by RabbitMQ rather than built
  by Peter, say so.
- **Do not imply scale.** Real volume is roughly 40 messages per minute. The story is protocol
  heterogeneity, continuous uptime, and physical consequence — not throughput. Never put a
  msg/sec figure on the site.
- Known gaps are allowed to be visible. A "what I'd build next" note reads as senior. A
  fabricated guarantee reads as a liar once someone asks a follow-up.

## Identity

- **Name:** Peter Wang
- **Email:** wang.t.peter@gmail.com
- **GitHub:** github.com/peter-t-wang315
- **LinkedIn:** linkedin.com/in/petertwang
- **Resume PDF:** `[NEEDS PETER]` — drop the backend variant at `public/peter-wang-resume.pdf`

## Hero copy

> **Peter Wang**
> Backend engineer — event-driven services and protocol integration
>
> Software Engineer II at Schweitzer Engineering Laboratories. I build C#/.NET services that
> sit between factory equipment and the cloud: twelve machines, three vendor protocols,
> normalized into one event schema across six production lines at two sites. When one of my
> services makes a call, a physical board either advances or it doesn't.

No delivery-guarantee language. No throughput number. The last sentence carries the weight —
it's specific, it's true, and it's the thing no other candidate can say.

## Featured — the six

### 1. Event pipeline for selective solder automation
- **Slug:** `solder-pipeline`
- **Descriptor:** Three services, one solder line
- **Stack:** C#/.NET, RabbitMQ, TCP sockets, REST
- **Summary:** A three-service pipeline coordinating a camera scan, a routing service, and a
  machine driver so only the boards needing solder get soldered. Long-running background
  services with real consequences for a mishandled message.
- **Hard parts:** partial failure mid-cycle, machine timeouts, bad scans, mid-cycle abort.
- `[VERIFY]` what actually happens today on a malformed or unexpected message — logged and
  ignored, retried, or crashes the consumer? The answer goes in the case study honestly
  either way, and if it's "logged and ignored" that becomes a "what I'd build next" item.
- **Creature concept:** a soldering-iron-tipped creature, molten point, four-value moss ramp

### 2. Station supervisor and plugin worker topology
- **Slug:** `station-supervisor`
- **Descriptor:** Six lines, two sites
- **Stack:** C#/.NET, Docker, Kubernetes, Helm, Jenkins
- **Summary:** A three-tier topology of station supervisors and config-driven plugin workers,
  containerized and deployed across six production lines at two sites through a shared
  monorepo deployment model.
- **Framing note:** Peter consumed the Kubernetes platform rather than building it. Frame
  around what he owned — the service topology, the containerization, the config-driven plugin
  model, and the fact that it became the team standard. Do not overstate infra ownership.
- **Creature concept:** a modular tower creature, stacked segments, one per tier

### 3. Protocol translation layer
- **Slug:** `protocol-layer`
- **Descriptor:** Twelve machines, one schema
- **Stack:** C#/.NET, SMEMA, IPC-CFX, TCP
- **Summary:** An adapter layer normalizing SMEMA handshakes and three vendors' proprietary
  protocols across 12+ machines into a single IPC-CFX event schema. New vendor integrations
  became an adapter implementation rather than a bespoke service.
- **Hard parts — this is the strongest material on the site:**
  - TCP reconnect with exponential backoff and heartbeat-based connection detection
  - Board-eligibility validation that **withholds the SMEMA ready signal** to hold a board in
    place rather than letting it advance incorrectly. This is a design decision with a
    physical outcome and it is the single most interesting thing Peter has built.
- Give this the most thorough case study. The simulator should visibly connect to it.
- **Creature concept:** a many-headed adapter creature, one head per protocol, one shared body

### 4. Preventive maintenance platform
- **Slug:** `maintenance-platform`
- **Descriptor:** Schema design to shipped UI
- **Stack:** C#/.NET, SQL, React, MUI, Jotai
- **Summary:** Full-stack ownership. Relational schema design including a four-level
  many-to-many hierarchy, REST contract design coordinated across frontend, backend, and DBA
  teams, and the React client on top.
- **Adoption:** in use across two sites, covering roughly 30% of manufacturing.
- **Caveat, carried forward from the resume work:** Peter kept the 30% figure knowingly. It's
  fine to use, but he should be ready to explain how it's measured. Phrase it as adoption
  scope, not as impact — "used across two sites by roughly 30% of manufacturing," never
  "improved 30% of manufacturing." Number of consuming teams is unknown; leave it out rather
  than guess.
- **Creature concept:** a wrench-and-gear creature, schematic linework

### 5. Flying probe dashboard migration
- **Slug:** `flying-probe`
- **Descriptor:** WPF to React, in production
- **Stack:** React, Redux, C#/.NET
- **Summary:** Migrated an operator-facing flying probe tester dashboard from WPF to React and
  Redux. Real operators on a factory floor, so the bar for not breaking things was high.
- **Creature concept:** a multi-armed probe creature, fine needle limbs

### 6. VGCLite
- **Slug:** `vgclite`
- **Descriptor:** Built end-to-end with Claude Code
- **Stack:** Next.js, React, TypeScript, Tailwind CSS, Vercel, Vercel Analytics,
  `@smogon/calc` damage calculator library, PokéAPI + Smogon + Pikalytics data sources
- **Summary:** A competitive team analysis tool for people new to VGC. Paste in a team and it
  surfaces the threats that team actually faces — what beats you, what you beat, and by how
  much. Unfamiliar opponents get a quick reference card: base stats, the common competitive
  build, and the damage your team can put on them. The goal is to compress the part of VGC
  prep that normally requires either a spreadsheet or a year of pattern recognition.
- **Why this matters more than it looks:** "AI-assisted development with Claude Code" appeared
  as a stated requirement or nice-to-have in eight of sixteen target postings. This is the
  only evidence Peter has for it, and it's also the only project on the site with a live URL,
  real users, and analytics. Treat it as a first-class case study, not a side project.
- **Live URL:** https://vgclite.com — link it prominently. This is the only project on the
  site a visitor can actually open and use, so it carries disproportionate weight. Include
  real screenshots in the case study.
- `[NEEDS PETER]` whether Vercel Analytics has usage numbers worth citing
- **Creature concept:** Peter's call — this is his own project, let him pick
- **Case study angle:** lead with the data integration problem (three data sources with
  different shapes and update cadences, one normalized model) rather than with the game. That
  framing is the same skill as the protocol layer, which makes the two projects rhyme.

## Also — the smaller work

### BeholderWebUI
- **Stack:** Blazor, C#/.NET, RabbitMQ
- **Summary:** An internal monitoring UI that subscribes to the selective solder driver's
  RabbitMQ messages and surfaces them to operators and engineers. Handles a 5,000-message
  working set with filtering, inspection, and message publishing.
- **The point of this one is mentorship.** Peter built it alongside and mentoring a junior
  developer. That's a real signal for SWE II and above, and it's the only place on the site
  where it shows up. Say it plainly in the case study.
- Internal only, no public URL, no screenshots.

**Layout decision — settled:** there is no storage box. Peter cut it. BeholderWebUI renders as
a **seventh tile at the same size as the other six**, in a single flat grid. Do not build a
collapsed row, a secondary tier, or an "also" section. Seven equal tiles, one grid.

## Correction to earlier drafts

An earlier version of this document referenced "three publicly accessible websites." That was
wrong — Peter has no public sites other than VGCLite. Remove any reference to them. All SEL
work is internal, so **every SEL case study is text and diagrams only.** Plan the case study
layout around hand-authored architecture SVGs, not screenshots. This is a design constraint,
not a gap to apologize for.

## Capabilities section — verbatim

```
Languages      C#  ·  TypeScript  ·  JavaScript  ·  SQL  ·  C/C++ (coursework)
Messaging      RabbitMQ  ·  TCP sockets  ·  REST  ·  IPC-CFX  ·  SMEMA
Infrastructure Docker  ·  Kubernetes  ·  Helm  ·  Jenkins  ·  Azure  ·  Vercel
Frontend       React  ·  Next.js  ·  Redux  ·  Jotai  ·  Tailwind  ·  MUI  ·  Blazor
Observability  Splunk  ·  Azure Monitor
Testing        xUnit
```

Do not list Java, Go, or Spring. Peter has none. C/C++ stays labelled as coursework.

## Sprite generation

Peter is generating creature art with AI and touching it up.

- Every sprite is quantized to the four-value moss ramp from `docs/02`. Enforce in the asset
  pipeline, not by hand. This is what makes generated art read as intentional.
- Consistent canvas: 64×64 source, rendered at 96px, `image-rendering: pixelated`.
- Consistent silhouette weight and outline treatment across all sprites. Inconsistency between
  sprites is more damaging than any single sprite being imperfect.
- Two-frame idle bob on hover, a 1–2px vertical offset. Nothing more elaborate.
- Ship placeholder silhouettes if art isn't ready. Never block the build on assets.
