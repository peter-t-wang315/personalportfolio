import type { Metadata } from "next";
import { site, clusters, tech, projectsInCluster } from "@/content";

export const metadata: Metadata = {
  title: "Resume | Peter Wang",
  description: site.role,
};

const orderedClusters = [...clusters].sort((a, b) => a.order - b.order);

export default function Resume() {
  return (
    <div className="px-6 py-20 md:px-16">
      <div className="max-w-[66ch]">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <h1
              className="font-display lowercase"
              style={{
                fontSize: "clamp(1.75rem, 4vw, 2.75rem)",
                fontWeight: 400,
                letterSpacing: "-0.03em",
                lineHeight: 1.15,
              }}
            >
              {site.name}
            </h1>
            <p className="text-[0.875rem] text-ink-muted mt-1">{site.role}</p>
          </div>
          <a
            href="/resume.pdf"
            download
            className="text-[0.875rem] text-mask hover:underline"
          >
            Download PDF
          </a>
        </div>

        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-[0.875rem]">
          <a
            href={`mailto:${site.email}`}
            className="text-mask hover:underline"
          >
            {site.email}
          </a>
          <a
            href={site.github}
            target="_blank"
            rel="noopener noreferrer"
            className="text-mask hover:underline"
          >
            GitHub
          </a>
          <a
            href={site.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="text-mask hover:underline"
          >
            LinkedIn
          </a>
        </div>

        {orderedClusters.map((cluster) => {
          const clusterProjects = projectsInCluster(cluster.id);
          if (clusterProjects.length === 0) return null;

          return (
            <section key={cluster.id} className="mt-14">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                <h2 className="text-[1.0625rem] font-medium">
                  {cluster.label}
                </h2>
                {cluster.context ? (
                  <p className="text-[0.8125rem] text-ink-muted">
                    {cluster.context}
                  </p>
                ) : null}
              </div>

              <ul className="mt-3 space-y-3">
                {clusterProjects.map((project) => (
                  <li key={project.id}>
                    <p className="text-[0.9375rem] font-medium">
                      {project.title}
                    </p>
                    <p className="text-[0.8125rem] text-ink-muted">
                      {project.ownershipNote} {project.oneLine}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        <section className="mt-14">
          <h2 className="text-[1.0625rem] font-medium">Education</h2>
          <p className="mt-3 text-[0.9375rem] text-ink-muted">
            Washington State University
          </p>
        </section>

        <section className="mt-14">
          <h2 className="text-[1.0625rem] font-medium">Skills</h2>
          <p className="mt-3 text-[0.9375rem] text-ink-muted">
            {tech.map((t) => t.label).join(", ")}.
          </p>
        </section>
      </div>
    </div>
  );
}
