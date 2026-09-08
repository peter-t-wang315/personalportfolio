# Continuous space — one world, one camera

**Status: planned, not built.** Everything in `02-architecture.md` and
`05-phase-2.md` describes what currently ships. This document describes what
replaces it, and why. Nothing here is true yet.

## The premise

The site pretends to be a place. Right now it is not one.

What actually happens when a visitor "flies into the nebula" is that the
constellation **grows**. On `/` it is drawn at 29% scale, parked 14 units
behind the origin; on `/nebula` it is life-size at the origin. The arrival
interpolates between those two transforms while the camera moves about six
units. Almost all of the apparent motion is the object inflating around a
nearly stationary viewer.

It reads well enough, and it was the right call at the time — 2.5 needed an
arrival, not a world. But it has a ceiling, and we have reached it. You cannot
turn around inside the graph and see where you came from, because *there is no
"where you came from"*: the landing page is a different transform of the same
object, not a different place. And every mechanism that copes with a graph
whose size changes — the rotation unwind, the centring spring, the split
between flight durations — exists to paper over that.

The replacement is simpler to describe than what it replaces:

> There is one world. The graph sits at the origin at life size and never
> moves. The home page is an object in that world, off to one side. `/`,
> `/work/[slug]` and `/nebula` are three places to stand. Going between them
> moves the camera and nothing else.

## What you see from each standing point

**From home.** The hero, ahead and filling the left of the frame. Past it and
off to the right, small and hazed by distance, the sphere of nodes.

**Flying in.** The camera moves forward and right, passing the hero on its
left — genuinely passing it, not watching it shrink — and continues until it
is inside the shell.

**From inside.** Nodes on every side. Turn back the way you came and the home
page is still there, behind the far wall, small and faint and seen *through*
the translucent shells between you and it.

**Going home.** The camera is pulled back along the line it came in on. No
orbit, no path solving: a string to the standing point. If the visitor had
turned to look back at home, they are already facing the direction of travel
and arrive facing the hero; the settle onto the home heading happens over the
last part of the retreat, not as a separate beat after it lands.

## The numbers this rests on

The sphere's apparent size is now set by camera distance rather than by scale,
so the distances are fixed by the compositions we already have.

At FOV 45 on a 900px-tall viewport, one world unit covers `1086 / d` pixels at
distance `d`. The shell's radius is 11, and it currently draws at a 160px
radius on the landing page and 212px on a work page. So:

| standing point | required distance to the shell's centre |
| --- | --- |
| `/` | **~74 units** |
| `/work/[slug]` | **~56 units** |

**Fog erases both.** `FOG_NEAR = 27`, `FOG_FAR = 48`, fogged to paper — the
same colour as the background — so anything past 48 units is not dimmed, it is
gone. The band has to be re-derived before any of this is visible at all. That
is Part 1, and it blocks everything.

**How large home looks from inside is a free parameter.** If the hero plane
sits distance `p` in front of the standing point, it appears from the shell's
centre at roughly `p / (74 − p)` of its at-home size: 19% at `p = 12`, 51% at
`p = 25`, larger than life past 37. The plane grows physically as `p` grows, so
it still fills the same part of the frame from home either way. The only hard
constraint is that it must not reach the sphere. Pick `p` by looking.

**One thing worth knowing about today's arrival.** `HOME_POSE` is at (0, 0, 9),
and at full size the shell's nearest node sits at 10.08. The landing camera is
therefore already *inside* the graph's volume — what happens on the way in is
that the shell expands past the viewer. Nobody has ever noticed, but it means
the current geometry cannot be reused as "where home is": home has to be placed
further out than the camera has ever stood.

## The hero as an object

The home page is HTML, and HTML has no position in 3D. So what you see from
inside the graph is a **stand-in**: a plane at the home location carrying an
image of the hero column, depth-tested against the nodes so they occlude it
properly.

It is scenery, not content. The real hero stays authoritative for text
selection, SEO, and keyboard navigation, and is what you read when standing at
home. The two cross-fade in a band near the standing point, where they are
close enough in size and position that the swap has nowhere to show.

Deliberately **not** drei's `<Html transform>`. That renders real DOM in CSS3D
at a 3D position, which sounds like exactly what we want and is not: CSS3D
composites over the WebGL canvas rather than into it, so it cannot be occluded
by geometry except through raycast hacks, and it can never be refracted. It
also forces a compositing layer for the whole hero, which is the last thing a
mid-range phone needs.

## Transmission comes back

2.5 removed transmission from every tier because the canvas is `alpha: true`
over a CSS paper background: there was nothing *in the scene* behind the glass,
so it transmitted the void and rendered white.

That is no longer true. Once the home page is an object in the world, the
shells have something behind them to bend. "A morphed version of the home page
through the translucent sphere" is not a new effect to invent — it is the
effect that was already built and had to be switched off for want of anything
to refract.

It is still expensive: transmission costs a render pass. Desktop only, gated on
the tier table, and measured before it ships.

