// Accounting → Item Revenue
// =========================
// Per-item sales, cost and stock for a period. The numbers come from the
// server (ItemRevenueReportService) which reconstructs each line's revenue
// from what was actually paid — item invoices AND items added to game
// sessions — and prices COGS from BuyPrice or the recipe's ingredient cost.
//
// "Live": the page re-fetches every 30s while it is visible, and the
// Recalculate button forces a fresh pull at any time. Dates are the venue's
// local days (sent as instants), so "Today" is really today.

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Button, DatePicker, Empty, Segmented, Select, Skeleton, Switch } from "antd";
import {
    AppstoreOutlined,
    BarChartOutlined,
    CoffeeOutlined,
    DollarOutlined,
    DownloadOutlined,
    FallOutlined,
    FilterOutlined,
    InboxOutlined,
    ReloadOutlined,
    RiseOutlined,
    ShoppingCartOutlined,
    SwapOutlined,
    TagsOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import {
    getItemRevenueReport,
    ItemRevenueReportDto,
} from "../../services/itemRevenueReportService";
import { getCategories } from "../../services/categoryService";
import { PageHeader, Panel, StatTile } from "../../components/ui/PageKit";
import CategoryGroupPanel from "../../components/Accounting/itemRevenue/CategoryGroupPanel";
import StreamPanel from "../../components/Accounting/itemRevenue/StreamPanel";
import NoCostCallout from "../../components/Accounting/itemRevenue/NoCostCallout";
import MarginPill from "../../components/Accounting/itemRevenue/MarginPill";
import { money as fmt, profitCls, STREAM_COLOR } from "../../components/Accounting/itemRevenue/format";
import type { SortDir, SortKey } from "../../components/Accounting/itemRevenue/format";

const { RangePicker } = DatePicker;

// ─── helpers ────────────────────────────────────────────────────────────────

/** yyyy-mm-dd of a Date in LOCAL time (toISOString would give the UTC day). */
const localYmd = (d: Date) => {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** Local midnight of a yyyy-mm-dd, as a Date. */
const localMidnight = (ymd: string, plusDays = 0) => {
    const [y, m, d] = ymd.split("-").map(Number);
    return new Date(y, m - 1, d + plusDays, 0, 0, 0, 0);
};

const REFRESH_MS = 30_000;
const ALL_TIME_FROM = "2025-07-01";

// ─── types ──────────────────────────────────────────────────────────────────
type CategoryOption = { id: number; name: string };
type Tab = "all" | "tcg" | "fnb";

// ─── small pieces ───────────────────────────────────────────────────────────

const ACCENT = {
    emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300",
    red: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300",
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300",
    violet: "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300",
    gray: "bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-300",
} as const;

function Accent({ tone, children }: { tone: keyof typeof ACCENT; children: ReactNode }) {
    return <span className={`rounded-lg p-1.5 text-sm leading-none ${ACCENT[tone]}`} aria-hidden>{children}</span>;
}

/** KPI value — slightly smaller than the tile default so full amounts fit. */
function Kpi({ children, className = "" }: { children: ReactNode; className?: string }) {
    return <span className={`block truncate text-2xl tabular-nums ${className}`}>{children}</span>;
}

function TotalCell({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="min-w-0">
            <div className="text-[11px] font-medium text-gray-500 dark:text-gray-400">{label}</div>
            <div className="mt-0.5 truncate text-lg font-semibold tabular-nums text-gray-900 dark:text-white">{children}</div>
        </div>
    );
}

// ─── main page ───────────────────────────────────────────────────────────────
export default function ItemRevenueReport() {
    const [report, setReport] = useState<ItemRevenueReportDto | null>(null);
    const [loading, setLoading] = useState(false);      // first load / filter change → full loader
    const [refreshing, setRefreshing] = useState(false); // background refresh → keep the table, spin the pill
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    // Filters (draft vs applied)
    const [fromDate, setFromDate] = useState(() => localYmd(new Date(Date.now() - 30 * 86400000)));
    const [toDate, setToDate] = useState(() => localYmd(new Date()));
    const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
    const [applied, setApplied] = useState<{ from: string; to: string; categoryIds: number[] }>(() => ({
        from: localYmd(new Date(Date.now() - 30 * 86400000)),
        to: localYmd(new Date()),
        categoryIds: [],
    }));

    // Live refresh
    const [live, setLive] = useState(true);

    // Sort / view
    const [sortKey, setSortKey] = useState<SortKey>("revenue");
    const [sortDir, setSortDir] = useState<SortDir>("desc");
    const [showZeroSales, setShowZeroSales] = useState(false);
    const [activeTab, setActiveTab] = useState<Tab>("all");

    useEffect(() => {
        getCategories(1, 100)
            .then((res) => {
                const opts = (res.data || [])
                    .filter((c: { type?: string }) => c.type === "item")
                    .map((c: { id: number; name: string }) => ({ id: c.id, name: c.name }));
                setCategoryOptions(opts);
            })
            .catch(() => { /* category picker just stays empty */ });
    }, []);

    // One in-flight request at a time; a newer filter wins over an older reply.
    const reqSeq = useRef(0);
    const fetchReport = useCallback(async (silent: boolean) => {
        const seq = ++reqSeq.current;
        if (silent) setRefreshing(true); else setLoading(true);
        try {
            const data = await getItemRevenueReport({
                from: localMidnight(applied.from).toISOString(),
                to: localMidnight(applied.to, 1).toISOString(),   // exclusive: next local midnight
                categoryIds: applied.categoryIds.length > 0 ? applied.categoryIds : undefined,
            });
            if (seq !== reqSeq.current) return;
            setReport(data);
            setLastUpdated(new Date());
            setError(null);
        } catch (e: unknown) {
            if (seq !== reqSeq.current) return;
            const msg = e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "";
            setError(msg || "Failed to load report");
        } finally {
            if (seq === reqSeq.current) { setLoading(false); setRefreshing(false); }
        }
    }, [applied]);

    // Full load whenever the applied filters change.
    useEffect(() => { fetchReport(false); }, [fetchReport]);

    // Live: silent refresh on an interval while the tab is visible; also
    // refresh the moment the user comes back to the tab.
    useEffect(() => {
        if (!live) return;
        const tick = () => { if (document.visibilityState === "visible") fetchReport(true); };
        const id = window.setInterval(tick, REFRESH_MS);
        const onVis = () => { if (document.visibilityState === "visible") fetchReport(true); };
        document.addEventListener("visibilitychange", onVis);
        return () => { window.clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
    }, [live, fetchReport]);

    const applyFilters = () => setApplied({ from: fromDate, to: toDate, categoryIds: selectedCategoryIds });

    const applyPreset = (from: string, to: string) => {
        setFromDate(from); setToDate(to);
        setApplied({ from, to, categoryIds: selectedCategoryIds });
    };

    const clearFilters = () => {
        const to = localYmd(new Date());
        const from = localYmd(new Date(Date.now() - 30 * 86400000));
        setSelectedCategoryIds([]);
        setFromDate(from); setToDate(to);
        setApplied({ from, to, categoryIds: [] });
    };

    const toggleCategory = (id: number) =>
        setSelectedCategoryIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        else { setSortKey(key); setSortDir("desc"); }
    };

    const presets: Array<{ label: string; range: () => [string, string] }> = [
        { label: "Today", range: () => { const t = localYmd(new Date()); return [t, t]; } },
        { label: "Yesterday", range: () => { const y = localYmd(new Date(Date.now() - 86400000)); return [y, y]; } },
        { label: "7d", range: () => [localYmd(new Date(Date.now() - 6 * 86400000)), localYmd(new Date())] },
        { label: "30d", range: () => [localYmd(new Date(Date.now() - 29 * 86400000)), localYmd(new Date())] },
        { label: "This month", range: () => { const n = new Date(); return [localYmd(new Date(n.getFullYear(), n.getMonth(), 1)), localYmd(n)]; } },
        { label: "All", range: () => [ALL_TIME_FROM, localYmd(new Date())] },
    ];

    const exportCsv = () => {
        if (!report) return;
        const rows: string[][] = [[
            "Category", "Stream", "Item", "Sell Price", "Unit Cost", "Cost Source",
            "Units Sold", "Units Free", "Gross Revenue", "Discount", "Add-ons", "Net Revenue", "COGS", "Gross Profit", "Margin %",
            "Stock On Hand", "Stock Buy Value", "Stock Sell Value",
        ]];
        report.categories.forEach((cat) => {
            cat.items.forEach((item) => {
                rows.push([
                    cat.categoryName, cat.isTcg ? "TCG/Retail" : "F&B", item.itemName,
                    item.sellPrice.toFixed(2),
                    item.unitCost?.toFixed(4) ?? "",
                    item.costSource,
                    String(item.unitsSold), String(item.unitsGivenFree),
                    item.grossRevenue.toFixed(2), item.discountGiven.toFixed(2), item.addOnRevenue.toFixed(2),
                    item.revenue.toFixed(2), item.cogs.toFixed(2), item.grossProfit.toFixed(2),
                    item.grossMarginPct?.toFixed(1) ?? "",
                    item.isRecipe ? "" : String(item.stockOnHand),
                    item.isRecipe ? "" : item.stockBuyValue.toFixed(2),
                    item.isRecipe ? "" : item.stockSellValue.toFixed(2),
                ]);
            });
        });
        rows.push([
            "GRAND TOTAL", "", "", "", "", "",
            String(report.grandTotalUnitsSold), String(report.grandTotalUnitsGivenFree),
            report.grandTotalGrossRevenue.toFixed(2), report.grandTotalDiscount.toFixed(2), report.grandTotalAddOnRevenue.toFixed(2),
            report.grandTotalRevenue.toFixed(2), report.grandTotalCogs.toFixed(2), report.grandTotalGrossProfit.toFixed(2),
            report.grandGrossMarginPct?.toFixed(1) ?? "",
            "", report.grandTotalStockBuyValue.toFixed(2), report.grandTotalStockSellValue.toFixed(2),
        ]);
        const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `item_revenue_${applied.from}_${applied.to}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const visibleGroups = report?.categories
        .filter((g) => activeTab === "all" ? true : activeTab === "tcg" ? g.isTcg : !g.isTcg)
        .map((g) => ({ ...g, items: showZeroSales ? g.items : g.items.filter((i) => i.unitsSold > 0 || i.unitsGivenFree > 0) }))
        .filter((g) => g.items.length > 0) ?? [];

    // Sold items with no cost at all → COGS is understated; tell the owner.
    const noCostSold = report?.categories.flatMap((g) => g.items).filter((i) => i.unitsSold > 0 && i.costSource === "none") ?? [];
    const noCostRevenue = noCostSold.reduce((s, i) => s + i.revenue, 0);

    // Draft filters that differ from what the report shows (purely a hint;
    // nothing is fetched until Apply).
    const sameIds = (a: number[], b: number[]) => a.length === b.length && a.every((x) => b.includes(x));
    const dirty = fromDate !== applied.from || toDate !== applied.to || !sameIds(selectedCategoryIds, applied.categoryIds);

    const streamDot = (color: string) => <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} aria-hidden />;

    return (
        <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6">
            {/* ── Header + filters ── */}
            <PageHeader
                tone="emerald"
                icon={<BarChartOutlined />}
                title="Item Revenue Report"
                description="What each item really earned — invoices and items on game sessions, net of discounts, with add-ons."
                actions={
                    <>
                        {/* Live pill */}
                        <button
                            type="button"
                            onClick={() => setLive((v) => !v)}
                            aria-pressed={live}
                            title={live ? "Auto-refresh every 30s — click to pause" : "Paused — click to resume live updates"}
                            className={`inline-flex h-8 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ${
                                live
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"
                                    : "border-gray-200 bg-white text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300"}`}
                        >
                            <span className="relative flex h-2.5 w-2.5" aria-hidden>
                                {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
                                <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${live ? "bg-emerald-500" : "bg-gray-400"}`} />
                            </span>
                            {live ? "Live" : "Paused"}
                            {lastUpdated && (
                                <span className="font-normal tabular-nums text-gray-500 dark:text-gray-400">· {refreshing ? "updating…" : lastUpdated.toLocaleTimeString()}</span>
                            )}
                        </button>
                        <Button
                            icon={<ReloadOutlined spin={refreshing} />}
                            onClick={() => fetchReport(true)}
                            disabled={loading || refreshing}
                        >
                            Recalculate
                        </Button>
                        <Button
                            icon={<DownloadOutlined />}
                            onClick={exportCsv}
                            disabled={!report || loading}
                        >
                            Export CSV
                        </Button>
                    </>
                }
            >
                <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                        <div role="group" aria-label="Quick date ranges" className="flex max-w-full flex-wrap gap-1 rounded-lg bg-gray-100/80 p-1 dark:bg-white/[0.06]">
                            {presets.map((p) => {
                                const [f, t] = p.range();
                                const active = applied.from === f && applied.to === t;
                                return (
                                    <button
                                        key={p.label}
                                        type="button"
                                        aria-pressed={active}
                                        onClick={() => applyPreset(f, t)}
                                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500 ${
                                            active
                                                ? "bg-white text-gray-900 shadow-sm dark:bg-white/15 dark:text-white"
                                                : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"}`}
                                    >
                                        {p.label}
                                    </button>
                                );
                            })}
                        </div>
                        <RangePicker
                            aria-label="From and to dates"
                            allowClear={false}
                            value={[dayjs(fromDate), dayjs(toDate)]}
                            onChange={(v) => {
                                if (v && v[0] && v[1]) {
                                    setFromDate(v[0].format("YYYY-MM-DD"));
                                    setToDate(v[1].format("YYYY-MM-DD"));
                                }
                            }}
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Select<number[]>
                            mode="multiple"
                            allowClear
                            showSearch
                            maxTagCount="responsive"
                            aria-label="Categories"
                            placeholder={<span><FilterOutlined /> All categories</span>}
                            className="w-full sm:w-auto sm:min-w-[280px] sm:max-w-md sm:flex-1"
                            value={selectedCategoryIds}
                            onSelect={(id: number) => toggleCategory(id)}
                            onDeselect={(id: number) => toggleCategory(id)}
                            onClear={() => setSelectedCategoryIds([])}
                            options={categoryOptions.map((c) => ({ value: c.id, label: c.name }))}
                            filterOption={(input, opt) => String(opt?.label ?? "").toLowerCase().includes(input.toLowerCase())}
                            notFoundContent={<span className="text-xs text-gray-500">No categories</span>}
                        />
                        <Button type="primary" onClick={applyFilters} loading={loading}>
                            Apply filters
                        </Button>
                        <Button onClick={clearFilters}>Reset</Button>
                        {dirty && (
                            <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
                                Changes not applied yet
                            </span>
                        )}
                    </div>
                </div>
            </PageHeader>

            {error && (
                <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                    {error}
                </div>
            )}

            {/* ── First load ── */}
            {loading && !report && (
                <div className="space-y-6" aria-busy>
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {["Net revenue", "COGS", "Gross profit", "Units sold", "Transactions", "Stock buy value", "Stock sell value", "Potential profit"].map((l) => (
                            <StatTile key={l} label={l} value={null} loading />
                        ))}
                    </div>
                    <Panel title="Calculating…">
                        <Skeleton active paragraph={{ rows: 6 }} />
                    </Panel>
                </div>
            )}

            {report && (
                <div className={`space-y-6 transition ${loading ? "pointer-events-none opacity-50" : ""}`} aria-busy={loading}>
                    {/* ── Grand total KPIs ── */}
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <StatTile
                            label="Net revenue"
                            accent={<Accent tone="emerald"><DollarOutlined /></Accent>}
                            value={<Kpi>{fmt(report.grandTotalRevenue)}</Kpi>}
                            sub={report.grandTotalDiscount > 0.004
                                ? <span className="tabular-nums">{fmt(report.grandTotalGrossRevenue)} gross · {fmt(report.grandTotalDiscount)} discounts</span>
                                : undefined}
                        />
                        <StatTile
                            label="COGS"
                            accent={<Accent tone="red"><ShoppingCartOutlined /></Accent>}
                            value={<Kpi>{fmt(report.grandTotalCogs)}</Kpi>}
                        />
                        <StatTile
                            label="Gross profit"
                            accent={<Accent tone={report.grandTotalGrossProfit >= 0 ? "emerald" : "red"}>{report.grandTotalGrossProfit >= 0 ? <RiseOutlined /> : <FallOutlined />}</Accent>}
                            value={<Kpi className={profitCls(report.grandTotalGrossProfit)}>{fmt(report.grandTotalGrossProfit)}</Kpi>}
                            sub={<span className="inline-flex items-center gap-1.5"><MarginPill value={report.grandGrossMarginPct} /> margin</span>}
                        />
                        <StatTile
                            label="Units sold"
                            accent={<Accent tone="blue"><AppstoreOutlined /></Accent>}
                            value={<Kpi>{report.grandTotalUnitsSold.toLocaleString("en-US")}</Kpi>}
                            sub={report.grandTotalUnitsGivenFree > 0 ? `+${report.grandTotalUnitsGivenFree} free (event kits)` : undefined}
                        />
                        <StatTile
                            label="Transactions"
                            accent={<Accent tone="violet"><SwapOutlined /></Accent>}
                            value={<Kpi>{report.transactionCount.toLocaleString("en-US")}</Kpi>}
                            sub="paid, with items"
                        />
                        <StatTile
                            label="Stock buy value"
                            accent={<Accent tone="gray"><InboxOutlined /></Accent>}
                            value={<Kpi>{fmt(report.grandTotalStockBuyValue)}</Kpi>}
                            sub="On hand, at buy price"
                        />
                        <StatTile
                            label="Stock sell value"
                            accent={<Accent tone="blue"><TagsOutlined /></Accent>}
                            value={<Kpi>{fmt(report.grandTotalStockSellValue)}</Kpi>}
                            sub="On hand, at sell price"
                        />
                        <StatTile
                            label="Potential profit"
                            accent={<Accent tone={report.grandTotalStockPotentialProfit >= 0 ? "emerald" : "red"}>{report.grandTotalStockPotentialProfit >= 0 ? <RiseOutlined /> : <FallOutlined />}</Accent>}
                            value={<Kpi className={profitCls(report.grandTotalStockPotentialProfit)}>{fmt(report.grandTotalStockPotentialProfit)}</Kpi>}
                            sub="If the stock on hand sells"
                        />
                    </div>

                    {/* ── Missing-cost warning ── */}
                    {noCostSold.length > 0 && <NoCostCallout items={noCostSold} revenue={noCostRevenue} />}

                    {/* ── Streams ── */}
                    <div className="grid gap-4 xl:grid-cols-2">
                        <StreamPanel
                            title="TCG & Retail" icon={<TagsOutlined />} badge="shelf goods"
                            color={STREAM_COLOR.tcg}
                            cells={[
                                { label: "Revenue", value: fmt(report.tcgRevenue) },
                                { label: "COGS", value: fmt(report.tcgCogs) },
                                { label: "Gross profit", value: <span className={profitCls(report.tcgGrossProfit)}>{fmt(report.tcgGrossProfit)}</span> },
                                { label: "Margin", value: <MarginPill value={report.tcgMarginPct} /> },
                                { label: "Stock buy", value: fmt(report.tcgStockBuyValue) },
                                { label: "Stock sell", value: fmt(report.tcgStockSellValue) },
                            ]}
                        />
                        <StreamPanel
                            title="Food & Beverage" icon={<CoffeeOutlined />} badge="kitchen · bar · tobacco"
                            color={STREAM_COLOR.fnb}
                            cells={[
                                { label: "Revenue", value: fmt(report.fnbRevenue) },
                                { label: "COGS", value: fmt(report.fnbCogs) },
                                { label: "Gross profit", value: <span className={profitCls(report.fnbGrossProfit)}>{fmt(report.fnbGrossProfit)}</span> },
                                { label: "Margin", value: <MarginPill value={report.fnbMarginPct} /> },
                                { label: "Units", value: String(report.fnbUnitsSold) },
                                { label: "Add-ons", value: fmt(report.grandTotalAddOnRevenue) },
                            ]}
                        />
                    </div>

                    {/* ── Segment tabs + view toggle ── */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="max-w-full overflow-x-auto">
                            <Segmented
                                value={activeTab}
                                onChange={(v) => setActiveTab(v as Tab)}
                                options={[
                                    { value: "all", label: "All categories" },
                                    { value: "tcg", label: <span className="inline-flex items-center gap-1.5">{streamDot(STREAM_COLOR.tcg)}TCG & Retail</span> },
                                    { value: "fnb", label: <span className="inline-flex items-center gap-1.5">{streamDot(STREAM_COLOR.fnb)}F&B</span> },
                                ]}
                            />
                        </div>
                        <label htmlFor="irr-show-zero" className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                            <Switch id="irr-show-zero" size="small" checked={showZeroSales} onChange={(checked) => setShowZeroSales(checked)} />
                            Show items with 0 sales
                        </label>
                    </div>

                    {visibleGroups.length === 0 ? (
                        <Panel>
                            <Empty
                                className="py-10"
                                description={
                                    <div>
                                        <p className="text-base font-medium text-gray-700 dark:text-gray-200">No sales for the selected filters</p>
                                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Try a wider date range or a different category</p>
                                    </div>
                                }
                            />
                        </Panel>
                    ) : (
                        <>
                            <div className="space-y-4">
                                {visibleGroups.map((group) => (
                                    <CategoryGroupPanel key={group.categoryId} group={group} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                                ))}
                            </div>

                            {/* ── Grand total ── */}
                            <Panel
                                title="Grand total"
                                subtitle={
                                    <span className="tabular-nums">
                                        {applied.from} → {applied.to}
                                        {applied.categoryIds.length > 0 && ` · ${applied.categoryIds.length} categories`}
                                        {" · "}as of {new Date(report.generatedAt).toLocaleTimeString()}
                                    </span>
                                }
                            >
                                <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4 lg:grid-cols-7">
                                    <TotalCell label="Units sold">{report.grandTotalUnitsSold}</TotalCell>
                                    <TotalCell label="Net revenue">{fmt(report.grandTotalRevenue)}</TotalCell>
                                    <TotalCell label="Discounts">{fmt(report.grandTotalDiscount)}</TotalCell>
                                    <TotalCell label="COGS">{fmt(report.grandTotalCogs)}</TotalCell>
                                    <TotalCell label="Gross profit">
                                        <span className={profitCls(report.grandTotalGrossProfit)}>{fmt(report.grandTotalGrossProfit)}</span>
                                    </TotalCell>
                                    <TotalCell label="Margin"><MarginPill value={report.grandGrossMarginPct} /></TotalCell>
                                    <TotalCell label="Stock sell value">{fmt(report.grandTotalStockSellValue)}</TotalCell>
                                </div>
                            </Panel>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
