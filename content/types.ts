export type Ownership = 'sole' | 'lead' | 'contributor';

export type NodeSize = 'major' | 'standard';

export type EdgeKind = 'runtime' | 'dev-time' | 'shared-tech';

export interface Cluster {
  id: string;
  label: string;
  context: string;
  order: number;
}

export interface TechNode {
  id: string;
  label: string;
  blurb: string;
}

export interface Metric {
  value: string;
  label: string;
  note?: string;
}

export interface ProjectLink {
  label: string;
  href: string;
}

export interface ProjectNode {
  id: string;
  slug: string;
  title: string;
  /** Internal name, shown as a subtitle where one exists. */
  aka?: string;
  clusterId: string;
  ownership: Ownership;
  /** Stated in plain text on the project page. Never implied by styling alone. */
  ownershipNote: string;
  /** One line, shown on hover in the Nebula. */
  oneLine: string;
  /** Paragraphs. Rendered identically on /work/[slug] and inside the node. */
  body: string[];
  metrics: Metric[];
  techIds: string[];
  links?: ProjectLink[];
  size: NodeSize;
}

/** Resume-only content. Terse, resume-style phrasing, distinct from the prose in ProjectNode.body. */
export interface ResumeExperience {
  title: string;
  org: string;
  location: string;
  start: string;
  end: string;
  bullets: string[];
}

export interface ResumeProject {
  title: string;
  link?: ProjectLink;
  stack: string;
  start: string;
  end: string;
  bullets: string[];
}

export interface ResumeEducation {
  school: string;
  location: string;
  degree: string;
  gpa: string;
  start: string;
  end: string;
}

export interface Edge {
  id: string;
  from: string;
  to: string;
  kind: EdgeKind;
  /** Runtime and dev-time edges only. Shown on hover. */
  protocol?: string;
  /** The deep technical detail. This is where architecture concepts live. */
  detail?: string;
}
