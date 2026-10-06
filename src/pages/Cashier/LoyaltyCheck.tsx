// src/pages/Cashier/LoyaltyCheck.tsx
import React, { useState } from 'react';
import { Skeleton } from 'antd';
import {
    CloseOutlined, ExclamationCircleOutlined, HistoryOutlined, InfoCircleOutlined, SearchOutlined, TagOutlined,
} from '@ant-design/icons';
import { getCustomerBalance, CustomerBalance } from '../../services/loyaltyService';
import Loader from '../../components/ui/Loader';
import { Pill } from '../../components/ui/PageKit';
import { DeskEmpty, DeskHeader } from '../../components/till/desk/DeskKit';
import { deskBtn, deskCard } from '../../components/till/desk/deskStyles';

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
        } catch (err: unknown) {
            setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Customer not found in loyalty system');
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
        <div className="mx-auto max-w-5xl space-y-4 p-3 sm:p-6">
            <DeskHeader
                icon={<span aria-hidden>🎟️</span>}
                title="Loyalty Ticket Check"
                description="Search for a customer's loyalty ticket balance and progress"
            />

            {/* Info Banner */}
            <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3 dark:border-blue-500/20 dark:bg-blue-500/10">
                <InfoCircleOutlined className="mt-0.5 text-lg text-blue-600 dark:text-blue-300" />
                <div className="flex-1">
                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">How Loyalty Works</p>
                    <p className="mt-0.5 text-sm text-blue-700 dark:text-blue-300">
                        Customers earn 1 ticket for every $10 spent. Pending balance carries forward to future purchases. Tickets reset monthly.
                    </p>
                </div>
            </div>

            {/* Search Box */}
            <section className={`${deskCard} border-gray-200/80 p-4 sm:p-5 dark:border-white/[0.06]`}>
                <label htmlFor="loyalty-phone" className="text-sm font-medium text-gray-700 dark:text-gray-300">Customer Phone Number</label>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <div className="relative flex-1">
                        <SearchOutlined className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl text-gray-400 dark:text-gray-500" />
                        <input
                            id="loyalty-phone"
                            type="text"
                            inputMode="tel"
                            autoComplete="off"
                            placeholder="Enter phone number (e.g., +9611234567)"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSearch();
                            }}
                            className="h-14 w-full rounded-xl border border-gray-200 bg-white pl-12 pr-4 text-xl tabular-nums text-gray-900 placeholder:text-base placeholder:text-gray-400 focus:border-violet-400 focus:outline-none focus:ring-4 focus:ring-violet-500/15 dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:placeholder:text-gray-500"
                        />
                    </div>
                    <div className="flex gap-2">
                        {phoneNumber && (
                            <button onClick={handleClearSearch} className={`${deskBtn('outline', 'lg')} min-h-14! flex-1 sm:flex-none`}>
                                <CloseOutlined /> Clear
                            </button>
                        )}
                        <button
                            onClick={handleSearch}
                            disabled={loading || !phoneNumber.trim()}
                            className={`${deskBtn('primary', 'lg')} min-h-14! flex-1 px-7! sm:flex-none`}
                        >
                            {loading ? (
                                <>
                                    <Loader size={20} />
                                    Searching...
                                </>
                            ) : (
                                <>
                                    <SearchOutlined />
                                    Search
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Search History */}
                {searchHistory.length > 0 && !customerData && (
                    <div className="mt-4">
                        <p className="mb-2 flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400"><HistoryOutlined /> Recent Searches:</p>
                        <div className="flex flex-wrap gap-2">
                            {searchHistory.map((phone, index) => (
                                <button
                                    key={index}
                                    onClick={() => handleQuickSearch(phone)}
                                    className="min-h-11 rounded-full border border-gray-200 bg-gray-50 px-4 text-sm font-medium tabular-nums text-gray-700 transition hover:bg-gray-100 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-200 dark:hover:bg-white/[0.08]"
                                >
                                    {phone}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Error Message */}
                {error && (
                    <div role="alert" className="mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-500/20 dark:bg-red-500/10">
                        <ExclamationCircleOutlined className="mt-0.5 text-lg text-red-600 dark:text-red-400" />
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-red-800 dark:text-red-200">Not Found</p>
                            <p className="mt-0.5 text-sm text-red-700 dark:text-red-300">{error}</p>
                        </div>
                    </div>
                )}
            </section>

            {/* Result placeholder while searching */}
            {loading && (
                <div className={`${deskCard} border-gray-200/80 p-6 dark:border-white/[0.06]`}>
                    <Skeleton active avatar paragraph={{ rows: 4 }} />
                </div>
            )}

            {/* Customer Data Display */}
            {customerData && (
                <div className="space-y-4">
                    {/* Main result card */}
                    <section className={`${deskCard} overflow-hidden border-violet-200 dark:border-violet-500/20`}>
                        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-violet-100 bg-gradient-to-br from-violet-50 via-white to-white p-5 dark:border-violet-500/10 dark:from-violet-500/10 dark:via-transparent dark:to-transparent">
                            <div className="flex min-w-0 items-center gap-3">
                                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-violet-600 text-lg font-bold text-white shadow-lg shadow-violet-600/25">
                                    {(customerData.customerName || 'V').trim().charAt(0).toUpperCase()}
                                </span>
                                <div className="min-w-0">
                                    <Pill tone="violet" dot>LOYALTY MEMBER</Pill>
                                    <h2 className="mt-1 truncate text-2xl font-bold text-gray-900 dark:text-white">
                                        {customerData.customerName || 'Valued Customer'}
                                    </h2>
                                    <p className="text-base tabular-nums text-gray-600 dark:text-gray-300">{customerData.customerPhone}</p>
                                </div>
                            </div>
                            <div className="rounded-xl border border-gray-200/80 bg-white px-4 py-2 text-right dark:border-white/10 dark:bg-white/[0.04]">
                                <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">CURRENT MONTH</p>
                                <p className="text-sm font-semibold text-gray-900 dark:text-white">{customerData.currentMonth}</p>
                            </div>
                        </div>

                        <div className="grid gap-5 p-5 md:grid-cols-[auto_1fr] md:items-center">
                            {/* Key figure */}
                            <div className="flex items-center gap-4 md:border-r md:border-gray-100 md:pr-8 dark:md:border-white/[0.06]">
                                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-2xl text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
                                    <TagOutlined />
                                </span>
                                <div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Tickets</p>
                                    <p className="text-6xl font-bold leading-none tabular-nums text-gray-900 dark:text-white">
                                        {customerData.totalTicketsCurrentMonth}
                                    </p>
                                </div>
                            </div>

                            {/* Progress to next ticket */}
                            <div>
                                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Progress to Next Ticket</span>
                                    <span className="text-2xl font-bold tabular-nums text-gray-900 dark:text-white">
                                        ${customerData.pendingBalance.toFixed(2)} / $10.00
                                    </span>
                                </div>
                                <div
                                    role="progressbar"
                                    aria-label="Progress to next ticket"
                                    aria-valuemin={0}
                                    aria-valuemax={10}
                                    aria-valuenow={customerData.pendingBalance}
                                    className="h-4 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10"
                                >
                                    <div
                                        className="h-4 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                                        style={{ width: `${Math.min((customerData.pendingBalance / 10) * 100, 100)}%` }}
                                    />
                                </div>
                                <div className="mt-2 flex items-center justify-between text-sm tabular-nums text-gray-500 dark:text-gray-400">
                                    <span>{((customerData.pendingBalance / 10) * 100).toFixed(0)}% Complete</span>
                                    <span>${(10 - customerData.pendingBalance).toFixed(2)} to next ticket</span>
                                </div>
                            </div>
                        </div>

                        {/* Quick Stats */}
                        <div className="grid grid-cols-3 divide-x divide-gray-100 border-t border-gray-100 dark:divide-white/[0.06] dark:border-white/[0.06]">
                            <div className="px-4 py-3">
                                <p className="text-xs text-gray-500 dark:text-gray-400">Total Tickets</p>
                                <p className="text-2xl font-bold tabular-nums text-gray-900 dark:text-white">{customerData.totalTicketsCurrentMonth}</p>
                            </div>
                            <div className="px-4 py-3">
                                <p className="text-xs text-gray-500 dark:text-gray-400">Pending Balance</p>
                                <p className="text-2xl font-bold tabular-nums text-gray-900 dark:text-white">${customerData.pendingBalance.toFixed(2)}</p>
                            </div>
                            <div className="px-4 py-3">
                                <p className="text-xs text-gray-500 dark:text-gray-400">Transactions</p>
                                <p className="text-2xl font-bold tabular-nums text-gray-900 dark:text-white">{customerData.recentTickets.length}</p>
                            </div>
                        </div>
                    </section>

                    {/* Recent Tickets History */}
                    <section className={`${deskCard} border-gray-200/80 dark:border-white/[0.06]`}>
                        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-white/[0.06]">
                            <h3 className="flex items-center gap-2 text-[15px] font-semibold text-gray-900 dark:text-white">
                                <HistoryOutlined className="text-violet-600 dark:text-violet-300" />
                                Recent Ticket Earnings
                            </h3>
                            <Pill tone="violet">
                                {customerData.recentTickets.length} Transaction{customerData.recentTickets.length !== 1 ? 's' : ''}
                            </Pill>
                        </header>

                        <div className="p-4 sm:p-5">
                            {customerData.recentTickets.length === 0 ? (
                                <DeskEmpty
                                    compact
                                    icon={<TagOutlined />}
                                    title="No tickets earned yet"
                                    hint="This customer will earn tickets on their next purchase"
                                />
                            ) : (
                                <ul className="space-y-2">
                                    {customerData.recentTickets.map((ticket) => (
                                        <li
                                            key={ticket.ticketId}
                                            className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3 dark:border-white/[0.06] dark:bg-white/[0.02]"
                                        >
                                            <div className="flex min-w-0 items-center gap-3">
                                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
                                                    <TagOutlined />
                                                </span>
                                                <div className="min-w-0">
                                                    <p className="text-lg font-semibold tabular-nums text-gray-900 dark:text-white">
                                                        +{ticket.ticketsEarned} Ticket{ticket.ticketsEarned !== 1 ? 's' : ''}
                                                    </p>
                                                    <p className="text-sm tabular-nums text-gray-500 dark:text-gray-400">
                                                        Transaction #{ticket.transactionId}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="shrink-0 text-right">
                                                <p className="text-sm font-medium tabular-nums text-gray-700 dark:text-gray-300">
                                                    {new Date(ticket.earnedDate).toLocaleDateString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        year: 'numeric'
                                                    })}
                                                </p>
                                                <p className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
                                                    {new Date(ticket.earnedDate).toLocaleTimeString('en-US', {
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </p>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </section>

                    {/* Action Button */}
                    <div className="flex justify-center">
                        <button onClick={handleClearSearch} className={deskBtn('outline', 'lg')}>
                            <SearchOutlined />
                            Search Another Customer
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LoyaltyCheck;
