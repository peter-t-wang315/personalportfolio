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

### Part 3 — One fixed world — **done**

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

**Step 3 is done: one source of truth for where the graph is on screen.** The
rig publishes the circle it solves; `lib/use-cluster-screen.ts` reads it rather
than deriving it a second time from the parallax offset and the viewport size.
That second derivation matched on the landing page and was wrong by two terms
anywhere a project is spotlit — the zoom that enlarges the graph on a work page
and the offset that centres its lit cluster beside the article. Measured, the
idle pulse ring now sits within 12px of the graph's own ink centre at three
desktop widths, with diameters matching to within 4%.

The store's `clusterParallax` is gone with it, and the rig no longer imports
`pxPerWorldUnitFor`: it has no pixels to convert, because the camera's distance
*is* the conversion.

**Most of "What this deletes" above turned out to be wrong, and the reason is
worth keeping.** The rotation unwind, the centring spring and the split between
flight durations were all predicted to fall out with the scale trick. None of
them did, because none of them were compensating for it. The unwind is now
*more* load-bearing than before — it is what turns the graph to meet the reader
so the arrival can be a straight line. The centring spring still centres a lit
cluster. And a hop inside the graph is still a different kind of move from the
journey to it. What actually went was the duplicated screen-space arithmetic:
one derivation, one owner.

**Step 4 is done, and Part 3 with it: the fog is derived from real distances.**
It had been describing a composition that stopped shipping long ago — measured
correctly against an outside framing of the constellation, then left alone when
`/nebula` moved inside the shell, after which every node on every route sat
nearer than its near plane and it did nothing at all. There was never anything
to tune it against, because the graph's distance was a scale factor rather than
a distance. Now there is.

At 55–210, against four bands compared: the interior stays clear (8–14 units
from the standing point, and from inside a shell there is no recession to
describe); the landing page grades 11% to 27% across the graph's own depth at
71–96 units; ambient routes recede 28% to 44%; and home sits at 59% once the
reader turns around, which is where it already was.

That gradient is the point, and it is new. It is the difference between a far
object and a near one drawn small, and it could not exist while the graph was a
shrunken copy 23 units from the camera. This is the first deliberate change to
a composition since Part 3 began — the gate flags it, as it should: 57–64% of
the landing page's ink, 91% of the ambient routes', 0% of `/nebula`'s.

**One coupling this creates, which is worth knowing before tuning further.**
Narrow viewports shrink the graph, and shrinking it now means standing further
away, which fogs it more: 32–48% at 390×844 against 11–27% on a desktop. It is
physically coherent — the graph really is further — and it reads as softer
rather than absent. But it is a new relationship between viewport width and
atmosphere, and it did not exist when width only changed a scale factor.

## Where "further from both" now lives — **turned**

`STANDING_FOV` is the whole dial, and it is one constant. Narrowing it and
scaling `REFERENCE_DISTANCE` by the same `tan(θ/2)` ratio moves every standing
camera further out while the graph occupies exactly the same fraction of the
frame — the composition untouched, the perspective flattened, and the fog given
more depth to work across.

**It is at 30° now, and the landing camera stands 129.5 units out instead of
83.8.** Measured on the pixel gate, the landing graph's on-screen extent went
from 262×264 px to 243×266 and its centre moved 7 px — which is the equivalence
holding, not a coincidence: the width lost is fog eating the faintest outer
nodes, and the height, which the fog barely touches, is unchanged to two
pixels. `/work/[slug]` holds the same way, 349×272 to 346×262 with its centre
one pixel off.

**Turning it exposed the thing the dial was really for, which was not the
perspective.** `STANDING_FOV` was aliased to `HOME_CAMERA_FOV` — the *reference*
projection every size rule in `lib/cluster-geometry.ts` is written against —
so narrowing it would have quietly broken the equivalence Part 3 rests on
rather than exercising it. The two are separate constants now, and
`pxPerWorldUnitFor` keeps the reference projection because that is what it is
for.

**Everything downstream of the dial is derived rather than written down.** This
is the Part 1 lesson applied before it could happen a second time. The fog band
had been inert for months because it was measured correctly once and then left
next to a camera that moved; Part 3 step 4 re-measured it by hand and wrote
down 55–210, which was correct and was also a *second copy of the camera's
numbers waiting to go stale*. It would have gone stale immediately: at 130 units
the old band leaves the graph two thirds faded. So `lib/world-scale.ts` now owns
the dial and derives the band, home's distance and home's size from it, and each
formula reproduces the hand-tuned number it replaces when the dial is back at 45:

| | at 45° | at 30° | reproduces |
| --- | --- | --- | --- |
| `REFERENCE_DISTANCE` | 23.0 | 35.6 | Part 3's 23 |
| landing camera | 83.8 | 129.5 | Part 3 step 1's 83.8 |
| fog band | 55.9–210.9 | 101.6–256.6 | step 4's 55–210 |
| `HOME_DISTANCE` | 150.5 | 196.2 | Part 2's 150 |
| home plane height | 40.1 | 52.3 | Part 2's 40 |

