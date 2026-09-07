/**
 * Where the open interior panel is scrolled to, published for the node's own
 * material to draw.
 *
 * The scroll indicator is painted by the node's shader onto its rim rather
 * than laid over it as DOM, and this is how the DOM tells it what to draw. It
 * has to be here, free of `three`, because a DOM panel has no business pulling
 * the renderer into its chunk to report a scroll position.
 *
 * The reason for drawing it in the shader at all is occlusion. A DOM indicator
 * always paints above the canvas, so when the node's breathing outline wanders
 * inward past it, the thumb is left hanging outside the shape with no way to
 * go behind it. Painted onto the rim it *is* the wall: it moves with the
 * breathing, and where the wall curves away — at the corners, or when the
 * outline pulls in — it simply stops being drawn.
 */
export const focusScroll = {
  /** Centre of the thumb, 0 at the top of the node, 1 at the bottom. */
  position: 0,
  /** Length of the thumb as a fraction of the node's height. 0 hides it. */
  length: 0,
  /** When the panel last moved, for the fade. */
  lastMoveAt: -Infinity,
};

export function reportPanelScroll(position: number, length: number) {
  focusScroll.position = position;
  focusScroll.length = length;
  focusScroll.lastMoveAt = performance.now();
}

export function clearPanelScroll() {
  focusScroll.length = 0;
}

/** Visible while scrolling, held briefly, then faded out. */
export const SCROLL_HOLD_MS = 900;
export const SCROLL_FADE_MS = 200;
