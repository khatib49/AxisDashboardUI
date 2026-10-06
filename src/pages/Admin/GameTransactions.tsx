import React, { useEffect, useState } from 'react';
import { Button, Empty, Input as AntInput, Skeleton, Tooltip } from 'antd';
import {
    ClockCircleOutlined, DeleteOutlined, DownOutlined, EditOutlined, FileTextOutlined,
    ReloadOutlined, SearchOutlined, TrophyOutlined, UnorderedListOutlined, UpOutlined,
} from '@ant-design/icons';
import {
  getGameTransactions, GameTransaction,
  updateTransaction, deleteTransaction, TransactionUpdateDto,
  replaceTransactionItems,
} from '../../services/transactionService';
import { STATUS_PROCESSED_UNPAID } from '../../services/statuses';
import { getItems, ItemDto } from '../../services/itemService';
import { PageHeader, Panel, Pill, StatTile } from '../../components/ui/PageKit';
import {
    type ApiError, DetailField, InvoiceCell, ItemLinesTable, TxDialog, TxError, TxPager, TxStatusPill,
    TX_INPUT, TX_LABEL, TX_TH,
} from '../../components/admin/transactions/TxKit';
import ItemsEditorDialog from '../../components/admin/transactions/ItemsEditorDialog';

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function GameTransactions() {
    const [items, setItems] = useState<GameTransaction[]>([]);
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
            setTotalInvoices(res.totalInvoices ?? 0);
        } catch (e: unknown) {
            const err = e as ApiError;
            const d = err?.response?.data;
            setError(d?.message ?? d?.error ?? err?.message ?? 'Save failed');
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
            setTotalInvoices(res.totalInvoices ?? 0);
        } catch (e: unknown) {
            const err = e as ApiError;
            setError(err?.response?.data?.message ?? err?.message ?? 'Save failed');
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
            setTotalInvoices(res.totalInvoices ?? 0);
        } catch (e: unknown) {
            const err = e as ApiError;
            setError(err?.response?.data?.message ?? err?.message ?? 'Delete failed');
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
                    setTotalInvoices(res.totalInvoices ?? 0);
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
    }, [page, pageSize, debouncedSearch, refreshKey]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    // KPI figures — totals come from the API; "on this page" ones from the loaded rows.
    const firstLoad = loading && items.length === 0 && total === 0;
    const avgInvoice = total > 0 ? totalInvoices / total : 0;
    const hoursOnPage = items.reduce((s, t) => s + (t.hours > 0 ? t.hours : 0), 0);
    const dayPassesOnPage = items.filter(t => t.isDayPass).length;

    return (
        <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6">
            <PageHeader
                tone="blue"
                icon={<TrophyOutlined />}
                title="Game Transactions"
                description="Room, table and console sessions with their F&B lines. Edit hours, totals and status, change items on open or closed invoices, or delete with stock restored."
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
                    sub={debouncedSearch ? 'Matching your search' : 'All game transactions'}
                    accent={<span className="rounded-lg bg-blue-50 p-1.5 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300"><FileTextOutlined /></span>}
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
                    label="Hours — on this page"
                    loading={firstLoad}
                    value={<span className="tabular-nums">{hoursOnPage.toLocaleString('en-US')}</span>}
                    sub={<span className="tabular-nums">{dayPassesOnPage} day pass{dayPassesOnPage === 1 ? '' : 'es'} · page {page} of {totalPages}</span>}
                    accent={<span className="rounded-lg bg-violet-50 p-1.5 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300"><ClockCircleOutlined /></span>}
                />
            </div>

            {/* ── Transactions table ──────────────────────────────────── */}
            <Panel
                title="Sessions"
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
                        <table className="w-full min-w-[1160px] text-sm">
                            <thead>
                                <tr className="border-b border-gray-100 bg-gray-50/70 text-left dark:border-white/[0.06] dark:bg-white/[0.02]">
                                    <th className={`${TX_TH} pl-5`}>Invoice</th>
                                    <th className={TX_TH}>Created By</th>
                                    <th className={TX_TH}>Room / Game</th>
                                    <th className={TX_TH}>Setting</th>
                                    <th className={`${TX_TH} text-right`}>Hours</th>
                                    <th className={TX_TH}>Customer</th>
                                    <th className={`${TX_TH} text-right`}>Total Paid</th>
                                    <th className={TX_TH}>Status</th>
                                    <th className={`${TX_TH} pr-5 text-right`}><span className="sr-only">Actions</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((t, idx) => {
                                    const isExpanded = typeof t.transactionId === 'number' ? expandedIds.has(t.transactionId) : false;
                                    const isOpen = t.statusId === STATUS_PROCESSED_UNPAID;
                                    const itemCount = t.items ? t.items.length : 0;
                                    const toggle = () => {
                                        if (typeof t.transactionId === 'number') {
                                            toggleExpanded(t.transactionId);
                                        }
                                    };
                                    // Left accent: amber for open (unpaid) invoices, violet for the expanded row.
                                    const accent = isOpen
                                        ? 'shadow-[inset_3px_0_0_0_var(--color-amber-400)]'
                                        : isExpanded ? 'shadow-[inset_3px_0_0_0_var(--color-violet-400)]' : '';
                                    return (
                                        <React.Fragment key={`${t.transactionId}-${idx}`}>
                                            <tr
                                                className={`cursor-pointer border-b border-gray-100 align-middle transition-colors dark:border-white/[0.06] ${
                                                    isExpanded ? 'bg-gray-50/80 dark:bg-white/[0.03]' : 'hover:bg-gray-50/70 dark:hover:bg-white/[0.02]'
                                                }`}
                                                onClick={toggle}
                                            >
                                                <td className={`py-3 pl-5 pr-4 ${accent}`}>
                                                    <InvoiceCell id={t.transactionId} createdOn={t.createdOn} />
                                                </td>
                                                <td className="max-w-[180px] px-4 py-3">
                                                    <div className="truncate font-medium text-gray-800 dark:text-gray-200">{t.createdBy}</div>
                                                    {t.channelName && <div className="truncate text-xs text-gray-500 dark:text-gray-400">{t.channelName}</div>}
                                                </td>
                                                <td className="max-w-[200px] px-4 py-3">
                                                    <div className="truncate font-medium text-gray-800 dark:text-gray-200">
                                                        {t.roomName || '—'}
                                                        {t.setName && <span className="font-normal text-gray-500 dark:text-gray-400"> · {t.setName}</span>}
                                                    </div>
                                                    <div className="truncate text-xs text-gray-500 dark:text-gray-400">{t.gameName || '—'}</div>
                                                </td>
                                                <td className="max-w-[200px] px-4 py-3">
                                                    <div className="truncate text-gray-700 dark:text-gray-300">{t.gameSettingName || '—'}</div>
                                                    {(t.gameCategoryName || t.gameTypeName) && (
                                                        <div className="truncate text-xs text-gray-500 dark:text-gray-400">
                                                            {[t.gameCategoryName, t.gameTypeName].filter(Boolean).join(' · ')}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                                                    {t.hours > 0 ? `${t.hours}h` : '—'}
                                                    {t.isDayPass && <div className="mt-0.5"><Pill tone="violet">Day Pass</Pill></div>}
                                                </td>
                                                <td className="max-w-[170px] px-4 py-3">
                                                    <div className="truncate font-medium text-gray-800 dark:text-gray-200">{t.userName || '—'}</div>
                                                    <div className="text-xs tabular-nums text-gray-500 dark:text-gray-400">Persons: {t.numberOfPersons ?? 1}</div>
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
                                                    <div className="mt-1 text-xs tabular-nums text-gray-500 dark:text-gray-400">{itemCount} item(s)</div>
                                                </td>
                                                {/* Edit / Delete — stopPropagation so they don't toggle expand */}
                                                <td className="py-3 pl-4 pr-5" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex items-center justify-end gap-0.5">
                                                        <Tooltip title="Edit">
                                                            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(t)} aria-label={`Edit transaction ${t.transactionId}`} />
                                                        </Tooltip>
                                                        <Tooltip title="Edit items (works on open AND closed)">
                                                            <Button type="text" size="small" icon={<UnorderedListOutlined />} onClick={() => openItemsEditor(t)} aria-label={`Edit items of transaction ${t.transactionId}`} />
                                                        </Tooltip>
                                                        <Tooltip title="Delete">
                                                            <Button
                                                                type="text"
                                                                size="small"
                                                                danger
                                                                icon={<DeleteOutlined />}
                                                                onClick={() => {
                                                                    if (typeof t.transactionId === 'number') setDeletingId(t.transactionId);
                                                                }}
                                                                aria-label={`Delete transaction ${t.transactionId}`}
                                                            />
                                                        </Tooltip>
                                                        <Tooltip title={isExpanded ? 'Collapse' : 'Show details'}>
                                                            <Button
                                                                type="text"
                                                                size="small"
                                                                icon={isExpanded ? <UpOutlined /> : <DownOutlined />}
                                                                onClick={toggle}
                                                                aria-expanded={isExpanded}
                                                                aria-label={isExpanded ? `Collapse transaction ${t.transactionId}` : `Show details of transaction ${t.transactionId}`}
                                                            />
                                                        </Tooltip>
                                                    </div>
                                                </td>
                                            </tr>

                                            {isExpanded && (
                                                <tr className="border-b border-gray-100 dark:border-white/[0.06]">
                                                    <td colSpan={9} className={`bg-gray-50/80 px-5 py-4 dark:bg-white/[0.03] ${accent}`}>
                                                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
                                                            <DetailField label="Transaction ID"><span className="tabular-nums">#{t.transactionId}</span></DetailField>
                                                            <DetailField label="Date"><span className="tabular-nums">{new Date(t.createdOn).toLocaleString()}</span></DetailField>
                                                            <DetailField label="Created By">{t.createdBy}</DetailField>
                                                            <DetailField label="Total Paid"><span className="font-semibold tabular-nums">${t.totalPrice.toFixed(2)}</span></DetailField>
                                                            {t.gameName && <DetailField label="Game"><span className="font-medium">{t.gameName}</span></DetailField>}
                                                            {t.gameCategoryName && <DetailField label="Game Category">{t.gameCategoryName}</DetailField>}
                                                            {t.gameTypeName && <DetailField label="Game Type">{t.gameTypeName}</DetailField>}
                                                            {t.gameSettingName && <DetailField label="Game Setting">{t.gameSettingName}</DetailField>}
                                                            {t.roomName && <DetailField label="Room">{t.roomName}</DetailField>}
                                                            {t.setName && <DetailField label="Set">{t.setName}</DetailField>}
                                                            {t.hours > 0 && <DetailField label="Hours"><span className="tabular-nums">{t.hours}</span></DetailField>}
                                                            {/* Everything below reaches the panel now — it was on the
                                                                record all along but never projected into the report DTO. */}
                                                            <DetailField label="Persons"><span className="tabular-nums">{t.numberOfPersons ?? 1}</span></DetailField>
                                                            {t.userName && <DetailField label="Customer">{t.userName}</DetailField>}
                                                            {t.discount && (
                                                                <DetailField label="Discount">
                                                                    <span className="font-medium text-emerald-700 dark:text-emerald-400">{t.discount.name} ({t.discount.percentage}%)</span>
                                                                </DetailField>
                                                            )}
                                                            {t.channelName && <DetailField label="Channel">{t.channelName}</DetailField>}
                                                            {t.isDayPass && <DetailField label="Day Pass"><span className="font-medium text-indigo-700 dark:text-indigo-300">Yes</span></DetailField>}
                                                            {t.modifiedOn && (
                                                                <DetailField label="Modified"><span className="tabular-nums">{new Date(t.modifiedOn).toLocaleString()}</span></DetailField>
                                                            )}
                                                            <DetailField label="Status"><TxStatusPill statusId={t.statusId} /></DetailField>
                                                            <DetailField label="Items Count">{itemCount} item(s)</DetailField>
                                                            {t.comment && <DetailField label="Comment" className="col-span-2 sm:col-span-4 lg:col-span-6">{t.comment}</DetailField>}
                                                        </div>
                                                        {t.items && t.items.length > 0 && (
                                                            <>
                                                                <div className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">Items Detail</div>
                                                                <ItemLinesTable items={t.items} />
                                                            </>
                                                        )}
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

            {/* ── Edit modal ──────────────────────────────────────────── */}
            {editing && (
                <TxDialog
                    busy={saving}
                    onClose={() => setEditing(null)}
                    title={<>Edit Transaction #{editing.transactionId}</>}
                    subtitle="Changing items must be done from the cashier flow."
                    footer={<>
                        <Button disabled={saving} onClick={() => setEditing(null)}>Cancel</Button>
                        <Button type="primary" disabled={saving} loading={saving} onClick={saveEdit}>{saving ? 'Saving…' : 'Save'}</Button>
                    </>}
                >
                    <div>
                        <label htmlFor="gtx-edit-hours" className={TX_LABEL}>Hours</label>
                        <input
                            id="gtx-edit-hours"
                            type="number"
                            step="0.5"
                            min="0"
                            value={editDraft.hours ?? ''}
                            onChange={(e) => setEditDraft(d => ({ ...d, hours: e.target.value === '' ? null : Number(e.target.value) }))}
                            className={`${TX_INPUT} tabular-nums`}
                        />
                    </div>
                    <div>
                        <label htmlFor="gtx-edit-total" className={TX_LABEL}>Total Price ($)</label>
                        <input
                            id="gtx-edit-total"
                            type="number"
                            step="0.01"
                            min="0"
                            value={editDraft.totalPrice ?? ''}
                            onChange={(e) => setEditDraft(d => ({ ...d, totalPrice: e.target.value === '' ? null : Number(e.target.value) }))}
                            className={`${TX_INPUT} tabular-nums`}
                        />
                    </div>
                    <div>
                        <label htmlFor="gtx-edit-status" className={TX_LABEL}>Status ID</label>
                        <input
                            id="gtx-edit-status"
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
                    subtotalNote="Session/time charges stay untouched; discount still applies."
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
                    <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                        <p>This will reverse the transaction and restore any stock consumed by it. This action is logged permanently in the audit log.</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Any associated F&amp;B ingredient consumption will be reversed automatically.</p>
                    </div>
                    {error && <TxError>{error}</TxError>}
                </TxDialog>
            )}
        </div>
    );
}
