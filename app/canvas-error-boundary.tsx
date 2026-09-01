"use client";

import { Component, type ReactNode } from "react";

/**
 * The canvas must fail silently to nothing when WebGL is unavailable. The
 * rest of the site is real DOM and works regardless. See
 * docs/04-phase-1.md's quality floor.
 */
export class CanvasErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}