The band's *width* is held at 155 rather than scaled, and that is the one real
decision in the table. The graph is 25 units deep whatever lens looks at it, so
a fixed band holds the gradient across the subject — the landing graph grades
10% to 26% front to back at either setting, which is what step 4 was for.
Scaling the band would have preserved every route's fog fraction exactly and
flattened that gradient to 10–20% instead, which is the wrong thing to protect.
The cost is that the ambient routes, which stand further back still, get hazier:
measured, `/about` lost 35% of its ink mass. It is faint now. It is meant to be
faint, it is still legible, and it is the honest consequence of standing 186
units away rather than 111 — but it is the number to watch if the dial goes
narrower.

## The arrival was a wall, and it is a room now

Part 3 left `/nebula`'s interior pose exactly as it inherited it, because Part 3
was about the camera outside the graph and the interior "already worked". It did
not. It had never been measured against the thing it produced.

**Not one node was within 10 units of the reader.** The nearest was 11.3 away
and the furthest 14.6, so all eighteen nodes in frame sat in a shell of a single
depth, 3.3 units thick, across an empty middle. That is a backdrop, not a room:
nothing near enough to pass, nothing far enough to recede, no parallax between
them when the reader drags. It is why arriving read as stopping in front of the
graph rather than being inside it.

Two things were wrong with the derivation, and they compounded.

**`INSIDE_DISTANCE` was measured from the pose's own target, not from the
graph.** The target is `(0, 2.5, 0)`, so "5.5 units out" put the camera **3.20
units from the centre**. This is precisely the mistake Part 3 step 2 found in
the departure path — "a camera parked inside the graph has its target a tenth of
a unit ahead of it" — one layer up, in the pose that path departs from, and it
survived that commit because the fix was applied to the interpolation rather
than to the quantity. The reader was very nearly at the middle of the shell,
which is the one place the composition notes explicitly rule out.

**A heading through the centre can only ever show the far wall.** From anywhere
inside, the near hemisphere is behind you by construction, so looking through
the middle guarantees that everything in frame is at least `R − d` away and
everything nearby is out of shot. No amount of tilt fixes that; it is what
"through the centre" means. `INTERIOR_TILT_DEGREES` was solving a real problem —
a node sitting dead on the axis — and could never have solved this one.

So both were searched, over standing points from 7.5 to 9 units and headings
over the whole sphere, scored on nodes in frame, nodes within 10 units, total
apparent area, spread across the frame, and how each holds up at six viewports.
Constrained so no node sits within 6° of the view axis, and none closer than
4.5 units. The winner is better on every measure at every viewport:

| at 1280×800 | was | is |
| --- | --- | --- |
| nodes in frame | 18 | 19 |
| of them projects | 6 | 8 |
| within 10 units | **0** | **9** |
| nearest node | 11.3 | 6.9 |
| front-to-back depth in frame | 3.3 | 11.8 |
| total apparent area | 26 | 52 |
| nearest node to the view axis | 7.7° | 11.4° |

Twice the apparent area from the same 45 spheres through the same lens — the
difference is entirely that some of them are now near. On the pixel gate the
interior draws 2.1 to 3.8 times the ink it used to, and at 1024×768 the graph
fills the full height of the frame instead of leaving the bottom third empty.
Nothing sits closer to dead centre than it did before, so the thing the tilt
existed to prevent is more true rather than less.

Turning the graph is what carries this, which is the point: `NEBULA_BASE_ROTATION`
rotates the constellation so the chosen interior heading lands on −z. The camera
still holds one heading for the whole journey — measured, 0.00° of change — so
the arrival is still a straight run and Part 4 can still fly past the hero. The
graph does the turning; the reader only travels.

It costs the departure nothing and gains it something. Leaving from 3.20 units
meant starting at the middle, where the shell is uniformly distant and the first
half of the retreat crosses empty space. Leaving from 9.0 puts the wall two
units away, and the way out goes through it.

## Leaving the graph had an animation all along

The complaint was that going home does not animate. Traced, the camera was
doing exactly what it was specified to do: 2000ms, 9.0 units to 132.4, heading
held to 0.00°, and 44% / 70% / 91% of the way out at each quarter — the
schedule Part 3 step 2 measured and wrote down.

**The document was on top of it.** Measured, the landing page painted at full
opacity 190ms after the click, and the remaining 1.9 seconds of retreat played
out behind a page that had already finished arriving. Nothing was ever looking
at the flight. A camera trace alone would have said it was fine, which is why
`checks/exitflight.mjs` reads the camera and the document's opacity on the same
frames.

