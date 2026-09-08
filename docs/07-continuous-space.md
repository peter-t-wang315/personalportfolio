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

**Fog erases both.** Fogged to paper — the same colour as the background — so
anything past the far plane is not dimmed, it is gone. The band has to be
re-derived before any of this is visible at all. That is Part 1, and it blocks
everything.

Part 1 turned up something that was not in the plan: **the old band was inert
and had been for some time.** Its 27–48 was measured correctly against an
outside view of the constellation, and then `/nebula` moved inside the shell
and nothing re-measured. Every node on every route now sits within 28 units, so
the fog has been describing a composition that no longer ships. Inert fog and
absent fog look the same, which is why it survived. The upshot is that Part 1
cost nothing to land — there was no working depth cue to preserve — and that
the "fog grades the far cluster to 90%" line in the older docs was describing a
framing that had already been replaced.

**"Further from both, and still able to see the graph well from home" is not a
paradox — it is what focal length is for.** Apparent size depends on distance
*and* field of view together: at distance `d` and vertical fov `θ` it goes as
`1 / (d · tan(θ/2))`. Double the distance and halve `tan(θ/2)` and the graph
occupies exactly the same fraction of the frame while everything about it reads
as further off — perspective flattens, parallax between near and far shrinks,
and fog has twice the depth to work across. Concretely: the graph subtends its
current landing size at 74 units through a 45° lens, and at 150 units through a
23° one. The longer lens is the whole difference between a small thing nearby
and a large thing far away.

That is a Part 3 change, because today the landing view's distance is not real
— the graph is scaled down to meet a camera nine units out, so moving the
camera changes nothing until the scale trick is gone. What Part 2 can do
already is put *home* properly far from the graph, which is the half of the
distance that is real.

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

### Part 1 — Fog for a deeper world — **done**

Re-derive `FOG_NEAR` / `FOG_FAR` for a world where things sit 60–90 units out
instead of 20–42. Nothing else changes.

**Done when:** an object at 74 units is a faint presence rather than erased,
and the landing and `/nebula` compositions are unchanged where they matter.

**Landed at 55–130.** Near clears the graph seen from inside (14.2 units at the
most) by a wide margin, so fog goes on doing nothing there, which is right —
from within a shell there is no recession to describe. Far puts an object at 74
units about a quarter faded: present and hazed rather than erased. Seen from
the landing standing point the graph will span 63–85 and grade from 11% to 40%,
which is a first guess at a recession rather than a considered one, and both
numbers properly belong to Part 3 when there is finally something at those
distances to tune them against.

Unchanged where it matters, measured with motion frozen so only the fog
differs: 0 pixels of 67,102 with ink on a work page, 0 of 42,576 on the landing
page, 0 of 66,315 inside the graph. The wiring is live rather than missing —
bringing the band in to 5–30 changes 13.8%, 17.0% and 71.4% of those. v26
23/23, sweep 60/60, and `/nebula` reached through a turned work page is still 0
differing pixels of 59,223.

### Part 2 — The hero as an object in the scene — **done**

A plane at the home location carrying an image of the hero column, depth-tested
so nodes occlude it. Camera untouched; visible from inside `/nebula` only.

**Done when:** you can look back from inside the graph and see the home page
through the nodes, and it reads as *the home page* rather than as a stray
object.

**Done.** The object is built, and the camera can now turn to face it: two
drags brings home from 92° off-axis to 17°, on screen at NDC (0.21, 0.26),
while the camera moves 0.156 world units in total. You stand inside the graph
and look around it.

Getting there needed the control model to change, which the plan had folded
into Part 4. What was wrong:

`CameraControls` always looks *at* its target. Orbiting moves the camera around
the graph's centre, but the view direction points inward from wherever it ends
up — the camera can circle the graph and can never turn its back on it. Swept
by hand, the angle between the view and the home object never falls below
**83.8°**, with the camera pinned at the polar clamp (0, 8, 0); the interior's
field of view is 72°, so a half-angle of 36° is the most that could ever be in
frame. Home projects to NDC x = 7.7, where anything past 1 is off screen.

Pointed at it directly, it reads exactly as intended: wordmark, role, headline
and metric values, at a quarter faded, with nodes and edges crossing in front.
So the texture, the fog band from Part 1, the depth ordering and the
orientation are all right, and what remains is a control-model question rather
than a rendering one.

