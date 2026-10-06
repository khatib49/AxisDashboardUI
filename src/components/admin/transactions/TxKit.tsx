// TxKit — presentational pieces shared by the admin transaction pages
// (Item Transactions, Game Transactions): status pill, invoice cell,
// detail field, item-lines table, pager and a light/dark dialog shell.
// No data fetching here — the pages own all state and API calls.

import { useId, type ReactNode } from "react";
import { Button } from "antd";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import { Pill } from "../../ui/PageKit";
import { getStatusName } from "../../../services/statuses";

/** Shape of the error the axios client throws (used to read the API message). */
export type ApiError = {
    message?: string;
    response?: { data?: { message?: string; error?: string } };
};

/** Shared Tailwind classes. */
export const TX_TH = "px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400";
export const TX_INPUT =
    "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-100 dark:placeholder:text-gray-500";
export const TX_LABEL = "mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300";

/** Status pill with a dot — the label is always the status name, never colour alone. */
export function TxStatusPill({ statusId }: { statusId: number }) {
    // 1 Enabled · 5 Processed and valid · 6 Processed and Paid → done
    // 7 Processed and Unpaid (open invoice) → amber · 4 On-Going → blue
    // 2 Disabled · 3 Deleted → cancelled-style red
    const tone =
        statusId === 1 || statusId === 5 || statusId === 6 ? "emerald"
            : statusId === 7 ? "amber"
                : statusId === 4 ? "blue"
                    : statusId === 2 || statusId === 3 ? "red"
                        : "gray";
    return <Pill tone={tone} dot>{getStatusName(statusId) || statusId}</Pill>;
}

/** Invoice number with the date / time stacked under it. */
export function InvoiceCell({ id, createdOn }: { id?: number; createdOn: string }) {
    const d = new Date(createdOn);
    return (
        <div className="whitespace-nowrap">
            <div className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">#{id}</div>
            <div className="mt-0.5 text-xs tabular-nums text-gray-500 dark:text-gray-400">
                {d.toLocaleDateString()}
                <span className="text-gray-400 dark:text-gray-500"> · {d.toLocaleTimeString()}</span>
            </div>
        </div>
    );
}

/** Label + value block used in the expanded detail row. */
export function DetailField({ label, children, className = "" }: { label: ReactNode; children: ReactNode; className?: string }) {
    return (
        <div className={`min-w-0 ${className}`}>
            <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
            <div className="mt-0.5 break-words text-sm text-gray-900 dark:text-gray-100">{children}</div>
        </div>
    );
}

export type TxLine = {
    itemName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    categoryName?: string;
    imagePath?: string | null;
};

/** "Items Detail" table: image, name, category, unit price × qty, line total. */
export function ItemLinesTable({ items }: { items: TxLine[] }) {
    return (
        <div className="relative overflow-x-auto rounded-xl border border-gray-200/80 bg-white dark:border-white/[0.06] dark:bg-transparent">
            <table className="w-full min-w-[520px] text-sm">
                <thead>
                    <tr className="border-b border-gray-100 text-[11px] uppercase tracking-wide text-gray-500 dark:border-white/[0.06] dark:text-gray-400">
                        <th className="px-4 py-2 text-left font-semibold">Item</th>
                        <th className="px-4 py-2 text-left font-semibold">Category</th>
                        <th className="px-4 py-2 text-right font-semibold">Unit Price</th>
                        <th className="px-4 py-2 text-center font-semibold">Qty</th>
                        <th className="px-4 py-2 text-right font-semibold">Line Total</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/[0.06]">
                    {items.map((item, idx) => (
                        <tr key={idx}>
                            <td className="px-4 py-2">
                                <div className="flex items-center gap-2.5">
                                    {item.imagePath && (
                                        <img
                                            src={`${import.meta.env.VITE_API_IMAGE_BASE_URL || ''}/${item.imagePath}`}
                                            alt={item.itemName}
                                            className="h-9 w-9 shrink-0 rounded-md object-cover"
                                            onError={(e) => {
                                                e.currentTarget.src = '/images/image-placeholder.svg';
                                            }}
                                        />
                                    )}
                                    <span className="font-medium text-gray-800 dark:text-gray-200">{item.itemName}</span>
                                </div>
                            </td>
                            <td className="px-4 py-2">
                                {item.categoryName
                                    ? <Pill tone="gray">{item.categoryName}</Pill>
                                    : <span className="text-gray-400 dark:text-gray-500">—</span>}
                            </td>
                            <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums text-gray-600 dark:text-gray-400">
                                ${item.unitPrice.toFixed(2)}
                            </td>
                            <td className="px-4 py-2 text-center font-semibold tabular-nums text-violet-600 dark:text-violet-300">
                                ×{item.quantity}
                            </td>
                            <td className="whitespace-nowrap px-4 py-2 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                                ${item.lineTotal.toFixed(2)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/** "Showing page X of Y — N items" + Prev / Next. */
export function TxPager({ page, totalPages, total, onPrev, onNext }: {
    page: number; totalPages: number; total: number; onPrev: () => void; onNext: () => void;
}) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-3 dark:border-white/[0.06]">
            <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
                Showing page {page} of {totalPages} — {total} items
            </span>
            <div className="flex gap-1.5">
                <Button size="small" icon={<LeftOutlined />} disabled={page <= 1} onClick={onPrev}>Prev</Button>
                <Button size="small" disabled={page >= totalPages} onClick={onNext}>Next <RightOutlined /></Button>
            </div>
        </div>
    );
}

/** Inline error box used inside the dialogs. */
export function TxError({ children }: { children: ReactNode }) {
    return (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
            {children}
        </div>
    );
}

/**
 * Dialog shell: backdrop click closes unless `busy`; the panel itself stops
 * propagation. Header (title + optional subtitle), scrollable body, footer.
 */
export function TxDialog({ title, subtitle, busy, onClose, footer, children, size = "md" }: {
    title: ReactNode;
    subtitle?: ReactNode;
    busy?: boolean;
    onClose: () => void;
    footer: ReactNode;
    children: ReactNode;
    size?: "md" | "lg";
}) {
    const titleId = useId();
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[1px]" onClick={() => !busy && onClose()}>
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className={`flex max-h-[85vh] w-full flex-col overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-xl dark:border-white/[0.08] dark:bg-gray-900 ${size === "lg" ? "max-w-lg" : "max-w-md"}`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="border-b border-gray-100 px-5 py-4 dark:border-white/[0.06]">
                    <h3 id={titleId} className="text-[15px] font-semibold text-gray-900 dark:text-white">{title}</h3>
                    {subtitle && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>}
                </div>
                <div className="space-y-4 overflow-y-auto p-5">{children}</div>
                <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-3 dark:border-white/[0.06]">{footer}</div>
            </div>
        </div>
    );
}
