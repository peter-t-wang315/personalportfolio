import { projectById, projectBySlug, techById } from "@/content";

/**
 * The URL ↔ node id mapping for `/nebula`. Two facts make this a module
 * rather than a string template:
 *
 * - URLs use project **slugs** and the scene uses project **ids**, and twelve
 *   of the twenty differ (`th-supervisor` is `/station-supervisor`,
 *   `solder-driver` is `/selective-solder-driver`, ...). Assuming they match
 *   would 404 more than half the graph.
 * - Tech nodes have no `/work` page, so they get their own segment,
 *   `/nebula/tech/[id]`, keyed by id since that is all they have. A static
 *   `tech` segment wins over the dynamic `[slug]` beside it, so
 *   `/nebula/tech/csharp` can never be read as a project called "tech".
 *
 * Every node the scene can focus therefore has exactly one URL, which is what
 * lets the URL be the single source of truth for focus (02-architecture.md):
 * back and forward work because the route drives the store, never the reverse.
 */
export function routeForNode(id: string): string | null {
  const project = projectById(id);
  if (project) return `/nebula/${project.slug}`;
  if (techById(id)) return `/nebula/tech/${id}`;
  return null;
}

/** The focused node id a `/nebula*` pathname names, or null for the bare graph. */
export function nodeIdForPathname(pathname: string): string | null {
  const tech = pathname.match(/^\/nebula\/tech\/([^/]+)\/?$/);
  if (tech) return techById(tech[1])?.id ?? null;
  const project = pathname.match(/^\/nebula\/([^/]+)\/?$/);
  if (project) return projectBySlug(project[1])?.id ?? null;
  return null;
}

/**
 * The project a `/work/[slug]` pathname is about, as a node id.
 *
 * `/work/[slug]` shows the globe from outside and turns it so this node's
 * cluster faces the reader — the counterpart to `/nebula`, where you are
 * inside it. The list page `/work` has no single subject, so it gets none.
 */
export function nodeIdForWorkPathname(pathname: string): string | null {
  const match = pathname.match(/^\/work\/([^/]+)\/?$/);
  if (!match) return null;
  return projectBySlug(match[1])?.id ?? null;
}

/** Where `/nebula/...` sends a visitor who cannot use the graph. */
export function documentRouteForNode(id: string): string {
  const project = projectById(id);
  return project ? `/work/${project.slug}` : "/work";
}
