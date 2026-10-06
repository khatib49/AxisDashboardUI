// PosItemCard — the touch card on the till item grid: fixed-height image
// (or a neutral placeholder) with the stock state overlaid as text, name,
// category, price, and a slot for the quantity controls / options / add-ons
// the page provides.

import { useState, type ReactNode } from "react";

export type PosStockTone = "red" | "blue" | "amber" | "neutral";

const STOCK_BADGE: Record<PosStockTone, string> = {
    red: "bg-red-600 text-white",
    blue: "bg-teal-600/95 text-white",
    amber: "bg-amber-500 text-white",
    neutral: "bg-black/60 text-white",
};

export default function PosItemCard({
    name,
    imageSrc,
    categoryName,
    priceLabel,
    picked,
    outOfStock,
    stock,
    children,
}: {
    name: string;
    /** Resolved image URL, or empty for the placeholder. */
    imageSrc: string;
    categoryName: string;
    priceLabel: string;
    picked: number;
    outOfStock: boolean;
    stock: { label: string; tone: PosStockTone };
    children: ReactNode;
}) {
    // A missing or broken image shows the same neutral placeholder.
    const [failedSrc, setFailedSrc] = useState<string | null>(null);
    const showImage = !!imageSrc && failedSrc !== imageSrc;

    return (
        <div
            className={`relative flex flex-col overflow-hidden rounded-2xl border bg-white transition-shadow dark:bg-white/[0.03] ${
                picked > 0
                    ? "border-indigo-400 shadow-md ring-2 ring-indigo-200 dark:border-indigo-400/70 dark:ring-indigo-500/25"
                    : outOfStock
                        ? "border-red-200 shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:border-red-500/30"
                        : "border-gray-200/80 shadow-[0_1px_2px_rgba(16,24,40,0.04)] hover:shadow-md dark:border-white/[0.06]"
            }`}
        >
            {/* Picked-count bubble */}
            {picked > 0 && (
                <span className="absolute right-2 top-2 z-10 flex h-8 min-w-8 items-center justify-center rounded-full bg-indigo-600 px-2 text-sm font-bold tabular-nums text-white shadow-lg">
                    {picked}
                </span>
            )}

            <div className="relative h-28 shrink-0 overflow-hidden bg-gray-100 sm:h-32 dark:bg-white/5">
                {showImage ? (
                    <img
                        src={imageSrc}
                        alt={name}
                        loading="lazy"
                        className="h-full w-full object-cover"
                        onError={() => setFailedSrc(imageSrc)}
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-gray-300 dark:text-gray-600" role="img" aria-label={name}>
                        <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                )}
                {/* Stock state, on the image where the eye lands first */}
                <span className={`absolute bottom-2 left-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold shadow-sm ${STOCK_BADGE[stock.tone]}`}>
                    <span className="h-1.5 w-1.5 rounded-full bg-white/90" aria-hidden />
                    {stock.label}
                </span>
            </div>

            <div className="flex flex-1 flex-col p-3">
                <div className="min-h-[2.5rem] text-[15px] font-semibold leading-snug text-gray-900 line-clamp-2 dark:text-white" title={name}>
                    {name}
                </div>
                <div className="mt-0.5 flex items-end justify-between gap-2">
                    <span className="min-w-0 truncate text-xs text-gray-500 dark:text-gray-400">{categoryName}</span>
                    <span className="shrink-0 text-xl font-bold leading-none tabular-nums tracking-tight text-gray-900 dark:text-white">{priceLabel}</span>
                </div>

                <div className="mt-3 space-y-2">{children}</div>
            </div>
        </div>
    );
}
