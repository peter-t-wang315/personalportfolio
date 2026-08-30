// Pure simulation state machine for the pipeline simulator. No DOM, no
// timers — the component drives this by calling `advance()` on a heartbeat.
// See docs/05-pipeline-simulator.md for the spec this models.

export type LaneId = "a" | "b" | "c";
export const LANES: LaneId[] = ["a", "b", "c"];

export const LANE_PROTOCOL: Record<LaneId, string> = {
  a: "SMEMA handshake",
  b: "Vendor protocol B",
  c: "Vendor protocol C",
};

// Fixed assignment so each failure mode demonstrates isolation independently
// of the others — all three can be live at once.
export const PARTITION_LANE: LaneId = "a";
export const CONSUMER_OFFLINE_LANE: LaneId = "b";
export const VALIDATION_HOLD_LANE: LaneId = "c";

export type Stage =
  | "producer-queue"
  | "queue-adapter"
  | "adapter-normalizer"
  | "normalizer-sink"
  | "normalizer-dlq";

export type InFlightMessage = {
  id: string;
  lane: LaneId | "poison";
  stage: Stage;
  seq: number;
  stageEnteredAt: number; // ms, sim-relative
  poison?: boolean;
  poisonRetries?: number;
};

export type LaneState = {
  queueDepth: number;
  connected: boolean;
  workerOnline: boolean;
  paused: boolean;
  nextEmitIn: number; // seconds
  backoff: number; // seconds
  reconnectCountdown: number | null;
  drainBoost: number; // seconds remaining of accelerated drain
};

export type LogEntry = {
  id: string;
  time: string;
  from: string;
  to: string;
  event: string;
  seq?: number;
  level: "info" | "warn" | "error";
};

export type SimState = {
  clockMs: number;
  lanes: Record<LaneId, LaneState>;
  inFlight: InFlightMessage[];
  eventsProcessed: number;
  reconnectAttempts: number;
  dlqCount: number;
  dlqActive: number; // seconds remaining "lit"
  log: LogEntry[];
  failures: {
    partition: boolean;
    consumerOffline: boolean;
    validationHold: boolean;
  };
  seqCounter: number;
  lastAnnouncement: string | null;
};

const HOP_SECONDS: Record<Stage, number> = {
  "producer-queue": 0.7,
  "queue-adapter": 0.8,
  "adapter-normalizer": 0.8,
  "normalizer-sink": 0.8,
  "normalizer-dlq": 0.8,
};

const MAX_LOG = 40;
const MAX_INFLIGHT_RENDERED = 24;

function randomEmitInterval() {
  return 3.4 + Math.random() * 2.0; // ~1.1-1.8s combined across 3 lanes
}

