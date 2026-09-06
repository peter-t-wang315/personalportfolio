import { clusters } from './clusters';
import { projects } from './projects';
import { tech } from './tech';
import { makeRng } from '@/lib/seeded-random';

/**
 * Deterministic layout. Positions MUST be identical on every load. A
 * constellation that rearranges itself between visits feels random rather
 * than designed, and deep links stop making spatial sense.
 *
 * Never use Math.random() here.
 */

const SEED = 0x5eed_1e55;

export type Vec3 = [number, number, number];

/**
 * **The constellation is a hollow sphere.** Every node — project and
 * technology alike — sits on one shell at SHELL_RADIUS, give or take
 * SHELL_THICKNESS. Nothing is inside it.
 *
 * That is the whole composition, and it is an information-design rule before
 * it is a look: on a shell nothing can hide behind anything else, so the graph
 * has no bad angle. It also gives `/nebula` an interior to fly into and
 * `/work/[slug]` an exterior to rotate.
 *
 * It replaces a filled ball. Cluster centroids were already on a sphere at 14
 * and projects sat near them, but technology nodes were placed as
 * `shellPosition * 0.3 + averageOfTheProjectsUsingIt * 0.7`, and an average of
 * positions spread over a sphere lands near its centre — so the technologies
 * used most collapsed inward. Measured on that layout: tech averaged r = 9.2
 * against a nominal shell of 20, TypeScript (ten projects across five
 * clusters) sat at r = 1.8, essentially dead centre, and ten of the
 * forty-five nodes were inside r = 8. The middle was full of exactly the
 * things a visitor most wants to see.
 *
 * The usage bias survives, but as a **direction** rather than a position: it
 * still decides *where on the shell* a technology sits, so it stays beside the
 * work that uses it. It just cannot pull anything off the surface.
 */
const SHELL_RADIUS = 16;
/**
 * Radial slack, so the shell reads as a cloud layer rather than a decal on a
 * ball. Small relative to SHELL_RADIUS — enough to give the surface depth
 * under fog, not enough to reintroduce occlusion.
 */
const SHELL_THICKNESS = 1.2;
/**
 * How far a cluster's projects spread across the shell from their centroid,
 * in world units along the surface. Read as an arc length, not a radius: the
 * spread is tangential now, so this is how wide a patch a cluster occupies.
 */
const CLUSTER_SPREAD = 3.2;

/** Fibonacci sphere: even distribution, no clumping. */
function fibonacciSphere(count: number, radius: number): Vec3[] {
  const points: Vec3[] = [];
  const phi = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / Math.max(count - 1, 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = phi * i;
    points.push([
      Math.cos(theta) * r * radius,
      y * radius,
      Math.sin(theta) * r * radius,
    ]);
  }
  return points;
}

function length(v: Vec3): number {
  return Math.hypot(v[0], v[1], v[2]);
}

/** Rescales a vector to `radius`, falling back to `fallback` if it has no
 * direction to preserve — the degenerate case where a technology's usage bias
 * cancels out to nothing. */
function onShell(v: Vec3, radius: number, fallback: Vec3): Vec3 {
  const len = length(v);
  if (len < 1e-6) return onShell(fallback, radius, [0, radius, 0]);
  return [(v[0] / len) * radius, (v[1] / len) * radius, (v[2] / len) * radius];
}

/** Two unit vectors spanning the tangent plane at `n` (which must be unit).
 * The seed axis is chosen away from `n` so the cross product can't degenerate
 * at the poles. */
function tangentBasis(n: Vec3): [Vec3, Vec3] {
  const seed: Vec3 = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u: Vec3 = [
    seed[1] * n[2] - seed[2] * n[1],
    seed[2] * n[0] - seed[0] * n[2],
    seed[0] * n[1] - seed[1] * n[0],
  ];
  const ul = length(u) || 1;
  const uN: Vec3 = [u[0] / ul, u[1] / ul, u[2] / ul];
  const v: Vec3 = [
    n[1] * uN[2] - n[2] * uN[1],
    n[2] * uN[0] - n[0] * uN[2],
    n[0] * uN[1] - n[1] * uN[0],
  ];
  return [uN, v];
}

/**
 * Pushes apart any pair closer than `minDist`, then puts every point back on
 * the shell at the radius it started with.
 *
 * Run over **all** nodes at once, not per cluster. On a filled ball a
 * technology and a project could be close in angle and still far apart in
 * radius; on one surface that slack is gone, and the technologies pulled
 * toward popular clusters land right on top of the projects that attracted
 * them. Re-projecting inside the loop is what keeps the repulsion tangential —
 * a plain 3-D shove would relieve the crowding by moving nodes off the shell,
 * which is the one thing this layout may not do.
 */
