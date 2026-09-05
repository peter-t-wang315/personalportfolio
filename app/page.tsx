import Link from "next/link";
import { site, projectById } from "@/content";
import { HeroNav } from "./hero-nav";
import { HeroStats } from "./hero-stats";
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
    <section className="min-h-dvh flex flex-col px-6 pt-16 pb-8 md:px-16 md:pt-20 md:pb-10 short-desktop:pt-12">
      <PointerParallax className="flex-1 flex flex-col justify-between">
      {/*
        A flex column that absorbs the hero's spare height at every size, so
        HeroNav's link row can sit at the bottom of the view (`mt-auto`) rather
        than trailing whatever happens to precede it. Desktop used to keep a
        plain block flow here, which left the links stranded mid-page on a tall
        screen while empty hero ran on below them.
      */}
      <div className="max-w-[66ch] flex flex-col grow">
        <p className="text-[1.25rem] font-medium">{site.name}</p>
        <p className="text-[0.875rem] text-ink-muted mt-1">{site.role}</p>

        {/*
          The display size is bounded by viewport *height* as well as width.
          A width-only clamp ignores that this headline lives in a full-height
          hero beside the cluster: on a short wide screen it stayed at its
          88px ceiling, ran to three 700px lines, and covered the graph. The
          height term only binds when a viewport is wide relative to its
          height, so phones (width-bound, at the 2.5rem floor) and tall
          monitors (already at the 5.5rem ceiling) render exactly as before.
        */}
        <h1
          className="font-display lowercase mt-8 md:mt-10 short-desktop:mt-6"
          style={{
            fontSize: "clamp(2.5rem, min(7vw, 9vh), 5.5rem)",
            fontWeight: 400,
            letterSpacing: "-0.04em",
            lineHeight: 1.15,
          }}
        >
          {site.positioning}
        </h1>

        <HeroStats />

        <HeroNav links={navLinks} />
      </div>

      <ScrollCue />
      </PointerParallax>
    </section>

    <section id="selected-work" className="px-6 py-20 md:px-16">
      <PointerParallax className="max-w-[66ch]">
        <p className="text-[1.0625rem] leading-[1.6]">
          I build the software that keeps automated manufacturing lines
          talking to each other: device drivers, message-passing services,
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
