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
import {
    getItemRevenueReport,
    ItemRevenueReportDto,
    ItemRevenueCategoryGroupDto,
    ItemRevenueLineDto,
} from "../../services/itemRevenueReportService";
import { getCategories } from "../../services/categoryService";
import Loader from "../../components/ui/Loader";

// ─── helpers ────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
    `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const pct = (n: number | null | undefined) =>
    n == null ? "—" : `${n.toFixed(1)}%`;

const marginColor = (v: number | null | undefined) => {
    if (v == null) return "text-gray-400";
    if (v >= 50) return "text-emerald-600 font-semibold";
    if (v >= 20) return "text-yellow-600 font-semibold";
    return "text-red-500 font-semibold";
};

const profitColor = (v: number) =>
    v >= 0 ? "text-emerald-600" : "text-red-500";

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
type SortKey =
    | "itemName"
    | "sellPrice"
    | "unitsSold"
    | "revenue"
    | "cogs"
    | "grossProfit"
    | "grossMarginPct"
    | "stockOnHand"
    | "stockSellValue"
    | "stockBuyValue";

type SortDir = "asc" | "desc";
type CategoryOption = { id: number; name: string };
type Tab = "all" | "tcg" | "fnb";

// ─── sub-components ─────────────────────────────────────────────────────────

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
    return (
        <span className={`ml-1 text-xs ${active ? "text-indigo-600" : "text-gray-300"}`}>
            {active ? (dir === "asc" ? "↑" : "↓") : "↕"}
        </span>
    );
}

function SummaryCard({
    label, value, sub, color = "text-gray-900",
}: { label: string; value: string; sub?: string; color?: string }) {
    return (
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
    );
}

function StreamCard({
    title, icon, badge, gradient, cells,
}: {
    title: string; icon: string; badge: string; gradient: string;
    cells: Array<{ label: string; value: string }>;
}) {
    return (
        <div className={`rounded-xl p-5 text-white shadow-lg ${gradient}`}>
            <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">{icon}</span>
                <h3 className="text-lg font-bold">{title}</h3>
                <span className="ml-auto text-xs bg-white/20 px-2 py-1 rounded-full">{badge}</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {cells.map((c) => (
                    <div key={c.label} className="bg-white/10 rounded-lg p-3">
                        <p className="text-xs opacity-75 mb-1">{c.label}</p>
                        <p className="text-lg font-bold">{c.value}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

function CostCell({ item }: { item: ItemRevenueLineDto }) {
    if (item.costSource === "none") {
        return (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700" title="No buy price and no recipe — COGS counted as $0">
                no cost
            </span>
        );
    }
    return (
        <div className="leading-tight">
            <span className="text-sm text-gray-600">{fmt(item.unitCost ?? 0)}</span>
            {item.costSource === "recipe" && (
                <div className="text-[10px] text-teal-600" title="Ingredient cost at today's prices">recipe</div>
            )}
        </div>
    );
}

function ItemRow({ item }: { item: ItemRevenueLineDto }) {
    return (
        <tr className="bg-gray-50 border-b border-gray-100 hover:bg-indigo-50/30 transition">
            <td className="pl-12 pr-4 py-3">
                <div className="flex items-center gap-3">
                    {item.imagePath ? (
                        <img src={item.imagePath} alt={item.itemName} className="w-8 h-8 rounded-lg object-cover border border-gray-200" />
                    ) : (
                        <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center text-gray-400 text-xs">📦</div>
                    )}
                    <span className={`text-sm font-medium ${item.isDeleted ? "text-gray-400 line-through" : "text-gray-800"}`}>{item.itemName}</span>
                    {item.isDeleted && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-200 text-gray-600" title="Item is deleted — shown because it sold in this period. Stock counted as 0.">deleted</span>
                    )}
                </div>
            </td>
            <td className="px-4 py-3 text-center"><span className="text-sm text-gray-500">{fmt(item.sellPrice)}</span></td>
            <td className="px-4 py-3 text-center"><CostCell item={item} /></td>
            <td className="px-4 py-3 text-center">
                <span className={`text-sm font-semibold ${item.unitsSold > 0 ? "text-gray-800" : "text-gray-300"}`}>{item.unitsSold}</span>
                {item.unitsGivenFree > 0 && (
                    <div className="text-[10px] text-purple-600" title="Handed out inside an event kit — no revenue, stock deducted">+{item.unitsGivenFree} free</div>
                )}
            </td>
            <td className="px-4 py-3 text-right">
                <span className="text-sm font-semibold text-gray-800">{fmt(item.revenue)}</span>
                {(item.discountGiven > 0.004 || item.addOnRevenue > 0.004) && (
                    <div className="text-[10px] text-gray-400 whitespace-nowrap">
                        {item.discountGiven > 0.004 && <span className="text-red-400">−{fmt(item.discountGiven)} disc</span>}
                        {item.discountGiven > 0.004 && item.addOnRevenue > 0.004 && " · "}
                        {item.addOnRevenue > 0.004 && <span className="text-indigo-500">{fmt(item.addOnRevenue)} add-ons</span>}
                    </div>
                )}
            </td>
            <td className="px-4 py-3 text-right"><span className="text-sm text-red-500">{fmt(item.cogs)}</span></td>
            <td className="px-4 py-3 text-right"><span className={`text-sm font-bold ${profitColor(item.grossProfit)}`}>{fmt(item.grossProfit)}</span></td>
            <td className="px-4 py-3 text-center"><span className={`text-sm ${marginColor(item.grossMarginPct)}`}>{pct(item.grossMarginPct)}</span></td>
            <td className="px-4 py-3 text-center">
                {item.isRecipe ? (
                    <span className="text-[10px] text-teal-600" title="Stock is tracked on ingredients">recipe</span>
                ) : item.isDeleted ? (
                    <span className="text-[10px] text-gray-400" title="Deleted item — no stock on the shelf">—</span>
                ) : (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        item.stockOnHand <= 0 ? "bg-red-100 text-red-700"
                        : item.stockOnHand <= 5 ? "bg-yellow-100 text-yellow-700"
                        : "bg-emerald-100 text-emerald-700"}`}>
                        {item.stockOnHand}
                    </span>
                )}
            </td>
            <td className="px-4 py-3 text-right"><span className="text-sm text-gray-600">{item.isRecipe ? "—" : fmt(item.stockBuyValue)}</span></td>
            <td className="px-4 py-3 text-right"><span className="text-sm text-gray-600">{item.isRecipe ? "—" : fmt(item.stockSellValue)}</span></td>
        </tr>
    );
}

