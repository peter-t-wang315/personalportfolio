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

## Technology nodes (24)

**Languages and runtimes:** C# / .NET · TypeScript · Python · SQL

**Frontend:** React · Next.js · Redux · Jotai · Blazor · Tailwind CSS

**Messaging and protocols:** RabbitMQ · IPC-CFX · SMEMA · TCP sockets · REST APIs

**Infrastructure:** Docker · Kubernetes · Helm · Jenkins

**Cloud and data:** AWS Lambda · DynamoDB · Azure · Splunk · Django

### Deliberately excluded, and why

- **Assumed:** HTML, CSS, Git, Agile, code review. Listing them is a negative signal.
- **Too thin to advertise as a node:** Java, C/C++ (coursework only), SQL Server, stored procedures, xUnit, unit testing. A node implies proficiency and invites a question the current depth won't survive. These stay off the graph.
- **Concepts, not technologies:** microservices, event-driven architecture, distributed systems, message queues, data modeling, API design, machine integration, industrial protocol integration, manufacturing automation, caching, relational schema design. These become edge `protocol`/`detail` text and body prose.
- **Not graph material:** Claude Code, AI-assisted development, mentoring, on-call support, LaTeX, Material UI, Radix UI, WPF. These belong on `/about` and the resume. Claude Code in particular should be prominent on `/about` — it was named in eight of sixteen job postings reviewed.

## Naming — resolved

Internal tool names are cleared for public use. The constraint is narrower than originally scoped: no screenshots or logs, not the names themselves. Project titles stay descriptive; the internal name renders as a secondary `aka` subtitle on `/work/[slug]` only.

| Internal | Public name |
|---|---|
| Beholder | Operator monitoring console |
| RabbitCFXTalker | RabbitMQ / CFX developer client |
| Batch Service | Board data service |
| PMLog | Preventive maintenance platform |

Descriptive names also read better to an outsider who has no idea what a Beholder is.

## Project nodes — content status

### Written (drafts below, need Peter's correction)

**`solder-driver` — Selective solder driver** · cluster `solder` · `contributor` · major
Terminal service in the solder line. Receives resolved board data and gates machine entry on the returned program and revision, enabling per-revision program targeting. Publishes structured error events to a dedicated exchange so a floor operator sees the specific failure reason and can self-resolve without escalating to engineering. Holds the machine in a safe wait state rather than failing open. Running 24/7 in production since launch.
Metrics: 18% cycle time reduction (+60 boards/day).
Tech: C#/.NET, RabbitMQ, IPC-CFX, TCP sockets, REST APIs.

**`board-data-service` — Board data service** · cluster `solder` · `contributor` · standard
Resolves board identity against internal REST APIs — board scan data, route completion, route creation. Sits between the scanner and the solder driver, turning a barcode into the program and revision the machine needs.
Tech: C#/.NET, RabbitMQ, REST APIs.

**`scanner-driver` — Scanner driver** · cluster `solder` · `contributor` · standard
Talks to the barcode scanner over TCP, publishes scans to RabbitMQ. Entry point of the solder line.
Tech: C#/.NET, RabbitMQ, TCP sockets.

**`th-supervisor` — Through-hole automation platform** · cluster `throughhole` · `sole` · major
Three-tier system driving automation for through-hole placement machines, running across 7 machines. A client library speaks the machine's protocol directly and is consumed by a worker; the worker and supervisor communicate over RabbitMQ. The supervisor receives messages, decides what logic is required, and instructs the worker; the worker tells the client what to send, and the client translates down to the machine. Messages from the machine bubble back up the same path. Containerized and deployed on Kubernetes via the sister team's monorepo, which this became the first consumer of.
Ownership: sole developer.
Tech: C#/.NET, RabbitMQ, Docker, Kubernetes, Helm, Jenkins, SMEMA, IPC-CFX, TCP sockets.
*Consider splitting into three nodes — client, worker, supervisor — with runtime edges between them. It is the second real topology on the site and currently the only one Peter built alone.*

**`cfx-dev-client` — RabbitMQ / CFX developer client** · cluster `tools` · `sole` · standard
Before this existed the team had no practical way to talk to RabbitMQ during development. Connects to any number of hosts, exchanges, and topics simultaneously, listens and publishes. Composes complete IPC-CFX messages from minimal input — supply two unit identifiers and it packages the remaining fields, so a developer can send a valid message without hand-writing the envelope. Built independently; now used by the entire four-person team.
Ownership: sole developer.
Tech: RabbitMQ, IPC-CFX, C#/.NET.

**`operator-console` — Operator monitoring console** · cluster `tools` · `contributor` · standard
Blazor application listening to RabbitMQ with live filtering over 5k+ events. Operators can enter board scans manually and restart a driver, but the drivers do not depend on it to run. Built while mentoring a junior developer through their first production service.
Metrics: escalations to engineering cut to near zero.
Tech: Blazor, RabbitMQ, C#/.NET.

**`maintenance-frontend` — Preventive maintenance platform (client)** · cluster `maintenance` · `sole` · major
React/MUI client caching 10k+ ID-linked records in Jotai for instant local editing with revert. Separate administrator and operator views.
Metrics: used by 30%+ of manufacturing.
Tech: React, TypeScript, Jotai.

**`maintenance-backend` — Preventive maintenance platform (services)** · cluster `maintenance` · `lead` · standard
Schema and REST API contract design for a platform reducing unplanned machine downtime: a four-level many-to-many hierarchy, frequency scheduling, and immutable execution records. Coordinated across frontend, backend, and DBA teams.
Ownership: schema and API design lead.
Tech: SQL, REST APIs, C#/.NET.

### Needs content from Peter (see `content-intake.md`)

`flying-probe` · `meter-zentra` · `meter-pipeline` · `vgclite` · `pokemon-team-builder` · `timesense` · `sonder-barber` · `thai-ginger` · `hackathon-2023` · `this-site`

## Project decisions

**CartPole, cut.** A tutorial follow-along in a Gym environment, not original work. Deliberately excluded from the portfolio; do not add it back.

## Hero metrics

1. **18%** — cycle time reduction · *+60 boards/day*
2. **30+** — machines and devices across 6 vendors · *machines, conveyors, cameras, SMEMA controllers*
3. **2 sites** — 6 production lines, running 24/7

The preventive maintenance adoption figure (30%+ of manufacturing) lives on the `maintenance-frontend` node where it has context, not in the hero.

## Positioning line

> I make factory machines talk, and I handle everything they say.
