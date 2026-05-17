// src/pages/Admin/LoyaltyCustomers.tsx
import React, { useState } from 'react';
import { getCustomerBalance, CustomerBalance } from '../../services/loyaltyService';
import Loader from '../../components/ui/Loader';
import Alert from '../../components/ui/alert/Alert';
import Input from '../../components/form/input/InputField';
import Label from '../../components/form/Label';

const LoyaltyCustomers: React.FC = () => {
    const [phoneNumber, setPhoneNumber] = useState('');
    const [customerData, setCustomerData] = useState<CustomerBalance | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
        } catch (err: any) {
            setError(err?.response?.data?.message || 'Failed to fetch customer data');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">
                🎟️ Loyalty Customer Lookup
            </h1>

            {/* Search Section */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
                <div className="space-y-4">
                    <div>
                        <Label>Customer Phone Number</Label>
                        <div className="flex gap-3">
                            <Input
                                type="text"
                                placeholder="Enter phone number..."
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSearch();
                                }}
                                className="flex-1"
                            />
                            <button
                                onClick={handleSearch}
                                disabled={loading}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <Loader size={16} />
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
                </div>
            </div>

            {/* Error Alert */}
            {error && (
                <div className="mb-6">
                    <Alert variant="error" title="Error" message={error} />
                </div>
            )}

            {/* Customer Data Display */}
            {customerData && (
                <div className="space-y-6">
                    {/* Summary Card */}
                    <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg shadow-lg p-8 text-white">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-bold mb-2">
                                    {customerData.customerName || 'Customer'}
                                </h2>
                                <p className="text-purple-100 text-lg">{customerData.customerPhone}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm opacity-90 mb-1">Total Tickets</p>
                                <p className="text-5xl font-bold">{customerData.totalTicketsCurrentMonth}</p>
                                <p className="text-sm opacity-75 mt-1">{customerData.currentMonth}</p>
                            </div>
                        </div>

                        <div className="mt-6 pt-6 border-t border-white/20">
                            <div className="flex items-center justify-between">
                                <span className="text-purple-100">Pending Balance</span>
                                <span className="text-2xl font-bold">${customerData.pendingBalance.toFixed(2)}</span>
                            </div>
                            <div className="mt-2 bg-white/10 rounded-full h-2">
                                <div
                                    className="bg-white rounded-full h-2 transition-all"
                                    style={{ width: `${Math.min((customerData.pendingBalance / 10) * 100, 100)}%` }}
                                />
                            </div>
                            <p className="text-sm text-purple-100 mt-1">
                                ${(10 - customerData.pendingBalance).toFixed(2)} more to next ticket
                            </p>
                        </div>
                    </div>

                    {/* Recent Tickets */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                        <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                            Recent Tickets
                        </h3>

                        {customerData.recentTickets.length === 0 ? (
                            <p className="text-gray-500 text-center py-8">No tickets earned yet</p>
                        ) : (
                            <div className="space-y-3">
                                {customerData.recentTickets.map((ticket) => (
                                    <div
                                        key={ticket.ticketId}
                                        className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300 rounded-full p-3">
                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <p className="font-semibold text-gray-900 dark:text-white">
                                                    {ticket.ticketsEarned} Ticket{ticket.ticketsEarned !== 1 ? 's' : ''}
                                                </p>
                                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                                    Transaction #{ticket.transactionId}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm text-gray-600 dark:text-gray-300">
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
                </div>
            )}
        </div>
    );
};

export default LoyaltyCustomers;