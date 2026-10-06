// GameTillKit — touch-first building blocks for the game-cashier till
// screens (Rooms, PS5 / Board Game sessions, Clients). Pure presentation:
// no data fetching, no timers — the pages own all state and logic.

import type { ReactNode } from "react";
import { Skeleton } from "antd";
import { CloseOutlined, SearchOutlined, UserAddOutlined, UserOutlined } from "@ant-design/icons";
import { Pill } from "../../ui/PageKit";
import Loader from "../../ui/Loader";
import type { OpenSessionDto } from "../../../services/transactionService";

type Tone = "violet" | "blue" | "emerald";

const ICON_TONE: Record<Tone, string> = {
    violet: "bg-violet-600 shadow-violet-600/25",
    blue: "bg-blue-600 shadow-blue-600/25",
    emerald: "bg-emerald-600 shadow-emerald-600/25",
};

/** Slim page header for till screens — saves vertical space on tablets. */
export function TillBar({ icon, title, meta, actions, tone = "violet" }: {
    icon: ReactNode; title: ReactNode; meta?: ReactNode; actions?: ReactNode; tone?: Tone;
}) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg text-white shadow-lg ${ICON_TONE[tone]}`}>{icon}</span>
                <div className="min-w-0">
                    <h1 className="truncate text-xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-2xl">{title}</h1>
                    {meta && <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">{meta}</div>}
                </div>
            </div>
            {actions && <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">{actions}</div>}
        </div>
    );
}

/** Large search field with a clear button (≥44px targets). */
export function TillSearch({ value, onChange, onClear, onKeyDown, placeholder, className = "", inputMode, size = "md" }: {
    value: string;
    onChange: (v: string) => void;
    onClear?: () => void;
    onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    placeholder?: string;
    className?: string;
    inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
    size?: "md" | "lg";
}) {
    const h = size === "lg" ? "h-14 text-base" : "h-12 text-sm";
    return (
        <div className={`relative min-w-0 ${className}`}>
            <SearchOutlined className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base text-gray-400 dark:text-gray-500" />
            <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={placeholder}
                inputMode={inputMode}
                className={`w-full rounded-xl border border-gray-200 bg-white pl-11 pr-12 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-violet-400 focus:outline-none focus:ring-4 focus:ring-violet-500/10 dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:placeholder:text-gray-500 ${h}`}
            />
            {value && onClear && (
                <button
                    type="button"
                    onClick={onClear}
                    aria-label="Clear search"
                    className="absolute right-1.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-gray-200"
                >
                    <CloseOutlined />
                </button>
            )}
        </div>
    );
}

const BTN_VARIANT = {
    primary: "bg-violet-600 text-white hover:bg-violet-700 shadow-sm shadow-violet-600/20",
    blue: "bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-600/20",
    emerald: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-600/20",
    danger: "bg-red-600 text-white hover:bg-red-700 shadow-sm shadow-red-600/20",
    neutral: "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-200 dark:hover:bg-white/10",
} as const;

/** Touch button — 44px+ tall, clear disabled state. */
export function TillButton({ children, onClick, disabled, variant = "neutral", size = "md", className = "", title, ariaLabel, type = "button" }: {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: keyof typeof BTN_VARIANT;
    size?: "md" | "lg";
    className?: string;
    title?: string;
    ariaLabel?: string;
    type?: "button" | "submit";
}) {
    const h = size === "lg" ? "h-14 px-5 text-base" : "h-11 px-4 text-sm";
    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            title={title}
            aria-label={ariaLabel}
            className={`inline-flex select-none items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${h} ${BTN_VARIANT[variant]} ${className}`}
        >
            {children}
        </button>
    );
}

/** Floating toast — fixed so it never pushes the grid around. */
export function TillToast({ variant, title, message }: { variant: "success" | "error"; title: string; message: string }) {
    const cls = variant === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-950/90 dark:text-emerald-200"
        : "border-red-200 bg-red-50 text-red-800 dark:border-red-500/20 dark:bg-red-950/90 dark:text-red-200";
    return (
        <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-6 z-50 flex justify-center sm:inset-x-auto sm:right-6">
            <div className={`pointer-events-auto w-full max-w-sm rounded-2xl border p-4 shadow-lg ${cls}`}>
                <p className="font-semibold">{title}</p>
                <p className="mt-0.5 text-sm">{message}</p>
            </div>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/* Open-session cards (PS5 + Board games)                              */
/* ------------------------------------------------------------------ */

/**
 * Status derived only from data the card already has (createdOn + booked
 * hours). Open-hour and day-pass sessions have no end, so they're "In use".
 * Evaluated at render like the existing "Time Running" figure.
 */
function sessionState(session: OpenSessionDto): { label: string; tone: "blue" | "amber" | "red"; left: string | null } {
    if (session.isDayPass || !session.hours) return { label: "In use", tone: "blue", left: null };
    const elapsedMin = Math.floor((new Date().getTime() - new Date(session.createdOn).getTime()) / 60000);
    const leftMin = session.hours * 60 - elapsedMin;
    const fmt = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);
    if (leftMin <= 0) return { label: "Time up", tone: "red", left: `Over by ${fmt(-leftMin)}` };
    if (leftMin <= 10) return { label: "Ending soon", tone: "amber", left: `${fmt(leftMin)} left` };
    return { label: "In use", tone: "blue", left: `${fmt(leftMin)} left` };
}

function InfoCell({ label, children, title }: { label: string; children: ReactNode; title?: string }) {
    return (
        <div className="min-w-0">
            <div className="text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">{label}</div>
            <div className="truncate text-sm font-medium text-gray-900 dark:text-gray-100" title={title}>{children}</div>
        </div>
    );
}

export function SessionCard({ session, fallbackTitle, accent, elapsed, closing, onAttachClient, onClose }: {
    session: OpenSessionDto;
    fallbackTitle: string;
    accent: "blue" | "emerald";
    /** Pre-formatted "Time Running" text computed by the page. */
    elapsed: string;
    closing: boolean;
    onAttachClient: () => void;
    onClose: () => void;
}) {
    const state = sessionState(session);
    const plan = session.isDayPass ? "Day Pass" : (session.hours === 0 ? "Open Hour" : `${session.hours}h`);
    const bar = accent === "blue" ? "bg-blue-500" : "bg-emerald-500";
    const urgentRing = state.tone === "red"
        ? "border-red-300 dark:border-red-500/40"
        : state.tone === "amber"
            ? "border-amber-300 dark:border-amber-500/40"
            : "border-gray-200/80 dark:border-white/[0.06]";
    const timeColor = state.tone === "red"
        ? "text-red-600 dark:text-red-400"
        : state.tone === "amber"
            ? "text-amber-600 dark:text-amber-400"
            : "text-gray-900 dark:text-white";

    return (
        <div className={`relative flex flex-col overflow-hidden rounded-2xl border bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:bg-white/[0.03] ${urgentRing}`}>
            <span className={`absolute inset-x-0 top-0 h-1 ${bar}`} aria-hidden />

            {/* Title + status */}
            <div className="flex items-start justify-between gap-3 px-5 pt-5">
                <div className="min-w-0">
                    <h3 className="truncate text-lg font-semibold text-gray-900 dark:text-white" title={session.game || fallbackTitle}>
                        {session.game || fallbackTitle}
                    </h3>
                    <p className="truncate text-sm text-gray-500 dark:text-gray-400">
                        #{session.id}{session.gameSetting ? ` · ${session.gameSetting}` : ""}
                    </p>
                </div>
                <Pill tone={state.tone} dot>{state.label}</Pill>
            </div>

            {/* Hero: time running */}
            <div className="mt-4 flex items-end justify-between gap-3 px-5">
                <div>
                    <div className="text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">Time running</div>
                    <div className={`text-4xl font-semibold leading-none tracking-tight tabular-nums ${timeColor}`}>{elapsed}</div>
                </div>
                <div className="text-right">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">Duration</div>
                    <div className="text-base font-semibold text-gray-900 tabular-nums dark:text-white">{plan}</div>
                    {state.left && <div className={`text-xs font-medium tabular-nums ${state.tone === "blue" ? "text-gray-500 dark:text-gray-400" : timeColor}`}>{state.left}</div>}
                </div>
            </div>

            {/* Details */}
            <div className="mx-5 mt-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-gray-50 p-3 dark:bg-white/[0.03]">
                <InfoCell label="Room">{session.room || "—"}</InfoCell>
                {session.set ? <InfoCell label="Set">{session.set}</InfoCell> : <InfoCell label="Set">—</InfoCell>}
                <InfoCell label="Persons"><span className="tabular-nums">{session.numberOfPersons || 1}</span></InfoCell>
                <InfoCell label="Started by" title={session.createdBy}>{session.createdBy}</InfoCell>
            </div>

            {/* Client — tap to attach or change */}
            <div className="mt-3 px-5">
                <button
                    type="button"
                    onClick={onAttachClient}
                    title={session.userName ?? "Attach a client"}
                    className={`flex h-11 w-full items-center gap-2 rounded-xl border px-3 text-sm font-medium transition ${
                        session.userName
                            ? "border-gray-200 bg-white text-gray-800 hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-100 dark:hover:bg-white/10"
                            : "border-dashed border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100 dark:border-violet-500/40 dark:bg-violet-500/10 dark:text-violet-300 dark:hover:bg-violet-500/20"
                    }`}
                >
                    {session.userName ? <UserOutlined className="text-gray-400" /> : <UserAddOutlined />}
                    <span className="min-w-0 flex-1 truncate text-left">{session.userName ? session.userName : "+ Add Client"}</span>
                    {session.userName && <span className="text-xs text-gray-400 dark:text-gray-500">Change</span>}
                </button>
            </div>

            {/* Price + close */}
            <div className="mt-auto pt-4">
            <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 px-5 py-4 dark:border-white/[0.06]">
                <div className="min-w-0">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">Price</div>
                    <div className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">${session.totalPrice.toFixed(2)}</div>
                </div>
                <TillButton variant="danger" size="lg" onClick={onClose} disabled={closing} className="ml-auto min-w-[10rem] flex-1">
                    {closing ? (<><Loader size={16} /> Closing...</>) : "Close Session"}
                </TillButton>
            </div>
            </div>
        </div>
    );
}

export function SessionCardSkeleton() {
    return (
        <div className="rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-white/[0.06] dark:bg-white/[0.03]">
            <Skeleton active title={{ width: "60%" }} paragraph={{ rows: 1, width: ["40%"] }} />
            <Skeleton.Input active style={{ marginTop: 12, width: 140, height: 40 }} />
            <Skeleton active title={false} paragraph={{ rows: 3 }} className="mt-4" />
            <Skeleton.Button active block style={{ marginTop: 16, height: 56 }} />
        </div>
    );
}