So the destination is held for the first half of the retreat and fades in over
the second: `route-curtain.tsx` raises `data-arriving` on `<html>` in a layout
effect on the route change, and the rig drops it at 55% of the flight's own
progress. Measured now, the page is held for the first 1060ms, fully opaque at
1728ms, and the camera settles at 2000ms — so the retreat has the frame to
itself while it is worth watching, and the page is finished and readable before
the camera stops rather than beginning to appear then.

Three things about it that are not obvious:

- **The raise has to be a layout effect and the drop has to be the rig.** They
  are two edges of one attribute answering to different clocks. The rig's route
  effect is a passive `useEffect` and runs *after* the browser has painted the
  new route, so raising it there showed one full-opacity frame of the
  destination before it vanished — worse than not doing it at all. The drop has
  to answer to the flight's real progress and must not be a `setTimeout` an
  interrupted flight could leave running.
- **Everything but the canvas, not just `<main>`.** The first version held the
  document and left the affordance alone, and the affordance is a set of `fixed`
  siblings of `<main>` — so the landing page's idle pulse ring hung in an
  otherwise empty frame for a second, a ring drawn around a graph that had not
  arrived. The selector is `body > *:not(:has(canvas))`, the same one
  `checks/baseline.mjs` uses to isolate the scene.
- **It needs `!important`, and that is not laziness.** The pulse ring animates
  its own opacity, and a running animation outranks a plain declaration in the
  cascade — measured, it sat at 0.018 and rising through the whole hold. A hold
  is exactly the case the flag is for.

This is **not** Part 5. Part 5 is the cross-fade between the real hero and the
plane standing in for it, and it needs the home standing point that Part 4 has
still to place. This is the half that does not: the page waits for the flight
instead of covering it.

## The arrival moved again, because the graph did

A later pass corrected the project write-ups against what the services actually
do, and six technologies that were load-bearing and missing became nodes: MQTT,
Three.js, Material UI, MudBlazor, TanStack Query, React Router. The graph went
from 45 nodes to 51.

**That re-lays out the constellation, and it is worth understanding why.**
`content/layout.ts` places technologies on a Fibonacci sphere sized by
`tech.length`, so a single addition re-points every technology node. It then
pulls each one toward the projects using it, so correcting one project's
`techIds` moves nodes belonging to projects nobody touched. Both happened at
once. Nothing about the world scale moved with it — the bounding radius is
capped by the shell and stayed at 12.383, so `LANDING_SCALE`, the standing
distances, the fog band, and home's distance and size are all unchanged, which
is the derivation in `lib/world-scale.ts` doing its job.

The interior standing point is the thing that could not survive on its own,
because it was searched against positions that have since moved. Measured
against the new layout it had **not** broken — 20 nodes in frame and 7 within 10
units at 1280×800, against 19 and 9 before — but it had decayed where there was
least room to lose: on a phone it was down to 15 thousandths of apparent area
with two nodes near, which is most of the way back to the flat wall this part
existed to fix.

Re-searching the moved layout recovered it and then some:

| at 1280×800 | first search | after the graph moved | re-searched |
| --- | --- | --- | --- |
| nodes in frame | 19 | 20 | 21 |
| of them projects | 8 | 8 | **10** |
| within 10 units | 9 | 7 | 9 |
| apparent area | 52 | 53 | 55 |
| same, on a phone | 16 | **15** | **40** |

Ten of the twenty-one nodes in frame are projects now rather than eight, which
matters more than the count: projects are the content, technologies are the
connective tissue. And the phone recovering from 15 to 40 is the real result —
that viewport has the least frame to spend and had quietly lost the most.

**The lesson is the one Part 1 already taught, in a second place.** A number
measured correctly once, against inputs that later moved, is indistinguishable
from a number that was never right. The fog band was inert for months that way.
This pose would have decayed the same way, silently, except that the search that
produced it is a script rather than an afternoon — so re-running it cost a
minute. Anything derived from the layout should be re-derived when the layout
changes, and the way to make that affordable is to keep the derivation.

## Flying in was off-centre, and it was the clock

The arrival and the departure both took a visible detour. Measured at 1440×900,
the constellation's on-screen centroid climbed 206px in the first fifth of the
arrival and then came back down — an excursion **262px off the direct path**
between where it starts and where it ends. The departure was the same shape,
270px. The camera was never in the wrong place: it left the landing pose
exactly, arrived at the interior pose exactly, and `exitflight.mjs` said the
schedule was right to the percent. What was wrong was the middle.

**The cause is two interpolations sharing one clock.** `approachLerpPose` moves
the camera's distance from the graph and its direction *around* the graph, and
both ran on eased time. Distance collapses fast and early — 47 of the 131 units
are gone in the first fifth — while a lateral offset's effect on screen goes as
`offset / (distance · tan(fov/2))`. The same few degrees of arc that are
invisible at 131 units throw the graph across the frame at 20. Spending the arc
evenly in time spends most of it while it is still cheap to see, and none of it
when it matters.

