import { heroMetrics, heroMetricsCompact } from "@/content";

/**
 * Desktop keeps the full value/label/note stack. Mobile and tablet get
 * `heroMetricsCompact` (content/index.ts) as one row with a tight top margin,
 * so the stats sit close under the cluster rather than trailing far below the
 * headline as their own competing section — per 04-phase-1.md's landing-page
 * redesign. That row is its own phrasing rather than a truncation of the three
 * metrics; the content file explains why.
 *
 * Both variants render unconditionally and Tailwind's `lg:` breakpoint
 * (1024px, matching useDeviceTier's own desktop threshold) picks which is
 * visible. Deliberately *not* branched on useDeviceTier(): that hook returns
 * "desktop" for its SSR/first-paint snapshot to avoid a hydration mismatch,
 * so a JS branch here renders the full desktop block on every mobile load
 * until the client-side media query corrects it. With the three.js bundle
 * also loading, that window is long enough to see as a real collision with
 * the fixed-position cluster, not a one-frame flicker. A CSS media query has
 * no such window — it is correct in the very first painted frame.
 */
export function HeroStats() {
  return (
    <>
      <dl className="hidden lg:flex mt-24 short-desktop:mt-12 flex-wrap gap-10 short-desktop:gap-x-10 short-desktop:gap-y-6">
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
              <p className="text-[0.8125rem] text-ink-faint">{metric.note}</p>
            ) : null}
          </div>
        ))}
      </dl>

      {/*
        Comma-separated, and the comma travels inside its own span so it can
        never be orphaned onto the next line when the row wraps. The gap is a
        word space rather than the wider column gutter the values used to need,
        because with punctuation doing the separating this reads as one
        sentence rather than three tiles.
      */}
      <div
        aria-label="Key metrics"
        className="flex lg:hidden mt-8 flex-wrap gap-x-2 gap-y-1"
      >
        {heroMetricsCompact.map((entry, i) => (
          <span
            key={entry}
            className="font-display text-[0.9375rem]"
            style={{ letterSpacing: "-0.02em" }}
          >
            {i < heroMetricsCompact.length - 1 ? `${entry},` : entry}
          </span>
        ))}
      </div>
    </>
  );
}
