import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { projects, projectBySlug } from "@/content";
import { HomeLink } from "../../home-link";
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
  };
}

/**
 * The document form of a project. `/nebula/[slug]` is the other form — the
 * same ProjectArticle inside the node — and it declares this page canonical,
 * so search engines index the prose once, here.
 */
export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = projectBySlug(slug);
  if (!project) notFound();

  return (
    <div className="px-6 pt-8 pb-20 md:px-16 md:pt-10 md:pb-24">
      <div className="max-w-[66ch]">
        <HomeLink label="Work" href="/work" pinned />
        <ProjectArticle project={project} />
      </div>
    </div>
  );
}
