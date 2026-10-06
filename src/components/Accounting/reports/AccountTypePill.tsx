// One colour per account type, used by every accounting report so a type
// always reads the same: Asset blue, Liability amber, Equity violet,
// Revenue emerald, Expense red. Unknown types fall back to gray.

import type { ReactNode } from "react";
import { Pill } from "../../ui/PageKit";

type Tone = "gray" | "violet" | "blue" | "emerald" | "amber" | "red";

const TYPE_TONE: Record<string, Tone> = {
  Asset: "blue",
  Liability: "amber",
  Equity: "violet",
  Revenue: "emerald",
  Expense: "red",
};

export function AccountTypePill({ type }: { type: string }) {
  return <Pill tone={TYPE_TONE[type] ?? "gray"} dot>{type}</Pill>;
}

/** Account number as a small code chip. */
export function AccountCode({ children }: { children: ReactNode }) {
  return (
    <code className="whitespace-nowrap rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-700 dark:bg-white/[0.06] dark:text-gray-300">
      {children}
    </code>
  );
}
