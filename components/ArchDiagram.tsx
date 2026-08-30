type Node = { label: string; sub?: string };
type Diagram = { nodes: Node[]; branch?: { from: number; to: number; label: string } };

// Hand-authored, one schematic per project — SEL work is internal, so these
// diagrams (not screenshots) are the primary "what I built" evidence.
// See docs/04's "Correction to earlier drafts."
const DIAGRAMS: Record<string, Diagram> = {
  "solder-pipeline": {
    nodes: [
      { label: "Camera scan service", sub: "board eligibility" },
      { label: "Routing service", sub: "decides solder vs. skip" },
      { label: "Machine driver", sub: "TCP to solder line" },
    ],
    branch: { from: 2, to: 0, label: "mid-cycle abort" },
  },
  "station-supervisor": {
    nodes: [
      { label: "Station supervisor", sub: "one per line" },
      { label: "Plugin worker", sub: "config-driven" },
      { label: "Line hardware", sub: "×6 lines, 2 sites" },
    ],
  },
  "protocol-layer": {
    nodes: [
      { label: "Machines ×12+", sub: "3 vendor protocols · SMEMA" },
      { label: "Protocol adapters ×3", sub: "one per vendor" },
      { label: "IPC-CFX normalizer", sub: "one event schema" },
    ],
    branch: { from: 1, to: 0, label: "ready signal withheld" },
  },
  "maintenance-platform": {
    nodes: [
      { label: "SQL schema", sub: "4-level many-to-many" },
      { label: "REST contract", sub: "backend + DBA coordinated" },
      { label: "React client", sub: "MUI · Jotai" },
    ],
  },
  "flying-probe": {
    nodes: [
      { label: "WPF client", sub: "legacy, retired" },
      { label: "React + Redux", sub: "operator-facing" },
      { label: "C#/.NET API", sub: "flying probe tester" },
    ],
  },
  vgclite: {
    nodes: [
      { label: "PokéAPI · Smogon · Pikalytics", sub: "3 shapes, 3 cadences" },
      { label: "Normalizer", sub: "one team model" },
      { label: "Next.js + @smogon/calc", sub: "threats & damage" },
    ],
  },
  beholderwebui: {
    nodes: [
      { label: "Selective solder driver", sub: "publishes events" },
      { label: "RabbitMQ", sub: "5,000-message working set" },
      { label: "BeholderWebUI", sub: "Blazor, for operators" },
    ],
  },
};

export default function ArchDiagram({ slug }: { slug: string }) {
  const diagram = DIAGRAMS[slug];
  if (!diagram) return null;

  const boxW = 190;
  const boxH = 76;
  const gap = 56;
  const width = diagram.nodes.length * boxW + (diagram.nodes.length - 1) * gap;
  const height = diagram.branch ? 190 : 110;
  const y = diagram.branch ? 40 : 16;

  const centers = diagram.nodes.map((_, i) => i * (boxW + gap) + boxW / 2);

  return (
    <figure className="not-prose my-8 overflow-x-auto rounded-[10px] border-t border-white/35 bg-ink py-8">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        className="mx-auto block"
        role="img"
        aria-label={`Architecture diagram: ${diagram.nodes.map((n) => n.label).join(" to ")}`}
      >
        {diagram.nodes.map((node, i) =>
          i < diagram.nodes.length - 1 ? (
            <line
              key={`arrow-${i}`}
              x1={i * (boxW + gap) + boxW}
              y1={y + boxH / 2}
              x2={(i + 1) * (boxW + gap)}
              y2={y + boxH / 2}
              stroke="var(--graphite)"
              strokeWidth={1.5}
              markerEnd="url(#arrowhead)"
            />
          ) : null,
        )}

        {diagram.branch && (
          <path
            d={`M ${centers[diagram.branch.from]} ${y + boxH} C ${centers[diagram.branch.from]} ${y + boxH + 48}, ${centers[diagram.branch.to]} ${y + boxH + 48}, ${centers[diagram.branch.to]} ${y + boxH}`}
            fill="none"
            stroke="var(--plum)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            markerEnd="url(#arrowhead-plum)"
          />
        )}
        {diagram.branch && (
          <text
            x={(centers[diagram.branch.from] + centers[diagram.branch.to]) / 2}
            y={y + boxH + 44}
            textAnchor="middle"
            fontFamily="var(--font-utility)"
            fontSize={10}
            fill="var(--plum)"
          >
            {diagram.branch.label}
          </text>
        )}

        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="var(--graphite)" />
          </marker>
          <marker id="arrowhead-plum" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="var(--plum)" />
          </marker>
        </defs>

        {diagram.nodes.map((node, i) => (
          <g key={node.label} transform={`translate(${i * (boxW + gap)}, ${y})`}>
            <rect
              width={boxW}
              height={boxH}
              rx={4}
              fill="none"
              stroke="rgba(255,255,255,0.25)"
              strokeWidth={1}
            />
            <text
              x={boxW / 2}
              y={boxH / 2 - 6}
              textAnchor="middle"
              fontFamily="var(--font-utility)"
              fontWeight={700}
              fontSize={12}
              fill="#ffffff"
            >
              {node.label}
            </text>
            {node.sub && (
              <text
                x={boxW / 2}
                y={boxH / 2 + 14}
                textAnchor="middle"
                fontFamily="var(--font-utility)"
                fontSize={10}
                fill="var(--graphite)"
              >
                {node.sub}
              </text>
            )}
          </g>
        ))}
      </svg>
    </figure>
  );
}
