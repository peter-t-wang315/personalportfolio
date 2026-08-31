"use client";

import dynamic from "next/dynamic";
import { CanvasErrorBoundary } from "./canvas-error-boundary";

const NebulaCanvas = dynamic(
  () => import("./nebula-canvas").then((mod) => mod.NebulaCanvas),
  {
    ssr: false,
    // Paints immediately so there's no flash while the three.js bundle loads.
    loading: () => <div className="fixed inset-0 z-0 bg-paper" />,
  },
);

export function NebulaCanvasLoader() {
  return (
    <CanvasErrorBoundary>
      <NebulaCanvas />
    </CanvasErrorBoundary>
  );
}
