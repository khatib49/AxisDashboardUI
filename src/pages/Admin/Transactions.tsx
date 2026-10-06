import React, { useEffect, useState } from 'react';
import { Button, Empty, Input as AntInput, Skeleton, Tooltip } from 'antd';
import {
    DeleteOutlined, DownOutlined, EditOutlined, FileTextOutlined, ReloadOutlined,
    SearchOutlined, ShoppingCartOutlined, UnorderedListOutlined, UpOutlined, WarningFilled,
} from '@ant-design/icons';
import {
    getItemTransactions, ItemTransaction,
    updateTransaction, deleteTransaction, TransactionUpdateDto,
    replaceTransactionItems,
} from '../../services/transactionService';
import { STATUS_PROCESSED_UNPAID } from '../../services/statuses';
import { getItems, ItemDto } from '../../services/itemService';
import { PageHeader, Panel, StatTile } from '../../components/ui/PageKit';
import {
    type ApiError, DetailField, InvoiceCell, ItemLinesTable, TxDialog, TxError, TxPager, TxStatusPill,
    TX_INPUT, TX_LABEL, TX_TH,
} from '../../components/admin/transactions/TxKit';
import ItemsEditorDialog from '../../components/admin/transactions/ItemsEditorDialog';

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Transactions() {
    const [items, setItems] = useState<ItemTransaction[]>([]);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [total, setTotal] = useState(0);
    // Sum of TotalPrice over every matching transaction (returned with each page).
    const [totalInvoices, setTotalInvoices] = useState(0);
    // Starts true so the first paint shows skeletons, not zeros.
    const [loading, setLoading] = useState(true);
    // Bumped by the Refresh button to re-run the list load with the same params.
    const [refreshKey, setRefreshKey] = useState(0);
    const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // Edit modal (scalars: total price / status)
    const [editing, setEditing] = useState<ItemTransaction | null>(null);
    const [editDraft, setEditDraft] = useState<TransactionUpdateDto>({});
    const [saving, setSaving] = useState(false);

    // Delete confirmation
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Items editor (admin can edit items on ANY transaction, open or closed)
    const [itemsEditing, setItemsEditing] = useState<ItemTransaction | null>(null);
    const [itemsDraft, setItemsDraft] = useState<Array<{ itemId: number; name: string; price: number; quantity: number }>>([]);
    const [itemsSaving, setItemsSaving] = useState(false);
    const [pickerItems, setPickerItems] = useState<ItemDto[]>([]);
    const [pickerSearch, setPickerSearch] = useState('');
    const [pickerLoading, setPickerLoading] = useState(false);

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

    const reload = async () => {
        const res = await getItemTransactions({
            Page: page, PageSize: pageSize, Search: debouncedSearch || undefined,
        });
        setItems(res.data || []);
        setTotal(res.totalCount || 0);
        setTotalInvoices(res.totalInvoices ?? 0);
    };

    useEffect(() => {
        let cancelled = false;
        async function load() {
            setLoading(true);
            try {
                const res = await getItemTransactions({
                    Page: page,
                    PageSize: pageSize,
                    Search: debouncedSearch || undefined
                });
                if (!cancelled) {
                    setItems(res.data || []);
                    setTotal(res.totalCount || 0);
                    setTotalInvoices(res.totalInvoices ?? 0);
                }
            } catch (err) {
                console.error('Failed to load item transactions', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        load();
        return () => {
            cancelled = true;
        };
    }, [page, pageSize, debouncedSearch, refreshKey]);

    // ── Edit (scalars) ────────────────────────────────────────────────
    const openEdit = (t: ItemTransaction) => {
        setEditing(t);
        setEditDraft({ totalPrice: t.totalPrice ?? null, statusId: t.statusId ?? null });
        setError(null);
    };

    const saveEdit = async () => {
        if (!editing?.transactionId) return;
        setSaving(true); setError(null);
        try {
            await updateTransaction(editing.transactionId, editDraft);
            setEditing(null);
            await reload();
        } catch (e: unknown) {
            const err = e as ApiError;
            const d = err?.response?.data;
            setError(d?.message ?? d?.error ?? err?.message ?? 'Save failed');
        } finally { setSaving(false); }
    };

    // ── Delete ────────────────────────────────────────────────────────
    const confirmDelete = async () => {
        if (!deletingId) return;
        setDeleting(true); setError(null);
        try {
            await deleteTransaction(deletingId);
            setDeletingId(null);
            await reload();
        } catch (e: unknown) {
            const err = e as ApiError;
            const d = err?.response?.data;
            setError(d?.message ?? d?.error ?? err?.message ?? 'Delete failed');
        } finally { setDeleting(false); }
    };

    // ── Items editor ──────────────────────────────────────────────────
    const openItemsEditor = (t: ItemTransaction) => {
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
            await reload();
        } catch (e: unknown) {
            const err = e as ApiError;
            const d = err?.response?.data;
            setError(d?.message ?? d?.error ?? err?.message ?? 'Save failed');
        } finally { setItemsSaving(false); }
    };

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    // KPI figures — totals come from the API; "on this page" ones from the loaded rows.
    const firstLoad = loading && items.length === 0 && total === 0;
    const avgInvoice = total > 0 ? totalInvoices / total : 0;
    const unpaidOnPage = items.filter(t => t.statusId === STATUS_PROCESSED_UNPAID);
    const unpaidOnPageSum = unpaidOnPage.reduce((s, t) => s + (t.totalPrice ?? 0), 0);

    return (
        <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6">
            <PageHeader
                tone="violet"
                icon={<ShoppingCartOutlined />}
                title="Item Transactions"
                description="Every coffee shop / F&B transaction with its item lines. Edit totals and status, change items on open or closed invoices, or delete with stock restored."
                actions={
                    <Tooltip title="Refresh">
                        <Button
                            icon={<ReloadOutlined />}
                            loading={loading}
                            onClick={() => setRefreshKey(k => k + 1)}
                            aria-label="Refresh"
                        />
                    </Tooltip>
                }
            />

            {/* ── KPI tiles ───────────────────────────────────────────── */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatTile
                    label="Transactions"
                    loading={firstLoad}
                    value={<span className="tabular-nums">{total.toLocaleString('en-US')}</span>}
                    sub={debouncedSearch ? 'Matching your search' : 'All item transactions'}
                    accent={<span className="rounded-lg bg-violet-50 p-1.5 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300"><FileTextOutlined /></span>}
                />
                <StatTile
                    label="Total invoiced"
                    loading={firstLoad}
                    value={<span className="tabular-nums">{money(totalInvoices)}</span>}
                    sub="Sum of all matching transactions"
                />
                <StatTile
                    label="Average invoice"
                    loading={firstLoad}
                    value={<span className="tabular-nums">{money(avgInvoice)}</span>}
                    sub="Total invoiced ÷ transactions"
                />
                <StatTile
                    label="Unpaid — on this page"
                    loading={firstLoad}
                    value={<span className="tabular-nums">{unpaidOnPage.length}</span>}
                    sub={<span className="tabular-nums">{money(unpaidOnPageSum)} open · page {page} of {totalPages}</span>}
                    accent={<span className="rounded-lg bg-amber-50 p-1.5 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300"><WarningFilled /></span>}
                />
            </div>

            {/* ── Transactions table ──────────────────────────────────── */}
            <Panel
                title="Transactions"
                subtitle="Click a row to see its details and item lines"
                bodyClassName="p-0"
                extra={
                    <AntInput
                        allowClear
                        prefix={<SearchOutlined className="text-gray-400" />}
                        placeholder="Search invoices..."
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(1); // Reset to first page on search
                        }}
                        className="w-full sm:w-64"
                        aria-label="Search invoices"
                    />
                }
            >
                {loading ? (
                    <div className="p-5"><Skeleton active paragraph={{ rows: 6 }} /></div>
                ) : items.length === 0 ? (
                    <div className="py-12"><Empty description="No transactions found" /></div>
                ) : (
                    <div className="relative overflow-x-auto">
                        <table className="w-full min-w-[1080px] text-sm">
                            <thead>
                                <tr className="border-b border-gray-100 bg-gray-50/70 text-left dark:border-white/[0.06] dark:bg-white/[0.02]">
                                    <th className={`${TX_TH} pl-5`}>Invoice</th>
                                    <th className={TX_TH}>Created By</th>
                                    <th className={TX_TH}>Customer</th>
                                    <th className={TX_TH}>Room / Channel</th>
                                    <th className={TX_TH}>Items</th>
                                    <th className={`${TX_TH} text-right`}>Total Paid</th>
                                    <th className={TX_TH}>Status</th>
                                    <th className={`${TX_TH} pr-5 text-right`}><span className="sr-only">Actions</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((t) => {
                                    const isExpanded = expandedIds.has(t.transactionId);
                                    const isOpen = t.statusId === STATUS_PROCESSED_UNPAID;
                                    // Left accent: amber for open (unpaid) invoices, violet for the expanded row.
                                    const accent = isOpen
                                        ? 'shadow-[inset_3px_0_0_0_var(--color-amber-400)]'
                                        : isExpanded ? 'shadow-[inset_3px_0_0_0_var(--color-violet-400)]' : '';
                                    return (
                                        <React.Fragment key={t.transactionId}>
                                            <tr
                                                className={`cursor-pointer border-b border-gray-100 align-middle transition-colors dark:border-white/[0.06] ${
                                                    isExpanded ? 'bg-gray-50/80 dark:bg-white/[0.03]' : 'hover:bg-gray-50/70 dark:hover:bg-white/[0.02]'
                                                }`}
                                                onClick={() => toggleExpanded(t.transactionId)}
                                            >
                                                <td className={`py-3 pl-5 pr-4 ${accent}`}>
                                                    <InvoiceCell id={t.transactionId} createdOn={t.createdOn} />
                                                </td>
                                                <td className="max-w-[200px] px-4 py-3">
                                                    <div className="truncate font-medium text-gray-800 dark:text-gray-200">{t.createdBy}</div>
                                                </td>
                                                <td className="max-w-[180px] px-4 py-3">
                                                    <div className="truncate font-medium text-gray-800 dark:text-gray-200">{t.userName || '—'}</div>
                                                    <div className="text-xs tabular-nums text-gray-500 dark:text-gray-400">Persons: {t.numberOfPersons ?? 1}</div>
                                                </td>
                                                <td className="max-w-[180px] px-4 py-3">
                                                    <div className="truncate text-gray-800 dark:text-gray-200">
                                                        {t.roomName || '—'}
                                                        {t.setName && <span className="text-gray-500 dark:text-gray-400"> · {t.setName}</span>}
                                                    </div>
                                                    {t.channelName && <div className="truncate text-xs text-gray-500 dark:text-gray-400">{t.channelName}</div>}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {t.items.length > 0 ? (
                                                        <div className="flex max-w-[300px] flex-wrap items-center gap-1">
                                                            {t.items.slice(0, 2).map((item, ii) => (
                                                                <span key={ii} className="inline-flex max-w-full items-center gap-1 rounded-md border border-gray-200/80 bg-white px-1.5 py-0.5 text-xs text-gray-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-300">
                                                                    <span className="truncate font-medium">{item.itemName}</span>
                                                                    <span className="font-semibold tabular-nums text-violet-600 dark:text-violet-300">×{item.quantity}</span>
                                                                </span>
                                                            ))}
                                                            <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">{t.items.length} item(s)</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-gray-400 dark:text-gray-500">{t.items.length} item(s)</span>
                                                    )}
                                                </td>
                                                <td className="whitespace-nowrap px-4 py-3 text-right">
                                                    <div className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">${t.totalPrice.toFixed(2)}</div>
                                                    {t.discount && (
                                                        <div className="text-xs text-emerald-700 dark:text-emerald-400">
                                                            {t.discount.name} ({t.discount.percentage}%)
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <TxStatusPill statusId={t.statusId} />
                                                </td>
                                                <td className="py-3 pl-4 pr-5" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex items-center justify-end gap-0.5">
                                                        <Tooltip title="Edit total / status">
                                                            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(t)} aria-label={`Edit total / status of transaction ${t.transactionId}`} />
                                                        </Tooltip>
                                                        <Tooltip title="Edit items (works on open AND closed)">
                                                            <Button type="text" size="small" icon={<UnorderedListOutlined />} onClick={() => openItemsEditor(t)} aria-label={`Edit items of transaction ${t.transactionId}`} />
                                                        </Tooltip>
                                                        <Tooltip title="Delete">
                                                            <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => setDeletingId(t.transactionId)} aria-label={`Delete transaction ${t.transactionId}`} />
                                                        </Tooltip>
                                                        <Tooltip title={isExpanded ? 'Collapse' : 'Show details'}>
                                                            <Button
                                                                type="text"
                                                                size="small"
                                                                icon={isExpanded ? <UpOutlined /> : <DownOutlined />}
                                                                onClick={() => toggleExpanded(t.transactionId)}
                                                                aria-expanded={isExpanded}
                                                                aria-label={isExpanded ? `Collapse transaction ${t.transactionId}` : `Show details of transaction ${t.transactionId}`}
                                                            />
                                                        </Tooltip>
                                                    </div>
                                                </td>
                                            </tr>

                                            {isExpanded && (
                                                <tr className="border-b border-gray-100 dark:border-white/[0.06]">
                                                    <td colSpan={8} className={`bg-gray-50/80 px-5 py-4 dark:bg-white/[0.03] ${accent}`}>
                                                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
                                                            <DetailField label="Transaction ID"><span className="tabular-nums">#{t.transactionId}</span></DetailField>
                                                            <DetailField label="Date"><span className="tabular-nums">{new Date(t.createdOn).toLocaleString()}</span></DetailField>
                                                            <DetailField label="Created By">{t.createdBy}</DetailField>
                                                            <DetailField label="Total Paid"><span className="font-semibold tabular-nums">${t.totalPrice.toFixed(2)}</span></DetailField>
                                                            {t.roomName && <DetailField label="Room">{t.roomName}</DetailField>}
                                                            {t.setName && <DetailField label="Set">{t.setName}</DetailField>}
                                                            {/* Previously not even fetched — the report DTO dropped
                                                                headcount, client, discount and channel. */}
                                                            <DetailField label="Persons"><span className="tabular-nums">{t.numberOfPersons ?? 1}</span></DetailField>
                                                            {t.userName && <DetailField label="Customer">{t.userName}</DetailField>}
                                                            {t.discount && (
                                                                <DetailField label="Discount">
                                                                    <span className="font-medium text-emerald-700 dark:text-emerald-400">{t.discount.name} ({t.discount.percentage}%)</span>
                                                                </DetailField>
                                                            )}
                                                            {t.channelName && <DetailField label="Channel">{t.channelName}</DetailField>}
                                                            <DetailField label="Status"><TxStatusPill statusId={t.statusId} /></DetailField>
                                                            <DetailField label="Items Count">{t.items.length} item(s)</DetailField>
                                                            {t.comment && <DetailField label="Comment" className="col-span-2 sm:col-span-4 lg:col-span-6">{t.comment}</DetailField>}
                                                        </div>
                                                        <div className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">Items Detail</div>
                                                        {t.items.length > 0
                                                            ? <ItemLinesTable items={t.items} />
                                                            : <div className="text-sm text-gray-400 dark:text-gray-500">No items on this transaction.</div>}
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                <TxPager
                    page={page}
                    totalPages={totalPages}
                    total={total}
                    onPrev={() => setPage((p) => Math.max(1, p - 1))}
                    onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
                />
            </Panel>

            {/* ── Edit modal (scalars) ─────────────────────────────────── */}
            {editing && (
                <TxDialog
                    busy={saving}
                    onClose={() => setEditing(null)}
                    title={<>Edit Transaction #{editing.transactionId}</>}
                    subtitle="Use the Items button to change item lines."
                    footer={<>
                        <Button disabled={saving} onClick={() => setEditing(null)}>Cancel</Button>
                        <Button type="primary" disabled={saving} loading={saving} onClick={saveEdit}>{saving ? 'Saving…' : 'Save'}</Button>
                    </>}
                >
                    <div>
                        <label htmlFor="tx-edit-total" className={TX_LABEL}>Total Price ($)</label>
                        <input
                            id="tx-edit-total"
                            type="number"
                            step="0.01"
                            min="0"
                            value={editDraft.totalPrice ?? ''}
                            onChange={(e) => setEditDraft(d => ({ ...d, totalPrice: e.target.value === '' ? null : Number(e.target.value) }))}
                            className={`${TX_INPUT} tabular-nums`}
                        />
                    </div>
                    <div>
                        <label htmlFor="tx-edit-status" className={TX_LABEL}>Status ID</label>
                        <input
                            id="tx-edit-status"
                            type="number"
                            value={editDraft.statusId ?? ''}
                            onChange={(e) => setEditDraft(d => ({ ...d, statusId: e.target.value === '' ? null : Number(e.target.value) }))}
                            className={`${TX_INPUT} tabular-nums`}
                        />
                    </div>
                    {error && <TxError>{error}</TxError>}
                </TxDialog>
            )}

            {/* ── Items editor (admin, any status) ────────────────────── */}
            {itemsEditing && (
                <ItemsEditorDialog
                    transactionId={itemsEditing.transactionId}
                    draft={itemsDraft}
                    setDraft={setItemsDraft}
                    pickerSearch={pickerSearch}
                    setPickerSearch={setPickerSearch}
                    pickerItems={pickerItems}
                    setPickerItems={setPickerItems}
                    pickerLoading={pickerLoading}
                    error={error}
                    saving={itemsSaving}
                    onClose={() => setItemsEditing(null)}
                    onSave={saveItems}
                    subtotalNote="Discount (if any) still applies automatically."
                />
            )}

            {/* ── Delete confirmation ─────────────────────────────────── */}
            {deletingId != null && (
                <TxDialog
                    busy={deleting}
                    onClose={() => setDeletingId(null)}
                    title={<>Delete transaction #{deletingId}?</>}
                    footer={<>
                        <Button disabled={deleting} onClick={() => setDeletingId(null)}>Cancel</Button>
                        <Button type="primary" danger disabled={deleting} loading={deleting} onClick={confirmDelete}>{deleting ? 'Deleting…' : 'Delete'}</Button>
                    </>}
                >
                    <p className="text-sm text-gray-700 dark:text-gray-300">This will reverse the transaction and restore any stock consumed by it. This action is logged permanently in the audit log.</p>
                    {error && <TxError>{error}</TxError>}
                </TxDialog>
            )}
        </div>
    );
}
