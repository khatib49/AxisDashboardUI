// Display-only helpers for the Open Invoices till screen. Nothing here
// talks to the API or changes any figure the server computed.

import { useEffect, useState, useSyncExternalStore } from 'react';
import type { OpenInvoiceDto } from '../../../services/transactionService';

/** "$12.50" — every money figure on the screen goes through this. */
export const money = (n: number) => `$${(n ?? 0).toFixed(2)}`;

/** Minutes since the invoice was opened, or null when the timestamp is unusable. */
export function ageMinutes(createdOn: string, now: number): number | null {
    const t = new Date(createdOn).getTime();
    if (!Number.isFinite(t)) return null;
    return Math.max(0, Math.floor((now - t) / 60000));
}

/** "just now" / "42 min" / "2 h 05 min" / "3 d". */
export function formatAge(mins: number | null): string {
    if (mins === null) return '';
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min`;
    if (mins < 60 * 24) {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return m ? `${h} h ${String(m).padStart(2, '0')} min` : `${h} h`;
    }
    return `${Math.floor(mins / (60 * 24))} d`;
}

/** Urgency tone for the age pill — the text is always shown alongside. */
export function ageTone(mins: number | null): 'gray' | 'emerald' | 'amber' | 'red' {
    if (mins === null) return 'gray';
    if (mins < 30) return 'emerald';
    if (mins < 90) return 'amber';
    return 'red';
}

/** Total quantity of items on the invoice. */
export const itemQty = (inv: OpenInvoiceDto) =>
    (inv.items ?? []).reduce((s, it) => s + (it.quantity || 0), 0);

/**
 * Pre-discount subtotal, computed exactly like the printed receipt
 * (ItemInvoice) does: lines + add-ons + variant deltas. Display only —
 * the payable total is always the server's `totalPrice`.
 */
export function itemsSubtotal(inv: OpenInvoiceDto): number {
    return (inv.items ?? []).reduce(
        (sum, it) => sum + it.price * it.quantity
            + (it.addOns ?? []).reduce((a, x) => a + x.lineTotal, 0)
            + (it.variants ?? []).reduce((a, x) => a + x.priceDelta * x.quantity, 0),
        0,
    );
}

/** Wall clock that re-renders its owner every `intervalMs` (age labels only). */
export function useNow(intervalMs = 30000): number {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), intervalMs);
        return () => clearInterval(id);
    }, [intervalMs]);
    return now;
}

const DESKTOP_QUERY = '(min-width: 1024px)';

/** True at Tailwind's `lg` breakpoint and up (side-by-side list + detail). */
export function useIsDesktop(): boolean {
    return useSyncExternalStore(
        (cb) => {
            if (typeof window === 'undefined' || !window.matchMedia) return () => {};
            const mq = window.matchMedia(DESKTOP_QUERY);
            mq.addEventListener('change', cb);
            return () => mq.removeEventListener('change', cb);
        },
        () => (typeof window !== 'undefined' && !!window.matchMedia ? window.matchMedia(DESKTOP_QUERY).matches : true),
        () => true,
    );
}
