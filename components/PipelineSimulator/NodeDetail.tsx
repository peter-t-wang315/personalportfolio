import Link from "next/link";
import { NODE_INFO } from "./nodeInfo";

export default function NodeDetail({
  nodeId,
  onClose,
}: {
  nodeId: string | null;
  onClose: () => void;
}) {
  if (!nodeId) return null;
  const info = NODE_INFO[nodeId];
  if (!info) return null;

  return (
    <div
      role="region"
      aria-label={`Details for ${info.name}`}
      className="font-utility mt-4 rounded-[4px] border-t border-white/15 bg-white/[0.04] p-5 text-sm text-shell"
    >
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-base font-bold text-white">{info.name}</h3>
        <button
          type="button"
          onClick={onClose}
          className="text-graphite hover:text-white"
          aria-label="Close node details"
        >
          ✕
        </button>
      </div>
      <p className="mt-3 leading-relaxed text-shell/90">{info.what}</p>
      <p className="mt-2 text-graphite">
        <span className="text-white/70">Contract — </span>
        {info.contract}
      </p>
      <p className="mt-2 leading-relaxed text-shell/90">
        <span className="text-white/70">What I built — </span>
        {info.builtHere}
      </p>
      <Link
        href="/work/protocol-layer"
        className="mt-3 inline-block text-plum underline underline-offset-2"
      >
        Read the case study →
      </Link>
    </div>
  );
}
