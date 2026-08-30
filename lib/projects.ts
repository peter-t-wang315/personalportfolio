export type ProjectMeta = {
  slug: string;
  title: string;
  descriptor: string;
  stack: string[];
  role: string;
  scale: string;
  spriteVariant: 1 | 2 | 3 | 4;
  liveUrl?: string;
};

// Order here is the order they appear in the storage grid and in prev/next
// case-study navigation. Do not reorder without a reason — see docs/04.
export const projects: ProjectMeta[] = [
  {
    slug: "solder-pipeline",
    title: "Event pipeline for selective solder automation",
    descriptor: "Three services, one solder line",
    stack: ["C#/.NET", "RabbitMQ", "TCP sockets", "REST"],
    role: "Software Engineer II, Schweitzer Engineering Laboratories",
    scale: "One solder line, three coordinated services",
    spriteVariant: 1,
  },
  {
    slug: "station-supervisor",
    title: "Station supervisor and plugin worker topology",
    descriptor: "Six lines, two sites",
    stack: ["C#/.NET", "Docker", "Kubernetes", "Helm", "Jenkins"],
    role: "Software Engineer II, Schweitzer Engineering Laboratories",
    scale: "Six production lines, two sites",
    spriteVariant: 2,
  },
  {
    slug: "protocol-layer",
    title: "Protocol translation layer",
    descriptor: "Twelve machines, one schema",
    stack: ["C#/.NET", "SMEMA", "IPC-CFX", "TCP"],
    role: "Software Engineer II, Schweitzer Engineering Laboratories",
    scale: "12+ machines, three vendor protocols, one schema",
    spriteVariant: 3,
  },
  {
    slug: "maintenance-platform",
    title: "Preventive maintenance platform",
    descriptor: "Schema design to shipped UI",
    stack: ["C#/.NET", "SQL", "React", "MUI", "Jotai"],
    role: "Software Engineer II, Schweitzer Engineering Laboratories",
    scale: "Two sites, roughly 30% of manufacturing (adoption scope, not impact)",
    spriteVariant: 4,
  },
  {
    slug: "flying-probe",
    title: "Flying probe dashboard migration",
    descriptor: "WPF to React, in production",
    stack: ["React", "Redux", "C#/.NET"],
    role: "Software Engineer II, Schweitzer Engineering Laboratories",
    scale: "Operator-facing, factory floor",
    spriteVariant: 1,
  },
  {
    slug: "vgclite",
    title: "VGCLite",
    descriptor: "Built end-to-end with Claude Code",
    stack: ["Next.js", "React", "TypeScript", "Tailwind CSS", "Vercel"],
    role: "Independent developer",
    scale: "Live at vgclite.com — real users",
    spriteVariant: 2,
    liveUrl: "https://vgclite.com",
  },
  {
    slug: "beholderwebui",
    title: "BeholderWebUI",
    descriptor: "RabbitMQ monitor, built to mentor",
    stack: ["Blazor", "C#/.NET", "RabbitMQ"],
    role: "Software Engineer II, Schweitzer Engineering Laboratories",
    scale: "5,000-message working set, internal only",
    spriteVariant: 3,
  },
];

export function getProject(slug: string) {
  return projects.find((p) => p.slug === slug);
}

export function getAdjacentProjects(slug: string) {
  const index = projects.findIndex((p) => p.slug === slug);
  return {
    prev: index > 0 ? projects[index - 1] : undefined,
    next: index < projects.length - 1 ? projects[index + 1] : undefined,
  };
}
