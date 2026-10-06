// Signed money amount for report tables and tiles. Negatives are red AND
// carry a leading minus (never colour alone); pass `flag` to also show a
// small label pill next to a negative value.

import type { ReactNode } from "react";
import { Pill } from "../../ui/PageKit";
import { isNegative, money } from "./money";

export function Amount({ value, strong, flag, className = "" }: {
  value: number;
  strong?: boolean;
  flag?: ReactNode;
  className?: string;
}) {
  const neg = isNegative(value);
  return (
    <span
      className={`inline-flex flex-wrap items-center justify-end gap-x-1.5 whitespace-nowrap tabular-nums ${strong ? "font-semibold" : ""} ${
        neg ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-gray-100"
      } ${className}`}
    >
      {money(value)}
      {neg && flag && <Pill tone="red" dot>{flag}</Pill>}
    </span>
  );
}
