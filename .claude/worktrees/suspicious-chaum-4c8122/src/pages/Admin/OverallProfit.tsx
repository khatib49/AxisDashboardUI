import { useEffect, useState } from 'react';
import { getOverallProfit, DetailedOverallProfitDto } from '../../services/profitService';
import PageMeta from '../../components/common/PageMeta';
import Loader from '../../components/ui/Loader';
import DatePicker from '../../components/form/date-picker';

type DateFilter = 'today' | 'yesterday' | '7days' | '30days' | 'all' | 'custom';

export default function OverallProfit() {
    const [profit, setProfit] = useState<DetailedOverallProfitDto | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [dateFilter, setDateFilter] = useState<DateFilter>('30days');
    const [customDateRange, setCustomDateRange] = useState<[Date, Date] | null>(null);

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

                const data = await getOverallProfit({
                    from: from?.toISOString(),
                    to: to?.toISOString()
                });

                console.log('Overall profit data:', data);
                setProfit(data);
            } catch (err: unknown) {
                const message = err && typeof err === 'object' && 'message' in err
                    ? String(err.message)
                    : 'Failed to load overall profit data';
                setError(message);
            } finally {
                setLoading(false);
            }
        };

        fetchProfit();
    }, [dateFilter, customDateRange]);

    return (
        <>
            <PageMeta title="Overall Profit - AXIS" description="Overall business profit analysis" />
            <div className="p-6">
                <h1 className="text-2xl font-semibold mb-6">Overall Profit</h1>

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
                            id="overall-from-date"
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
                            id="overall-to-date"
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

                {!loading && !error && profit && profit.fnbProfit && profit.gamingProfit && profit.tcgRetailProfit && (
                    <div className="space-y-6">
                        {/* Segment Breakdown */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                            <h2 className="text-xl font-semibold mb-4">Business Segments</h2>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Food & Beverage */}
                                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                    <h3 className="text-lg font-semibold text-blue-600 dark:text-blue-400 mb-3">Food & Beverage</h3>
                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <span className="text-sm text-gray-600 dark:text-gray-400">Revenue:</span>
                                            <span className="font-semibold">${(profit.fnbProfit.totalRevenue ?? 0).toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-sm text-gray-600 dark:text-gray-400">Expenses:</span>
                                            <span className="font-semibold">${(profit.fnbProfit.totalExpenses ?? 0).toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-2">
                                            <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Net Profit:</span>
                                            <span className={`font-bold ${(profit.fnbProfit.netProfit ?? 0) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                ${(profit.fnbProfit.netProfit ?? 0).toFixed(2)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-sm text-gray-600 dark:text-gray-400">Margin:</span>
                                            <span className={`font-semibold ${(profit.fnbProfit.profitMargin ?? 0) < 0 ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
                                                {(profit.fnbProfit.profitMargin ?? 0).toFixed(2)}%
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-sm text-gray-600 dark:text-gray-400">Transactions:</span>
                                            <span className="font-semibold">{profit.fnbProfit.transactionCount ?? 0}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Gaming */}
                                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                    <h3 className="text-lg font-semibold text-purple-600 dark:text-purple-400 mb-3">Gaming</h3>
                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <span className="text-sm text-gray-600 dark:text-gray-400">Revenue:</span>
                                            <span className="font-semibold">${(profit.gamingProfit.totalRevenue ?? 0).toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-sm text-gray-600 dark:text-gray-400">Expenses:</span>
                                            <span className="font-semibold">${(profit.gamingProfit.totalExpenses ?? 0).toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-2">
                                            <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Net Profit:</span>
                                            <span className={`font-bold ${(profit.gamingProfit.netProfit ?? 0) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                ${(profit.gamingProfit.netProfit ?? 0).toFixed(2)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-sm text-gray-600 dark:text-gray-400">Margin:</span>
                                            <span className={`font-semibold ${(profit.gamingProfit.profitMargin ?? 0) < 0 ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
                                                {(profit.gamingProfit.profitMargin ?? 0).toFixed(2)}%
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-sm text-gray-600 dark:text-gray-400">Transactions:</span>
                                            <span className="font-semibold">{profit.gamingProfit.transactionCount ?? 0}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* TCG Retail */}
                                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                    <h3 className="text-lg font-semibold text-orange-600 dark:text-orange-400 mb-3">TCG Retail</h3>
                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <span className="text-sm text-gray-600 dark:text-gray-400">Revenue:</span>
                                            <span className="font-semibold">${(profit.tcgRetailProfit.totalRevenue ?? 0).toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-sm text-gray-600 dark:text-gray-400">Expenses:</span>
                                            <span className="font-semibold">${(profit.tcgRetailProfit.totalExpenses ?? 0).toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-2">
                                            <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Net Profit:</span>
                                            <span className={`font-bold ${(profit.tcgRetailProfit.netProfit ?? 0) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                ${(profit.tcgRetailProfit.netProfit ?? 0).toFixed(2)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-sm text-gray-600 dark:text-gray-400">Margin:</span>
                                            <span className={`font-semibold ${(profit.tcgRetailProfit.profitMargin ?? 0) < 0 ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
                                                {(profit.tcgRetailProfit.profitMargin ?? 0).toFixed(2)}%
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-sm text-gray-600 dark:text-gray-400">Transactions:</span>
                                            <span className="font-semibold">{profit.tcgRetailProfit.transactionCount ?? 0}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Overall Totals */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {/* Total Revenue */}
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">Total Revenue</p>
                                        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                                            ${(profit.totalRevenue ?? 0).toFixed(2)}
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
                                            ${(profit.totalExpenses ?? 0).toFixed(2)}
                                        </p>
                                    </div>
                                    <div className="bg-red-100 dark:bg-red-900/30 rounded-full p-3">
                                        <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                        </svg>
                                    </div>
                                </div>
                            </div>

                            {/* Overall Net Profit */}
                            <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 ${(profit.netProfit ?? 0) < 0 ? 'border-2 border-red-500' : 'border-2 border-green-500'}`}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">Overall Net Profit</p>
                                        <p className={`text-2xl font-bold mt-2 ${(profit.netProfit ?? 0) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                            ${(profit.netProfit ?? 0).toFixed(2)}
                                        </p>
                                    </div>
                                    <div className={`${(profit.netProfit ?? 0) < 0 ? 'bg-red-100 dark:bg-red-900/30' : 'bg-green-100 dark:bg-green-900/30'} rounded-full p-3`}>
                                        <svg className={`w-6 h-6 ${(profit.netProfit ?? 0) < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                        </svg>
                                    </div>
                                </div>
                            </div>

                            {/* Overall Profit Margin */}
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">Overall Margin</p>
                                        <p className={`text-2xl font-bold mt-2 ${(profit.profitMargin ?? 0) < 0 ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
                                            {(profit.profitMargin ?? 0).toFixed(2)}%
                                        </p>
                                    </div>
                                    <div className="bg-purple-100 dark:bg-purple-900/30 rounded-full p-3">
                                        <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                        </svg>
                                    </div>
                                </div>
                            </div>

                            {/* Summary Info */}
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 md:col-span-2 lg:col-span-4">
                                <h3 className="text-lg font-semibold mb-4">Summary</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">Total Transactions</p>
                                        <p className="text-xl font-semibold text-gray-900 dark:text-white mt-1">
                                            {(profit.fnbProfit.transactionCount ?? 0) + (profit.gamingProfit.transactionCount ?? 0) + (profit.tcgRetailProfit.transactionCount ?? 0)}
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
                    </div>
                )}
            </div>
        </>
    );
}