**The fix is to spend the arc against distance instead of time:** `d⁻³`,
normalised over the journey. Distance stays on the clock; direction moves to
proximity.

One expression covers both journeys, and that is the reason to prefer it over
tuning them separately. Going in, `d⁻³` barely moves until the camera is close,
so the graph grows in place and only swings as the shell arrives. Coming out,
the same function front-loads, so the camera slides to its heading while it is
still inside and then simply recedes. "Do the turning while you are close to the
thing you are turning around" is the rule, and distance is the only quantity
that has to be consulted to obey it.

| direction weighted by | arrival | departure |
| --- | --- | --- |
| eased time (before) | 262px | 270px |
| proximity, `d⁻¹` | 162px | 165px |
| proximity, `d⁻²` | 84px | 87px |
| **proximity, `d⁻³`** | **56px** | **58px** |
| proximity, `d⁻⁴` | 39px | 40px |

The two directions land within two pixels of each other at every exponent
tried, which is what a rule looks like as opposed to a pair of fixes. Three
rather than four because four buys 17px at the cost of finishing the whole arc
inside the last tenth of the approach, and an arc that completes in 200ms is a
flick rather than a move.

**Two things were tried and rejected.** Separate exponents per direction worked
— `a³` in, `a^0.25` out — and was strictly worse than one rule that falls out
of the geometry. A straight world-space line, which is what Part 4's brief
literally asks for, measured 142px in and 144px out: better than the old orbit,
worse than the weighted one, because a straight line still spends its lateral
offset early. Part 4 may still want the line for other reasons — flying *past*
the hero is a statement about the path, not about the framing — and if it does,
this weighting is what will keep it centred.

**The measurement is analytic and the browser only corroborates it.**
`approachLerpPose` is pure arithmetic over the layout, so the path can be
evaluated at any resolution offline, which is where every number above comes
from. `checks/flightpath.mjs` runs the same measurement on real pixels and
reports a lower bound, because a screenshot under software GL costs ~400ms and
a 2000ms flight samples five or six times whatever the viewport. It agrees on
the order of magnitude and confirms the model is describing the code that
ships, which is the only thing a coarse instrument can usefully do.

## Stopping short was both complaints at once

Re-weighting the path fixed the detour and left two things the reader still
felt: *"it feels like we barely flew anywhere"*, and *"when we fly into the
nebula we're not at all in the centre of it"*. Those turned out to be one
measurement read twice.

**The arrival stopped 9 units out, on a shell of radius 11.** That is standing
at the wall. Measured from that point, the nearest node in any direction was
2.85 units and the furthest 20.62 — a lopsidedness of **7.2**, where 1 would be
perfectly enclosed. And only **6 of 51 nodes** ever got behind the camera, so
almost nothing went past on the way in. That is arriving at a doorway.

The same stopping-short shortens the flight, because the part of the journey
skipped is the part where the graph is nearest and changing fastest. Apparent
size goes as `1 / (d · tan(θ/2))`, so the whole approach only grew the graph
**5.3×** — the camera closed a 14.4× distance ratio and the field of view
widening from 30° to 72° gave 2.7× of it straight back. That is a dolly zoom,
which is precisely the effect that cancels the sense of approach.

**Moving the standing point in to 5.5 units fixes both**, because both were the
same fact:

| | 9 units out | 5.5 units out |
| --- | --- | --- |
| nearest node in any direction | 2.85 | 5.6 |
| lopsidedness (1 = enclosed) | **7.2** | **3.0** |
| nodes behind you on arrival | **6 of 51** | **25 of 51** |
| apparent growth across the flight | **5.3×** | **8.7×** |
| nodes in frame | 21 | 24 |
| fewest across six viewports | 9 | 11 |

**The centre is not the answer either, and that is worth recording.** On a
hollow shell every point is equidistant from the middle, so at 3 units the
numbers collapse back to the original derived pose's — nearest 11.4, depth 3.3,
nothing near at all. That *is* the flat wall, approached from the other side.
Enclosure and presence genuinely pull against each other here; 5.5 is the knee,
not a preference. The cost is real and worth stating: nearest node in frame 9.1
rather than 7.3, front-to-back depth 7.6 rather than 11.7, apparent area 36
against 55. Everything is a little further off and a little flatter.

**One more run was needed, and it caught the worst mistake of the four.** The
first pose at 5.5 scored well on every metric above and had eight projects in
frame — *one* of which was production work. It faced the personal cluster, so
what a visitor saw on arriving was Thai Ginger and a Pokémon team builder. The
entire argument of this site is that one region of the graph is a truthful
architecture diagram of software that runs a factory, and the arrival was
pointed away from it. **"Projects in frame" was the wrong thing to count.**
Scoring the SEL clusters specifically — through-hole, solder, maintenance,
tools — moved it to eight of eight, and the node count went *up* at the same
time, 21 to 24, with the worst viewport going from 9 nodes to 11.

