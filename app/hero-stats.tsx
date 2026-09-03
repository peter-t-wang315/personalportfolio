"use client";

import { heroMetrics } from "@/content";
import { useDeviceTier } from "@/lib/device-tier";

/**
 * Desktop keeps the full value/label/note stack. Mobile and tablet collapse
 * each metric to its `short` form (content/index.ts) in one compact row with
 * a tight top margin, so the stats sit close under the cluster instead of
 * trailing far below the headline as their own separate section — per
 * 04-phase-1.md's landing-page redesign, the cluster and the three numbers
 * are meant to read as one visual group on small screens, not two competing
 * ones.
 */
export function HeroStats() {
  const tier = useDeviceTier();

  if (tier === "desktop") {
    return (
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
              <p className="text-[0.8125rem] text-ink-faint">{metric.note}</p>
            ) : null}
          </div>
        ))}
      </dl>
    );
  }

  return (
    <div
      aria-label="Key metrics"
      className="mt-6 flex flex-wrap gap-x-5 gap-y-1"
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
  );
}
