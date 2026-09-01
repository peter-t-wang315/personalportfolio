import type { Metadata } from "next";
import Link from "next/link";
import { HomeLink } from "../home-link";

export const metadata: Metadata = {
  title: "Coming soon | The Nebula",
  description:
    "An interactive 3D graph of the same projects and technologies, in progress.",
};

export default function NebulaComingSoon() {
  return (
    <div className="min-h-[70vh] flex flex-col px-6 pt-8 pb-10 md:px-16 md:pt-10">
      <HomeLink />
      <div className="flex-1 flex items-center justify-center text-center">
        <div className="max-w-[44ch]">
          <p className="text-[1.0625rem] leading-[1.6]">
            An interactive version of this graph is being built: the same
            projects and technologies, connected as a 3D constellation.
          </p>
          <Link
            href="/work"
            className="mt-6 inline-block text-mask link-underline"
          >
            See the full list of work
          </Link>
        </div>
      </div>
    </div>
  );
}
