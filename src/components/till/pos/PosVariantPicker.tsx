// PosVariantPicker — how a till card sells an item that has options
// (colours / sizes, each with its own stock). Same contract and pick logic
// as components/items/ItemVariantPicker (shared with Open Invoices, left
// untouched): picks are { variantId: qty } and the caller keeps the item's
// line quantity equal to their sum via onChange.
//
// Layout (UX): the card never lists the options itself, so every card in
// the grid keeps the same compact footer whatever the option count.
//  • one option  → a normal −/qty/+ stepper bound to that option
//  • two or more → a "Choose option" button + chips of what's picked; the
//    options open in a sheet (bottom sheet on phones, dialog on desktop)
//    as a grid of big tap tiles: tap a tile = +1, − on the tile = −1.

import { useState } from "react";
import { createPortal } from "react-dom";
import type { ItemVariantDto } from "../../../services/itemService";
import Modal from "../../ui/Modal";
import QtyStepper from "./QtyStepper";

type VariantPicks = Record<number, number>;

/** Options above this count get a search box in the sheet. */
const SEARCH_FROM = 9;
/** Picked-option chips shown on the card before "+N more". */
const CARD_CHIPS = 2;

const isHex = (c?: string | null) => !!c && /^#[0-9a-fA-F]{6}$/.test(c);

const stockText = (q: number) => (q <= 0 ? `Out of stock (${q})` : `${q} in stock`);
const stockTone = (q: number) =>
    q <= 0 ? "font-medium text-red-600 dark:text-red-400"
    : q <= 5 ? "text-amber-600 dark:text-amber-400"
    : "text-gray-500 dark:text-gray-400";

const deltaText = (d: number) => (d === 0 ? "" : `${d > 0 ? "+" : "−"}$${Math.abs(d).toFixed(2)}`);

function Swatch({ color }: { color?: string | null }) {
    return isHex(color)
        ? <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-black/10 dark:border-white/20" style={{ background: color! }} aria-hidden />
        : null;
}

