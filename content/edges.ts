import type { Edge } from './types';
import { projects } from './projects';

/**
 * RUNTIME EDGES.
 *
 * These are real message paths between services in production. This is the
 * claim that makes the whole site work — a visitor tracing these is reading an
 * accurate architecture diagram, not a metaphor.
 *
 * `detail` is where architectural concepts live. They were deliberately kept
 * off the technology node list so they could live here instead.
 */
export const runtimeEdges: Edge[] = [
  // --- Selective solder line -------------------------------------
  {
    id: 'e-scanner-boarddata',
    from: 'scanner-driver',
    to: 'board-data-service',
    kind: 'runtime',
    protocol: 'RabbitMQ',
    detail:
      'Scans are published as events rather than requested. The scanner has no idea who consumes them, which is what allowed the line to grow a third service without touching the first.',
  },
  {
    id: 'e-boarddata-solder',
    from: 'board-data-service',
    to: 'solder-driver',
    kind: 'runtime',
    protocol: 'RabbitMQ / IPC-CFX',
    detail:
      'Resolved board identity arrives normalised to IPC-CFX. The driver never learns how the data was fetched — only what came back — which keeps external API changes out of protocol code.',
  },
  {
    id: 'e-solder-console',
    from: 'solder-driver',
    to: 'operator-console',
    kind: 'runtime',
    protocol: 'RabbitMQ',
    detail:
      'Structured error events go to a dedicated exchange so an operator sees the specific failure reason. The console can inject a manual scan and restart the driver, but the driver does not depend on it — if the console is down, production is not.',
  },

  // --- Through-hole automation platform ---------------------------
  {
    id: 'e-supervisor-worker',
    from: 'th-supervisor',
    to: 'th-worker',
    kind: 'runtime',
    protocol: 'RabbitMQ',
    detail:
      'The supervisor decides, the worker executes. Machine messages bubble back up the same path. Separating decision-making from transport means the logic can change without touching protocol code.',
  },
  {
    id: 'e-worker-client',
    from: 'th-worker',
    to: 'th-client',
    kind: 'runtime',
    protocol: 'In-process (library)',
    detail:
      'The client is consumed as a library inside the worker and is the only component that knows the machine\'s native protocol. TCP reconnect, exponential backoff, and heartbeat live here, so a dropped socket recovers without operator intervention.',
  },

  // --- Preventive maintenance -------------------------------------
  {
    id: 'e-pm-client-services',
    from: 'maintenance-client',
    to: 'maintenance-services',
    kind: 'runtime',
    protocol: 'REST',
    detail:
      'The client cache is the working copy. Edits across the machine → checklist → section → task hierarchy accumulate locally and reconcile on commit, which is what makes multi-level revert possible.',
  },

  // --- Flying probe ------------------------------------------------
  {
    id: 'e-flying-probe-internal',
    from: 'flying-probe',
    to: 'flying-probe',
    kind: 'runtime',
    protocol: 'REST (polling)',
    detail:
      'Operator input goes to a backend that speaks to the machine; responses return by polling. No message bus here — this system is deliberately self-contained so one operator and one instance can run a machine end to end.',
  },
];

/**
 * DEV-TIME EDGES.
 *
 * Not production paths. Rendered dashed, with a slower pulse, so the
 * distinction is visible without a legend.
 */
export const devTimeEdges: Edge[] = [
  {
    id: 'e-cfx-solder',
    from: 'cfx-dev-client',
    to: 'solder-driver',
    kind: 'dev-time',
    protocol: 'RabbitMQ / IPC-CFX',
    detail:
      'Injects synthetic CFX messages during development so a driver can be exercised without a real machine producing a real board.',
  },
  {
    id: 'e-cfx-supervisor',
    from: 'cfx-dev-client',
    to: 'th-supervisor',
    kind: 'dev-time',
    protocol: 'RabbitMQ / IPC-CFX',
    detail:
      'Any service on the bus can be driven from here. Building it once meant every driver after it was testable from the first day.',
  },
];

/**
 * SHARED-TECH EDGES — derived, never hand-written.
 *
 * A project connects to each technology it uses. Rendered as hairlines with no
 * animation. If these ever compete visually with runtime edges, drop their
 * opacity — the asymmetry is the entire point.
 */
export function deriveSharedTechEdges(): Edge[] {
  return projects.flatMap((p) =>
    p.techIds.map((techId) => ({
      id: `e-tech-${p.id}-${techId}`,
      from: p.id,
      to: techId,
      kind: 'shared-tech' as const,
    })),
  );
}

export const edges: Edge[] = [
  ...runtimeEdges,
  ...devTimeEdges,
  ...deriveSharedTechEdges(),
];
