import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAdjacentProjects, getProject, projects } from "@/lib/projects";
import CaseStudyLayout from "@/components/CaseStudyLayout";

export function generateStaticParams() {
  return projects.map((p) => ({ slug: p.slug }));
}

export const dynamicParams = false;

async function loadCaseStudy(slug: string) {
  try {
    const mod = await import(`@/content/work/${slug}.mdx`);
    return mod as { default: React.ComponentType; problemStatement: string };
  } catch {
    return null;
  }
}

export async function generateMetadata(
  props: PageProps<"/work/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const project = getProject(slug);
  if (!project) return {};
  return {
    title: `${project.title} — Peter Wang`,
    description: project.descriptor,
  };
}

export default async function CaseStudyPage(props: PageProps<"/work/[slug]">) {
  const { slug } = await props.params;
  const project = getProject(slug);
  if (!project) notFound();

  const mod = await loadCaseStudy(slug);
  if (!mod) notFound();

  const { default: Body, problemStatement } = mod;
  const { prev, next } = getAdjacentProjects(slug);

  return (
    <CaseStudyLayout
      project={project}
      problemStatement={problemStatement}
      prev={prev}
      next={next}
    >
      <Body />
    </CaseStudyLayout>
  );
}
