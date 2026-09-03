"use client";

import Link from "next/link";
import { useLayoutEffect, useRef } from "react";
import { useDeviceTier } from "@/lib/device-tier";
import { useClusterHitRadiusPx } from "@/lib/use-cluster-hit-radius";

interface NavLink {
  label: string;
  href: string;
  external: boolean;
}

/**
 * Clearance below the cluster's radius on mobile/tablet: covers the
 * "what's this?" label sitting right under the cluster (nebula-affordance.tsx
 * positions it at radius + 16px, roughly 20px tall) plus real breathing room,
 * so nav reads as a separate group below both rather than colliding with
 * either. One tuned constant, not a re-derivation of the label's own layout.
 */
const CLEARANCE_BELOW_CLUSTER_PX = 56;

/**
 * Desktop keeps its original `mt-16 md:mt-20` gap under the full stats
 * block — the cluster sits to the right of a left-aligned column there and
 * never competes with nav. Mobile and tablet need real clearance instead: the
 * cluster is a `position: fixed` layer glued to the viewport center
 * regardless of document flow (nebula-canvas.tsx), and nothing about nav's
 * normal flow position knows where that fixed layer's edge actually is.
 *
 * A flat Tailwind margin can't fix this correctly — tried it, and it broke
 * again at iPad width: the cluster's on-screen radius is a fixed *fraction*
 * of viewport height (see useClusterHitRadiusPx), so it's a different pixel
 * size at 390×844 than at 768×1024, and a constant margin tuned for one
 * doesn't track the other. This measures nav's actual natural position after
 * layout and applies exactly the margin needed to clear the real,
 * currently-computed cluster radius — reset-then-remeasure on every change
 * so repeated resizes don't compound a stale margin into the measurement.
 */
export function HeroNav({ links }: { links: NavLink[] }) {
  const tier = useDeviceTier();
  const radiusPx = useClusterHitRadiusPx();
  const navRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const el = navRef.current;
    if (!el) return;

    if (tier === "desktop" || radiusPx <= 0) {
      el.style.marginTop = "";
      return;
    }

    el.style.marginTop = "0px";
    const naturalTop = el.getBoundingClientRect().top;
    const targetTop =
      window.innerHeight / 2 + radiusPx + CLEARANCE_BELOW_CLUSTER_PX;
    el.style.marginTop = `${Math.max(0, targetTop - naturalTop)}px`;
  }, [tier, radiusPx]);

  return (
    <nav
      ref={navRef}
      aria-label="Primary"
      className="flex flex-wrap gap-x-6 gap-y-2 text-[0.875rem] mt-16 md:mt-20"
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
  );
}
