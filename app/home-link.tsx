import Link from "next/link";

/** Sits in the gap between the sticky header and each page's own content. */
export function HomeLink() {
  return (
    <Link
      href="/"
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
      Home
    </Link>
  );
}
