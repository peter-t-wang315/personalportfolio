import Link from "next/link";
import { techById, type ProjectNode } from "@/content";

/**
 * The one rendering of a project's content. `/work/[slug]` renders it as a
 * document and `/nebula/[slug]` renders it inside the node; 02-architecture.md
 * is emphatic that they are the same content object and the prose is never
 * duplicated, so they are the same component too.
 *
 * Server-compatible on purpose — no hooks, no client directive — so both
 * routes ship it as HTML: the document for its own sake, the panel because
 * 05-phase-2.md wants cold entry to have content visible at first paint and
 * the text crawlable.
 *
 * `techLinks` is the only difference between the two hosts. In the document
 * the technology list is a plain line; inside the graph each name is a link to
 * that technology's own node, which is 2.6's sideways navigation — you can
 * follow C# out of a project and see everything else that uses it.
 */
export function ProjectArticle({
  project,
  techLinks = false,
}: {
  project: ProjectNode;
  techLinks?: boolean;
}) {
  const tech = project.techIds
    .map((id) => techById(id))
    .filter((t) => t !== undefined);

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
        {project.title}
      </h1>

      {project.aka ? (
        <p className="text-[0.875rem] text-ink-muted mt-2">
          Known internally as {project.aka}.
        </p>
      ) : null}

      <p className="text-[0.875rem] text-ink-muted mt-3">
        {project.ownershipNote}
      </p>

      <p className="text-[1.0625rem] leading-[1.6] mt-6">{project.oneLine}</p>

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
                <p className="text-[0.8125rem] text-ink-faint">{metric.note}</p>
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
          {tech.map((t, i) => (
            <span key={t.id}>
              {techLinks ? (
                // next/link, not an anchor. A plain href is a document
                // navigation: the whole app reloads, the canvas remounts, and
                // what should have been a flight along the edge between two
                // nodes becomes a cold entry that lands with no movement at
                // all. Client navigation is what lets the camera rig see the
                // route change and fly.
                <Link href={`/nebula/tech/${t.id}`} className="link-underline">
                  {t.label}
                </Link>
              ) : (
                t.label
              )}
              {i < tech.length - 1 ? ", " : ""}
            </span>
          ))}
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
    </>
  );
}
