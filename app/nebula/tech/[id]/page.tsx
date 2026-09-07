import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { tech, techById } from "@/content";
import { NebulaPanel } from "../../../nebula-panel";
import { TechArticle } from "../../../tech-article";

export function generateStaticParams() {
  return tech.map((t) => ({ id: t.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const node = techById(id);
  if (!node) return {};

  return {
    title: `${node.label} | Peter Wang`,
    description: node.blurb,
  };
}

/**
 * A technology read from inside its node. No `/work` counterpart exists, so
 * unlike a project this is not a second rendering of anything and carries no
 * canonical tag. Without WebGL it falls back to /work, the nearest document.
 */
export default async function NebulaTech({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const node = techById(id);
  if (!node) notFound();

  return (
    <NebulaPanel nodeId={node.id} documentHref="/work">
      <TechArticle tech={node} />
    </NebulaPanel>
  );
}
