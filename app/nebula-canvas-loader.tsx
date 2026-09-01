"use client";

import { useSyncExternalStore } from "react";
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

let cachedWebglOk: boolean | null = null;

function getWebglSnapshot() {
  if (cachedWebglOk === null) {
    try {
      const canvas = document.createElement("canvas");
      cachedWebglOk = !!(
        canvas.getContext("webgl2") ||
        canvas.getContext("webgl") ||
        canvas.getContext("experimental-webgl")
      );
    } catch {
      cachedWebglOk = false;
    }
  }
  return cachedWebglOk;
}

function getServerWebglSnapshot() {
  return false;
}

function subscribe() {
  // WebGL support can't change mid-session; nothing to subscribe to.
  return () => {};
}

/**
 * Feature-detects WebGL before ever mounting the Canvas, via
 * useSyncExternalStore so the client-only check can differ from the SSR
 * snapshot without a hydration mismatch. R3F's renderer creation fails as an
 * unhandled promise rejection rather than a render-time throw, so
 * CanvasErrorBoundary alone can't catch it — this check is what actually
 * makes "fails silently to nothing" true for browsers without WebGL.
 */
export function NebulaCanvasLoader() {
  const webglOk = useSyncExternalStore(
    subscribe,
    getWebglSnapshot,
    getServerWebglSnapshot,
  );

  if (!webglOk) return <div className="fixed inset-0 z-0 bg-paper" />;

  return (
    <CanvasErrorBoundary>
      <NebulaCanvas />
    </CanvasErrorBoundary>
  );
}
