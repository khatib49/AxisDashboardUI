import { useEffect, useState, type ReactNode } from "react";
import { getItems, type ItemDto } from "../../services/itemService";

export const inputCls = "h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90";
export const btnPrimary = "rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50";
export const btnGhost = "rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5";
export const btnDanger = "rounded-lg border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-500/10";
export const th = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400";
export const td = "px-3 py-2 text-sm text-gray-800 dark:text-white/90";

export function Card({ title, actions, children, className = "" }: { title?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03] ${className}`}>
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-base font-semibold text-gray-800 dark:text-white/90">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Notice({ kind, text, onClose }: { kind: "ok" | "error" | "info"; text: string; onClose?: () => void }) {
  const cls = kind === "ok" ? "border-green-200 bg-green-50 text-green-800 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-300"
    : kind === "error" ? "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
    : "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300";
  return (
    <div className={`mb-3 flex items-start justify-between gap-3 rounded-xl border p-3 text-sm ${cls}`} role={kind === "error" ? "alert" : "status"}>
      <span>{text}</span>
      {onClose && <button type="button" onClick={onClose} className="text-xs underline">Dismiss</button>}
    </div>
  );
}

/** Search-as-you-type item picker (first 30 matches). */
export function ItemPicker({ value, onChange, placeholder = "Search an item…", label }: { value: { id: number; name: string } | null; onChange: (v: { id: number; name: string; price: number } | null) => void; placeholder?: string; label?: string }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<ItemDto[]>([]);
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => { getItems(1, 30, null, q || null).then((r) => setList(r.data || [])).catch(() => setList([])); }, 250);
    return () => clearTimeout(t);
  }, [q, open]);
  return (
    <div className="relative">
      {label && <span className="mb-1 block text-xs text-gray-600 dark:text-gray-400">{label}</span>}
      {value && !open ? (
        <button type="button" className={`${inputCls} text-left`} onClick={() => { setOpen(true); setQ(""); }}>{value.name}</button>
      ) : (
        <input className={inputCls} autoFocus={open} placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 200)} aria-label={label || placeholder} />
      )}
      {open && list.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
          {list.map((i) => (
            <li key={i.id}>
              <button type="button" className="flex w-full justify-between px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50 dark:text-white/90 dark:hover:bg-white/5"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onChange({ id: Number(i.id), name: i.name, price: Number(i.price) }); setOpen(false); }}>
                <span>{i.name}</span><span className="text-gray-500 dark:text-gray-400">${Number(i.price).toFixed(2)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;
export const money = (n: number) => `$${(Number(n) || 0).toFixed(2)}`;
