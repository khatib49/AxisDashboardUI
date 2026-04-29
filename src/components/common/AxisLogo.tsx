import React from "react";

type Variant = "mark" | "full";
type Size = "sm" | "md" | "lg";

const sizeMap: Record<Size, { mark: number; word: string; gap: string }> = {
  sm: { mark: 28, word: "text-[10px]", gap: "gap-2" },
  md: { mark: 36, word: "text-[13px]", gap: "gap-2.5" },
  lg: { mark: 56, word: "text-[20px]", gap: "gap-4" },
};

interface AxisLogoProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  /**
   * When true, the mark renders without its filled background — just the
   * pixel-X glyph in `currentColor`. Useful for compact monochrome contexts.
   */
  bare?: boolean;
  /** Override wordmark text. Defaults to "AXIS". */
  wordmark?: string;
  /** Optional small subtitle rendered under the wordmark (e.g. "ADMIN"). */
  subtitle?: string;
}

export const AxisMark: React.FC<{ size?: number; bare?: boolean; className?: string }> = ({
  size = 32,
  bare = false,
  className,
}) => {
  if (bare) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        role="img"
        aria-label="AXIS"
      >
        <g fill="currentColor">
          <rect x="6" y="6" width="4" height="4" />
          <rect x="22" y="6" width="4" height="4" />
          <rect x="10" y="10" width="4" height="4" />
          <rect x="18" y="10" width="4" height="4" />
          <rect x="14" y="14" width="4" height="4" />
          <rect x="10" y="18" width="4" height="4" />
          <rect x="18" y="18" width="4" height="4" />
          <rect x="6" y="22" width="4" height="4" />
          <rect x="22" y="22" width="4" height="4" />
        </g>
      </svg>
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="AXIS"
    >
      <rect width="32" height="32" rx="7" fill="#5B8DEF" />
      <g fill="#0B1220">
        <rect x="6" y="6" width="4" height="4" />
        <rect x="22" y="6" width="4" height="4" />
        <rect x="10" y="10" width="4" height="4" />
        <rect x="18" y="10" width="4" height="4" />
        <rect x="14" y="14" width="4" height="4" />
        <rect x="10" y="18" width="4" height="4" />
        <rect x="18" y="18" width="4" height="4" />
        <rect x="6" y="22" width="4" height="4" />
        <rect x="22" y="22" width="4" height="4" />
      </g>
    </svg>
  );
};

const AxisLogo: React.FC<AxisLogoProps> = ({
  variant = "full",
  size = "md",
  className = "",
  bare = false,
  wordmark = "AXIS",
  subtitle,
}) => {
  const dims = sizeMap[size];
  if (variant === "mark") {
    return <AxisMark size={dims.mark} bare={bare} className={className} />;
  }
  return (
    <div className={`flex items-center ${dims.gap} ${className}`}>
      <AxisMark size={dims.mark} bare={bare} />
      <div className="flex flex-col leading-none">
        <span
          className={`font-display tracking-[0.18em] text-gray-900 dark:text-white ${dims.word}`}
        >
          {wordmark}
        </span>
        {subtitle && (
          <span className="mt-1.5 font-mono text-[9px] tracking-[0.32em] text-brand-500 dark:text-brand-400">
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
};

export default AxisLogo;
