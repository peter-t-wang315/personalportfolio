import Link from "next/link";
import CreatureSprite from "./CreatureSprite";

export default function AboutStrip() {
  return (
    <section className="mx-auto w-full max-w-[1440px] px-6 py-20 sm:px-10 md:px-16">
      <div className="flex flex-col gap-10 rounded-[10px] border-t border-white/35 bg-shell-deep p-8 sm:flex-row sm:items-center md:p-12">
        <div className="flex shrink-0 flex-col items-center gap-3 rounded-[4px] bg-ink/[0.03] p-6">
          <CreatureSprite variant={2} size={72} />
          <p className="font-utility text-[10px] tracking-wider text-graphite uppercase">
            ID plate
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <p className="max-w-2xl text-base leading-relaxed text-ink md:text-lg">
            Peter Wang is a backend engineer working at the intersection of
            distributed systems and physical hardware. He&apos;s a Software
            Engineer II at Schweitzer Engineering Laboratories, building the
            services that keep twelve machines talking to one schema. Outside
            of work he ships small products end to end, like VGCLite.
          </p>
          <div className="font-utility flex flex-wrap gap-x-6 gap-y-2 text-sm text-graphite">
            <a
              className="transition-colors hover:text-plum"
              href="mailto:wang.t.peter@gmail.com"
            >
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
          <Link
            href="/about"
            className="text-sm font-semibold text-plum transition-colors hover:text-ink"
          >
            More about Peter →
          </Link>
        </div>
      </div>
    </section>
  );
}
