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
 * at 45: `REFERENCE_DISTANCE` 23, the landing camera 83.8, the band 55-210,
 * home 150 at 40 units tall. Those were arrived at by looking, over Parts 1
 * to 3; the formulae are what they turned out to mean.
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
 * measured, to the pixel. 30 is the long lens.
 */
export const STANDING_FOV = 30;

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
 * standing point is 9 units from the middle and the furthest node about 20,
 * against a near plane past 100 — right, because from within a shell there is
 * no recession to describe. And the near plane now sits *behind* the reader on
 * `/nebula`, so it can never quietly re-engage there the way the old band
 * quietly disengaged.
 */
export const FOG_NEAR =
  LANDING_STANDING_DISTANCE -
  CONSTELLATION_BOUNDING_RADIUS -
  LANDING_NEAR_HAZE * FOG_BAND;

export const FOG_FAR = FOG_NEAR + FOG_BAND;

/**
 * How far through the band home sits, seen from inside the graph.
 *
 * Part 2 picked this by looking, and the note it left is the reason it is a
 * constant rather than a distance: "a quarter faded is not distance, it is a
 * slightly grey sign". Three fifths reads as *past* the graph rather than just
 * outside it. Holding the fraction rather than the distance is what keeps that
 * true when the dial moves — at 45 degrees it is the 150 units Part 2 settled
 * on, at 30 it is 196.
 */
const HOME_HAZE = 0.61;

/** Home's distance from the graph's centre, along +z. */
export const HOME_DISTANCE = FOG_NEAR + HOME_HAZE * FOG_BAND;

/**
 * How tall the home plane is, in world units.
 *
 * Derived so that home's *apparent* size from inside the graph is the one Part
 * 2 settled on by looking — 40 units at 150 away — however far the dial pushes
 * it. The interior field of view is not the dial and does not move, so holding
 * the ratio holds the picture.
 */
export const HOME_PLANE_HEIGHT = HOME_DISTANCE * (40 / 150);
