// Owner Summary tile. Keeps Rami's numbering (1–16) — the owners refer to
// the tiles by number. The accent says what kind of figure it is:
//   revenue (green) · cost (red) · net (cyan) · valuation (violet) · ratio (amber)
// Click → the metric's drill-down.

import type { ReactNode } from "react";
import { Tooltip } from "antd";
import { InfoCircleOutlined, RightOutlined } from "@ant-design/icons";

export type TileKind = "revenue" | "cost" | "net" | "valuation" | "ratio";

const KIND: Record<TileKind, { bar: string; chip: string; label: string }> = {
  revenue: { bar: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300", label: "Revenue" },
  cost: { bar: "bg-rose-500", chip: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300", label: "Cost" },
  net: { bar: "bg-cyan-500", chip: "bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-300", label: "Net" },
  valuation: { bar: "bg-violet-500", chip: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300", label: "Stock value" },
  ratio: { bar: "bg-amber-500", chip: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300", label: "Ratio" },
};

export default function MetricTile({ n, label, value, kind, tooltip, sub, onClick, negative, emphasis }: {
  n: number;
  label: string;
  value: ReactNode;
  kind: TileKind;
  tooltip?: string;
  sub?: ReactNode;
  onClick?: () => void;
  /** Paint the value red (a loss). */
  negative?: boolean;
  /** Bigger value for the headline row. */
  emphasis?: boolean;
}) {
  const k = KIND[kind];
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
      className={`group relative flex h-full flex-col justify-between overflow-hidden rounded-xl border border-gray-200/80 bg-white p-4 pl-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition dark:border-white/[0.06] dark:bg-white/[0.03] ${
        onClick ? "cursor-pointer hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md dark:hover:border-white/15" : ""
      }`}
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${k.bar}`} />
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 px-1 text-[10px] font-bold text-gray-500 dark:bg-white/10 dark:text-gray-300">{n}</span>
          <span className="truncate text-[13px] font-medium text-gray-600 dark:text-gray-300">{label}</span>
          {tooltip && (
            <Tooltip title={tooltip}>
              <InfoCircleOutlined className="shrink-0 text-[11px] text-gray-400" onClick={(e) => e.stopPropagation()} />
            </Tooltip>
          )}
        </div>
        {onClick && <RightOutlined className="mt-1 shrink-0 text-[10px] text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-gray-500" />}
      </div>
      <div className={`mt-2 font-semibold tracking-tight tabular-nums ${emphasis ? "text-[26px]" : "text-xl"} ${negative ? "text-rose-600 dark:text-rose-400" : "text-gray-900 dark:text-white"}`}>
        {value}
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span className="truncate text-[11px] text-gray-500 dark:text-gray-400">{sub}</span>
        <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${k.chip}`}>{k.label}</span>
      </div>
    </div>
  );
}