export default function PosVariantPicker({
    variants,
    picks,
    onChange,
    itemName = "Options",
}: {
    variants: ItemVariantDto[];
    picks: VariantPicks;
    onChange: (next: VariantPicks) => void;
    /** Shown as the sheet title and in the buttons' accessible labels. */
    itemName?: string;
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const active = variants.filter(v => v.isActive !== false);
    // Identical to ItemVariantPicker's setQty.
    const setQty = (id: number, next: number) => {
        const copy: VariantPicks = { ...picks };
        if (next <= 0) delete copy[id]; else copy[id] = next;
        onChange(copy);
    };

    if (active.length === 0) return null;

    // ── One option: no choice to make, sell it like a plain item. ──
    if (active.length === 1) {
        const v = active[0];
        const qty = picks[v.id] ?? 0;
        return (
            <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs">
                    <Swatch color={v.color} />
                    <span className="min-w-0 truncate font-semibold text-gray-800 dark:text-gray-100" title={v.name}>{v.name}</span>
                    {v.priceDelta !== 0 && <span className="shrink-0 text-gray-400">{deltaText(v.priceDelta)}</span>}
                    <span className={`ml-auto shrink-0 ${stockTone(v.quantity)}`}>{stockText(v.quantity)}</span>
                </div>
                <QtyStepper
                    fluid
                    label={`${itemName} – ${v.name}`}
                    value={qty}
                    decDisabled={qty === 0}
                    onDec={() => setQty(v.id, qty - 1)}
                    onInc={() => setQty(v.id, qty + 1)}
                />
            </div>
        );
    }

    // ── Two or more options: button on the card, choices in a sheet. ──
    const pickedList = active.filter(v => (picks[v.id] ?? 0) > 0);
    const pickedTotal = pickedList.reduce((s, v) => s + (picks[v.id] ?? 0), 0);
    const inStock = active.filter(v => v.quantity > 0).length;

    const q = query.trim().toLowerCase();
    const shown = q ? active.filter(v => v.name.toLowerCase().includes(q)) : active;
    const close = () => { setOpen(false); setQuery(""); };

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                aria-haspopup="dialog"
                className={`flex h-11 w-full items-center justify-between gap-2 rounded-xl border px-3 text-sm font-semibold transition ${
                    pickedTotal > 0
                        ? "border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-400/40 dark:bg-indigo-500/15 dark:text-indigo-200"
                        : "border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800"
                }`}
            >
                <span className="truncate">{pickedTotal > 0 ? "Edit options" : "Choose option"}</span>
                <span className={`shrink-0 text-xs font-medium ${pickedTotal > 0 ? "text-indigo-600 dark:text-indigo-300" : "text-white/80"}`}>
                    {active.length} options ›
                </span>
            </button>

            {pickedList.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                    {pickedList.slice(0, CARD_CHIPS).map(v => (
                        <span key={v.id} className="inline-flex max-w-full items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                            <Swatch color={v.color} />
                            <span className="truncate">{v.name}</span>
                            <span className="shrink-0 font-bold tabular-nums">×{picks[v.id]}</span>
                        </span>
                    ))}
                    {pickedList.length > CARD_CHIPS && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-white/5 dark:text-gray-300">
                            +{pickedList.length - CARD_CHIPS} more
                        </span>
                    )}
                </div>
            ) : (
                <div className="text-[11px] text-gray-500 dark:text-gray-400">
                    {inStock === active.length ? "All options in stock" : `${inStock} of ${active.length} options in stock`}
                </div>
            )}

            {/* Portal: the card clips overflow, the sheet must cover the page. */}
            {open && createPortal(<Modal
                isOpen={open}
                onClose={close}
                title={itemName}
                subtitle={`Tap an option to add it · ${active.length} options`}
                footer={
                    <div className="flex w-full flex-wrap items-center gap-2">
                        <span className="mr-auto text-sm text-gray-600 tabular-nums dark:text-gray-300">
                            {pickedTotal > 0 ? <><b className="text-gray-900 dark:text-white">{pickedTotal}</b> picked</> : "Nothing picked yet"}
                        </span>
                        {pickedTotal > 0 && (
                            <button type="button" onClick={() => onChange({})} className="h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10">
                                Clear
                            </button>
                        )}
                        <button type="button" onClick={close} className="h-11 min-w-[7.5rem] flex-1 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700 sm:flex-none">
                            Done
                        </button>
                    </div>
                }
            >
                {active.length >= SEARCH_FROM && (
                    <input
                        type="search"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Search options…"
                        aria-label="Search options"
                        className="mb-3 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
                    />
                )}
                {shown.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-200 px-4 py-10 text-center text-sm text-gray-500 dark:border-white/10 dark:text-gray-400">
                        No option matches “{query}”.
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                        {shown.map(v => {
                            const qty = picks[v.id] ?? 0;
                            return (
                                <div
                                    key={v.id}
                                    className={`relative flex flex-col overflow-hidden rounded-xl border transition ${
                                        qty > 0
                                            ? "border-indigo-400 bg-indigo-50/70 ring-2 ring-indigo-200 dark:border-indigo-400/60 dark:bg-indigo-500/10 dark:ring-indigo-500/20"
                                            : v.quantity <= 0
                                                ? "border-red-200 bg-white dark:border-red-500/30 dark:bg-white/[0.03]"
                                                : "border-gray-200 bg-white hover:border-indigo-300 dark:border-white/10 dark:bg-white/[0.03]"
                                    }`}
                                >
                                    {/* The whole tile adds one — the biggest possible target. */}
                                    <button
                                        type="button"
                                        onClick={() => setQty(v.id, qty + 1)}
                                        aria-label={`Add one ${v.name}`}
                                        className="flex min-h-[76px] flex-1 flex-col items-start gap-1 p-3 text-left active:bg-indigo-100/60 dark:active:bg-indigo-500/20"
                                    >
                                        <span className="flex w-full items-start gap-2 pr-7">
                                            <Swatch color={v.color} />
                                            <span className="line-clamp-2 text-sm font-semibold leading-snug text-gray-900 dark:text-white">{v.name}</span>
                                        </span>
                                        <span className="flex w-full flex-wrap items-center gap-x-2 text-[11px]">
                                            <span className={stockTone(v.quantity)}>{stockText(v.quantity)}</span>
                                            {v.priceDelta !== 0 && <span className="text-gray-500 dark:text-gray-400">{deltaText(v.priceDelta)}</span>}
                                        </span>
                                    </button>
                                    {qty > 0 && (
                                        <>
                                            <span className="pointer-events-none absolute right-2 top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-xs font-bold tabular-nums text-white">
                                                {qty}
                                            </span>
                                            <div className="flex border-t border-indigo-200 dark:border-indigo-400/30">
                                                <button
                                                    type="button"
                                                    onClick={() => setQty(v.id, qty - 1)}
                                                    aria-label={`Remove one ${v.name}`}
                                                    className="flex h-10 flex-1 items-center justify-center text-lg font-semibold text-indigo-700 hover:bg-indigo-100 dark:text-indigo-200 dark:hover:bg-indigo-500/20"
                                                >−</button>
                                                <span className="flex h-10 w-10 items-center justify-center border-x border-indigo-200 text-sm font-bold tabular-nums text-indigo-800 dark:border-indigo-400/30 dark:text-indigo-100">{qty}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setQty(v.id, qty + 1)}
                                                    aria-label={`Add one ${v.name}`}
                                                    className="flex h-10 flex-1 items-center justify-center bg-indigo-600 text-lg font-semibold text-white hover:bg-indigo-700"
                                                >+</button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </Modal>, document.body)}
        </>
    );
}
