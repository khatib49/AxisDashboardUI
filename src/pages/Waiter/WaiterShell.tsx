import { ReactNode } from "react";
import { Link, useLocation } from "react-router";
import PageMeta from "../../components/common/PageMeta";

/**
 * Phone-first app shell for the handheld waiter mode: full-height column,
 * sticky header, scrollable body and a bottom tab bar with 44px+ targets.
 */
export type WaiterTab = "tables" | "orders" | "reservations";

// eslint-disable-next-line react-refresh/only-export-components
export const money = (n: number) => `$${(n ?? 0).toFixed(2)}`;
export const tap = "min-h-[44px] inline-flex items-center justify-center rounded-lg px-4 text-sm font-medium transition disabled:opacity-50 select-none";
export const primaryBtn = `${tap} bg-blue-600 text-white active:bg-blue-800`;
export const neutralBtn = `${tap} bg-gray-100 text-gray-900 active:bg-gray-300 dark:bg-gray-700 dark:text-white`;
export const dangerBtn = `${tap} bg-red-600 text-white active:bg-red-800`;

export type Notice = { variant: "success" | "error" | "warning" | "info"; message: string };
const noticeTone: Record<Notice["variant"], string> = {
  success: "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200",
  error: "bg-red-50 text-red-800 dark:bg-red-500/15 dark:text-red-200",
  warning: "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200",
  info: "bg-sky-50 text-sky-800 dark:bg-sky-500/15 dark:text-sky-200",
};

export function NoticeBar({ notice, onClose }: { notice: Notice | null; onClose: () => void }) {
  if (!notice) return null;
  return (
    <div className={`mx-3 mt-2 rounded-lg px-3 py-2 text-sm flex items-start gap-2 ${noticeTone[notice.variant]}`} role="status">
      <span className="flex-1">{notice.message}</span>
      <button type="button" className="min-h-[32px] min-w-[32px] -mr-1" onClick={onClose} aria-label="Dismiss">✕</button>
    </div>
  );
}

export default function WaiterShell({
  title,
  subtitle,
  back,
  tab,
  children,
  headerRight,
  footer,
}: {
  title: string;
  subtitle?: string;
  back?: string;
  tab?: WaiterTab;
  children: ReactNode;
  headerRight?: ReactNode;
  footer?: ReactNode;
}) {
  const loc = useLocation();
  const tabs: { key: WaiterTab; label: string; to: string; icon: string }[] = [
    { key: "tables", label: "Tables", to: "/waiter?tab=tables", icon: "▦" },
    { key: "orders", label: "Orders", to: "/waiter?tab=orders", icon: "☰" },
    { key: "reservations", label: "Reservations", to: "/waiter?tab=reservations", icon: "◷" },
  ];
  const current = tab ?? (new URLSearchParams(loc.search).get("tab") as WaiterTab | null) ?? "tables";
  return (
    <div className="h-dvh min-h-[100vh] flex flex-col bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white" style={{ maxWidth: "100vw" }}>
      <PageMeta title={`${title} | Waiter`} description="Handheld table service" />
      <header className="shrink-0 flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 text-gray-800 dark:text-white/90">
        {back && (
          <Link to={back} className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-xl" aria-label="Back">‹</Link>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold truncate text-base" data-page-title>{title}</h1>
          {subtitle && <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{subtitle}</div>}
        </div>
        {headerRight}
      </header>
      <main className="flex-1 min-h-0 overflow-y-auto">{children}</main>
      {footer && <div className="shrink-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 p-3 text-gray-800 dark:text-white/90">{footer}</div>}
      <nav className="shrink-0 grid grid-cols-3 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 pb-[env(safe-area-inset-bottom)] text-gray-800 dark:text-white/90" aria-label="Waiter sections">
        {tabs.map((t) => (
          <Link
            key={t.key}
            to={t.to}
            className={`min-h-[56px] flex flex-col items-center justify-center text-xs gap-0.5 ${current === t.key ? "text-blue-600 dark:text-blue-400 font-semibold" : "text-gray-500 dark:text-gray-400"}`}
            aria-current={current === t.key ? "page" : undefined}
          >
            <span className="text-lg leading-none" aria-hidden="true">{t.icon}</span>
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
