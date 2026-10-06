// GameKit — presentation helpers for the Games and Game Settings admin pages.
// Pure UI: the pages own all state, API calls and handlers; these only render
// what they're given.

import type { ReactNode } from "react";
import { Pill } from "../../ui/PageKit";
import { getStatusName, STATUS_DISABLED, STATUS_ENABLED } from "../../../services/statuses";

/** Enabled / Disabled (or any other status name) as a dotted pill. */
export function GameStatusPill({ statusId }: { statusId?: number | null }) {
  const name = getStatusName(statusId) ?? statusId ?? "-";
  if (statusId === STATUS_ENABLED) return <Pill tone="emerald" dot>{name}</Pill>;
  if (statusId === STATUS_DISABLED) return <Pill tone="red" dot>{name}</Pill>;
  return <Pill tone="gray" dot>{name}</Pill>;
}

/**
 * Two-option segmented control for Enabled / Disabled. Calls onChange with the
 * same status ids the old StatusToggle buttons did.
 */
export function StatusSegment({ value, onChange }: { value?: number | null; onChange: (id: number | null) => void }) {
  const opts = [
    { id: STATUS_ENABLED, label: "Enabled", on: "bg-emerald-600 text-white shadow-sm", dot: "bg-emerald-500" },
    { id: STATUS_DISABLED, label: "Disabled", on: "bg-red-600 text-white shadow-sm", dot: "bg-red-500" },
  ];
  return (
    <div role="radiogroup" aria-label="Status" className="inline-flex w-full rounded-xl border border-gray-200 bg-gray-50 p-1 sm:w-auto dark:border-white/10 dark:bg-white/[0.03]">
      {opts.map((o) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-1.5 text-sm font-medium transition sm:flex-none ${
              active ? o.on : "text-gray-600 hover:bg-white hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-white"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-white" : o.dot}`} />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Titled group of form fields inside a modal. */
export function FormSection({ title, description, children, aside }: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-xl border border-gray-200/80 p-4 dark:border-white/[0.08]">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h4>
          {description && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{description}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Bordered row that hosts a toggle plus a short hint. */
export function ToggleTile({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg border border-gray-200 bg-gray-50/60 px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.02]">
      {children}
      {hint && <p className="mt-1 pl-14 text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
    </div>
  );
}

/** Small "label: value" pair used on mobile cards. */
export function Field({ label, children, className = "" }: { label: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <div className="text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">{label}</div>
      <div className="mt-0.5 text-sm text-gray-800 dark:text-gray-200">{children}</div>
    </div>
  );
}
