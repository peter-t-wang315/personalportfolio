import type { Cluster } from './types';

/**
 * Order matters. Clusters are placed on a Fibonacci sphere in this order,
 * which puts the lowest-order clusters in the front hemisphere at the
 * default camera heading. SEL production work should be what a visitor
 * sees first.
 */
export const clusters: Cluster[] = [
  {
    id: 'solder',
    label: 'Selective solder line',
    context: 'Schweitzer Engineering Laboratories',
    order: 0,
  },
  {
    id: 'throughhole',
    label: 'Through-hole automation platform',
    context: 'Schweitzer Engineering Laboratories',
    order: 1,
  },
  {
    id: 'maintenance',
    label: 'Preventive maintenance platform',
    context: 'Schweitzer Engineering Laboratories',
    order: 2,
  },
  {
    id: 'tools',
    label: 'Operator and developer tools',
    context: 'Schweitzer Engineering Laboratories',
    order: 3,
  },
  {
    id: 'meter',
    label: 'METER Group',
    context: 'Software engineering intern, 2023',
    order: 4,
  },
  {
    id: 'client',
    label: 'Client work',
    context: 'Pullman, WA',
    order: 5,
  },
  {
    id: 'personal',
    label: 'Personal projects',
    context: '',
    order: 6,
  },
];
