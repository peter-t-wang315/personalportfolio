import type { Metadata } from "next";
import Link from "next/link";
import fs from "node:fs";
import path from "node:path";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Resume — Peter Wang",
  description: "Backend engineer resume, inline and as PDF.",
};

const RESUME_BULLETS = [
  "Built an adapter layer normalizing SMEMA handshakes and three vendor protocols across 12+ machines into a single IPC-CFX event schema — new vendor integrations became an adapter implementation, not a bespoke service.",
  "Designed TCP reconnect with exponential backoff and heartbeat-based connection detection for machine-facing services.",
  "Built board-eligibility validation that withholds the SMEMA ready signal, holding a board in place rather than letting it advance incorrectly.",
  "Built a three-service event pipeline (camera scan, routing, machine driver) coordinating a selective solder line over RabbitMQ and TCP.",
  "Built a three-tier station supervisor / plugin worker topology, containerized and deployed across six production lines at two sites — became the team's deployment standard.",
  "Designed a relational schema (four-level many-to-many hierarchy) and REST contract for a preventive maintenance platform, coordinated across frontend, backend, and DBA teams; shipped the React client. In use across two sites, covering roughly 30% of manufacturing.",
  "Migrated an operator-facing flying probe tester dashboard from WPF to React and Redux, in production on the factory floor.",
  "Built BeholderWebUI (Blazor), an internal RabbitMQ monitoring tool for a 5,000-message working set, while mentoring a junior developer.",
];

export default function ResumePage() {
  const pdfPath = path.join(process.cwd(), "public", "peter-wang-resume.pdf");
  const hasPdf = fs.existsSync(pdfPath);

  return (
    <main className="flex flex-1 flex-col">
      <article className="mx-auto w-full max-w-3xl px-6 py-16 sm:px-10 md:py-24">
        <Link
          href="/"
          className="font-utility text-xs tracking-wider text-graphite uppercase hover:text-plum"
        >
          ← Home
        </Link>

        <div className="mt-6 flex flex-wrap items-baseline justify-between gap-4">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            Peter Wang
          </h1>
          {hasPdf ? (
            <a
              href="/peter-wang-resume.pdf"
              className="rounded-[4px] bg-plum px-5 py-2.5 text-sm font-semibold text-shell"
            >
              Download PDF
            </a>
          ) : (
            <span className="font-utility rounded-[4px] border-t border-white/35 bg-shell-deep px-5 py-2.5 text-sm text-plum">
              [NEEDS PETER: resume PDF at /peter-wang-resume.pdf]
            </span>
          )}
        </div>
        <p className="mt-2 text-graphite">
          Backend engineer — event-driven services and protocol integration
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

        <section className="mt-12">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-shell-deep pb-2">
            <h2 className="font-display text-lg font-semibold text-ink">
              Software Engineer II
            </h2>
            <p className="font-utility text-xs tracking-wider text-graphite uppercase">
              Schweitzer Engineering Laboratories
            </p>
          </div>
          <p className="font-utility mt-2 text-xs text-plum">
            [NEEDS PETER: start date] — Present
          </p>
          <ul className="mt-4 ml-5 list-disc space-y-2 text-ink">
            {RESUME_BULLETS.map((bullet) => (
              <li key={bullet} className="leading-relaxed">
                {bullet}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-shell-deep pb-2">
            <h2 className="font-display text-lg font-semibold text-ink">
              VGCLite — independent
            </h2>
            <p className="font-utility text-xs tracking-wider text-graphite uppercase">
              vgclite.com
            </p>
          </div>
          <ul className="mt-4 ml-5 list-disc space-y-2 text-ink">
            <li className="leading-relaxed">
              Built a competitive team-analysis tool end to end with Claude
              Code — normalizes PokéAPI, Smogon, and Pikalytics into one
              model, with threat analysis and an opponent quick-reference
              powered by the <code>@smogon/calc</code> damage engine. Live,
              with real users.
            </li>
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="font-display border-b border-shell-deep pb-2 text-lg font-semibold text-ink">
            Education
          </h2>
          <p className="font-utility mt-4 text-sm text-plum">
            [NEEDS PETER: education]
          </p>
        </section>

        <section className="mt-12">
          <h2 className="font-display border-b border-shell-deep pb-2 text-lg font-semibold text-ink">
            Skills
          </h2>
          <dl className="font-utility mt-4 space-y-3 text-sm">
            <div>
              <dt className="inline text-graphite">Languages — </dt>
              <dd className="inline text-ink">
                C# · TypeScript · JavaScript · SQL · C/C++ (coursework)
              </dd>
            </div>
            <div>
              <dt className="inline text-graphite">Messaging — </dt>
              <dd className="inline text-ink">
                RabbitMQ · TCP sockets · REST · IPC-CFX · SMEMA
              </dd>
            </div>
            <div>
              <dt className="inline text-graphite">Infrastructure — </dt>
              <dd className="inline text-ink">
                Docker · Kubernetes · Helm · Jenkins · Azure · Vercel
              </dd>
            </div>
            <div>
              <dt className="inline text-graphite">Frontend — </dt>
              <dd className="inline text-ink">
                React · Next.js · Redux · Jotai · Tailwind · MUI · Blazor
              </dd>
            </div>
            <div>
              <dt className="inline text-graphite">Observability — </dt>
              <dd className="inline text-ink">Splunk · Azure Monitor</dd>
            </div>
            <div>
              <dt className="inline text-graphite">Testing — </dt>
              <dd className="inline text-ink">xUnit</dd>
            </div>
          </dl>
        </section>
      </article>
      <Footer />
    </main>
  );
}
