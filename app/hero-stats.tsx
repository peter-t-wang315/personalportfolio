import { heroMetrics } from "@/content";

/**
 * Desktop keeps the full value/label/note stack. Mobile and tablet collapse
 * each metric to its `short` form (content/index.ts) into one compact row
 * with a tight top margin, so the stats sit close under the cluster rather
 * than trailing far below the headline as their own competing section — per
 * 04-phase-1.md's landing-page redesign.
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
      <dl className="hidden lg:flex mt-24 flex-wrap gap-10">
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

      <div
        aria-label="Key metrics"
        className="flex lg:hidden mt-8 flex-wrap gap-x-5 gap-y-1"
      >
        {heroMetrics.map((metric) => (
          <span
            key={metric.label}
            className="font-display text-[0.9375rem]"
            style={{ letterSpacing: "-0.02em" }}
          >
            {metric.short}
          </span>
        ))}
      </div>
    </>
  );
}
