import React, { useEffect, useState, useCallback } from "react";
import {
    getItemTransactions, getGameTransactions,
    ItemTransaction, GameTransaction,
    updateTransaction, deleteTransaction, TransactionUpdateDto
} from '../../services/transactionService';
import { getStatusName, STATUS_PROCESSED_PAID } from '../../services/statuses';
import Loader from '../../components/ui/Loader';
import Modal from '../../components/ui/Modal';
import Label from '../../components/form/Label';
import Input from '../../components/form/input/InputField';
import Select from '../../components/form/Select';

// ── NEW: status constant for open invoices ────────────────────
const STATUS_OPEN_INVOICE = 7;

const Orders: React.FC = () => {
    const [itemOrders, setItemOrders] = useState<ItemTransaction[]>([]);
    const [gameOrders, setGameOrders] = useState<GameTransaction[]>([]);
    const [loadingItems, setLoadingItems] = useState(false);
    const [loadingGames, setLoadingGames] = useState(false);
    const [itemPage, setItemPage] = useState(1);
    const [gamePage, setGamePage] = useState(1);
    const [pageSize] = useState(10);
    const [itemTotal, setItemTotal] = useState(0);
    const [itemTotalRevenue, setItemTotalRevenue] = useState(0); // NEW
    const [gameTotal, setGameTotal] = useState(0);
    const [itemSearch, setItemSearch] = useState('');
    const [debouncedItemSearch, setDebouncedItemSearch] = useState('');
    const [gameSearch, setGameSearch] = useState('');
    const [debouncedGameSearch, setDebouncedGameSearch] = useState('');

    // NEW: expanded row state
    const [expandedRow, setExpandedRow] = useState<number | null>(null);

    // NEW: remove item state
    const [removingItem, setRemovingItem] = useState<string | null>(null); // "txId-itemId"

    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<ItemTransaction | GameTransaction | null>(null);
    const [editData, setEditData] = useState<TransactionUpdateDto>({});
    const [saving, setSaving] = useState(false);

    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deletingTransaction, setDeletingTransaction] = useState<number | null>(null);
    const [deleting, setDeleting] = useState(false);

    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedItemSearch(itemSearch), 500);
        return () => clearTimeout(timer);
    }, [itemSearch]);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedGameSearch(gameSearch), 500);
        return () => clearTimeout(timer);
    }, [gameSearch]);

    const loadItemTransactions = useCallback(() => {
        setLoadingItems(true);
        getItemTransactions({
            Page: itemPage,
            PageSize: pageSize,
            Search: debouncedItemSearch || undefined
        })
            .then((res) => {
                setItemOrders(res.data || []);
                setItemTotal(res.totalCount);
                setItemTotalRevenue(res.totalInvoices ?? 0); // NEW
            })
            .catch(() => { })
            .finally(() => setLoadingItems(false));
    }, [itemPage, pageSize, debouncedItemSearch]);

    useEffect(() => { loadItemTransactions(); }, [loadItemTransactions]);

    const loadGameTransactions = useCallback(() => {
        setLoadingGames(true);
        getGameTransactions({
            Page: gamePage,
            PageSize: pageSize,
            Search: debouncedGameSearch || undefined
        })
            .then((res) => {
                setGameOrders(res.data || []);
                setGameTotal(res.totalCount);
            })
            .catch(() => { })
            .finally(() => setLoadingGames(false));
    }, [gamePage, pageSize, debouncedGameSearch]);

    useEffect(() => { loadGameTransactions(); }, [loadGameTransactions]);

    const handleEdit = (transaction: ItemTransaction | GameTransaction) => {
        setEditingTransaction(transaction);
        setEditData({ statusId: transaction.statusId, totalPrice: transaction.totalPrice });
        setMessage(null);
        setEditModalOpen(true);
    };

    const handleSaveEdit = async () => {
        if (!editingTransaction) return;
        setSaving(true);
        setMessage(null);
        try {
            await updateTransaction(editingTransaction.transactionId!, editData);
            setMessage({ text: 'Transaction updated successfully', type: 'success' });
            setEditModalOpen(false);
            setEditingTransaction(null);
            loadItemTransactions();
            loadGameTransactions();
        } catch (err: unknown) {
            setMessage({ text: err instanceof Error ? err.message : 'Failed to update', type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteClick = (transactionId: number) => {
        setDeletingTransaction(transactionId);
        setDeleteModalOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!deletingTransaction) return;
        setDeleting(true);
        setMessage(null);
        try {
            await deleteTransaction(deletingTransaction);
            setMessage({ text: 'Transaction deleted successfully', type: 'success' });
            setDeleteModalOpen(false);
            setDeletingTransaction(null);
            loadItemTransactions();
            loadGameTransactions();
        } catch (err: unknown) {
            setMessage({ text: err instanceof Error ? err.message : 'Failed to delete', type: 'error' });
        } finally {
            setDeleting(false);
        }
    };

    // NEW: remove a single item from an open invoice
    const handleRemoveItem = async (order: ItemTransaction, itemId: number) => {
        const key = `${order.transactionId}-${itemId}`;
        setRemovingItem(key);
        try {
            const updatedItems = (order.items || [])
                .filter(i => i.itemId !== itemId)
                .map(i => ({ itemId: i.itemId, quantity: i.quantity }));
            await updateTransaction(order.transactionId!, { items: updatedItems } as TransactionUpdateDto);
            setMessage({ text: 'Item removed successfully', type: 'success' });
            loadItemTransactions();
        } catch {
            setMessage({ text: 'Failed to remove item', type: 'error' });
        } finally {
            setRemovingItem(null);
        }
    };

    const totalItemPages = Math.max(1, Math.ceil(itemTotal / pageSize));
    const totalGamePages = Math.max(1, Math.ceil(gameTotal / pageSize));

    // ── Status badge helper ───────────────────────────────────────────────────
    const StatusBadge = ({ statusId }: { statusId: number }) => {
        if (statusId === STATUS_PROCESSED_PAID)
            return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">✓ Processed & Paid</span>;
        if (statusId === STATUS_OPEN_INVOICE)
            return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">● Open Invoice</span>;
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">{getStatusName(statusId) ?? statusId}</span>;
    };

    return (
        <div className="p-6 space-y-10">
            {/* ── Page Header ─────────────────────────────────────────── */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Orders Management</h1>
                <p className="text-sm text-gray-500 mt-1">Coffee shop, FNB, and game session orders</p>
            </div>

            {/* ── Global message banner ────────────────────────────────── */}
            {message && (
                <div className={`px-4 py-3 rounded-lg text-sm font-medium border ${
                    message.type === 'success'
                        ? 'bg-green-50 text-green-800 border-green-200'
                        : 'bg-red-50 text-red-800 border-red-200'
                }`}>
                    {message.text}
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                COFFEE SHOP ORDERS
            ══════════════════════════════════════════════════════════ */}
            <section>
                {/* Section header */}
                <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-800">Coffee Shop Orders</h2>
                        <p className="text-xs text-gray-400 mt-0.5">Includes open invoices and completed orders</p>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                        {/* Stats pills */}
                        <div className="flex gap-2">
                            <span className="px-3 py-1.5 bg-slate-100 rounded-lg text-xs font-medium text-slate-600">
                                {itemTotal} orders
                            </span>
                            <span className="px-3 py-1.5 bg-indigo-50 rounded-lg text-xs font-medium text-indigo-700">
                                ${itemTotalRevenue.toFixed(2)} revenue
                            </span>
                        </div>
                        {/* Search */}
                        <div className="relative">
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                placeholder="Search orders..."
                                value={itemSearch}
                                onChange={(e) => { setItemSearch(e.target.value); setItemPage(1); }}
                                className="pl-9 pr-3 py-2 w-56 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                            />
                        </div>
                    </div>
                </div>

                {/* Loading */}
                {loadingItems && <div className="flex justify-center py-16"><Loader /></div>}

                {/* Empty */}
                {!loadingItems && itemOrders.length === 0 && (
                    <div className="text-center py-16 text-gray-400 text-sm">No orders found.</div>
                )}

                {/* Table */}
                {!loadingItems && itemOrders.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        {/* Table header */}
                        <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            <div className="col-span-1">Invoice</div>
                            <div className="col-span-2">Date / Time</div>
                            <div className="col-span-2">Cashier</div>
                            <div className="col-span-3">Items</div>
                            <div className="col-span-1">Total</div>
                            <div className="col-span-2">Status</div>
                            <div className="col-span-1">Actions</div>
                        </div>

                        {/* Rows */}
                        {itemOrders.map((o, idx) => {
                            const isOpen = o.statusId === STATUS_OPEN_INVOICE;
                            const isExpanded = expandedRow === o.transactionId;
                            return (
                                <React.Fragment key={`${o.transactionId}-${idx}`}>
                                    {/* Main row */}
                                    <div
                                        className={`grid grid-cols-12 gap-2 px-4 py-3.5 items-center cursor-pointer border-b border-gray-100 transition-colors
                                            ${isOpen ? 'bg-amber-50 hover:bg-amber-100' : 'bg-white hover:bg-gray-50'}
                                            ${isExpanded ? 'border-l-4 border-l-indigo-400' : ''}`}
                                        onClick={() => setExpandedRow(isExpanded ? null : (o.transactionId ?? null))}
                                    >
                                        {/* Invoice # */}
                                        <div className="col-span-1">
                                            <span className="font-bold text-gray-900 text-sm">#{o.transactionId}</span>
                                            {isOpen && (
                                                <div className="text-[10px] text-amber-600 font-medium mt-0.5">OPEN</div>
                                            )}
                                        </div>

                                        {/* Date/Time */}
                                        <div className="col-span-2">
                                            <div className="text-sm font-medium text-gray-800">
                                                {new Date(o.createdOn).toLocaleDateString('en-GB')}
                                            </div>
                                            <div className="text-xs text-gray-400">
                                                {new Date(o.createdOn).toLocaleTimeString()}
                                            </div>
                                        </div>

                                        {/* Cashier */}
                                        <div className="col-span-2">
                                            <div className="text-sm font-medium text-gray-800 truncate">
                                                {o.createdBy?.split('@')[0] ?? '—'}
                                            </div>
                                            <div className="text-xs text-gray-400 truncate">{o.createdBy}</div>
                                        </div>

                                        {/* Items preview */}
                                        <div className="col-span-3">
                                            {o.items && o.items.length > 0 ? (
                                                <div className="flex flex-wrap gap-1">
                                                    {o.items.slice(0, 2).map((item, ii) => (
                                                        <span key={ii} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded-md text-xs text-gray-700">
                                                            <span className="font-medium">{item.itemName}</span>
                                                            <span className="text-indigo-500 font-semibold">×{item.quantity}</span>
                                                            {item.categoryName && (
                                                                <span className="text-gray-400">({item.categoryName})</span>
                                                            )}
                                                        </span>
                                                    ))}
                                                    {o.items.length > 2 && (
                                                        <span className="text-xs text-gray-400 self-center">+{o.items.length - 2} more</span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-gray-400 text-xs">No items</span>
                                            )}
                                        </div>

                                        {/* Total */}
                                        <div className="col-span-1">
                                            <span className="text-sm font-bold text-gray-900">${o.totalPrice.toFixed(2)}</span>
                                        </div>

                                        {/* Status */}
                                        <div className="col-span-2">
                                            <StatusBadge statusId={o.statusId} />
                                        </div>

                                        {/* Actions */}
                                        <div className="col-span-1" onClick={e => e.stopPropagation()}>
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    className="p-1.5 rounded-md text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                                    title={isExpanded ? 'Collapse' : 'Expand items'}
                                                    onClick={() => setExpandedRow(isExpanded ? null : (o.transactionId ?? null))}
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isExpanded ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
                                                    </svg>
                                                </button>
                                                <button
                                                    className="p-1.5 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                                    title="Edit"
                                                    onClick={() => handleEdit(o)}
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                                    title="Delete"
                                                    onClick={() => o.transactionId !== undefined && handleDeleteClick(o.transactionId)}
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* ── Expanded item detail row ── */}
                                    {isExpanded && (
                                        <div className={`px-6 py-4 border-b border-gray-100 ${isOpen ? 'bg-amber-50/60' : 'bg-gray-50/60'}`}>
                                            {isOpen && (
                                                <div className="flex items-center gap-2 mb-3 text-xs font-medium text-amber-700 bg-amber-100 px-3 py-1.5 rounded-lg w-fit">
                                                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                    </svg>
                                                    Open Invoice — you can remove individual items below
                                                </div>
                                            )}
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="text-xs text-gray-400 uppercase tracking-wide">
                                                        <th className="text-left pb-2 font-semibold">Item</th>
                                                        <th className="text-left pb-2 font-semibold">Category</th>
                                                        <th className="text-center pb-2 font-semibold">Qty</th>
                                                        <th className="text-right pb-2 font-semibold">Unit Price</th>
                                                        <th className="text-right pb-2 font-semibold">Line Total</th>
                                                        {isOpen && <th className="text-right pb-2 font-semibold">Remove</th>}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {(o.items || []).map((item, ii) => {
                                                        const rmKey = `${o.transactionId}-${item.itemId}`;
                                                        const isRemoving = removingItem === rmKey;
                                                        return (
                                                            <tr key={ii} className="hover:bg-white/60 transition-colors">
                                                                <td className="py-2 pr-4">
                                                                    <div className="flex items-center gap-2">
                                                                        {item.imagePath && (
                                                                            <img src={item.imagePath} alt="" className="w-8 h-8 rounded-md object-cover" />
                                                                        )}
                                                                        <span className="font-medium text-gray-800">{item.itemName}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="py-2 pr-4">
                                                                    <span className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">
                                                                        {item.categoryName ?? '—'}
                                                                    </span>
                                                                </td>
                                                                <td className="py-2 text-center">
                                                                    <span className="font-semibold text-indigo-600">×{item.quantity}</span>
                                                                </td>
                                                                <td className="py-2 text-right text-gray-600">
                                                                    ${item.unitPrice?.toFixed(2) ?? '—'}
                                                                </td>
                                                                <td className="py-2 text-right font-semibold text-gray-800">
                                                                    ${item.lineTotal?.toFixed(2) ?? '—'}
                                                                </td>
                                                                {isOpen && (
                                                                    <td className="py-2 text-right">
                                                                        <button
                                                                            disabled={isRemoving}
                                                                            onClick={() => handleRemoveItem(o, item.itemId)}
                                                                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                                        >
                                                                            {isRemoving ? (
                                                                                <span>Removing…</span>
                                                                            ) : (
                                                                                <>
                                                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                                                    </svg>
                                                                                    Remove
                                                                                </>
                                                                            )}
                                                                        </button>
                                                                    </td>
                                                                )}
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </div>
                )}

                {/* Pagination */}
                {!loadingItems && itemTotal > pageSize && (
                    <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
                        <span>Page {itemPage} of {totalItemPages} — {itemTotal} orders</span>
                        <div className="flex gap-1.5">
                            <button
                                className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium"
                                disabled={itemPage <= 1}
                                onClick={() => setItemPage(1)}
                            >«</button>
                            <button
                                className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium"
                                disabled={itemPage <= 1}
                                onClick={() => setItemPage(p => p - 1)}
                            >Prev</button>
                            <button
                                className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium"
                                disabled={itemPage >= totalItemPages}
                                onClick={() => setItemPage(p => p + 1)}
                            >Next</button>
                            <button
                                className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium"
                                disabled={itemPage >= totalItemPages}
                                onClick={() => setItemPage(totalItemPages)}
                            >»</button>
                        </div>
                    </div>
                )}
            </section>

            {/* ══════════════════════════════════════════════════════════
                GAME SESSION ORDERS  — unchanged logic, enhanced design
            ══════════════════════════════════════════════════════════ */}
            <section>
                <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-800">Game Session Orders</h2>
                        <p className="text-xs text-gray-400 mt-0.5">{gameTotal} sessions</p>
                    </div>
                    <div className="relative">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Search sessions..."
                            value={gameSearch}
                            onChange={(e) => { setGameSearch(e.target.value); setGamePage(1); }}
                            className="pl-9 pr-3 py-2 w-56 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                    </div>
                </div>

                {loadingGames && <div className="flex justify-center py-16"><Loader /></div>}
                {!loadingGames && gameOrders.length === 0 && (
                    <div className="text-center py-16 text-gray-400 text-sm">No game session orders found.</div>
                )}

                {!loadingGames && gameOrders.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            <div className="col-span-1">Invoice</div>
                            <div className="col-span-2">Date / Time</div>
                            <div className="col-span-2">Cashier</div>
                            <div className="col-span-2">Room / Game</div>
                            <div className="col-span-1">Setting</div>
                            <div className="col-span-1">Hours</div>
                            <div className="col-span-1">Total</div>
                            <div className="col-span-1">Status</div>
                            <div className="col-span-1">Actions</div>
                        </div>

                        {gameOrders.map((o, idx) => (
                            <div key={`${o.transactionId}-${idx}`} className="grid grid-cols-12 gap-2 px-4 py-3.5 items-center border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                <div className="col-span-1">
                                    <span className="font-bold text-gray-900 text-sm">#{o.transactionId}</span>
                                </div>
                                <div className="col-span-2">
                                    <div className="text-sm font-medium text-gray-800">{new Date(o.createdOn).toLocaleDateString('en-GB')}</div>
                                    <div className="text-xs text-gray-400">{new Date(o.createdOn).toLocaleTimeString()}</div>
                                </div>
                                <div className="col-span-2">
                                    <div className="text-sm font-medium text-gray-800 truncate">{o.createdBy?.split('@')[0]}</div>
                                    {o.setName && <div className="text-xs text-gray-400">Set: {o.setName}</div>}
                                </div>
                                <div className="col-span-2">
                                    <div className="text-sm font-medium text-gray-800">{o.roomName || '—'}</div>
                                    <div className="text-xs text-gray-400">{o.gameName || '—'}</div>
                                </div>
                                <div className="col-span-1 text-sm text-gray-600">
                                    <div>{o.gameSettingName || '—'}</div>
                                    {o.gameCategoryName && <div className="text-xs text-gray-400">{o.gameCategoryName}</div>}
                                </div>
                                <div className="col-span-1 text-sm text-gray-600">
                                    {o.hours === 0 ? <span className="text-xs text-amber-600 font-medium">Open</span> : `${o.hours}h`}
                                </div>
                                <div className="col-span-1">
                                    <span className="text-sm font-bold text-gray-900">${o.totalPrice.toFixed(2)}</span>
                                </div>
                                <div className="col-span-1">
                                    <StatusBadge statusId={o.statusId} />
                                </div>
                                <div className="col-span-1">
                                    <div className="flex items-center gap-1">
                                        <button className="p-1.5 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Edit" onClick={() => handleEdit(o)}>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                        </button>
                                        <button className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete" onClick={() => { if (typeof o.transactionId === 'number') handleDeleteClick(o.transactionId); }}>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {!loadingGames && gameTotal > pageSize && (
                    <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
                        <span>Page {gamePage} of {totalGamePages} — {gameTotal} sessions</span>
                        <div className="flex gap-1.5">
                            <button className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 text-xs font-medium" disabled={gamePage <= 1} onClick={() => setGamePage(1)}>«</button>
                            <button className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 text-xs font-medium" disabled={gamePage <= 1} onClick={() => setGamePage(p => p - 1)}>Prev</button>
                            <button className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 text-xs font-medium" disabled={gamePage >= totalGamePages} onClick={() => setGamePage(p => p + 1)}>Next</button>
                            <button className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 text-xs font-medium" disabled={gamePage >= totalGamePages} onClick={() => setGamePage(totalGamePages)}>»</button>
                        </div>
                    </div>
                )}
            </section>

            {/* ── Edit Modal (unchanged) ─────────────────────────────── */}
            <Modal isOpen={editModalOpen} onClose={() => { setEditModalOpen(false); setEditingTransaction(null); setMessage(null); }} title="Edit Transaction"
                footer={(<>
                    <button className="bg-gray-200 text-gray-800 px-3 py-1 rounded" onClick={() => { setEditModalOpen(false); setEditingTransaction(null); setMessage(null); }} disabled={saving}>Cancel</button>
                    <button className="bg-blue-600 text-white px-3 py-1 rounded" onClick={handleSaveEdit} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                </>)}
            >
                <div className="space-y-4">
                    <div>
                        <Label>Status</Label>
                        <Select options={[{ value: 1, label: 'Pending' }, { value: STATUS_PROCESSED_PAID, label: 'Processed/Paid' }, { value: 2, label: 'Cancelled' }]} defaultValue={editData.statusId ?? 1} onChange={(v: string | number) => setEditData({ ...editData, statusId: Number(v) })} />
                    </div>
                    <div>
                        <Label htmlFor="totalPrice">Total Price</Label>
                        <Input id="totalPrice" type="number" value={editData.totalPrice ?? ''} onChange={(e) => setEditData({ ...editData, totalPrice: parseFloat(e.target.value) })} />
                    </div>
                </div>
            </Modal>

            {/* ── Delete Modal (unchanged) ───────────────────────────── */}
            <Modal isOpen={deleteModalOpen} onClose={() => { setDeleteModalOpen(false); setDeletingTransaction(null); }} title="Confirm Delete"
                footer={(<>
                    <button className="bg-gray-200 text-gray-800 px-3 py-1 rounded" onClick={() => { setDeleteModalOpen(false); setDeletingTransaction(null); }} disabled={deleting}>Cancel</button>
                    <button className="bg-red-600 text-white px-3 py-1 rounded flex items-center gap-2" onClick={handleDeleteConfirm} disabled={deleting}>{deleting ? <Loader size={16} /> : 'Delete'}</button>
                </>)}
            >
                <p>Are you sure you want to delete this transaction? This action cannot be undone.</p>
            </Modal>
        </div>
    );
};

export default Orders;