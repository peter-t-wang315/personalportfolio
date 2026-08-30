import type { LaneId, Stage } from "./engine";

export type StageKey = "producer" | "queue" | "adapter" | "normalizer" | "sink" | "dlq";

export const STAGE_ORDER: StageKey[] = ["producer", "queue", "adapter", "normalizer", "sink"];

export function stageOf(stage: Stage): StageKey {
  switch (stage) {
    case "producer-queue":
      return "queue";
    case "queue-adapter":
      return "adapter";
    case "adapter-normalizer":
      return "normalizer";
    case "normalizer-sink":
      return "sink";
    case "normalizer-dlq":
      return "dlq";
  }
}

const LANE_INDEX: Record<LaneId, number> = { a: 0, b: 1, c: 2 };

// Desktop: x = pipeline stage, y = lane. Mobile: x = lane, y = pipeline stage.
const DESKTOP_COL: Record<StageKey, number> = {
  producer: 6,
  queue: 28,
  adapter: 50,
  normalizer: 72,
  sink: 92,
  dlq: 72,
};
const DESKTOP_ROW_Y = [40, 140, 240]; // px, 3 lanes
const DESKTOP_CENTER_Y = 140;
const DESKTOP_DLQ_Y = 320;

const MOBILE_ROW_Y: Record<StageKey, number> = {
  producer: 30,
  queue: 130,
  adapter: 230,
  normalizer: 330,
  sink: 430,
  dlq: 530,
};
const MOBILE_LANE_X = [22, 50, 78]; // %, 3 lanes

export function positionFor(
  stage: StageKey,
  lane: LaneId | "poison" | "center",
  mobile: boolean,
): { left: number; top: number } {
  if (mobile) {
    const left = lane === "center" || lane === "poison" ? 50 : MOBILE_LANE_X[LANE_INDEX[lane]];
    return { left, top: MOBILE_ROW_Y[stage] };
  }
  const left = DESKTOP_COL[stage];
  if (lane === "center" || lane === "poison") {
    return { left, top: stage === "dlq" ? DESKTOP_DLQ_Y : DESKTOP_CENTER_Y };
  }
  return { left, top: DESKTOP_ROW_Y[LANE_INDEX[lane]] };
}

export const TOPOLOGY_HEIGHT = { desktop: 340, mobile: 580 };
