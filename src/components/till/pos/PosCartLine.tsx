// PosCartLine — one order line on the till (cart panel and order drawer):
// image, name, qty × unit (+ options), line total, add-on sublines, and an
// optional controls slot (the quantity stepper in the cart).

import type { ReactNode } from "react";

const PLACEHOLDER = "/images/image-placeholder.svg";

export default function PosCartLine({
    name,
    image,
    qty,
    unit,
    lineTotal,
    variantNote,
    addOns,
    controls,
}: {
    name: string;
    image: string;
    qty: number;
    unit: number;
    lineTotal: number;
    variantNote?: string;
    addOns: Array<{ addOnId: number; name: string; qty: number; total: number }>;
    controls?: ReactNode;
}) {
    return (
        <div className="py-3">
            <div className="flex items-start gap-3">
                <img
                    src={image || PLACEHOLDER}
                    alt={name}
                    className="h-12 w-12 shrink-0 rounded-lg object-cover bg-gray-50 dark:bg-white/5"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = PLACEHOLDER; }}
                />
                <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-semibold leading-snug text-gray-900 dark:text-white">{name}</div>
                    <div className="mt-0.5 text-sm text-gray-500 tabular-nums dark:text-gray-400">
                        {qty} × ${unit.toFixed(2)}
                        {variantNote ? <span className="text-indigo-600 dark:text-indigo-300"> · {variantNote}</span> : null}
                    </div>
                </div>
                <div className="shrink-0 text-right text-base font-bold tabular-nums text-gray-900 dark:text-white">${lineTotal.toFixed(2)}</div>
            </div>

            {addOns.length > 0 && (
                <div className="mt-1.5 space-y-0.5 pl-[60px]">
                    {addOns.map((a) => (
                        <div key={a.addOnId} className="flex items-center justify-between gap-2 text-sm text-indigo-700 dark:text-indigo-300">
                            <span className="min-w-0 truncate">+ {a.qty}x {a.name}</span>
                            <span className="shrink-0 tabular-nums">${a.total.toFixed(2)}</span>
                        </div>
                    ))}
                </div>
            )}

            {controls && <div className="mt-2 pl-[60px]">{controls}</div>}
        </div>
    );
}
