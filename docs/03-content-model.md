# Content model

## Schema

```ts
type Ownership = 'sole' | 'lead' | 'contributor';

interface Cluster {
  id: string;
  label: string;           // shown faintly near the cluster centroid in the Nebula
  context: string;         // "Schweitzer Engineering Laboratories, 2024–present"
  order: number;
}

interface TechNode {
  id: string;
  label: string;
  blurb: string;           // ONE sentence. Not a write-up.
  projectIds: string[];    // derived, but stored explicitly for edge generation
}

interface Metric {
  value: string;           // "18%"
  label: string;           // "cycle time reduction"
  note?: string;           // "+60 boards/day"
}

interface ProjectNode {
  id: string;
  slug: string;
  title: string;
  clusterId: string;
  ownership: Ownership;
  ownershipNote: string;   // "Sole developer" | "Schema and API design lead" | "Contributor"
  oneLine: string;         // shown on hover in the Nebula
  body: string[];          // paragraphs. Rendered on /work/[slug] AND inside the node.
  metrics: Metric[];
  techIds: string[];
  links?: { label: string; href: string }[];
  size: 'major' | 'standard';
}

interface Edge {
  id: string;
  from: string;
  to: string;
  kind: 'runtime' | 'shared-tech';
  protocol?: string;       // "RabbitMQ / IPC-CFX" — shown on hover, runtime edges only
  detail?: string;         // the deep technical story. One or two sentences.
}
```

## Edge semantics — the most important idea in this document

Two edge kinds, rendered differently, meaning different things:

**`runtime`** — these two services actually exchange messages in production. Solid line, `--ink` at 40% opacity, with an amber pulse traveling along it. Hovering shows `protocol` and `detail`.

**`shared-tech`** — these two things use the same technology. Hairline, `--ink-faint` at 20% opacity, no animation, no hover detail.

Only runtime edges get motion. This is what makes the SEL region visibly the densest, most alive part of the graph, which is the correct emphasis.

**Architectural concepts live on edges, not as nodes.** "Event-driven architecture," "message queues," "distributed systems," "API design," and "machine integration" are not technologies you click — they are what you see when you hover the line between two services. This is why they were cut from the technology node list.

## Clusters

| id | label | context |
|---|---|---|
| `solder` | Selective solder line | SEL |
| `throughhole` | Through-hole automation platform | SEL |
| `tools` | Operator and developer tools | SEL |
| `maintenance` | Preventive maintenance platform | SEL |
| `meter` | METER Group | Internship |
| `client` | Client work | Freelance, unpaid |
| `personal` | Personal projects | — |

## Technology nodes (31)

**Languages and runtimes:** C# / .NET · TypeScript · Python · Rust · SQL

**Frontend:** React · Next.js · Redux · Jotai · Blazor · Tailwind CSS · Material UI · MudBlazor · TanStack Query · React Router · Three.js

**Messaging and protocols:** RabbitMQ · MQTT · IPC-CFX · SMEMA · TCP sockets · REST APIs

**Infrastructure:** Docker · Kubernetes · Helm · Jenkins

**Cloud and data:** AWS Lambda · DynamoDB · Azure · Splunk · Django

### Deliberately excluded, and why

- **Assumed:** HTML, CSS, Git, Agile, code review. Listing them is a negative signal.
- **Too thin to advertise as a node:** Java, C/C++ (coursework only), SQL Server, stored procedures, xUnit, unit testing. A node implies proficiency and invites a question the current depth won't survive. These stay off the graph.
- **Concepts, not technologies:** microservices, event-driven architecture, distributed systems, message queues, data modeling, API design, machine integration, industrial protocol integration, manufacturing automation, caching, relational schema design. These become edge `protocol`/`detail` text and body prose.
- **Not graph material:** Claude Code, AI-assisted development, mentoring, on-call support, LaTeX, Radix UI, WPF, Serverless Framework. These belong on `/about`, the resume, or a project's body prose. Claude Code in particular should be prominent on `/about` — it was named in eight of sixteen job postings reviewed.

### Six added after the write-ups were corrected

The list above was curated before anyone checked it against what the services
actually do. Correcting the project write-ups turned up six technologies that
were load-bearing and missing, and the reasons divide cleanly:

- **MQTT** was never considered and should always have been here. It is how the
  selective solder driver reaches its machine, over a TCP connection it holds
  open — a protocol in exactly the sense SMEMA and IPC-CFX are, and now on a
  runtime path.
- **Three.js** likewise: it is what the portfolio node is built out of, and its
  absence was an oversight rather than a decision.