function formatTime(ms: number) {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const msPart = String(d.getMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${msPart}`;
}

function makeLane(): LaneState {
  return {
    queueDepth: 0,
    connected: true,
    workerOnline: true,
    paused: false,
    nextEmitIn: randomEmitInterval(),
    backoff: 1,
    reconnectCountdown: null,
    drainBoost: 0,
  };
}

export function createInitialState(nowMs: number): SimState {
  return {
    clockMs: nowMs,
    lanes: { a: makeLane(), b: makeLane(), c: makeLane() },
    inFlight: [],
    eventsProcessed: 0,
    reconnectAttempts: 0,
    dlqCount: 0,
    dlqActive: 0,
    log: [],
    failures: { partition: false, consumerOffline: false, validationHold: false },
    seqCounter: 88400,
    lastAnnouncement: null,
  };
}

function pushLog(
  state: SimState,
  entry: Omit<LogEntry, "id" | "time">,
): void {
  state.log.push({
    id: `log-${state.seqCounter}-${state.log.length}-${Math.random().toString(36).slice(2, 7)}`,
    time: formatTime(state.clockMs),
    ...entry,
  });
  if (state.log.length > MAX_LOG) state.log.shift();
}

function laneHealthy(state: SimState, lane: LaneId) {
  const l = state.lanes[lane];
  return l.connected && l.workerOnline;
}

function isPartitioned(state: SimState, lane: LaneId) {
  return state.failures.partition && lane === PARTITION_LANE;
}

function isOffline(state: SimState, lane: LaneId) {
  return state.failures.consumerOffline && lane === CONSUMER_OFFLINE_LANE;
}

export function advance(prev: SimState, dtSeconds: number): SimState {
  const state: SimState = structuredCloneLite(prev);
  state.clockMs += dtSeconds * 1000;
  // lastAnnouncement is intentionally left as-is here — it's set only by the
  // user-triggered actions below and read directly as the aria-live text, so
  // it persists across ticks instead of needing a separate "latched" copy.

  if (state.dlqActive > 0) state.dlqActive = Math.max(0, state.dlqActive - dtSeconds);

  for (const lane of LANES) {
    const l = state.lanes[lane];
    l.connected = !isPartitioned(state, lane);
    l.workerOnline = !isOffline(state, lane);
    l.paused = state.failures.validationHold && lane === VALIDATION_HOLD_LANE;

    // Producer emission
    if (!l.paused) {
      l.nextEmitIn -= dtSeconds;
      if (l.nextEmitIn <= 0) {
        l.nextEmitIn += randomEmitInterval();
        const seq = ++state.seqCounter;
        l.queueDepth += 1;
        state.inFlight.push({
          id: `msg-${seq}`,
          lane,
          stage: "producer-queue",
          seq,
          stageEnteredAt: state.clockMs,
        });
        pushLog(state, {
          from: `producer.${lane}`,
          to: `q.protocol.${lane}`,
          event: "EVT_UNIT_ENTER",
          seq,
          level: "info",
        });
      }
    }

    // Reconnect backoff countdown (partition only)
    if (isPartitioned(state, lane)) {
      if (l.reconnectCountdown === null) l.reconnectCountdown = l.backoff;
      l.reconnectCountdown -= dtSeconds;
      if (l.reconnectCountdown <= 0) {
        state.reconnectAttempts += 1;
        pushLog(state, {
          from: `adapter.${lane}`,
          to: "broker",
          event: "RECONNECT_ATTEMPT",
          level: "warn",
        });
        l.backoff = Math.min(30, l.backoff * 2);
        l.reconnectCountdown = l.backoff;
      }
    } else {
      l.reconnectCountdown = null;
      l.backoff = 1;
    }

    if (l.drainBoost > 0) l.drainBoost = Math.max(0, l.drainBoost - dtSeconds);
  }

  // Dequeue: healthy lanes forward immediately; recovering lanes drain boosted.
  for (const lane of LANES) {
    const l = state.lanes[lane];
    const healthy = laneHealthy(state, lane);
    if (healthy && l.queueDepth > 0) {
      const drainRate = l.drainBoost > 0 ? 3 : 1;
      for (let i = 0; i < drainRate && l.queueDepth > 0; i++) {
        l.queueDepth -= 1;
        const seq = ++state.seqCounter - 0; // reuse a fresh seq for the forwarded leg
        state.inFlight.push({
          id: `msg-fwd-${seq}-${Math.random().toString(36).slice(2, 6)}`,
          lane,
          stage: "adapter-normalizer",
          seq,
          stageEnteredAt: state.clockMs,
        });
        pushLog(state, {
          from: `adapter.${lane}`,
          to: "normalizer",
          event: "ADAPTED",
          seq,
          level: "info",
        });
      }
    }
  }

  // Advance in-flight messages through their stages.
  const next: InFlightMessage[] = [];
  for (const msg of state.inFlight) {
    const elapsed = (state.clockMs - msg.stageEnteredAt) / 1000;
    if (elapsed < HOP_SECONDS[msg.stage]) {
      next.push(msg);
      continue;
    }

    if (msg.stage === "producer-queue") {
      // Cosmetic leg only — already counted in queueDepth on emit.
      continue;
    }

    if (msg.stage === "queue-adapter") {
      next.push({ ...msg, stage: "adapter-normalizer", stageEnteredAt: state.clockMs });
      continue;
    }

    if (msg.stage === "adapter-normalizer") {
      if (msg.poison) {
        const retries = msg.poisonRetries ?? 0;
        if (retries < 2) {
          pushLog(state, {
            from: "normalizer",
            to: "normalizer",
            event: `RETRY ${retries + 1}/2`,
            seq: msg.seq,
            level: "warn",
          });
          next.push({ ...msg, stageEnteredAt: state.clockMs, poisonRetries: retries + 1 });
        } else {
          pushLog(state, {
            from: "normalizer",
            to: "dlq",
            event: "ROUTED_TO_DLQ",
            seq: msg.seq,
            level: "error",
          });
          state.dlqCount += 1;
          state.dlqActive = 3;
          next.push({ ...msg, stage: "normalizer-dlq", stageEnteredAt: state.clockMs });
        }
        continue;
      }
      pushLog(state, {
        from: "normalizer",
        to: "sink",
        event: "CFX.UnitsProcessed",
        seq: msg.seq,
        level: "info",
      });
      next.push({ ...msg, stage: "normalizer-sink", stageEnteredAt: state.clockMs });
      continue;
    }

    if (msg.stage === "normalizer-sink") {
      state.eventsProcessed += 1;
      continue;
    }

    // normalizer-dlq: terminal, drop after animating.
  }
  state.inFlight = next.slice(-MAX_INFLIGHT_RENDERED);

  return state;
}

function structuredCloneLite(state: SimState): SimState {
  return {
    ...state,
    lanes: {
      a: { ...state.lanes.a },
      b: { ...state.lanes.b },
      c: { ...state.lanes.c },
    },
    inFlight: state.inFlight.map((m) => ({ ...m })),
    log: [...state.log],
    failures: { ...state.failures },
  };
}

export function togglePartition(state: SimState): SimState {
  const s = structuredCloneLite(state);
  s.failures.partition = !s.failures.partition;
  const lane = PARTITION_LANE;
  if (s.failures.partition) {
    s.lanes[lane].backoff = 1;
    s.lanes[lane].reconnectCountdown = 1;
    pushLog(s, {
      from: "broker",
      to: `adapter.${lane}`,
      event: "NETWORK_PARTITION",
      level: "error",
    });
    s.lastAnnouncement = `Network partition injected on adapter ${lane}. Queue depth rising.`;
  } else {
    s.lanes[lane].reconnectCountdown = null;
    s.lanes[lane].backoff = 1;
    s.lanes[lane].drainBoost = 3;
    pushLog(s, {
      from: `adapter.${lane}`,
      to: "broker",
      event: "RECONNECTED",
      level: "info",
    });
    s.lastAnnouncement = `Connection restored on adapter ${lane}. Queue draining.`;
  }
  return s;
}

export function toggleConsumerOffline(state: SimState): SimState {
  const s = structuredCloneLite(state);
  s.failures.consumerOffline = !s.failures.consumerOffline;
  const lane = CONSUMER_OFFLINE_LANE;
  if (s.failures.consumerOffline) {
    pushLog(s, {
      from: `adapter.${lane}`,
      to: "broker",
      event: "CONSUMER_OFFLINE",
      level: "error",
    });
    s.lastAnnouncement = `Consumer offline on adapter ${lane}. Broker is retaining messages.`;
  } else {
    s.lanes[lane].drainBoost = 3;
    pushLog(s, {
      from: `adapter.${lane}`,
      to: "broker",
      event: "CONSUMER_ONLINE",
      level: "info",
    });
    s.lastAnnouncement = `Consumer back online on adapter ${lane}. Draining backlog.`;
  }
  return s;
}

export function toggleValidationHold(state: SimState): SimState {
  const s = structuredCloneLite(state);
  s.failures.validationHold = !s.failures.validationHold;
  const lane = VALIDATION_HOLD_LANE;
  if (s.failures.validationHold) {
    pushLog(s, {
      from: `adapter.${lane}`,
      to: `producer.${lane}`,
      event: "READY_SIGNAL_WITHHELD (deliberate, not a failure)",
      level: "warn",
    });
    s.lastAnnouncement = `Validation hold on adapter ${lane}. Ready signal withheld — producer ${lane} paused.`;
  } else {
    pushLog(s, {
      from: `adapter.${lane}`,
      to: `producer.${lane}`,
      event: "READY_SIGNAL_RESTORED",
      level: "info",
    });
    s.lastAnnouncement = `Validation hold released on adapter ${lane}. Producer ${lane} resumes.`;
  }
  return s;
}

export function injectPoison(state: SimState): SimState {
  const s = structuredCloneLite(state);
  const seq = ++s.seqCounter;
  pushLog(s, {
    from: "normalizer",
    to: "normalizer",
    event: "MALFORMED_EVENT",
    seq,
    level: "warn",
  });
  s.inFlight.push({
    id: `msg-poison-${seq}`,
    lane: "poison",
    stage: "adapter-normalizer",
    seq,
    stageEnteredAt: s.clockMs,
    poison: true,
    poisonRetries: 0,
  });
  s.lastAnnouncement = "Poison message injected. Normalizer will retry, then route to the dead-letter queue.";
  return s;
}

export function resetSim(nowMs: number): SimState {
  const s = createInitialState(nowMs);
  s.lastAnnouncement = "Simulator reset to steady state.";
  return s;
}