That is the fourth search over this one pose, and the pattern across them is
worth more than the pose. Every run optimised exactly what it was told to and
was wrong about something it had not been told to measure: run one maximised
nodes in frame and produced a flat wall of them at uniform depth; runs two and
three maximised the frame and put the reader against the shell; run four had to
be told that not all projects are equal. A search only ever answers the question
you actually asked, and the recurring failure is asking a narrower one than you
meant. The layout will move again — it moves every time `content/tech.ts` does —
so the constraints matter more than the coordinates.

## How any of this was measured

Everything above that carries a number — 0.23% worst, 0.00° of heading change,
44/70/91%, nine nodes within ten units — came out of a script, and those
scripts are in `checks/`, with a README covering how to run them and the traps
that produced a wrong conclusion each. They were in a scratchpad until Part 3
ended, which meant none of the numbers in this document could be reproduced by
anyone reading it.

**The camera itself is now traceable, which it was not.** The README told you
to "trace the camera instead" of judging a transition from screencast frames,
and then offered no way to: the r3f store is not reachable from the page and
nothing in the scene is on `window`. Every camera number this document quotes
was measured by instrumenting the rig by hand and throwing the instrument away.
`app/nebula-probe.ts` is that hook, made permanent — one object per frame, not
gated on `NODE_ENV`, because the checks run against a production build by
necessity. `checks/exitflight.mjs` is the first script to use it.

The one to know about is the **pixel gate**: `checks/baseline.mjs` captures 5
routes × 6 viewports with motion frozen and the DOM hidden, and
`checks/part3diff.mjs` reports what fraction of inked pixels moved between two
captures. Two captures of one build differ by 0.00%, so a number above zero is
a real change. That is what made Part 3 possible to do at all — the equivalence
it rests on is exact, so "did I break the composition" has a yes-or-no answer
rather than an opinion. Parts 4 through 6 change compositions deliberately and
cannot be gated at zero, but the gate still says *which* routes moved and by
how much, which is the question worth asking of a deliberate change too.

Nothing here runs in CI and nothing should: it needs a production build, a
server on :3100 and a browser, and it is slow. It is what you run before
believing a claim, not on every save.

## The brief, restated

Two rounds of measured fixes to the arrival — the re-searched pose, then the
move from 9 units to 5.5 — and the reader who owns the site still said the same
two things: *it does not land in the centre of the nebula*, and *it feels like
we took two steps over to it rather than going way far*. So the brief was
asked for in full before anything else was tuned, and it is worth recording in
its own words because it overrules some of what this document measured its
way to:

- **Land at the exact centre.** Looking around should be looking around from
  the middle of a cloud of nodes — "a weird hollow earth of clouds above".
  Uniform depth, which the searches above avoided as a flat wall, is the thing
  being asked for.
- **Fly straight.** No camera turn at all. The graph turns to make the landing
  look full; the reader only travels.
- **Heroic.** Ease in fast, ease out as it lands.
- **Physically past the hero.** Leave the page behind on the way in, and see
  it back there in the distance when you turn around. This is Part 4 with
  Part 5's plane, and both were pulled into scope for it.
- **No free movement inside.** Look around, fly in, fly out, open a node,
  close it. Nothing else. (Which is what the controls already allowed.)
- **Desktop first.** Mobile later.

The searches were not wrong about what they measured. They were asked a
narrower question than the one that mattered — again — which is the pattern
this document keeps finding in itself.

## The dive

The flight from the landing page to the centre and back, `divePose` in
`app/nebula-flight.ts`. Three things spent against three clocks, each a
function of distance from the centre so that one rule serves both directions:

**Distance is geometric against the far wall.** `approachLerpPose` measured
from the centre, and a geometric schedule to the centre never arrives. The
thing the eye measures from inside the shell is the far side of it, `r + R`
away, which is never zero — so that is what decays at a constant ratio per
unit of eased time. Apparent growth is steady all the way in, the schedule
reaches the centre, and the shell is crossed at 73% of the eased progress. The
last quarter is the interior: the far wall doubling from 22 units to 11, which
is the part the old pose skipped and the part that makes it a room.

**The lateral glide is spent while far.** The landing camera stands 18 units
off the axis so the graph sits beside the hero; the centre is on the axis. The
slide between them is spent over the outer 70% of the distance — measured, the
camera is on the axis by 54 units out — so the graph drifts to the middle of
the frame while it is still small and the run in is dead straight. The rule
`approachLerpPose` found, do the turning while close, was for a swing *around*
the graph; a glide across the frame spent close is a lurch.

