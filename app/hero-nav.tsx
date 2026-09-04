"use client";

import Link from "next/link";
import { useLayoutEffect, useRef } from "react";
import { useClusterScreen } from "@/lib/use-cluster-screen";

interface NavLink {
  label: string;
  href: string;
  external: boolean;
}

/**
 * Clearance below the cluster's edge on mobile/tablet — enough for the
 * "what's this?" label that spawns around it (nebula-affordance.tsx, up to
 * ~26px past the edge plus a line of text) with real breathing room after,
 * so nav reads as its own group rather than crowding either.
 */
const CLEARANCE_BELOW_CLUSTER_PX = 64;
const DESKTOP_QUERY = "(min-width: 1024px)";

/**
 * Two `<nav>`s, with Tailwind's `lg:` breakpoint (1024px, matching
 * useDeviceTier's desktop threshold) picking which is visible in CSS. The
 * mobile/tablet one drops Email, which was wrapping onto a second line in
 * the compact row — it stays reachable on /resume, and via the full nav at
 * desktop width.
 *
 * Deliberately not one `<nav>` branching on useDeviceTier(): that hook
 * reports "desktop" for its SSR/first-paint snapshot, so a JS branch shows
 * the desktop nav — with its small, uncleared margin — on every mobile load
 * until hydration corrects it, which is exactly when it collides with the
 * fixed-position cluster. Same reasoning as hero-stats.tsx.
 *
 * The one thing that genuinely can't be CSS is the mobile margin: the
 * cluster is a `position: fixed` layer whose on-screen size derives from
 * viewport height and its own scale factor, and nothing about nav's normal
 * flow position knows where that layer's edge is. A flat Tailwind margin was
 * tried and broke at iPad width for exactly that reason. So this measures
 * nav's natural position after layout and applies the difference. It reads
 * `window.matchMedia` directly rather than a tier value, because a layout
 * effect only ever runs client-side, where matchMedia is already accurate —
 * no hydration window to be wrong in.
 */
export function HeroNav({ links }: { links: NavLink[] }) {
  const compactLinks = links.filter((link) => link.label !== "Email");
  const cluster = useClusterScreen();
  const navRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const el = navRef.current;
    if (!el) return;

    function recompute() {
      if (!el) return;
      if (window.matchMedia(DESKTOP_QUERY).matches || !cluster.ready) {
        el.style.marginTop = "";
        return;
      }
      el.style.marginTop = "0px";
      const naturalTop = el.getBoundingClientRect().top;
      const targetTop =
        cluster.centerY + cluster.radiusPx + CLEARANCE_BELOW_CLUSTER_PX;
      el.style.marginTop = `${Math.max(0, targetTop - naturalTop)}px`;
    }

    recompute();
    // The cluster's size tracks viewport *height*, so a width-only resize
    // across the breakpoint wouldn't otherwise recompute, leaving a stale
    // margin on a nav that just became visible.
    const query = window.matchMedia(DESKTOP_QUERY);
    query.addEventListener("change", recompute);
    return () => query.removeEventListener("change", recompute);
  }, [cluster.ready, cluster.centerY, cluster.radiusPx]);

  return (
    <>
      <nav
        aria-label="Primary"
        className="hidden lg:flex flex-wrap gap-x-6 gap-y-2 text-[0.875rem] mt-16 md:mt-20"
      >
        {links.map((link) => (
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

      <nav
        ref={navRef}
        aria-label="Primary"
        className="flex lg:hidden flex-wrap gap-x-6 gap-y-2 text-[0.875rem]"
      >
        {compactLinks.map((link) => (
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
    </>
  );
}
