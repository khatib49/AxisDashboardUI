import { useEffect, useState } from 'react';
import { getKitchenStats, KitchenStatsDto } from '../../services/kitchenService';
import PageMeta from '../../components/common/PageMeta';
import Loader from '../../components/ui/Loader';

export default function KitchenStats() {
    const [stats, setStats] = useState<KitchenStatsDto | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadStats = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await getKitchenStats();
            setStats(data);
        } catch (err: unknown) {
            const message = err && typeof err === 'object' && 'message' in err
                ? String(err.message)
                : 'Failed to load kitchen statistics';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadStats();
        // Refresh every 30 seconds
        const interval = setInterval(loadStats, 30000);
        return () => clearInterval(interval);
    }, []);

    return (
        <>
            <PageMeta title="Kitchen Statistics - AXIS" description="Kitchen performance statistics" />
            <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-semibold">Kitchen Statistics</h1>
                    <button
                        onClick={loadStats}
                        className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                    >
                        Refresh
                    </button>
                </div>

                {error && (
                    <div className="mb-4 text-red-600 bg-red-50 p-4 rounded-lg">
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="flex justify-center py-20">
                        <Loader />
                    </div>
                ) : stats ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {/* Pending Orders */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-yellow-500">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Pending Orders</p>
                                    <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                                        {stats.pendingOrders}
                                    </p>
                                </div>
                                <div className="bg-yellow-100 dark:bg-yellow-900/30 rounded-full p-3">
                                    <svg className="w-8 h-8 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        {/* In Progress Orders */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-blue-500">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">In Progress</p>
                                    <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                                        {stats.inProgressOrders}
                                    </p>
                                </div>
                                <div className="bg-blue-100 dark:bg-blue-900/30 rounded-full p-3">
                                    <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        {/* Ready Orders */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-green-500">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Ready for Pickup</p>
                                    <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                                        {stats.readyOrders}
                                    </p>
                                </div>
                                <div className="bg-green-100 dark:bg-green-900/30 rounded-full p-3">
                                    <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        {/* Served Today */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-purple-500">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Served Today</p>
                                    <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                                        {stats.servedToday}
                                    </p>
                                </div>
                                <div className="bg-purple-100 dark:bg-purple-900/30 rounded-full p-3">
                                    <svg className="w-8 h-8 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        {/* Average Preparation Time */}
                        {stats.averagePreparationTime !== null && stats.averagePreparationTime !== undefined && (
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-indigo-500 md:col-span-2 lg:col-span-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">Average Preparation Time</p>
                                        <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                                            {Math.round(stats.averagePreparationTime)} minutes
                                        </p>
                                    </div>
                                    <div className="bg-indigo-100 dark:bg-indigo-900/30 rounded-full p-3">
                                        <svg className="w-8 h-8 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Summary Card */}
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700 rounded-lg shadow p-6 md:col-span-2 lg:col-span-4">
                            <h2 className="text-xl font-semibold mb-4">Quick Summary</h2>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                                <div>
                                    <p className="text-2xl font-bold text-yellow-600">{stats.pendingOrders}</p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Waiting</p>
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-blue-600">{stats.inProgressOrders}</p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Cooking</p>
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-green-600">{stats.readyOrders}</p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Ready</p>
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-purple-600">{stats.servedToday}</p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Completed</p>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-10 text-gray-500">
                        No statistics available
                    </div>
                )}
            </div>
        </>
    );
}
