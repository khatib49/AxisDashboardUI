// MovementKit — presentation helpers for the Stock Movements / Waste Log
// page: the type pill, the signed quantity and the mobile movement card.
// Pure UI: the page owns all state, API calls and handlers.

import type { ReactNode } from "react";
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  ExportOutlined,
  InboxOutlined,
  SlidersOutlined,
  SwapOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import type { StockMovementDto } from "../../services/ingredientService";
import { Pill } from "../ui/PageKit";

type Tone = "gray" | "violet" | "blue" | "emerald" | "amber" | "red" | "purple";

const MOVEMENT_TYPE_META: Record<string, { tone: Tone; icon: ReactNode }> = {
  Purchase: { tone: "emerald", icon: <InboxOutlined /> },
  Consumption: { tone: "blue", icon: <ExportOutlined /> },
  Waste: { tone: "red", icon: <DeleteOutlined /> },
  Adjustment: { tone: "purple", icon: <SlidersOutlined /> },
};

const fmtQty = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 3 });

/** Movement type as a tinted pill with an icon. */
export function MovementTypePill({ type }: { type: string }) {
  const meta = MOVEMENT_TYPE_META[type] ?? { tone: "gray" as Tone, icon: <SwapOutlined /> };
  return (
    <Pill tone={meta.tone}>
      <span aria-hidden className="text-[10px] leading-none">{meta.icon}</span>
      {type}
    </Pill>
  );
}

/** Signed quantity: + / − sign, arrow and colour, so meaning never rests on colour alone. */
export function SignedQty({ n, unit, size = "md" }: { n: number; unit: string; size?: "md" | "lg" }) {
  const up = n >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap font-semibold tabular-nums ${
        up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
      } ${size === "lg" ? "text-base" : ""}`}
    >
      <span aria-hidden className="text-[10px]">{up ? <ArrowUpOutlined /> : <ArrowDownOutlined />}</span>
      {up ? "+" : "−"}{fmtQty(Math.abs(n))}
      <span className="font-normal text-gray-500 dark:text-gray-400">{unit}</span>
    </span>
  );
}

/** Balance after the movement; negative balances are flagged in red. */
export function BalanceQty({ n, unit }: { n: number; unit: string }) {
  return (
    <span className={`whitespace-nowrap tabular-nums ${n < 0 ? "font-medium text-red-600 dark:text-red-400" : "text-gray-700 dark:text-gray-300"}`}>
      {fmtQty(n)} <span className="text-gray-500 dark:text-gray-400">{unit}</span>
    </span>
  );
}

/** Reason / reference cell: waste reason or transaction link, plus notes. */
export function MovementReference({ r }: { r: StockMovementDto }) {
  if (r.type === "Waste" && r.wasteReason) {
    return (
      <span className="flex min-w-0 flex-wrap items-center gap-2">
        <Pill tone="red" dot>{r.wasteReason}</Pill>
        {r.notes && <span className="min-w-0 break-words text-xs text-gray-500 dark:text-gray-400">{r.notes}</span>}
      </span>
    );
  }
  if (r.referenceType === "Transaction" && r.referenceId) {
    return (
      <span className="flex min-w-0 flex-wrap items-center gap-2">
        <Pill tone="blue">Tx #{r.referenceId}</Pill>
        {r.notes && <span className="min-w-0 break-words text-xs text-gray-500 dark:text-gray-400">{r.notes}</span>}
      </span>
    );
  }
  return r.notes
    ? <span className="break-words text-gray-700 dark:text-gray-300">{r.notes}</span>
    : <span className="text-gray-400">—</span>;
}

/** "Oct 6, 2026" + "14:05" */
export function MovementWhen({ iso }: { iso: string }) {
  const d = dayjs(iso);
  return (
    <div className="whitespace-nowrap">
      <div className="font-medium tabular-nums text-gray-900 dark:text-gray-100">{d.format("MMM D, YYYY")}</div>
      <div className="text-[11px] tabular-nums text-gray-500 dark:text-gray-400">{d.format("HH:mm")}</div>
    </div>
  );
}

/** One movement as a stacked card (mobile list). */
export function MovementCard({ r }: { r: StockMovementDto }) {
  const d = dayjs(r.createdOn);
  return (
    <div className="min-w-0 rounded-xl border border-gray-200/80 bg-white p-4 dark:border-white/[0.06] dark:bg-white/[0.02]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-semibold text-gray-900 dark:text-gray-100">{r.ingredientName}</div>
          <div className="mt-1"><MovementTypePill type={r.type} /></div>
        </div>
        <div className="shrink-0 text-right">
          <SignedQty n={r.quantity} unit={r.ingredientUnit} size="lg" />
          <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            Balance <BalanceQty n={r.balanceAfter} unit={r.ingredientUnit} />
          </div>
        </div>
      </div>
      <div className="mt-3 min-w-0 text-sm">
        <MovementReference r={r} />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3 text-xs text-gray-500 dark:border-white/[0.06] dark:text-gray-400">
        <span className="tabular-nums">{d.format("MMM D, YYYY · HH:mm")}</span>
        <span className="min-w-0 truncate">{r.createdBy || "—"}</span>
      </div>
    </div>
  );
}