function relaxOnShell(
  points: Vec3[],
  radii: number[],
  iterations = 24,
  minDist = 1.9,
): Vec3[] {
  const out = points.map((p) => [...p] as Vec3);
  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const d: Vec3 = [
          out[i][0] - out[j][0],
          out[i][1] - out[j][1],
          out[i][2] - out[j][2],
        ];
        const len = length(d) || 0.0001;
        if (len < minDist) {
          const push = (minDist - len) / 2 / len;
          for (let k = 0; k < 3; k++) {
            out[i][k] += d[k] * push;
            out[j][k] -= d[k] * push;
          }
        }
      }
    }
    for (let i = 0; i < out.length; i++) {
      out[i] = onShell(out[i], radii[i], out[i]);
    }
  }
  return out;
}

export function computeLayout(): Record<string, Vec3> {
  const rng = makeRng(SEED);
  const positions: Record<string, Vec3> = {};

  // 1. Cluster centroids on the shell, ordered so low-order clusters sit
  //    in the front hemisphere at the default camera heading.
  const ordered = [...clusters].sort((a, b) => a.order - b.order);
  const centroids = fibonacciSphere(ordered.length, SHELL_RADIUS);
  const centroidById: Record<string, Vec3> = {};
  ordered.forEach((c, i) => {
    centroidById[c.id] = centroids[i];
  });

  // 2. Projects in a small local sphere around their cluster centroid,
  //    then relaxed so nothing overlaps.
  for (const cluster of ordered) {
    const members = projects.filter((p) => p.clusterId === cluster.id);
    // A patch on the surface, not a ball around a point: the local offsets
    // are laid out in the tangent plane at the centroid and only the third
    // component becomes radial, scaled right down to SHELL_THICKNESS.
    const local = fibonacciSphere(Math.max(members.length, 2), CLUSTER_SPREAD)
      .slice(0, members.length)
      .map(
        (p) =>
          [
            p[0] + (rng() - 0.5) * 0.8,
            p[1] + (rng() - 0.5) * 0.8,
            p[2] + (rng() - 0.5) * 0.8,
          ] as Vec3,
      );
    const c = centroidById[cluster.id];
    const n = onShell(c, 1, [0, 1, 0]);
    const [u, v] = tangentBasis(n);
    members.forEach((m, i) => {
      const [lx, ly, lz] = local[i];
      const tangent: Vec3 = [
        n[0] * SHELL_RADIUS + u[0] * lx + v[0] * ly,
        n[1] * SHELL_RADIUS + u[1] * lx + v[1] * ly,
        n[2] * SHELL_RADIUS + u[2] * lx + v[2] * ly,
      ];
      const radius =
        SHELL_RADIUS + (lz / Math.max(CLUSTER_SPREAD, 1e-6)) * SHELL_THICKNESS;
      positions[m.id] = onShell(tangent, radius, tangent);
    });
  }

  // 3. Technology nodes on the same shell, pulled toward the projects that
  //    use them so the surface isn't uniform.
  const shell = fibonacciSphere(tech.length, SHELL_RADIUS);
  tech.forEach((t, i) => {
    const users = projects.filter((p) => p.techIds.includes(t.id));
    if (users.length === 0) {
      positions[t.id] = shell[i];
      return;
    }
    const avg = users.reduce<Vec3>(
      (acc, p) => {
        const pos = positions[p.id] ?? [0, 0, 0];
        return [acc[0] + pos[0], acc[1] + pos[1], acc[2] + pos[2]];
      },
      [0, 0, 0],
    );
    const n = users.length;
    const bias: Vec3 = [avg[0] / n, avg[1] / n, avg[2] / n];
    // 30% shell, 70% pull toward the projects using it — tech nodes read as
    // satellites of their clusters, not an independent scattered population.
    //
    // The blend then goes back onto the shell, and that projection is the
    // whole difference between this layout and the filled ball it replaces.
    // The bias decides a *direction*; it cannot decide a radius. A technology
    // spread across many clusters still averages toward the origin, but a
    // vector pointing at the origin has no direction to keep, so it falls
    // back to its own Fibonacci slot rather than landing in the middle.
    const biased: Vec3 = [
      shell[i][0] * 0.3 + bias[0] * 0.7,
      shell[i][1] * 0.3 + bias[1] * 0.7,
      shell[i][2] * 0.3 + bias[2] * 0.7,
    ];
    const jitter = (rng() - 0.5) * 2 * SHELL_THICKNESS;
    positions[t.id] = onShell(biased, SHELL_RADIUS + jitter, shell[i]);
  });

  // 4. One relaxation pass over the whole surface — see relaxOnShell.
  const ids = Object.keys(positions);
  const relaxed = relaxOnShell(
    ids.map((id) => positions[id]),
    ids.map((id) => length(positions[id])),
  );
  ids.forEach((id, i) => {
    positions[id] = relaxed[i];
  });

  return positions;
}

export const layout = computeLayout();

export function clusterCentroid(clusterId: string): Vec3 {
  const members = projects.filter((p) => p.clusterId === clusterId);
  if (members.length === 0) return [0, 0, 0];
  const sum = members.reduce<Vec3>(
    (acc, p) => {
      const pos = layout[p.id];
      return [acc[0] + pos[0], acc[1] + pos[1], acc[2] + pos[2]];
    },
    [0, 0, 0],
  );
  return [
    sum[0] / members.length,
    sum[1] / members.length,
    sum[2] / members.length,
  ];
}
