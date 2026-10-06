// Shared visual components for the Owners' Drawings page and its detail popup.
// Colours and number formatting live in ownerFormat.ts.

import { initials, money, pct, statusOf } from "./ownerFormat";

export function OwnerAvatar({ name, color, size = 36 }: { name: string; color: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-white dark:ring-gray-900"
      style={{ width: size, height: size, background: color, fontSize: Math.round(size * 0.38) }}
    >
      {initials(name)}
    </span>
  );
}

/** Over/under badge: icon + words + amount, never colour alone. */
export function StatusBadge({ variance, size = "sm" }: { variance: number; size?: "sm" | "md" }) {
  const s = statusOf(variance);
  const cfg = {
    over: { icon: "▲", label: "Over-drawn", cls: "bg-red-50 text-red-700 ring-red-600/15 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-400/20" },
    under: { icon: "▼", label: "Under-drawn", cls: "bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20" },
    even: { icon: "✓", label: "Balanced", cls: "bg-gray-100 text-gray-700 ring-gray-500/15 dark:bg-white/5 dark:text-gray-300 dark:ring-white/10" },
  }[s];
  const pad = size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[11px]";
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full font-medium ring-1 ring-inset ${pad} ${cfg.cls}`}>
      <span aria-hidden className="text-[9px]">{cfg.icon}</span>
      {cfg.label}
      {s !== "even" && <span className="tabular-nums">{money(Math.abs(variance))}</span>}
    </span>
  );
}

/**
 * Share of drawings vs ownership, on one 0–100% track: the coloured bar is
 * what the owner took, the dark tick is what they own.
 */
export function ShareMeter({ share, owned, color, showOwned = true }: { share: number; owned: number; color: string; showOwned?: boolean }) {
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  return (
    <div className="relative h-2 w-full rounded-full bg-gray-100 dark:bg-white/10">
      <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${clamp(share)}%`, background: color }} />
      {showOwned && (
        <div
          title={`Owns ${pct(owned)}`}
          className="absolute -top-1 h-4 w-0.5 rounded-full bg-gray-800 dark:bg-gray-100"
          style={{ left: `calc(${clamp(owned)}% - 1px)` }}
        />
      )}
    </div>
  );
}

/** Small uppercase section label. */
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{children}</div>;
}
