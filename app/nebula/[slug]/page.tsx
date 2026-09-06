import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { projects, projectBySlug } from "@/content";
import { NebulaPanel } from "../../nebula-panel";
import { ProjectArticle } from "../../project-article";

export function generateStaticParams() {
  return projects.map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = projectBySlug(slug);
  if (!project) return {};

  return {
    title: `${project.title} | Peter Wang`,
    description: project.oneLine,
    // The same prose exists at /work/[slug]. Declaring that page canonical is
    // what keeps the two from being a duplicate-content problem
    // (02-architecture.md); there is no visitor-facing redirect between them.
    alternates: { canonical: `/work/${project.slug}` },
  };
}

/**
 * A project read from inside its node. Server-rendered, so the prose is in
 * the HTML for a crawler and on screen at first paint for a cold entry — the
 * graph loads in around it rather than the other way round.
 */
export default async function NebulaProject({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = projectBySlug(slug);
  if (!project) notFound();

  return (
    <NebulaPanel nodeId={project.id} documentHref={`/work/${project.slug}`}>
      <ProjectArticle project={project} techLinks />
    </NebulaPanel>
  );
}
