import * as THREE from "three";

/**
 * **The jump: how the flight between home and the graph is shaped in time.**
 *
 * Every version of this flight that paced a camera moving toward the graph
 * while the reader watched the graph read as "we barely went anywhere", and
 * for a structural reason: with one lens and both compositions fixed, the
 * graph grows about 5x across the trip whatever the schedule, and the eye
 * measures the ratio. A hyperspace jump works because the destination is
 * *not* watched growing — the reference is taken away for the middle of the
 * trip, and the reader arrives at a scale their eye never got to compare.
 *
 * So the flight is three beats, against raw time:
 *
 * - **Wind-up.** The camera holds. On a click this is the page dissolving
 *   into the plane; on a route-driven arrival it is a breath before the
 *   leap.
 * - **Jump.** The scene washes to paper, the lens spikes wide, and the
 *   camera covers most of the distance behind the wash. Nothing is watched
 *   growing. The wash is the only "effect", and it is an absence rather than
 *   an addition: no particles, no streaks — asked for in so many words.
 * - **Arrival.** The wash clears with the camera already at the shell, the
 *   lens snaps back, nodes come past from the edges, and a hard deceleration
 *   settles the reader in the middle. Being inside is shown by what is
 *   streaming past, not by the ball having grown.
 *
 * Going out is the same in reverse: yank, wash, the standing point with the
 * page dissolving in.
 *
 * The camera's *distance* still follows divePose's geometric schedule; this
 * decides how fast that schedule is consumed, and what the wash and the lens
 * are doing at each moment. All fractions of raw progress, 0..1.
 */

/** How long the whole flight takes, in ms. */
export const JUMP_DURATION_MS = 1400;

/** Inbound beats, as fractions of raw progress. */
const IN_WINDUP_END = 0.12;
const IN_JUMP_END = 0.42;
/** Outbound: the yank runs first, the jump comes late, the settle is short. */
const OUT_JUMP_START = 0.4;
const OUT_JUMP_END = 0.72;

/**
 * Where the geometric schedule has got to when the wash clears on the way in
 * — the shell's edge, so the arrival beat is spent entirely inside the near
 * nodes. 0.41 is where `divePose` puts r at about 1.6 bounding radii from a
 * landing distance of 63; it is a fraction of the schedule, not a distance,
 * so it holds as the dial moves.
 */
const IN_SHELL_AT = 0.41;
const OUT_SHELL_AT = 1 - IN_SHELL_AT;

/** How wide the lens goes at the peak of the jump, added to the base fov. */
export const JUMP_LENS_BUMP_DEG = 30;

function clamp01(x: number) {
  return THREE.MathUtils.clamp(x, 0, 1);
}
function smooth(x: number) {
  const u = clamp01(x);
  return u * u * (3 - 2 * u);
}
function easeInCubic(x: number) {
  const u = clamp01(x);
  return u * u * u;
}
function easeOutQuart(x: number) {
  const u = clamp01(x);
  return 1 - Math.pow(1 - u, 4);
}

export interface JumpProfile {
  /** Eased progress for divePose, 0..1. */
  s: number;
  /** Paper wash over the scene, 0..1. */
  wash: number;
  /** Lens bump, 0..1 of JUMP_LENS_BUMP_DEG. */
  lens: number;
}

export function jumpProfile(t: number, inbound: boolean): JumpProfile {
  if (inbound) {
    let s: number;
    if (t <= IN_WINDUP_END) {
      s = 0;
    } else if (t <= IN_JUMP_END) {
      // Accelerating through the wash to the shell's edge.
      s = IN_SHELL_AT * easeInCubic((t - IN_WINDUP_END) / (IN_JUMP_END - IN_WINDUP_END));
    } else {
      // Hard deceleration from the shell to the centre.
      s = IN_SHELL_AT + (1 - IN_SHELL_AT) * easeOutQuart((t - IN_JUMP_END) / (1 - IN_JUMP_END));
    }
    // The wash rises through the first half of the jump and clears through
    // the first stretch of the arrival, so the nodes are already streaming
    // past as it goes.
    const mid = (IN_WINDUP_END + IN_JUMP_END) / 2;
    const wash =
      t < mid
        ? smooth((t - IN_WINDUP_END) / (mid - IN_WINDUP_END))
        : 1 - smooth((t - mid) / (IN_JUMP_END + 0.1 - mid));
    // The lens spikes with the wash and is back by the time the wash clears.
    const lens = Math.sin(Math.PI * clamp01((t - IN_WINDUP_END) / (IN_JUMP_END + 0.06 - IN_WINDUP_END)));
    return { s, wash: clamp01(wash), lens: clamp01(lens) };
  }
  let s: number;
  if (t <= OUT_JUMP_START) {
    // The yank: out through the shell, accelerating.
    s = OUT_SHELL_AT * easeInCubic(t / OUT_JUMP_START);
  } else if (t <= OUT_JUMP_END) {
    s = OUT_SHELL_AT + (1 - OUT_SHELL_AT) * smooth((t - OUT_JUMP_START) / (OUT_JUMP_END - OUT_JUMP_START));
  } else {
    s = 1;
  }
  const mid = (OUT_JUMP_START + OUT_JUMP_END) / 2;
  const wash =
    t < mid
      ? smooth((t - (OUT_JUMP_START - 0.06)) / (mid - (OUT_JUMP_START - 0.06)))
      : 1 - smooth((t - mid) / (OUT_JUMP_END + 0.12 - mid));
  const lens = Math.sin(Math.PI * clamp01((t - (OUT_JUMP_START - 0.06)) / (OUT_JUMP_END + 0.06 - (OUT_JUMP_START - 0.06))));
  return { s, wash: clamp01(wash), lens: clamp01(lens) };
}

/** The wash as the rig set it this frame; read by NebulaWash. */
export const jumpWash = { opacity: 0 };
