# 02 — Design direction

Peter chose **warm retro-modern**: muted palette, soft grain, handheld-console adjacent.
This document is a starting point with a clear point of view, not a locked spec. Push back
in Phase 1 if you can justify something better, but justify it against the brief.

## The core idea

The reference is the **physical device**, not the game. A 1989 handheld console's molded
plastic shell, its screen-print labels, its four-value LCD ramp, its warm putty-and-maroon
color scheme. Materials and hardware, not cartoon characters. That reads as considered
industrial design rather than as fan art — and it quietly rhymes with Peter's actual work,
which is also about talking to physical machines.

Deliberately avoided: cream-and-terracotta with a big serif (the current AI-design default),
neon-on-black dev-portfolio, and literal LCD green as a background.

## Palette

Six values. Warm throughout, low saturation, one signal color.

| Token | Hex | Role |
|---|---|---|
| `--shell` | `#E3DED2` | Page background. Warm putty, the console's plastic. |
| `--shell-deep` | `#CFC8B9` | Cards, wells, the storage grid backing. |
| `--ink` | `#1F1E1A` | Primary text. Warm near-black, never pure `#000`. |
| `--graphite` | `#6E6C63` | Secondary text, captions, metadata. |
| `--plum` | `#7C3A55` | **Signal color.** Links, active states, the one thing that pops. |
| `--moss` | `#7F8E63` | The screen-green, heavily muted. Reserved for the game layer only. |

Rules:
- `--plum` is scarce. If more than roughly 5% of a screen is plum, cut something.
- `--moss` appears only inside the storage grid and creature art. It never touches body copy,
  headings, or the simulator.
- Dark mode is optional and low priority. If built, invert to a warm charcoal (`#1F1E1A` base,
  `#E3DED2` text), keep plum, brighten moss slightly.

### The four-value ramp

The console's LCD had exactly four values. Use that as a real constraint for the game layer:
creature sprites and storage tiles render in four steps only, derived from `--moss`:
`#C8CFAE` / `#9CAA7C` / `#7F8E63` / `#48533A`. This constraint is what will make AI-generated
sprites look intentional instead of sloppy — enforce it by quantizing every sprite to these
four colors.

## Typography

Three roles, three faces.

- **Display — Bricolage Grotesque** (variable, Google Fonts). Has genuine character in its
  wider optical widths without being a novelty face. Use at large sizes with tight tracking,
  weight 600–800, width axis pushed slightly wide on the hero only.
- **Body — Inter Tight.** Neutral, workmanlike, gets out of the way. 16–18px, 1.6 line height,
  max 68 characters per line.
- **Utility — Departure Mono** (free, self-hosted). A genuine pixel monospace. This is where
  the retro signal lives: section eyebrows, data labels, the simulator's message log, tech
  stack tags, timestamps.

The key move: **the pixel-ness is carried by the mono face, not by a novelty display font.**
No game-logo typefaces anywhere. That single decision is most of what separates this from a
fan site.

Type scale: 12 / 14 / 16 / 18 / 24 / 32 / 48 / 72. Do not add sizes between these.

## Texture

- A fine grain overlay across the page — SVG `feTurbulence`, `baseFrequency` around 0.8,
  opacity 0.03–0.05, `mix-blend-mode: multiply`. Static. Never animated.
- Card edges get a 1px `--shell-deep` border and a very slight inner highlight at the top,
  the way molded plastic catches light. No drop shadows with blur radii over 12px.
- Border radius: 4px on small elements, 10px on cards. Nothing fully rounded. Nothing square.

## Motion

Governed by the `emil-kowalski` skill. Read it before writing any animation. Summary of what
this brief expects:

- Transform and opacity only. Never animate layout properties.
- Enters: 200–300ms, ease-out. Exits: 150ms, ease-in. Springs for anything the user
  directly manipulates.
- Scroll reveals: one per section maximum, a short fade with 8–12px of upward travel.
  No staggered cascades of twelve elements.
- No scroll-jacking, no parallax, no page-load spinner, no typewriter text.
- `prefers-reduced-motion: reduce` disables all of it, including the simulator's ambient
  animation — the simulator must remain fully usable in a stepped, static mode.

Ambient motion is allowed in exactly one place: the pipeline simulator. Everywhere else the
page is still until the user does something.

## The signature element

The pipeline simulator. All boldness is spent here. Everything surrounding it stays quiet and
disciplined so it lands. If a design choice elsewhere competes with it for attention, cut the
choice.

## Voice

Plain, specific, a little dry. Peter's own register: direct, no hedging, no filler.
Sentence case everywhere. Active voice. Buttons say what happens.

Say "I built a service that translates between twelve machine protocols." Do not say
"Passionate engineer crafting elegant solutions."
