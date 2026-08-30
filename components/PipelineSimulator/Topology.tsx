import { motion } from "motion/react";
import type { InFlightMessage, LaneId, SimState } from "./engine";
import { LANES } from "./engine";
import { positionFor, stageOf, TOPOLOGY_HEIGHT, type StageKey } from "./layout";

const STAGE_ORIGIN: Record<InFlightMessage["stage"], StageKey> = {
  "producer-queue": "producer",
  "queue-adapter": "queue",
  "adapter-normalizer": "adapter",
  "normalizer-sink": "normalizer",
  "normalizer-dlq": "normalizer",
};

function NodeButton({
  id,
  label,
  sub,
  left,
  top,
  mobile,
  active,
  onSelect,
  selected,
}: {
  id: string;
  label: string;
  sub?: string;
  left: number;
  top: number;
  mobile: boolean;
  active?: boolean;
  onSelect: (id: string) => void;
  selected: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      aria-expanded={selected}
      className={`absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-0.5 rounded-[4px] border px-3 py-2 text-center transition-colors duration-150 ${
        selected
          ? "border-plum bg-plum/20"
          : active
            ? "border-white/40 bg-white/[0.08]"
            : "border-white/15 bg-white/[0.04] hover:border-white/30"
      }`}
      style={{
        left: `${left}%`,
        top: mobile ? `${top}px` : `${top}px`,
        minWidth: mobile ? 84 : 108,
        minHeight: 44,
      }}
    >
      <span className="font-utility text-[11px] font-bold whitespace-nowrap text-white">
        {label}
      </span>
      {sub && <span className="font-utility text-[10px] text-graphite">{sub}</span>}
    </button>
  );
}

export default function Topology({
  state,
  mobile,
  reducedMotion,
  selectedNode,
  onSelectNode,
}: {
  state: SimState;
  mobile: boolean;
  reducedMotion: boolean;
  selectedNode: string | null;
  onSelectNode: (id: string) => void;
}) {
  const height = mobile ? TOPOLOGY_HEIGHT.mobile : TOPOLOGY_HEIGHT.desktop;

  const laneLines = LANES.flatMap((lane) => {
    const stages: StageKey[] = ["producer", "queue", "adapter"];
    return stages.slice(0, -1).map((stage, i) => {
      const from = positionFor(stage, lane, mobile);
      const to = positionFor(stages[i + 1], lane, mobile);
      return { key: `${lane}-${stage}`, from, to };
    });
  });
  const convergeLines = LANES.map((lane) => {
    const from = positionFor("adapter", lane, mobile);
    const to = positionFor("normalizer", "center", mobile);
    return { key: `${lane}-converge`, from, to };
  });
  const mainLine = {
    from: positionFor("normalizer", "center", mobile),
    to: positionFor("sink", "center", mobile),
  };
  const dlqLine = {
    from: positionFor("normalizer", "center", mobile),
    to: positionFor("dlq", "center", mobile),
  };

  return (
    <div className="relative w-full" style={{ height }}>
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {[...laneLines, ...convergeLines, { key: "main", ...mainLine }].map((line) => (
          <line
            key={line.key}
            x1={line.from.left}
            y1={line.from.top}
            x2={line.to.left}
            y2={line.to.top}
            stroke="rgba(255,255,255,0.15)"
            strokeWidth={0.3}
          />
        ))}
        <line
          x1={dlqLine.from.left}
          y1={dlqLine.from.top}
          x2={dlqLine.to.left}
          y2={dlqLine.to.top}
          stroke={state.dlqActive > 0 ? "var(--plum)" : "rgba(124,58,85,0.4)"}
          strokeWidth={0.3}
          strokeDasharray="1.5 1.5"
        />
      </svg>

      {LANES.map((lane) => (
        <NodeButton
          key={`producer-${lane}`}
          id={`producer-${lane}`}
          label={`Producer ${lane.toUpperCase()}`}
          left={positionFor("producer", lane, mobile).left}
          top={positionFor("producer", lane, mobile).top}
          mobile={mobile}
          onSelect={onSelectNode}
          selected={selectedNode === `producer-${lane}`}
          active={!state.lanes[lane].paused}
        />
      ))}
      {LANES.map((lane) => (
        <NodeButton
          key={`queue-${lane}`}
          id={`queue-${lane}`}
          label={`Queue ${lane.toUpperCase()}`}
          sub={`depth ${state.lanes[lane].queueDepth}`}
          left={positionFor("queue", lane, mobile).left}
          top={positionFor("queue", lane, mobile).top}
          mobile={mobile}
          onSelect={onSelectNode}
          selected={selectedNode === `queue-${lane}`}
          active={state.lanes[lane].queueDepth > 0}
        />
      ))}
      {LANES.map((lane) => (
        <NodeButton
          key={`adapter-${lane}`}
          id={`adapter-${lane}`}
          label={`Adapter ${lane.toUpperCase()}`}
          sub={!state.lanes[lane].connected ? "reconnecting…" : !state.lanes[lane].workerOnline ? "offline" : undefined}
          left={positionFor("adapter", lane, mobile).left}
          top={positionFor("adapter", lane, mobile).top}
          mobile={mobile}
          onSelect={onSelectNode}
          selected={selectedNode === `adapter-${lane}`}
          active={state.lanes[lane].connected && state.lanes[lane].workerOnline}
        />
      ))}
      <NodeButton
        id="normalizer"
        label="Normalizer"
        sub="IPC-CFX"
        left={positionFor("normalizer", "center", mobile).left}
        top={positionFor("normalizer", "center", mobile).top}
        mobile={mobile}
        onSelect={onSelectNode}
        selected={selectedNode === "normalizer"}
        active
      />
      <NodeButton
        id="sink"
        label="Sink"
        sub="Azure"
        left={positionFor("sink", "center", mobile).left}
        top={positionFor("sink", "center", mobile).top}
        mobile={mobile}
        onSelect={onSelectNode}
        selected={selectedNode === "sink"}
        active
      />
      <NodeButton
        id="dlq"
        label="Dead-letter"
        sub={state.dlqCount > 0 ? `${state.dlqCount} routed` : "empty"}
        left={positionFor("dlq", "center", mobile).left}
        top={positionFor("dlq", "center", mobile).top}
        mobile={mobile}
        onSelect={onSelectNode}
        selected={selectedNode === "dlq"}
        active={state.dlqActive > 0}
      />

      {!reducedMotion &&
        state.inFlight.map((msg) => {
          const destKey = stageOf(msg.stage);
          const originKey = STAGE_ORIGIN[msg.stage];
          const lanePos: LaneId | "poison" | "center" =
            msg.lane === "poison" ? "poison" : msg.stage === "normalizer-sink" || msg.stage === "normalizer-dlq" ? "center" : msg.lane;
          const originLane: LaneId | "poison" | "center" =
            msg.lane === "poison" ? "poison" : originKey === "normalizer" ? "center" : msg.lane;
          const dest = positionFor(destKey, lanePos, mobile);
          const origin = positionFor(originKey, originLane, mobile);
          return (
            <motion.div
              key={msg.id}
              initial={{ left: `${origin.left}%`, top: origin.top }}
              animate={{ left: `${dest.left}%`, top: dest.top }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
              className={`absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-[2px] ${
                msg.poison ? "bg-plum" : "bg-shell"
              }`}
              aria-hidden="true"
            />
          );
        })}
    </div>
  );
}
