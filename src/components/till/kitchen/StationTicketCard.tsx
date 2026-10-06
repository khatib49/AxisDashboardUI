// Station display pieces shared by the Kitchen and Bar order screens
// (/chef/kitchen-display and /bartender/bar-display). Both pages render the
// same KitchenBarOrder shape, so they share one ticket card. Presentation
// only: every handler, label, age text and age colour is passed in by the
// page so the pages keep their own logic (and thresholds) untouched.

import type { ReactNode } from "react";
import { Skeleton } from "antd";
import { CheckOutlined, ClockCircleOutlined, PrinterOutlined, ReloadOutlined } from "@ant-design/icons";

/** Fields of a kitchen/bar order the ticket card reads. */
export interface StationOrder {
  id: number;
  itemName: string;
  quantity: number;
  status: string;
  tableNumber?: string;
  guestName?: string;
  itemComment?: string;
  createdByUsername: string;
}

// Age colour comes from the page's own getTimeBadgeColor ('green' | 'orange' | 'red').
const AGE_TONE: Record<string, { chip: string; ring: string; label: string }> = {
  green: {
    chip: "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-400/30",
    ring: "border-gray-200/80 dark:border-white/10",
    label: "On time",
  },
  orange: {
    chip: "bg-amber-50 text-amber-800 ring-amber-300 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-400/40",
    ring: "border-amber-300 dark:border-amber-400/50",
    label: "Waiting",
  },
  red: {
    chip: "bg-red-600 text-white ring-red-600 dark:bg-red-600 dark:text-white dark:ring-red-500",
    ring: "border-red-400 ring-2 ring-red-500/30 dark:border-red-500/70",
    label: "Late",
  },
};
const AGE_FALLBACK = {
  chip: "bg-gray-100 text-gray-800 ring-gray-200 dark:bg-white/10 dark:text-gray-100 dark:ring-white/10",
  ring: "border-gray-200/80 dark:border-white/10",
  label: "Age",
};

function statusStyle(status: string) {
  if (status === "Pending") return { stripe: "bg-amber-400", chip: "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200", dot: "bg-amber-500" };
  if (status === "Preparing") return { stripe: "bg-blue-500", chip: "bg-blue-50 text-blue-800 dark:bg-blue-500/15 dark:text-blue-200", dot: "bg-blue-500" };
  return { stripe: "bg-gray-300 dark:bg-white/20", chip: "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-200", dot: "bg-gray-400" };
}

