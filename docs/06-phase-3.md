# Phase 3 — polish

Estimated 15–20 hours. Ordered by value. Ship them individually; none of them block the others.

## 1. Guided tour — build this first

The highest-value feature for the recruiter audience and the cheapest thing in this document.

A control in the corner of `/nebula`: **"Take the tour."** Auto-flies through five nodes in sequence, opening each panel, pausing ~8 seconds, then moving to the next. Progress indicator. Any interaction cancels it and hands control back.

Suggested order — strongest first, and it tells a coherent story:
1. Through-hole automation platform (built alone, real topology)
2. Selective solder driver (the 18% number, the failure path)
3. Preventive maintenance platform, client (adoption, Jotai)
4. RabbitMQ / CFX developer client (built it for the team unprompted)
5. TimeSense (hackathon win — ends on something human)

Fires the `tour_started` and `tour_completed` analytics events.

## 2. ⌘K search

Command palette over every node. Fuzzy match on title, one-liner, and technology. Enter flies to the result. Also reachable by a visible control, since not everyone knows the shortcut.

## 3. Edge detail on hover

If not already done in Phase 2. A small DOM tooltip on runtime edges showing `protocol` and `detail`. This is where the deepest technical content lives — the TCP reconnect/backoff/heartbeat hardening, the structured error exchange, the SMEMA withholding on board-eligibility failure.

Worth building carefully. It is the only place on the site where the interaction model itself surfaces engineering depth.

## 4. Particle field

Counts and implementation approach are governed by `02-architecture.md`'s Performance budget and Responsive tiers table — this section doesn't restate them.

**Watch the contrast.** Dark dots at low opacity on cream read as dust or dead pixels. Use `--ink-faint` at very low opacity and test on a real display before committing. If it looks like dirt, cut it — this is the most expendable item here.

## 5. Depth of field

Only if measured framerate allows. `@react-three/postprocessing` DOF on the background during focus.

Be skeptical. On a low-contrast cream scene the effect is barely legible, and it costs a full pass on top of the focused node's transmission — desktop only, per `02-architecture.md`'s Responsive tiers table. The cheaper alternative already specified in Phase 2 — fading and desaturating unfocused nodes — may read better. **Prototype both and compare before keeping this.**

## 6. Audio

Subtle, short, off by default with a visible toggle that persists in `localStorage`.
- Entering the nebula: one soft low tone.
- Node open: a brief click with a short tail.
- Rotation: nothing. Continuous ambient audio during drag is the thing that makes people close a tab.

Respect `prefers-reduced-motion` as a proxy signal and default audio off when it is set.

## 7. Analytics review

After a few weeks of applications, check `node_opened` and `tour_completed`. If nobody enters the nebula, the landing page is doing the work and further investment here has no return. That is a real possible outcome and worth knowing.

## Explicitly not doing

- Dark mode.
- Contact form.
- Blog.
- A physics simulation for node motion. Seeded deterministic drift looks the same and costs nothing.
