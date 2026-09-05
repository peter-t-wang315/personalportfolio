export * from './types';
export { clusters } from './clusters';
export { tech } from './tech';
export { projects } from './projects';
export { edges } from './edges';
export { layout, clusterCentroid, type Vec3 } from './layout';
export { resumeExperience, resumeEducation, resumeProjects } from './resume';

import { projects } from './projects';
import { tech } from './tech';

export const site = {
  name: 'Peter Wang',
  role: 'Software Engineer II, Schweitzer Engineering Laboratories',
  positioning: 'I make systems talk to each other',
  email: 'contactpeterwang@gmail.com',
  github: 'https://github.com/peter-t-wang315',
  linkedin: 'https://linkedin.com/in/petertwang',
} as const;

/**
 * Hero metrics. The preventive maintenance adoption figure lives on its own
 * node instead, where it has context. Three headline numbers get scrutinised
 * hardest, and that one is the softest of the set.
 *
 * The mobile/tablet compact row is `heroMetricsCompact` below, not a `short`
 * field on each metric — see the note there for why the two are not a 1:1 map.
 */
export const heroMetrics = [
  {
    value: '18%',
    label: 'cycle time reduction',
    note: '+60 boards per day',
  },
  {
    value: '30+',
    label: 'machines and devices across 6+ vendors',
    note: 'machines, conveyors, cameras, SMEMA controllers',
  },
  {
    value: '2 sites',
    label: '6 production lines, running continuously',
  },
] as const;

/**
 * The compact hero row for phones and tablets (hero-stats.tsx), where the
 * desktop `<dl>`'s stacked value/label/note per metric doesn't fit.
 *
 * Deliberately *not* a per-metric `short` field, because it isn't a
 * truncation. Collapsing each metric to its value gave "18%  30+  2 sites",
 * which is three numbers with the sentence that made them mean something
 * stripped off. This is its own phrasing instead: it reads as one line of
 * prose, and it draws on the second metric twice (its value and its vendor
 * count) rather than once each.
 *
 * The cost is that the cycle-time figure has no room here, so it is a desktop
 * and `/work` number only. That is the deliberate trade — an unexplained
 * "18%" was buying nothing on a phone.
 */
export const heroMetricsCompact = [
  '30+ machines',
  '6+ vendors',
  'across 2 sites',
] as const;

/** Guided tour order. Strongest first, ending on something human. */
export const tourOrder = [
  'th-supervisor',
  'solder-driver',
  'maintenance-client',
  'cfx-dev-client',
  'timesense',
] as const;

/**
 * Node category, not an ownership signal — professional vs. personal, plus
 * tech nodes as their own population (categorized directly in
 * lib/node-geometry.ts, not here, since they're never clustered). In the
 * Nebula this drives the translucent inner core: professional project
 * nodes carry one, personal ones render fully hollow. "Professional" is the
 * four SEL clusters plus the METER internship; "personal" is the personal
 * and client-work clusters. Exhaustive over content/clusters.ts's current
 * seven clusters — solder, throughhole, maintenance, tools, meter here;
 * client and personal the only two left out.
 */
export const professionalClusterIds = new Set([
  'solder',
  'throughhole',
  'maintenance',
  'tools',
  'meter',
]);

export const projectBySlug = (slug: string) =>
  projects.find((p) => p.slug === slug);

export const projectById = (id: string) => projects.find((p) => p.id === id);

export const techById = (id: string) => tech.find((t) => t.id === id);

export const projectsInCluster = (clusterId: string) =>
  projects.filter((p) => p.clusterId === clusterId);

export const allNodeIds = [
  ...projects.map((p) => p.id),
  ...tech.map((t) => t.id),
];