**The lens widens from the launch.** 30° standing, 72° inside. Widening
shrinks everything, so wherever it is spent it eats into the approach. It was
first spent over the inner 45% of the distance, on the theory that the near
nodes streaming past would carry it — and it stalled the graph's growth for a
few hundred milliseconds right where the graph was still turning, which the
reader saw as "flies in, pauses for the nebula to finish rotating, then goes
in all the way". It is spent over the first half of the eased progress now,
which the burst curve below puts entirely in the launch. That is also where
the hero is passing, and a wide lens makes it rush — 41° by the time it goes
by. Modelled against the far wall, the growth dips to 0.98 for one frame at
the pass and never otherwise; over 80% it never dipped at all, and the pass
read as too slow. The first version's dip was 0.97 for several frames, and
that was the pause.

The curve is `diveEase`, (0.3, 0.35, 0.2, 1), over 2800ms — up from 2000,
because the journey is longer by the part that was missing. It is a burst:
80% of the way in the first 1.2 seconds, the hero gone past by 300ms, the rest
a deceleration into the middle of the room. The first curve, (0.3, 0, 0.15, 1),
leaned in gently and then held a steady rate, which against a geometric
distance schedule is exactly a steady rate of growth — and read as "sooo
linear". A launch is not steady. The graph's own turn
(`unwindShare`) runs the whole length of the flight in step with the
placement. It was briefly compressed into the first seven tenths so the run
through the shell would be against a still graph, and that read as three beats
— fly, turn, fly — where one motion was asked for.

**The centre was claustrophobic at a shell of 11**, and the fix is the shell,
not the lens. From the middle every node is the same distance off, so the only
things that change how enclosed it feels are node size against shell size and
the field of view; scaling both together changes nothing. `SHELL_RADIUS` in
`content/layout.ts` is 14 now: a project node 7° across rather than 9°, and
paper between things. The landing footprint is unchanged by construction —
`LANDING_SCALE` normalises the whole graph to the same circle — and its nodes
read a fifth smaller inside it, which is the one visible cost. The heading
search re-run on the new layout gives the same heading to three decimals,
which is angular positions being scale-invariant; the entry line's clearance
rose from 2.02 to 2.67.

**Landing at the centre changed the heading search, not just its answer.** The
standing point is the origin, so only the heading is searched
(`checks/interiorheading.mjs`), and two constraints are new because the flight
is a straight line *through* the shell: nothing within 1.5 units of the entry
line, so the reader passes nodes rather than through them, and the search
scores production projects rather than projects. At 1440×900 the arrival has
18 nodes in frame, six projects and all six production, the sparsest of six
desktop viewports at 17, the nearest node to the entry line 2.02 units clear.
The first heading chosen was 1.40 clear and was rejected by its own script.

Measured in the browser (`checks/flyin.mjs`, software GL): 130.8 units to
0.00, x from −18.2 to 0.0 by 54 units out, lens at 30° until 55 units then to
72°, landed at (0.00, 0.00, 0.00) — the exact centre — with the graph balanced
across the frame rather than piled into a corner.

## One lens everywhere

Every schedule for the lens change was tried and none felt right, and the
reason is structural rather than a matter of tuning. The landing view was
composed through a 30° lens and the interior through 72°, so every flight had
to change focal length while it moved. A focal-length change during a dolly is
a dolly zoom, whose whole effect is to cancel the sense of approach on the
thing being looked at. Spent late it stalled at the shell; spent early the
graph shrank during the launch; spread evenly it diluted everything. A wide
lens reads as speed in a racing game because the periphery is full of road;
here the periphery is paper.

Four ways out were put to the owner: separate the beats and change the lens
only while the camera is still; one lens everywhere; give the periphery
something to stream (the particle field on the Phase 3 list); or keep tuning.
**One lens everywhere was chosen.** `STANDING_FOV` is 72 — the interior's —
and `INSIDE_CAMERA_FOV` is an alias of it, so the two cannot drift apart
again. The dive's lens term now interpolates between equal numbers and does
nothing.

What it costs, all of it derived from the dial in `lib/world-scale.ts`: the
landing camera stands 59 units out rather than 162, so the landing graph is a
ball with real perspective — its near face 1.7× its far face rather than 1.2×
— rather than the distant sphere "Where 'further from both' now lives" argued
for. Every distance in the world is a third of what it was. The hero plane
cannot hang 50 units ahead of a camera 59 units out without sitting inside the
shell, so `HOME_STANDOFF` is 22: the page is passed at a third of the way in,
sits 37 units from the centre, and from the centre is about half the frame
tall — near, because everything is near now. Measured: in, 63.5 → 0 with the
lens at 72 throughout, landed at the centre; out, the straight line back,
landed on the standing point with the plane on the page.

The "further from both" section above still describes the dial correctly and
now describes a setting that is not in use.

## Twice as far, and the pass

A jump cut was tried — wind-up, a wash to paper, a lens spike, arrival — and
reverted: "it looks like we sprinted 2 feet rather than sped through 100 yards
of ground". Hiding the distance is exactly what feels like no distance. A
slingshot around the outside of the shell was tried next and scrapped as an
idea. What stayed is the plain answer: **the graph is further away.**

