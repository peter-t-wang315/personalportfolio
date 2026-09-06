import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nebula | Peter Wang",
  description:
    "The same projects and technologies, connected as a 3D constellation.",
};

/**
 * The bare graph. Everything visible here is the persisted canvas and the
 * chrome in ./layout.tsx; this page contributes nothing but its metadata.
 * Opening a node navigates to a sibling route beneath the same layout.
 */
export default function Nebula() {
  return null;
}
