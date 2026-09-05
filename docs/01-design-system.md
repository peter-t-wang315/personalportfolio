# Design system

## Direction

Warm, quiet, engineered. The site should feel like a well-made instrument, not a showcase. Boldness is spent in exactly two places: the display typography and the Nebula itself. Everything else stays disciplined.

The material reference is a printed circuit board on a warm paper background — cream stock, solder-mask green, the amber of a machine status lamp. This is drawn from the subject matter, not chosen for mood.

## Palette

```
--paper        #F4EEE0   page background
--paper-raised #FAF7EF   elevated surfaces: cards, panels, node interiors. Lighter than --paper — on a warm mid-tone ground, sinking reads muddy, so elevation floats toward white.
--paper-sunk   #EAE2D0   genuinely recessed wells only: code blocks, table stripes. Not for elevated surfaces.
--ink          #1C1917   primary text
--ink-muted    #5F5A4E   secondary text, captions
--ink-faint    #A8A08C   hairlines, disabled, tertiary
--mask         #1F4A3A   accent, solder-mask green. Links, focus rings, active nav, node cores.
--mask-tint    #E2E7DC   accent wash for backgrounds
--lamp         #C8862A   status amber. ONLY for live data flow on Nebula edges and "currently running" indicators. Never decorative.
```

Canonical values live in `lib/palette.ts` for the few places that can't read CSS variables (next/og image generation, R3F shader uniforms). Keep that file and this table in sync by hand when the palette changes.

Rules:
- No gradients anywhere except the node glass shader.
- No drop shadows. Depth comes from hairlines (`1px solid --ink-faint` at 30% opacity) and from the 3D layer.
- `--lamp` must never be used for a hover state, a link, or a button. It means "signal is moving." Diluting it kills the one place the site uses color semantically.
- Contrast: `--ink` on `--paper` is 15.1:1. `--mask` on `--paper` is 8.65:1. Both clear 7:1 (AAA).

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
| Hero display | Mono | `clamp(2.5rem, min(7vw, 9vh), 5.5rem)` | 400 | `-0.04em` | lowercase |
| Page title | Mono | `clamp(1.75rem, 4vw, 2.75rem)` | 400 | `-0.03em` | lowercase |
| Section head | Sans | `1.25rem` | 500 | `-0.01em` | sentence |
| Body | Sans | `1.0625rem` | 400 | `0` | sentence |
| Small / caption | Sans | `0.875rem` | 400 | `0` | sentence |
| Metric value | Mono | `2.25rem` | 400 | `-0.02em` | — |
| Metric label | Sans | `0.8125rem` | 400 | `0` | sentence |

Line height: 1.6 body, 1.15 display. Measure: max 68 characters.

The hero display size is bounded by viewport **height** as well as width. It
lives in a full-height hero beside the landing cluster, and a width-only clamp
ignored that: on a short wide laptop it held its 88px ceiling, ran to three
full-measure lines, pushed the link row below the fold, and covered the
cluster it is supposed to sit beside. The height term only binds when a
viewport is wide relative to its height, so phones stay width-bound at the
floor and tall monitors stay at the ceiling — both render identically to the
width-only clamp.

The desktop hero's vertical spacing has a matching compact step under the
`short-desktop` variant (`globals.css`, at least 1024px wide and at most 900px
tall): the gaps above the headline, the metrics and the link row all tighten,
because those were fixed pixel values that assumed height the screen does not
have. Phones and tablets are excluded by the width half of that condition —
their hero is a vertical stack that solves the same problem differently.

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

Non-user-triggered motion is limited to **four** things sitewide:

1. **Cursor parallax on the landing page.** The background cluster and every text block on `/` — hero and the section below it alike — translate in opposite directions at different rates as the pointer moves. Max displacement: 12px for text, 28px for the cluster. Eased with a spring, damping high enough that it feels weighted rather than floaty. Both figures are **pixels**, and must be implemented as pixels — the cluster's was once a world-unit constant, which projects through the camera's vertical FOV and so scaled with viewport height, measuring ±59px at 1440x900 against the 28 specified here.

**Touch drives the same parallax, from the finger.** A finger held on the hero moves the cluster exactly as a cursor does, and releasing recentres it. This is direct manipulation — the thing moving is the thing under the finger, caused by the viewer in the moment — so it carries none of the vestibular mismatch the next sentence is about. It needs its own `touchmove` listener: pointer events stop mid-gesture once the browser claims a drag for scrolling (`pointercancel`), which used to leave the parallax lurching once on touch-down and then frozen. See `app/pointer-tracker.tsx`.

