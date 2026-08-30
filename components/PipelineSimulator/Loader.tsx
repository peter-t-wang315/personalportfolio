"use client";

import dynamic from "next/dynamic";

const PipelineSimulator = dynamic(() => import("./index"), {
  ssr: false,
  loading: () => (
    <section className="flex min-h-[600px] items-center justify-center bg-ink py-20">
      <p className="font-utility text-xs tracking-widest text-graphite uppercase">
        Loading pipeline simulator…
      </p>
    </section>
  ),
});

export default function PipelineSimulatorLoader() {
  return <PipelineSimulator />;
}
