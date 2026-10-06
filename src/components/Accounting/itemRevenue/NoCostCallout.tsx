// Sold items with no buy price and no recipe → their COGS is counted as $0,
// so gross profit is overstated. An amber callout listing them; long lists
// collapse to the first few names.

import { useState } from "react";
import { WarningOutlined } from "@ant-design/icons";
import type { ItemRevenueLineDto } from "../../../services/itemRevenueReportService";
import { money } from "./format";

const PREVIEW = 6;

export default function NoCostCallout({ items, revenue }: { items: ItemRevenueLineDto[]; revenue: number }) {
    const [open, setOpen] = useState(false);
    const shown = open ? items : items.slice(0, PREVIEW);
    const hidden = items.length - PREVIEW;

    return (
        <div
            role="status"
            className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 px-5 py-4 text-sm text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200"
        >
            <WarningOutlined className="mt-0.5 text-base text-amber-500 dark:text-amber-400" aria-hidden />
            <div className="min-w-0 flex-1">
                <p>
                    <b>{items.length} sold item{items.length > 1 ? "s" : ""}</b> have no buy price and no recipe, so their COGS is counted as $0
                    {" "}(<span className="tabular-nums">{money(revenue)}</span> of revenue). Set a buy price or a recipe in Inventory to make gross profit exact.
                </p>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    {shown.map((i) => (
                        <span
                            key={`${i.categoryId}-${i.itemId}`}
                            className="max-w-full truncate rounded-md bg-white/80 px-2 py-0.5 text-xs text-amber-800 ring-1 ring-amber-200 dark:bg-white/5 dark:text-amber-200 dark:ring-amber-500/20"
                        >
                            {i.itemName}
                        </span>
                    ))}
                    {hidden > 0 && (
                        <button
                            type="button"
                            aria-expanded={open}
                            onClick={() => setOpen((v) => !v)}
                            className="rounded-md px-2 py-0.5 text-xs font-medium text-amber-800 underline-offset-2 hover:underline dark:text-amber-200"
                        >
                            {open ? "Show fewer" : `+${hidden} more`}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
