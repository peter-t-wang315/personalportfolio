import Link from "next/link";

/**
 * The back-link every page carries — "Home" / "/" by default.
 *
 * It scrolls away with the document rather than sticking under the banner, and
 * that is deliberate: the banner is already the persistent way out (the site
 * name goes home, "Work" goes to the list), so a second bar pinned beneath it
 * is two layers of chrome doing one job. This is an orientation cue for the
 * top of a page — where the reader is, and what is above them — and once they
 * are reading it has said what it has to say. Not a general
 * "return to previous route" system: browser back already covers that, and
 * a fixed, predictable target avoids the unpredictability of tracking
 * navigation history. /work/[slug] is the one deliberate exception, since
 * /work is its natural parent, not the landing page — it overrides both
 * props; every other route uses the default.
 */
export function HomeLink({
  label = "Home",
  href = "/",
}: {
  label?: string;
  href?: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-[0.875rem] text-ink-muted link-underline"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M13 4L7 10L13 16"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {label}
    </Link>
  );
}
