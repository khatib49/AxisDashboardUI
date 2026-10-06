// "Who took the drawings" — two stacked bars on the same 0–100% scale:
//   Drawn  = each owner's share of the period's total drawings
//   Owned  = each owner's ownership %
// Same owners, same order, same colours, so a segment that is wider on the
// Drawn bar than on the Owned bar is an owner drawing more than their share.
// Hover a segment for its numbers; the legend below repeats every value so
// nothing depends on colour or hover alone.

import { useState } from "react";
import type { OwnerDrawingsLineDto } from "../../../services/ownerService";
import { money, pct, type OwnerColorFn } from "./ownerFormat";
import { StatusBadge } from "./ownerVisuals";

type Seg = { key: string; name: string; color: string; value: number; detail: string };

function StackBar({ label, total, segs }: { label: string; total: string; segs: Seg[] }) {
  const [hover, setHover] = useState<{ seg: Seg; x: number } | null>(null);
  const sum = segs.reduce((a, s) => a + s.value, 0);
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{label}</span>
        <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">{total}</span>
      </div>
      <div className="relative" onMouseLeave={() => setHover(null)}>
        {/* 2px surface gap between segments; rounded ends on the outer edges only. */}
        <div className="flex h-7 w-full gap-[2px] overflow-hidden rounded-md bg-gray-100 dark:bg-white/5">
          {sum > 0 &&
            segs.filter((s) => s.value > 0).map((s) => (
              <div
                key={s.key}
                className="relative h-full cursor-default transition-opacity"
                style={{ width: `${(s.value / sum) * 100}%`, background: s.color, opacity: hover && hover.seg.key !== s.key ? 0.45 : 1 }}
                onMouseEnter={(e) => {
                  const box = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
                  const r = e.currentTarget.getBoundingClientRect();
                  setHover({ seg: s, x: r.left - box.left + r.width / 2 });
                }}
              >
                {/* Inline label only where it fits; white or ink by fill luminance. */}
                {(s.value / sum) * 100 >= 9 && (
                  <span className="absolute inset-0 flex items-center justify-center truncate px-1 text-[11px] font-semibold text-white [text-shadow:0_1px_1px_rgba(0,0,0,.25)]">
                    {Math.round((s.value / sum) * 100)}%
                  </span>
                )}
              </div>
            ))}
        </div>
        {hover && (
          <div
            className="pointer-events-none absolute bottom-full z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-lg dark:bg-gray-800 dark:ring-1 dark:ring-white/10"
            style={{ left: hover.x }}
          >
            <div className="flex items-center gap-1.5 font-semibold">
              <span className="h-2 w-2 rounded-sm" style={{ background: hover.seg.color }} />
              {hover.seg.name}
            </div>
            <div className="mt-0.5 tabular-nums text-gray-300">{hover.seg.detail}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DrawingsComposition({
  rows,
  totalDrawings,
  color,
  onOpen,
}: {
  rows: OwnerDrawingsLineDto[];
  totalDrawings: number;
  color: OwnerColorFn;
  onOpen: (row: OwnerDrawingsLineDto) => void;
}) {
  const owners = rows.filter((r) => r.ownerId != null);
  if (owners.length === 0) return null;

  const drawnSegs: Seg[] = rows.map((r) => ({
    key: `${r.accountId}`,
    name: r.name,
    color: color(r.ownerId),
    value: Math.max(0, r.drawn),
    detail: `${money(r.drawn)} · ${pct(r.shareOfDrawingsPercent)} of drawings`,
  }));
  const ownedSegs: Seg[] = owners.map((r) => ({
    key: `${r.accountId}`,
    name: r.name,
    color: color(r.ownerId),
    value: r.ownershipPercent,
    detail: `Owns ${pct(r.ownershipPercent)} · fair share ${money(r.entitledAmount)}`,
  }));

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        <StackBar label="Drawn — share of total drawings" total={money(totalDrawings)} segs={drawnSegs} />
        <StackBar label="Owned — ownership %" total={pct(owners.reduce((a, r) => a + r.ownershipPercent, 0))} segs={ownedSegs} />
      </div>

      {/* Legend that doubles as the value table. */}
      <div className="divide-y divide-gray-100 rounded-xl border border-gray-100 dark:divide-white/[0.06] dark:border-white/[0.06]">
        {rows.map((r) => (
          <button
            key={r.accountId}
            type="button"
            onClick={() => onOpen(r)}
            className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition first:rounded-t-xl last:rounded-b-xl hover:bg-gray-50 dark:hover:bg-white/5"
          >
            <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: color(r.ownerId) }} />
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{r.name}</span>
                <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">{money(r.drawn)}</span>
              </span>
              <span className="mt-0.5 flex items-center justify-between gap-2">
                <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
                  {pct(r.shareOfDrawingsPercent)} drawn{r.ownerId != null && <> · owns {pct(r.ownershipPercent)}</>}
                </span>
                {r.ownerId != null && <StatusBadge variance={r.variance} />}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
