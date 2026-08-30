import type { Metadata } from "next";
import Link from "next/link";
import CreatureSprite from "@/components/CreatureSprite";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "About — Peter Wang",
  description: "Backend engineer at Schweitzer Engineering Laboratories.",
};

export default function AboutPage() {
  return (
    <main className="flex flex-1 flex-col">
      <article className="mx-auto w-full max-w-3xl px-6 py-16 sm:px-10 md:py-24">
        <Link
          href="/"
          className="font-utility text-xs tracking-wider text-graphite uppercase hover:text-plum"
        >
          ← Home
        </Link>

        <div className="mt-6 flex items-center gap-4">
          <CreatureSprite variant={2} size={56} />
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            About Peter
          </h1>
        </div>

        <div className="mt-10 flex flex-col gap-5 text-ink">
          <p className="max-w-[68ch] text-lg leading-relaxed">
            I&apos;m a Software Engineer II at Schweitzer Engineering
            Laboratories, where I build the backend for a factory automation
            environment: event-driven services, protocol adapters, and the
            connection resilience — reconnect logic, backoff, heartbeats —
            that keeps twelve machines and three vendor protocols talking to
            one shared event schema across six production lines at two
            sites.
          </p>
          <p className="max-w-[68ch] leading-relaxed text-graphite">
            The domain is manufacturing, but the problems I actually solve
            are distributed-systems problems: service topology, schema
            normalization across heterogeneous sources, and validation
            gating where the wrong call has a physical consequence — a board
            that advances when it shouldn&apos;t, or a line that stalls when
            it shouldn&apos;t. That last part is the thing I keep coming back
            to: most backend work fails safely into a retry or an error
            page. This work fails into hardware.
          </p>
          <p className="max-w-[68ch] leading-relaxed text-graphite">
            Outside of SEL, I build small things end to end. VGCLite started
            as a tool I wanted for my own team prep and turned into the only
            project on this site with a public URL and real users — see{" "}
            <Link href="/work/vgclite" className="text-plum underline underline-offset-2">
              the case study
            </Link>
            .
          </p>

          <h2 className="font-display mt-6 text-xl font-semibold tracking-tight text-ink">
            What I&apos;m looking for
          </h2>
          <p className="max-w-[68ch] leading-relaxed text-graphite">
            Backend or full-stack Software Engineer I/II roles with a
            distributed-systems bent — the kind of work where I&apos;m
            reasoning about event flow, service boundaries, and failure
            modes, not just CRUD over a database.
          </p>

          <div className="font-utility mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-graphite">
            <a className="transition-colors hover:text-plum" href="mailto:wang.t.peter@gmail.com">
              wang.t.peter@gmail.com
            </a>
            <a
              className="transition-colors hover:text-plum"
              href="https://github.com/peter-t-wang315"
            >
              github.com/peter-t-wang315
            </a>
            <a
              className="transition-colors hover:text-plum"
              href="https://linkedin.com/in/petertwang"
            >
              linkedin.com/in/petertwang
            </a>
          </div>
        </div>
      </article>
      <Footer />
    </main>
  );
}
