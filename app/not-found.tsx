import type { Metadata } from "next";
import Link from "next/link";
import { MissingPageMarker } from "@/lib/missing-page";
import { HomeLink } from "./home-link";

export const metadata: Metadata = {
  title: "Not found | Peter Wang",
};

/**
 * Every URL that is not a page, and every `notFound()` a route throws:
 * `/nonexistent`, `/work/nope`, `/nebula/bogus` alike.
 *
 * On paper, like any other document page, and only paper. The canvas is
 * persisted in the root layout and would otherwise draw the cluster through
 * the message, so this lays a sheet of the page colour over it, inside
 * `<main>`'s stacking context (above the canvas, below the header), and the
 * marker tells the chrome this is a plain document whatever the URL says
 * (lib/missing-page.ts). The scene keeps rendering behind the sheet: leaving
 * the graph for a missing URL is still a flight out, and the curtain that
 * holds this page back is dropped by the camera rig's progress through it.
 */
export default function NotFound() {
  return (
    <>
      <MissingPageMarker />
      <div aria-hidden="true" className="fixed inset-0 -z-10 bg-paper" />
      <div className="px-6 pt-8 pb-20 md:px-16 md:pt-10 md:pb-24">
        <div className="max-w-[66ch]">
          <HomeLink />

          <h1
            className="font-display lowercase mt-4"
            style={{
              fontSize: "clamp(1.75rem, 4vw, 2.75rem)",
              fontWeight: 400,
              letterSpacing: "-0.03em",
              lineHeight: 1.15,
            }}
          >
            not found
          </h1>

          <p className="mt-10 md:mt-14 text-[1.0625rem] leading-[1.6]">
            There&apos;s nothing at this address. It may have moved, or the
            link may have a typo in it.
          </p>

          <nav
            aria-label="Somewhere else"
            className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[0.9375rem]"
          >
            <Link href="/work" className="link-underline">
              Work
            </Link>
            <Link href="/about" className="link-underline">
              About
            </Link>
            <Link href="/resume" className="link-underline">
              Resume
            </Link>
          </nav>
        </div>
      </div>
    </>
  );
}