With one lens, on-screen size and distance are one dial, so "further" means
"smaller on the landing page". `CLUSTER_RADIUS` in `lib/cluster-geometry.ts`
is 1.3 rather than 3: the landing cluster draws at about 80px radius instead
of 160, the standing camera is 118 units out instead of 59, and the growth
across the flight — the thing the eye actually measures — is 9× rather than
5×. Every landing overlay derives from the constant and followed. The page
hangs 40 units ahead again (`HOME_STANDOFF`), passed a third of the way in.

**The pass is close and the curve is slow to it, fast through it.** "Start
slower past the landing page and speed up more as we get further." What makes
a fly-past feel exaggerated is how fast the near thing sweeps the frame, which
is speed over closeness, so the camera drifts to a point `PASS_CLEARANCE` (4)
off the page's near edge, holding its lateral position, and only glides onto
the axis once the page is behind it (`divePose` with a `DivePass`). The page
fills most of the frame just before it leaves. The curve, `passEase`, is one
smooth bezier whose speed is still rising as the page goes by and peaks just
after; a first version with a deliberate speed jump at the page, and a corner
in the path where the drift met the glide, read as jitter rather than a whip.
Both are continuous now — the path is two Hermite pieces sharing a slope at
the pass point. Outbound is the mirror. 3000ms.

**Inside, two things had gone wrong with the move to the centre.** Hovering a
node attracts its neighbours, which was built for the view from outside; from
the centre of the shell a stray pointer crossing a node pulled nodes across
the sky. The attraction is off inside the graph now (hover still lights the
node, its edges and its label). And opening a node on the home side of the
graph parked the reader looking outward at the page — half the frame tall
from there — as a mirrored backdrop behind the panel. The page fades out
while a node is open or being opened, and back when it closes.

## The page behind you

Two things about the page seen from inside, both from the owner. It was
mirrored: the plane faces the home standing point so it can match the real
hero for the hand-off, so from inside you saw its back. The back is drawn
un-mirrored now — a second back-facing plane with the texture flipped — so it
reads the right way round. And it was sideways: the page hangs where the real
hero is on screen, off to the side of the flight line, because that is the
only place the hand-off can be invisible, and from the centre that is 37°
round and seen obliquely. What was asked for is "mirrored straight across
from us, like if we flew past it and left it".

So the page's place depends on which side of it the reader is. Ahead of it —
at home, and until it has gone past — it sits where the hero is. Behind it, it
slides onto the flight line, so turning round from the centre finds it dead
behind and square on. The slide is spent over a band of distance from the
centre that is past the page and outside the shell (`HOME_BEHIND_FROM` to
`HOME_BEHIND_TO` in the rig), where the reader is facing the other way on both
journeys and cannot drag, so it is never seen moving. At rest inside, the page
is on the axis, 37 units back.

A field of dust streaking past during flights was tried for the sense of
distance and removed at the owner's request; the commit that added it has the
implementation if it is ever wanted again.

## The way out is a yank

The departure is the dive reversed and nothing else: the camera keeps facing
the graph and is pulled straight back to the standing point — "a direct pull
back out" — with the same burst at the start and the same settle at the end,
the lens narrowing back as the hero passes.

A version in between turned the camera to face the hero, tracked it as it
grew, and swung round onto the landing heading as it arrived. It was built on
a misreading of "the camera rotates at the end as it needs to": that was only
ever about a reader who had turned to look elsewhere before leaving. So the
one thing `departureHeading` does now is straighten whatever heading a drag
left onto the landing heading, over the first 30% of the distance — while the
graph is still all around and the turn is a glance. Straightening at the end
instead would slide a small, distant graph across the frame right as it lands.
Yaw and pitch rather than a slerp, because a reader who had turned round to
look at home is facing exactly away, and a slerp between opposites has no
plane to turn in.

**Two things about leaving after a drag, both found by tracing it.** Looking
around orbits the camera about a pivot a tenth of a unit ahead, so after a
drag the camera sits up to a fifth of a unit off the origin in a direction
that means nothing; read literally as "where the camera is", the dive flew
out along it. The departure now starts from the centre by definition, with
only the heading being the reader's. And a pose at the centre has no direction
of its own: arriving, the dive takes the reversed heading (the axis, which is
what lets the glide centre the graph); leaving, it takes the *destination's*,
so the way out is the straight line from the centre to the standing point
whatever the reader had turned to look at. Measured after a drag of 72°: x and
z in constant proportion from the first frame, heading straight by 40 units
out, landed on the standing point to a tenth of a unit.

## The hand-off

The hero plane from Part 2 hangs 50 units ahead of the home standing point now
(`HOME_STANDOFF`), sized and placed every frame so that from that point it
covers the hero column's measured pixels exactly. Going in, the page dissolves
into it; going out, it dissolves into the page. In between it is the page
going past on the left, then the page back there when the reader turns round,
at two fifths opacity.

