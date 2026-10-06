// One revenue stream (TCG & Retail / Food & Beverage): a card with a thin
// accent bar in the stream's colour and its metrics as small stat cells.

import type { ReactNode } from "react";
import { Pill } from "../../ui/PageKit";

export default function StreamPanel({
    title, icon, badge, color, cells,
}: {
    title: string;
    icon: ReactNode;
    badge: string;
    color: string;
    cells: Array<{ label: string; value: ReactNode }>;
}) {
    return (
        <section className="min-w-0 overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:border-white/[0.06] dark:bg-white/[0.03]">
            <div className="h-1" style={{ background: color }} aria-hidden />
            <header className="flex flex-wrap items-center gap-3 px-5 pb-3 pt-4">
                <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base"
                    style={{ background: `${color}1f`, color }}
                    aria-hidden
                >
                    {icon}
                </span>
                <h2 className="text-[15px] font-semibold text-gray-900 dark:text-white">{title}</h2>
                <span className="ml-auto"><Pill>{badge}</Pill></span>
            </header>
            <div className="grid grid-cols-2 gap-2 px-5 pb-5 sm:grid-cols-3">
                {cells.map((c) => (
                    <div key={c.label} className="min-w-0 rounded-xl bg-gray-50 px-3 py-2.5 dark:bg-white/[0.04]">
                        <div className="text-[11px] font-medium text-gray-500 dark:text-gray-400">{c.label}</div>
                        <div className="mt-0.5 truncate text-base font-semibold tabular-nums text-gray-900 dark:text-white">{c.value}</div>
                    </div>
                ))}
            </div>
        </section>
    );
}
