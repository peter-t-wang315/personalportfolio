import type { TechNode } from './types';

/**
 * 31 nodes. Curated down from a 57-item skill list, then reopened once the
 * project write-ups were corrected against what the services actually do.
 *
 * Deliberately excluded and why:
 *  - Assumed (HTML, CSS, Git, Agile, code review): listing them is a negative signal.
 *  - Too thin to advertise (Java, C/C++, SQL Server, stored procedures, xUnit):
 *    a node implies proficiency and invites a question the depth won't survive.
 *  - Concepts, not technologies (microservices, event-driven architecture,
 *    distributed systems, message queues, API design, caching): these live on
 *    edges as `protocol` and `detail`, which is the point of the edge model.
 *  - Not graph material (Claude Code, mentoring, on-call, LaTeX, Radix, WPF,
 *    Serverless Framework): these belong on /about, the resume, or a project's
 *    body prose.
 *
 * **MUI was on that last list and is not any more**, which is worth recording
 * rather than quietly reversing. It was excluded as a UI library rather than a
 * technology, on one project. The corrections since put it on three — the
 * preventive maintenance client (which uses it and plain CSS, not Tailwind, as
 * this file previously implied), the flying probe dashboard, and ZENTRA — and a
 * library carrying three projects is load-bearing enough to be a node. The same
 * reasoning added MudBlazor, TanStack Query and React Router.
 *
 * **MQTT and Three.js are here for the opposite reason**: neither was ever
 * excluded, both were simply missed. MQTT is how the solder driver reaches its
 * machine, which makes it a protocol in exactly the sense SMEMA and IPC-CFX
 * are. Three.js is what this site is built out of.
 *
 * **The order of this array is load-bearing.** `content/layout.ts` maps each
 * index onto a point of a Fibonacci sphere, so inserting a node moves every
 * node after it — and, through the usage bias, most of the ones before it too.
 * Adding to this file re-lays out the constellation and invalidates the
 * measured interior composition in `app/nebula-canvas.tsx`. Re-run the arrival
 * search and the pixel gate (`checks/`) after touching it.
 */
export const tech: TechNode[] = [
  // Languages and runtimes
  { id: 'csharp', label: 'C# / .NET', blurb: 'Primary language for every production service I own.' },
  { id: 'typescript', label: 'TypeScript', blurb: 'Every frontend I have shipped, and most of what I build outside work.' },
  { id: 'python', label: 'Python', blurb: 'Serverless data pipelines and Django reporting work.' },
  { id: 'rust', label: 'Rust', blurb: 'Native process polling and the SQLite layer behind a Tauri desktop app.' },
  { id: 'sql', label: 'SQL', blurb: 'Relational schema design for maintenance scheduling and execution records.' },

  // Frontend
  { id: 'react', label: 'React', blurb: 'Operator dashboards, internal platforms, and personal projects.' },
  { id: 'nextjs', label: 'Next.js', blurb: 'App Router, route handlers, server-side caching. Everything personal runs on it.' },
  { id: 'redux', label: 'Redux', blurb: 'Machine state for the flying probe control dashboard.' },
  { id: 'jotai', label: 'Jotai', blurb: 'Atom-level caching of 10k+ linked records for instant local editing.' },
  { id: 'blazor', label: 'Blazor', blurb: 'Operator-facing RabbitMQ monitoring with live filtering.' },
  { id: 'tailwind', label: 'Tailwind CSS', blurb: 'Styling layer on every recent frontend.' },
  { id: 'mui', label: 'Material UI', blurb: 'Component layer on the maintenance platform, the flying probe dashboard, and ZENTRA.' },
  { id: 'mudblazor', label: 'MudBlazor', blurb: 'Component layer on both Blazor tools, the operator console and the developer client.' },
  { id: 'tanstack-query', label: 'TanStack Query', blurb: 'Server-state caching and invalidation on ZENTRA.' },
  { id: 'react-router', label: 'React Router', blurb: 'Client routing on the flying probe dashboard and CodeLingo.' },
  { id: 'threejs', label: 'Three.js', blurb: 'The constellation on this site, through React Three Fiber.' },

  // Messaging and protocols
  { id: 'rabbitmq', label: 'RabbitMQ', blurb: 'The backbone of every automation service I have written.' },
  { id: 'mqtt', label: 'MQTT', blurb: 'How the selective solder driver talks down to its machine, over a TCP connection it holds open.' },
  { id: 'ipc-cfx', label: 'IPC-CFX', blurb: 'The common message format proprietary machine protocols get normalised into.' },
  { id: 'smema', label: 'SMEMA', blurb: 'Hardware handshake governing board handoff between machines and conveyors.' },
  { id: 'tcp', label: 'TCP sockets', blurb: 'Direct machine communication, with reconnect, backoff, and heartbeat.' },
  { id: 'rest', label: 'REST APIs', blurb: 'Service-to-service contracts across internal platforms.' },

  // Infrastructure
  { id: 'docker', label: 'Docker', blurb: 'Containerised every service I have deployed.' },
  { id: 'kubernetes', label: 'Kubernetes', blurb: 'Production deployment across multiple lines and sites.' },
  { id: 'helm', label: 'Helm', blurb: 'Per-machine release configuration.' },
  { id: 'jenkins', label: 'Jenkins', blurb: 'Build and deploy pipelines for automation services.' },

  // Cloud and data
  { id: 'lambda', label: 'AWS Lambda', blurb: 'Scheduled serverless ingestion and prediction jobs.' },
  { id: 'dynamodb', label: 'DynamoDB', blurb: 'Time-series storage for environmental sensor data.' },
  { id: 'azure', label: 'Azure', blurb: 'Telemetry destination for production automation services.' },
  { id: 'splunk', label: 'Splunk', blurb: 'Structured logging and production diagnostics.' },
  { id: 'django', label: 'Django', blurb: 'Reporting queries across 150k+ object relationships.' },
];
