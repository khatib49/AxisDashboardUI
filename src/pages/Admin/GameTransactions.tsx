import { useEffect, useState } from 'react';
import {
  getGameTransactions, GameTransaction,
  updateTransaction, deleteTransaction, TransactionUpdateDto,
  replaceTransactionItems,
} from '../../services/transactionService';
import { getStatusName, STATUS_ENABLED } from '../../services/statuses';
import { getItems, ItemDto } from '../../services/itemService';

export default function GameTransactions() {
    const [items, setItems] = useState<GameTransaction[]>([]);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // Edit modal state — only the scalar fields TransactionUpdateDto accepts
    // are exposed; changing items is done from the cashier open-invoice flow,
    // not here.
    const [editing, setEditing] = useState<GameTransaction | null>(null);
    const [editDraft, setEditDraft] = useState<TransactionUpdateDto>({});
    const [saving, setSaving] = useState(false);

    // Delete confirmation state
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Items-editor state (CR#1: admin can edit items on ANY transaction,
    // open or closed). Draft maps itemId -> { name, price, quantity }.
    const [itemsEditing, setItemsEditing] = useState<GameTransaction | null>(null);
    const [itemsDraft, setItemsDraft] = useState<Array<{ itemId: number; name: string; price: number; quantity: number }>>([]);
    const [itemsSaving, setItemsSaving] = useState(false);
    const [pickerItems, setPickerItems] = useState<ItemDto[]>([]);
    const [pickerSearch, setPickerSearch] = useState('');
    const [pickerLoading, setPickerLoading] = useState(false);

    const openItemsEditor = (t: GameTransaction) => {
        setItemsEditing(t);
        setItemsDraft(
            (t.items ?? []).map((it) => ({
                itemId: it.itemId,
                name: it.itemName,
                price: it.unitPrice,
                quantity: it.quantity,
            })),
        );
        setPickerSearch('');
        setPickerItems([]);
        setError(null);
    };

    // Debounced picker search against the items API.
    useEffect(() => {
        if (itemsEditing === null) return;
        const q = pickerSearch.trim();
        if (q.length < 2) { setPickerItems([]); return; }
        let alive = true;
        setPickerLoading(true);
        const timer = setTimeout(() => {
            getItems(1, 10, null, q)
                .then((r) => { if (alive) setPickerItems(r.data ?? []); })
                .catch(() => { if (alive) setPickerItems([]); })
                .finally(() => { if (alive) setPickerLoading(false); });
        }, 350);
        return () => { alive = false; clearTimeout(timer); };
    }, [pickerSearch, itemsEditing]);

    const saveItems = async () => {
        if (!itemsEditing?.transactionId) return;
        setItemsSaving(true); setError(null);
        try {
            await replaceTransactionItems(
                itemsEditing.transactionId,
                itemsDraft.filter(d => d.quantity > 0).map(d => ({ itemId: d.itemId, quantity: d.quantity })),
            );
            setItemsEditing(null);
            const res = await getGameTransactions({
                Page: page, PageSize: pageSize, Search: debouncedSearch || undefined,
            });
            setItems(res.data || []);
        } catch (e: any) {
            const d = e?.response?.data;
            setError(d?.message ?? d?.error ?? e?.message ?? 'Save failed');
        } finally { setItemsSaving(false); }
    };

    const openEdit = (t: GameTransaction) => {
        setEditing(t);
        setEditDraft({
            hours: t.hours ?? null,
            totalPrice: t.totalPrice ?? null,
            statusId: t.statusId ?? null,
        });
        setError(null);
    };

    const saveEdit = async () => {
        if (!editing?.transactionId) return;
        setSaving(true); setError(null);
        try {
            await updateTransaction(editing.transactionId, editDraft);
            setEditing(null);
            // Refresh list
            setPage(p => p);
            const res = await getGameTransactions({
                Page: page, PageSize: pageSize,
                Search: debouncedSearch || undefined,
            });
            setItems(res.data || []);
        } catch (e: any) {
            setError(e?.response?.data?.message ?? e?.message ?? 'Save failed');
        } finally { setSaving(false); }
    };

    const confirmDelete = async () => {
        if (!deletingId) return;
        setDeleting(true); setError(null);
        try {
            await deleteTransaction(deletingId);
            setDeletingId(null);
            const res = await getGameTransactions({
                Page: page, PageSize: pageSize,
                Search: debouncedSearch || undefined,
            });
            setItems(res.data || []);
            setTotal(res.totalCount || 0);
        } catch (e: any) {
            setError(e?.response?.data?.message ?? e?.message ?? 'Delete failed');
        } finally { setDeleting(false); }
    };

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
                                                    const isExpanded = typeof t.transactionId === 'number' ? expandedIds.has(t.transactionId) : false;
                                                    return (
                                                        <div key={t.transactionId} className="border rounded-lg overflow-hidden">
                                    <div
                                        className="p-4 cursor-pointer hover:bg-gray-50 transition"
                                        onClick={() => {
                                            if (typeof t.transactionId === 'number') {
                                                toggleExpanded(t.transactionId);
                                            }
                                        }}
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
                                                    <div className="text-sm text-gray-900">{t.items ? t.items.length : 0} item(s)</div>
                                                </div>
                                            </div>
                                            <div className="ml-4 flex-shrink-0 flex items-center gap-2">
                                                {/* Edit / Delete — stopPropagation so they don't toggle expand */}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); openEdit(t); }}
                                                    className="px-2.5 py-1 text-xs bg-blue-50 text-blue-700 rounded border border-blue-200 hover:bg-blue-100"
                                                    title="Edit"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); openItemsEditor(t); }}
                                                    className="px-2.5 py-1 text-xs bg-purple-50 text-purple-700 rounded border border-purple-200 hover:bg-purple-100"
                                                    title="Edit items (works on open AND closed)"
                                                >
                                                    Items
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (typeof t.transactionId === 'number') setDeletingId(t.transactionId);
                                                    }}
                                                    className="px-2.5 py-1 text-xs bg-red-50 text-red-700 rounded border border-red-200 hover:bg-red-100"
                                                    title="Delete"
                                                >
                                                    Delete
                                                </button>
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

                                    {isExpanded && t.items && t.items.length > 0 && (
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

            {/* ── Edit modal ──────────────────────────────────────────── */}
            {editing && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => !saving && setEditing(null)}>
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
                        <div className="px-5 py-3 border-b border-gray-200">
                            <h3 className="font-semibold text-gray-800">Edit Transaction #{editing.transactionId}</h3>
                            <p className="text-xs text-gray-500">Changing items must be done from the cashier flow.</p>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Hours</label>
                                <input
                                    type="number"
                                    step="0.5"
                                    min="0"
                                    value={editDraft.hours ?? ''}
                                    onChange={(e) => setEditDraft(d => ({ ...d, hours: e.target.value === '' ? null : Number(e.target.value) }))}
                                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Total Price ($)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={editDraft.totalPrice ?? ''}
                                    onChange={(e) => setEditDraft(d => ({ ...d, totalPrice: e.target.value === '' ? null : Number(e.target.value) }))}
                                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Status ID</label>
                                <input
                                    type="number"
                                    value={editDraft.statusId ?? ''}
                                    onChange={(e) => setEditDraft(d => ({ ...d, statusId: e.target.value === '' ? null : Number(e.target.value) }))}
                                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            {error && (
                                <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">{error}</div>
                            )}
                        </div>
                        <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
                            <button
                                disabled={saving}
                                onClick={() => setEditing(null)}
                                className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded"
                            >Cancel</button>
                            <button
                                disabled={saving}
                                onClick={saveEdit}
                                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                            >{saving ? 'Saving…' : 'Save'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Items editor (admin, any status) ────────────────────── */}
            {itemsEditing && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => !itemsSaving && setItemsEditing(null)}>
                    <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                        <div className="px-5 py-3 border-b border-gray-200">
                            <h3 className="font-semibold text-gray-800">Edit Items — Transaction #{itemsEditing.transactionId}</h3>
                            <p className="text-xs text-gray-500">
                                Works on open and closed transactions. Stock and totals adjust automatically; every change is audited.
                            </p>
                        </div>

                        <div className="p-5 space-y-4 overflow-y-auto">
                            {/* Current lines */}
                            {itemsDraft.length === 0 ? (
                                <div className="text-sm text-gray-400 text-center py-4">No items on this transaction.</div>
                            ) : (
                                <div className="space-y-2">
                                    {itemsDraft.map((d, i) => (
                                        <div key={d.itemId} className="flex items-center gap-2 border border-gray-200 rounded px-3 py-2">
                                            <div className="flex-1">
                                                <div className="text-sm font-medium text-gray-800">{d.name}</div>
                                                <div className="text-xs text-gray-500">${d.price.toFixed(2)} each</div>
                                            </div>
                                            <input
                                                type="number"
                                                min={0}
                                                value={d.quantity}
                                                onChange={(e) => {
                                                    const v = Math.max(0, Number(e.target.value || 0));
                                                    setItemsDraft(arr => arr.map((x, xi) => xi === i ? { ...x, quantity: v } : x));
                                                }}
                                                className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-right"
                                            />
                                            <button
                                                onClick={() => setItemsDraft(arr => arr.filter((_, xi) => xi !== i))}
                                                className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded border border-red-200 hover:bg-red-100"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Add-item picker */}
                            <div className="border-t border-gray-100 pt-3">
                                <div className="text-xs font-semibold text-gray-600 mb-1">Add item</div>
                                <input
                                    type="text"
                                    placeholder="Search items (2+ chars)…"
                                    value={pickerSearch}
                                    onChange={(e) => setPickerSearch(e.target.value)}
                                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                                />
                                {pickerLoading && <div className="text-xs text-gray-400 mt-1">Searching…</div>}
                                {pickerItems.length > 0 && (
                                    <div className="mt-1 border border-gray-200 rounded max-h-40 overflow-auto">
                                        {pickerItems.map((it) => {
                                            const already = itemsDraft.some(d => d.itemId === Number(it.id));
                                            return (
                                                <button
                                                    key={it.id}
                                                    disabled={already}
                                                    onClick={() => {
                                                        setItemsDraft(arr => [...arr, {
                                                            itemId: Number(it.id), name: it.name,
                                                            price: it.price, quantity: 1,
                                                        }]);
                                                        setPickerSearch('');
                                                        setPickerItems([]);
                                                    }}
                                                    className="w-full text-left px-3 py-2 text-sm hover:bg-purple-50 disabled:opacity-40 disabled:cursor-not-allowed border-b border-gray-100 last:border-0"
                                                >
                                                    {it.name} <span className="text-xs text-gray-500">— ${it.price}</span>
                                                    {already && <span className="text-xs text-gray-400"> (already added)</span>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Live delta preview */}
                            <div className="text-xs text-gray-500">
                                New items subtotal:&nbsp;
                                <b>${itemsDraft.reduce((s, d) => s + d.price * d.quantity, 0).toFixed(2)}</b>
                                &nbsp;·&nbsp;Session/time charges stay untouched; discount still applies.
                            </div>

                            {error && (
                                <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">{error}</div>
                            )}
                        </div>

                        <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
                            <button
                                disabled={itemsSaving}
                                onClick={() => setItemsEditing(null)}
                                className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded"
                            >Cancel</button>
                            <button
                                disabled={itemsSaving}
                                onClick={saveItems}
                                className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                            >{itemsSaving ? 'Saving…' : 'Save items'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Delete confirmation ─────────────────────────────────── */}
            {deletingId != null && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => !deleting && setDeletingId(null)}>
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
                        <div className="px-5 py-3 border-b border-gray-200">
                            <h3 className="font-semibold text-gray-800">Delete transaction #{deletingId}?</h3>
                        </div>
                        <div className="p-5 text-sm text-gray-700 space-y-2">
                            <p>This will reverse the transaction and restore any stock consumed by it. This action is logged permanently in the audit log.</p>
                            <p className="text-xs text-gray-500">Any associated F&amp;B ingredient consumption will be reversed automatically.</p>
                            {error && (
                                <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">{error}</div>
                            )}
                        </div>
                        <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
                            <button
                                disabled={deleting}
                                onClick={() => setDeletingId(null)}
                                className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded"
                            >Cancel</button>
                            <button
                                disabled={deleting}
                                onClick={confirmDelete}
                                className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                            >{deleting ? 'Deleting…' : 'Delete'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
