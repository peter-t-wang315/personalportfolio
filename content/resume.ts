import type { ResumeEducation, ResumeExperience, ResumeProject } from './types';

/**
 * Resume-only content: terse, achievement-phrased bullets matching the
 * downloadable PDF (public/Peter_Wang_Resume.pdf), not the narrative prose in
 * projects.ts. The two documents describe the same work differently on
 * purpose, one is a resume, one is a site.
 */
export const resumeExperience: ResumeExperience[] = [
  {
    title: 'Software Engineer II',
    org: 'Schweitzer Engineering Laboratories',
    location: 'Pullman, WA',
    start: 'June 2024',
    end: 'Present',
    bullets: [
      'Architected three C#/.NET services over RabbitMQ, TCP, and REST automating selective solder program selection; cut cycle time 18% (+60 boards/day), stable in 24/7 production since launch',
      'Delivered a three-tier C# supervisor/worker/client stack over RabbitMQ for through-hole automation, adapted from a sister team\'s pattern; live on 7+ machines across 6 lines at 2 sites',
      'Hardened driver connectivity with automatic TCP/IP reconnect, exponential backoff, and machine heartbeat monitoring; stateless restarts recover mid-cycle without losing machine state',
      'Normalized SMEMA handshakes and proprietary protocols from 30+ machines and devices across 6+ vendors into IPC-CFX, unifying inter-service messaging and Splunk/Azure telemetry',
      'Sole developer of the React/MUI client for a preventive maintenance platform, caching 10k+ ID-linked records in Jotai for instant local editing and multi-level revert across a machine → checklist → section → task hierarchy; used by 30%+ of manufacturing',
      'Directed schema and API design behind it across frontend, backend, and DBA teams: four-level many-to-many hierarchy, frequency scheduling, immutable execution records',
      'Migrated Flying Probe testing from WPF to a React/Redux dashboard polling machine state for board queues, barcode-miss imaging, and pass/fail across 3k+ PCBs daily',
      'Built a RabbitMQ/CFX developer client on personal initiative, giving the team its first practical way to test messages without a live machine; adopted by all four engineers',
      'Led team adoption of a sister team\'s Kubernetes monorepo, containerizing C# services via Docker, Jenkins, and Helm; reduced new-vendor bring-up to a normalization layer',
      'Mentored a junior developer building a Blazor RabbitMQ monitor with live filtering over 5k+ events and self-service driver recovery, cutting escalations to near zero',
    ],
  },
  {
    title: 'Software Engineer Intern',
    org: 'METER Group',
    location: 'Pullman, WA',
    start: 'March 2022',
    end: 'April 2024',
    bullets: [
      'Leveraged React and Material UI to create ZENTRA webpages and components used by over 90% of users',
      'Deployed a Python weather data pipeline on AWS Lambda and DynamoDB via Serverless Framework for soil moisture predictions',
      'Optimized query scripts for Django models, handling over 150k objects, to assess customer habits',
    ],
  },
];

export const resumeEducation: ResumeEducation = {
  school: 'Washington State University',
  location: 'Pullman, WA',
  degree: 'Bachelor of Science in Software Engineering w/ Math Minor',
  gpa: '3.7',
  start: 'Aug. 2020',
  end: 'May 2024',
};

export const resumeProjects: ResumeProject[] = [
  {
    title: 'VGCLite',
    link: { label: 'vgclite.com', href: 'https://vgclite.com' },
    stack: 'Claude, TypeScript, Next.js, Tailwind CSS, Vercel',
    start: 'June 2026',
    end: 'Current',
    bullets: [
      'Architected a Pokémon VGC scouting web app that surfaces opponents\' most common builds, runs damage calculations, and compares speed tiers to flag matchup threats against the user\'s team',
      'Kept lookups fast with a tuned caching layer over Pikalytics and Smogon data behind Next.js route handlers, auto-discovering the latest published stats period at runtime',
      'Eliminated redundant API calls and race conditions from out-of-order responses via a client-side caching and request-deduplication layer with optimistic loading placeholders and stale-write guards',
    ],
  },
  {
    title: 'Pokémon Team Builder',
    link: { label: 'peterptb.vercel.app', href: 'https://peterptb.vercel.app' },
    stack: 'TypeScript, Next.js, Radix UI',
    start: 'August 2025',
    end: 'March 2026',
    bullets: [
      'Built a Pokémon team advisor web app to create type-balanced teams across all mainline games',
      'Designed a weighted scoring algorithm that rates each type against current team coverage, guiding users to the most type-comprehensive team',
    ],
  },
];
