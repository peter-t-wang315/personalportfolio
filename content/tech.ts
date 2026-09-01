import type { TechNode } from './types';

/**
 * 25 nodes. Curated down from a 57-item skill list.
 *
 * Deliberately excluded and why:
 *  - Assumed (HTML, CSS, Git, Agile, code review): listing them is a negative signal.
 *  - Too thin to advertise (Java, C/C++, SQL Server, stored procedures, xUnit):
 *    a node implies proficiency and invites a question the depth won't survive.
 *  - Concepts, not technologies (microservices, event-driven architecture,
 *    distributed systems, message queues, API design, caching): these live on
 *    edges as `protocol` and `detail`, which is the point of the edge model.
 *  - Not graph material (Claude Code, mentoring, on-call, LaTeX, MUI, Radix, WPF):
 *    these belong on /about and the resume.
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

  // Messaging and protocols
  { id: 'rabbitmq', label: 'RabbitMQ', blurb: 'The backbone of every automation service I have written.' },
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
