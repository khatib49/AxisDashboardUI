// ItemVariantPicker
// =================
// For items with colour / type options: one −/qty/+ row per option, with
// its own stock badge and price delta. The item's line quantity is the sum
// of the picks — the caller keeps that in sync via onChange.

import type { ItemVariantDto } from "../../services/itemService";

export type VariantPicks = Record<number, number>;

export const variantPickTotal = (picks: VariantPicks | undefined) =>
    Object.values(picks ?? {}).reduce((a, b) => a + b, 0);

export const variantDeltaTotal = (variants: ItemVariantDto[] | null | undefined, picks: VariantPicks | undefined) =>
    Object.entries(picks ?? {}).reduce((sum, [id, qty]) => {
        const def = variants?.find(v => v.id === Number(id));
        return def ? sum + def.priceDelta * qty : sum;
    }, 0);

export default function ItemVariantPicker({
    variants, picks, onChange, dense = false,
}: {
    variants: ItemVariantDto[];
    picks: VariantPicks;
    onChange: (next: VariantPicks) => void;
    dense?: boolean;
}) {
    const active = variants.filter(v => v.isActive !== false);
    const setQty = (id: number, next: number) => {
        const copy: VariantPicks = { ...picks };
        if (next <= 0) delete copy[id]; else copy[id] = next;
        onChange(copy);
    };
    return (
        <div className={`mt-2 rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden ${dense ? "text-xs" : "text-sm"}`}>
            {active.map(v => {
                const qty = picks[v.id] ?? 0;
                const out = v.quantity <= 0;
                return (
                    <div key={v.id} className={`flex items-center justify-between px-2 py-1.5 ${qty > 0 ? "bg-indigo-50/60" : "bg-white"}`}>
                        <div className="flex items-center gap-2 min-w-0">
                            {v.color && /^#[0-9a-fA-F]{6}$/.test(v.color) ? (
                                <span className="h-3.5 w-3.5 rounded-full border border-black/10 shrink-0" style={{ background: v.color }} />
                            ) : null}
                            <div className="min-w-0">
                                <div className={`font-medium truncate ${qty > 0 ? "text-indigo-800" : "text-gray-800"}`}>
                                    {v.name}
                                    {v.priceDelta !== 0 && <span className="text-gray-400 font-normal"> {v.priceDelta > 0 ? "+" : "−"}${Math.abs(v.priceDelta).toFixed(2)}</span>}
                                </div>
                                <div className={`text-[10px] ${out ? "text-red-500" : v.quantity <= 5 ? "text-amber-600" : "text-gray-400"}`}>
                                    {out ? `out of stock (${v.quantity})` : `${v.quantity} in stock`}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center rounded-md border border-gray-200 overflow-hidden shrink-0">
                            <button type="button" disabled={qty === 0} onClick={() => setQty(v.id, qty - 1)}
                                className="h-7 w-7 bg-gray-50 text-gray-600 hover:bg-gray-100 disabled:opacity-40">−</button>
                            <div className={`h-7 w-7 flex items-center justify-center text-xs font-bold ${qty > 0 ? "text-indigo-700 bg-indigo-50" : "text-gray-400"}`}>{qty}</div>
                            <button type="button" onClick={() => setQty(v.id, qty + 1)}
                                className="h-7 w-7 bg-indigo-600 text-white hover:bg-indigo-700">+</button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
