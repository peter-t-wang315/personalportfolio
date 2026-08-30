import Link from "next/link";
import CreatureSprite from "./CreatureSprite";
import type { ProjectMeta } from "@/lib/projects";

export default function ProjectTile({ project }: { project: ProjectMeta }) {
  return (
    <li>
      <Link
        href={`/work/${project.slug}`}
        className="group flex h-full flex-col gap-4 rounded-[10px] border-t border-white/35 bg-shell-deep p-5 transition-transform duration-200 ease-out hover:-translate-y-1 focus-visible:-translate-y-1"
      >
        <div className="flex h-28 items-center justify-center rounded-[4px] bg-ink/[0.04]">
          <CreatureSprite
            variant={project.spriteVariant}
            size={72}
            className="transition-transform duration-150 ease-out group-hover:-translate-y-0.5 group-focus-visible:-translate-y-0.5"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <h3 className="font-display text-base leading-snug font-semibold text-ink">
            {project.title}
          </h3>
          <p className="text-sm text-graphite">{project.descriptor}</p>
          <p className="font-utility pt-1 text-[11px] tracking-wide text-graphite">
            {project.stack.join(" · ").toUpperCase()}
          </p>
        </div>
      </Link>
    </li>
  );
}
