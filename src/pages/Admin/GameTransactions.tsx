import { useEffect, useState } from 'react';
import { getGameTransactions, GameTransaction } from '../../services/transactionService';
import { getStatusName, STATUS_ENABLED } from '../../services/statuses';

export default function GameTransactions() {
    const [items, setItems] = useState<GameTransaction[]>([]);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // Debounce search input (500ms)
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 500);
        return () => clearTimeout(timer);
    }, [search]);

    const toggleExpanded = (id: number) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    useEffect(() => {
        let cancelled = false;
        async function load() {
            setLoading(true);
            try {
                const res = await getGameTransactions({
                    Page: page,
                    PageSize: pageSize,
                    Search: debouncedSearch || undefined
                });
                if (!cancelled) {
                    setItems(res.data || []);
                    setTotal(res.totalCount || 0);
                }
            } catch (err) {
                console.error('Failed to load game transactions', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        load();
        return () => {
            cancelled = true;
        };
    }, [page, pageSize, debouncedSearch]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Game Transactions</h2>
                <div className="w-64">
                    <input
                        type="text"
                        placeholder="Search invoices..."
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(1); // Reset to first page on search
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>
            </div>

            <div className="bg-white shadow rounded-md overflow-hidden">
                <div className="space-y-4 p-4">
                    {loading ? (
                        <div className="px-4 py-6 text-center text-sm text-gray-500">Loading...</div>
                    ) : items.length === 0 ? (
                        <div className="px-4 py-6 text-center text-sm text-gray-500">No transactions found</div>
                    ) : (
                        items.map((t) => {
                            const isExpanded = expandedIds.has(t.transactionId);
                            return (
                                <div key={t.transactionId} className="border rounded-lg overflow-hidden">
                                    <div
                                        className="p-4 cursor-pointer hover:bg-gray-50 transition"
                                        onClick={() => toggleExpanded(t.transactionId)}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1 grid grid-cols-2 gap-4">
                                                <div>
                                                    <div className="text-xs text-gray-500">Transaction ID</div>
                                                    <div className="text-sm font-medium text-gray-900">#{t.transactionId}</div>
                                                </div>
                                                <div>
                                                    <div className="text-xs text-gray-500">Date</div>
                                                    <div className="text-sm text-gray-900">{new Date(t.createdOn).toLocaleString()}</div>
                                                </div>
                                                <div>
                                                    <div className="text-xs text-gray-500">Created By</div>
                                                    <div className="text-sm text-gray-900">{t.createdBy}</div>
                                                </div>
                                                <div>
                                                    <div className="text-xs text-gray-500">Total Paid</div>
                                                    <div className="text-sm font-semibold text-gray-900">${t.totalPrice.toFixed(2)}</div>
                                                </div>
                                                {t.gameName && (
                                                    <div>
                                                        <div className="text-xs text-gray-500">Game</div>
                                                        <div className="text-sm font-medium text-gray-900">{t.gameName}</div>
                                                    </div>
                                                )}
                                                {t.gameCategoryName && (
                                                    <div>
                                                        <div className="text-xs text-gray-500">Game Category</div>
                                                        <div className="text-sm text-gray-900">{t.gameCategoryName}</div>
                                                    </div>
                                                )}
                                                {t.gameTypeName && (
                                                    <div>
                                                        <div className="text-xs text-gray-500">Game Type</div>
                                                        <div className="text-sm text-gray-900">{t.gameTypeName}</div>
                                                    </div>
                                                )}
                                                {t.gameSettingName && (
                                                    <div>
                                                        <div className="text-xs text-gray-500">Game Setting</div>
                                                        <div className="text-sm text-gray-900">{t.gameSettingName}</div>
                                                    </div>
                                                )}
                                                {t.roomName && (
                                                    <div>
                                                        <div className="text-xs text-gray-500">Room</div>
                                                        <div className="text-sm text-gray-900">{t.roomName}</div>
                                                    </div>
                                                )}
                                                {t.setName && (
                                                    <div>
                                                        <div className="text-xs text-gray-500">Set</div>
                                                        <div className="text-sm text-gray-900">{t.setName}</div>
                                                    </div>
                                                )}
                                                {t.hours > 0 && (
                                                    <div>
                                                        <div className="text-xs text-gray-500">Hours</div>
                                                        <div className="text-sm text-gray-900">{t.hours}</div>
                                                    </div>
                                                )}
                                                <div>
                                                    <div className="text-xs text-gray-500">Status</div>
                                                    <span
                                                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${t.statusId === STATUS_ENABLED ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                            }`}
                                                    >
                                                        {getStatusName(t.statusId) || t.statusId}
                                                    </span>
                                                </div>
                                                <div>
                                                    <div className="text-xs text-gray-500">Items Count</div>
                                                    <div className="text-sm text-gray-900">{t.items.length} item(s)</div>
                                                </div>
                                            </div>
                                            <div className="ml-4 flex-shrink-0">
                                                <svg
                                                    className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </div>
                                        </div>
                                    </div>

                                    {isExpanded && t.items.length > 0 && (
                                        <div className="border-t bg-gray-50 p-4">
                                            <div className="text-xs font-medium text-gray-700 mb-3">Items Detail</div>
                                            <div className="space-y-2">
                                                {t.items.map((item, idx) => (
                                                    <div key={idx} className="flex items-center justify-between bg-white p-3 rounded border">
                                                        <div className="flex items-center gap-3">
                                                            {item.imagePath && (
                                                                <img
                                                                    src={`${import.meta.env.VITE_API_IMAGE_BASE_URL || ''}/${item.imagePath}`}
                                                                    alt={item.itemName}
                                                                    className="w-10 h-10 object-cover rounded"
                                                                    onError={(e) => {
                                                                        e.currentTarget.src = '/images/image-placeholder.svg';
                                                                    }}
                                                                />
                                                            )}
                                                            <div>
                                                                <div className="text-sm font-medium text-gray-900">{item.itemName}</div>
                                                                <div className="text-xs text-gray-500">
                                                                    <span className="font-medium">Category:</span> {item.categoryName}
                                                                </div>
                                                                <div className="text-xs text-gray-500">
                                                                    <span className="font-medium">Unit Price:</span> ${item.unitPrice.toFixed(2)} × {item.quantity}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div className="text-xs text-gray-500">Line Total</div>
                                                            <div className="text-sm font-semibold text-gray-900">${item.lineTotal.toFixed(2)}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-gray-600">Showing page {page} of {totalPages} — {total} items</div>
                <div className="space-x-2">
                    <button
                        className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                        Prev
                    </button>
                    <button
                        className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
                        disabled={page >= totalPages}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                        Next
                    </button>
                </div>
            </div>
        </div>
    );
}
