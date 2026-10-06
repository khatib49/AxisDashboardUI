// Books Audit
// ===========
// Admin-only reconciliation tool. Shows whether the chart of accounts revenue
// side matches the calculator (sum of TransactionRecord.TotalPrice in period).
// If there's a gap, lists the orphan transaction IDs and exposes a one-click
// backfill that re-issues every transaction journal entry in the new
// 3-line shape (Cash + Sales Discounts + Revenue).

import { useState, type ReactNode } from "react";
import {
  Button,
  DatePicker,
  Empty,
  Skeleton,
  message,
  Tooltip,
} from "antd";
import {
  AuditOutlined,
  SyncOutlined,
  ReloadOutlined,
  CheckCircleFilled,
  ExclamationCircleFilled,
  InfoCircleOutlined,
} from "@ant-design/icons";
import dayjs, { Dayjs } from "dayjs";
import {
  getRevenueCoverageAudit,
  backfillTransactions,
  RevenueCoverageAuditDto,
  BackfillResultDto,
} from "../../services/accountingService";
import { PageHeader, Panel, Pill, StatTile } from "../../components/ui/PageKit";
import { money } from "../../components/Accounting/reports/money";

const { RangePicker } = DatePicker;

const fmt = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Tile / row label with an info tooltip (keyboard-focusable). */
function InfoLabel({ children, tip }: { children: ReactNode; tip: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {children}
      <Tooltip title={tip}>
        <button
          type="button"
          aria-label={`About ${typeof children === "string" ? children : "this figure"}`}
          className="inline-flex items-center text-gray-400 transition hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
        >
          <InfoCircleOutlined />
        </button>
      </Tooltip>
    </span>
  );
}

