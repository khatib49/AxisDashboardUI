import { useEffect, useState } from 'react';
import { getTcgRetailProfit, ProfitDto } from '../../services/profitService';
import { getCategories, CategoryDto } from '../../services/categoryService';
import PageMeta from '../../components/common/PageMeta';
import Loader from '../../components/ui/Loader';
import DatePicker from '../../components/form/date-picker';

type DateFilter = 'today' | 'yesterday' | '7days' | '30days' | 'all' | 'custom';

export default function TcgProfit() {
    const [profit, setProfit] = useState<ProfitDto | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [dateFilter, setDateFilter] = useState<DateFilter>('30days');
    const [categories, setCategories] = useState<CategoryDto[]>([]);
    const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
    const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
    const [customDateRange, setCustomDateRange] = useState<[Date, Date] | null>(null);

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const res = await getCategories(1, 100);
                // Filter only retail categories (itemType = 'Retail')
                const retailCategories = res.data.filter(cat => cat.itemType === 'Retail');
                setCategories(retailCategories);
            } catch (err) {
                console.error('Failed to load categories:', err);
            }
        };
        fetchCategories();
    }, []);

    useEffect(() => {
        const fetchProfit = async () => {
            try {
                setLoading(true);
                setError(null);
                const now = new Date();
                let from: Date | undefined;
                let to: Date | undefined;

                switch (dateFilter) {
                    case 'today': {
                        from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
                        to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
                        break;
                    }
                    case 'yesterday': {
                        const yesterday = new Date(now);
                        yesterday.setDate(yesterday.getDate() - 1);
                        from = new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate(), 0, 0, 0, 0));
                        to = new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate(), 23, 59, 59, 999));
                        break;
                    }
                    case '7days': {
                        from = new Date(now);
                        from.setDate(from.getDate() - 7);
                        from = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), 0, 0, 0, 0));
                        to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
                        break;
                    }
                    case '30days': {
                        from = new Date(now);
                        from.setDate(from.getDate() - 30);
                        from = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), 0, 0, 0, 0));
                        to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
                        break;
                    }
                    case 'custom':
                        if (customDateRange) {
                            from = new Date(Date.UTC(customDateRange[0].getUTCFullYear(), customDateRange[0].getUTCMonth(), customDateRange[0].getUTCDate(), 0, 0, 0, 0));
                            to = new Date(Date.UTC(customDateRange[1].getUTCFullYear(), customDateRange[1].getUTCMonth(), customDateRange[1].getUTCDate(), 23, 59, 59, 999));
                        }
                        break;
                    case 'all':
                    default:
                        from = undefined;
                        to = undefined;
                        break;
                }

                const data = await getTcgRetailProfit({
                    from: from?.toISOString(),
                    to: to?.toISOString(),
                    categoryIds: selectedCategories.length > 0 ? selectedCategories.join(',') : undefined
                });

                setProfit(data);
            } catch (err: unknown) {
                const message = err && typeof err === 'object' && 'message' in err
                    ? String(err.message)
                    : 'Failed to load TCG retail profit data';
                setError(message);
            } finally {
                setLoading(false);
            }
        };

        fetchProfit();
    }, [dateFilter, selectedCategories, customDateRange]);

    return (
        <>
            <PageMeta title="TCG Retail Profit - AXIS" description="TCG retail profit analysis" />
            <div className="p-6">
                <h1 className="text-2xl font-semibold mb-6">TCG Retail Profit</h1>

                {/* Date Filter */}
                <div className="mb-6 flex gap-2 flex-wrap">
                    {[
                        { value: 'today', label: 'Today' },
                        { value: 'yesterday', label: 'Yesterday' },
                        { value: '7days', label: 'Last 7 Days' },
                        { value: '30days', label: 'Last 30 Days' },
                        { value: 'all', label: 'All Time' },
                        { value: 'custom', label: 'Custom Range' },
                    ].map((filter) => (
                        <button
                            key={filter.value}
                            onClick={() => setDateFilter(filter.value as DateFilter)}
                            className={`px-4 py-2 rounded-lg font-medium transition ${dateFilter === filter.value
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
                                }`}
                        >
                            {filter.label}
                        </button>
                    ))}
                </div>

                {/* Custom Date Range Picker */}
                {dateFilter === 'custom' && (
                    <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
                        <DatePicker
                            id="tcg-from-date"
                            label="From Date"
                            placeholder="Select start date"
                            onChange={(selectedDates) => {
                                if (selectedDates.length > 0) {
                                    const fromDate = selectedDates[0];
                                    setCustomDateRange(prev => [fromDate, prev?.[1] || fromDate]);
                                }
                            }}
                        />
                        <DatePicker
                            id="tcg-to-date"
                            label="To Date"
                            placeholder="Select end date"
                            onChange={(selectedDates) => {
                                if (selectedDates.length > 0) {
                                    const toDate = selectedDates[0];
                                    setCustomDateRange(prev => [prev?.[0] || toDate, toDate]);
                                }
                            }}
                        />
                    </div>
                )}

                {/* Category Filter */}
                <div className="mb-6 relative">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Filter by Categories (Optional)
                    </label>
                    <button
                        onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                        className="w-full md:w-96 px-4 py-2 text-left bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:border-gray-400 dark:hover:border-gray-500 transition"
                    >
                        {selectedCategories.length === 0 ? (
                            <span className="text-gray-500">All Categories</span>
                        ) : (
                            <span>{selectedCategories.length} categor{selectedCategories.length === 1 ? 'y' : 'ies'} selected</span>
                        )}
                    </button>
                    {showCategoryDropdown && (
                        <div className="absolute z-10 mt-1 w-full md:w-96 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                            <div className="p-2">
                                <button
                                    onClick={() => {
                                        setSelectedCategories([]);
                                        setShowCategoryDropdown(false);
                                    }}
                                    className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm text-blue-600 dark:text-blue-400"
                                >
                                    Clear All
                                </button>
                                {categories.map((category) => (
                                    <label
                                        key={category.id}
                                        className="flex items-center px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedCategories.includes(category.id)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedCategories([...selectedCategories, category.id]);
                                                } else {
                                                    setSelectedCategories(selectedCategories.filter(id => id !== category.id));
                                                }
                                            }}
                                            className="mr-2"
                                        />
                                        <span className="text-sm text-gray-700 dark:text-gray-300">{category.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {loading && (
                    <div className="flex justify-center py-20">
                        <Loader />
                    </div>
                )}

                {error && (
                    <div className="text-red-600 bg-red-50 p-4 rounded-lg">
                        {error}
                    </div>
                )}

                {!loading && !error && profit && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {/* Total Revenue */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Revenue</p>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                                        ${profit.totalRevenue.toFixed(2)}
                                    </p>
                                </div>
                                <div className="bg-blue-100 dark:bg-blue-900/30 rounded-full p-3">
                                    <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        {/* Total Expenses */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Expenses</p>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                                        ${profit.totalExpenses.toFixed(2)}
                                    </p>
                                </div>
                                <div className="bg-red-100 dark:bg-red-900/30 rounded-full p-3">
                                    <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        {/* Net Profit */}
                        <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 ${profit.netProfit < 0 ? 'border-2 border-red-500' : 'border-2 border-green-500'}`}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Net Profit</p>
                                    <p className={`text-2xl font-bold mt-2 ${profit.netProfit < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        ${profit.netProfit.toFixed(2)}
                                    </p>
                                </div>
                                <div className={`${profit.netProfit < 0 ? 'bg-red-100 dark:bg-red-900/30' : 'bg-green-100 dark:bg-green-900/30'} rounded-full p-3`}>
                                    <svg className={`w-6 h-6 ${profit.netProfit < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        {/* Profit Margin */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Profit Margin</p>
                                    <p className={`text-2xl font-bold mt-2 ${profit.profitMargin < 0 ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
                                        {profit.profitMargin.toFixed(2)}%
                                    </p>
                                </div>
                                <div className="bg-purple-100 dark:bg-purple-900/30 rounded-full p-3">
                                    <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        {/* Additional Info */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 md:col-span-2 lg:col-span-4">
                            <h3 className="text-lg font-semibold mb-4">Summary</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Transaction Count</p>
                                    <p className="text-xl font-semibold text-gray-900 dark:text-white mt-1">
                                        {profit.transactionCount}
                                    </p>
                                </div>
                                {profit.fromDate && (
                                    <div>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">From Date</p>
                                        <p className="text-xl font-semibold text-gray-900 dark:text-white mt-1">
                                            {new Date(profit.fromDate).toLocaleDateString()}
                                        </p>
                                    </div>
                                )}
                                {profit.toDate && (
                                    <div>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">To Date</p>
                                        <p className="text-xl font-semibold text-gray-900 dark:text-white mt-1">
                                            {new Date(profit.toDate).toLocaleDateString()}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
