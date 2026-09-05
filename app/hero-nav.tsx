import Link from "next/link";

interface NavLink {
  label: string;
  href: string;
  external: boolean;
}

/**
 * Two `<nav>`s, with Tailwind's `lg:` breakpoint (1024px, matching
 * useDeviceTier's desktop threshold) picking which is visible in CSS. The
 * mobile/tablet one drops Email, which was wrapping onto a second line in
 * the compact row — it stays reachable on /resume, and via the full nav at
 * desktop width.
 *
 * Deliberately not one `<nav>` branching on useDeviceTier(): that hook
 * reports "desktop" for its SSR/first-paint snapshot, so a JS branch shows
 * the desktop nav on every mobile load until hydration corrects it. Same
 * reasoning as hero-stats.tsx.
 *
 * The compact row sits at the **bottom of the hero view**, not below the
 * cluster. `mt-auto` claims whatever height the hero has left over (page.tsx
 * makes the hero's text column a growing flex column below `lg`), with
 * `pt-10` as a floor so it can't end up flush against the stats in the narrow
 * band of viewport heights where there is only a few pixels spare.
 *
 * That floor is dropped under 500px of viewport height — the short-viewport
 * threshold 02-architecture.md already draws, and landscape phones are its
 * named case. There the hero has no spare height at all, so the floor is 40px
 * of pure overflow: at 844x390 it pushed the row's baseline to 426 against a
 * 390px viewport, where without it the row lands at 386 and the whole hero
 * fits. Height, not width, is the trigger, exactly as in that table.
 *
 * The row used to measure the cluster's on-screen edge and push itself past
 * it with a computed margin. That read as an appendage to the graph rather
 * than as the page's own footer, and it was also the source of the mobile
 * infinite-scroll bug: the measurement compared a viewport-relative rect
 * against a viewport-relative target and applied the difference as a
 * document-flow margin, so every recompute at a non-zero scroll offset grew
 * the page by the distance already scrolled. Anchoring to the bottom of the
 * flex column needs no measurement at all, so there is nothing left to feed
 * back into layout.
 */
export function HeroNav({ links }: { links: NavLink[] }) {
  const compactLinks = links.filter((link) => link.label !== "Email");

  return (
    <>
      <nav
        aria-label="Primary"
        className="hidden lg:flex flex-wrap gap-x-6 gap-y-2 text-[0.875rem] mt-16 md:mt-20 short-desktop:mt-10"
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
        aria-label="Primary"
        className="flex lg:hidden flex-wrap gap-x-6 gap-y-2 text-[0.875rem] mt-auto pt-10 [@media(max-height:500px)]:pt-0"
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
