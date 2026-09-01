import { clusters } from './clusters';
import { projects } from './projects';
import { tech } from './tech';

/**
 * Deterministic layout. Positions MUST be identical on every load. A
 * constellation that rearranges itself between visits feels random rather
 * than designed, and deep links stop making spatial sense.
 *
 * Never use Math.random() here.
 */

const SEED = 0x5eed_1e55;

function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

export type Vec3 = [number, number, number];

const CLUSTER_RADIUS = 14;
const CLUSTER_SPREAD = 2.5;
const TECH_SHELL_RADIUS = 20;

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

function relax(points: Vec3[], iterations = 12, minDist = 1.6): Vec3[] {
  const out = points.map((p) => [...p] as Vec3);
  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const d: Vec3 = [
          out[i][0] - out[j][0],
          out[i][1] - out[j][1],
          out[i][2] - out[j][2],
        ];
        const len = Math.hypot(...d) || 0.0001;
        if (len < minDist) {
          const push = (minDist - len) / 2 / len;
          for (let k = 0; k < 3; k++) {
            out[i][k] += d[k] * push;
            out[j][k] -= d[k] * push;
          }
        }
      }
    }
  }
  return out;
}

export function computeLayout(): Record<string, Vec3> {
  const rng = makeRng(SEED);
  const positions: Record<string, Vec3> = {};

  // 1. Cluster centroids on a sphere, ordered so low-order clusters sit
  //    in the front hemisphere at the default camera heading.
  const ordered = [...clusters].sort((a, b) => a.order - b.order);
  const centroids = fibonacciSphere(ordered.length, CLUSTER_RADIUS);
  const centroidById: Record<string, Vec3> = {};
  ordered.forEach((c, i) => {
    centroidById[c.id] = centroids[i];
  });

  // 2. Projects in a small local sphere around their cluster centroid,
  //    then relaxed so nothing overlaps.
  for (const cluster of ordered) {
    const members = projects.filter((p) => p.clusterId === cluster.id);
    const local = fibonacciSphere(Math.max(members.length, 2), CLUSTER_SPREAD)
      .slice(0, members.length)
      .map(
        (p) =>
          [
            p[0] + (rng() - 0.5) * 0.6,
            p[1] + (rng() - 0.5) * 0.6,
            p[2] + (rng() - 0.5) * 0.6,
          ] as Vec3,
      );
    const relaxed = relax(local);
    const c = centroidById[cluster.id];
    members.forEach((m, i) => {
      positions[m.id] = [
        c[0] + relaxed[i][0],
        c[1] + relaxed[i][1],
        c[2] + relaxed[i][2],
      ];
    });
  }

  // 3. Technology nodes on an outer shell, pulled toward the centroid of
  //    the projects that use them so the shell isn't uniform.
  const shell = fibonacciSphere(tech.length, TECH_SHELL_RADIUS);
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
    // 65% shell, 35% pull toward the projects using it.
    positions[t.id] = [
      shell[i][0] * 0.65 + bias[0] * 0.35,
      shell[i][1] * 0.65 + bias[1] * 0.35,
      shell[i][2] * 0.65 + bias[2] * 0.35,
    ];
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
