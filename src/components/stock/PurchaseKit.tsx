// PurchaseKit — presentation helpers for the Purchases page: the
// responsive line-item editor of the "New Purchase" form, the mobile
// purchase card and the read-only purchase detail body.
// Pure UI: the page owns all state, API calls and handlers.

import { useMemo } from "react";
import { Button, Empty, InputNumber, Select, Tooltip } from "antd";
import { CalendarOutlined, DeleteOutlined, EyeOutlined, FileTextOutlined, PlusOutlined, ShopOutlined, UserOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import type { IngredientDto } from "../../services/ingredientService";
import type { PurchaseDto } from "../../services/purchaseService";
import { Pill } from "../ui/PageKit";

const fmtPurchaseMoney = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtQty = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 3 });

type DraftLine = {
  key: string;
  ingredientId: number | null;
  unit: string;
  quantity: number;
  unitCost: number;
};

// Shared column template: ingredient | quantity | unit cost | line total | remove
const ROW_GRID = "md:grid-cols-[minmax(0,1fr)_170px_150px_110px_32px]";

const fieldLabel = "mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-500 md:hidden dark:text-gray-400";

/**
 * The editable line items of a new purchase. Rows on md+, one card per line
 * on narrow screens. The page owns `draft` and the patch / add / remove handlers.
 */
