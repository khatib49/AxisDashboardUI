// DeskKit — compact layout pieces for the till "desk" screens (Orders,
// Online Orders, AXIS PLUS Check, Events). Same visual language as PageKit
// (rounded-2xl, gray-200/80 borders, light + dark) but with a slim header so
// tablets keep their vertical space, and touch-sized tiles.

import type { ReactNode } from "react";
import { Skeleton } from "antd";
import { Pill } from "../../ui/PageKit";

type Tone = "violet" | "blue" | "emerald" | "sky" | "amber";

const ICON_TONE: Record<Tone, string> = {
    violet: "bg-violet-600 shadow-violet-600/25",
    blue: "bg-blue-600 shadow-blue-600/25",
    emerald: "bg-emerald-600 shadow-emerald-600/25",
    sky: "bg-sky-600 shadow-sky-600/25",
    amber: "bg-amber-500 shadow-amber-500/25",
};

/** Slim page header: icon, title, optional badge + one-line description, actions on the right. */
export function DeskHeader({ icon, title, badge, description, actions, tone = "violet", children }: {
    icon: ReactNode;
    title: ReactNode;
    badge?: ReactNode;
    description?: ReactNode;
    actions?: ReactNode;
    tone?: Tone;
    children?: ReactNode;
}) {
    return (
        <header className="rounded-2xl border border-gray-200/80 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:px-5 dark:border-white/[0.06] dark:bg-white/[0.03]">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg text-white shadow-lg ${ICON_TONE[tone]}`}>{icon}</span>
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="text-xl font-semibold tracking-tight text-gray-900 sm:text-2xl dark:text-white">{title}</h1>
                            {badge}
                        </div>
                        {description && <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{description}</p>}
                    </div>
                </div>
                {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
            </div>
            {children && <div className="mt-3">{children}</div>}
        </header>
    );
}

/** Section heading with a count pill. */
export function DeskSection({ title, count, tone = "gray", children, className = "" }: {
    title: ReactNode;
    count?: number;
    tone?: "gray" | "violet" | "blue" | "emerald" | "amber" | "red";
    children: ReactNode;
    className?: string;
}) {
    return (
        <section className={className}>
            <div className="mb-2.5 flex items-center gap-2">
                <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{title}</h2>
                {count != null && <Pill tone={tone}>{count}</Pill>}
            </div>
            {children}
        </section>
    );
}

/** Dashed empty-state block. */
export function DeskEmpty({ icon, title, hint, compact }: { icon?: ReactNode; title: ReactNode; hint?: ReactNode; compact?: boolean }) {
    return (
        <div className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white/50 px-4 text-center dark:border-white/10 dark:bg-white/[0.02] ${compact ? "py-6" : "py-14"}`}>
            {icon && <span className="mb-2 text-2xl text-gray-300 dark:text-gray-600">{icon}</span>}
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
            {hint && <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{hint}</p>}
        </div>
    );
}

const COUNT_TONE = {
    gray: "bg-gray-50 text-gray-800 ring-gray-200/70 dark:bg-white/[0.04] dark:text-gray-100 dark:ring-white/10",
    blue: "bg-blue-50 text-blue-800 ring-blue-200/70 dark:bg-blue-500/10 dark:text-blue-200 dark:ring-blue-500/20",
    violet: "bg-violet-50 text-violet-800 ring-violet-200/70 dark:bg-violet-500/10 dark:text-violet-200 dark:ring-violet-500/20",
    emerald: "bg-emerald-50 text-emerald-800 ring-emerald-200/70 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-500/20",
    amber: "bg-amber-50 text-amber-800 ring-amber-200/70 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/20",
    sky: "bg-sky-50 text-sky-800 ring-sky-200/70 dark:bg-sky-500/10 dark:text-sky-200 dark:ring-sky-500/20",
} as const;

/** Compact counter tile: big number over a small label. */
export function CountTile({ label, value, tone = "gray", highlight, className = "" }: {
    label: ReactNode;
    value: ReactNode;
    tone?: keyof typeof COUNT_TONE;
    /** Draws a stronger ring (e.g. when there are new orders waiting). */
    highlight?: boolean;
    className?: string;
}) {
    return (
        <div className={`rounded-xl px-2 py-2 text-center ring-1 ${COUNT_TONE[tone]} ${highlight ? "ring-2" : ""} ${className}`}>
            <div className="text-xl font-bold leading-tight tabular-nums">{value}</div>
            <div className="text-[10px] font-medium uppercase tracking-wide opacity-80">{label}</div>
        </div>
    );
}

/** Horizontal progress bar with an accessible value. */
export function Meter({ value, max, tone = "violet", label }: { value: number; max: number; tone?: "violet" | "emerald" | "amber" | "red"; label: string }) {
    const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
    const bar = { violet: "bg-violet-500", emerald: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500" }[tone];
    return (
        <div
            role="progressbar"
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={max}
            aria-valuenow={value}
            className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10"
        >
            <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
        </div>
    );
}

/** Skeleton stand-ins for a grid of cards (first load). */
export function CardSkeletons({ count = 4, className = "grid grid-cols-1 gap-3 lg:grid-cols-2", height = 180 }: { count?: number; className?: string; height?: number }) {
    return (
        <div className={className}>
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-gray-200/80 bg-white p-4 dark:border-white/[0.06] dark:bg-white/[0.03]" style={{ minHeight: height }}>
                    <Skeleton active paragraph={{ rows: 3 }} />
                </div>
            ))}
        </div>
    );
}
