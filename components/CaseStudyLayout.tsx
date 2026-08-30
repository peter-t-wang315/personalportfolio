import Link from "next/link";
import type { ReactNode } from "react";
import type { ProjectMeta } from "@/lib/projects";
import CreatureSprite from "./CreatureSprite";
import FactsStrip from "./FactsStrip";
import PrevNext from "./PrevNext";

export default function CaseStudyLayout({
  project,
  problemStatement,
  prev,
  next,
  children,
}: {
  project: ProjectMeta;
  problemStatement: string;
  prev?: ProjectMeta;
  next?: ProjectMeta;
  children: ReactNode;
}) {
  return (
    <article className="mx-auto w-full max-w-3xl px-6 py-16 sm:px-10 md:py-24">
      <Link
        href="/#storage"
        className="font-utility text-xs tracking-wider text-graphite uppercase hover:text-plum"
      >
        ← All projects
      </Link>

      <div className="mt-6 flex items-center gap-4">
        <CreatureSprite variant={project.spriteVariant} size={56} />
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          {project.title}
        </h1>
      </div>
      <p className="mt-4 max-w-xl text-lg text-graphite">{problemStatement}</p>

      {project.liveUrl && (
        <a
          href={project.liveUrl}
          className="mt-4 inline-block rounded-[4px] bg-plum px-5 py-2.5 text-sm font-semibold text-shell"
        >
          Open the live site →
        </a>
      )}

      <div className="mt-10">
        <FactsStrip project={project} />
      </div>

      <div className="prose-case mt-10">{children}</div>

      <PrevNext prev={prev} next={next} />
    </article>
  );
}
