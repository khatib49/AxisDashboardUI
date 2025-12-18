// src/pages/Admin/LoyaltyLeaderboard.tsx
import React, { useState, useEffect } from 'react';
import {
    getWeeklyLeaderboard,
    getMonthlyLeaderboard,
    LeaderboardEntry
} from '../../services/loyaltyService';
import Loader from '../../components/ui/Loader';
import Alert from '../../components/ui/alert/Alert';

type LeaderboardType = 'weekly' | 'monthly';

const LoyaltyLeaderboard: React.FC = () => {
    const [activeTab, setActiveTab] = useState<LeaderboardType>('monthly');
    const [weeklyData, setWeeklyData] = useState<LeaderboardEntry[]>([]);
    const [monthlyData, setMonthlyData] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadLeaderboard();
    }, [activeTab]);

    const loadLeaderboard = async () => {
        setLoading(true);
        setError(null);

        try {
            if (activeTab === 'weekly') {
                const data = await getWeeklyLeaderboard();
                setWeeklyData(data);
            } else {
                const data = await getMonthlyLeaderboard();
                setMonthlyData(data);
            }
        } catch (err: any) {
            setError(err?.response?.data?.message || 'Failed to load leaderboard');
        } finally {
            setLoading(false);
        }
    };

    const currentData = activeTab === 'weekly' ? weeklyData : monthlyData;

    const getRankColor = (rank: number) => {
        switch (rank) {
            case 1:
                return 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-white';
            case 2:
                return 'bg-gradient-to-r from-gray-300 to-gray-500 text-white';
            case 3:
                return 'bg-gradient-to-r from-orange-400 to-orange-600 text-white';
            default:
                return 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white';
        }
    };

    const getRankIcon = (rank: number) => {
        switch (rank) {
            case 1:
                return '🥇';
            case 2:
                return '🥈';
            case 3:
                return '🥉';
            default:
                return `#${rank}`;
        }
    };

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">
                🏆 Loyalty Leaderboard
            </h1>

            {/* Tabs */}
            <div className="flex gap-2 mb-6">
                <button
                    onClick={() => setActiveTab('monthly')}
                    className={`px-6 py-3 rounded-lg font-semibold transition ${
                        activeTab === 'monthly'
                            ? 'bg-purple-600 text-white shadow-lg'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                >
                    📅 Monthly
                </button>
                <button
                    onClick={() => setActiveTab('weekly')}
                    className={`px-6 py-3 rounded-lg font-semibold transition ${
                        activeTab === 'weekly'
                            ? 'bg-blue-600 text-white shadow-lg'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                >
                    📆 Weekly
                </button>
                <button
                    onClick={loadLeaderboard}
                    disabled={loading}
                    className="ml-auto px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                </button>
            </div>

            {/* Error Alert */}
            {error && (
                <div className="mb-6">
                    <Alert variant="error" title="Error" message={error} />
                </div>
            )}

            {/* Loading State */}
            {loading && (
                <div className="flex justify-center py-20">
                    <Loader />
                </div>
            )}

            {/* Leaderboard Display */}
            {!loading && currentData.length === 0 && (
                <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-lg shadow">
                    <p className="text-gray-500 dark:text-gray-400 text-lg">
                        No data available for {activeTab} leaderboard
                    </p>
                </div>
            )}

            {!loading && currentData.length > 0 && (
                <div className="space-y-4">
                    {/* Top 3 Podium */}
                    {currentData.length >= 3 && (
                        <div className="grid grid-cols-3 gap-4 mb-8">
                            {/* 2nd Place */}
                            <div className="pt-12">
                                <div className="bg-gradient-to-br from-gray-200 to-gray-400 rounded-lg p-6 text-center shadow-lg">
                                    <div className="text-4xl mb-2">🥈</div>
                                    <div className="text-xl font-bold text-gray-800 mb-1">
                                        {currentData[1].customerName || currentData[1].customerPhone}
                                    </div>
                                    <div className="text-3xl font-bold text-gray-900">
                                        {currentData[1].totalTickets}
                                    </div>
                                    <div className="text-sm text-gray-600">tickets</div>
                                </div>
                            </div>

                            {/* 1st Place */}
                            <div>
                                <div className="bg-gradient-to-br from-yellow-300 to-yellow-600 rounded-lg p-8 text-center shadow-2xl transform scale-110">
                                    <div className="text-5xl mb-3">🥇</div>
                                    <div className="text-2xl font-bold text-white mb-2">
                                        {currentData[0].customerName || currentData[0].customerPhone}
                                    </div>
                                    <div className="text-4xl font-bold text-white">
                                        {currentData[0].totalTickets}
                                    </div>
                                    <div className="text-sm text-yellow-100">tickets</div>
                                </div>
                            </div>

                            {/* 3rd Place */}
                            <div className="pt-12">
                                <div className="bg-gradient-to-br from-orange-300 to-orange-600 rounded-lg p-6 text-center shadow-lg">
                                    <div className="text-4xl mb-2">🥉</div>
                                    <div className="text-xl font-bold text-white mb-1">
                                        {currentData[2].customerName || currentData[2].customerPhone}
                                    </div>
                                    <div className="text-3xl font-bold text-white">
                                        {currentData[2].totalTickets}
                                    </div>
                                    <div className="text-sm text-orange-100">tickets</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Rest of the List */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 dark:bg-gray-700">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                                            Rank
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                                            Customer
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                                            Phone
                                        </th>
                                        <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                                            Tickets
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {currentData.map((entry) => (
                                        <tr
                                            key={entry.customerPhone}
                                            className="hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className={`inline-flex items-center justify-center w-10 h-10 rounded-full font-bold ${getRankColor(entry.rank)}`}>
                                                    {getRankIcon(entry.rank)}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                    {entry.customerName || 'Unknown'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                                    {entry.customerPhone}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-full">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                                                    </svg>
                                                    <span className="font-bold">{entry.totalTickets}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LoyaltyLeaderboard;