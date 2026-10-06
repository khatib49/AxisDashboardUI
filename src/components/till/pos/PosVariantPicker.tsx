// PosVariantPicker — till-sized version of components/items/ItemVariantPicker
// (that one is shared with Open Invoices and left untouched). Same contract
// and the same pick logic: one −/qty/+ row per active option, the item's
// line quantity is the sum of the picks (the caller keeps it in sync via
// onChange). Differences are layout only: 40px touch buttons, and long
// option lists collapse to the first few rows behind a "more" toggle and
// scroll inside the card when expanded, so one item with 20 colours can't
// push the whole grid down.

import { useState } from "react";
import type { ItemVariantDto } from "../../../services/itemService";

type VariantPicks = Record<number, number>;

const COLLAPSED_ROWS = 4;

export default function PosVariantPicker({
    variants,
    picks,
    onChange,
}: {
    variants: ItemVariantDto[];
    picks: VariantPicks;
    onChange: (next: VariantPicks) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const active = variants.filter(v => v.isActive !== false);
    // Identical to ItemVariantPicker's setQty.
    const setQty = (id: number, next: number) => {
        const copy: VariantPicks = { ...picks };
        if (next <= 0) delete copy[id]; else copy[id] = next;
        onChange(copy);
    };

    const hiddenCount = Math.max(0, active.length - COLLAPSED_ROWS);
    const shown = expanded ? active : active.slice(0, COLLAPSED_ROWS);
    const hiddenPicked = active.slice(COLLAPSED_ROWS).reduce((s, v) => s + (picks[v.id] ?? 0), 0);

    return (
        <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-white/10">
            <div className={`divide-y divide-gray-100 dark:divide-white/[0.06] ${expanded ? "max-h-[260px] overflow-y-auto" : ""}`}>
                {shown.map(v => {
                    const qty = picks[v.id] ?? 0;
                    const out = v.quantity <= 0;
                    return (
                        <div key={v.id} className={`flex flex-wrap items-center justify-between gap-x-2 gap-y-1 py-1.5 pl-2 pr-1 ${qty > 0 ? "bg-indigo-50/60 dark:bg-indigo-500/10" : "bg-white dark:bg-transparent"}`}>
                            {/* min-w keeps the option name readable; the stepper wraps below it on narrow cards. */}
                            <div className="flex min-w-[7rem] flex-1 items-center gap-2">
                                {v.color && /^#[0-9a-fA-F]{6}$/.test(v.color) ? (
                                    <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-black/10" style={{ background: v.color }} />
                                ) : null}
                                <div className="min-w-0">
                                    <div className={`truncate text-xs font-semibold ${qty > 0 ? "text-indigo-800 dark:text-indigo-200" : "text-gray-800 dark:text-gray-100"}`} title={v.name}>
                                        {v.name}
                                        {v.priceDelta !== 0 && <span className="font-normal text-gray-400"> {v.priceDelta > 0 ? "+" : "−"}${Math.abs(v.priceDelta).toFixed(2)}</span>}
                                    </div>
                                    <div className={`text-[11px] ${out ? "font-medium text-red-600 dark:text-red-400" : v.quantity <= 5 ? "text-amber-600 dark:text-amber-400" : "text-gray-500 dark:text-gray-400"}`}>
                                        {out ? `out of stock (${v.quantity})` : `${v.quantity} in stock`}
                                    </div>
                                </div>
                            </div>
                            <div className="ml-auto flex shrink-0 items-center overflow-hidden rounded-lg border border-gray-200 dark:border-white/10">
                                <button
                                    type="button"
                                    aria-label={`Remove one ${v.name}`}
                                    disabled={qty === 0}
                                    onClick={() => setQty(v.id, qty - 1)}
                                    className="flex h-10 w-10 items-center justify-center bg-gray-50 text-lg font-semibold text-gray-700 hover:bg-gray-100 active:bg-gray-200 disabled:opacity-40 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
                                >−</button>
                                <div className={`flex h-10 w-8 items-center justify-center text-sm font-bold tabular-nums ${qty > 0 ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300" : "text-gray-400"}`}>{qty}</div>
                                <button
                                    type="button"
                                    aria-label={`Add one ${v.name}`}
                                    onClick={() => setQty(v.id, qty + 1)}
                                    className="flex h-10 w-10 items-center justify-center bg-indigo-600 text-lg font-semibold text-white hover:bg-indigo-700 active:bg-indigo-800"
                                >+</button>
                            </div>
                        </div>
                    );
                })}
            </div>
            {hiddenCount > 0 && (
                <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setExpanded(e => !e)}
                    className="flex h-11 w-full items-center justify-center gap-1 border-t border-gray-100 bg-gray-50 text-xs font-semibold text-indigo-700 hover:bg-gray-100 dark:border-white/[0.06] dark:bg-white/5 dark:text-indigo-300 dark:hover:bg-white/10"
                >
                    {expanded
                        ? "Show fewer options ▴"
                        : `+${hiddenCount} more option${hiddenCount === 1 ? "" : "s"}${hiddenPicked > 0 ? ` · ${hiddenPicked} picked` : ""} ▾`}
                </button>
            )}
        </div>
    );
}