function CategoryGroup({
    group, sortKey, sortDir, onSort,
}: {
    group: ItemRevenueCategoryGroupDto;
    sortKey: SortKey;
    sortDir: SortDir;
    onSort: (k: SortKey) => void;
}) {
    const [expanded, setExpanded] = useState(true);
    const isTcg = group.isTcg;

    const sorted = [...group.items].sort((a, b) => {
        const mul = sortDir === "asc" ? 1 : -1;
        if (sortKey === "itemName") return mul * a.itemName.localeCompare(b.itemName);
        return mul * (((a[sortKey] ?? 0) as number) - ((b[sortKey] ?? 0) as number));
    });

    const th = (key: SortKey, label: string, align = "text-right") => (
        <th
            className={`px-4 py-3 ${align} text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:text-indigo-600 transition whitespace-nowrap`}
            onClick={() => onSort(key)}
        >
            {label}
            <SortIcon active={sortKey === key} dir={sortDir} />
        </th>
    );

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-4">
            <button
                className={`w-full flex items-center justify-between px-5 py-4 text-left transition hover:bg-gray-50 ${isTcg ? "border-l-4 border-indigo-500" : "border-l-4 border-amber-400"}`}
                onClick={() => setExpanded((e) => !e)}
            >
                <div className="flex items-center gap-3">
                    <span className="text-lg">{isTcg ? "🃏" : "🍔"}</span>
                    <div>
                        <h3 className="text-base font-bold text-gray-900">{group.categoryName}</h3>
                        <p className="text-xs text-gray-400 mt-0.5">
                            {group.items.length} item{group.items.length !== 1 ? "s" : ""}
                            {" · "}{group.totalUnitsSold} units sold
                            {group.totalUnitsGivenFree > 0 && ` · ${group.totalUnitsGivenFree} free`}
                            {group.totalDiscount > 0.004 && ` · ${fmt(group.totalDiscount)} discounts`}
                        </p>
                    </div>
                </div>

                <div className="hidden md:flex items-center gap-6 mr-4">
                    <div className="text-right"><p className="text-xs text-gray-400">Revenue</p><p className="text-sm font-bold text-gray-900">{fmt(group.totalRevenue)}</p></div>
                    <div className="text-right"><p className="text-xs text-gray-400">COGS</p><p className="text-sm font-semibold text-red-500">{fmt(group.totalCogs)}</p></div>
                    <div className="text-right"><p className="text-xs text-gray-400">Gross Profit</p><p className={`text-sm font-bold ${profitColor(group.totalGrossProfit)}`}>{fmt(group.totalGrossProfit)}</p></div>
                    <div className="text-right"><p className="text-xs text-gray-400">Margin</p><p className={`text-sm ${marginColor(group.grossMarginPct)}`}>{pct(group.grossMarginPct)}</p></div>
                    <div className="text-right"><p className="text-xs text-gray-400">Stock Value</p><p className="text-sm font-semibold text-gray-700">{fmt(group.totalStockSellValue)}</p></div>
                </div>

                <span className="text-gray-400 text-lg shrink-0">{expanded ? "▲" : "▼"}</span>
            </button>

            {expanded && (
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-gray-50 border-t border-gray-100">
                            <tr>
                                <th className="pl-12 pr-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:text-indigo-600" onClick={() => onSort("itemName")}>
                                    Item<SortIcon active={sortKey === "itemName"} dir={sortDir} />
                                </th>
                                {th("sellPrice", "Sell $", "text-center")}
                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Cost $</th>
                                {th("unitsSold", "Sold", "text-center")}
                                {th("revenue", "Revenue", "text-right")}
                                {th("cogs", "COGS", "text-right")}
                                {th("grossProfit", "Gross Profit", "text-right")}
                                {th("grossMarginPct", "Margin %", "text-center")}
                                {th("stockOnHand", "Stock", "text-center")}
                                {th("stockBuyValue", "Stock Buy", "text-right")}
                                {th("stockSellValue", "Stock Sell", "text-right")}
                            </tr>
                        </thead>
                        <tbody>
                            {sorted.map((item) => <ItemRow key={item.itemId} item={item} />)}
                        </tbody>
                        <tfoot>
                            <tr className={`${isTcg ? "bg-indigo-50" : "bg-amber-50"} border-t-2 border-gray-200`}>
                                <td className="pl-12 pr-4 py-3 text-sm font-bold text-gray-800">Subtotal — {group.categoryName}</td>
                                <td className="px-4 py-3" /><td className="px-4 py-3" />
                                <td className="px-4 py-3 text-center text-sm font-bold text-gray-800">{group.totalUnitsSold}</td>
                                <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">{fmt(group.totalRevenue)}</td>
                                <td className="px-4 py-3 text-right text-sm font-bold text-red-500">{fmt(group.totalCogs)}</td>
                                <td className={`px-4 py-3 text-right text-sm font-bold ${profitColor(group.totalGrossProfit)}`}>{fmt(group.totalGrossProfit)}</td>
                                <td className={`px-4 py-3 text-center text-sm ${marginColor(group.grossMarginPct)}`}>{pct(group.grossMarginPct)}</td>
                                <td className="px-4 py-3" />
                                <td className="px-4 py-3 text-right text-sm font-bold text-gray-700">{fmt(group.totalStockBuyValue)}</td>
                                <td className="px-4 py-3 text-right text-sm font-bold text-gray-700">{fmt(group.totalStockSellValue)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
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
            .catch(() => { /* chips just stay empty */ });
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

    const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white";

    return (
        <div className="p-6 max-w-[1600px] mx-auto">
            {/* ── Header ── */}
            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Item Revenue Report</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        What each item really earned — invoices and items on game sessions, net of discounts, with add-ons.
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Live pill */}
                    <button
                        type="button"
                        onClick={() => setLive((v) => !v)}
                        title={live ? "Auto-refresh every 30s — click to pause" : "Paused — click to resume live updates"}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border transition ${
                            live ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-gray-50 border-gray-200 text-gray-500"}`}
                    >
                        <span className="relative flex h-2.5 w-2.5">
                            {live && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />}
                            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${live ? "bg-emerald-500" : "bg-gray-400"}`} />
                        </span>
                        {live ? "Live" : "Paused"}
                        {lastUpdated && (
                            <span className="font-normal text-gray-500">· {refreshing ? "updating…" : lastUpdated.toLocaleTimeString()}</span>
                        )}
                    </button>
                    <button
                        onClick={() => fetchReport(true)}
                        disabled={loading || refreshing}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50"
                    >
                        <span className={refreshing ? "animate-spin inline-block" : ""}>↻</span>
                        Recalculate
                    </button>
                    <button
                        onClick={exportCsv}
                        disabled={!report || loading}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition disabled:opacity-40"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Export CSV
                    </button>
                </div>
            </div>

            {/* ── Filters ── */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">From Date</label>
                        <input type="date" value={fromDate} max={toDate} onChange={(e) => setFromDate(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">To Date</label>
                        <input type="date" value={toDate} min={fromDate} onChange={(e) => setToDate(e.target.value)} className={inputCls} />
                    </div>
                    <div className="flex items-end">
                        <div className="flex gap-1 flex-wrap">
                            {presets.map((p) => {
                                const [f, t] = p.range();
                                const active = applied.from === f && applied.to === t;
                                return (
                                    <button
                                        key={p.label}
                                        onClick={() => applyPreset(f, t)}
                                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                                            active ? "bg-indigo-600 text-white" : "bg-gray-100 hover:bg-indigo-100 hover:text-indigo-700"}`}
                                    >
                                        {p.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="mb-4">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        Categories
                        {selectedCategoryIds.length > 0 && (
                            <button onClick={() => setSelectedCategoryIds([])} className="ml-2 normal-case font-normal text-indigo-500 hover:text-indigo-700">
                                Clear ({selectedCategoryIds.length})
                            </button>
                        )}
                    </label>
                    <div className="flex flex-wrap gap-2">
                        {categoryOptions.map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => toggleCategory(cat.id)}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                                    selectedCategoryIds.includes(cat.id)
                                        ? "bg-indigo-600 text-white shadow-sm"
                                        : "bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600"}`}
                            >
                                {cat.name}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    <button
                        onClick={applyFilters}
                        disabled={loading}
                        className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50 flex items-center gap-2"
                    >
                        {loading && <Loader size={14} />}
                        Apply Filters
                    </button>
                    <button onClick={clearFilters} className="px-5 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition">
                        Reset
                    </button>

                    <label className="flex items-center gap-2 ml-auto cursor-pointer">
                        <div className={`w-9 h-5 rounded-full transition ${showZeroSales ? "bg-indigo-600" : "bg-gray-300"}`} onClick={() => setShowZeroSales((v) => !v)}>
                            <div className={`w-4 h-4 bg-white rounded-full shadow mt-0.5 transition-transform ${showZeroSales ? "translate-x-4" : "translate-x-0.5"}`} />
                        </div>
                        <span className="text-xs text-gray-600">Show items with 0 sales</span>
                    </label>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl px-5 py-4 mb-6 text-sm">{error}</div>
            )}

            {loading && !report && (
                <div className="flex justify-center items-center py-24">
                    <Loader />
                    <span className="ml-3 text-gray-500 text-sm">Calculating…</span>
                </div>
            )}

            {report && (
                <div className={loading ? "opacity-50 pointer-events-none transition" : "transition"}>
                    {/* ── Grand total cards ── */}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
                        <SummaryCard
                            label="Net Revenue"
                            value={fmt(report.grandTotalRevenue)}
                            sub={report.grandTotalDiscount > 0.004 ? `${fmt(report.grandTotalGrossRevenue)} gross · ${fmt(report.grandTotalDiscount)} discounts` : undefined}
                            color="text-indigo-700"
                        />
                        <SummaryCard label="COGS" value={fmt(report.grandTotalCogs)} color="text-red-600" />
                        <SummaryCard
                            label="Gross Profit"
                            value={fmt(report.grandTotalGrossProfit)}
                            sub={pct(report.grandGrossMarginPct) + " margin"}
                            color={report.grandTotalGrossProfit >= 0 ? "text-emerald-700" : "text-red-600"}
                        />
                        <SummaryCard
                            label="Units Sold"
                            value={String(report.grandTotalUnitsSold)}
                            sub={report.grandTotalUnitsGivenFree > 0 ? `+${report.grandTotalUnitsGivenFree} free (event kits)` : undefined}
                        />
                        <SummaryCard label="Transactions" value={String(report.transactionCount)} sub="paid, with items" />
                        <SummaryCard label="Stock Buy Value" value={fmt(report.grandTotalStockBuyValue)} color="text-gray-700" />
                        <SummaryCard label="Stock Sell Value" value={fmt(report.grandTotalStockSellValue)} color="text-blue-700" />
                        <SummaryCard
                            label="Potential Profit"
                            value={fmt(report.grandTotalStockPotentialProfit)}
                            color={report.grandTotalStockPotentialProfit >= 0 ? "text-emerald-700" : "text-red-600"}
                        />
                    </div>

                    {/* ── Missing-cost warning ── */}
                    {noCostSold.length > 0 && (
                        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-5 py-3 mb-6 text-sm">
                            <b>{noCostSold.length} sold item{noCostSold.length > 1 ? "s" : ""}</b> have no buy price and no recipe, so their COGS is counted as $0
                            ({fmt(noCostRevenue)} of revenue). Set a buy price or a recipe in Inventory to make gross profit exact:{" "}
                            <span className="text-amber-700">{noCostSold.slice(0, 6).map((i) => i.itemName).join(", ")}{noCostSold.length > 6 ? ` +${noCostSold.length - 6} more` : ""}</span>
                        </div>
                    )}

                    {/* ── Streams ── */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
                        <StreamCard
                            title="TCG & Retail" icon="🃏" badge="shelf goods"
                            gradient="bg-gradient-to-br from-indigo-600 to-purple-700"
                            cells={[
                                { label: "Revenue", value: fmt(report.tcgRevenue) },
                                { label: "COGS", value: fmt(report.tcgCogs) },
                                { label: "Gross Profit", value: fmt(report.tcgGrossProfit) },
                                { label: "Margin", value: pct(report.tcgMarginPct) },
                                { label: "Stock Buy", value: fmt(report.tcgStockBuyValue) },
                                { label: "Stock Sell", value: fmt(report.tcgStockSellValue) },
                            ]}
                        />
                        <StreamCard
                            title="Food & Beverage" icon="🍔" badge="kitchen · bar · tobacco"
                            gradient="bg-gradient-to-br from-amber-500 to-orange-600"
                            cells={[
                                { label: "Revenue", value: fmt(report.fnbRevenue) },
                                { label: "COGS", value: fmt(report.fnbCogs) },
                                { label: "Gross Profit", value: fmt(report.fnbGrossProfit) },
                                { label: "Margin", value: pct(report.fnbMarginPct) },
                                { label: "Units", value: String(report.fnbUnitsSold) },
                                { label: "Add-ons", value: fmt(report.grandTotalAddOnRevenue) },
                            ]}
                        />
                    </div>

                    {/* ── Tabs ── */}
                    <div className="flex items-center gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
                        {([
                            { key: "all", label: "All Categories" },
                            { key: "tcg", label: "🃏 TCG & Retail" },
                            { key: "fnb", label: "🍔 F&B" },
                        ] as { key: Tab; label: string }[]).map(({ key, label }) => (
                            <button
                                key={key}
                                onClick={() => setActiveTab(key)}
                                className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
                                    activeTab === key ? "bg-white text-indigo-700 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {visibleGroups.length === 0 ? (
                        <div className="text-center py-16 text-gray-400">
                            <p className="text-4xl mb-3">📊</p>
                            <p className="text-lg font-medium">No sales for the selected filters</p>
                            <p className="text-sm mt-1">Try a wider date range or a different category</p>
                        </div>
                    ) : (
                        <>
                            {visibleGroups.map((group) => (
                                <CategoryGroup key={group.categoryId} group={group} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                            ))}

                            <div className="bg-gray-900 rounded-xl p-5 text-white mt-2">
                                <div className="flex items-center justify-between flex-wrap gap-4">
                                    <div>
                                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Grand Total</p>
                                        <p className="text-xs text-gray-500">
                                            {applied.from} → {applied.to}
                                            {applied.categoryIds.length > 0 && ` · ${applied.categoryIds.length} categories`}
                                            {" · "}as of {new Date(report.generatedAt).toLocaleTimeString()}
                                        </p>
                                    </div>
                                    <div className="flex gap-8 flex-wrap">
                                        <div className="text-right"><p className="text-xs text-gray-400">Units Sold</p><p className="text-xl font-bold">{report.grandTotalUnitsSold}</p></div>
                                        <div className="text-right"><p className="text-xs text-gray-400">Net Revenue</p><p className="text-xl font-bold text-indigo-300">{fmt(report.grandTotalRevenue)}</p></div>
                                        <div className="text-right"><p className="text-xs text-gray-400">Discounts</p><p className="text-xl font-bold text-red-300">{fmt(report.grandTotalDiscount)}</p></div>
                                        <div className="text-right"><p className="text-xs text-gray-400">COGS</p><p className="text-xl font-bold text-red-400">{fmt(report.grandTotalCogs)}</p></div>
                                        <div className="text-right"><p className="text-xs text-gray-400">Gross Profit</p><p className={`text-xl font-bold ${report.grandTotalGrossProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmt(report.grandTotalGrossProfit)}</p></div>
                                        <div className="text-right"><p className="text-xs text-gray-400">Margin</p><p className="text-xl font-bold">{pct(report.grandGrossMarginPct)}</p></div>
                                        <div className="text-right"><p className="text-xs text-gray-400">Stock Sell Value</p><p className="text-xl font-bold text-blue-300">{fmt(report.grandTotalStockSellValue)}</p></div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