/** One figure line inside a check panel. */
function FigureRow({ label, children, strong }: { label: ReactNode; children: ReactNode; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 px-5 py-3 ${strong ? "bg-gray-50/80 dark:bg-white/[0.03]" : ""}`}>
      <dt className={`text-sm ${strong ? "font-semibold text-gray-900 dark:text-gray-100" : "text-gray-600 dark:text-gray-400"}`}>{label}</dt>
      <dd className={`m-0 whitespace-nowrap text-right tabular-nums ${strong ? "font-semibold" : ""} text-gray-900 dark:text-gray-100`}>
        {children}
      </dd>
    </div>
  );
}

/** Small counter used in the Last Backfill panel. */
function MiniStat({ label, value, tone }: { label: string; value: number; tone?: "emerald" | "red" }) {
  const color =
    tone === "emerald"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "red"
        ? "text-red-600 dark:text-red-400"
        : "text-gray-900 dark:text-white";
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3 dark:border-white/[0.06] dark:bg-white/[0.02]">
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

export default function BooksAudit() {
  const [range, setRange] = useState<[Dayjs, Dayjs]>([
    dayjs().startOf("month"),
    dayjs().endOf("day"),
  ]);
  const [loading, setLoading] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [audit, setAudit] = useState<RevenueCoverageAuditDto | null>(null);
  const [lastBackfill, setLastBackfill] = useState<BackfillResultDto | null>(null);

  async function runAudit() {
    setLoading(true);
    try {
      const result = await getRevenueCoverageAudit(
        range[0].toISOString(),
        range[1].toISOString()
      );
      setAudit(result);
    } catch {
      message.error("Failed to run audit");
    } finally {
      setLoading(false);
    }
  }

  async function runBackfill() {
    setBackfilling(true);
    setLastBackfill(null);
    try {
      const result = await backfillTransactions();
      setLastBackfill(result);
      if (result.failed === 0) {
        message.success(`Backfill complete: ${result.success} transactions re-issued.`);
      } else {
        message.warning(
          `Backfill done with ${result.failed} failure(s). ${result.success} succeeded.`
        );
      }
      // Auto-refresh the audit so the gap closes visually.
      await runAudit();
    } catch {
      message.error("Backfill failed");
    } finally {
      setBackfilling(false);
    }
  }

  const hasGap = audit != null && Math.abs(audit.discrepancy) > 0.01;
  const allCovered = audit != null && audit.transactionsWithoutJE === 0 && !hasGap;
  // Share of paid transactions that have a journal entry (display only).
  const coveragePct =
    audit && audit.transactionsCount > 0
      ? Math.round((audit.transactionsWithJE / audit.transactionsCount) * 1000) / 10
      : null;
  const firstLoad = loading && !audit;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6">
      {/* Header */}
      <PageHeader
        tone="blue"
        icon={<AuditOutlined />}
        title="Books Audit"
        badge="Revenue Coverage"
        description="Compares the calculator (sum of paid transactions) with the chart of accounts. Lets you re-issue any transaction journal entries that are missing or out-of-date."
        actions={
          <Button type="primary" icon={<ReloadOutlined />} loading={loading} onClick={runAudit}>
            Run Audit
          </Button>
        }
      >
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Reporting Period</span>
          <RangePicker
            value={range}
            onChange={(v) => v && v[0] && v[1] && setRange([v[0], v[1]])}
            presets={[
              { label: "This Month", value: [dayjs().startOf("month"), dayjs().endOf("day")] },
              { label: "Last Month", value: [dayjs().subtract(1, "month").startOf("month"), dayjs().subtract(1, "month").endOf("month")] },
              { label: "Last 30 Days", value: [dayjs().subtract(30, "day").startOf("day"), dayjs().endOf("day")] },
              { label: "This Year", value: [dayjs().startOf("year"), dayjs().endOf("day")] },
            ]}
            allowClear={false}
            aria-label="Reporting period"
            className="w-full sm:w-auto sm:min-w-[280px]"
          />
        </div>
      </PageHeader>

      {/* Headline summary */}
      {(audit || firstLoad) && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label={
              <InfoLabel tip="Sum of TransactionRecord.TotalPrice for paid transactions in the period (what the cashier received).">
                Calculator Net
              </InfoLabel>
            }
            loading={firstLoad}
            value={<span className="tabular-nums">{audit ? money(audit.transactionsTotalNet) : "—"}</span>}
            sub={audit ? `${audit.transactionsCount} paid transaction${audit.transactionsCount === 1 ? "" : "s"}` : undefined}
          />
          <StatTile
            label={
              <InfoLabel tip="Sum of 4xxx Revenue credits minus 4900 Sales Discounts debits, from posted non-voided JEs in the period.">
                Books Net Revenue
              </InfoLabel>
            }
            loading={firstLoad}
            value={<span className="tabular-nums">{audit ? money(audit.netRevenueOnBooks) : "—"}</span>}
            sub="From posted journal entries"
          />
          <StatTile
            label={
              <InfoLabel tip="Calculator Net − Books Net. Anything other than zero means some paid transactions aren't reflected on the chart of accounts.">
                Discrepancy
              </InfoLabel>
            }
            loading={firstLoad}
            accent={audit ? (hasGap ? <Pill tone="red" dot>Gap</Pill> : <Pill tone="emerald" dot>Matches</Pill>) : undefined}
            value={
              <span className={`tabular-nums ${audit ? (hasGap ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400") : ""}`}>
                {audit ? money(audit.discrepancy) : "—"}
              </span>
            }
            sub="Calculator Net − Books Net"
          />
          <StatTile
            label={
              <InfoLabel tip="Sum of debits on the 4900 Sales Discounts account for transactions in the period.">
                Discounts Given
              </InfoLabel>
            }
            loading={firstLoad}
            value={
              <span className="tabular-nums text-amber-600 dark:text-amber-400">
                {audit ? money(audit.salesDiscountsDebit) : "—"}
              </span>
            }
            sub="4900 Sales Discounts"
          />
        </div>
      )}

      {firstLoad && (
        <Panel>
          <Skeleton active paragraph={{ rows: 6 }} />
        </Panel>
      )}

      {/* Results */}
      {audit && (
        <>
          {/* Status + action band */}
          {allCovered ? (
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 dark:border-emerald-500/20 dark:bg-emerald-500/10">
              <CheckCircleFilled className="mt-0.5 text-2xl text-emerald-500" aria-hidden />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-emerald-800 dark:text-emerald-300">Books are reconciled</span>
                  <Pill tone="emerald" dot>OK</Pill>
                </div>
                <div className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
                  Every paid transaction in this period has a posted journal entry, and the
                  calculator matches the chart of accounts.
                </div>
              </div>
            </div>
          ) : (
            <div
              role="alert"
              className="space-y-4 rounded-2xl border border-red-200 bg-red-50 p-5 dark:border-red-500/20 dark:bg-red-500/10"
            >
              <div className="flex items-start gap-3">
                <ExclamationCircleFilled className="mt-0.5 text-2xl text-red-500" aria-hidden />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-red-800 dark:text-red-300">Books need backfill</span>
                    <Pill tone="red" dot>Needs attention</Pill>
                  </div>
                  <div className="mt-0.5 text-sm text-red-700/80 dark:text-red-300/80">
                    {audit.transactionsWithoutJE > 0 && (
                      <>
                        {audit.transactionsWithoutJE} of {audit.transactionsCount}{" "}
                        paid transactions have no journal entry.{" "}
                      </>
                    )}
                    {hasGap && (
                      <>
                        Calculator and books differ by {fmt(Math.abs(audit.discrepancy))}.
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4 sm:pl-9">
                <Button
                  type="primary"
                  danger
                  icon={<SyncOutlined spin={backfilling} />}
                  loading={backfilling}
                  onClick={runBackfill}
                  className="!h-auto !whitespace-normal !py-1.5 text-left"
                >
                  Backfill / Re-issue Transaction Journal Entries
                </Button>
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  Re-issues every transaction JE in the period in the new 3-line shape
                  (Cash + Sales Discounts + Revenue). Safe to run multiple times.
                </span>
              </div>
            </div>
          )}

          {/* The two checks */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel
              title="Revenue match"
              subtitle="Calculator net vs. net revenue on the books"
              extra={hasGap ? <Pill tone="red" dot>Mismatch</Pill> : <Pill tone="emerald" dot>OK</Pill>}
              bodyClassName="p-0"
            >
              <dl className="m-0 divide-y divide-gray-100 dark:divide-white/[0.06]">
                <FigureRow label="Calculator Net">{money(audit.transactionsTotalNet)}</FigureRow>
                <FigureRow label="Books Net Revenue">{money(audit.netRevenueOnBooks)}</FigureRow>
                <FigureRow label="Discrepancy" strong>
                  <span className={hasGap ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}>
                    {money(audit.discrepancy)}
                  </span>
                </FigureRow>
              </dl>
            </Panel>

            <Panel
              title="Journal entry coverage"
              subtitle="Paid transactions in the period that have a posted journal entry"
              extra={
                audit.transactionsWithoutJE > 0 ? (
                  <Pill tone="amber" dot>{audit.transactionsWithoutJE} missing</Pill>
                ) : (
                  <Pill tone="emerald" dot>OK</Pill>
                )
              }
              bodyClassName="p-0"
            >
              <dl className="m-0 divide-y divide-gray-100 dark:divide-white/[0.06]">
                <FigureRow label="Paid transactions">{audit.transactionsCount}</FigureRow>
                <FigureRow label="With journal entry">{audit.transactionsWithJE}</FigureRow>
                <FigureRow label="Without journal entry" strong>
                  <span className={audit.transactionsWithoutJE > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}>
                    {audit.transactionsWithoutJE}
                  </span>
                </FigureRow>
              </dl>
              {coveragePct !== null && (
                <div className="px-5 pb-4 pt-3">
                  <div className="mb-1.5 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>Coverage</span>
                    <span className="tabular-nums">{coveragePct}%</span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label="Journal entry coverage"
                    aria-valuenow={coveragePct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-white/[0.06]"
                  >
                    <div
                      className={`h-full rounded-full ${audit.transactionsWithoutJE > 0 ? "bg-amber-500" : "bg-emerald-500"}`}
                      style={{ width: `${Math.min(100, Math.max(0, coveragePct))}%` }}
                    />
                  </div>
                </div>
              )}
            </Panel>
          </div>

          {/* Orphan list */}
          {audit.orphanTransactionIds.length > 0 && (
            <Panel
              title={
                <span className="flex flex-wrap items-center gap-2">
                  <Pill tone="red" dot>Orphans</Pill>
                  <span>Paid transactions missing a journal entry</span>
                </span>
              }
              extra={
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {audit.orphanTransactionIds.length} listed (max 500)
                </span>
              }
            >
              <div className="flex max-h-64 flex-wrap gap-1.5 overflow-y-auto" aria-label="Orphan transaction IDs">
                {audit.orphanTransactionIds.map((id) => (
                  <code
                    key={id}
                    className="rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-700 dark:bg-white/[0.06] dark:text-gray-300"
                  >
                    {id}
                  </code>
                ))}
              </div>
            </Panel>
          )}

          {/* Last backfill result */}
          {lastBackfill && (
            <Panel
              title="Last Backfill"
              extra={
                lastBackfill.failed > 0 ? (
                  <Pill tone="red" dot>{lastBackfill.failed} failed</Pill>
                ) : (
                  <Pill tone="emerald" dot>All succeeded</Pill>
                )
              }
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MiniStat label="Total" value={lastBackfill.total} />
                <MiniStat label="Succeeded" value={lastBackfill.success} tone="emerald" />
                <MiniStat label="Failed" value={lastBackfill.failed} tone={lastBackfill.failed > 0 ? "red" : "emerald"} />
                <MiniStat label="Errors" value={lastBackfill.errors.length} />
              </div>
              {lastBackfill.errors.length > 0 && (
                <div className="mt-4 rounded-xl border border-red-100 bg-red-50/60 p-4 dark:border-red-500/20 dark:bg-red-500/10">
                  <div className="text-sm font-semibold text-red-700 dark:text-red-300">Errors:</div>
                  <ul className="mb-0 mt-2 list-disc space-y-1 pl-5">
                    {lastBackfill.errors.slice(0, 20).map((e, i) => (
                      <li key={i} className="break-words text-xs text-gray-600 dark:text-gray-400">{e}</li>
                    ))}
                    {lastBackfill.errors.length > 20 && (
                      <li className="text-xs text-gray-400 dark:text-gray-500">
                        ...and {lastBackfill.errors.length - 20} more
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </Panel>
          )}
        </>
      )}

      {!audit && !loading && (
        <Panel>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span className="text-gray-500 dark:text-gray-400">
                Pick a period and click <strong>Run Audit</strong> to see how well the books match.
              </span>
            }
          />
        </Panel>
      )}
    </div>
  );
}
