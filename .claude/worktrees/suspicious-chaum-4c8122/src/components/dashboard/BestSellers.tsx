import { useEffect, useState } from "react";
import { getItemSalesReport, ItemSalesReportDto } from "../../services/transactionService";
import { getCategories, CategoryDto } from "../../services/categoryService";
import Loader from "../ui/Loader";

type DateFilter = 'today' | 'yesterday' | '7days' | '30days' | 'custom';

export default function BestSellers() {
    const [items, setItems] = useState<ItemSalesReportDto[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<DateFilter>('30days');
    const [categories, setCategories] = useState<CategoryDto[]>([]);
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
    const [showFilters, setShowFilters] = useState(false);
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [appliedFrom, setAppliedFrom] = useState('');
    const [appliedTo, setAppliedTo] = useState('');
    const [topN, setTopN] = useState(10);

    useEffect(() => {
        getCategories(1, 100).then(res => setCategories(res.data || [])).catch(() => {});
    }, []);

    useEffect(() => {
        fetchBestSellers();
    }, [filter, selectedCategoryIds, appliedFrom, appliedTo, topN]);

    const fetchBestSellers = async () => {
        try {
            setLoading(true);
            const now = new Date();
            let from: Date;
            let to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));

            if (filter === 'custom') {
                if (!appliedFrom || !appliedTo) { setLoading(false); return; }
                from = new Date(appliedFrom);
                to = new Date(appliedTo);
            } else {
                switch (filter) {
                    case 'today':
                        from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
                        break;
                    case 'yesterday': {
                        const y = new Date(now); y.setDate(y.getDate() - 1);
                        from = new Date(Date.UTC(y.getUTCFullYear(), y.getUTCMonth(), y.getUTCDate(), 0, 0, 0, 0));
                        to = new Date(Date.UTC(y.getUTCFullYear(), y.getUTCMonth(), y.getUTCDate(), 23, 59, 59, 999));
                        break;
                    }
                    case '7days':
                        from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 7, 0, 0, 0, 0));
                        break;
                    default:
                        from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 30, 0, 0, 0, 0));
                }
            }

            const data = await getItemSalesReport({
                from: from.toISOString(),
                to: to.toISOString(),
                top: topN,
                categoryIds: selectedCategoryIds.length > 0 ? selectedCategoryIds.join(',') : undefined,
            });
            setItems(data);
        } catch (error) {
            console.error("Failed to fetch best sellers:", error);
        } finally {
            setLoading(false);
        }
    };

    const toggleCategory = (id: number) => {
        setSelectedCategoryIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const applyCustom = () => {
        if (customFrom && customTo) {
            setAppliedFrom(customFrom);
            setAppliedTo(customTo);
            setFilter('custom');
        }
    };

    const filterBtns: { value: DateFilter; label: string }[] = [
        { value: 'today', label: 'Today' },
        { value: 'yesterday', label: 'Yesterday' },
        { value: '7days', label: '7 Days' },
        { value: '30days', label: '30 Days' },
        { value: 'custom', label: '📅 Custom' },
    ];

    const maxAmount = items.length > 0 ? Math.max(...items.map(i => i.totalAmount)) : 1;

    return (
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-5 md:p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">Best Sellers</h3>
                    <p className="mt-1 text-gray-500 text-sm dark:text-gray-400">Top selling items by revenue</p>
                </div>
                <button
                    onClick={() => setShowFilters(f => !f)}
                    className={`p-2 rounded-lg transition ${showFilters ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    title="Filters"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                </button>
            </div>

            {/* Date filter buttons */}
            <div className="flex flex-wrap gap-2 mb-3">
                {filterBtns.map(btn => (
                    <button
                        key={btn.value}
                        onClick={() => { if (btn.value !== 'custom') setFilter(btn.value); else setShowFilters(true); }}
                        className={`px-3 py-1 rounded-lg text-sm font-medium transition ${filter === btn.value
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'}`}
                    >
                        {btn.label}
                    </button>
                ))}
            </div>

            {/* Expandable filter panel */}
            {showFilters && (
                <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                    {/* Custom date range */}
                    <div className="mb-3">
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Custom Date Range</p>
                        <div className="flex gap-2 flex-wrap">
                            <input
                                type="date"
                                value={customFrom}
                                onChange={e => setCustomFrom(e.target.value)}
                                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                            <span className="self-center text-gray-400 text-sm">→</span>
                            <input
                                type="date"
                                value={customTo}
                                onChange={e => setCustomTo(e.target.value)}
                                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                            <button
                                onClick={applyCustom}
                                disabled={!customFrom || !customTo}
                                className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition"
                            >
                                Apply
                            </button>
                        </div>
                    </div>

                    {/* Top N */}
                    <div className="mb-3">
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Show Top</p>
                        <div className="flex gap-2">
                            {[5, 10, 20, 50].map(n => (
                                <button key={n}
                                    onClick={() => setTopN(n)}
                                    className={`px-3 py-1 rounded-lg text-sm font-medium transition ${topN === n ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                                >
                                    Top {n}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Category filter */}
                    <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
                            Filter by Category
                            {selectedCategoryIds.length > 0 && (
                                <button onClick={() => setSelectedCategoryIds([])} className="ml-2 text-blue-500 normal-case font-normal">Clear</button>
                            )}
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {categories.filter(c => c.type === 'item').map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => toggleCategory(cat.id)}
                                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
                                        selectedCategoryIds.includes(cat.id)
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                                    }`}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* List */}
            {loading ? (
                <div className="flex justify-center py-10"><Loader /></div>
            ) : items.length === 0 ? (
                <div className="text-center py-10 text-gray-500">No data available</div>
            ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                    {items.map((item, index) => {
                        const barWidth = Math.round((item.totalAmount / maxAmount) * 100);
                        const isTcg = item.categoryName?.toLowerCase().includes('tcg') || item.categoryName?.toLowerCase().includes('retail');
                        return (
                            <div key={item.itemId} className="relative p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition overflow-hidden">
                                {/* Progress bar background */}
                                <div
                                    className={`absolute inset-y-0 left-0 opacity-10 rounded-xl transition-all ${isTcg ? 'bg-purple-500' : 'bg-blue-500'}`}
                                    style={{ width: `${barWidth}%` }}
                                />
                                <div className="relative flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <div className={`flex items-center justify-center w-7 h-7 rounded-full text-white font-bold text-xs shrink-0 ${
                                            index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-orange-400' : 'bg-blue-500'
                                        }`}>
                                            {index + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-gray-800 dark:text-white/90 truncate text-sm">{item.itemName}</p>
                                            <p className="text-xs text-gray-400">{item.categoryName}</p>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="font-bold text-gray-800 dark:text-white/90 text-sm">${item.totalAmount.toFixed(2)}</p>
                                        <p className="text-xs text-gray-400">{item.totalQuantity} sold</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}