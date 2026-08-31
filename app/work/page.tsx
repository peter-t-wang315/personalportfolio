import type { Metadata } from "next";
import Link from "next/link";
import { clusters, projectsInCluster } from "@/content";

export const metadata: Metadata = {
  title: "Work | Peter Wang",
  description: "Every project, grouped by where it was built.",
};

const orderedClusters = [...clusters].sort((a, b) => a.order - b.order);

export default function WorkList() {
  return (
    <div className="px-6 py-20 md:px-16">
      <div className="max-w-[66ch]">
        <h1
          className="font-display lowercase"
          style={{
            fontSize: "clamp(1.75rem, 4vw, 2.75rem)",
            fontWeight: 400,
            letterSpacing: "-0.03em",
            lineHeight: 1.15,
          }}
        >
          work
        </h1>

        {orderedClusters.map((cluster) => {
          const clusterProjects = projectsInCluster(cluster.id);
          if (clusterProjects.length === 0) return null;

          return (
            <section key={cluster.id} className="mt-16">
              <h2 className="text-[1.25rem] font-medium">{cluster.label}</h2>
              {cluster.context ? (
                <p className="text-[0.875rem] text-ink-muted mt-1">
                  {cluster.context}
                </p>
              ) : null}

              <ul className="mt-6 divide-y divide-ink-faint/30">
                {clusterProjects.map((project) => (
                  <li key={project.id} className="py-5">
                    <Link href={`/work/${project.slug}`} className="group block">
                      <p className="text-[1.0625rem] font-medium inline-block link-underline">
                        {project.title}
                      </p>
                      <p className="text-[0.875rem] text-ink-muted mt-1">
                        {project.oneLine}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