**The fix: the pivot moves to a hand's breadth in front of the camera.**
camera-controls has no first-person mode — it orbits a target, so the view
always points at that target. With the pivot at `LOOK_DISTANCE` ahead instead,
the same drag sweeps the camera around a sphere 0.1 units across, which is
standing still, and the heading goes wherever it is pointed. There is one place
to stand inside the graph and the reader never leaves it: closing a node
returns to that same point and turns to face what was left, rather than moving
the camera to the far side of the graph to look back through the middle.

The wheel does nothing inside the graph, by decision. A dolly would either push
the reader through the shell or shrink the room, and neither is something the
space offers; `DOLLY_MIN_DISTANCE` and `DOLLY_MAX_DISTANCE` are gone with it,
and the clamps now pin the pivot rather than bounding a distance.

**One trap, and it cost a full verification round.** Parking the pivot by
reading `camera.position` back off the camera does not work: camera-controls
writes that during its own update, so immediately after a `setLookAt` the
camera object still holds wherever it was before. Aiming the pivot from there
put the reader at the centre of the graph instead of at the standing point —
99.7% of the interior's pixels changed, which the composition diff caught and
nothing else would have. The pivot is derived from the pose just applied.

Notes from building it, for whoever does the rest:

- The texture is **drawn**, not photographed. `html2canvas` and `foreignObject`
  round-trips are heavy and get the fonts subtly wrong, for something that is a
  third of the frame tall and a quarter faded. It reads the same strings from
  `content/` that the hero does, so the two cannot describe different people.
- It waits on `document.fonts.ready`. Canvas has no fallback-swap, so painting
  early bakes the system font into a texture nothing repaints.
- `depthWrite: false`, so the transparent shells still blend over it. That is
  the groundwork for Part 6 — the plane has to be *behind* the glass in the
  render, not merely behind it in space.
- It never raycasts. A page-sized invisible click target behind the graph would
  swallow drags aimed at the nodes in front of it.
- `p` was not picked, because `p` is the hero's offset ahead of the *standing
  point* and there is no standing point until Part 3. The plane sits at the
  home location itself.
- **Home faces away.** Its front points down +z, away from the graph, so from
  inside the shell the reader sees its *back*: the page mirrored, the way
  anything reads once you have gone past it. Turned around to face the reader
  it was a sign that happened to be pointed at whoever was looking, which is
  the opposite of having been left behind.
- `HOME_DISTANCE` and `PLANE_HEIGHT` began at 74 and 32, set from arithmetic
  rather than by looking, and read as a slightly grey card hung just outside
  the graph. They are 150 and 40 now: half the apparent size, and 61% fogged
  where 74 units gave 25%. A quarter faded is not distance, it is a slightly
  grey sign. `FOG_FAR` moved from 130 to 210 to put that fade where home
  actually is.
- The texture halves below the desktop tier. At a third of the frame and a
  quarter faded it buys nothing there, and full size is ~2.8MB of GPU memory on
  the tier with the least of it.

Checked afterwards, since neither was in the plan: home reads the same under
`prefers-reduced-motion` (there is no motion in it), it stays out of frame
while a node is open rather than intruding behind the panel, and touch can
turn to it — a phone reaches NDC 1.3 on one drag, just past the frame edge, so
it is a shorter drag away rather than unreachable. Its fog was measured rather
than assumed: 25% at rest inside the graph, which is the quarter the Part 1
band was chosen for.

### Part 3 — One fixed world — **in progress**

The constellation stops scaling and stops moving.

**The idea it rests on: the scale trick was always a distance in disguise.** A
group scaled by `s` at `(Lx, Ly, −14)`, seen by a camera at `(0, 0, 9)`
looking down −z, projects a local point `p` to `(s·p + L) / (23 − s·p.z)`. A
life-size graph at the origin, seen by a camera at `(−Lx/s, −Ly/s, 23/s)`
looking down −z, projects the same point to `(p − c) / (23/s − p.z)` — which
is the same expression. Identical, for every point, at every viewport. Rotation
about the group's own origin commutes with scale about it, so the spotlight
turn and the reader's drag carry over unchanged.

