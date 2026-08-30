const RAMP = ["var(--moss-1)", "var(--moss-2)", "var(--moss-3)", "var(--moss-4)"];

// 8x8 placeholder silhouettes, quantized to the four-value moss ramp per
// docs/02 and docs/04. Real generated + touched-up sprite art replaces these
// 1:1 later without changing the grid contract (8x8, values 0-3, symmetric).
const PATTERNS: Record<1 | 2 | 3 | 4, number[][]> = {
  1: [
    [0, 0, 1, 1, 1, 1, 0, 0],
    [0, 1, 2, 1, 1, 2, 1, 0],
    [1, 2, 3, 2, 2, 3, 2, 1],
    [1, 2, 2, 2, 2, 2, 2, 1],
    [0, 1, 2, 3, 3, 2, 1, 0],
    [0, 1, 2, 2, 2, 2, 1, 0],
    [0, 0, 1, 0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0, 1, 0, 0],
  ],
  2: [
    [0, 1, 1, 0, 0, 1, 1, 0],
    [1, 2, 2, 1, 1, 2, 2, 1],
    [1, 2, 3, 3, 3, 3, 2, 1],
    [0, 2, 3, 2, 2, 3, 2, 0],
    [0, 2, 3, 2, 2, 3, 2, 0],
    [0, 1, 2, 2, 2, 2, 1, 0],
    [0, 0, 1, 2, 2, 1, 0, 0],
    [0, 0, 1, 0, 0, 1, 0, 0],
  ],
  3: [
    [0, 0, 0, 1, 1, 0, 0, 0],
    [0, 1, 1, 2, 2, 1, 1, 0],
    [1, 2, 3, 3, 3, 3, 2, 1],
    [1, 2, 3, 2, 2, 3, 2, 1],
    [1, 2, 3, 3, 3, 3, 2, 1],
    [0, 1, 2, 2, 2, 2, 1, 0],
    [0, 1, 1, 0, 0, 1, 1, 0],
    [0, 1, 1, 0, 0, 1, 1, 0],
  ],
  4: [
    [0, 0, 1, 1, 1, 1, 0, 0],
    [0, 1, 2, 2, 2, 2, 1, 0],
    [1, 2, 2, 3, 3, 2, 2, 1],
    [1, 2, 3, 3, 3, 3, 2, 1],
    [1, 2, 2, 3, 3, 2, 2, 1],
    [0, 1, 2, 2, 2, 2, 1, 0],
    [0, 0, 1, 2, 2, 1, 0, 0],
    [0, 0, 0, 1, 1, 0, 0, 0],
  ],
};

export default function CreatureSprite({
  variant,
  size = 64,
  className,
}: {
  variant: 1 | 2 | 3 | 4;
  size?: number;
  className?: string;
}) {
  const grid = PATTERNS[variant];
  return (
    <svg
      viewBox="0 0 8 8"
      width={size}
      height={size}
      role="presentation"
      aria-hidden="true"
      className={className}
      style={{ imageRendering: "pixelated" }}
    >
      {grid.flatMap((row, y) =>
        row.map((v, x) =>
          v === 0 ? null : (
            <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={RAMP[v - 1]} />
          ),
        ),
      )}
    </svg>
  );
}
