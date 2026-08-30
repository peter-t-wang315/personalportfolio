"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import {
  advance,
  createInitialState,
  injectPoison,
  resetSim,
  togglePartition,
  toggleConsumerOffline,
  toggleValidationHold,
  type SimState,
} from "./engine";
import { useMediaQuery } from "./useMediaQuery";
import MetricsStrip from "./MetricsStrip";
import Topology from "./Topology";
import MessageLog from "./MessageLog";
import FailureControls from "./FailureControls";
import NodeDetail from "./NodeDetail";

type Action =
  | { type: "TICK"; dt: number }
  | { type: "PARTITION" }
  | { type: "CONSUMER_OFFLINE" }
  | { type: "POISON" }
  | { type: "VALIDATION_HOLD" }
  | { type: "RESET" };

function reducer(state: SimState, action: Action): SimState {
  switch (action.type) {
    case "TICK":
      return advance(state, action.dt);
    case "PARTITION":
      return togglePartition(state);
    case "CONSUMER_OFFLINE":
      return toggleConsumerOffline(state);
    case "POISON":
      return injectPoison(state);
    case "VALIDATION_HOLD":
      return toggleValidationHold(state);
    case "RESET":
      return resetSim(Date.now());
  }
}

const TICK_SECONDS = 0.15;

export default function PipelineSimulator() {
  const [state, dispatch] = useReducer(reducer, undefined, () => createInitialState(Date.now()));
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);

  const mobile = useMediaQuery("(max-width: 767px)");
  const prefersReducedMotionQuery = useMediaQuery("(prefers-reduced-motion: reduce)");
  const reducedMotion = prefersReducedMotionQuery || manualMode;

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reducedMotion) return;
    const interval = setInterval(() => {
      // Drop ticks while off-screen. Checked fresh every tick (cheap at this
      // cadence) rather than cached from an IntersectionObserver callback —
      // a callback-cached flag can go stale on a fast programmatic scroll
      // (e.g. scrollIntoView on click) and never get another event to
      // correct it, silently freezing the simulator.
      const el = containerRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const visible = rect.bottom > 0 && rect.top < window.innerHeight;
        if (!visible) return;
      }
      dispatch({ type: "TICK", dt: TICK_SECONDS });
    }, TICK_SECONDS * 1000);
    return () => clearInterval(interval);
  }, [reducedMotion]);

  const activeConnections = (["a", "b", "c"] as const).filter(
    (l) => state.lanes[l].connected && state.lanes[l].workerOnline,
  ).length;
  const totalQueueDepth = state.lanes.a.queueDepth + state.lanes.b.queueDepth + state.lanes.c.queueDepth;

  return (
    <section id="pipeline" ref={containerRef} className="bg-ink py-16 sm:py-20">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-6 sm:px-10 md:px-16">
        <div>
          <p className="font-utility text-xs tracking-[0.2em] text-plum uppercase">
            The pipeline
          </p>
          <h2 className="font-display mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            An event pipeline you can break on purpose
          </h2>
        </div>

        <MetricsStrip
          eventsProcessed={state.eventsProcessed}
          queueDepth={totalQueueDepth}
          activeConnections={activeConnections}
          reconnectAttempts={state.reconnectAttempts}
        />

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="overflow-x-auto rounded-[10px] border-t border-white/15 bg-white/[0.02] p-4">
            <Topology
              state={state}
              mobile={mobile}
              reducedMotion={reducedMotion}
              selectedNode={selectedNode}
              onSelectNode={(id) => setSelectedNode((cur) => (cur === id ? null : id))}
            />
            <NodeDetail nodeId={selectedNode} onClose={() => setSelectedNode(null)} />
          </div>
          <MessageLog log={state.log} />
        </div>

        <FailureControls
          failures={state.failures}
          onTogglePartition={() => dispatch({ type: "PARTITION" })}
          onToggleConsumerOffline={() => dispatch({ type: "CONSUMER_OFFLINE" })}
          onInjectPoison={() => dispatch({ type: "POISON" })}
          onToggleValidationHold={() => dispatch({ type: "VALIDATION_HOLD" })}
          onReset={() => dispatch({ type: "RESET" })}
        />

        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-2xl text-sm leading-relaxed text-graphite">
            This models a production system I own at SEL — a service topology
            that moves real-time events from industrial equipment into
            Azure. The failure buttons are the actual failure modes I had to
            design for.
          </p>
          <div className="flex items-center gap-3">
            {prefersReducedMotionQuery && (
              <span className="font-utility text-[11px] text-graphite">
                Reduced motion — using step mode
              </span>
            )}
            {(reducedMotion || manualMode) && (
              <button
                type="button"
                onClick={() => dispatch({ type: "TICK", dt: 1 })}
                className="font-utility min-h-11 rounded-[4px] border-t border-white/15 bg-white/[0.06] px-4 py-2 text-xs tracking-wide text-shell uppercase hover:bg-white/[0.1]"
              >
                Step
              </button>
            )}
            {!prefersReducedMotionQuery && (
              <button
                type="button"
                onClick={() => setManualMode((m) => !m)}
                aria-pressed={manualMode}
                className="font-utility min-h-11 rounded-[4px] border-t border-white/15 bg-white/[0.06] px-4 py-2 text-xs tracking-wide text-shell uppercase hover:bg-white/[0.1]"
              >
                {manualMode ? "Resume auto" : "Step mode"}
              </button>
            )}
          </div>
        </div>
      </div>

      <div aria-live="polite" className="sr-only">
        {state.lastAnnouncement}
      </div>
    </section>
  );
}
