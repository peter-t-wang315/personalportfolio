import Link from "next/link";
import { clusters, projects, type TechNode } from "@/content";

/**
 * A technology node's interior. There is no `/work` equivalent — a technology
 * has a blurb, not prose — so this is the one place it is read, and what it
 * mostly contains is a way onward: every project that uses it, linked to that
 * project's own node. Following `C#` out of a project and landing on a list of
 * everything else written in it is the sideways navigation 05-phase-2.md asks
 * for, made concrete.
 *
 * Grouped by cluster in cluster order so the list reads the way the graph is
 * laid out, not as an alphabet.
 */
export function TechArticle({ tech }: { tech: TechNode }) {
  const using = projects.filter((p) => p.techIds.includes(tech.id));
  const byCluster = [...clusters]
    .sort((a, b) => a.order - b.order)
    .map((cluster) => ({
      cluster,
      projects: using.filter((p) => p.clusterId === cluster.id),
    }))
    .filter((group) => group.projects.length > 0);

  return (
    <>
      <h1
        className="font-display lowercase mt-4"
        style={{
          fontSize: "clamp(1.75rem, 4vw, 2.75rem)",
          fontWeight: 400,
          letterSpacing: "-0.03em",
          lineHeight: 1.15,
        }}
      >
        {tech.label}
      </h1>

      <p className="text-[1.0625rem] leading-[1.6] mt-6">{tech.blurb}</p>

      <p className="text-[0.875rem] text-ink-muted mt-10">
        {using.length === 1
          ? "Used in one project."
          : `Used in ${using.length} projects.`}
      </p>

      <div className="mt-6 space-y-8">
        {byCluster.map(({ cluster, projects: group }) => (
          <section key={cluster.id}>
            <h2 className="text-[0.8125rem] text-ink-faint">
              {cluster.label}
              <span className="text-ink-faint"> · {cluster.context}</span>
            </h2>
            <ul className="mt-2 space-y-2">
              {group.map((project) => (
                <li key={project.id}>
                  {/* next/link for the same reason as the technology list in
                      project-article.tsx: a document navigation would reload
                      the canvas and turn the flight into a cold landing. */}
                  <Link
                    href={`/nebula/${project.slug}`}
                    className="text-[1.0625rem] link-underline"
                  >
                    {project.title}
                  </Link>
                  <p className="text-[0.875rem] text-ink-muted mt-0.5">
                    {project.oneLine}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
