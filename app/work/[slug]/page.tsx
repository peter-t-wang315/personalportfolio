import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { projects, projectBySlug, techById } from "@/content";
import { HomeLink } from "../../home-link";

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

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = projectBySlug(slug);
  if (!project) notFound();

  const tech = project.techIds
    .map((id) => techById(id))
    .filter((t) => t !== undefined);

  return (
    <div className="px-6 pt-8 pb-20 md:px-16 md:pt-10 md:pb-24">
      <div className="max-w-[66ch]">
        <HomeLink />

        <h1
          className="font-display lowercase mt-4"
          style={{
            fontSize: "clamp(1.75rem, 4vw, 2.75rem)",
            fontWeight: 400,
            letterSpacing: "-0.03em",
            lineHeight: 1.15,
          }}
        >
          {project.title}
        </h1>

        <p className="text-[0.875rem] text-ink-muted mt-3">
          {project.ownershipNote}
        </p>

        <p className="text-[1.0625rem] leading-[1.6] mt-6">
          {project.oneLine}
        </p>

        {project.metrics.length > 0 ? (
          <dl className="mt-10 flex flex-wrap gap-10">
            {project.metrics.map((metric) => (
              <div key={metric.label}>
                <dd
                  className="font-display"
                  style={{ fontSize: "2.25rem", letterSpacing: "-0.02em" }}
                >
                  {metric.value}
                </dd>
                <dt className="text-[0.8125rem] text-ink-muted mt-1">
                  {metric.label}
                </dt>
                {metric.note ? (
                  <p className="text-[0.8125rem] text-ink-faint">
                    {metric.note}
                  </p>
                ) : null}
              </div>
            ))}
          </dl>
        ) : null}

        <div className="mt-10 space-y-5">
          {project.body.map((paragraph, i) => (
            <p key={i} className="text-[1.0625rem] leading-[1.6]">
              {paragraph}
            </p>
          ))}
        </div>

        {tech.length > 0 ? (
          <p className="text-[0.875rem] text-ink-muted mt-10">
            {tech.map((t) => t.label).join(", ")}
          </p>
        ) : null}

        {project.links && project.links.length > 0 ? (
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[0.875rem]">
            {project.links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-mask link-underline"
              >
                {link.label}
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
