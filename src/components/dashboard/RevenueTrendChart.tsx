import { useEffect, useState } from "react";
import Chart from "react-apexcharts";
import { ApexOptions } from "apexcharts";
import { getDailySales, DailySalesData } from "../../services/transactionService";
import Loader from "../ui/Loader";

type GroupBy = 'day' | 'week' | 'month';

export default function RevenueTrendChart() {
    const [data, setData] = useState<DailySalesData[]>([]);
    const [loading, setLoading] = useState(true);
    const [groupBy, setGroupBy] = useState<GroupBy>('week');
    const [series, setSeries] = useState<'all' | 'gaming' | 'fnb' | 'tcg'>('all');

    // All-time: from July 2025 (opening) to today
    const FROM = '2025-07-01T00:00:00.000Z';
    const TO = new Date().toISOString();

    useEffect(() => {
        const fetch = async () => {
            try {
                setLoading(true);
                const raw = await getDailySales({ from: FROM, to: TO });
                setData(raw || []);
            } catch {
                setData([]);
            } finally {
                setLoading(false);
            }
        };
        fetch();
    }, []);

    // Group data
    const grouped = (() => {
        if (groupBy === 'day') return data;

        const buckets: Record<string, { items: number; games: number; grand: number }> = {};
        data.forEach(d => {
            const date = new Date(d.date);
            let key: string;
            if (groupBy === 'week') {
                const monday = new Date(date);
                monday.setUTCDate(date.getUTCDate() - date.getUTCDay() + 1);
                key = monday.toISOString().split('T')[0];
            } else {
                key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
            }
            if (!buckets[key]) buckets[key] = { items: 0, games: 0, grand: 0 };
            buckets[key].items += d.itemsTotal;
            buckets[key].games += d.gamesTotal;
            buckets[key].grand += d.grandTotal;
        });
        return Object.entries(buckets)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, v]) => ({
                date,
                itemsTotal: v.items,
                gamesTotal: v.games,
                grandTotal: v.grand,
            }));
    })();

    const labels = grouped.map(d => {
        const date = new Date(d.date);
        if (groupBy === 'month') return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    });

    const chartSeries = (() => {
        if (series === 'gaming') return [{ name: 'Gaming', data: grouped.map(d => +d.gamesTotal.toFixed(2)) }];
        if (series === 'fnb') return [{ name: 'F&B', data: grouped.map(d => +d.itemsTotal.toFixed(2)) }];
        if (series === 'tcg') return [{ name: 'TCG', data: grouped.map(d => +(d.grandTotal - d.gamesTotal - d.itemsTotal).toFixed(2)) }];
        return [
            { name: 'Total Revenue', data: grouped.map(d => +d.grandTotal.toFixed(2)) },
            { name: 'Gaming', data: grouped.map(d => +d.gamesTotal.toFixed(2)) },
            { name: 'F&B', data: grouped.map(d => +d.itemsTotal.toFixed(2)) },
        ];
    })();

    const options: ApexOptions = {
        chart: {
            type: 'area',
            fontFamily: 'Outfit, sans-serif',
            toolbar: { show: false },
            zoom: { enabled: true },
            animations: { enabled: true, speed: 500 },
        },
        colors: ['#6366f1', '#10b981', '#f59e0b'],
        stroke: { curve: 'smooth', width: 2 },
        fill: {
            type: 'gradient',
            gradient: { opacityFrom: 0.4, opacityTo: 0.05, shadeIntensity: 0.3 },
        },
        xaxis: {
            categories: labels,
            labels: {
                rotate: -35,
                style: { fontSize: '11px' },
                hideOverlappingLabels: true,
            },
            axisBorder: { show: false },
            axisTicks: { show: false },
        },
        yaxis: {
            labels: {
                formatter: (v: number) => `$${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v.toFixed(0)}`,
            },
        },
        tooltip: {
            y: { formatter: (v: number) => `$${v.toFixed(2)}` },
        },
        grid: { yaxis: { lines: { show: true } }, xaxis: { lines: { show: false } } },
        legend: { show: series === 'all', position: 'top', horizontalAlign: 'left' },
        dataLabels: { enabled: false },
        markers: { size: 0, hover: { size: 4 } },
    };

    const totalRevenue = data.reduce((s, d) => s + d.grandTotal, 0);
    const totalGaming = data.reduce((s, d) => s + d.gamesTotal, 0);
    const totalFnb = data.reduce((s, d) => s + d.itemsTotal, 0);

    return (
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-5 md:p-6">
            <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
                <div>
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">Revenue Trend</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">All-time since opening</p>
                </div>

                <div className="flex flex-wrap gap-2">
                    {/* Group by */}
                    <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                        {(['day', 'week', 'month'] as GroupBy[]).map(g => (
                            <button key={g}
                                onClick={() => setGroupBy(g)}
                                className={`px-3 py-1 text-xs font-medium transition capitalize ${groupBy === g ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50'}`}
                            >
                                {g}
                            </button>
                        ))}
                    </div>

                    {/* Series filter */}
                    <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                        {([['all', 'All'], ['gaming', '🎮'], ['fnb', '🍔'], ['tcg', '🃏']] as [string, string][]).map(([v, l]) => (
                            <button key={v}
                                onClick={() => setSeries(v as any)}
                                className={`px-3 py-1 text-xs font-medium transition ${series === v ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50'}`}
                            >
                                {l}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Summary strip */}
            <div className="flex gap-4 mb-4 flex-wrap">
                <div className="text-center">
                    <p className="text-xs text-gray-400">Total</p>
                    <p className="font-bold text-gray-800 dark:text-white">${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                </div>
                <div className="text-center">
                    <p className="text-xs text-gray-400">🎮 Gaming</p>
                    <p className="font-bold text-emerald-600">${totalGaming.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                </div>
                <div className="text-center">
                    <p className="text-xs text-gray-400">🍔 F&B</p>
                    <p className="font-bold text-amber-600">${totalFnb.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                </div>
                <div className="text-center">
                    <p className="text-xs text-gray-400">Days tracked</p>
                    <p className="font-bold text-gray-800 dark:text-white">{data.length}</p>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-20"><Loader /></div>
            ) : (
                <div className="overflow-x-auto">
                    <div style={{ minWidth: groupBy === 'day' ? 1200 : groupBy === 'week' ? 800 : 400 }}>
                        <Chart options={options} series={chartSeries} type="area" height={280} />
                    </div>
                </div>
            )}
        </div>
    );
}