**The plane is painted from the measured DOM**, not from `content/` at a layout
of its own (`app/hero-layout.ts`): every run of text in the column with its
box, font, size, weight, tracking, leading and colour as the browser computed
them, re-wrapped in the same fonts within the same widths. A dozen
`getBoundingClientRect` calls; still not `html2canvas`. What the column
*contains* goes to the store and repaints the texture on resize; where the
column *is* — it carries the pointer parallax — is re-read every frame during a
flight, so the plane sits on the page at the one moment that matters.

**The flight has to start before the route changes.** Navigating unmounts the
landing page in the same commit, and there is then nothing to dissolve from.
So every way in goes through `departForNebula`: measure the hero now, request
the flight, raise `data-leaving` so the page fades over the plane, and push the
route 220ms later. The rig starts the flight on the request and, when the
route follows, sees a flight already bound for the graph and leaves it alone.

**Both hand-offs happen with the camera still.** The first version started
moving on the click; measured, the camera had covered seven units by the end
of the 220ms dissolve and the plane was 14% larger than the page fading out
over it — a double image at exactly the moment the swap was supposed to be
invisible. So the arrival holds for the hand-off and then goes, and the return
reveals the document at the moment of landing and dissolves the plane out over
the document's own 620ms fade. The earlier reveal at 55% of the retreat, which
existed so the page was readable before the camera stopped, is only used for
destinations that are not home: at home the page is visible for the whole
retreat, as the plane.

Measured: the plane at 1.00 through the hand-off, 0.40 by half way in; on the
return 0.40 until the camera passes it at 79.5 units, back to 1.00 at the
standing point, then 0.93 / 0.87 / 0.74 over the first 160ms after landing as
the document comes up 0.13 / 0.61, and the settled frame is the page with the
plane gone.

**One bug worth its own line, because it was silent.** The frame loop wrote
the standing pose whenever it was off `/nebula` with no flight running, and
there is at least one such frame between the commit that changes the route
and the passive effect that starts the departure. The camera was at its
destination before the flight began, so the flight started where it was meant
to end and did nothing — 130 units on its first flying frame, and the trace
alone would have said the schedule was fine. The rig now moves the camera only
once its own record of the route matches the prop.

### Part 4 — The approach and the string — **done**

Fly-in becomes translation: forward and right, past the hero, into the shell.
Fly-out becomes the retreat along that line, with the re-aim folded into its
last stretch.

**Done when:** the hero passes the camera on the way in, and going home is a
single pull with no separate turn after it lands.

**Done** — see "The brief, restated" below, which is where the shape of it was
decided, and "The dive", which is what was built. The hero passes on the left
50 units in; going home is the same line reversed with no turn at all, because
the camera never turned on the way in either.

### Part 5 — The DOM handoff — **done**

Real hero at home, plane away from home, cross-faded in a band. The real hero
keeps text selection, SEO and keyboard.

**Done when:** there is no frame where both are visible as two things, and no
frame where neither is.

**The document half is done** — see "Leaving the graph had an animation all
along". The page is held for the first half of the retreat and fades in over
the second, so the flight is visible and the reader is reading before the
camera stops. It landed early because it is what "going home does not animate"
turned out to be, and it needs nothing Part 4 has yet to decide.

The plane half followed once Part 4 placed the standing point: the plane hangs
`HOME_STANDOFF` ahead of it, is painted from the *measured* hero rather than
from `content/` at a layout of its own, and the two dissolve into each other
while the camera holds still — on the click going in, at the moment of landing
coming out. See "The hand-off".

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
- ~~**`p`, the hero's distance from the standing point.**~~ Settled at 50
  (`HOME_STANDOFF`, `lib/world-scale.ts`). The 66 the fog fraction suggested
  put home *behind* the landing camera, which is where a thing you have not
  yet passed cannot be; ahead of the camera the fog cannot reach it at all, so
  its haze is an opacity now (`HOME_REST_OPACITY`, two fifths). `HOME_DISTANCE`
  is gone — home is no longer a distance from the graph but an offset from the
  reader's own standing point, and it follows the landing camera by
  construction.
- **Whether `/work/[slug]` is a third standing point or the home point with a
  different aim.** Still open. Both work. The second is fewer poses to reason
  about; the first is easier to compose independently.
- ~~**The interior standing point is at 9.0 units, two from the shell.**~~
  Overtaken: it is at the centre now, by decision — see "The brief, restated".
  Every claim in Part 2 about what the reader sees by turning around was
  measured from the middle and is true again.
- **New, from Part 2:** the reader can now face empty paper. Looking away from
  both the graph and home shows nothing at all, which is honest for a space and
  is the first direction on this site that holds nothing. The corner Home link
  is the way back. Whether that wants a gentler answer — a soft limit, a hint,
  or nothing — is a decision Part 4 will have to take a view on, since it is
  the part that gives the camera somewhere to be.
