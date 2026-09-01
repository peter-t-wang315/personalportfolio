/**
 * Canonical palette values. Mirrors the --color-* custom properties in
 * app/globals.css's @theme block. CSS can't import from TS, so keep these
 * two in sync by hand when the palette changes.
 *
 * Use this anywhere a literal hex is unavoidable: next/og ImageResponse
 * (Satori renders outside the DOM and can't read CSS variables) and R3F
 * shader uniforms (GLSL has no CSS variable access either). Anywhere Tailwind
 * classes reach (bg-paper, text-ink, etc.) use those instead, not this.
 */
export const palette = {
  paper: '#F4EEE0',
  paperRaised: '#FAF7EF',
  paperSunk: '#EAE2D0',
  ink: '#1C1917',
  inkMuted: '#5F5A4E',
  inkFaint: '#A8A08C',
  mask: '#1F4A3A',
  maskTint: '#E2E7DC',
  lamp: '#C8862A',
} as const;