## What this deletes

Worth stating plainly, because it is most of the argument for doing it:

- **The rotation unwind tied to placement.** Exists so a work page's turn is
  exactly undone by the time the graph is life-size. With one fixed world there
  is no "life-size moment" to be undone by.
- **The centring spring for the solved composition.** Exists because centre,
  vertical offset and scale all change together when a project is spotlit.
  Camera moves replace all three.
- **The split between `FLIGHT_DURATION_MS` and `FOCUS_FLIGHT_DURATION_MS`.**
  Two durations for two kinds of move, where the difference was really that one
  of them was not a move at all.
- **`lib/use-cluster-screen.ts`.** It re-derives the graph's screen circle
  independently of the scene and is already wrong by two terms on work pages.
  The scene publishes the real circle every frame for the drag
  (`app/nebula-drag-state.ts`); everything should read that instead.

## What gets harder

**The landing composition is measured, and it is the risk.** Today the sphere's
on-screen size comes from viewport height and its centre is solved in pixels to
clear the text column, with named behaviours for short viewports, narrow
viewports, and the label-drawing routes. None of that goes away — it gets
re-expressed as camera distance and lateral offset. The solve is equivalent;
the rewiring is where the bugs will be. `sweep.mjs` covers five viewports for
exactly this reason and should run throughout, not at the end.

**Two pixel-exact guarantees ride on the current design.** Arriving at
`/nebula` from a turned work page is identical to arriving directly (0
differing pixels of 59,223), and the spotlight labels' placement is measured to
the pixel across four widths. Both must survive, and both are stated in terms
of a composition that is about to be built differently.

**Performance should be flat, and that is worth checking rather than
assuming.** The scene is the same 45 spheres and the same edges. The sphere is
not drawn larger on the landing page — it is the same apparent size, reached by
distance instead of scale — so fragment cost is unchanged. The stand-in is one
mesh. The only new cost is Part 6's transmission, which is tier-gated. The 2.8
budget of 30fps on a mid-range phone should be unaffected.

## The parts

Each is independently verifiable. Each should land on its own commit with its
measurements in the message, as the rest of this project has.

### Part 1 — Fog for a deeper world

Re-derive `FOG_NEAR` / `FOG_FAR` for a world where things sit 60–90 units out
instead of 20–42. Nothing else changes.

**Done when:** an object at 74 units is a faint presence rather than erased,
and the landing and `/nebula` compositions are unchanged where they matter.

### Part 2 — The hero as an object in the scene

A plane at the home location carrying an image of the hero column, depth-tested
so nodes occlude it. Camera untouched; visible from inside `/nebula` only.
Decide here how the image is produced — pre-rendered texture against 3D text —
and pick `p`.

**Done when:** you can look back from inside the graph and see the home page
through the nodes, and it reads as *the home page* rather than as a stray
object. This is the cheap answer to the question every later part assumes.

### Part 3 — One fixed world

The constellation stops scaling and stops moving. `/`, `/work/[slug]` and
`/nebula` become camera positions. The landing composition solve is
re-expressed as camera distance and lateral offset; `use-cluster-screen`, the
affordance, the work-page centring and the label overhang are rewired to the
scene's published circle. The mechanisms listed under *What this deletes* go.

**Done when:** every route composes as it does today — measured, not eyeballed
— with `placement` gone from the codebase.

**This is the hard part.** It is the only one with heavy coupling, and the only
one where "looks about right" is not good enough.

### Part 4 — The approach and the string

Fly-in becomes translation: forward and right, past the hero, into the shell.
Fly-out becomes the retreat along that line, with the re-aim folded into its
last stretch.

**Done when:** the hero passes the camera on the way in, and going home is a
single pull with no separate turn after it lands.

### Part 5 — The DOM handoff

Real hero at home, plane away from home, cross-faded in a band. The real hero
keeps text selection, SEO and keyboard.

**Done when:** there is no frame where both are visible as two things, and no
frame where neither is.

### Part 6 — Seeing home through the glass

Transmission on the node shells, now that there is something to refract.
Tier-gated, measured.

**Done when:** home is visibly bent by a node in front of it on desktop, and
the frame budget is unchanged on tiers that do not get it.

### Part 7 — Re-verify and document

Five viewports, reduced motion, mobile framerate. Fold the outcome back into
`02-architecture.md` and `05-phase-2.md`, which will by then describe a
placement model that no longer exists.

## Open decisions

- **What the stand-in contains.** The whole hero column, or the wordmark and
  headline only. Everything visible is the stated intent; whether the stats row
  and link row survive at distance is a looking question.
- **`p`, the hero's distance from the standing point.** Sets how large home
  reads from inside. Free within the constraint that it must not reach the
  sphere.
- **Whether `/work/[slug]` is a third standing point or the home point with a
  different aim.** Both work. The second is fewer poses to reason about; the
  first is easier to compose independently.
