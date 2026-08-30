# 05 — Pipeline simulator

The signature element. Build this last, build it carefully, and give it more time than
anything else on the site.

## What it is

An animated, interactive model of the event pipeline Peter owns in production. Events flow
continuously through a topology of nodes. The visitor can click nodes to learn what they do
and press buttons to inject failures and watch the system degrade and recover.

Everything is simulated client-side — a state machine and a tick loop. There is no backend.
It is an honest model of a real system, not a live feed, and the copy should never imply
otherwise.

## Vocabulary — this matters more than anything else in this doc

Label everything in **software** terms, not factory terms. Peter is positioning as a
distributed systems engineer and this component carries most of that weight.

| Use this | Not this |
|---|---|
| Producer | Machine / conveyor |
| Message broker | RabbitMQ server room |
| Consumer / worker | Driver service |
| Protocol adapter | SMEMA translator |
| Event sink | Database |
| Network partition | Cable unplugged |
| Backpressure | Line backup |
| Poison message | Bad scan |
| Consumer offline | Service restart |

One line of context sits beneath the component, and it is the only place the domain appears:

> This models a production system I own at SEL — a service topology that moves real-time
> events from industrial equipment into Azure. The failure buttons are the actual failure
> modes I had to design for.

That sentence does the credibility work. Everything above it stays in software vocabulary.

## Topology

```
  ┌──────────┐    ┌──────────────┐    ┌────────────┐    ┌──────────┐    ┌────────┐
  │ Producers│───▶│    Broker    │───▶│  Adapters  │───▶│Normalizer│───▶│  Sink  │
  │   ×3     │    │  (3 queues)  │    │     ×3     │    │  (CFX)   │    │ Azure  │
  └──────────┘    └──────────────┘    └────────────┘    └──────────┘    └────────┘
                         │                                                   │
                         └───────────── dead letter queue ◀──────────────────┘
```

- **Producers ×3** — emit events at a steady rate with slight jitter. Each represents a
  different equipment protocol.
- **Broker** — three visible queues with visible depth. Depth is the key affordance: when
  things go wrong, queues grow, and the visitor sees it.
- **Adapters ×3** — one per protocol, each translating into a common event shape.
- **Normalizer** — maps to the unified IPC-CFX schema.
- **Sink** — terminal. Shows a running count of delivered events.
- **Dead letter queue** — normally empty and dim. Lights up when a poison message lands.

## Message animation

Small rounded rectangles, `--ink` on `--shell-deep`, travelling along the edges. Each carries
a tiny mono label.

**Pacing: roughly one event every 1.2–1.8 seconds, 3–5 in flight at steady state.** This is
close to the real system's rate of about 40 messages per minute, and it is deliberately slow
enough that a visitor can follow a single event from producer to sink with their eyes. Do not
speed this up to look busy — a firehose would be both dishonest and less readable.

Animate with `transform: translate3d` on a `requestAnimationFrame` tick, not with CSS
keyframes per message. Pool and reuse DOM nodes; do not mount and unmount hundreds of
elements. Cap total in-flight messages and drop the tick rate when the component is off-screen
(`IntersectionObserver`).

## The message log

A panel on the right (below on mobile) showing a scrolling feed in Departure Mono:

```
14:02:41.208  producer.a    →  q.protocol.a     EVT_UNIT_ENTER      seq 88412
14:02:41.211  adapter.a     →  normalizer       ADAPTED             seq 88412
14:02:41.219  normalizer    →  sink             CFX.UnitsProcessed  seq 88412  ack
14:02:41.244  producer.c    →  q.protocol.c     EVT_UNIT_ENTER      seq 88413
```

Monotonic sequence numbers, plausible sub-millisecond timings, acks visible. Errors in
`--plum`. Auto-scrolls, pausable, and the pause state persists while the visitor reads.

## Metrics strip

Above the topology, four live counters in mono: **events processed**, **queue depth**,
**active connections**, **reconnect attempts**. They update continuously and react visibly to
failures — watching queue depth climb during a partition and drain on reconnect is the payoff.

**Removed deliberately:** throughput in msg/sec and p99 latency. Peter does not measure p99,
and a throughput figure would imply a scale this system does not have. Do not add them back.

## Failure injection — the part that sells him

Four buttons. Each one maps to something Peter actually built.

**1. Network partition** → drops the connection between an adapter and the broker.
- That queue's depth climbs visibly
- The adapter enters a retry state with a **visible countdown that doubles**: 1s, 2s, 4s, 8s,
  capped at 30s
- The reconnect attempt and its result appear in the log
- On reconnect, the queue drains quickly and depth returns to baseline
- **Maps to:** Peter's TCP reconnect, exponential backoff, and heartbeat hardening

**2. Consumer offline** → a worker stops consuming.
- Its queue depth climbs while the broker retains the messages
- The rest of the topology keeps flowing — the failure is isolated to one branch
- When the worker returns, it drains the backlog and depth falls
- **Maps to:** service topology and failure isolation
- **Honesty constraint:** the panel must state that message retention here is provided by
  RabbitMQ's queue durability, not by anything Peter wrote. Do not depict redelivery of an
  unacked in-flight message, do not use the phrase "at-least-once," and do not imply
  idempotency or dedup exist. Peter has not built those.

**3. Poison message** → injects a malformed event.
- It fails at the normalizer, retries a bounded number of times, then routes to the dead
  letter queue, which lights up
- The rest of the pipeline keeps flowing throughout
- **Maps to:** error isolation and graceful degradation

**4. Validation hold** → an event fails eligibility validation.
- The event is held at the adapter rather than passed downstream
- The upstream ready signal is **withheld**, so that producer pauses
- The rest of the topology continues
- Explicit log line explaining that holding is deliberate, not a failure
- **Maps to:** Peter's board-eligibility validation with SMEMA withholding — the most
  interesting decision on his resume and the one that is hardest to convey in text

A **reset** control returns everything to steady state.

## Node inspection

Click or focus any node to open a panel:
- What it does, in two sentences
- Its protocol or contract
- **What Peter built here**, specifically
- A link to the relevant case study

This is how the simulator earns its screen position — it is a navigation surface into the
real evidence, not just a toy.

## Accessibility — non-negotiable

- Every node is a `<button>` in the tab order with a descriptive accessible name
- Failure buttons are real buttons, operable by keyboard, with `aria-live="polite"` status
  announcements ("Network partition injected on adapter A. Queue depth rising.")
- The message log is an `aria-live="polite"` region, throttled to avoid flooding a screen
  reader — announce state changes, not every message
- **`prefers-reduced-motion: reduce`**: ambient message animation stops entirely. The component
  becomes a static topology diagram with the same clickable nodes, the same failure buttons,
  and a log that appends without animation. Every piece of information stays reachable.
  Add a manual "step" control so a visitor can advance the simulation one event at a time.
- Never rely on color alone. Failure states get an icon or a label, not just plum.

## Mobile

At 390px the topology stacks vertically and the message log collapses to a toggle. Reduce
in-flight messages to about 5. The failure buttons stay — they are the point, and they must be
tappable at a minimum 44px target.

## Build order

1. Static topology, correct layout, no motion
2. Tick loop and message movement
3. Metrics strip
4. Message log
5. Failure injection, one button at a time
6. Node inspection panels
7. Reduced-motion and keyboard modes
8. Performance pass — profile it, keep it at 60fps on a mid-range phone
