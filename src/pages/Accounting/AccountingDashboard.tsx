// Accounting Dashboard
// ====================
// The owners' one-page view of the business for a period:
//   • Owner Summary — Rami's numbered tiles 1–16 (the owners refer to them by
//     number): cash, revenue, expenses, nets, F&B, TCG, gaming, drawings.
//     Every tile opens a drill-down.
//   • Revenue mix, a P&L statement, expenses and assets.
//   • Books status, recent journal entries and the backfill admin tools.
//
// Filtering: sales by payment date; expenses and assets by their period,
// prorated by overlap days (annual rent shows ~1/12 in a monthly filter).
// The trial balance stays all-time so drift in the books always shows.

import React, { useCallback, useEffect, useState } from "react";
import { Button, DatePicker, Empty, Segmented, Skeleton, Table, Tooltip, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  BookOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  FileTextOutlined,
  FundOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  RightOutlined,
  ToolOutlined,
} from "@ant-design/icons";
import dayjs, { Dayjs } from "dayjs";
import { useNavigate } from "react-router";

import { searchJournalEntries } from "../../services/journalApi";
import { getTrialBalance } from "../../services/accountsApi";
import {
  getAccountingDashboard,
  AccountingDashboardDto,
  ExpenseCategoryLineDto,
  backfillTransactions,
  backfillExpenses,
  BackfillResultDto,
} from "../../services/accountingService";
import type { JournalEntry } from "../../services/accounting";
import { getInventoryValuation } from "../../services/inventoryValuationService";
import { getItemRevenueReport } from "../../services/itemRevenueReportService";
import CashOnHandCard from "../../components/dashboard/CashOnHandCard";
import { PageHeader, Panel, Pill } from "../../components/ui/PageKit";
import MetricTile from "../../components/Accounting/dashboard/MetricTile";
import BreakdownModal from "../../components/Accounting/dashboard/BreakdownModal";
import IngredientCogsPanel from "../../components/Accounting/dashboard/IngredientCogsPanel";

const { RangePicker } = DatePicker;

