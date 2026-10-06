// Daily Sales
// ===========
// Sales per day, stacked by stream: Gaming · F&B · TCG/Retail · Event tickets.
// The stack's height is the day's total (GrandTotal = items + games + events;
// F&B = items − TCG share), so no separate "total" bar is needed.
//
// Data and date logic are unchanged from the previous version: same presets
// (UTC whole days), same custom range, same category filter, same CSV export.
// Only the presentation changed: KPI strip, stream legend with totals,
// average line, and a stacked chart that stays readable over 30+ days.
//
// Stream colours are the validated colour-blind-safe set used by the
// Accounting dashboard's revenue mix, in the same fixed order.

import { useEffect, useMemo, useState } from "react";
import Chart from "react-apexcharts";
import { ApexOptions } from "apexcharts";
import { Button, DatePicker, Empty, Segmented, Select, Skeleton, Tooltip } from "antd";
import { DownloadOutlined, FilterOutlined, TrophyOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { getDailySales, DailySalesData } from "../../../services/transactionService";
import { getCategories, CategoryDto } from "../../../services/categoryService";
import { useTheme } from "../../../context/ThemeContext";

type DateFilter = "today" | "yesterday" | "3days" | "2weeks" | "month" | "custom";
type CategoryType = "all" | "item" | "game";

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const compact = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (a >= 1_000) return `$${(n / 1_000).toFixed(a >= 10_000 ? 0 : 1)}k`;
  return `$${n.toFixed(0)}`;
};

type StreamKey = "games" | "fnb" | "tcg" | "events";
const STREAMS: { key: StreamKey; label: string; light: string; dark: string; pick: (d: DailySalesData) => number }[] = [
  { key: "games", label: "Gaming", light: "#2a78d6", dark: "#3987e5", pick: (d) => d.gamesTotal },
  { key: "fnb", label: "F&B", light: "#eb6834", dark: "#d95926", pick: (d) => Math.max(0, d.itemsTotal - (d.tcgTotal ?? 0)) },
  { key: "tcg", label: "TCG / Retail", light: "#1baf7a", dark: "#199e70", pick: (d) => d.tcgTotal ?? 0 },
  { key: "events", label: "Event tickets", light: "#eda100", dark: "#c98500", pick: (d) => d.eventsTotal ?? 0 },
];

const FILTERS: { value: DateFilter; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "3days", label: "Last 3 days" },
  { value: "2weeks", label: "Last 2 weeks" },
  { value: "month", label: "Last month" },
  { value: "custom", label: "Custom" },
];

interface DailySalesChartProps {
  categoryType?: CategoryType;
}

