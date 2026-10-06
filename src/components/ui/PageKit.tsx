// PageKit — the shared layout pieces of the modern admin pages
// (Owners' Drawings, Entries, Entry Categories): page header, panel and
// stat tile. Tailwind only, light + dark.

import type { ReactNode } from "react";
import { Skeleton } from "antd";

/** Page header: icon, title, optional badge + description, actions on the right, extra row below. */
export function PageHeader({ icon, title, badge, description, actions, children, tone = "violet" }: {
  icon: ReactNode;
  title: ReactNode;
  badge?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  tone?: "violet" | "blue" | "emerald";
}) {
  const t = {
    violet: { wrap: "border-violet-100 from-violet-50 dark:border-violet-500/10 dark:from-violet-500/10", glow: "bg-violet-200/40 dark:bg-violet-500/10", icon: "bg-violet-600 shadow-violet-600/25", badge: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" },
    blue: { wrap: "border-blue-100 from-blue-50 dark:border-blue-500/10 dark:from-blue-500/10", glow: "bg-blue-200/40 dark:bg-blue-500/10", icon: "bg-blue-600 shadow-blue-600/25", badge: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" },
    emerald: { wrap: "border-emerald-100 from-emerald-50 dark:border-emerald-500/10 dark:from-emerald-500/10", glow: "bg-emerald-200/40 dark:bg-emerald-500/10", icon: "bg-emerald-600 shadow-emerald-600/25", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  }[tone];
  return (
    <div className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br via-white to-white p-6 dark:via-transparent dark:to-transparent ${t.wrap}`}>
      <div className={`pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full blur-3xl ${t.glow}`} />
      <div className="relative flex flex-wrap items-start justify-between gap-5">
        <div className="flex items-start gap-4">
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl text-white shadow-lg ${t.icon}`}>{icon}</span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">{title}</h1>
              {badge && <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${t.badge}`}>{badge}</span>}
            </div>
            {description && <p className="mt-1 max-w-2xl text-sm text-gray-600 dark:text-gray-400">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children && <div className="relative mt-5">{children}</div>}
    </div>
  );
}

/** Card with an optional header row (title, subtitle, extra on the right). */
export function Panel({ title, subtitle, extra, children, className = "", bodyClassName = "p-5" }: {
  title?: ReactNode; subtitle?: ReactNode; extra?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string;
}) {
  return (
    // min-w-0: a wide table inside must scroll within the panel, not widen the grid column.
    <section className={`min-w-0 rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:border-white/[0.06] dark:bg-white/[0.03] ${className}`}>
      {(title || extra) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-white/[0.06]">
          <div>
            {title && <h2 className="text-[15px] font-semibold text-gray-900 dark:text-white">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>}
          </div>
          {extra}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

/** KPI tile. Pass onClick + active to use it as a filter. */
export function StatTile({ label, value, sub, accent, loading, onClick, active }: {
  label: ReactNode; value: ReactNode; sub?: ReactNode; accent?: ReactNode; loading?: boolean; onClick?: () => void; active?: boolean;
}) {
  const interactive = !!onClick;
  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={interactive ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick!(); } } : undefined}
      className={`rounded-2xl border bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition dark:bg-white/[0.03] ${
        active
          ? "border-violet-400 ring-2 ring-violet-500/20 dark:border-violet-400/60"
          : "border-gray-200/80 dark:border-white/[0.06]"
      } ${interactive ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
        {accent}
      </div>
      {loading ? (
        <Skeleton.Input active size="small" style={{ marginTop: 10, width: 140 }} />
      ) : (
        <div className="mt-2 text-[28px] font-semibold leading-tight tracking-tight text-gray-900 dark:text-white">{value}</div>
      )}
      {sub && <div className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{sub}</div>}
    </div>
  );
}

/** Small rounded label. */
export function Pill({ children, tone = "gray", dot }: { children: ReactNode; tone?: "gray" | "violet" | "blue" | "emerald" | "amber" | "red" | "purple"; dot?: boolean }) {
  const cls = {
    gray: "bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-gray-300",
    violet: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300",
    purple: "bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-500/10 dark:text-fuchsia-300",
    blue: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
    emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
    red: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300",
  }[tone];
  const dotCls = {
    gray: "bg-gray-400", violet: "bg-violet-500", purple: "bg-fuchsia-500", blue: "bg-blue-500",
    emerald: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500",
  }[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dotCls}`} />}
      {children}
    </span>
  );
}
