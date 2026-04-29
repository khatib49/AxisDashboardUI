import React from "react";

type Variant = "full" | "icon";

interface BrandLogoProps {
  variant?: Variant;
  className?: string;
  showText?: boolean;
  size?: number;
  /** Force a specific text color tone — defaults adapt to dark/light. */
  tone?: "auto" | "light" | "dark" | "gradient";
}

/**
 * Official AXIS mark — a 5x5 pixel checker pattern forming an "X".
 * The mark is rendered as small squares so it stays crisp at any size.
 */
const PIXEL_PATTERN: Array<[number, number]> = [
  // 5x5 grid; (col, row) of filled squares forming a pixel "X"
  [0, 0], [4, 0],
  [1, 1], [3, 1],
  [2, 2],
  [1, 3], [3, 3],
  [0, 4], [4, 4],
];

const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = "full",
  className = "",
  showText = true,
  size = 40,
  tone = "auto",
}) => {
  const id = React.useId();
  const gradId = `axis-grad-${id}`;
  const innerGradId = `axis-inner-${id}`;

  // Render the pixel X mark inside a rounded gradient badge.
  const cell = 5; // pixel cell size in viewBox units
  const gap = 1.2;
  const offsetX = (40 - (5 * cell + 4 * gap)) / 2 + 4;
  const offsetY = (40 - (5 * cell + 4 * gap)) / 2 + 4;

  const Mark = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="shrink-0"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="55%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
        <linearGradient id={innerGradId} x1="0" y1="0" x2="0" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="white" stopOpacity="0.18" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Rounded gradient badge */}
      <rect x="2" y="2" width="44" height="44" rx="13" fill={`url(#${gradId})`} />
      {/* Top highlight */}
      <rect x="2" y="2" width="44" height="44" rx="13" fill={`url(#${innerGradId})`} />

      {/* AXIS pixel-X mark */}
      <g>
        {PIXEL_PATTERN.map(([cx, cy], i) => (
          <rect
            key={i}
            x={offsetX + cx * (cell + gap)}
            y={offsetY + cy * (cell + gap)}
            width={cell}
            height={cell}
            rx="0.6"
            fill="white"
            fillOpacity={cx === 2 && cy === 2 ? 1 : 0.95}
          />
        ))}
      </g>
    </svg>
  );

  if (variant === "icon" || !showText) {
    return <span className={className}>{Mark}</span>;
  }

  const wordmarkClass =
    tone === "light"
      ? "text-white"
      : tone === "dark"
        ? "text-gray-900"
        : tone === "gradient"
          ? "gradient-text"
          : "text-gray-900 dark:text-white";

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      {Mark}
      <span className="flex flex-col leading-none">
        <span className={`text-[20px] font-extrabold tracking-[0.18em] ${wordmarkClass}`}>
          AXIS
        </span>
        <span className="mt-1 text-[8.5px] font-semibold uppercase tracking-[0.28em] text-gray-400 dark:text-gray-500">
          Where Everything Connects
        </span>
      </span>
    </span>
  );
};

export default BrandLogo;
