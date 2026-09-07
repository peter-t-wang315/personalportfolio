"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useSceneStore } from "@/lib/scene-store";

/**
 * A row in the `/work` list, which turns the globe toward its project while
 * the reader is pointing at it.
 *
 * The list and the graph are describing the same thing from two directions,
 * and this is what connects them: hovering a title starts the same rotation
 * the project's own page will finish, so the list previews where each entry
 * sits and the turn is already half-made on arrival.
 *
 * Focus counts as well as hover — a keyboard reader tabbing the list gets the
 * same preview, which is the only way the graph means anything to them at all.
 *
 * **Nothing is cleared on the way out**, and that is the whole difference
 * between this reading as a turn and reading as a jitter. Clearing on
 * mouse-leave aimed the globe back at the layout's own orientation in the gap
 * between one row and the next, so scanning a list made it lurch toward
 * neutral and then reverse for every row crossed. Holding the last previewed
 * node means moving down the list is one continuous re-aim. The route takes
 * over on arrival, and leaving the list drops it (nebula-canvas.tsx).
 *
 * Only the id is published, never the whole project: the scene already has
 * every node's geometry and needs nothing else to aim at one.
 */
export function WorkListLink({
  nodeId,
  href,
  children,
}: {
  nodeId: string;
  href: string;
  children: ReactNode;
}) {
  const setPreviewNodeId = useSceneStore((s) => s.setPreviewNodeId);

  return (
    <Link
      href={href}
      className="group block"
      onMouseEnter={() => setPreviewNodeId(nodeId)}
      onFocus={() => setPreviewNodeId(nodeId)}
    >
      {children}
    </Link>
  );
}