export function PurchaseLineEditor({
  draft,
  ingredients,
  total,
  onPatch,
  onRemove,
  onAdd,
}: {
  draft: DraftLine[];
  ingredients: IngredientDto[];
  total: number;
  onPatch: (key: string, patch: Partial<DraftLine>) => void;
  onRemove: (key: string) => void;
  onAdd: () => void;
}) {
  const ingredientOptions = useMemo(
    () => ingredients.map((i) => ({ value: i.id, label: `${i.name} (${i.unit})` })),
    [ingredients]
  );

  return (
    <div className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Lines</h3>
          <Pill tone="blue"><span className="tabular-nums">{draft.length}</span></Pill>
        </div>
        <span className="hidden text-xs text-gray-500 sm:inline dark:text-gray-400">Stock and latest cost update on save</span>
      </div>

      {draft.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-6 dark:border-white/10">
          <Empty description="No lines yet" />
        </div>
      ) : (
        <div className="min-w-0">
          {/* Column headings (md+) */}
          <div className={`hidden gap-3 border-b border-gray-100 px-1 pb-2 text-[11px] font-medium uppercase tracking-wide text-gray-500 md:grid dark:border-white/[0.06] dark:text-gray-400 ${ROW_GRID}`}>
            <span>Ingredient</span>
            <span>Quantity</span>
            <span>Unit cost</span>
            <span className="text-right">Line total</span>
            <span className="sr-only">Remove</span>
          </div>

          <div className="space-y-3 md:space-y-0">
            {draft.map((r, idx) => {
              const lineTotal = (r.quantity || 0) * (r.unitCost || 0);
              return (
                <div
                  key={r.key}
                  className={`grid min-w-0 grid-cols-2 gap-3 rounded-xl border border-gray-200/80 bg-gray-50/50 p-3 md:items-center md:rounded-none md:border-0 md:border-b md:border-gray-100 md:bg-transparent md:px-1 md:py-2.5 dark:border-white/[0.06] dark:bg-white/[0.02] md:dark:bg-transparent ${ROW_GRID}`}
                >
                  {/* Card header (mobile) */}
                  <div className="col-span-2 flex items-center justify-between md:hidden">
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Line {idx + 1}</span>
                    <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => onRemove(r.key)}>
                      Remove
                    </Button>
                  </div>

                  <div className="col-span-2 min-w-0 md:col-span-1">
                    <label className={fieldLabel}>Ingredient</label>
                    <Select showSearch optionFilterProp="label" placeholder="Pick ingredient"
                      value={r.ingredientId ?? undefined}
                      onChange={(v) => onPatch(r.key, { ingredientId: v as number })}
                      style={{ width: "100%" }}
                      aria-label={`Ingredient, line ${idx + 1}`}
                      options={ingredientOptions} />
                  </div>

                  <div className="min-w-0">
                    <label className={fieldLabel}>Quantity</label>
                    <div className="flex min-w-0 items-center gap-2">
                      <InputNumber min={0} step={0.1} value={r.quantity}
                        onChange={(v) => onPatch(r.key, { quantity: Number(v ?? 0) })}
                        style={{ width: "100%" }}
                        aria-label={`Quantity, line ${idx + 1}`} />
                      <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">{r.unit || "—"}</span>
                    </div>
                  </div>

                  <div className="min-w-0">
                    <label className={fieldLabel}>Unit cost</label>
                    <InputNumber min={0} step={0.01} prefix="$" value={r.unitCost}
                      onChange={(v) => onPatch(r.key, { unitCost: Number(v ?? 0) })}
                      style={{ width: "100%" }}
                      aria-label={`Unit cost, line ${idx + 1}`} />
                  </div>

                  <div className="col-span-2 flex items-center justify-between border-t border-gray-200/70 pt-2 md:col-span-1 md:block md:border-0 md:pt-0 md:text-right dark:border-white/[0.06]">
                    <span className="text-xs text-gray-500 md:hidden dark:text-gray-400">Line total</span>
                    <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{fmtPurchaseMoney(lineTotal)}</span>
                  </div>

                  <div className="hidden justify-end md:flex">
                    <Tooltip title="Remove">
                      <Button size="small" danger icon={<DeleteOutlined />} onClick={() => onRemove(r.key)} aria-label={`Remove line ${idx + 1}`} />
                    </Tooltip>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add line + totals */}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button type="dashed" icon={<PlusOutlined />} onClick={onAdd} className="w-full sm:w-auto">Add Line</Button>
        <div className="flex items-baseline justify-between gap-4 rounded-xl bg-emerald-50 px-4 py-3 sm:justify-end dark:bg-emerald-500/10">
          <span className="text-sm text-emerald-800 dark:text-emerald-200">
            Total <span className="text-xs text-emerald-700/80 dark:text-emerald-300/80">· <span className="tabular-nums">{draft.length}</span> line{draft.length === 1 ? "" : "s"}</span>
          </span>
          <span className="text-xl font-semibold tabular-nums text-emerald-900 dark:text-emerald-100">{fmtPurchaseMoney(total)}</span>
        </div>
      </div>
    </div>
  );
}

/** One purchase as a stacked card (mobile list). */
export function PurchaseCard({ p, onView }: { p: PurchaseDto; onView: () => void }) {
  return (
    <div className="min-w-0 rounded-xl border border-gray-200/80 bg-white p-4 dark:border-white/[0.06] dark:bg-white/[0.02]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={`truncate font-semibold ${p.supplierName ? "text-gray-900 dark:text-gray-100" : "text-gray-400"}`}>
            {p.supplierName || "No supplier"}
          </div>
          <div className="mt-0.5 text-xs tabular-nums text-gray-500 dark:text-gray-400">
            {dayjs(p.purchaseDate).format("MMM D, YYYY")} · #{p.id}
          </div>
        </div>
        <div className="shrink-0 text-right text-base font-semibold tabular-nums text-gray-900 dark:text-white">
          {fmtPurchaseMoney(p.totalCost)}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Pill tone="blue"><span className="tabular-nums">{p.lines.length}</span> line{p.lines.length === 1 ? "" : "s"}</Pill>
        {p.invoiceNumber && <Pill><FileTextOutlined /> {p.invoiceNumber}</Pill>}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-gray-100 pt-3 dark:border-white/[0.06]">
        <span className="min-w-0 truncate text-xs text-gray-500 dark:text-gray-400">{p.createdBy || "—"}</span>
        <Button size="small" icon={<EyeOutlined />} onClick={onView}>View</Button>
      </div>
    </div>
  );
}

/** Body of the read-only purchase detail modal. */
export function PurchaseDetailBody({ p }: { p: PurchaseDto }) {
  return (
    <div className="min-w-0 space-y-4 pt-1">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="blue"><CalendarOutlined /> {dayjs(p.purchaseDate).format("MMM D, YYYY")}</Pill>
        {p.supplierName && <Pill><ShopOutlined /> {p.supplierName}</Pill>}
        {p.invoiceNumber && <Pill><FileTextOutlined /> Inv# {p.invoiceNumber}</Pill>}
        {p.createdBy && <Pill><UserOutlined /> {p.createdBy}</Pill>}
      </div>
      {p.notes && (
        <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:bg-white/[0.04] dark:text-gray-300">{p.notes}</p>
      )}

      {/* Lines: table on md+ */}
      <div className="relative hidden overflow-x-auto rounded-xl border border-gray-100 md:block dark:border-white/[0.06]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-white/[0.03] dark:text-gray-400">
              <th className="px-3 py-2 text-left font-medium">Ingredient</th>
              <th className="px-3 py-2 text-right font-medium">Quantity</th>
              <th className="px-3 py-2 text-right font-medium">Unit cost</th>
              <th className="px-3 py-2 text-right font-medium">Line total</th>
            </tr>
          </thead>
          <tbody>
            {p.lines.map((l) => (
              <tr key={l.id} className="border-t border-gray-100 dark:border-white/[0.06]">
                <td className="px-3 py-2.5 text-gray-900 dark:text-gray-100">{l.ingredientName} <span className="text-gray-500 dark:text-gray-400">({l.unit})</span></td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{fmtQty(l.quantity)} {l.unit}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{fmtPurchaseMoney(l.unitCost)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums text-gray-900 dark:text-white">{fmtPurchaseMoney(l.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Lines: cards on mobile */}
      <div className="space-y-2 md:hidden">
        {p.lines.map((l) => (
          <div key={l.id} className="flex items-start justify-between gap-3 rounded-xl border border-gray-100 px-3 py-2.5 dark:border-white/[0.06]">
            <div className="min-w-0">
              <div className="break-words text-sm font-medium text-gray-900 dark:text-gray-100">{l.ingredientName} <span className="font-normal text-gray-500 dark:text-gray-400">({l.unit})</span></div>
              <div className="mt-0.5 text-xs tabular-nums text-gray-500 dark:text-gray-400">{fmtQty(l.quantity)} {l.unit} × {fmtPurchaseMoney(l.unitCost)}</div>
            </div>
            <div className="shrink-0 text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{fmtPurchaseMoney(l.lineTotal)}</div>
          </div>
        ))}
      </div>

      <div className="flex items-baseline justify-between gap-4 rounded-xl bg-gray-50 px-4 py-3 dark:bg-white/[0.04]">
        <span className="text-sm text-gray-600 dark:text-gray-300">Total · <span className="tabular-nums">{p.lines.length}</span> line{p.lines.length === 1 ? "" : "s"}</span>
        <span className="text-lg font-semibold tabular-nums text-gray-900 dark:text-white">{fmtPurchaseMoney(p.totalCost)}</span>
      </div>
    </div>
  );
}
