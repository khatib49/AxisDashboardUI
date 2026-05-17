import { useEffect, useState, useCallback } from "react";
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

// ─── types ──────────────────────────────────────────────────────────────────
type SortKey =
    | "itemName"
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

function TcgHighlightCard({ report }: { report: ItemRevenueReportDto }) {
    if (report.tcgRevenue === 0 && report.tcgStockSellValue === 0) return null;
    return (
        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl p-5 text-white shadow-lg">
            <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">🃏</span>
                <h3 className="text-lg font-bold">TCG Summary</h3>
                <span className="ml-auto text-xs bg-white/20 px-2 py-1 rounded-full">TCG + TCG Retail</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                    { label: "Revenue", value: fmt(report.tcgRevenue) },
                    { label: "COGS", value: fmt(report.tcgCogs) },
                    { label: "Gross Profit", value: fmt(report.tcgGrossProfit) },
                    { label: "Stock Buy Value", value: fmt(report.tcgStockBuyValue) },
                    { label: "Stock Sell Value", value: fmt(report.tcgStockSellValue) },
                ].map((item) => (
                    <div key={item.label} className="bg-white/10 rounded-lg p-3">
                        <p className="text-xs opacity-75 mb-1">{item.label}</p>
                        <p className="text-lg font-bold">{item.value}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

function ItemRow({
    item,
    expanded,
}: { item: ItemRevenueLineDto; expanded: boolean }) {
    if (!expanded) return null;
    return (
        <tr className="bg-gray-50 border-b border-gray-100 hover:bg-indigo-50/30 transition">
            <td className="pl-12 pr-4 py-3">
                <div className="flex items-center gap-3">
                    {item.imagePath ? (
                        <img
                            src={item.imagePath}
                            alt={item.itemName}
                            className="w-8 h-8 rounded-lg object-cover border border-gray-200"
                        />
                    ) : (
                        <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center text-gray-400 text-xs">
                            📦
                        </div>
                    )}
                    <span className="text-sm font-medium text-gray-800">{item.itemName}</span>
                </div>
            </td>
            <td className="px-4 py-3 text-center">
                <span className="text-sm text-gray-500">{fmt(item.sellPrice)}</span>
            </td>
            <td className="px-4 py-3 text-center">
                <span className="text-sm text-gray-500">
                    {item.buyPrice != null ? fmt(item.buyPrice) : <span className="text-gray-300">—</span>}
                </span>
            </td>
            <td className="px-4 py-3 text-center">
                <span className={`text-sm font-semibold ${item.unitsSold > 0 ? "text-gray-800" : "text-gray-300"}`}>
                    {item.unitsSold}
                </span>
            </td>
            <td className="px-4 py-3 text-right">
                <span className="text-sm font-semibold text-gray-800">{fmt(item.revenue)}</span>
            </td>
            <td className="px-4 py-3 text-right">
                <span className="text-sm text-red-500">{fmt(item.cogs)}</span>
            </td>
            <td className="px-4 py-3 text-right">
                <span className={`text-sm font-bold ${profitColor(item.grossProfit)}`}>
                    {fmt(item.grossProfit)}
                </span>
            </td>
            <td className="px-4 py-3 text-center">
                <span className={`text-sm ${marginColor(item.grossMarginPct)}`}>
                    {pct(item.grossMarginPct)}
                </span>
            </td>
            <td className="px-4 py-3 text-center">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${item.stockOnHand === 0
                    ? "bg-red-100 text-red-700"
                    : item.stockOnHand <= 5
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-emerald-100 text-emerald-700"
                    }`}>
                    {item.stockOnHand}
                </span>
            </td>
            <td className="px-4 py-3 text-right">
                <span className="text-sm text-gray-600">{fmt(item.stockBuyValue)}</span>
            </td>
            <td className="px-4 py-3 text-right">
                <span className="text-sm text-gray-600">{fmt(item.stockSellValue)}</span>
            </td>
        </tr>
    );
}

function CategoryGroup({
    group,
    sortKey,
    sortDir,
    onSort,
}: {
    group: ItemRevenueCategoryGroupDto;
    sortKey: SortKey;
    sortDir: SortDir;
    onSort: (k: SortKey) => void;
}) {
    const [expanded, setExpanded] = useState(true);
    const isTcg = group.categoryName.toLowerCase().includes("tcg");

    const sorted = [...group.items].sort((a, b) => {
        const mul = sortDir === "asc" ? 1 : -1;
        if (sortKey === "itemName") return mul * a.itemName.localeCompare(b.itemName);
        return mul * ((a[sortKey] ?? 0) as number - ((b[sortKey] ?? 0) as number));
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
            {/* Category header */}
            <button
                className={`w-full flex items-center justify-between px-5 py-4 text-left transition hover:bg-gray-50 ${isTcg ? "border-l-4 border-indigo-500" : "border-l-4 border-blue-400"}`}
                onClick={() => setExpanded((e) => !e)}
            >
                <div className="flex items-center gap-3">
                    <span className="text-lg">{isTcg ? "🃏" : "📦"}</span>
                    <div>
                        <h3 className="text-base font-bold text-gray-900">{group.categoryName}</h3>
                        <p className="text-xs text-gray-400 mt-0.5">
                            {group.items.length} item{group.items.length !== 1 ? "s" : ""}
                            {" · "}
                            {group.totalUnitsSold} units sold
                        </p>
                    </div>
                </div>

                {/* Category subtotals strip */}
                <div className="hidden md:flex items-center gap-6 mr-4">
                    <div className="text-right">
                        <p className="text-xs text-gray-400">Revenue</p>
                        <p className="text-sm font-bold text-gray-900">{fmt(group.totalRevenue)}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-gray-400">COGS</p>
                        <p className="text-sm font-semibold text-red-500">{fmt(group.totalCogs)}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-gray-400">Gross Profit</p>
                        <p className={`text-sm font-bold ${profitColor(group.totalGrossProfit)}`}>
                            {fmt(group.totalGrossProfit)}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-gray-400">Margin</p>
                        <p className={`text-sm ${marginColor(group.grossMarginPct)}`}>
                            {pct(group.grossMarginPct)}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-gray-400">Stock Value</p>
                        <p className="text-sm font-semibold text-gray-700">{fmt(group.totalStockSellValue)}</p>
                    </div>
                </div>

                <span className="text-gray-400 text-lg shrink-0">{expanded ? "▲" : "▼"}</span>
            </button>

            {/* Items table */}
            {expanded && (
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-gray-50 border-t border-gray-100">
                            <tr>
                                <th className="pl-12 pr-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Item</th>
                                {th("itemName" as SortKey, "Sell $", "text-center")}
                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Buy $</th>
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
                            {sorted.map((item) => (
                                <ItemRow key={item.itemId} item={item} expanded={true} />
                            ))}
                        </tbody>
                        {/* Category subtotal footer */}
                        <tfoot>
                            <tr className={`${isTcg ? "bg-indigo-50" : "bg-blue-50"} border-t-2 border-gray-200`}>
                                <td className="pl-12 pr-4 py-3 text-sm font-bold text-gray-800">
                                    Subtotal — {group.categoryName}
                                </td>
                                <td className="px-4 py-3" />
                                <td className="px-4 py-3" />
                                <td className="px-4 py-3 text-center text-sm font-bold text-gray-800">
                                    {group.totalUnitsSold}
                                </td>
                                <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                                    {fmt(group.totalRevenue)}
                                </td>
                                <td className="px-4 py-3 text-right text-sm font-bold text-red-500">
                                    {fmt(group.totalCogs)}
                                </td>
                                <td className={`px-4 py-3 text-right text-sm font-bold ${profitColor(group.totalGrossProfit)}`}>
                                    {fmt(group.totalGrossProfit)}
                                </td>
                                <td className={`px-4 py-3 text-center text-sm ${marginColor(group.grossMarginPct)}`}>
                                    {pct(group.grossMarginPct)}
                                </td>
                                <td className="px-4 py-3" />
                                <td className="px-4 py-3 text-right text-sm font-bold text-gray-700">
                                    {fmt(group.totalStockBuyValue)}
                                </td>
                                <td className="px-4 py-3 text-right text-sm font-bold text-gray-700">
                                    {fmt(group.totalStockSellValue)}
                                </td>
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
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [fromDate, setFromDate] = useState(() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        return d.toISOString().split("T")[0];
    });
    const [toDate, setToDate] = useState(() => new Date().toISOString().split("T")[0]);
    const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
    const [appliedFrom, setAppliedFrom] = useState(fromDate);
    const [appliedTo, setAppliedTo] = useState(toDate);
    const [appliedCategoryIds, setAppliedCategoryIds] = useState<number[]>([]);

    // Sort (applied globally across all groups)
    const [sortKey, setSortKey] = useState<SortKey>("revenue");
    const [sortDir, setSortDir] = useState<SortDir>("desc");

    // View options
    const [showZeroSales, setShowZeroSales] = useState(false);
    const [activeTab, setActiveTab] = useState<"all" | "tcg" | "fnb">("all");

    // Load categories
    useEffect(() => {
        getCategories(1, 100)
            .then((res) => {
                const opts = (res.data || [])
                    .filter((c: any) => c.type === "item")
                    .map((c: any) => ({ id: c.id, name: c.name }));
                setCategoryOptions(opts);
            })
            .catch(() => {});
    }, []);

    const fetchReport = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getItemRevenueReport({
                from: appliedFrom ? `${appliedFrom}T00:00:00Z` : undefined,
                to: appliedTo ? `${appliedTo}T23:59:59Z` : undefined,
                categoryIds: appliedCategoryIds.length > 0 ? appliedCategoryIds : undefined,
            });
            setReport(data);
        } catch (e: any) {
            setError(e?.message || "Failed to load report");
        } finally {
            setLoading(false);
        }
    }, [appliedFrom, appliedTo, appliedCategoryIds]);

    useEffect(() => {
        fetchReport();
    }, [fetchReport]);

    const applyFilters = () => {
        setAppliedFrom(fromDate);
        setAppliedTo(toDate);
        setAppliedCategoryIds(selectedCategoryIds);
    };

    const clearFilters = () => {
        const today = new Date().toISOString().split("T")[0];
        const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
        setFromDate(monthAgo);
        setToDate(today);
        setSelectedCategoryIds([]);
        setAppliedFrom(monthAgo);
        setAppliedTo(today);
        setAppliedCategoryIds([]);
    };

    const toggleCategory = (id: number) => {
        setSelectedCategoryIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    };

    const handleSort = (key: SortKey) => {
        if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        else { setSortKey(key); setSortDir("desc"); }
    };

    // Export CSV
    const exportCsv = () => {
        if (!report) return;
        const rows: string[][] = [[
            "Category", "Item", "Sell Price", "Buy Price",
            "Units Sold", "Revenue", "COGS", "Gross Profit", "Margin %",
            "Stock On Hand", "Stock Buy Value", "Stock Sell Value",
        ]];
        report.categories.forEach((cat) => {
            cat.items.forEach((item) => {
                rows.push([
                    cat.categoryName, item.itemName,
                    item.sellPrice.toFixed(2),
                    item.buyPrice?.toFixed(2) ?? "",
                    String(item.unitsSold),
                    item.revenue.toFixed(2),
                    item.cogs.toFixed(2),
                    item.grossProfit.toFixed(2),
                    item.grossMarginPct?.toFixed(1) ?? "",
                    String(item.stockOnHand),
                    item.stockBuyValue.toFixed(2),
                    item.stockSellValue.toFixed(2),
                ]);
            });
        });
        rows.push([
            "GRAND TOTAL", "", "", "",
            String(report.grandTotalUnitsSold),
            report.grandTotalRevenue.toFixed(2),
            report.grandTotalCogs.toFixed(2),
            report.grandTotalGrossProfit.toFixed(2),
            report.grandGrossMarginPct?.toFixed(1) ?? "",
            "", report.grandTotalStockBuyValue.toFixed(2),
            report.grandTotalStockSellValue.toFixed(2),
        ]);
        const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `item_revenue_${appliedFrom}_${appliedTo}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Filter groups by tab
    const visibleGroups = report?.categories
        .filter((g) => {
            if (activeTab === "tcg") return g.categoryName.toLowerCase().includes("tcg");
            if (activeTab === "fnb") return !g.categoryName.toLowerCase().includes("tcg");
            return true;
        })
        .map((g) => ({
            ...g,
            items: showZeroSales ? g.items : g.items.filter((i) => i.unitsSold > 0),
        }))
        .filter((g) => g.items.length > 0) ?? [];

    return (
        <div className="p-6 max-w-[1600px] mx-auto">
            {/* ── Page header ── */}
            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Item Revenue Report</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Sales revenue, cost of goods, gross profit and stock analysis per item
                    </p>
                </div>
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

            {/* ── Filters ── */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                            From Date
                        </label>
                        <input
                            type="date"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                            To Date
                        </label>
                        <input
                            type="date"
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                        />
                    </div>
                    <div className="flex items-end gap-2">
                        {/* Presets */}
                        <div className="flex gap-1 flex-wrap">
                            {[
                                { label: "Today", days: 0 },
                                { label: "7d", days: 7 },
                                { label: "30d", days: 30 },
                                { label: "90d", days: 90 },
                                { label: "All", days: 999 },
                            ].map(({ label, days }) => (
                                <button
                                    key={label}
                                    onClick={() => {
                                        const now = new Date();
                                        const t = now.toISOString().split("T")[0];
                                        const f = days === 999
                                            ? "2025-07-01"
                                            : new Date(Date.now() - days * 86400000).toISOString().split("T")[0];
                                        setFromDate(f);
                                        setToDate(t);
                                    }}
                                    className="px-2.5 py-1.5 bg-gray-100 hover:bg-indigo-100 hover:text-indigo-700 rounded-lg text-xs font-medium transition"
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Category multi-select */}
                <div className="mb-4">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        Categories
                        {selectedCategoryIds.length > 0 && (
                            <button
                                onClick={() => setSelectedCategoryIds([])}
                                className="ml-2 normal-case font-normal text-indigo-500 hover:text-indigo-700"
                            >
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
                                        : "bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600"
                                }`}
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
                    <button
                        onClick={clearFilters}
                        className="px-5 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
                    >
                        Reset
                    </button>

                    {/* View toggle */}
                    <label className="flex items-center gap-2 ml-auto cursor-pointer">
                        <div
                            className={`w-9 h-5 rounded-full transition ${showZeroSales ? "bg-indigo-600" : "bg-gray-300"}`}
                            onClick={() => setShowZeroSales((v) => !v)}
                        >
                            <div className={`w-4 h-4 bg-white rounded-full shadow mt-0.5 transition-transform ${showZeroSales ? "translate-x-4" : "translate-x-0.5"}`} />
                        </div>
                        <span className="text-xs text-gray-600">Show items with 0 sales</span>
                    </label>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl px-5 py-4 mb-6 text-sm">
                    {error}
                </div>
            )}

            {loading && (
                <div className="flex justify-center items-center py-24">
                    <Loader />
                    <span className="ml-3 text-gray-500 text-sm">Loading report…</span>
                </div>
            )}

            {!loading && report && (
                <>
                    {/* ── Grand total summary cards ── */}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
                        <SummaryCard label="Total Revenue" value={fmt(report.grandTotalRevenue)} color="text-indigo-700" />
                        <SummaryCard label="Total COGS" value={fmt(report.grandTotalCogs)} color="text-red-600" />
                        <SummaryCard
                            label="Gross Profit"
                            value={fmt(report.grandTotalGrossProfit)}
                            sub={pct(report.grandGrossMarginPct) + " margin"}
                            color={report.grandTotalGrossProfit >= 0 ? "text-emerald-700" : "text-red-600"}
                        />
                        <SummaryCard label="Units Sold" value={String(report.grandTotalUnitsSold)} color="text-gray-900" />
                        <SummaryCard label="Stock Buy Value" value={fmt(report.grandTotalStockBuyValue)} color="text-gray-700" />
                        <SummaryCard label="Stock Sell Value" value={fmt(report.grandTotalStockSellValue)} color="text-blue-700" />
                        <SummaryCard
                            label="Potential Profit"
                            value={fmt(report.grandTotalStockPotentialProfit)}
                            color={report.grandTotalStockPotentialProfit >= 0 ? "text-emerald-700" : "text-red-600"}
                        />
                    </div>

                    {/* ── TCG highlight ── */}
                    <div className="mb-6">
                        <TcgHighlightCard report={report} />
                    </div>

                    {/* ── Tab bar ── */}
                    <div className="flex items-center gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
                        {([
                            { key: "all", label: "All Categories" },
                            { key: "tcg", label: "🃏 TCG Only" },
                            { key: "fnb", label: "🍔 F&B Only" },
                        ] as { key: typeof activeTab; label: string }[]).map(({ key, label }) => (
                            <button
                                key={key}
                                onClick={() => setActiveTab(key)}
                                className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
                                    activeTab === key
                                        ? "bg-white text-indigo-700 shadow-sm"
                                        : "text-gray-600 hover:text-gray-900"
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* ── Category groups ── */}
                    {visibleGroups.length === 0 ? (
                        <div className="text-center py-16 text-gray-400">
                            <p className="text-4xl mb-3">📊</p>
                            <p className="text-lg font-medium">No data for selected filters</p>
                            <p className="text-sm mt-1">Try expanding the date range or selecting different categories</p>
                        </div>
                    ) : (
                        <>
                            {visibleGroups.map((group) => (
                                <CategoryGroup
                                    key={group.categoryId}
                                    group={group}
                                    sortKey={sortKey}
                                    sortDir={sortDir}
                                    onSort={handleSort}
                                />
                            ))}

                            {/* ── Grand total footer ── */}
                            <div className="bg-gray-900 rounded-xl p-5 text-white mt-2">
                                <div className="flex items-center justify-between flex-wrap gap-4">
                                    <div>
                                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Grand Total</p>
                                        <p className="text-xs text-gray-500">
                                            {appliedFrom} → {appliedTo}
                                            {appliedCategoryIds.length > 0 && ` · ${appliedCategoryIds.length} categories`}
                                        </p>
                                    </div>
                                    <div className="flex gap-8 flex-wrap">
                                        <div className="text-right">
                                            <p className="text-xs text-gray-400">Units Sold</p>
                                            <p className="text-xl font-bold">{report.grandTotalUnitsSold}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-gray-400">Revenue</p>
                                            <p className="text-xl font-bold text-indigo-300">{fmt(report.grandTotalRevenue)}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-gray-400">COGS</p>
                                            <p className="text-xl font-bold text-red-400">{fmt(report.grandTotalCogs)}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-gray-400">Gross Profit</p>
                                            <p className={`text-xl font-bold ${report.grandTotalGrossProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                                {fmt(report.grandTotalGrossProfit)}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-gray-400">Margin</p>
                                            <p className="text-xl font-bold">{pct(report.grandGrossMarginPct)}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-gray-400">Stock Sell Value</p>
                                            <p className="text-xl font-bold text-blue-300">{fmt(report.grandTotalStockSellValue)}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    );
}