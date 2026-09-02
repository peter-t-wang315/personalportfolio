"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { site } from "@/content";

const links = [
  { label: "About", href: "/about" },
  { label: "Work", href: "/work" },
  { label: "Resume", href: "/resume" },
];

/**
 * Persistent way back to the rest of the site from anywhere except the
 * landing page, which already carries the full link row in its hero, and
 * the Nebula routes, which are an immersive full-viewport canvas — no
 * chrome should compete with it there. Those routes keep only the small
 * corner HomeLink (see nebula/page.tsx) as their sole way out.
 */
export function SiteHeader() {
  const pathname = usePathname();
  if (pathname === "/" || pathname.startsWith("/nebula")) return null;

  return (
    <header className="sticky top-0 z-20 bg-paper border-b border-ink-faint/30">
      <div className="px-6 md:px-16 py-5 flex items-center justify-between">
        <Link href="/" className="text-[0.9375rem] font-medium inline-block link-underline">
          {site.name}
        </Link>
        <nav aria-label="Primary" className="flex gap-x-6 text-[0.875rem]">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-mask link-underline"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