Do not implement device-orientation tilt as a parallax source — it is a motion-sickness risk and an accessibility problem, not a stylistic tradeoff. That is a different thing from a finger drag: nothing is touching the screen, so the viewer is not the proximate cause of the motion. Two *non*-parallax tilt behaviours do exist; see Tilt-reactive behaviours below.
2. **Data flow along Nebula production edges.** Amber pulses traveling the line, ~4s period.
3. **The free-floating node simulation on `/nebula`.** Nodes drift continuously in a lightweight force simulation rather than sitting still — weak springs hold runtime-edge-connected pairs loosely together, everything else wanders freely. Hovering a node attracts its connected neighbours toward it; hover-out releases them. See `02-architecture.md` for the model and its freeze rule.
4. **The work-page subgraph gathering on `/work/[slug]`.** The project's connected subgraph (runtime-edge neighbours plus its tech nodes) gathers toward a focal point using the same attraction mechanic as hover, viewed from outside the constellation. It settles once and the simulation loop stops — no ongoing motion afterward.

The landing-page scroll cue is a separate, fifth motion, not counted above because it's a response to the user's own scroll position rather than an idle loop: three chevrons side by side at the base of the hero, each double-bobbing a few pixels then holding still for most of a ~3.6s cycle before repeating. Slightly staggered so they ripple rather than move as one. Part of the same parallax-transformed group as the hero text. Fades out over the first ~240px of scroll — that fade is scroll-linked and isn't gated by reduced motion, but the idle ripple itself is (see below).

Everything else is response to action: fly-in, panel open, hover.

No fade-and-slide-up entrance on every section. No hover transition on every card. Those are the generated-page default.

Standard easing: `cubic-bezier(0.32, 0.72, 0, 1)`. Standard duration: 240ms for UI, 1400ms for camera flights.

### Tilt-reactive behaviours

Two behaviours on touch devices respond to device orientation. **Neither is
parallax, and neither weakens the prohibition in motion item 1 above** — that
rule stands exactly as written, and nothing may drive the cluster's or the
camera's *position* from device orientation.

The distinction is not a loophole, it is the whole basis of the rule. Motion
sickness from device-orientation input is a vestibular mismatch: the inner ear
reports one motion while the eyes are shown a scene translating through space
under a different one. Neither of these moves anything through space.

1. **Phrase-label nudge.** The mobile/tablet cycling label offsets by at most
   6px with tilt. A DOM text element shifting a few pixels is not a moving
   scene, and the amplitude is kept small anyway — the cluster behind it does
   not move at all, so a large offset would read as the text sliding off its
   own graph.
2. **Node shell sheen.** The fresnel material's highlight direction shifts with
   tilt, like light catching glass as the device turns. This is a *lighting*
   response: only where the highlight falls on the surface changes, and no
   geometry, camera or position is touched. There is no vestibular mismatch at
   any amplitude, so this one is not held to item 1's minimalism.

Both are gated on `prefers-reduced-motion` and on a coarse pointer, both
calibrate their zero point from the first reading rather than assuming the
device is held flat, and both clamp so a hard tilt saturates rather than
flinging anything. On iOS 13+ the sensor requires
`DeviceOrientationEvent.requestPermission()` from a user gesture; until that is
granted, and on any device without the sensor, both render exactly as they did
before these existed. Implementation in `lib/device-tilt.ts`.

`prefers-reduced-motion: reduce` disables cursor parallax, edge pulses, the float simulation (nodes render frozen at their seeded initial layout position), the work-page gathering (renders already-settled, no animation), the scroll-cue ripple, both tilt-reactive behaviours above, and camera interpolation (flights become instant cuts). The site must be fully usable with all motion off.

## Accessibility floor

- Visible focus ring: `2px solid var(--mask)`, `2px` offset, on every interactive element.
- Every Nebula node is reachable by keyboard. Tab order follows the ordering in the content file.
- The Nebula has a `role="application"` wrapper with an adjacent, always-present link to the equivalent list view.
- All project content exists as real DOM at `/work/[slug]` regardless of the 3D layer.
- Images have alt text. The site works with WebGL unavailable.
