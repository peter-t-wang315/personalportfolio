export * from './types';
export { clusters } from './clusters';
export { tech } from './tech';
export { projects } from './projects';
export { edges, runtimeEdges, devTimeEdges } from './edges';
export { layout, clusterCentroid, type Vec3 } from './layout';
export { resumeExperience, resumeEducation, resumeProjects } from './resume';

import { projects } from './projects';
import { tech } from './tech';
import { clusters } from './clusters';

export const site = {
  name: 'Peter Wang',
  role: 'Software Engineer II, Schweitzer Engineering Laboratories',
  positioning: 'I make factory machines talk, and I handle everything they say.',
  email: 'contactpeterwang@gmail.com',
  github: 'https://github.com/peter-t-wang315',
  linkedin: 'https://linkedin.com/in/petertwang',
} as const;

/**
 * Hero metrics. The preventive maintenance adoption figure lives on its own
 * node instead, where it has context. Three headline numbers get scrutinised
 * hardest, and that one is the softest of the set.
 */
export const heroMetrics = [
  { value: '18%', label: 'cycle time reduction', note: '+60 boards per day' },
  {
    value: '30+',
    label: 'machines and devices across 6+ vendors',
    note: 'machines, conveyors, cameras, SMEMA controllers',
  },
  { value: '2 sites', label: '6 production lines, running continuously' },
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
 * SEL production clusters. In the Nebula their project nodes carry the solid
 * --mask core; personal, client, and internship work renders hollow.
 */
export const selClusterIds = new Set(
  clusters
    .filter((c) => c.context === 'Schweitzer Engineering Laboratories')
    .map((c) => c.id),
);

export const projectBySlug = (slug: string) =>
  projects.find((p) => p.slug === slug);

export const projectById = (id: string) => projects.find((p) => p.id === id);

export const techById = (id: string) => tech.find((t) => t.id === id);

export const clusterById = (id: string) => clusters.find((c) => c.id === id);

export const projectsUsingTech = (techId: string) =>
  projects.filter((p) => p.techIds.includes(techId));

export const projectsInCluster = (clusterId: string) =>
  projects.filter((p) => p.clusterId === clusterId);

export const allNodeIds = [
  ...projects.map((p) => p.id),
  ...tech.map((t) => t.id),
];
