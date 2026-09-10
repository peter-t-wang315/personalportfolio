import type { Metadata } from "next";
import Image from "next/image";
import { resumeEducation, site, tech } from "@/content";
import { HomeLink } from "../home-link";

export const metadata: Metadata = {
  title: "About | Peter Wang",
  description: site.role,
};

/**
 * The order the skills are read in.
 *
 * **Ids, not labels, and deliberately.** `content/tech.ts` is the graph's
 * source and its array order is load-bearing — `content/layout.ts` maps each
 * index onto a point of a Fibonacci sphere, so reordering that file moves
 * every technology node in the constellation. This page wants a different
 * order (REST APIs sits with the messaging group here, and after RabbitMQ
 * rather than after TCP). Holding the order here and looking the labels up
 * keeps both true without a second copy of the names to drift.
 */
const skillOrder = [
  "csharp", "typescript", "python", "rust", "sql",
  "react", "nextjs", "redux", "jotai", "blazor", "tailwind",
  "mui", "mudblazor", "tanstack-query", "react-router", "threejs",
  "rabbitmq", "rest", "mqtt", "ipc-cfx", "smema", "tcp",
  "docker", "kubernetes", "helm", "jenkins",
  "lambda", "dynamodb", "azure", "splunk", "django",
];

/**
 * Every id resolved, in that order.
 *
 * Two ways this could rot silently, and neither does. A **renamed** id would
 * resolve to nothing and shorten the list, so it falls back to printing the id
 * — a raw `ipc-cfx` on the page is ugly and obvious, which is what you want
 * from a rename that got half done. A technology **added** to the graph would
 * simply never appear here, so anything `skillOrder` does not name is appended
 * rather than dropped. The list on this page is therefore always the whole
 * graph, in the order below as far as the order goes.
 */
const skills = skillOrder.map(
  (id) => tech.find((t) => t.id === id)?.label ?? id,
);

const unlisted = tech
  .filter((t) => !skillOrder.includes(t.id))
  .map((t) => t.label);

const alsoFamiliarWith = [
  "Java",
  "C/C++ (coursework)",
  "SQL Server and stored procedures",
  "xUnit",
  "LaTeX",
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

        <div className="mt-10 md:mt-14 flex flex-col sm:flex-row gap-8 items-start">
          <Image
            src="/Peter_Picture.JPG"
            alt={site.name}
            width={128}
            height={128}
            priority
            className="w-32 h-32 shrink-0 rounded-full object-cover bg-paper-sunk"
          />
          <div>
            <p className="text-[1.25rem] font-medium">{site.name}</p>
            <p className="text-[0.875rem] text-ink-muted mt-1">{site.role}</p>
          </div>
        </div>

        <div className="mt-10 space-y-5 text-[1.0625rem] leading-[1.6]">
          <p>
            I build the software that runs a factory floor: device drivers and
            message-passing services that connect physical machines to the
            systems around them, and the tools operators and engineers use to
            see what&apos;s happening and plan around it. Some of it is about
            two things talking reliably when a connection drops or a check
            fails. Some of it is turning scattered machine data into something
            a person can actually act on, like knowing what maintenance is due
            before something breaks.
          </p>
          <p>
            What I like about the work is that failure is never abstract. A
            dropped connection or an unhandled edge case has a concrete,
            visible consequence, and the fix has to actually hold up under
            real conditions.
          </p>
        </div>

        <h2 className="mt-16 text-[1.25rem] font-medium">How I work</h2>
        <div className="mt-6 space-y-5 text-[1.0625rem] leading-[1.6]">
          <p>
            I&apos;ve mentored three junior developers, one through their
            first production service and two others currently, through code
            review and hands-on time on the floor testing what we&apos;re
            building. It&apos;s one of the better ways I know to catch
            problems early and get someone new up to speed on a codebase.
          </p>
          <p>
            I&apos;m part of the on-call rotation for the automation services
            I&apos;ve built, which means the honest failure paths in this
            site&apos;s project write-ups aren&apos;t hypothetical. I&apos;m
            the one who gets paged if they&apos;re wrong.
          </p>
          <p>
            I&apos;ve been using Claude Code for personal projects, including
            this site. I don&apos;t use it to skip understanding something. I
            use it to get through the parts that are mechanical once I already
            know what needs to happen: reading through an unfamiliar service
            before I touch it, drafting the tedious half of a migration,
            catching a failure case I described but hadn&apos;t handled yet. I
            still read every line before it ships, and I&apos;d rather spend
            the time it saves on the part that actually needs a person.
          </p>
        </div>

        <h2 className="mt-16 text-[1.25rem] font-medium">Education</h2>
        <p className="mt-6 text-[1.0625rem] leading-[1.6]">
          {/* School and GPA come off the resume record so the two pages cannot
              disagree; the degree is spelled shorter here than the resume's
              formal line, which is the difference between a credential and a
              sentence someone reads. */}
          {resumeEducation.school} — B.S. Software Engineering, Mathematics
          minor, GPA {resumeEducation.gpa}.
        </p>

        <h2 className="mt-16 text-[1.25rem] font-medium">Skills</h2>
        <p className="mt-6 text-[1.0625rem] leading-[1.6]">
          {[...skills, ...unlisted].join(", ")}.
        </p>
        <p className="mt-4 text-[0.875rem] text-ink-muted">
          Also familiar with: {alsoFamiliarWith.join(", ")}.
        </p>
      </div>
    </div>
  );
}
