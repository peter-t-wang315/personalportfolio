import { useEffect, useRef, useState } from "react";
import type { LogEntry } from "./engine";

const LEVEL_COLOR: Record<LogEntry["level"], string> = {
  info: "text-shell/80",
  warn: "text-shell/80",
  error: "text-plum",
};

export default function MessageLog({ log }: { log: LogEntry[] }) {
  const [paused, setPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (paused) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log, paused]);

  return (
    <div className="flex h-full flex-col rounded-[4px] border-t border-white/15 bg-black/20">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <span className="font-utility text-[10px] tracking-widest text-graphite uppercase">
          Message log
        </span>
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          className="font-utility text-[10px] tracking-widest text-shell/80 uppercase hover:text-white"
          aria-pressed={paused}
        >
          {paused ? "Resume" : "Pause"}
        </button>
      </div>
      <div
        ref={scrollRef}
        className="font-utility flex-1 overflow-y-auto px-4 py-3 text-[11px] leading-relaxed"
        style={{ maxHeight: 260 }}
      >
        {log.map((entry) => (
          <div key={entry.id} className={LEVEL_COLOR[entry.level]}>
            <span className="text-graphite">{entry.time}</span>{" "}
            <span>{entry.from}</span> <span className="text-graphite">→</span>{" "}
            <span>{entry.to}</span> <span>{entry.event}</span>
            {entry.seq !== undefined && (
              <span className="text-graphite"> seq {entry.seq}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
