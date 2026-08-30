import Link from "next/link";
import type { ProjectMeta } from "@/lib/projects";

export default function PrevNext({
  prev,
  next,
}: {
  prev?: ProjectMeta;
  next?: ProjectMeta;
}) {
  if (!prev && !next) return null;

  return (
    <nav
      aria-label="More projects"
      className="mt-16 flex flex-col gap-4 border-t border-shell-deep pt-8 sm:flex-row sm:justify-between"
    >
      {prev ? (
        <Link href={`/work/${prev.slug}`} className="group flex flex-col gap-1">
          <span className="font-utility text-xs tracking-wider text-graphite uppercase">
            ← Previous
          </span>
          <span className="font-display font-semibold text-ink group-hover:text-plum">
            {prev.title}
          </span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link href={`/work/${next.slug}`} className="group flex flex-col gap-1 sm:text-right">
          <span className="font-utility text-xs tracking-wider text-graphite uppercase">
            Next →
          </span>
          <span className="font-display font-semibold text-ink group-hover:text-plum">
            {next.title}
          </span>
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
