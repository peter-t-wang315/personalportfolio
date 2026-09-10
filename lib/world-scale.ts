import {
  CLUSTER_BOUNDING_RADIUS,
  CLUSTER_DEPTH,
  HOME_CAMERA_FOV,
  HOME_CAMERA_POSITION,
} from "./cluster-geometry";
import { CONSTELLATION_BOUNDING_RADIUS } from "./node-geometry";

/**
 * **How deep the world is. One dial, and everything that has to move with it.**
 *
 * `07-continuous-space.md` ends Part 3 with a section called "Where 'further
 * from both' now lives", and the answer was `STANDING_FOV`: narrow it, scale
 * every standing distance by the same `tan(θ/2)` ratio, and the composition is
 * untouched while the perspective flattens and the fog gets more depth to work
 * across. That was true and it was also a trap, because `STANDING_FOV` was
 * aliased to `HOME_CAMERA_FOV` — the *reference* projection the size rules are
 * written against — so turning the dial silently broke the equivalence Part 3
 * rests on. The two are separated here.
 *
 * The rest of this module exists because of what Part 1 found: the fog band
 * had been inert for months, "measured correctly against an outside view of
 * the constellation, and then `/nebula` moved inside the shell and nothing
 * re-measured". Inert fog and absent fog look the same, which is why it
 * survived. Every distance below is therefore **derived from the dial** rather
 * than written down next to it, so there is no second copy to go stale — turn
 * `STANDING_FOV` and the band, home's distance and home's size all follow.
 *
 * Each derived value reproduces the number it replaces when the dial is back
 * at 45: `REFERENCE_DISTANCE` 23, the landing camera 83.8, the band 55-210.
 * Those were arrived at by looking, over Parts 1 to 3; the formulae are what
 * they turned out to mean. Home is the exception since Part 4: it is no
 * longer a distance from the graph but an offset ahead of the reader's own
 * standing point (`HOME_STANDOFF`), so it moves with the landing camera by
 * construction rather than by derivation.
 */

/**
 * **The dial.** The field of view the camera stands at on every route but
 * `/nebula`.
 *
 * Apparent size depends on distance and field of view together — at distance
 * `d` and vertical fov `θ` it goes as `1 / (d · tan(θ/2))` — so halving
 * `tan(θ/2)` and doubling `d` leaves the graph occupying exactly the same
 * fraction of the frame while everything about it reads as further off.
 * Perspective flattens, parallax between near and far nodes shrinks, and the
 * fog has twice the depth to grade across. That is the whole difference
 * between a small thing nearby and a large thing far away, and it is the
 * reason the landing page's graph now stands 130 units out rather than 84.
 *
 * 45 is the reference projection and reproduces every composition Part 3
 * measured, to the pixel. 30 is the long lens, and was the setting from
 * "Where 'further from both' now lives" until the flights existed.
 *
 * **72 now — the interior's lens — so there is one lens everywhere.** The
 * landing view and the interior used to be composed through different focal
 * lengths, which meant every flight between them had to change focal length
 * while it moved, and a lens change during a dolly is a dolly zoom: it cancels
 * the sense of approach on whatever you are looking at. No schedule hides
 * that — spent late it stalls at the shell, spent early the graph shrinks
 * during the launch — because the thing being cancelled is the thing being
 * watched. With one lens the flight is pure motion. The cost is the
 * landing page's perspective: the graph is a ball 59 units off rather than a
 * sphere 162 off, its near face 1.7x its far face rather than 1.2x, and
 * every distance in the world is a third of what it was. `INSIDE_CAMERA_FOV`
 * in the rig is defined as this so the two cannot drift apart again.
 */
export const STANDING_FOV = 72;

/** Half-angle tangents; the whole conversion is the ratio between them. */
const REFERENCE_HALF = Math.tan((HOME_CAMERA_FOV * Math.PI) / 360);
const STANDING_HALF = Math.tan((STANDING_FOV * Math.PI) / 360);

/**
 * How much further every standing camera stands than the reference projection
 * puts it. 1 at 45 degrees, 1.546 at 30.
 */
export const DISTANCE_SCALE = REFERENCE_HALF / STANDING_HALF;

/**
 * The distance the size rules in `cluster-geometry.ts` are written against —
 * the landing camera's 9 units to the origin plus the 14 the cluster used to
 * be pushed back — carried onto the standing lens.
 *
 * Those rules produce a *size on screen*; the standing camera's distance is
 * this divided by that size. At the reference fov it is the plain 23 that
 * makes a group scaled by `s` and a life-size graph at `23 / s` project
 * identically (Part 3). Widening the lens does not break that equivalence, it
 * restates it: a narrower lens needs proportionally more distance to subtend
 * the same angle, and `DISTANCE_SCALE` is that proportion.
 */
export const REFERENCE_DISTANCE =
  (HOME_CAMERA_POSITION[2] - CLUSTER_DEPTH) * DISTANCE_SCALE;

