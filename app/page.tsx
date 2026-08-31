import { site, heroMetrics } from "@/content";

export default function Home() {
  return (
    <main className="min-h-screen px-6 py-24 md:px-16">
      <div className="max-w-[66ch]">
        <p className="text-[0.875rem] text-ink-muted">{site.role}</p>

        <h1
          className="font-display lowercase mt-4"
          style={{
            fontSize: "clamp(2.5rem, 7vw, 5.5rem)",
            fontWeight: 400,
            letterSpacing: "-0.04em",
            lineHeight: 1.15,
          }}
        >
          {site.positioning}
        </h1>

        <dl className="mt-16 flex flex-wrap gap-10">
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
      </div>
    </main>
  );
}