export default function DailySalesChart({ categoryType = "all" }: DailySalesChartProps) {
  const { theme } = useTheme();
  const dark = theme === "dark";

  const [salesData, setSalesData] = useState<DailySalesData[]>([]);
  const [itemCategories, setItemCategories] = useState<CategoryDto[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>("month");
  // Custom range (yyyy-mm-dd) — applied when dateFilter === 'custom'.
  const [customFrom, setCustomFrom] = useState<string>(() => ymd(new Date(Date.now() - 6 * 86400000)));
  const [customTo, setCustomTo] = useState<string>(() => ymd(new Date()));

  // Categories for the filter (none for game-only charts).
  useEffect(() => {
    let mounted = true;
    if (categoryType !== "game") {
      getCategories(1, 100)
        .then((res) => { if (mounted) setItemCategories(res.data || []); })
        .catch(() => { /* filter just stays empty */ });
    }
    return () => { mounted = false; };
  }, [categoryType]);

  // Load — same date-range rules as before (UTC whole days).
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    const now = new Date();
    let from: Date;
    let to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));

    switch (dateFilter) {
      case "today":
        from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
        break;
      case "yesterday": {
        const y = new Date(now);
        y.setDate(y.getDate() - 1);
        from = new Date(Date.UTC(y.getUTCFullYear(), y.getUTCMonth(), y.getUTCDate(), 0, 0, 0, 0));
        to = new Date(Date.UTC(y.getUTCFullYear(), y.getUTCMonth(), y.getUTCDate(), 23, 59, 59, 999));
        break;
      }
      case "3days":
        from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 3, 0, 0, 0, 0));
        break;
      case "2weeks":
        from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 14, 0, 0, 0, 0));
        break;
      case "custom": {
        const [fy, fm, fd] = customFrom.split("-").map(Number);
        const [ty, tm, td] = customTo.split("-").map(Number);
        if (!fy || !ty) { setLoading(false); return; }
        from = new Date(Date.UTC(fy, fm - 1, fd, 0, 0, 0, 0));
        to = new Date(Date.UTC(ty, tm - 1, td, 23, 59, 59, 999));
        if (to < from) { setLoading(false); setError('"From" must be before "To".'); return; }
        break;
      }
      case "month":
      default:
        from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 30, 0, 0, 0, 0));
        break;
    }

    getDailySales({
      from: from.toISOString(),
      to: to.toISOString(),
      categoryIds: selectedCategories.length > 0 ? selectedCategories.join(",") : undefined,
    })
      .then((data) => { if (mounted) setSalesData(data || []); })
      .catch((err) => { if (mounted) setError(err?.message || "Failed to load daily sales data"); })
      .finally(() => { if (mounted) setLoading(false); });

    return () => { mounted = false; };
  }, [dateFilter, selectedCategories, customFrom, customTo]);

  // ── Streams shown for this chart ────────────────────────────────────
  const hasEvents = salesData.some((d) => (d.eventsTotal ?? 0) > 0);
  const hasTcg = salesData.some((d) => (d.tcgTotal ?? 0) > 0);
  const streams = STREAMS.filter((s) => {
    if (categoryType === "game") return s.key === "games";
    if (categoryType === "item") return s.key === "fnb" || (s.key === "tcg" && hasTcg);
    if (s.key === "events") return hasEvents;
    if (s.key === "tcg") return hasTcg;
    return true;
  });
  const color = (s: (typeof STREAMS)[number]) => (dark ? s.dark : s.light);

  // ── Derived figures (display only) ──────────────────────────────────
  const dayTotal = (d: DailySalesData) => streams.reduce((a, s) => a + s.pick(d), 0);
  const stats = useMemo(() => {
    const totals = salesData.map(dayTotal);
    const total = totals.reduce((a, b) => a + b, 0);
    const days = salesData.length;
    let best = -1;
    totals.forEach((t, i) => { if (best < 0 || t > totals[best]) best = i; });
    const byStream = streams.map((s) => ({ ...s, value: salesData.reduce((a, d) => a + s.pick(d), 0) }));
    const activeDays = totals.filter((t) => t > 0).length;
    return { total, days, avg: days > 0 ? total / days : 0, best: best >= 0 && totals[best] > 0 ? { d: salesData[best], v: totals[best] } : null, byStream, activeDays };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salesData, categoryType, hasEvents, hasTcg]);

  const dayLabel = (iso: string, withYear = false) =>
    new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}), timeZone: "UTC" });
  const weekday = (iso: string) => new Date(iso).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });

  // ── Chart ───────────────────────────────────────────────────────────
  const n = salesData.length;
  const surface = dark ? "#111827" : "#ffffff";
  const ink2 = dark ? "#c3c2b7" : "#52514e";
  const muted = "#898781";
  const grid = dark ? "#2c2c2a" : "#e1e0d9";

  const series = streams.map((s) => ({ name: s.label, data: salesData.map((d) => +s.pick(d).toFixed(2)) }));

  const options: ApexOptions = {
    chart: {
      type: "bar",
      stacked: true,
      fontFamily: "inherit",
      toolbar: { show: false },
      zoom: { enabled: false },
      animations: { enabled: n <= 60, speed: 350 },
      background: "transparent",
    },
    theme: { mode: dark ? "dark" : "light" },
    colors: streams.map(color),
    plotOptions: {
      bar: {
        columnWidth: n <= 3 ? "28%" : n <= 7 ? "45%" : n <= 31 ? "68%" : "80%",
        borderRadius: 4,
        borderRadiusApplication: "end",
        borderRadiusWhenStacked: "last",
      },
    },
    // 2px surface gap between stacked segments.
    stroke: { show: true, width: 2, colors: [surface] },
    dataLabels: { enabled: false },
    legend: { show: false },
    grid: {
      borderColor: grid,
      strokeDashArray: 4,
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } },
      padding: { left: 4, right: 8 },
    },
    xaxis: {
      categories: salesData.map((d) => dayLabel(d.date)),
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        rotate: n > 16 ? -45 : 0,
        rotateAlways: n > 16,
        hideOverlappingLabels: true,
        style: { colors: muted, fontSize: "11px" },
      },
      tooltip: { enabled: false },
    },
    yaxis: {
      labels: { formatter: (v: number) => compact(v), style: { colors: muted, fontSize: "11px" } },
    },
    annotations: stats.avg > 0 && n > 1
      ? {
          yaxis: [{
            y: stats.avg,
            borderColor: ink2,
            strokeDashArray: 5,
            opacity: 0.6,
            label: {
              text: `avg ${compact(stats.avg)}/day`,
              position: "left",
              textAnchor: "start",
              offsetX: 4,
              borderWidth: 0,
              style: { background: dark ? "#1f2937" : "#f3f4f6", color: ink2, fontSize: "10px", padding: { left: 6, right: 6, top: 2, bottom: 2 } },
            },
          }],
        }
      : undefined,
    states: { hover: { filter: { type: "darken" } } },
    tooltip: {
      shared: true,
      intersect: false,
      followCursor: false,
      custom: ({ dataPointIndex }: { dataPointIndex: number }) => {
        const d = salesData[dataPointIndex];
        if (!d) return "";
        const total = dayTotal(d);
        const rows = streams
          .map((s) => {
            const v = s.pick(d);
            return `<div style="display:flex;align-items:center;gap:8px;justify-content:space-between;margin-top:3px">
              <span style="display:flex;align-items:center;gap:6px;color:${ink2}"><span style="width:8px;height:8px;border-radius:2px;background:${color(s)}"></span>${s.label}</span>
              <span style="font-variant-numeric:tabular-nums;font-weight:500">${money(v)}</span></div>`;
          })
          .join("");
        return `<div style="padding:10px 12px;min-width:200px;font-size:12px">
          <div style="font-weight:600;margin-bottom:4px">${weekday(d.date)}, ${dayLabel(d.date, true)}</div>
          ${rows}
          <div style="display:flex;justify-content:space-between;border-top:1px solid ${grid};margin-top:6px;padding-top:6px;font-weight:600">
            <span>Total</span><span style="font-variant-numeric:tabular-nums">${money(total)}</span></div>
          ${stats.avg > 0 && n > 1 ? `<div style="color:${muted};font-size:11px;margin-top:2px">${total >= stats.avg ? "+" : ""}${(((total - stats.avg) / stats.avg) * 100).toFixed(0)}% vs daily average</div>` : ""}
        </div>`;
      },
    },
  };

  // ── Export (unchanged columns) ──────────────────────────────────────
  const exportToExcel = () => {
    if (salesData.length === 0) return;
    const headers = ["Date", "Items Sales ($)", "Games Sales ($)", "Event Tickets ($)", "Total Sales ($)"];
    const rows = salesData.map((d) => [
      new Date(d.date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }),
      d.itemsTotal.toFixed(2),
      d.gamesTotal.toFixed(2),
      (d.eventsTotal ?? 0).toFixed(2),
      d.grandTotal.toFixed(2),
    ]);
    const sum = (f: (d: DailySalesData) => number) => salesData.reduce((a, d) => a + f(d), 0);
    rows.push(["TOTAL", sum((d) => d.itemsTotal).toFixed(2), sum((d) => d.gamesTotal).toFixed(2), sum((d) => d.eventsTotal ?? 0).toFixed(2), sum((d) => d.grandTotal).toFixed(2)]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((v) => `"${v}"`).join(","))].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const label = dateFilter === "custom" ? `${customFrom}_to_${customTo}` : FILTERS.find((b) => b.value === dateFilter)?.label || "Data";
    link.download = `Daily_Sales_${label.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const rangeLabel = salesData.length > 0
    ? n === 1 ? dayLabel(salesData[0].date, true) : `${dayLabel(salesData[0].date)} – ${dayLabel(salesData[n - 1].date, true)}`
    : "";

  const categoryOptions = itemCategories
    .filter((c) => (c.name || "").trim() !== "")
    .map((c) => ({ value: c.id, label: c.name }));

  // Wide ranges scroll sideways instead of squeezing bars to hairlines.
  const minWidth = n > 45 ? n * 18 : undefined;

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="max-w-full overflow-x-auto">
          <Segmented
            value={dateFilter}
            onChange={(v) => { setError(null); setDateFilter(v as DateFilter); }}
            options={FILTERS.map((f) => ({ value: f.value, label: f.label }))}
          />
        </div>
        {dateFilter === "custom" && (
          <DatePicker.RangePicker
            allowClear={false}
            value={[dayjs(customFrom), dayjs(customTo)]}
            onChange={(v) => {
              if (v && v[0] && v[1]) { setCustomFrom(v[0].format("YYYY-MM-DD")); setCustomTo(v[1].format("YYYY-MM-DD")); }
            }}
          />
        )}
        {categoryType !== "game" && categoryOptions.length > 0 && (
          <Select
            mode="multiple"
            allowClear
            showSearch
            optionFilterProp="label"
            maxTagCount="responsive"
            placeholder={<span><FilterOutlined /> All {categoryType === "item" ? "F&B" : "item"} categories</span>}
            value={selectedCategories}
            onChange={(v) => setSelectedCategories(v)}
            options={categoryOptions}
            style={{ minWidth: 240, maxWidth: 420, flex: "1 1 240px" }}
          />
        )}
        <Button icon={<DownloadOutlined />} onClick={exportToExcel} disabled={salesData.length === 0} className="ml-auto">
          Export
        </Button>
      </div>
      {selectedCategories.length > 0 && hasEvents === false && categoryType === "all" && (
        <p className="-mt-2 text-xs text-gray-500 dark:text-gray-400">
          Filtered to {selectedCategories.length} categor{selectedCategories.length === 1 ? "y" : "ies"} — event tickets carry no category, so they are left out.
        </p>
      )}

      {error ? (
        <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</div>
      ) : loading && salesData.length === 0 ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : (
        <div className={`space-y-5 transition-opacity ${loading ? "opacity-50" : ""}`}>
          {/* KPIs */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-gray-200/80 p-4 dark:border-white/[0.06]">
              <div className="text-xs text-gray-500 dark:text-gray-400">Total sales</div>
              <div className="mt-1 text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">{money(stats.total)}</div>
              <div className="mt-0.5 text-[11px] text-gray-500">{rangeLabel}</div>
            </div>
            <div className="rounded-xl border border-gray-200/80 p-4 dark:border-white/[0.06]">
              <div className="text-xs text-gray-500 dark:text-gray-400">Daily average</div>
              <div className="mt-1 text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">{money(stats.avg)}</div>
              <div className="mt-0.5 text-[11px] text-gray-500">{stats.days} day{stats.days === 1 ? "" : "s"} · {stats.activeDays} with sales</div>
            </div>
            <div className="rounded-xl border border-gray-200/80 p-4 dark:border-white/[0.06]">
              <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400"><TrophyOutlined className="text-amber-500" /> Best day</div>
              <div className="mt-1 text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">{stats.best ? money(stats.best.v) : "—"}</div>
              <div className="mt-0.5 text-[11px] text-gray-500">{stats.best ? `${weekday(stats.best.d.date)}, ${dayLabel(stats.best.d.date, true)}` : "No sales yet"}</div>
            </div>
            {/* Stream split — a 100% bar + the legend with values */}
            <div className="rounded-xl border border-gray-200/80 p-4 dark:border-white/[0.06]">
              <div className="text-xs text-gray-500 dark:text-gray-400">Split by stream</div>
              <div className="mt-2.5 flex h-2 w-full gap-[2px] overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                {stats.total > 0 && stats.byStream.filter((s) => s.value > 0).map((s) => (
                  <Tooltip key={s.key} title={`${s.label}: ${money(s.value)}`}>
                    <div style={{ width: `${(s.value / stats.total) * 100}%`, background: color(s) }} />
                  </Tooltip>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-600 dark:text-gray-300">
                {stats.byStream.map((s) => (
                  <span key={s.key} className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-sm" style={{ background: color(s) }} />
                    {s.label} <span className="tabular-nums text-gray-500">{stats.total > 0 ? `${Math.round((s.value / stats.total) * 100)}%` : "—"}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Legend with period totals (identity never by colour alone) */}
          {streams.length > 1 && (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {stats.byStream.map((s) => (
                <span key={s.key} className="flex items-center gap-2 text-sm">
                  <span className="h-3 w-3 rounded-sm" style={{ background: color(s) }} />
                  <span className="text-gray-600 dark:text-gray-300">{s.label}</span>
                  <span className="font-semibold tabular-nums text-gray-900 dark:text-white">{money(s.value)}</span>
                </span>
              ))}
              <span className="ml-auto flex items-center gap-2 text-xs text-gray-500">
                <span className="inline-block w-5 border-t-2 border-dashed border-gray-400" /> daily average
              </span>
            </div>
          )}

          {/* Chart */}
          {salesData.length === 0 || stats.total === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 py-14 dark:border-white/10">
              <Empty description="No sales in this period" />
            </div>
          ) : (
            <div className="max-w-full overflow-x-auto custom-scrollbar">
              <div style={minWidth ? { minWidth } : undefined}>
                <Chart key={`${dark}-${streams.length}`} options={options} series={series} type="bar" height={340} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
