import { ReactNode } from "react";
import Alert from "../../components/ui/alert/Alert";
import Loader from "../../components/ui/Loader";
import type { PostableAccount } from "../../services/accountingPlusService";

export type Notice = { variant: "success" | "error" | "warning" | "info"; title: string; message: string } | null;

export function NoticeBar({ notice }: { notice: Notice }) {
  if (!notice) return null;
  return (
    <div className="mb-4">
      <Alert variant={notice.variant} title={notice.title} message={notice.message} />
    </div>
  );
}

export function StateBlock({ loading, error, empty, emptyText, children }: {
  loading: boolean;
  error: string | null;
  empty: boolean;
  emptyText: string;
  children: ReactNode;
}) {
  if (loading)
    return (
      <div className="flex items-center gap-2 p-6 text-gray-500 dark:text-gray-400">
        <Loader /> Loading...
      </div>
    );
  if (error) return <div className="p-6 text-sm text-red-600 dark:text-red-400">{error}</div>;
  if (empty) return <div className="p-6 text-sm text-gray-500 dark:text-gray-400">{emptyText}</div>;
  return <>{children}</>;
}

export function Card({ title, value, sub, tone }: { title: string; value: string; sub?: string; tone?: "ok" | "bad" | "neutral" }) {
  const color = tone === "ok" ? "text-green-600 dark:text-green-400" : tone === "bad" ? "text-red-600 dark:text-red-400" : "text-gray-800 dark:text-white/90";
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</div>
      <div className={`mt-1 text-xl font-semibold ${color}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{sub}</div>}
    </div>
  );
}

export const selectClass =
  "h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 focus:border-brand-300 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white/90";

export function AccountSelect({ value, onChange, accounts, placeholder = "Select account", filterType }: {
  value: number | "";
  onChange: (id: number | "") => void;
  accounts: PostableAccount[];
  placeholder?: string;
  filterType?: string[];
}) {
  const list = filterType ? accounts.filter((a) => filterType.includes(a.accountTypeName)) : accounts;
  return (
    <select className={selectClass} value={value} onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}>
      <option value="">{placeholder}</option>
      {list.map((a) => (
        <option key={a.id} value={a.id}>
          {a.accountNumber} - {a.accountName}
        </option>
      ))}
    </select>
  );
}

export const btnPrimary =
  "rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50";
export const btnSecondary =
  "rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5";
export const btnDanger =
  "rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20";
export const btnSmall =
  "rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5";

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    Open: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    PartiallyPaid: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    Paid: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    Void: "bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
    Draft: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
    Matched: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    Unmatched: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    Excluded: "bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
    Reconciled: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    Active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    Disposed: "bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[status] ?? "bg-gray-100 text-gray-600"}`}>{status}</span>;
}

export function toInputDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
