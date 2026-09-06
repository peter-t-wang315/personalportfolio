"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useSceneStore } from "@/lib/scene-store";
import { wasHydratedBefore } from "@/lib/hydration";
import { hasWebgl } from "@/lib/webgl";

/**
 * The interior panel: real HTML, sized from 02-architecture.md's tier table,
 * centred, scrollable inside, with the graph still live past its edges.
 *
 * **Sizing is CSS, not a tier hook.** 70% of the viewport on desktop, 85%
 * below (`lg:` is 1024px, the same line useDeviceTier draws), and under 500px
 * of viewport height a full-height sheet with no morph in any tier. Media
 * queries are correct in the very first painted frame, which a JS tier switch
 * is not — the same reason hero-stats.tsx gives for its own layout.
 *
 * **Two entry paths, per 05-phase-2.md's Deep linking.** On a cold entry —
 * a direct link or a reload — the content must be visible at first paint, so
 * the server renders it at full opacity and nothing waits for anything. On a
 * navigation within the graph the panel mounts while the approach flight is
 * still in the air and fades in once the camera has landed, gating on the
 * `focusSettled` the rig publishes rather than on a timer of its own.
 *
 * Telling the two apart needs no store and no prop: a panel that mounts
 * during hydration *is* the cold entry, because a client navigation renders
 * after hydration by definition. lib/hydration.ts answers that, and is false
 * for exactly that first render on the server and the client alike, so the
 * two agree and there is no hydration mismatch to suppress.
 */

export function NebulaPanel({
  nodeId,
  documentHref,
  children,
}: {
  nodeId: string;
  documentHref: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [cold] = useState(() => !wasHydratedBefore());
  const focusSettled = useSceneStore((s) => s.focusSettled);
  const focusedNodeId = useSceneStore((s) => s.focusedNodeId);

  // A graph the visitor cannot move through has no advantage over the
  // document, and the cold-entry state has nothing to animate out of on exit
  // if it could not animate in. Read from matchMedia directly rather than the
  // store: this must decide before the store has necessarily been synced.
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !hasWebgl()) router.replace(documentHref);
  }, [router, documentHref]);

  // Visible when: cold entry (always), or the flight to *this* node has
  // landed. The second check matters for sideways navigation — the old panel
  // is already unmounted, but focusSettled is still true from the previous
  // landing for one commit before the rig resets it.
  const visible = cold || (focusSettled && focusedNodeId === nodeId);

  return (
    <div className="pointer-events-none fixed inset-0 grid place-items-center">
      <motion.article
        data-nebula-panel
        aria-live="polite"
        initial={cold ? false : { opacity: 0 }}
        animate={{ opacity: visible ? 1 : 0 }}
        transition={{ duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
        className={
          "pointer-events-auto overflow-y-auto overscroll-contain " +
          "w-[85vw] h-[85vh] lg:w-[70vw] lg:h-[70vh] " +
          "rounded-[2.5rem] px-8 py-10 md:px-14 md:py-14 " +
          "bg-paper/85 " +
          "[@media(max-height:500px)]:w-screen [@media(max-height:500px)]:h-screen " +
          "[@media(max-height:500px)]:rounded-none [@media(max-height:500px)]:pt-20"
        }
      >
        <div className="max-w-[66ch] mx-auto pb-6">{children}</div>
      </motion.article>
    </div>
  );
}
