// src/pages/Cashier/LoyaltyCheck.tsx
import React, { useState } from 'react';
import { getCustomerBalance, CustomerBalance } from '../../services/loyaltyService';
import Loader from '../../components/ui/Loader';
import Input from '../../components/form/input/InputField';
import Label from '../../components/form/Label';

const LoyaltyCheck: React.FC = () => {
    const [phoneNumber, setPhoneNumber] = useState('');
    const [customerData, setCustomerData] = useState<CustomerBalance | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchHistory, setSearchHistory] = useState<string[]>([]);

    const handleSearch = async () => {
        if (!phoneNumber.trim()) {
            setError('Please enter a phone number');
            return;
        }

        setLoading(true);
        setError(null);
        setCustomerData(null);

        try {
            const data = await getCustomerBalance(phoneNumber.trim());
            setCustomerData(data);
            
            // Add to search history (keep last 5)
            setSearchHistory(prev => {
                const newHistory = [phoneNumber.trim(), ...prev.filter(p => p !== phoneNumber.trim())];
                return newHistory.slice(0, 5);
            });
        } catch (err: any) {
            setError(err?.response?.data?.message || 'Customer not found in loyalty system');
        } finally {
            setLoading(false);
        }
    };

    const handleClearSearch = () => {
        setPhoneNumber('');
        setCustomerData(null);
        setError(null);
    };

    const handleQuickSearch = (phone: string) => {
        setPhoneNumber(phone);
        setTimeout(() => {
            handleSearch();
        }, 100);
    };

    return (
        <div className="p-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                    🎟️ Loyalty Ticket Check
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                    Search for a customer's loyalty ticket balance and progress
                </p>
            </div>

            {/* Info Banner */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6 flex items-start gap-3">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-200">How Loyalty Works</p>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                        Customers earn 1 ticket for every $10 spent. Pending balance carries forward to future purchases. Tickets reset monthly.
                    </p>
                </div>
            </div>

            {/* Search Box */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
                <div className="space-y-4">
                    <div>
                        <Label>Customer Phone Number</Label>
                        <div className="flex gap-3 mt-2">
                            <Input
                                type="text"
                                placeholder="Enter phone number (e.g., +9611234567)"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSearch();
                                }}
                                className="flex-1 text-lg"
                            />
                            {phoneNumber && (
                                <button
                                    onClick={handleClearSearch}
                                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                                >
                                    Clear
                                </button>
                            )}
                            <button
                                onClick={handleSearch}
                                disabled={loading || !phoneNumber.trim()}
                                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-semibold"
                            >
                                {loading ? (
                                    <>
                                        <Loader size={20} />
                                        Searching...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                        Search
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Search History */}
                    {searchHistory.length > 0 && !customerData && (
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Recent Searches:</p>
                            <div className="flex flex-wrap gap-2">
                                {searchHistory.map((phone, index) => (
                                    <button
                                        key={index}
                                        onClick={() => handleQuickSearch(phone)}
                                        className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                                    >
                                        {phone}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                            <svg className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div className="flex-1">
                                <p className="text-sm font-medium text-red-800 dark:text-red-200">Not Found</p>
                                <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Customer Data Display */}
            {customerData && (
                <div className="space-y-6 animate-fadeIn">
                    {/* Main Tickets Card */}
                    <div className="bg-gradient-to-br from-purple-600 via-purple-700 to-blue-600 rounded-2xl shadow-2xl p-8 text-white relative overflow-hidden">
                        {/* Decorative Elements */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32"></div>
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full -ml-24 -mb-24"></div>
                        
                        <div className="relative z-10">
                            <div className="flex items-start justify-between mb-6">
                                <div className="flex-1">
                                    <p className="text-purple-200 text-sm font-medium mb-2">LOYALTY MEMBER</p>
                                    <h2 className="text-3xl font-bold mb-1">
                                        {customerData.customerName || 'Valued Customer'}
                                    </h2>
                                    <p className="text-purple-100 text-lg">{customerData.customerPhone}</p>
                                </div>
                                <div className="text-right">
                                    <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-3">
                                        <p className="text-xs opacity-90 mb-1">CURRENT MONTH</p>
                                        <p className="text-sm font-semibold">{customerData.currentMonth}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 mb-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-purple-200 text-sm mb-2">Total Tickets</p>
                                        <p className="text-6xl font-bold">
                                            {customerData.totalTicketsCurrentMonth}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <div className="bg-white/20 rounded-full p-4">
                                            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="border-t border-white/20 pt-6">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-purple-100 font-medium">Progress to Next Ticket</span>
                                    <span className="text-2xl font-bold">
                                        ${customerData.pendingBalance.toFixed(2)} / $10.00
                                    </span>
                                </div>
                                <div className="bg-white/20 rounded-full h-4 overflow-hidden mb-3">
                                    <div
                                        className="bg-gradient-to-r from-green-400 to-emerald-400 h-4 rounded-full transition-all duration-700 ease-out"
                                        style={{ width: `${Math.min((customerData.pendingBalance / 10) * 100, 100)}%` }}
                                    />
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-purple-200">
                                        {((customerData.pendingBalance / 10) * 100).toFixed(0)}% Complete
                                    </span>
                                    <span className="text-purple-200">
                                        ${(10 - customerData.pendingBalance).toFixed(2)} to next ticket
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border-l-4 border-purple-500">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Tickets</p>
                                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                                        {customerData.totalTicketsCurrentMonth}
                                    </p>
                                </div>
                                <div className="bg-purple-100 dark:bg-purple-900/30 rounded-full p-3">
                                    <svg className="w-8 h-8 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border-l-4 border-blue-500">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Pending Balance</p>
                                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                                        ${customerData.pendingBalance.toFixed(2)}
                                    </p>
                                </div>
                                <div className="bg-blue-100 dark:bg-blue-900/30 rounded-full p-3">
                                    <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border-l-4 border-green-500">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Transactions</p>
                                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                                        {customerData.recentTickets.length}
                                    </p>
                                </div>
                                <div className="bg-green-100 dark:bg-green-900/30 rounded-full p-3">
                                    <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Recent Tickets History */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Recent Ticket Earnings
                            </h3>
                            <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 rounded-full text-sm font-semibold">
                                {customerData.recentTickets.length} Transaction{customerData.recentTickets.length !== 1 ? 's' : ''}
                            </span>
                        </div>

                        {customerData.recentTickets.length === 0 ? (
                            <div className="text-center py-12">
                                <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full mb-4">
                                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                    </svg>
                                </div>
                                <p className="text-gray-500 dark:text-gray-400 text-lg">No tickets earned yet</p>
                                <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">This customer will earn tickets on their next purchase</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {customerData.recentTickets.map((ticket) => (
                                    <div
                                        key={ticket.ticketId}
                                        className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/10 dark:to-blue-900/10 rounded-lg border border-purple-200 dark:border-purple-800 hover:shadow-md transition-all"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 rounded-full p-3">
                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <p className="font-semibold text-gray-900 dark:text-white text-lg">
                                                    +{ticket.ticketsEarned} Ticket{ticket.ticketsEarned !== 1 ? 's' : ''}
                                                </p>
                                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                                    Transaction #{ticket.transactionId}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                {new Date(ticket.earnedDate).toLocaleDateString('en-US', {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    year: 'numeric'
                                                })}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                {new Date(ticket.earnedDate).toLocaleTimeString('en-US', {
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Action Button */}
                    <div className="flex justify-center">
                        <button
                            onClick={handleClearSearch}
                            className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition font-medium flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            Search Another Customer
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LoyaltyCheck;