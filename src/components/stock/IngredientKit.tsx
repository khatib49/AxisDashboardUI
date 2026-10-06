// IngredientKit — presentation helpers for the Ingredients page
// (/chef/ingredients). Pure UI: the page owns all state, API calls and
// handlers; these only render what they are given.

import type { ReactNode } from "react";
import { Button, Tooltip } from "antd";
import {
  ArrowUpOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  EyeInvisibleOutlined,
  QuestionCircleOutlined,
  StopOutlined,
  ToolOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import type { IngredientDto } from "../../services/ingredientService";
import { Pill } from "../ui/PageKit";
import { type Health, fmtQty, health, isStockProblem, moneyUnit } from "./IngredientHealth";

type Tone = "red" | "amber" | "gray" | "emerald";

const HEALTH_META: Record<Health, { label: string; tone: Tone; icon: ReactNode }> = {
  negative:       { label: "Negative",         tone: "red",     icon: <ExclamationCircleOutlined /> },
  out:            { label: "Out of stock",     tone: "red",     icon: <StopOutlined /> },
  low:            { label: "Low",              tone: "amber",   icon: <WarningOutlined /> },
  "no-threshold": { label: "No reorder level", tone: "gray",    icon: <QuestionCircleOutlined /> },
  ok:             { label: "OK",               tone: "emerald", icon: <CheckCircleOutlined /> },
};

/** Status pill: colour + icon + text, so it never relies on colour alone. */
export function HealthPill({ h }: { h: Health }) {
  const meta = HEALTH_META[h];
  const pill = (
    <Pill tone={meta.tone}>
      <span aria-hidden className="text-[11px] leading-none">{meta.icon}</span>
      {meta.label}
    </Pill>
  );
  return h === "no-threshold" ? (
    <Tooltip title="No reorder level is set, so this ingredient will never raise a low-stock warning. Edit it to add one.">
      <span className="inline-flex">{pill}</span>
    </Tooltip>
  ) : pill;
}

const QTY_TEXT: Record<Health, string> = {
  negative: "text-red-600 dark:text-red-400",
  out: "text-red-600 dark:text-red-400",
  low: "text-amber-600 dark:text-amber-400",
  "no-threshold": "text-gray-900 dark:text-gray-100",
  ok: "text-gray-900 dark:text-gray-100",
};

const BAR: Record<Health, string> = {
  negative: "bg-red-500",
  out: "bg-red-500",
  low: "bg-amber-500",
  "no-threshold": "bg-gray-400",
  ok: "bg-emerald-500",
};

/**
 * On-hand quantity with a small meter. The meter's full width is twice the
 * reorder level, so the reorder line sits in the middle. Without a reorder
 * level there is nothing to measure against, so no meter.
 */
export function OnHand({ r, align = "right", large }: { r: IngredientDto; align?: "left" | "right"; large?: boolean }) {
  const h = health(r);
  const pct = r.reorderLevel != null && r.reorderLevel > 0
    ? Math.max(0, Math.min(1, r.quantityOnHand / (r.reorderLevel * 2))) * 100
    : null;
  return (
    <div className={`flex flex-col gap-1 ${align === "right" ? "items-end" : "items-start"}`}>
      <span className={`whitespace-nowrap font-semibold tabular-nums ${large ? "text-lg" : ""} ${QTY_TEXT[h]}`}>
        {fmtQty(r.quantityOnHand, r.unit)}
      </span>
      {pct !== null && (
        <span
          className="relative block h-1.5 w-full max-w-24 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10"
          title={`Reorder level: ${fmtQty(r.reorderLevel!, r.unit)}`}
          aria-hidden
        >
          <span className={`absolute inset-y-0 left-0 rounded-full ${BAR[h]}`} style={{ width: `${pct}%` }} />
          <span className="absolute inset-y-0 left-1/2 w-px bg-gray-400/70 dark:bg-white/30" />
        </span>
      )}
    </div>
  );
}

export type IngredientActions = {
  onStockIn: (r: IngredientDto) => void;
  onWaste: (r: IngredientDto) => void;
  onAdjust: (r: IngredientDto) => void;
  onEdit: (r: IngredientDto) => void;
  onHide: (r: IngredientDto) => void;
  onDelete: (r: IngredientDto) => void;
};

/** Visible row actions, shared by the table and the mobile cards. */
export function IngredientRowActions({ r, a, stretch }: { r: IngredientDto; a: IngredientActions; stretch?: boolean }) {
  const grow = stretch ? "flex-1" : "";
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${stretch ? "" : "justify-end"}`}>
      <Tooltip title="Shipment arrived">
        <Button size="small" type="primary" icon={<ArrowUpOutlined />} onClick={() => a.onStockIn(r)} className={grow}>
          Add Stock
        </Button>
      </Tooltip>
      <Tooltip title="Spoilage, spillage, burnt, etc.">
        <Button size="small" danger icon={<WarningOutlined />} onClick={() => a.onWaste(r)} className={grow}>
          Waste
        </Button>
      </Tooltip>
      <Tooltip title="Set absolute count (after a physical inventory)">
        <Button size="small" icon={<ToolOutlined />} onClick={() => a.onAdjust(r)} className={grow}>
          Adjust
        </Button>
      </Tooltip>
      <span className={`flex items-center gap-0.5 ${stretch ? "ml-auto" : "ml-1"}`}>
        <Tooltip title="Edit">
          <Button size="small" type="text" icon={<EditOutlined />} onClick={() => a.onEdit(r)} aria-label={`Edit ${r.name}`} />
        </Tooltip>
        {r.isActive && (
          <Tooltip title="Hide (soft delete — keeps history)">
            <Button size="small" type="text" icon={<EyeInvisibleOutlined />} onClick={() => a.onHide(r)} aria-label={`Hide ${r.name}`} />
          </Tooltip>
        )}
        {/* Hard delete is available for both active and hidden rows —
            the server enforces the FK-safety check anyway. */}
        <Tooltip title="Delete permanently (only if unused)">
          <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => a.onDelete(r)} aria-label={`Delete ${r.name} permanently`} />
        </Tooltip>
      </span>
    </div>
  );
}

/** One ingredient as a stacked card (below md). */
export function IngredientCard({ r, a }: { r: IngredientDto; a: IngredientActions }) {
  const h = health(r);
  const problem = isStockProblem(h);
  // A coloured left edge marks stock problems; the HealthPill carries the text + icon.
  const edge = h === "low" ? "border-l-4 border-l-amber-500!" : problem ? "border-l-4 border-l-red-500!" : "";
  return (
    <li className={`min-w-0 rounded-xl border border-gray-200/80 bg-white p-4 dark:border-white/[0.06] dark:bg-white/[0.02] ${edge}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-semibold text-gray-900 dark:text-gray-100">{r.name}</span>
            {!r.isActive && <Pill tone="gray" dot>Hidden</Pill>}
          </div>
          {r.notes && <p className="mt-0.5 line-clamp-2 break-words text-xs text-gray-500 dark:text-gray-400">{r.notes}</p>}
        </div>
        <HealthPill h={h} />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 rounded-lg bg-gray-50 p-3 text-xs dark:bg-white/[0.03]">
        <div className="col-span-2 min-w-0 sm:col-span-1">
          <dt className="text-gray-500 dark:text-gray-400">On hand</dt>
          <dd className="mt-1"><OnHand r={r} align="left" large /></dd>
        </div>
        <div className="min-w-0">
          <dt className="text-gray-500 dark:text-gray-400">Reorder at</dt>
          <dd className="mt-1 truncate font-medium tabular-nums text-gray-800 dark:text-gray-200">
            {r.reorderLevel == null ? "—" : fmtQty(r.reorderLevel, r.unit)}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-gray-500 dark:text-gray-400">Buy price</dt>
          <dd className="mt-1 truncate font-medium tabular-nums text-gray-800 dark:text-gray-200">
            {r.buyPricePerUnit == null ? "—" : <>{moneyUnit(r.buyPricePerUnit)}<span className="text-gray-400">/{r.unit}</span></>}
          </dd>
        </div>
      </dl>

      <div className="mt-3">
        <IngredientRowActions r={r} a={a} stretch />
      </div>
    </li>
  );
}