/**
 * Shrinks the constellation to exactly the footprint the landing page's
 * cluster has always occupied — `CLUSTER_BOUNDING_RADIUS` at `CLUSTER_DEPTH`.
 *
 * Matching that footprint rather than picking a pleasing size is what keeps
 * `cluster-geometry.ts` true. Every DOM overlay on the landing page (the
 * affordance's hover circle, the idle pulse ring, the phrase label's placement
 * solve) is measured in pixels from those constants, so as long as what is
 * drawn projects to the same pixels, none of that arithmetic has to know the
 * geometry underneath it changed at all.
 *
 * It lives here rather than in the camera rig because the fog band and home's
 * distance are both quoted in multiples of the landing standing point, and a
 * copy of this in two files is exactly the kind of second derivation Part 3
 * step 3 spent a commit deleting.
 */
export const LANDING_SCALE =
  CLUSTER_BOUNDING_RADIUS / CONSTELLATION_BOUNDING_RADIUS;

/**
 * Where the camera stands on `/` at a desktop viewport, with no spotlight and
 * no ambient dimming: 83.8 units at the reference fov, 129.6 at 30 degrees.
 *
 * The live solve in the rig is this same expression with the responsive rules
 * folded in, so this is the composition's *centre* case rather than a value
 * anything renders from directly. The band below is quoted against it.
 */
export const LANDING_STANDING_DISTANCE = REFERENCE_DISTANCE / LANDING_SCALE;

/**
 * **How much depth the fog spends, in world units.** Fixed rather than scaled
 * with the dial, and that is the decision worth understanding.
 *
 * The graph is 25 units deep whatever lens is looking at it — its own radius
 * does not change when the camera steps back. Holding the band fixed therefore
 * holds the *gradient across the subject*: the landing graph grades from 10%
 * to 26% faded front to back at 45 degrees and at 30. That gradient is what
 * Part 3 step 4 was for, and it is the difference between a far object and a
 * near one drawn small.
 *
 * Scaling the band with the dial instead would preserve every route's fog
 * fraction exactly and flatten that gradient to 10-20%, which is the wrong
 * thing to protect. The cost of holding it is that routes standing further
 * back than the landing page — the ambient ones — do get hazier as the dial
 * narrows. They are meant to; they really are further away.
 */
const FOG_BAND = 155;

/**
 * Where the graph's leading edge sits in the band, seen from the landing
 * standing point. A tenth: enough that the near face is not perfectly crisp
 * against a far face at a quarter, and not so much that the subject of the
 * page reads as weather.
 */
const LANDING_NEAR_HAZE = 0.1;

/**
 * Fogged to paper — the same colour as the background — so anything past the
 * far plane is not dimmed, it is gone.
 *
 * Near is placed off the *front of the graph as seen from the landing page*,
 * which is the composition the band exists to grade. Two consequences worth
 * knowing. Inside the shell there is no fog at all, by a wide margin: the
 * reader stands at the centre and every node is within 12 units, against a
 * near plane past 100 — right, because from within a shell there is no
 * recession to describe. And the near plane now sits *behind* the reader on
 * `/nebula`, so it can never quietly re-engage there the way the old band
 * quietly disengaged. Home sits inside it too, which is why the hero plane's
 * haze is an opacity (`HOME_REST_OPACITY`) rather than the fog's.
 */
export const FOG_NEAR =
  LANDING_STANDING_DISTANCE -
  CONSTELLATION_BOUNDING_RADIUS -
  LANDING_NEAR_HAZE * FOG_BAND;

export const FOG_FAR = FOG_NEAR + FOG_BAND;

/**
 * **How far ahead of the home standing point the hero plane hangs**, in world
 * units. Part 4's `p`.
 *
 * Home is no longer a distance from the graph. It is a place the reader
 * stands, and the hero is a page hung `p` units in front of that place, sized
 * so that from the standing point it covers exactly the pixels the real hero
 * covers (nebula-canvas.tsx solves the plane against the measured DOM). Flying
 * in, the camera passes it `p` units into the journey; looking back from the
 * centre, it is `D − p` away, where `D` is the landing distance.
 *
 * `p` therefore trades two things off. Small, and the page passes the camera
 * almost at once and is a speck from inside; large, and it hangs out in the
 * middle of the flight and looms from the centre. From the centre it appears
 * at `p / (D − p)` of the fraction of the frame it filled at home, through the
 * wider interior lens — at 50 that is a page about a fifth of the frame tall,
 * seen 80 units off. Which is "back there where I left it" rather than "a
 * poster on the far wall", and was picked by looking.
 *
 * It must stay well short of the graph: `D − p` has to clear the bounding
 * radius by a margin, and the landing camera stands closest at the widest
 * viewports. It was 50 when the landing camera stood 162 out; with one lens
 * everywhere (STANDING_FOV) it stands 59 out, and 22 leaves the page 37
 * units from the centre, 22 clear of the shell. From the centre it is then
 * about half the frame tall — close, because everything is close now.
 */
export const HOME_STANDOFF = 22;

/**
 * How present the hero plane is once the reader is inside the graph.
 *
 * The fog band cannot reach it — home sits inside the near plane now that it
 * is `p` ahead of the landing camera rather than beyond it — so this is the
 * haze, applied as opacity. Part 2's note stands: "a quarter faded is not
 * distance, it is a slightly grey sign". A page at two fifths reads as left
 * behind. It fades from full to this over the first half of the flight in,
 * and back over the last half of the flight out, so the swap with the real
 * page always happens at full strength.
 */
export const HOME_REST_OPACITY = 0.4;
