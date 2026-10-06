// One open invoice as a touch card: tap the body to open its detail,
// tap Pay to go straight to the payment picker (one tap, like before).

import type { OpenInvoiceDto } from '../../../services/transactionService';
import Loader from '../../ui/Loader';
import { Pill } from '../../ui/PageKit';
import { ageMinutes, ageTone, formatAge, money } from './invoiceUtils';

export default function OpenInvoiceCard({ invoice, now, selected, closing, onSelect, onPay }: {
    invoice: OpenInvoiceDto;
    now: number;
    selected: boolean;
    closing: boolean;
    onSelect: () => void;
    onPay: () => void;
}) {
    const mins = ageMinutes(invoice.createdOn, now);
    const lines = invoice.items?.length || 0;
    const place = [invoice.set, invoice.room].filter(Boolean).join(' · ');

    return (
        <div
            className={`flex h-full flex-col overflow-hidden rounded-2xl border bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-colors dark:bg-white/[0.03] ${
                selected
                    ? 'border-orange-400 ring-2 ring-orange-500/20 dark:border-orange-400/60'
                    : 'border-gray-200/80 hover:border-orange-300 dark:border-white/[0.06] dark:hover:border-orange-400/40'
            }`}
        >
            <button
                type="button"
                onClick={onSelect}
                aria-pressed={selected}
                aria-label={`Invoice #${invoice.id}, ${money(invoice.totalPrice)}`}
                className="flex flex-1 flex-col gap-2 p-4 text-left focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-500/20"
            >
                <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-gray-500 tabular-nums dark:text-gray-400">#{invoice.id}</span>
                    {mins !== null && <Pill tone={ageTone(mins)} dot>{formatAge(mins)}</Pill>}
                </div>

                <div className="min-w-0">
                    <div className={`truncate text-base font-semibold ${place ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
                        {place || 'No table'}
                    </div>
                    <div className={`truncate text-sm ${invoice.userName ? 'text-gray-600 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}`}>
                        {invoice.userName || 'No client'}
                    </div>
                </div>

                <div className="mt-auto flex items-end justify-between gap-2 pt-1">
                    <div className="flex min-w-0 flex-col gap-1">
                        <span className="text-sm text-gray-500 tabular-nums dark:text-gray-400">
                            {lines} {lines === 1 ? 'item' : 'items'}
                        </span>
                        {invoice.discountName && (
                            <span className="max-w-full truncate">
                                <Pill tone="emerald">
                                    {invoice.discountName}{invoice.discountPercentage ? ` ${invoice.discountPercentage}%` : ''}
                                </Pill>
                            </span>
                        )}
                    </div>
                    <span className="text-3xl font-bold leading-none tracking-tight text-gray-900 tabular-nums dark:text-white">
                        {money(invoice.totalPrice)}
                    </span>
                </div>
            </button>

            <div className="border-t border-gray-100 p-3 dark:border-white/[0.06]">
                <button
                    type="button"
                    onClick={onPay}
                    disabled={closing}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {closing ? (
                        <Loader size={14} />
                    ) : (
                        <>
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Pay
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
