/**
 * Has the app finished its first client render?
 *
 * Exists for one question: when a client component mounts, was it part of the
 * server-rendered document (hydration) or was it mounted later by a client
 * navigation? nebula-panel.tsx needs the answer to tell a cold entry — content
 * must be visible at first paint — from an in-graph navigation, where the
 * panel fades in once the flight lands.
 *
 * Marked from PointerTracker, which the root layout always mounts, so it is
 * true after the first effects flush on *every* route — not only after some
 * particular component has appeared. The panel's own effect was the first
 * attempt and was wrong for exactly that reason: opening a node from the bare
 * `/nebula` mounted the first panel the document had ever had, which still
 * read as cold.
 *
 * Reading this during render is hydration-safe: it is false on the server and
 * false during the hydration render (effects have not run yet), so the two
 * agree, and only becomes true for renders that happen afterwards.
 */
let hydrated = false;

export function markHydrated() {
  hydrated = true;
}

export function wasHydratedBefore() {
  return hydrated;
}