const money = (n: number) =>
  `${n < 0 ? "−" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n: number) => `${n.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;

const PERIODS: { key: string; label: string; range: () => [Dayjs, Dayjs] }[] = [
  { key: "month", label: "This month", range: () => [dayjs().startOf("month"), dayjs().endOf("day")] },
  { key: "last", label: "Last month", range: () => [dayjs().subtract(1, "month").startOf("month"), dayjs().subtract(1, "month").endOf("month")] },
  { key: "30", label: "Last 30 days", range: () => [dayjs().subtract(30, "day").startOf("day"), dayjs().endOf("day")] },
  { key: "90", label: "Last 90 days", range: () => [dayjs().subtract(90, "day").startOf("day"), dayjs().endOf("day")] },
  { key: "year", label: "This year", range: () => [dayjs().startOf("year"), dayjs().endOf("day")] },
];

// Revenue streams, fixed order + validated colour-blind-safe colours, so a
// stream keeps its colour whatever the numbers do.
const STREAMS = [
  { key: "gaming", label: "Gaming", color: "#2a78d6", metric: "gaming" },
  { key: "fnb", label: "F&B", color: "#eb6834", metric: "fnb" },
  { key: "tcg", label: "TCG / Retail", color: "#1baf7a", metric: "tcg" },
  { key: "events", label: "Event tickets", color: "#eda100", metric: "revenue" },
] as const;

// ── Small pieces ────────────────────────────────────────────────────────

function SectionTitle({ title, hint, right }: { title: string; hint?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="text-[15px] font-semibold text-gray-900 dark:text-white">{title}</h2>
        {hint && <p className="text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
      </div>
      {right}
    </div>
  );
}

/** One line of the P&L statement. */
function PnlRow({ label, value, sign, strong, sub, onClick, tone }: {
  label: string; value: number; sign?: "+" | "−" | "="; strong?: boolean; sub?: React.ReactNode; onClick?: () => void; tone?: "pos" | "neg";
}) {
  const color = tone === "neg" || (strong && value < 0) ? "text-rose-600 dark:text-rose-400" : strong ? "text-gray-900 dark:text-white" : "text-gray-700 dark:text-gray-300";
  return (
    <div
      onClick={onClick}
      className={`flex items-baseline justify-between gap-3 px-1 py-2.5 ${strong ? "border-t border-gray-200 dark:border-white/10" : ""} ${onClick ? "-mx-1 cursor-pointer rounded-lg px-2 hover:bg-gray-50 dark:hover:bg-white/5" : ""}`}
    >
      <div className="min-w-0">
        <div className={`flex items-center gap-2 ${strong ? "font-semibold text-gray-900 dark:text-white" : "text-sm text-gray-600 dark:text-gray-300"}`}>
          {sign && <span className="w-3 text-center text-gray-400">{sign}</span>}
          {label}
          {onClick && <RightOutlined className="text-[9px] text-gray-300" />}
        </div>
        {sub && <div className="ml-5 text-[11px] text-gray-500">{sub}</div>}
      </div>
      <span className={`whitespace-nowrap tabular-nums ${strong ? "text-lg font-semibold" : "text-sm font-medium"} ${color}`}>{money(value)}</span>
    </div>
  );
}

/** Ranked horizontal bars (single series). */
function RankedBars({ lines, total, color, onOpen }: { lines: ExpenseCategoryLineDto[]; total: number; color: string; onOpen?: () => void }) {
  const [showAll, setShowAll] = useState(false);
  const sorted = [...lines].sort((a, b) => b.amount - a.amount);
  const shown = showAll ? sorted : sorted.slice(0, 8);
  const max = sorted[0]?.amount ?? 0;
  return (
    <div>
      <ul className="space-y-2.5">
        {shown.map((l) => (
          <li key={l.category} className="group">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate text-gray-700 dark:text-gray-300">{l.category}</span>
              <span className="whitespace-nowrap tabular-nums">
                <span className="font-semibold text-gray-900 dark:text-gray-100">{money(l.amount)}</span>
                <span className="ml-2 inline-block w-10 text-right text-xs text-gray-400">{total > 0 ? `${Math.round((l.amount / total) * 100)}%` : ""}</span>
              </span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-gray-100 dark:bg-white/10">
              <div className="h-full rounded-full" style={{ width: `${max > 0 ? (l.amount / max) * 100 : 0}%`, background: color }} />
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-center justify-between">
        {sorted.length > 8 ? (
          <button type="button" onClick={() => setShowAll((v) => !v)} className="text-xs font-medium text-violet-700 hover:underline dark:text-violet-300">
            {showAll ? "Show top 8" : `Show all ${sorted.length}`}
          </button>
        ) : <span />}
        {onOpen && (
          <button type="button" onClick={onOpen} className="text-xs font-medium text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
            Breakdown <RightOutlined className="text-[9px]" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────

const AccountingDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [backfillLoading, setBackfillLoading] = useState<"tx" | "exp" | null>(null);
  const [backfillResult, setBackfillResult] = useState<BackfillResultDto | null>(null);

  const [loading, setLoading] = useState(false);
  const [dashboard, setDashboard] = useState<AccountingDashboardDto | null>(null);
  const [recentEntries, setRecentEntries] = useState<JournalEntry[]>([]);
  const [isBalanced, setIsBalanced] = useState<boolean | null>(null);

  // Owner-summary extras: F&B stock value and TCG stock buy/sell + TCG COGS
  // from the Item Revenue Report (Rami's source of truth for TCG, tile 12).
  const [inventoryValue, setInventoryValue] = useState(0);
  const [tcgStockBuy, setTcgStockBuy] = useState(0);
  const [tcgStockSell, setTcgStockSell] = useState(0);
  const [tcgCogsFromReport, setTcgCogsFromReport] = useState(0);

  const [period, setPeriod] = useState("month");
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>(PERIODS[0].range());

  // Drill-downs
  const [bd, setBd] = useState<string | null>(null);
  const [cogsOpen, setCogsOpen] = useState(0);

  const fromIso = dateRange[0].toISOString();
  const toIso = dateRange[1].toISOString();

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      // Extra owner-summary sources run in parallel and fail soft — a hiccup
      // on one must not blank the page.
      const invPromise = getInventoryValuation(fromIso, toIso).catch(() => null);
      // Item report takes [from, to) instants — send the END of the last day.
      const itemReportPromise = getItemRevenueReport({
        from: dateRange[0].startOf("day").toISOString(),
        to: dateRange[1].endOf("day").toISOString(),
      }).catch(() => null);

      const [dashboardData, trialBalance, entriesResult, inv, itemReport] = await Promise.all([
        getAccountingDashboard(fromIso, toIso),
        getTrialBalance(), // all-time on purpose
        searchJournalEntries({ pageNumber: 1, pageSize: 6, fromDate: fromIso, toDate: toIso }),
        invPromise,
        itemReportPromise,
      ]);

      setDashboard(dashboardData);
      setIsBalanced(trialBalance.isBalanced);
      setRecentEntries(entriesResult.items);
      setInventoryValue(inv?.totalValue ?? 0);
      setTcgStockBuy(itemReport?.tcgStockBuyValue ?? 0);
      setTcgStockSell(itemReport?.tcgStockSellValue ?? 0);
      setTcgCogsFromReport(itemReport?.tcgCogs ?? 0);
    } catch (error) {
      message.error("Failed to load dashboard data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [fromIso, toIso, dateRange]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  // ── Derived ─────────────────────────────────────────────────────────
  const revenue = dashboard?.revenue;
  const opEx = dashboard?.operatingExpenses;
  const capEx = dashboard?.capitalExpenses;
  const cogs = dashboard?.cogs;
  const totalRevenue = revenue?.total ?? 0;
  const opexTotal = opEx?.total ?? 0;
  const ingredientCogs = cogs?.ingredientCogs ?? 0;
  const foodCostPercent = cogs?.foodCostPercent ?? 0;
  const tcgRevenue = revenue?.tcg ?? 0;
  const fnbRevenue = revenue?.fnb ?? 0;

  // Tile 4 (Rami's spec): Total Revenue − Operating Expenses — no COGS.
  const netSimple = totalRevenue - opexTotal;
  // The P&L statement's net income also takes off COGS.
  const netAfterCogs = dashboard?.netIncome ?? 0;
  const grossProfit = dashboard?.grossProfit ?? 0;
  const netMargin = dashboard?.netMarginPercent ?? 0;
  const fnbNet = fnbRevenue - ingredientCogs;
  const tcgNet = tcgRevenue - tcgCogsFromReport;
  const discounts = revenue?.discountsGiven ?? 0;
  const first = loading && !dashboard;

  const streamValues = STREAMS.map((s) => ({ ...s, value: Math.max(0, (revenue?.[s.key] as number | null | undefined) ?? 0) }))
    .filter((s) => s.key !== "events" || s.value > 0);
  const streamSum = streamValues.reduce((a, s) => a + s.value, 0);

  const postedCount = recentEntries.filter((e) => e.isPosted && !e.isVoided).length;
  const draftCount = recentEntries.filter((e) => !e.isPosted && !e.isVoided).length;

  const runBackfill = async (kind: "tx" | "exp") => {
    setBackfillLoading(kind);
    setBackfillResult(null);
    try {
      const result = kind === "tx" ? await backfillTransactions() : await backfillExpenses();
      setBackfillResult(result);
      message.success(`${kind === "tx" ? "Transactions" : "Expenses"} backfill done: ${result.success} created, ${result.failed} failed`);
      loadDashboard();
    } catch {
      message.error("Backfill failed");
    } finally {
      setBackfillLoading(null);
    }
  };

  const entryColumns: ColumnsType<JournalEntry> = [
    {
      title: "Entry",
      dataIndex: "entryNumber",
      width: 150,
      render: (v: string, r) => (
        <div>
          <code className="text-xs text-gray-700 dark:text-gray-300">{v}</code>
          <div className="text-[11px] text-gray-400">{dayjs(r.entryDate).format("MMM D, YYYY")}</div>
        </div>
      ),
    },
    { title: "Description", dataIndex: "description", ellipsis: true },
    { title: "Amount", dataIndex: "totalAmount", width: 130, align: "right", render: (v: number) => <span className="font-semibold tabular-nums">{money(v)}</span> },
    {
      title: "Status",
      key: "status",
      width: 110,
      render: (_, r) =>
        r.isVoided ? <Pill tone="red" dot>Voided</Pill> : r.isPosted ? <Pill tone="emerald" dot>Posted</Pill> : <Pill tone="amber" dot>Draft</Pill>,
    },
  ];

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 p-4 sm:p-6">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <PageHeader
        tone="violet"
        icon={<FundOutlined />}
        title="Accounting"
        description="Revenue, costs and cash for the period. Click any figure to see what it is made of."
        actions={
          <>
            <Tooltip title="Refresh">
              <Button icon={<ReloadOutlined />} onClick={loadDashboard} loading={loading} aria-label="Refresh" />
            </Tooltip>
            <Button icon={<BookOutlined />} onClick={() => navigate("/accounting/trial-balance")}>Trial balance</Button>
            <Button icon={<FileTextOutlined />} onClick={() => navigate("/accounting/accounts/new")}>New account</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/accounting/journal/new")}>Journal entry</Button>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="max-w-full overflow-x-auto">
            <Segmented
              value={period}
              onChange={(k) => {
                const p = PERIODS.find((x) => x.key === k);
                setPeriod(String(k));
                if (p) setDateRange(p.range());
              }}
              options={[...PERIODS.map((p) => ({ label: p.label, value: p.key })), { label: "Custom", value: "custom" }]}
            />
          </div>
          <RangePicker
            value={dateRange}
            allowClear={false}
            onChange={(v) => { if (v && v[0] && v[1]) { setDateRange([v[0], v[1]]); setPeriod("custom"); } }}
          />
          <Tooltip
            title="Sales are filtered by payment date. Expenses and assets by their period, prorated by overlap days — a $90k annual rent shows as $7,500 in a monthly filter. The trial balance stays all-time so drift in the books always shows."
          >
            <span className="inline-flex cursor-help items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <InfoCircleOutlined /> How the period works
            </span>
          </Tooltip>
        </div>
      </PageHeader>

      {/* ── Headline: 1–4 ──────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="md:col-span-2">
          <CashOnHandCard
            fromIso={fromIso}
            toIso={toIso}
            mode="hero"
            cashOverride={dashboard?.cashOnHand ?? null}
            onBaselineSaved={loadDashboard}
            onDetails={() => setBd("cash")}
          />
        </div>
        {first ? (
          [0, 1, 2].map((i) => <div key={i} className="rounded-xl border border-gray-200/80 bg-white p-4 dark:border-white/[0.06] dark:bg-white/[0.03]"><Skeleton active paragraph={{ rows: 2 }} /></div>)
        ) : (
          <>
            <MetricTile n={2} kind="revenue" emphasis label="Total revenue" value={money(totalRevenue)} onClick={() => setBd("revenue")}
              sub={discounts > 0 ? `${money(discounts)} given as discount` : "Net of discounts"} />
            <MetricTile n={3} kind="cost" emphasis label="Operating expenses" value={money(opexTotal)} onClick={() => setBd("opex")}
              sub={totalRevenue > 0 ? `${pct((opexTotal / totalRevenue) * 100)} of revenue` : "Prorated to the period"} />
            <MetricTile n={4} kind="net" emphasis label="Net income" value={money(netSimple)} negative={netSimple < 0} onClick={() => setBd("net")}
              tooltip="Total Revenue − Operating Expenses (does not include COGS — see F&B Net and TCG Net for those)."
              sub={totalRevenue > 0 ? `${pct((netSimple / totalRevenue) * 100)} margin` : undefined} />
          </>
        )}
      </div>

      {/* ── Revenue mix + P&L ──────────────────────────────────────── */}
      <div className="grid gap-6 xl:grid-cols-5">
        <Panel className="xl:col-span-3" title="Revenue mix" subtitle="Where the period's revenue came from (net of discounts)">
          {first ? <Skeleton active /> : streamSum === 0 ? <Empty description="No revenue in this period" /> : (
            <div className="space-y-5">
              {/* Stacked bar — 2px gaps, labels inside wide segments only */}
              <div className="flex h-9 w-full gap-[2px] overflow-hidden rounded-lg">
                {streamValues.filter((s) => s.value > 0).map((s) => {
                  const share = (s.value / streamSum) * 100;
                  return (
                    <Tooltip key={s.key} title={`${s.label}: ${money(s.value)} · ${pct(share)}`}>
                      <div
                        className="flex h-full cursor-pointer items-center justify-center text-xs font-semibold text-white transition hover:opacity-90 [text-shadow:0_1px_1px_rgba(0,0,0,.25)]"
                        style={{ width: `${share}%`, background: s.color }}
                        onClick={() => setBd(s.metric)}
                      >
                        {share >= 9 ? `${Math.round(share)}%` : ""}
                      </div>
                    </Tooltip>
                  );
                })}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {streamValues.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setBd(s.metric)}
                    className="rounded-xl border border-gray-100 p-3 text-left transition hover:border-gray-200 hover:bg-gray-50 dark:border-white/[0.06] dark:hover:bg-white/5"
                  >
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
                      {s.label}
                    </div>
                    <div className="mt-1 text-lg font-semibold tabular-nums text-gray-900 dark:text-white">{money(s.value)}</div>
                    <div className="text-xs tabular-nums text-gray-500">{streamSum > 0 ? pct((s.value / streamSum) * 100) : "—"} of revenue</div>
                  </button>
                ))}
              </div>

              {(revenue?.totalGross ?? 0) > totalRevenue && (
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-gray-50 px-4 py-3 text-sm dark:bg-white/[0.03]">
                  <Tooltip title="Sum of menu prices before any discount. Matches the credit side on 4xxx Revenue accounts.">
                    <span className="cursor-help text-gray-500">Gross <b className="tabular-nums text-gray-900 dark:text-white">{money(revenue?.totalGross ?? 0)}</b></span>
                  </Tooltip>
                  <Tooltip title="Percentage discounts applied at the cashier. Booked to 4900 Sales Discounts (contra-revenue).">
                    <button type="button" onClick={() => setBd("discounts")} className="text-gray-500 hover:underline">
                      − Discounts <b className="tabular-nums text-rose-600">{money(discounts)}</b>
                    </button>
                  </Tooltip>
                  <Tooltip title="What customers actually paid. Matches the debit side on 1000 Cash on Hand.">
                    <span className="cursor-help text-gray-500">= Net <b className="tabular-nums text-emerald-700 dark:text-emerald-400">{money(totalRevenue)}</b></span>
                  </Tooltip>
                  <span className="ml-auto text-xs text-gray-400">{pct((discounts / (revenue?.totalGross || 1)) * 100)} given away</span>
                </div>
              )}
            </div>
          )}
        </Panel>

        <Panel className="xl:col-span-2" title="Profit & loss" subtitle="Accrual view for the period, including cost of goods sold">
          {first ? <Skeleton active /> : (
            <div>
              <PnlRow label="Revenue (net)" value={totalRevenue} onClick={() => setBd("revenue")} />
              <PnlRow
                sign="−"
                label="Cost of goods sold"
                value={cogs?.total ?? 0}
                sub={<>TCG {money(cogs?.tcgCogs ?? 0)} · Ingredients {money(ingredientCogs)}</>}
              />
              <PnlRow sign="=" strong label="Gross profit" value={grossProfit}
                sub={totalRevenue > 0 ? `${pct((grossProfit / totalRevenue) * 100)} gross margin` : undefined} />
              <PnlRow sign="−" label="Operating expenses" value={opexTotal} onClick={() => setBd("opex")} />
              <PnlRow sign="=" strong label="Net income" value={netAfterCogs} />
              <div className="mt-2">
                <div className="h-2 rounded-full bg-gray-100 dark:bg-white/10">
                  <div className={`h-full rounded-full ${netAfterCogs >= 0 ? "bg-emerald-500" : "bg-rose-500"}`} style={{ width: `${Math.min(100, Math.abs(netMargin))}%` }} />
                </div>
                <div className="mt-1 flex justify-between text-xs text-gray-500">
                  <span>{netAfterCogs >= 0 ? "Profit" : "Loss"} margin</span>
                  <span className="font-semibold tabular-nums text-gray-800 dark:text-gray-200">{netMargin.toFixed(1)}%</span>
                </div>
              </div>
              <p className="mt-3 text-[11px] text-gray-400">
                Tile 4 above is Revenue − Operating expenses (no COGS), per the Owner Summary spec.
              </p>
            </div>
          )}
        </Panel>
      </div>

      {/* ── Food & Beverage: 6–10 ──────────────────────────────────── */}
      <section>
        <SectionTitle title="Food & Beverage" hint="Revenue, ingredient cost and stock on the shelves" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <MetricTile n={6} kind="revenue" label="F&B revenue" value={money(fnbRevenue)} onClick={() => setBd("fnb")}
            sub={totalRevenue > 0 ? `${pct((fnbRevenue / totalRevenue) * 100)} of revenue` : undefined} />
          <MetricTile n={7} kind="cost" label="Ingredients COGS" value={money(ingredientCogs)} onClick={() => setCogsOpen((n) => n + 1)}
            sub="Opens the per-ingredient breakdown" />
          <MetricTile n={8} kind="net" label="F&B net" value={money(fnbNet)} negative={fnbNet < 0} onClick={() => setBd("fnbnet")}
            tooltip="F&B Revenue − Ingredient COGS" />
          <MetricTile n={9} kind="ratio" label="Food cost %" value={pct(foodCostPercent)} onClick={() => setBd("foodcost")}
            tooltip="Ingredient COGS ÷ sales revenue × 100. Target: 28–35% for full-service F&B."
            sub={foodCostPercent > 35 ? "Above the 28–35% target" : foodCostPercent > 28 ? "Within the 28–35% target" : foodCostPercent > 0 ? "Below 28%" : undefined} />
          <MetricTile n={10} kind="valuation" label="Inventory valuation" value={money(inventoryValue)} onClick={() => setBd("inventory")}
            tooltip="Current ingredient stock value at latest buy cost. Money sitting on shelves." />
        </div>
        <div className="mt-3">
          <IngredientCogsPanel fromIso={fromIso} toIso={toIso} forceOpen={cogsOpen} />
        </div>
      </section>

      {/* ── TCG Retail: 11–15 ──────────────────────────────────────── */}
      <section>
        <SectionTitle title="TCG / Retail" hint="Cards and shelf goods — COGS and stock from the Item Revenue Report" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <MetricTile n={11} kind="revenue" label="TCG retail revenue" value={money(tcgRevenue)} onClick={() => setBd("tcg")} />
          <MetricTile n={12} kind="cost" label="TCG cost of goods sold" value={money(tcgCogsFromReport)} onClick={() => setBd("tcgcogs")} />
          <MetricTile n={13} kind="net" label="TCG net" value={money(tcgNet)} negative={tcgNet < 0} onClick={() => setBd("tcgnet")}
            tooltip="TCG Retail Revenue − TCG COGS"
            sub={tcgRevenue > 0 ? `${pct((tcgNet / tcgRevenue) * 100)} margin` : undefined} />
          <MetricTile n={14} kind="valuation" label="TCG stock buy" value={money(tcgStockBuy)} onClick={() => setBd("tcgstockbuy")}
            tooltip="What we paid for TCG stock currently on hand (cost basis)." />
          <MetricTile n={15} kind="valuation" label="TCG stock sell" value={money(tcgStockSell)} onClick={() => setBd("tcgstocksell")}
            tooltip="What TCG stock on hand would generate at retail price if fully sold."
            sub={tcgStockBuy > 0 ? `${money(tcgStockSell - tcgStockBuy)} potential margin` : undefined} />
        </div>
      </section>

      {/* ── Gaming 5 · Owners 16 · Books ───────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-3">
        <section className="flex flex-col">
          <SectionTitle title="Gaming" />
          <div className="flex-1">
          <MetricTile n={5} kind="revenue" label="Gaming revenue" value={money(revenue?.gaming ?? 0)} onClick={() => setBd("gaming")}
            sub={totalRevenue > 0 ? `${pct(((revenue?.gaming ?? 0) / totalRevenue) * 100)} of revenue` : undefined} />
          </div>
        </section>
        <section className="flex flex-col">
          <SectionTitle title="Owners" right={
            <button type="button" onClick={() => navigate("/accounting/owners-drawings")} className="text-xs font-medium text-violet-700 hover:underline dark:text-violet-300">
              Owners' Drawings <RightOutlined className="text-[9px]" />
            </button>
          } />
          <div className="flex-1">
          <MetricTile n={16} kind="ratio" label="Owners' drawings" value={money(dashboard?.ownerDrawings ?? 0)} onClick={() => setBd("drawings")}
            tooltip="Cash the owners took out in the period, per owner with their share and fair share. Reduces equity and Cash on Hand — not an expense, so Net Income is unaffected."
            sub="Equity — not an expense" />
          </div>
        </section>
        <section className="flex flex-col">
          <SectionTitle title="Books" right={
            <button type="button" onClick={() => navigate("/accounting/trial-balance")} className="text-xs font-medium text-violet-700 hover:underline dark:text-violet-300">
              Trial balance <RightOutlined className="text-[9px]" />
            </button>
          } />
          <div
            className={`flex min-h-[104px] flex-1 items-center gap-4 rounded-xl border p-4 ${
              isBalanced === false
                ? "border-rose-200 bg-rose-50 dark:border-rose-500/20 dark:bg-rose-500/10"
                : "border-emerald-200 bg-emerald-50/70 dark:border-emerald-500/20 dark:bg-emerald-500/10"
            }`}
          >
            {isBalanced === null ? <Skeleton active paragraph={false} /> : (
              <>
                <span className={`text-3xl ${isBalanced ? "text-emerald-500" : "text-rose-500"}`}>
                  {isBalanced ? <CheckCircleFilled /> : <CloseCircleFilled />}
                </span>
                <div>
                  <div className={`text-lg font-semibold ${isBalanced ? "text-emerald-800 dark:text-emerald-300" : "text-rose-800 dark:text-rose-300"}`}>
                    {isBalanced ? "Books balanced" : "Books not balanced"}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    {isBalanced ? "Debits equal credits (all time)." : "Debits ≠ credits — review journal entries."}
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      {/* ── Expenses + Assets ──────────────────────────────────────── */}
      <div className="grid gap-6 xl:grid-cols-5">
        <Panel
          className="xl:col-span-3"
          title="Operating expenses"
          subtitle="Recurring costs whose period overlaps the range, prorated by overlap days"
          extra={<span className="text-lg font-semibold tabular-nums text-gray-900 dark:text-white">{money(opexTotal)}</span>}
        >
          {first ? <Skeleton active /> : (opEx?.lines?.length ?? 0) === 0 ? <Empty description="No operating expenses in this period" /> : (
            <RankedBars lines={opEx!.lines} total={opexTotal} color="#e34948" onOpen={() => setBd("opex")} />
          )}
        </Panel>
        <Panel
          className="xl:col-span-2"
          title="Assets"
          subtitle="One-time purchases (furniture, equipment, civil work) — not in the operating P&L"
          extra={<span className="text-lg font-semibold tabular-nums text-gray-900 dark:text-white">{money(capEx?.total ?? 0)}</span>}
        >
          {first ? <Skeleton active /> : (capEx?.lines?.length ?? 0) === 0 ? <Empty description="No assets in this period" /> : (
            <RankedBars lines={capEx!.lines} total={capEx!.total} color="#4a3aa7" />
          )}
        </Panel>
      </div>

      {/* ── Journal + admin ────────────────────────────────────────── */}
      <div className="grid gap-6 xl:grid-cols-5">
        <Panel
          className="xl:col-span-3"
          title="Recent journal entries"
          subtitle="Latest in the period"
          bodyClassName="p-0"
          extra={
            <div className="flex items-center gap-2">
              <Pill tone="emerald" dot>{postedCount} posted</Pill>
              <Pill tone="amber" dot>{draftCount} draft</Pill>
              <Button type="link" size="small" onClick={() => navigate("/accounting/journal")}>View all</Button>
            </div>
          }
        >
          <Table
            columns={entryColumns}
            dataSource={recentEntries}
            rowKey="id"
            pagination={false}
            size="middle"
            loading={first}
            scroll={{ x: 560 }}
            locale={{ emptyText: <Empty description="No journal entries in this period" /> }}
          />
        </Panel>

        <Panel
          className="xl:col-span-2"
          title={<span className="flex items-center gap-2"><ToolOutlined /> Journal entry backfill</span>}
          subtitle="Admin tool — creates missing journal entries for past sales and expenses"
        >
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Safe to run more than once — entries that already exist are skipped (or re-pointed if a mapping changed).
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button danger type="primary" loading={backfillLoading === "tx"} disabled={!!backfillLoading} onClick={() => runBackfill("tx")}>
              Backfill transactions
            </Button>
            <Button loading={backfillLoading === "exp"} disabled={!!backfillLoading} onClick={() => runBackfill("exp")}>
              Backfill expenses
            </Button>
          </div>

          {backfillResult && (
            <div className="mt-4 rounded-xl bg-gray-50 p-4 dark:bg-white/[0.03]">
              <div className="grid grid-cols-4 gap-3 text-center">
                {[
                  { label: "Found", value: backfillResult.total, cls: "text-gray-900 dark:text-white" },
                  { label: "Created", value: backfillResult.success, cls: "text-emerald-600" },
                  { label: "Failed", value: backfillResult.failed, cls: backfillResult.failed > 0 ? "text-rose-600" : "text-emerald-600" },
                  { label: "Existed", value: backfillResult.total - backfillResult.success - backfillResult.failed, cls: "text-blue-600" },
                ].map((s) => (
                  <div key={s.label}>
                    <div className={`text-xl font-semibold tabular-nums ${s.cls}`}>{s.value}</div>
                    <div className="text-[11px] text-gray-500">{s.label}</div>
                  </div>
                ))}
              </div>
              {backfillResult.failed > 0 && backfillResult.errors.length > 0 && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-medium text-rose-600">Show {backfillResult.errors.length} error(s)</summary>
                  <div className="mt-2 max-h-48 overflow-y-auto rounded-lg bg-rose-50 p-2 font-mono text-[11px] text-rose-800 dark:bg-rose-500/10 dark:text-rose-300">
                    {backfillResult.errors.map((e, i) => <div key={i}>{e}</div>)}
                  </div>
                </details>
              )}
            </div>
          )}
        </Panel>
      </div>

      <BreakdownModal metric={bd} fromIso={fromIso} toIso={toIso} onClose={() => setBd(null)} onOpenCogs={() => setCogsOpen((n) => n + 1)} />
    </div>
  );
};

export default AccountingDashboard;
