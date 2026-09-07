import Link from "next/link";

/**
 * The back-link every page carries — "Home" / "/" by default. Not a general
 * "return to previous route" system: browser back already covers that, and
 * a fixed, predictable target avoids the unpredictability of tracking
 * navigation history. /work/[slug] is the one deliberate exception, since
 * /work is its natural parent, not the landing page — it overrides both
 * props; every other route uses the default.
 */
export function HomeLink({
  label = "Home",
  href = "/",
  pinned = false,
}: {
  label?: string;
  href?: string;
  /**
   * Stick below the site header instead of scrolling away with the page.
   *
   * Every route that carries the banner needs this: the link sits above the
   * article in normal flow, so on anything long enough to scroll it slid up
   * under the banner and off the top — measured, gone by 133px of scroll on a
   * desktop project page and on nearly every page at 390x844. The way out of
   * a document should not be something you have to scroll back up to find.
   *
   * Off by default because the Nebula routes position this themselves against
   * a full-viewport canvas, where there is no banner to hang from and nothing
   * scrolls underneath it.
   */
  pinned?: boolean;
}) {
  const link = (
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

  if (!pinned) return link;

  // `bg-paper` because the article scrolls behind it, and the negative margin
  // widens that band past the link's own box so descenders and the hover rule
  // are not clipped by text sliding under the edge.
  return (
    <div className="sticky top-header z-10 -mx-2 bg-paper px-2 pb-3">
      {link}
    </div>
  );
}
