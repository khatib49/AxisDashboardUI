// OwnerDrawingDetailModal
// =======================
// Opens from an owner on the Owners' Drawings page. Answers three questions:
//   1. What was drawn?  — every posted journal line on the owner's drawings
//      account in the period, with where it came from (Drawings page, an
//      entry category, a manual journal entry) and a running total.
//   2. How is each number calculated? — the four formulas with the real
//      figures plugged in.
//   3. Why? — plain-language meaning of share / fair share / over-drawn.
//
// Layout: header (owner + status) · KPI strip · tabs: Overview | Entries.

import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Empty, Input, Modal, Skeleton, Tabs } from "antd";
import { CheckCircleFilled, CloseOutlined, PlusOutlined, SearchOutlined, WarningFilled } from "@ant-design/icons";
import dayjs from "dayjs";
import {
  getOwnerDrawingsLedger,
  OwnerDrawingsLedgerDto,
  OwnerDrawingsLedgerLineDto,
  OwnerDrawingsLineDto,
} from "../../services/ownerService";
import { Eyebrow, OwnerAvatar, StatusBadge } from "./owners/ownerVisuals";
import { money, pct, signedMoney, statusOf } from "./owners/ownerFormat";

const SOURCE_STYLE: Record<string, { dot: string; cls: string }> = {
  "Drawings page": { dot: "#7c3aed", cls: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300" },
  "Entry category": { dot: "#2563eb", cls: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300" },
  "Manual journal entry": { dot: "#d97706", cls: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300" },
};
const sourceStyle = (s: string) => SOURCE_STYLE[s] ?? { dot: "#6b7280", cls: "bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-gray-300" };

const day = (iso: string) => dayjs(iso.slice(0, 10));

interface Props {
  /** The summary row that was clicked; null = closed. */
  row: OwnerDrawingsLineDto | null;
  /** Total drawings of all owners in the period (header rollup). */
  totalDrawings: number;
  headerLabel: string;
  from: string;
  to: string;
  /** The owner's colour on the page, so the popup matches. */
  color: string;
  onClose: () => void;
  /** Shown as a footer button when the owner can take a new drawing. */
  onRecordDrawing?: () => void;
}

// ── Pieces ──────────────────────────────────────────────────────────────

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "danger" | "success" }) {
  const toneCls = tone === "danger" ? "text-red-600 dark:text-red-400" : tone === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-gray-900 dark:text-white";
  return (
    <div className="rounded-xl border border-gray-200/80 bg-white px-4 py-3 dark:border-white/[0.06] dark:bg-white/[0.03]">
      <Eyebrow>{label}</Eyebrow>
      <div className={`mt-1 text-xl font-semibold tracking-tight ${toneCls}`}>{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">{hint}</div>}
    </div>
  );
}

/** Drawn vs fair share on one scale — the gap between the bars is the variance. */
function DrawnVsFair({ drawn, fair, color }: { drawn: number; fair: number; color: string }) {
  const max = Math.max(drawn, fair, 0.01);
  const Bar = ({ label, value, fill, striped }: { label: string; value: number; fill: string; striped?: boolean }) => (
    <div className="grid grid-cols-[88px_1fr_110px] items-center gap-3">
      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      <div className="h-3 rounded-full bg-gray-100 dark:bg-white/5">
        <div
          className="h-full rounded-full"
          style={{
            width: `${(Math.max(0, value) / max) * 100}%`,
            background: striped ? `repeating-linear-gradient(45deg, ${fill}, ${fill} 4px, transparent 4px, transparent 7px)` : fill,
            boxShadow: striped ? `inset 0 0 0 1.5px ${fill}` : undefined,
          }}
        />
      </div>
      <span className="text-right text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">{money(value)}</span>
    </div>
  );
  return (
    <div className="space-y-2.5">
      <Bar label="Drawn" value={drawn} fill={color} />
      <Bar label="Fair share" value={fair} fill="#94a3b8" striped />
    </div>
  );
}

/** Drawings per month across the period (single series, owner colour). */
function MonthlyBars({ lines, from, to, color }: { lines: OwnerDrawingsLedgerLineDto[]; from: string; to: string; color: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const months = useMemo(() => {
    const start = dayjs(from).startOf("month");
    const end = dayjs(to).startOf("month");
    const list: { key: string; label: string; total: number; count: number }[] = [];
    for (let m = start; !m.isAfter(end) && list.length < 36; m = m.add(1, "month"))
      list.push({ key: m.format("YYYY-MM"), label: m.format("MMM"), total: 0, count: 0 });
    for (const l of lines) {
      const b = list.find((x) => x.key === l.entryDate.slice(0, 7));
      if (b) { b.total += l.debit - l.credit; b.count += 1; }
    }
    return list;
  }, [lines, from, to]);
  const max = Math.max(...months.map((m) => m.total), 0);
  if (months.length < 2) return null;

  return (
    <div>
      <div className="relative flex h-32 items-end gap-1.5 border-b border-gray-200 dark:border-white/10" onMouseLeave={() => setHover(null)}>
        {months.map((m, i) => (
          <div key={m.key} className="relative flex h-full flex-1 items-end" onMouseEnter={() => setHover(i)}>
            <div
              className="w-full rounded-t-[4px] transition-opacity"
              style={{
                height: max > 0 ? `${Math.max(m.total > 0 ? 3 : 0, (m.total / max) * 100)}%` : 0,
                background: color,
                opacity: hover === null || hover === i ? 1 : 0.4,
              }}
            />
            {hover === i && (
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs text-white shadow-lg">
                <div className="font-semibold">{dayjs(m.key + "-01").format("MMMM YYYY")}</div>
                <div className="tabular-nums text-gray-300">{money(m.total)} · {m.count} line{m.count === 1 ? "" : "s"}</div>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {months.map((m, i) => (
          <span key={m.key} className={`flex-1 text-center text-[10px] ${hover === i ? "font-semibold text-gray-800 dark:text-gray-100" : "text-gray-400"}`}>
            {months.length > 14 && i % 2 === 1 ? "" : m.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function FormulaRow({ n, label, children, result, tone }: { n: number; label: string; children: React.ReactNode; result: string; tone?: "danger" | "success" }) {
  const toneCls = tone === "danger" ? "text-red-600 dark:text-red-400" : tone === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-gray-900 dark:text-white";
  return (
    <div className="grid grid-cols-[28px_1fr_auto] items-center gap-3 py-3">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100 text-xs font-bold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">{n}</span>
      <div className="min-w-0">
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-gray-500 dark:text-gray-400">{children}</div>
      </div>
      <span className={`text-base font-semibold tabular-nums ${toneCls}`}>= {result}</span>
    </div>
  );
}

/** A number inside a formula. */
const Chip = ({ children }: { children: React.ReactNode }) => (
  <span className="rounded-md bg-gray-100 px-1.5 py-0.5 font-medium tabular-nums text-gray-800 dark:bg-white/10 dark:text-gray-100">{children}</span>
);

// ── Modal ───────────────────────────────────────────────────────────────

export default function OwnerDrawingDetailModal({ row, totalDrawings, headerLabel, from, to, color, onClose, onRecordDrawing }: Props) {
  const [data, setData] = useState<OwnerDrawingsLedgerDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("overview");
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!row) return;
    let alive = true;
    setData(null);
    setError(null);
    setTab("overview");
    setQ("");
    setLoading(true);
    getOwnerDrawingsLedger(row.accountId, from, to)
      .then((d) => { if (alive) setData(d); })
      .catch((e: unknown) => {
        if (alive) setError(e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "Failed to load");
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [row, from, to]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const s = q.trim().toLowerCase();
    if (!s) return data.lines;
    return data.lines.filter((l) =>
      [l.entryNumber, l.source, l.sourceDetail ?? "", l.description, day(l.entryDate).format("MMM D YYYY")].join(" ").toLowerCase().includes(s));
  }, [data, q]);

  if (!row) return null;

  const isOwner = row.ownerId != null;
  const name = row.name;
  const period = `${dayjs(from).format("MMM D, YYYY")} – ${dayjs(to).format("MMM D, YYYY")}`;
  const status = statusOf(row.variance);
  const varianceTone = status === "over" ? "danger" : status === "under" ? "success" : undefined;
  const reconciles = data ? Math.abs(data.drawn - row.drawn) < 0.005 : true;
  const hasSpread = data?.lines.some((l) => l.sourceDetail?.includes("spread")) ?? false;
  const bySource = data
    ? Object.entries(data.lines.reduce<Record<string, number>>((acc, l) => { acc[l.source] = (acc[l.source] ?? 0) + (l.debit - l.credit); return acc; }, {}))
    : [];

  // ── Overview tab ────────────────────────────────────────────────────
  const overview = (
    <div className="space-y-5">
      {isOwner && (
        <section className="rounded-xl border border-gray-200/80 p-4 dark:border-white/[0.06]">
          <div className="mb-3 flex items-center justify-between">
            <Eyebrow>Drawn vs fair share</Eyebrow>
            <StatusBadge variance={row.variance} size="md" />
          </div>
          <DrawnVsFair drawn={row.drawn} fair={row.entitledAmount} color={color} />
        </section>
      )}

      <section className="rounded-xl border border-gray-200/80 p-4 dark:border-white/[0.06]">
        <div className="mb-3">
          <Eyebrow>Drawings by month</Eyebrow>
        </div>
        {loading ? <Skeleton active paragraph={{ rows: 3 }} title={false} /> : data && data.lines.length > 0 ? (
          <MonthlyBars lines={data.lines} from={from} to={to} color={color} />
        ) : (
          <div className="py-6 text-center text-xs text-gray-400">No drawings in this period</div>
        )}
        {bySource.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3 dark:border-white/[0.06]">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Where it came from</span>
            {bySource.map(([s, v]) => (
              <span key={s} className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${sourceStyle(s).cls}`}>
                {s} <span className="tabular-nums">{money(v)}</span>
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-violet-100 bg-gradient-to-b from-violet-50/70 to-white px-4 pt-3 dark:border-violet-500/10 dark:from-violet-500/[0.06] dark:to-transparent">
        <Eyebrow>How it's calculated</Eyebrow>
        <div className="divide-y divide-violet-100/80 dark:divide-white/[0.06]">
          <FormulaRow n={1} label="Drawn" result={money(row.drawn)}>
            Sum of <Chip>{row.entryCount}</Chip> journal entr{row.entryCount === 1 ? "y" : "ies"} on {row.accountNumber} in the period (debits − credits)
          </FormulaRow>
          {isOwner && (
            <>
              <FormulaRow n={2} label="Share of drawings" result={pct(row.shareOfDrawingsPercent)}>
                <Chip>{money(row.drawn)}</Chip> ÷ <Chip>{money(totalDrawings)}</Chip> all owners ({headerLabel}) × 100
              </FormulaRow>
              <FormulaRow n={3} label="Fair share" result={money(row.entitledAmount)}>
                <Chip>{money(totalDrawings)}</Chip> total drawings × <Chip>{pct(row.ownershipPercent)}</Chip> ownership
              </FormulaRow>
              <FormulaRow n={4} label="Over / (under) drawn" result={signedMoney(row.variance)} tone={varianceTone}>
                <Chip>{money(row.drawn)}</Chip> drawn − <Chip>{money(row.entitledAmount)}</Chip> fair share
              </FormulaRow>
            </>
          )}
        </div>
      </section>

      <section className="rounded-xl bg-gray-50 p-4 text-sm leading-relaxed text-gray-700 dark:bg-white/[0.03] dark:text-gray-300">
        <Eyebrow>Why</Eyebrow>
        <p className="mt-2">
          A drawing is cash an owner takes out for personal use. It is <b>not a business expense</b>, so it does not lower
          profit — it lowers the owner's equity: <b>DR {row.accountNumber} {row.accountName} / CR 1000 Cash on Hand</b>.
          That is also why it reduces Cash on Hand.
        </p>
        {isOwner ? (
          <>
            <p className="mt-2">
              Partners share in proportion to what they own. If drawings followed ownership, {name} would have taken{" "}
              {pct(row.ownershipPercent)} of the {money(totalDrawings)} all owners drew — the fair share of {money(row.entitledAmount)}.{" "}
              {name} actually took {pct(row.shareOfDrawingsPercent)} ({money(row.drawn)}).
            </p>
            <p className="mt-2">
              {status === "over" && (
                <><b className="text-red-700 dark:text-red-400">{name} is over-drawn by {money(row.variance)}</b> compared with the other partners. Not an error — it is usually settled when profit is distributed (deducted from {name}'s share), or the other owners draw a catch-up amount.</>
              )}
              {status === "under" && (
                <><b className="text-emerald-700 dark:text-emerald-400">{name} is under-drawn by {money(-row.variance)}</b> — that amount could still be drawn to be level with the other partners, or is added to {name}'s share when profit is distributed.</>
              )}
              {status === "even" && <><b>{name} drew exactly their fair share</b> for this period.</>}
            </p>
          </>
        ) : (
          <p className="mt-2">
            This account sits under {headerLabel} but is not linked to an owner, so it has no ownership % and no fair share.
            Link it to an owner (or move its entries) to include it in the comparison.
          </p>
        )}
      </section>
    </div>
  );

  // ── Entries tab ─────────────────────────────────────────────────────
  const entries = (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          allowClear
          prefix={<SearchOutlined className="text-gray-400" />}
          placeholder="Search entry, category, comment…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ maxWidth: 320 }}
        />
        {data && (reconciles ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            <CheckCircleFilled /> {data.lines.length} line{data.lines.length === 1 ? "" : "s"} add up to {money(data.drawn)}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
            <WarningFilled /> Lines total {money(data.drawn)}, summary shows {money(row.drawn)} — refresh the page
          </span>
        ))}
      </div>

      {error && <Alert type="error" showIcon message={error} />}
      {loading && <Skeleton active paragraph={{ rows: 6 }} />}

      {data && (data.lines.length === 0 ? (
        <Empty description="No drawings in this period" />
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200/80 dark:border-white/[0.06]">
          <div className="max-h-[380px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-[1] bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-2.5 text-left font-semibold">Date</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Entry</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Running</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/[0.06]">
                {filtered.map((l, i) => {
                  const net = l.debit - l.credit;
                  const st = sourceStyle(l.source);
                  return (
                    <tr key={`${l.journalEntryId}-${i}`} className="align-top hover:bg-gray-50/70 dark:hover:bg-white/[0.02]">
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="font-medium tabular-nums text-gray-900 dark:text-gray-100">{day(l.entryDate).format("MMM D, YYYY")}</div>
                        <code className="text-[11px] text-gray-400">{l.entryNumber}</code>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${st.cls}`}>
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.dot }} />
                          {l.source}
                        </span>
                        <div className="mt-1 text-gray-700 dark:text-gray-300">{l.sourceDetail || l.description}</div>
                      </td>
                      <td className={`whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums ${net < 0 ? "text-emerald-600" : "text-gray-900 dark:text-gray-100"}`}>
                        {signedMoney(net)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-gray-400">{money(l.runningTotal)}</td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-xs text-gray-400">No entries match “{q}”</td></tr>
                )}
              </tbody>
              <tfoot className="sticky bottom-0 bg-violet-50 dark:bg-gray-900">
                <tr>
                  <td colSpan={2} className="px-4 py-2.5 text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Total drawn · {data.entryCount} journal entr{data.entryCount === 1 ? "y" : "ies"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">{money(data.drawn)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ))}

      {hasSpread && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Entries made through an entry category that cover several months are booked as one journal entry per month, so a
          single entry can appear here as several lines. Months that haven't started yet are not counted.
        </p>
      )}
    </div>
  );

  return (
    <Modal
      open={!!row}
      onCancel={onClose}
      width={920}
      destroyOnHidden
      closable={false}
      title={null}
      styles={{ body: { padding: 0 } }}
      footer={
        <div className="flex items-center justify-between gap-3 px-1">
          <span className="text-xs text-gray-400">{period}</span>
          <div className="flex gap-2">
            <Button onClick={onClose}>Close</Button>
            {onRecordDrawing && <Button type="primary" icon={<PlusOutlined />} onClick={onRecordDrawing}>Record drawing for {name}</Button>}
          </div>
        </div>
      }
    >
      {/* Header */}
      <div className="relative overflow-hidden rounded-t-lg px-6 pb-5 pt-6">
        <div className="pointer-events-none absolute inset-0 opacity-[0.08]" style={{ background: `linear-gradient(135deg, ${color}, transparent 60%)` }} />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10"
        >
          <CloseOutlined />
        </button>
        <div className="relative flex flex-wrap items-center gap-4 pr-10">
          <OwnerAvatar name={name} color={color} size={52} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">{name}</h3>
              {isOwner && (
                <span className="rounded-full bg-gray-900/[0.06] px-2.5 py-0.5 text-xs font-semibold text-gray-700 dark:bg-white/10 dark:text-gray-200">
                  owns {pct(row.ownershipPercent)}
                </span>
              )}
            </div>
            <div className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              <code className="text-xs">{row.accountNumber}</code> · {row.accountName} · {period}
            </div>
          </div>
        </div>

        {/* KPI strip */}
        <div className={`relative mt-5 grid gap-3 ${isOwner ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2"}`}>
          <Kpi label="Drawn" value={money(row.drawn)} hint={`${row.entryCount} entr${row.entryCount === 1 ? "y" : "ies"}`} />
          {isOwner ? (
            <>
              <Kpi label="Share of drawings" value={pct(row.shareOfDrawingsPercent)} hint={`owns ${pct(row.ownershipPercent)}`} />
              <Kpi label="Fair share" value={money(row.entitledAmount)} hint={`${pct(row.ownershipPercent)} × ${money(totalDrawings)}`} />
              <Kpi
                label={status === "under" ? "Under-drawn" : "Over-drawn"}
                value={status === "even" ? money(0) : money(Math.abs(row.variance))}
                hint={status === "over" ? "▲ above fair share" : status === "under" ? "▼ below fair share" : "✓ balanced"}
                tone={varianceTone}
              />
            </>
          ) : (
            <Kpi label="Lifetime" value={money(row.lifetimeDrawn)} hint="all time" />
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-t border-gray-100 px-6 pb-2 dark:border-white/[0.06]">
        <Tabs
          activeKey={tab}
          onChange={setTab}
          items={[
            { key: "overview", label: "Overview", children: overview },
            { key: "entries", label: <span>Entries{data ? <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 text-[11px] text-gray-600 dark:bg-white/10 dark:text-gray-300">{data.lines.length}</span> : null}</span>, children: entries },
          ]}
        />
      </div>
    </Modal>
  );
}
