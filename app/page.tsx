import Link from "next/link";
import { site, heroMetrics, projectById } from "@/content";
import { PointerParallax } from "./pointer-parallax";
import { ScrollCue } from "./scroll-cue";

const navLinks = [
  { label: "Resume", href: "/resume", external: false },
  { label: "About", href: "/about", external: false },
  { label: "Work", href: "/work", external: false },
  { label: "GitHub", href: site.github, external: true },
  { label: "LinkedIn", href: site.linkedin, external: true },
  { label: "Email", href: `mailto:${site.email}`, external: false },
];

const featuredProjectIds = [
  "th-supervisor",
  "solder-driver",
  "maintenance-client",
  "cfx-dev-client",
  "vgclite",
  "timesense",
];

const featuredProjects = featuredProjectIds
  .map((id) => projectById(id))
  .filter((p) => p !== undefined);

export default function Home() {
  return (
    <>
    <section className="min-h-dvh flex flex-col px-6 pt-16 pb-8 md:px-16 md:pt-20 md:pb-10">
      <PointerParallax className="flex-1 flex flex-col justify-between">
      <div className="max-w-[66ch]">
        <p className="text-[1.25rem] font-medium">{site.name}</p>
        <p className="text-[0.875rem] text-ink-muted mt-1">{site.role}</p>

        <h1
          className="font-display lowercase mt-8 md:mt-10"
          style={{
            fontSize: "clamp(2.5rem, 7vw, 5.5rem)",
            fontWeight: 400,
            letterSpacing: "-0.04em",
            lineHeight: 1.15,
          }}
        >
          {site.positioning}
        </h1>

        <dl className="mt-20 md:mt-24 flex flex-wrap gap-10">
          {heroMetrics.map((metric) => (
            <div key={metric.label}>
              <dd
                className="font-display"
                style={{ fontSize: "2.25rem", letterSpacing: "-0.02em" }}
              >
                {metric.value}
              </dd>
              <dt className="text-[0.8125rem] text-ink-muted mt-1">
                {metric.label}
              </dt>
              {"note" in metric && metric.note ? (
                <p className="text-[0.8125rem] text-ink-faint">
                  {metric.note}
                </p>
              ) : null}
            </div>
          ))}
        </dl>

        <nav aria-label="Primary" className="mt-16 md:mt-20 flex flex-wrap gap-x-6 gap-y-2">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-mask link-underline"
              {...(link.external
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <Link
          href="/nebula"
          className="mt-24 md:mt-28 inline-block text-[0.8125rem] text-ink-faint hover:text-ink-muted"
        >
          Explore this as a graph
        </Link>
      </div>

      <ScrollCue />
      </PointerParallax>
    </section>

    <section id="selected-work" className="px-6 py-20 md:px-16">
      <PointerParallax className="max-w-[66ch]">
        <p className="text-[1.0625rem] leading-[1.6]">
          I build the software that keeps automated manufacturing lines
          talking to each other — device drivers, message-passing services,
          and the tools operators and engineers use to see what those
          services are doing. Below are a handful of the pieces of that work
          I can talk about in detail; the full list is on the work page.
        </p>

        <h2 className="text-[1.25rem] font-medium mt-16">Selected work</h2>

        <ul className="mt-6 divide-y divide-ink-faint/30">
          {featuredProjects.map((project) => (
            <li key={project.id} className="py-5">
              <Link href={`/work/${project.slug}`} className="group block">
                <p className="text-[1.0625rem] font-medium inline-block link-underline">
                  {project.title}
                </p>
                <p className="text-[0.875rem] text-ink-muted mt-1">
                  {project.oneLine}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </PointerParallax>
    </section>
    </>
  );
}
