// Detail of one open invoice: client / set / discount controls, large line
// items, subtotal-discount-total and the Add / Print / Pay actions.
// Purely presentational — every handler and all state live in the page.

import type { ReactNode } from 'react';
import type { OpenInvoiceDto } from '../../../services/transactionService';
import type { SetDto } from '../../../services/setService';
import type { DiscountDto } from '../../../services/discountService';
import Loader from '../../ui/Loader';
import Select from '../../form/Select';
import { Pill } from '../../ui/PageKit';
import { ageMinutes, ageTone, formatAge, itemsSubtotal, money } from './invoiceUtils';

const PencilIcon = () => (
    <svg className="h-4 w-4 shrink-0 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
);

/** A labelled row whose right side holds a value button or an inline editor. */
function FieldRow({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex min-h-[52px] flex-wrap items-center justify-between gap-x-3 gap-y-2 py-1.5">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</span>
            <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">{children}</div>
        </div>
    );
}

const valueBtn =
    'group inline-flex min-h-[44px] max-w-full items-center gap-2 rounded-xl px-3 text-base font-semibold transition hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-white/5';

export default function InvoiceDetailPanel(props: {
    invoice: OpenInvoiceDto;
    now: number;
    onBack?: () => void;
    // client
    onEditClient: () => void;
    // set / table
    sets: SetDto[];
    editingSet: boolean;
    editSetValue: number | null;
    onStartEditSet: () => void;
    onChangeSetValue: (v: string | number) => void;
    onSaveSet: () => void;
    onCancelSet: () => void;
    // discount
    discounts: DiscountDto[];
    editingDiscount: boolean;
    savingDiscount: boolean;
    onStartEditDiscount: () => void;
    onPickDiscount: (v: string | number) => void;
    onCancelDiscount: () => void;
    // actions
    closing: boolean;
    onAddItems: () => void;
    onPrint: () => void;
    onPay: () => void;
}) {
    const { invoice, now } = props;
    const mins = ageMinutes(invoice.createdOn, now);
    const created = new Date(invoice.createdOn);
    const items = invoice.items ?? [];

    // Mirrors the printed receipt: subtotal + discount lines only when a
    // percentage discount is on the invoice. Total is always the server's.
    const pct = invoice.discountPercentage || 0;
    const showBreakdown = !!invoice.discountId && pct > 0;
    const subtotal = showBreakdown ? itemsSubtotal(invoice) : 0;
    const discountAmount = showBreakdown ? subtotal * (pct > 1 ? pct / 100 : pct) : 0;

    return (
        <section className="flex min-w-0 flex-col rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:border-white/[0.06] dark:bg-white/[0.03]">
            {/* Header */}
            <header className="flex items-start gap-3 border-b border-gray-100 px-4 py-3 dark:border-white/[0.06]">
                {props.onBack && (
                    <button
                        type="button"
                        onClick={props.onBack}
                        aria-label="Close invoice details"
                        className="-ml-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"
                    >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                    </button>
                )}
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-semibold tracking-tight text-gray-900 tabular-nums dark:text-white">
                            Invoice #{invoice.id}
                        </h2>
                        <Pill tone="blue" dot>OPEN</Pill>
                        {mins !== null && <Pill tone={ageTone(mins)} dot>{formatAge(mins)}</Pill>}
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        <span className="tabular-nums">{created.toLocaleDateString()} · {created.toLocaleTimeString()}</span>
                        {' · by '}
                        <span className="font-medium text-gray-700 dark:text-gray-300" title={invoice.createdBy}>{invoice.createdBy}</span>
                    </p>
                </div>
            </header>

            {/* Client / Set / Discount */}
            <div className="divide-y divide-gray-100 px-4 dark:divide-white/[0.06]">
                {/* Client — always visible so a missing one can be attached here. */}
                <FieldRow label="Client">
                    <button
                        type="button"
                        onClick={props.onEditClient}
                        className={`${valueBtn} ${invoice.userName ? 'text-gray-900 dark:text-white' : 'text-blue-600 dark:text-blue-400'}`}
                        title={invoice.userName || 'Attach a client'}
                    >
                        <span className="truncate">{invoice.userName || '+ Add client'}</span>
                        <PencilIcon />
                    </button>
                </FieldRow>

                {invoice.room && (
                    <FieldRow label="Room">
                        <span className="px-3 text-base font-semibold text-gray-900 dark:text-white">{invoice.room}</span>
                    </FieldRow>
                )}

                <FieldRow label="Set/Table">
                    {props.editingSet ? (
                        <>
                            <Select
                                options={[
                                    { value: '', label: 'No Set' },
                                    ...props.sets.map(s => ({ value: s.id, label: s.name })),
                                ]}
                                defaultValue={props.editSetValue ?? ''}
                                onChange={props.onChangeSetValue}
                                className="w-40"
                            />
                            <button
                                type="button"
                                onClick={props.onSaveSet}
                                aria-label="Save set"
                                className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-lg font-semibold text-white hover:bg-emerald-700"
                            >
                                ✓
                            </button>
                            <button
                                type="button"
                                onClick={props.onCancelSet}
                                aria-label="Cancel set change"
                                className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-200 text-lg font-semibold text-gray-700 hover:bg-gray-300 dark:bg-white/10 dark:text-gray-200 dark:hover:bg-white/15"
                            >
                                ✕
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            onClick={props.onStartEditSet}
                            aria-label={`Change set/table (currently ${invoice.set || 'not assigned'})`}
                            className={`${valueBtn} ${invoice.set ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}
                        >
                            <span className="truncate">{invoice.set || 'Not Assigned'}</span>
                            <PencilIcon />
                        </button>
                    )}
                </FieldRow>

                {/* Discount — editable while open; the server recalculates the total. */}
                <FieldRow label="Discount">
                    {props.editingDiscount ? (
                        <>
                            <Select
                                options={[
                                    { value: '', label: 'No discount' },
                                    ...props.discounts.map((d) => ({ value: d.id, label: `${d.name} — ${d.percentage}%` })),
                                ]}
                                defaultValue={invoice.discountId ?? ''}
                                isPlaceHolderDisabled={false}
                                placeholder="No discount"
                                className="w-52"
                                onChange={props.onPickDiscount}
                            />
                            <button
                                type="button"
                                onClick={props.onCancelDiscount}
                                className="min-h-[44px] rounded-xl px-3 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
                            >
                                Cancel
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            onClick={props.onStartEditDiscount}
                            disabled={props.savingDiscount}
                            className={`${valueBtn} ${invoice.discountName ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'}`}
                        >
                            <span className="truncate">
                                {props.savingDiscount
                                    ? 'Saving…'
                                    : invoice.discountName
                                        ? `${invoice.discountName}${invoice.discountPercentage ? ` (${invoice.discountPercentage}%)` : ''}`
                                        : 'Add discount'}
                            </span>
                            <PencilIcon />
                        </button>
                    )}
                </FieldRow>
            </div>

            {/* Line items */}
            <div className="border-t border-gray-100 dark:border-white/[0.06]">
                <div className="flex items-center justify-between px-4 pb-1 pt-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Items in invoice</span>
                    <span className="text-xs text-gray-500 tabular-nums dark:text-gray-400">{items.length}</span>
                </div>
                {items.length === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-500">No items yet</p>
                ) : (
                    <ul className="max-h-[42vh] divide-y divide-gray-100 overflow-y-auto px-4 dark:divide-white/[0.06]">
                        {items.map((item) => (
                            <li key={item.itemId} className="flex gap-3 py-3">
                                <span className="flex h-11 min-w-[44px] shrink-0 items-center justify-center rounded-xl bg-gray-100 px-2 text-lg font-bold text-gray-900 tabular-nums dark:bg-white/10 dark:text-white">
                                    {item.quantity}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-start justify-between gap-3">
                                        <span className="min-w-0 break-words text-base font-medium leading-snug text-gray-900 dark:text-white">
                                            {item.itemName}{item.isIncluded ? ' 🎟' : ''}
                                        </span>
                                        <span className="shrink-0 text-base font-semibold text-gray-900 tabular-nums dark:text-white">
                                            {money(item.price * item.quantity)}
                                        </span>
                                    </div>
                                    <div className="text-sm text-gray-500 tabular-nums dark:text-gray-400">
                                        {item.quantity} × {money(item.price)}
                                    </div>
                                    {(item.variants ?? []).length > 0 && (
                                        <div className="mt-0.5 text-sm text-indigo-600 dark:text-indigo-400">
                                            {(item.variants ?? []).map(v => `${v.quantity}× ${v.name}`).join(', ')}
                                        </div>
                                    )}
                                    {(item.addOns ?? []).map((a) => (
                                        <div key={a.addOnId} className="mt-0.5 flex justify-between gap-3 text-sm text-indigo-600 tabular-nums dark:text-indigo-400">
                                            <span className="min-w-0 truncate">+ {a.quantity}x {a.name}</span>
                                            <span>{money(a.lineTotal)}</span>
                                        </div>
                                    ))}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Totals */}
            <div className="space-y-1.5 border-t border-gray-100 px-4 py-3 dark:border-white/[0.06]">
                {showBreakdown && (
                    <>
                        <div className="flex justify-between text-sm text-gray-600 tabular-nums dark:text-gray-300">
                            <span>Subtotal</span>
                            <span>{money(subtotal)}</span>
                        </div>
                        <div className="flex justify-between gap-3 text-sm text-emerald-600 tabular-nums dark:text-emerald-400">
                            <span className="min-w-0 truncate">Discount ({invoice.discountName} {pct}%)</span>
                            <span>−{money(discountAmount)}</span>
                        </div>
                    </>
                )}
                <div className="flex items-end justify-between pt-1">
                    <span className="text-base font-semibold text-gray-700 dark:text-gray-200">Total</span>
                    <span className="text-4xl font-bold leading-none tracking-tight text-gray-900 tabular-nums dark:text-white">
                        {money(invoice.totalPrice)}
                    </span>
                </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-2 border-t border-gray-100 p-4 dark:border-white/[0.06]">
                <button
                    type="button"
                    onClick={props.onAddItems}
                    className="flex h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 text-base font-semibold text-white shadow-sm transition hover:bg-blue-700"
                >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add
                </button>
                <button
                    type="button"
                    onClick={props.onPrint}
                    className="flex h-12 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white text-base font-semibold text-gray-800 shadow-sm transition hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-100 dark:hover:bg-white/10"
                >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    Print
                </button>
                <button
                    type="button"
                    onClick={props.onPay}
                    disabled={props.closing}
                    className="col-span-2 flex h-14 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-lg font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {props.closing ? (
                        <Loader size={14} />
                    ) : (
                        <>
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Pay <span className="tabular-nums">{money(invoice.totalPrice)}</span>
                        </>
                    )}
                </button>
            </div>
        </section>
    );
}
