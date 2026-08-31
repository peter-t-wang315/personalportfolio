import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Coming soon | The Nebula",
  description:
    "An interactive 3D graph of the same projects and technologies, in progress.",
};

export default function NebulaComingSoon() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6 text-center">
      <div className="max-w-[44ch]">
        <p className="text-[1.0625rem] leading-[1.6]">
          An interactive version of this graph is being built — the same
          projects and technologies, connected as a 3D constellation.
        </p>
        <Link href="/work" className="mt-6 inline-block text-mask link-underline">
          See the full list of work
        </Link>
      </div>
    </div>
  );
}
