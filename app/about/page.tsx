import type { Metadata } from "next";
import { site, tech } from "@/content";
import { HomeLink } from "../home-link";

export const metadata: Metadata = {
  title: "About | Peter Wang",
  description: site.role,
};

const alsoFamiliarWith = [
  "Java",
  "C/C++ (coursework)",
  "SQL Server and stored procedures",
  "xUnit",
  "LaTeX",
  "Material UI",
  "Radix UI",
  "WPF",
];

export default function About() {
  return (
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
          about
        </h1>

        <div className="mt-10 flex flex-col sm:flex-row gap-8 items-start">
          {/* TODO(peter): swap for a real photo. */}
          <div className="w-32 h-32 shrink-0 bg-paper-sunk" />
          <div>
            <p className="text-[1.25rem] font-medium">{site.name}</p>
            <p className="text-[0.875rem] text-ink-muted mt-1">{site.role}</p>
          </div>
        </div>

        <div className="mt-10 space-y-5 text-[1.0625rem] leading-[1.6]">
          <p>
            I build the software that connects physical machines to the
            systems that run a factory floor — device drivers, message-passing
            services, and the tools operators and engineers use to see what
            those services are doing. Most of it comes down to the same
            problem: two things need to talk, and something has to make sure
            that conversation is reliable when a socket drops or a board
            fails a check.
          </p>
          <p>
            What I like about it is the physicality. A bug isn&apos;t abstract
            — it&apos;s a board sitting in a machine that won&apos;t move, and
            the fix has to work on hardware that can&apos;t be paused to debug.
          </p>
        </div>

        <h2 className="mt-16 text-[1.25rem] font-medium">How I work</h2>
        <div className="mt-6 space-y-5 text-[1.0625rem] leading-[1.6]">
          <p>
            I&apos;ve mentored a junior developer through their first
            production service, and I take code review seriously in both
            directions — as a way to catch problems before the floor does,
            and as the fastest way I know to bring someone new up to speed on
            a codebase.
          </p>
          <p>
            I&apos;m part of the on-call rotation for the automation services
            I&apos;ve built, which means the honest failure paths in this
            site&apos;s project write-ups aren&apos;t hypothetical — I&apos;m
            the one who gets paged if they&apos;re wrong.
          </p>
          <p>
            I use Claude Code daily, for this site and for production work.
            The place it earns its keep isn&apos;t generating code I
            couldn&apos;t write — it&apos;s collapsing the distance between
            deciding to do something and having it done: reading through an
            unfamiliar service before touching it, drafting the tedious half
            of a migration, catching the failure case I described but didn&apos;t
            handle. I still read every line before it ships.
          </p>
        </div>

        <h2 className="mt-16 text-[1.25rem] font-medium">Education</h2>
        <p className="mt-6 text-[1.0625rem] leading-[1.6]">
          Washington State University.
        </p>

        <h2 className="mt-16 text-[1.25rem] font-medium">Skills</h2>
        <p className="mt-6 text-[1.0625rem] leading-[1.6]">
          {tech.map((t) => t.label).join(", ")}.
        </p>
        <p className="mt-4 text-[0.875rem] text-ink-muted">
          Also familiar with: {alsoFamiliarWith.join(", ")}.
        </p>
      </div>
    </div>
  );
}