Two things follow. The landing and work pages can be reproduced **pixel for
pixel** by moving the camera instead of scaling the graph, so this part's gate
is not "looks the same" but 0.00% of pixels changed on every route at every
viewport, motion frozen. And the responsive rules in `lib/cluster-geometry.ts`
do not have to be re-derived from scratch: they produce a size on screen, and
the camera's distance is `23 / sizeFactor`. Once that holds, "further away"
is one dial — multiply the distance and narrow the field of view to match,
and the composition is untouched while the perspective flattens.

The camera becomes the thing that is solved every frame, in the rig, which
already owns it. The group keeps only its rotation.

Sequenced so each step lands at the gate before the next begins.

**Step 1 is done: the transform is gone and the camera stands.** The
constellation is life-size at the origin on every route — group scale 1,
group position (0,0,0), measured — and the rig solves where the camera stands
each frame from the same rules in `lib/cluster-geometry.ts` that used to solve
a scale. Those rules give a size; the camera stands `REFERENCE_DISTANCE`
divided by that size away.

| route | camera distance | group scale |
| --- | --- | --- |
| `/` | 83.8 | 1 |
| `/work/[slug]` | 63.5 | 1 |
| `/about` (ambient) | 110.7 | 1 |
| `/nebula` | inside, 0.42 from the origin | 1 |

Against the pixel gate — 5 routes × 6 viewports, motion frozen, the DOM hidden
so only the scene is compared — the worst frame changed **0.23%**, and that is
anti-aliasing: the ink centroid moved at most 0.03px and total ink at most
0.03%. `/nebula` is 0.00% at every viewport. Two captures of one build differ
by 0.00%, so the gate means what it says.

**Step 2 is done: the flight is a straight line, and it is spent evenly.** The
graph now carries the 111° between the landing face and the interior one, so
the camera holds a single heading for the whole journey — measured, 0.00° of
heading change across the arrival. That is what Part 4 needs: you cannot fly
*past* the hero while swinging 111° around it.

Distance is interpolated geometrically, since apparent size goes as 1/d and
equal steps of distance are not equal steps of what is seen, and the journey
has its own curve rather than the UI one. It completes 22% / 57% / 80% of the
approach at a quarter, half and three-quarters through, against 48% / 82% /
96% before — the difference between travelling and lunging then floating.

Both changes are path-only: the gate is still 0.23% worst, unchanged.

**The geometric interpolation broke the way out, and the fix was to measure
from the right thing.** It was interpolating distance from the *pose's own
target*, and a camera parked inside the graph has its target a tenth of a unit
ahead of it — that is what makes a drag look around rather than orbit. So the
departure ran 0.1 to 84: still 2.9 units out at half time, then thrown to the
landing pose in the last few frames. It read as nothing happening and then a
snap.

Distance from the **graph's centre** is the quantity that means something on
this flight, and the path measures that now. All three journeys are monotonic
and evenly spent: leaving the graph completes 44% / 70% / 91% of the way at a
quarter, half and three-quarters through, leaving a node 34% / 70% / 90%, and
arriving 24% / 67% / 90%.

Remaining: the edge fade and the orientation unwind still read the progress
value, which is fine and is what it now means; `use-cluster-screen` still
re-derives the circle independently; the deletions; and the fog, parked above
every standing distance while the geometry is proven and re-derived last. `/`, `/work/[slug]` and
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

- ~~**What the stand-in contains.**~~ Settled: the wordmark, the role line, the
  headline, and the metric *values*. The metric labels are a sentence each and
  would be grey noise at this distance, where the numbers still read as
  numbers.
- ~~**`p`, the hero's distance from the standing point.**~~ Deferred rather
  than decided, and deliberately: `p` is an offset *ahead of the standing
  point*, and there is no standing point until Part 3. What exists today is
  `HOME_DISTANCE`, home's distance from the graph, now 150.
- **Whether `/work/[slug]` is a third standing point or the home point with a
  different aim.** Still open. Both work. The second is fewer poses to reason
  about; the first is easier to compose independently.
- **New, from Part 2:** the reader can now face empty paper. Looking away from
  both the graph and home shows nothing at all, which is honest for a space and
  is the first direction on this site that holds nothing. The corner Home link
  is the way back. Whether that wants a gentler answer — a soft limit, a hint,
  or nothing — is a decision Part 4 will have to take a view on, since it is
  the part that gives the camera somewhere to be.