/** One order ticket: header (order no., table, age), item with quantity badge, note, actions. */
export function StationTicketCard({
  order, ageText, ageColor, noteLabel, startLabel, doneLabel, onStart, onDone, onPrint,
}: {
  order: StationOrder;
  /** Text from the page's getTimeElapsed (e.g. "12m ago"). */
  ageText: string;
  /** Colour from the page's getTimeBadgeColor. */
  ageColor: string;
  noteLabel: string;
  startLabel: string;
  doneLabel: string;
  onStart: () => void;
  onDone: () => void;
  onPrint: () => void;
}) {
  const age = AGE_TONE[ageColor] ?? AGE_FALLBACK;
  const st = statusStyle(order.status);
  const preparing = order.status === "Preparing";

  return (
    <article
      className={`flex h-full flex-col overflow-hidden rounded-2xl border shadow-[0_1px_2px_rgba(16,24,40,0.04)] ${age.ring} ${
        preparing ? "bg-blue-50/40 dark:bg-blue-500/[0.06]" : "bg-white dark:bg-gray-900"
      }`}
    >
      <div className={`h-1.5 w-full ${st.stripe}`} aria-hidden />

      {/* Header: order number + source on the left, ticket age on the right */}
      <header className="flex items-start justify-between gap-3 px-4 pt-3">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Order</div>
          <div className="text-xl font-bold leading-tight tabular-nums text-gray-900 dark:text-white">#{order.id}</div>
          {order.tableNumber && (
            <div className="mt-1.5 inline-flex max-w-full items-center rounded-lg bg-gray-900 px-2.5 py-1 text-base font-semibold text-white dark:bg-white dark:text-gray-900">
              <span className="truncate">Table: {order.tableNumber}</span>
            </div>
          )}
        </div>
        <div className={`shrink-0 rounded-xl px-3 py-2 text-right ring-1 ${age.chip}`}>
          <div className="flex items-center justify-end gap-1.5 text-[11px] font-semibold uppercase tracking-wider opacity-90">
            <ClockCircleOutlined aria-hidden /> {age.label}
          </div>
          <div className="mt-0.5 whitespace-nowrap text-2xl font-bold leading-none tabular-nums">{ageText}</div>
        </div>
      </header>

      {/* Item */}
      <div className="flex items-start gap-3 px-4 pt-4">
        <span
          className="flex h-16 min-w-16 shrink-0 items-center justify-center rounded-xl bg-gray-900 px-2 text-4xl font-bold tabular-nums text-white dark:bg-white dark:text-gray-900"
          aria-label={`Quantity ${order.quantity}`}
        >
          {order.quantity}
          <span className="ml-0.5 text-xl font-semibold opacity-70">x</span>
        </span>
        <h3 className="min-w-0 break-words pt-1 text-2xl font-bold leading-tight text-gray-900 dark:text-white">
          {order.itemName}
        </h3>
      </div>

      {order.guestName && (
        <div className="px-4 pt-3 text-base text-gray-700 dark:text-gray-200">
          Guest: <span className="font-semibold">{order.guestName}</span>
        </div>
      )}

      {order.itemComment && (
        <div className="mx-4 mt-3 rounded-xl border-2 border-amber-400 bg-amber-50 px-3 py-2.5 dark:border-amber-400/60 dark:bg-amber-500/10">
          <div className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">{noteLabel}:</div>
          <div className="mt-0.5 whitespace-pre-wrap break-words text-lg font-semibold leading-snug text-amber-950 dark:text-amber-50">
            {order.itemComment}
          </div>
        </div>
      )}

      {/* Meta: status + who sent it */}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 px-4 pt-4 text-sm">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold ${st.chip}`}>
          <span className={`h-2 w-2 rounded-full ${st.dot} ${preparing ? "animate-pulse" : ""}`} aria-hidden />
          {order.status}
        </span>
        <span className="truncate text-gray-500 dark:text-gray-400">By: {order.createdByUsername}</span>
      </div>

      {/* Actions — big touch targets */}
      <div className="grid grid-cols-[1fr_auto] gap-2 p-4">
        {order.status === "Pending" ? (
          <button
            type="button"
            onClick={onStart}
            className="h-14 rounded-xl bg-blue-600 px-4 text-lg font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/40"
          >
            {startLabel}
          </button>
        ) : (
          <button
            type="button"
            onClick={onDone}
            className="inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-lg font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/40"
          >
            <CheckOutlined aria-hidden /> {doneLabel}
          </button>
        )}
        <button
          type="button"
          onClick={onPrint}
          className="inline-flex h-14 items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 text-base font-semibold text-gray-800 transition hover:bg-gray-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gray-400/30 dark:border-white/15 dark:bg-white/5 dark:text-gray-100 dark:hover:bg-white/10"
        >
          <PrinterOutlined aria-hidden /> Print
        </button>
      </div>
    </article>
  );
}

/** Slim header row for a station display: icon, title, pending count and refresh. */
export function StationHeader({ icon, title, total, onRefresh }: {
  icon: ReactNode;
  title: string;
  total: number;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200/80 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:border-white/[0.06] dark:bg-white/[0.03]">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-xl text-white shadow-lg shadow-violet-600/25">
          {icon}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">{title}</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">Live — new orders appear automatically</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex h-11 items-center gap-2 rounded-xl bg-gray-100 px-3 dark:bg-white/[0.06]">
          <span className="text-2xl font-bold tabular-nums text-gray-900 dark:text-white">{total}</span>
          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">pending</span>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 text-base font-medium text-gray-800 transition hover:bg-gray-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-500/30 dark:border-white/15 dark:bg-white/5 dark:text-gray-100 dark:hover:bg-white/10"
        >
          <ReloadOutlined aria-hidden /> Refresh
        </button>
      </div>
    </div>
  );
}

/** Responsive ticket grid. */
export function StationGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{children}</div>;
}

/** "All caught up" state. */
export function StationEmpty({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200/80 bg-white px-6 py-16 text-center dark:border-white/[0.06] dark:bg-white/[0.03]">
      <span className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-5xl text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
        {icon}
      </span>
      <h2 className="mt-4 text-2xl font-semibold text-gray-900 dark:text-white">{title}</h2>
      <p className="mt-1 text-base text-gray-500 dark:text-gray-400">{subtitle}</p>
    </div>
  );
}

/** First-load placeholder: header + a grid of ticket skeletons. */
export function StationLoading({ label }: { label: string }) {
  return (
    <div className="space-y-4 p-4 sm:p-5" aria-busy="true" aria-label={label}>
      <div className="rounded-2xl border border-gray-200/80 bg-white px-4 py-3 dark:border-white/[0.06] dark:bg-white/[0.03]">
        <Skeleton active title={{ width: 220 }} paragraph={false} />
      </div>
      <StationGrid>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-gray-200/80 bg-white p-4 dark:border-white/10 dark:bg-gray-900">
            <Skeleton active paragraph={{ rows: 4 }} />
            <Skeleton.Button active block style={{ height: 56, marginTop: 12 }} />
          </div>
        ))}
      </StationGrid>
      <p className="text-center text-sm text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  );
}
