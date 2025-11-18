import React, { useEffect, useState } from 'react';
import { getTotalSales, PeriodTotalsDto } from '../../services/transactionService';
import { getCategoriesByType } from '../../services/categoryService';
import Loader from '../ui/Loader';
import Input from '../form/input/InputField';

type TotalSalesWidgetProps = {
    categoryType: 'game' | 'item' | 'all';
    title?: string;
    isAdmin?: boolean;
};

const TotalSalesWidget: React.FC<TotalSalesWidgetProps> = ({
    categoryType,
    title = 'Total Sales',
    isAdmin = false
}) => {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<PeriodTotalsDto | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [fromDate, setFromDate] = useState<string>('');
    const [toDate, setToDate] = useState<string>('');
    const [showFilters, setShowFilters] = useState(false);
    const [appliedFromDate, setAppliedFromDate] = useState<string>('');
    const [appliedToDate, setAppliedToDate] = useState<string>('');
    const [selectedItemType, setSelectedItemType] = useState<'all' | 'Food' | 'Retail'>('all');
    const [appliedItemType, setAppliedItemType] = useState<'all' | 'Food' | 'Retail'>('all');
    const [selectedCategoryType, setSelectedCategoryType] = useState<'all' | 'game' | 'item'>('all');
    const [appliedCategoryType, setAppliedCategoryType] = useState<'all' | 'game' | 'item'>('all');

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);

            let categoryIds: string | undefined;

            // Fetch categories based on type
            if (categoryType === 'all') {
                // Fetch both game and item categories
                const [gameCategories, itemCategories] = await Promise.all([
                    getCategoriesByType('game', 1, 100),
                    getCategoriesByType('item', 1, 100),
                ]);

                let filteredGameCategories = gameCategories.data;
                let filteredItemCategories = itemCategories.data;

                // Apply category type filter if admin and filter is set
                if (isAdmin && appliedCategoryType !== 'all') {
                    if (appliedCategoryType === 'game') {
                        filteredItemCategories = [];
                    } else if (appliedCategoryType === 'item') {
                        filteredGameCategories = [];
                    }
                }

                // Apply item type filter if admin and filter is set
                if (isAdmin && appliedItemType !== 'all') {
                    filteredItemCategories = filteredItemCategories.filter(c => c.itemType === appliedItemType);
                }

                const allCategoryIds = [
                    ...filteredGameCategories.map(c => c.id),
                    ...filteredItemCategories.map(c => c.id),
                ];
                categoryIds = allCategoryIds.join(',');
            } else if (categoryType === 'item') {
                const itemCategories = await getCategoriesByType('item', 1, 100);
                let filteredCategories = itemCategories.data;

                if (isAdmin) {
                    // Admin: Apply item type filter if specified
                    if (appliedItemType !== 'all') {
                        filteredCategories = filteredCategories.filter(c => c.itemType === appliedItemType);
                    }
                    // If 'all', include all item categories (both Food and Retail)
                } else {
                    // F&B Admin: Always filter to Food only
                    filteredCategories = filteredCategories.filter(c => c.itemType === 'Food');
                }

                categoryIds = filteredCategories.map(c => c.id).join(',');
            } else {
                // Fetch specific type categories
                const categories = await getCategoriesByType(categoryType, 1, 100);
                categoryIds = categories.data.map(c => c.id).join(',');
            }

            // Convert datetime-local format to ISO string for API
            const fromISO = appliedFromDate ? new Date(appliedFromDate).toISOString() : undefined;
            const toISO = appliedToDate ? new Date(appliedToDate).toISOString() : undefined;

            // Fetch total sales
            const totals = await getTotalSales({
                categoryIds,
                from: fromISO,
                to: toISO,
            });

            setData(totals);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load sales data');
        } finally {
            setLoading(false);
        }
    };

    const handleApplyFilters = () => {
        setAppliedFromDate(fromDate);
        setAppliedToDate(toDate);
        setAppliedItemType(selectedItemType);
        setAppliedCategoryType(selectedCategoryType);
    };

    const handleClearFilters = () => {
        setFromDate('');
        setToDate('');
        setAppliedFromDate('');
        setAppliedToDate('');
        setSelectedItemType('all');
        setAppliedItemType('all');
        setSelectedCategoryType('all');
        setAppliedCategoryType('all');
    };

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [categoryType, appliedFromDate, appliedToDate, appliedItemType, appliedCategoryType]);

    return (
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white relative">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <p className="text-sm font-medium opacity-90">{title}</p>
                    <p className="text-xs opacity-75 mt-1">
                        {categoryType === 'all' ? 'All Categories' :
                            categoryType === 'game' ? 'Game Categories' :
                                'Food & Beverage Categories'}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="bg-white/20 hover:bg-white/30 rounded-lg p-2 transition"
                        title="Toggle date filters"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                        </svg>
                    </button>
                    <div className="bg-white/20 rounded-full p-3">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                    </div>
                </div>
            </div>

            {/* Date Filters */}
            {showFilters && (
                <div className="mb-4 p-4 bg-white/10 rounded-lg">
                    {/* Category Type Filter - Only show for admin */}
                    {isAdmin && (
                        <div className="mb-3">
                            <label className="block text-xs font-medium mb-2 opacity-90">Category Type</label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setSelectedCategoryType('all')}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${selectedCategoryType === 'all'
                                            ? 'bg-white text-blue-600'
                                            : 'bg-white/20 hover:bg-white/30'
                                        }`}
                                >
                                    All
                                </button>
                                <button
                                    onClick={() => setSelectedCategoryType('game')}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${selectedCategoryType === 'game'
                                            ? 'bg-white text-blue-600'
                                            : 'bg-white/20 hover:bg-white/30'
                                        }`}
                                >
                                    🎮 Games
                                </button>
                                <button
                                    onClick={() => setSelectedCategoryType('item')}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${selectedCategoryType === 'item'
                                            ? 'bg-white text-blue-600'
                                            : 'bg-white/20 hover:bg-white/30'
                                        }`}
                                >
                                    📦 Items
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Item Type Filter - Only show for admin when items are included */}
                    {isAdmin && selectedCategoryType !== 'game' && (
                        <div className="mb-3">
                            <label className="block text-xs font-medium mb-2 opacity-90">Item Type</label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setSelectedItemType('all')}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${selectedItemType === 'all'
                                            ? 'bg-white text-blue-600'
                                            : 'bg-white/20 hover:bg-white/30'
                                        }`}
                                >
                                    All
                                </button>
                                <button
                                    onClick={() => setSelectedItemType('Food')}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${selectedItemType === 'Food'
                                            ? 'bg-white text-blue-600'
                                            : 'bg-white/20 hover:bg-white/30'
                                        }`}
                                >
                                    🍔 Food
                                </button>
                                <button
                                    onClick={() => setSelectedItemType('Retail')}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${selectedItemType === 'Retail'
                                            ? 'bg-white text-blue-600'
                                            : 'bg-white/20 hover:bg-white/30'
                                        }`}
                                >
                                    🛒 Retail
                                </button>
                            </div>
                        </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                        <div>
                            <label className="block text-xs font-medium mb-1 opacity-90">From Date & Time</label>
                            <Input
                                type="datetime-local"
                                value={fromDate}
                                onChange={(e) => setFromDate(e.target.value)}
                                className="w-full bg-white/20 border-white/30 text-white placeholder-white/50"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1 opacity-90">To Date & Time</label>
                            <Input
                                type="datetime-local"
                                value={toDate}
                                onChange={(e) => setToDate(e.target.value)}
                                className="w-full bg-white/20 border-white/30 text-white placeholder-white/50"
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleApplyFilters}
                            disabled={loading}
                            className="px-4 py-2 bg-white text-blue-600 rounded-lg text-sm font-medium hover:bg-white/90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {loading && <Loader size={14} />}
                            Apply Filters
                        </button>
                        {(fromDate || toDate || selectedItemType !== 'all' || selectedCategoryType !== 'all') && (
                            <button
                                onClick={handleClearFilters}
                                disabled={loading}
                                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                </div>
            )}

            {error && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-sm">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/10 rounded-lg p-4">
                    <p className="text-xs opacity-75 mb-1">Total Amount</p>
                    <p className="text-2xl font-bold">${data?.totalAmount.toFixed(2) || '0.00'}</p>
                </div>
                <div className="bg-white/10 rounded-lg p-4">
                    <p className="text-xs opacity-75 mb-1">Orders Count</p>
                    <p className="text-2xl font-bold">{data?.ordersCount || 0}</p>
                </div>
            </div>

            {data && data.ordersCount > 0 && (
                <div className="mt-4 pt-4 border-t border-white/20">
                    <p className="text-xs opacity-75">Average Order Value</p>
                    <p className="text-lg font-semibold mt-1">
                        ${(data.totalAmount / data.ordersCount).toFixed(2)}
                    </p>
                </div>
            )}
        </div>
    );
};

export default TotalSalesWidget;
