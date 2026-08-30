import Link from "next/link";
import CreatureSprite from "./CreatureSprite";

export default function Hero() {
  return (
    <section className="mx-auto flex w-full max-w-[1440px] flex-col items-start gap-12 px-6 py-20 sm:px-10 md:flex-row md:items-center md:justify-between md:px-16 md:py-28">
      <div className="flex max-w-2xl flex-col gap-7">
        <p className="font-utility text-xs tracking-[0.2em] text-plum uppercase">
          Backend engineer — event-driven services and protocol integration
        </p>
        <h1 className="font-display text-4xl leading-[0.95] font-extrabold tracking-tight text-ink sm:text-5xl md:text-6xl">
          Peter Wang
        </h1>
        <p className="max-w-xl text-base leading-relaxed text-graphite md:text-lg">
          Software Engineer II at Schweitzer Engineering Laboratories. I build
          C#/.NET services that sit between factory equipment and the cloud:
          twelve machines, three vendor protocols, normalized into one event
          schema across six production lines at two sites. When one of my
          services makes a call, a physical board either advances or it
          doesn&apos;t.
        </p>
        <div className="flex flex-wrap gap-4 pt-2">
          <Link
            href="#storage"
            className="rounded-[4px] bg-plum px-6 py-3.5 text-sm font-semibold text-shell transition-transform duration-200 ease-out hover:-translate-y-0.5"
          >
            See the work
          </Link>
          <Link
            href="/resume"
            className="rounded-[4px] border-t border-white/35 bg-shell-deep px-6 py-3.5 text-sm font-semibold text-ink transition-transform duration-200 ease-out hover:-translate-y-0.5"
          >
            See the resume
          </Link>
        </div>
      </div>

      <div className="relative flex w-full max-w-[280px] shrink-0 flex-col items-center gap-3 self-center rounded-[10px] border-t border-white/35 bg-shell-deep p-8">
        <span
          aria-hidden="true"
          className="absolute top-3 left-3 h-1.5 w-1.5 rounded-full bg-ink/20"
        />
        <div className="flex h-32 w-32 items-center justify-center rounded-[4px] bg-ink/[0.03]">
          <CreatureSprite variant={3} size={96} />
        </div>
        <p className="font-utility text-[10px] tracking-wider text-graphite uppercase">
          Protocol adapter, in the roster
        </p>
      </div>
    </section>
  );
}
