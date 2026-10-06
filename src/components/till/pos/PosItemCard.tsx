// PosItemCard — the touch card on the till item grid: image (or the
// placeholder), name, category, price, stock state as a text pill, and a
// slot for the quantity controls / options / add-ons the page provides.

import type { ComponentProps, ReactNode } from "react";
import { Pill } from "../../ui/PageKit";

type PillTone = NonNullable<ComponentProps<typeof Pill>["tone"]>;

const PLACEHOLDER = "/images/image-placeholder.svg";

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
    stock: { label: string; tone: PillTone };
    children: ReactNode;
}) {
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

            <div className="relative h-28 shrink-0 bg-gray-50 sm:h-32 dark:bg-white/5">
                <img
                    src={imageSrc || PLACEHOLDER}
                    alt={name}
                    className="h-full w-full object-cover"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = PLACEHOLDER; }}
                />
            </div>

            <div className="flex flex-1 flex-col p-3">
                <div className="min-h-[2.5rem] text-[15px] font-semibold leading-snug text-gray-900 line-clamp-2 dark:text-white" title={name}>
                    {name}
                </div>
                <div className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">{categoryName}</div>

                <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                    <span className="text-xl font-bold tabular-nums tracking-tight text-gray-900 dark:text-white">{priceLabel}</span>
                    <Pill tone={stock.tone} dot>{stock.label}</Pill>
                </div>

                <div className="mt-auto pt-3">{children}</div>
            </div>
        </div>
    );
}
