import { useEffect, useRef, useState } from "react";
import { logUpsell, suggestUpsells, type UpsellChannel, type UpsellSuggestionDto } from "../../services/phase4Service";

type Props = {
  /** Item ids currently in the cart (duplicates are fine). */
  itemIds: number[];
  channel: UpsellChannel;
  onAdd: (s: UpsellSuggestionDto) => void;
  title?: string;
  className?: string;
  limit?: number;
};

/**
 * "Often ordered together" suggestions for any cart. Refreshes when the cart
 * changes, logs each suggestion once as shown and on tap as accepted.
 * Renders nothing when there is nothing to suggest or the call fails.
 */
export default function UpsellStrip({ itemIds, channel, onAdd, title = "Suggested for this order", className = "", limit = 3 }: Props) {
  const [list, setList] = useState<UpsellSuggestionDto[]>([]);
  const shown = useRef<Set<number>>(new Set());
  const key = Array.from(new Set(itemIds)).sort((a, b) => a - b).join(",");

  useEffect(() => {
    if (!key) { setList([]); return; }
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const r = await suggestUpsells(key.split(",").map(Number), channel, limit);
        if (!alive) return;
        setList(r);
        r.forEach((s) => { if (!shown.current.has(s.itemId)) { shown.current.add(s.itemId); logUpsell(channel, "Shown", s); } });
      } catch { if (alive) setList([]); }
    }, 350);
    return () => { alive = false; clearTimeout(t); };
  }, [key, channel, limit]);

  if (list.length === 0) return null;
  return (
    <div className={`rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10 ${className}`} data-testid="upsell-strip">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">{title}</p>
      <ul className="mt-2 space-y-2">
        {list.map((s) => (
          <li key={s.itemId} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900 dark:text-white/90">{s.name} <span className="text-gray-500 dark:text-gray-400">${s.price.toFixed(2)}</span></p>
              <p className="truncate text-xs text-gray-600 dark:text-gray-400">{s.message || s.reason}</p>
            </div>
            <button
              type="button"
              onClick={() => { logUpsell(channel, "Accepted", s); onAdd(s); setList((l) => l.filter((x) => x.itemId !== s.itemId)); }}
              className="shrink-0 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600"
            >
              Add
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
