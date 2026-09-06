/**
 * Does this browser have WebGL at all? Cached: support cannot change mid-session.
 *
 * Lived inside nebula-canvas-loader.tsx until 2.6, which needs the same answer
 * from a DOM component to decide whether `/nebula/[slug]` should redirect to
 * `/work/[slug]` (05-phase-2.md, Deep linking) — a graph the visitor cannot
 * move through has no advantage over the document.
 */
let cached: boolean | null = null;

export function hasWebgl(): boolean {
  if (cached === null) {
    try {
      const canvas = document.createElement("canvas");
      cached = !!(
        canvas.getContext("webgl2") ||
        canvas.getContext("webgl") ||
        canvas.getContext("experimental-webgl")
      );
    } catch {
      cached = false;
    }
  }
  return cached;
}