- **Material UI** was on the excluded list, as a UI library on one project. It
  is on three — the maintenance client (which uses it with plain CSS, not
  Tailwind, as this document previously implied), the flying probe dashboard,
  and ZENTRA. Three projects is load-bearing. **MudBlazor**, **TanStack Query**
  and **React Router** came in on the same reasoning.

**Serverless Framework stayed out**, on one project and already named in that
project's prose, which is what the exclusion rule is for.

**Adding to this list is not free.** `content/layout.ts` places technologies on
a Fibonacci sphere sized by `tech.length`, then biases each toward the projects
using it — so a new node moves every node, and correcting one project's
`techIds` moves nodes belonging to projects nobody touched. Going from 25 to 31
re-laid out the constellation and made `/nebula`'s measured interior
composition stale; it had to be re-searched (`07-continuous-space.md`). Budget
for that, or batch the additions.

## Naming — resolved

Internal tool names are cleared for public use. The constraint is narrower than originally scoped: no screenshots or logs, not the names themselves. Project titles stay descriptive; the internal name renders as a secondary `aka` subtitle on `/work/[slug]` only.

| Internal | Public name |
|---|---|
| Beholder | Operator monitoring console |
| RabbitCFXTalker | RabbitMQ / CFX developer client |
| Batch Service | Board data service |
| PM Log | Preventive maintenance platform |

Descriptive names also read better to an outsider who has no idea what a Beholder is.

## Project nodes — where the content lives

**`content/projects.ts`. Not here.**

This section used to carry a draft of every project — prose, metrics and a tech
list each — under the heading "written, needs Peter's correction". The
correction happened, in the content file, and the drafts sat here for months
afterwards saying something different. They are deleted rather than banner-ed,
because a per-project tech list in a document is a second copy of the content
file and second copies go stale silently: nothing fails, the doc just lies. This
document describes the *model* — the fields, the rules, what a node means — and
the content file holds the content.

What the drafts had wrong is worth keeping, because most of it was not a typo
but an assumption nobody had checked with the person who built the thing:

- The solder driver was listed with **REST APIs** and no MQTT. It makes no
  REST calls at all — the board data service owns every external call — and it
  reaches its machine over **MQTT**, on a TCP connection it holds open.
- It was also listed with SMEMA, and the prose said it "holds the machine in a
  safe wait state". There is no SMEMA in it. It gates entry by *not answering*
  when the machine asks for the scan, so the machine waits. Nothing is
  withheld and no stop is asserted.
- The 18% was recorded as a number without a mechanism. It is program
  selection: a recipe alone covers every variant of a board, so the machine
  runs the union of solder points; sending recipe *and* revision runs only the
  joints that board actually has.
- `th-supervisor` was one node covering all three tiers, with a note suggesting
  it be split. It has been: `th-supervisor`, `th-worker` and `th-client`. And
  one supervisor coordinates one *line*, not one machine — six of them drive
  seven machines.
- `maintenance-frontend` and `maintenance-backend` were never node ids. They are
  `maintenance-client` and `maintenance-services`, the client uses plain CSS
  and **Material UI** rather than Tailwind, and it replaced a weaker existing
  PM tool rather than paper.
- Everything that crosses RabbitMQ carries **IPC-CFX**, so the board data
  service, scanner driver, station worker and operator console all have it.
  The machine client does not: the worker consumes it in-process through event
  subscriptions, which is the one path in the platform with no bus on it.

## Project decisions

**CartPole, cut.** A tutorial follow-along in a Gym environment, not original work. Deliberately excluded from the portfolio; do not add it back.

## Hero metrics

1. **18%** — cycle time reduction · *+60 boards/day*
2. **30+** — machines and devices across 6 vendors · *machines, conveyors, cameras, SMEMA controllers*
3. **2 sites** — 6 production lines, running 24/7

The preventive maintenance adoption figure (30%+ of manufacturing) lives on the `maintenance-client` node where it has context, not in the hero.

**The compact row on phones and tablets is not these three truncated.** Collapsing each metric to its value gave "18% · 30+ · 2 sites", which is three numbers with the sentence that made them mean something stripped off. The compact row is its own phrasing instead, in `heroMetricsCompact`:

> 30+ machines · 6+ vendors · across 2 sites

It reads as one line of prose and draws on the second metric twice — its value and its vendor count — rather than once each. The cost is that the cycle-time figure has no room there, so **18% is a desktop and `/work` number only.** That is deliberate: an unexplained "18%" was buying nothing on a phone. If a phone-sized hero ever needs to carry it, it needs its own phrasing, not the bare value back.

## Positioning line

> I make factory machines talk, and I handle everything they say.
