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
      onMouseLeave={() => setPreviewNodeId(null)}
      onBlur={() => setPreviewNodeId(null)}
    >
      {children}
    </Link>
  );
}