/** Modal title: tinted icon, title and a one-line context. */
export function ModalTitle({ icon, tone = "violet", title, sub }: {
  icon: ReactNode; tone?: "violet" | "emerald" | "red" | "blue"; title: ReactNode; sub?: ReactNode;
}) {
  const cls = {
    violet: "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300",
    emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300",
    red: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300",
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300",
  }[tone];
  return (
    <div className="flex min-w-0 items-center gap-3 pr-6">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base ${cls}`}>{icon}</span>
      <div className="min-w-0">
        <div className="truncate text-base font-semibold text-gray-900 dark:text-white">{title}</div>
        {sub && <div className="truncate text-xs font-normal text-gray-500 dark:text-gray-400">{sub}</div>}
      </div>
    </div>
  );
}

/** Modal footer: Cancel + primary; full-width stacked buttons on phones. */
export function ModalFooter({ onCancel, onOk, okText, danger }: {
  onCancel: () => void; onOk: () => void; okText: string; danger?: boolean;
}) {
  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button onClick={onCancel} className="w-full sm:w-auto">Cancel</Button>
      <Button type="primary" danger={danger} onClick={onOk} className="w-full sm:w-auto">{okText}</Button>
    </div>
  );
}

/** "Current on hand → after" strip shown at the top of the stock modals. */
export function StockPreview({ r, after }: { r: IngredientDto | null; after?: number | null }) {
  if (!r) return null;
  const h = health(r);
  const showAfter = after != null && Number.isFinite(after);
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200/80 bg-gray-50 px-4 py-3 dark:border-white/[0.06] dark:bg-white/[0.03]">
      <div className="min-w-0">
        <div className="text-xs text-gray-500 dark:text-gray-400">Current on hand</div>
        <div className={`font-semibold tabular-nums ${QTY_TEXT[h]}`}>{fmtQty(r.quantityOnHand, r.unit)}</div>
      </div>
      {showAfter ? (
        <div className="min-w-0 text-right">
          <div className="text-xs text-gray-500 dark:text-gray-400">After</div>
          <div className={`font-semibold tabular-nums ${after! < 0 ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-gray-100"}`}>
            {fmtQty(after!, r.unit)}
          </div>
        </div>
      ) : (
        <HealthPill h={h} />
      )}
    </div>
  );
}
