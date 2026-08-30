# 01 — Brief

## Who this is for

Peter, Software Engineer II at Schweitzer Engineering Laboratories. Two years of experience.
Builds C#/.NET services that move events between industrial equipment and cloud systems.

## The one job this site does

Convince a recruiter or hiring manager at a mid-size or large tech company, in under sixty
seconds, that Peter is a **backend / distributed systems engineer** with real production
ownership — and give them something memorable enough that they remember the site a day later.

Target companies, in priority order: Rocket Companies, T-Mobile, DoorDash, Redfin.
Roles are SWE I / SWE II, backend and full-stack.

## Positioning — read this twice

Peter is a distributed systems engineer **who happens to work in manufacturing**. He is not a
manufacturing engineer. The domain is where the constraints come from, not what he is.

Lead with the systems properties Peter actually owns: event-driven architecture, protocol
adapters, connection resilience with exponential backoff and heartbeats, service topology,
validation gating with physical consequences, schema normalization across heterogeneous
sources. Those are the words a DoorDash backend screen is looking for.

**Do not claim delivery guarantees.** Peter has not built dedup, idempotency, or drop
detection. "At-least-once," "exactly-once," "no message loss," and "guaranteed delivery" are
forbidden on this site. See the honesty rules at the top of `docs/04`.

**Do not imply scale.** Real volume is roughly 40 messages per minute. Never put a
messages-per-second figure anywhere. Volume is not the story and claiming it invites a
question that undercuts everything else.

The story is **heterogeneity, continuous operation, and physical consequence**: twelve
machines, three vendor protocols, two sites, six lines, running around the clock, where a
wrong call holds or releases actual hardware. That is a harder correctness problem than most
CRUD experience, and it does not depend on throughput.

Concretely: the site should read "backend engineer, event-driven services, protocol
integration" first, and "at an industrial equipment manufacturer" second. If a draft ever
reads "factory automation portfolio," it is wrong.

## The concept

Three layers, in this order of importance:

1. **Editorial-modern base.** Restrained, well-typeset, professionally designed. This is
   where the credibility comes from.
2. **The pipeline simulator.** An interactive, animated model of the message pipeline Peter
   owns in production, with buttons that inject failures. This is the signature element and
   the thing people remember. Full spec in `docs/05`.
3. **A game-console-inspired project index.** Projects presented as collectible creatures in
   a storage grid, one click to a full case study. Personality layer. Original art only.

The theme is a skin over an ordinary, accessible project index. It must never become a maze.

## First impression

Peter chose **balanced**: credibility and character together above the fold. The hero should
carry the professional claim and the personality in the same view rather than sequencing them.
A recruiter should not have to scroll to learn what he does, and should not have to scroll to
see that the site has a point of view.

## What success looks like

- A stranger understands what Peter does within one screen, with no scrolling.
- Any project is reachable in one click from the landing page.
- The simulator gets played with, not just watched.
- Someone screenshots it and sends it to a colleague.
- It loads fast on a phone on cell service.

## What failure looks like

- It reads as a themed novelty site and the engineering gets discounted.
- The pixel art reads as hobby-grade and drags the whole thing down with it.
- Navigation requires understanding a reference.
- It looks like every other developer portfolio.
