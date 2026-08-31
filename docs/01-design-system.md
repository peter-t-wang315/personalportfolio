# Design system

## Direction

Warm, quiet, engineered. The site should feel like a well-made instrument, not a showcase. Boldness is spent in exactly two places: the display typography and the Nebula itself. Everything else stays disciplined.

The material reference is a printed circuit board on a warm paper background — cream stock, solder-mask green, the amber of a machine status lamp. This is drawn from the subject matter, not chosen for mood.

## Palette

```
--paper        #F7F5F0   page background
--paper-sunk   #F1EEE7   recessed surfaces, code blocks, table stripes
--ink          #171614   primary text
--ink-muted    #5C5A54   secondary text, captions
--ink-faint    #9B9890   hairlines, disabled, tertiary
--mask         #1F4A3A   accent — solder-mask green. Links, focus rings, active nav, node cores.
--mask-tint    #E4EBE7   accent wash for backgrounds
--lamp         #C88A2E   status amber. ONLY for live data flow on Nebula edges and "currently running" indicators. Never decorative.
```

Rules:
- No gradients anywhere except the node glass shader.
- No drop shadows. Depth comes from hairlines (`1px solid --ink-faint` at 30% opacity) and from the 3D layer.
- `--lamp` must never be used for a hover state, a link, or a button. It means "signal is moving." Diluting it kills the one place the site uses color semantically.
- Contrast: `--ink` on `--paper` is 14.8:1. `--mask` on `--paper` is 8.9:1. Both pass AAA.

## Typography

Two faces, both from the Geist family, used in deliberately inverted roles.

```
--font-display  Geist Mono     (next/font/google or geist package)
--font-body     Geist Sans
```

**Geist Mono is the display face.** Set large, lowercase, tracked tight. A headline should read like a log line printed at poster scale. This is the signature move of the site — it is subject-grounded (Peter's work is messages on a wire) and it avoids the high-contrast-serif-on-cream treatment that reads as templated.

**Geist Sans is the body face.** Neutral, gets out of the way.

Do not use mono for small data labels. That's the conventional use and it would cancel the inversion. Small labels are sans.

### Scale

| Role | Face | Size | Weight | Tracking | Case |
|---|---|---|---|---|---|
| Hero display | Mono | `clamp(2.5rem, 7vw, 5.5rem)` | 400 | `-0.04em` | lowercase |
| Page title | Mono | `clamp(1.75rem, 4vw, 2.75rem)` | 400 | `-0.03em` | lowercase |
| Section head | Sans | `1.25rem` | 500 | `-0.01em` | sentence |
| Body | Sans | `1.0625rem` | 400 | `0` | sentence |
| Small / caption | Sans | `0.875rem` | 400 | `0` | sentence |
| Metric value | Mono | `2.25rem` | 400 | `-0.02em` | — |
| Metric label | Sans | `0.8125rem` | 400 | `0` | sentence |

Line height: 1.6 body, 1.15 display. Measure: max 68 characters.

### Prohibited typographic treatments

These read as generated. Do not use any of them:
- ALL CAPS labels or tracked-out eyebrows above headings.
- Accenting one word in a headline with color, italic, or weight.
- Meta strings joined with middle dots (`A · B · C`).
- `→` appended to link or button text.
- `WORD — fragment` constructions with a spaced em dash.
- Numbered markers (01 / 02 / 03) unless the content is genuinely a sequence.

## Layout

- Content column: `max-width: 66ch`, left-aligned. Never centered body text.
- Page gutter: `clamp(1.5rem, 5vw, 4rem)`.
- Vertical rhythm on an 8px base. Section spacing `6rem` desktop, `3.5rem` mobile.
- Border radius: `4px` on interactive controls, `0` on content containers. The only round things on the site are the nodes.

## Motion

Non-user-triggered motion is limited to **three** things sitewide:

1. **Cursor parallax on the landing page.** The background cluster and every text block on `/` — hero and the section below it alike — translate in opposite directions at different rates as the pointer moves. Max displacement: 12px for text, 28px for the cluster. Eased with a spring, damping high enough that it feels weighted rather than floaty.
2. **Data flow along Nebula production edges.** Amber pulses traveling the line, ~4s period.
3. **The scroll cue on the landing page.** Three chevrons side by side at the base of the hero, each double-bobbing a few pixels then holding still for most of a ~3.6s cycle before repeating — a periodic nudge rather than continuous idle motion. Slightly staggered so they ripple rather than move as one. Part of the same parallax-transformed group as the hero text. Fades out over the first ~240px of scroll — a response to the user's own scroll input, not an idle loop, so it isn't gated by reduced motion.

Everything else is response to action: fly-in, panel open, hover.

No fade-and-slide-up entrance on every section. No hover transition on every card. Those are the generated-page default.

Standard easing: `cubic-bezier(0.32, 0.72, 0, 1)`. Standard duration: 240ms for UI, 1400ms for camera flights.

`prefers-reduced-motion: reduce` disables cursor parallax, edge pulses, the scroll-cue ripple, node drift, and camera interpolation (flights become instant cuts). The site must be fully usable with all motion off.

## Accessibility floor

- Visible focus ring: `2px solid var(--mask)`, `2px` offset, on every interactive element.
- Every Nebula node is reachable by keyboard. Tab order follows the ordering in the content file.
- The Nebula has a `role="application"` wrapper with an adjacent, always-present link to the equivalent list view.
- All project content exists as real DOM at `/work/[slug]` regardless of the 3D layer.
- Images have alt text. The site works with WebGL unavailable.
