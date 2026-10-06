import React, { useEffect, useState, useCallback } from "react";
import { Button, Dropdown, Empty, Input as AntInput, Skeleton, Tooltip } from "antd";
import {
    CloseOutlined,
    CoffeeOutlined,
    DeleteOutlined,
    DoubleLeftOutlined,
    DoubleRightOutlined,
    DownOutlined,
    EditOutlined,
    LeftOutlined,
    MoreOutlined,
    ReloadOutlined,
    RightOutlined,
    SearchOutlined,
    ShoppingOutlined,
    TrophyOutlined,
    UpOutlined,
    WarningFilled,
} from "@ant-design/icons";
import {
    getItemTransactions, getGameTransactions,
    ItemTransaction, GameTransaction,
    updateTransaction, deleteTransaction, TransactionUpdateDto,
    removeItemFromOpenInvoice
} from '../../services/transactionService';
import { getStatusName, STATUS_PROCESSED_PAID } from '../../services/statuses';
import Loader from '../../components/ui/Loader';
import Modal from '../../components/ui/Modal';
import Label from '../../components/form/Label';
import Input from '../../components/form/input/InputField';
import Select from '../../components/form/Select';
import { PageHeader, Panel, Pill } from "../../components/ui/PageKit";
// ── NEW: status constant for open invoices ────────────────────
const STATUS_OPEN_INVOICE = 7;


// ── Status pill helper ────────────────────────────────────────────────────
function StatusBadge({ statusId }: { statusId: number }) {
    if (statusId === STATUS_PROCESSED_PAID)
        return <Pill tone="emerald" dot>Processed & Paid</Pill>;
    if (statusId === STATUS_OPEN_INVOICE)
        return <Pill tone="amber" dot>Open Invoice</Pill>;
    // 2 / 3 (Disabled / Deleted) are the cancelled-style states.
    return <Pill tone={statusId === 2 || statusId === 3 ? "red" : "gray"} dot>{getStatusName(statusId) ?? statusId}</Pill>;
}

// Invoice number with the date / time stacked under it.
function InvoiceCell({ id, createdOn }: { id?: number; createdOn: string }) {
    return (
        <div className="whitespace-nowrap">
            <div className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">#{id}</div>
            <div className="mt-0.5 text-xs tabular-nums text-gray-500 dark:text-gray-400">
                {new Date(createdOn).toLocaleDateString('en-GB')}
                <span className="text-gray-400 dark:text-gray-500"> · {new Date(createdOn).toLocaleTimeString()}</span>
            </div>
        </div>
    );
}

// « Prev Next » row, shown under a list when it has more than one page.
function OrdersPager({ label, atStart, atEnd, onFirst, onPrev, onNext, onLast }: {
    label: React.ReactNode;
    atStart: boolean;
    atEnd: boolean;
    onFirst: () => void;
    onPrev: () => void;
    onNext: () => void;
    onLast: () => void;
}) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-3 dark:border-white/[0.06]">
            <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">{label}</span>
            <div className="flex gap-1.5">
                <Button size="small" icon={<DoubleLeftOutlined />} disabled={atStart} onClick={onFirst} aria-label="First page" />
                <Button size="small" icon={<LeftOutlined />} disabled={atStart} onClick={onPrev}>Prev</Button>
                <Button size="small" disabled={atEnd} onClick={onNext}>Next <RightOutlined /></Button>
                <Button size="small" icon={<DoubleRightOutlined />} disabled={atEnd} onClick={onLast} aria-label="Last page" />
            </div>
        </div>
    );
}

const TH = "px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400";
const ROW_ACTIONS_CLS = "flex items-center justify-end gap-1";

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
            await removeItemFromOpenInvoice(order.transactionId!, itemId);
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

    return (
        <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6">
            {/* ── Page Header ─────────────────────────────────────────── */}
            <PageHeader
                tone="emerald"
                icon={<ShoppingOutlined />}
                title="Orders Management"
                description="Coffee shop, FNB, and game session orders"
                actions={
                    <Tooltip title="Refresh">
                        <Button
                            icon={<ReloadOutlined />}
                            loading={loadingItems || loadingGames}
                            onClick={() => { loadItemTransactions(); loadGameTransactions(); }}
                            aria-label="Refresh"
                        />
                    </Tooltip>
                }
            />

            {/* ── Global message banner ────────────────────────────────── */}
            {message && (
                <div role="status" className={`rounded-xl border px-4 py-3 text-sm font-medium ${
                    message.type === 'success'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300'
                        : 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300'
                }`}>
                    {message.text}
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                COFFEE SHOP ORDERS
            ══════════════════════════════════════════════════════════ */}
            <Panel
                title={<span className="inline-flex items-center gap-2"><CoffeeOutlined className="text-emerald-600 dark:text-emerald-400" /> Coffee Shop Orders</span>}
                subtitle="Includes open invoices and completed orders"
                bodyClassName="p-0"
                extra={
                    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                        {/* Stats pills */}
                        <Pill tone="gray"><span className="tabular-nums">{itemTotal} orders</span></Pill>
                        <Pill tone="violet"><span className="tabular-nums">${itemTotalRevenue.toFixed(2)} revenue</span></Pill>
                        {/* Search */}
                        <AntInput
                            allowClear
                            prefix={<SearchOutlined className="text-gray-400" />}
                            placeholder="Search orders..."
                            value={itemSearch}
                            onChange={(e) => { setItemSearch(e.target.value); setItemPage(1); }}
                            className="w-full sm:w-56"
                            aria-label="Search coffee shop orders"
                        />
                    </div>
                }
            >
                {/* Loading */}
                {loadingItems && <div className="p-5"><Skeleton active paragraph={{ rows: 6 }} /></div>}

                {/* Empty */}
                {!loadingItems && itemOrders.length === 0 && (
                    <div className="py-12"><Empty description="No orders found." /></div>
                )}

                {/* Table */}
                {!loadingItems && itemOrders.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[920px] text-sm">
                            <thead>
                                <tr className="border-b border-gray-100 bg-gray-50/70 text-left dark:border-white/[0.06] dark:bg-white/[0.02]">
                                    <th className={`${TH} pl-5`}>Invoice</th>
                                    <th className={TH}>Cashier</th>
                                    <th className={TH}>Items</th>
                                    <th className={`${TH} text-right`}>Total</th>
                                    <th className={TH}>Status</th>
                                    <th className={`${TH} pr-5 text-right`}><span className="sr-only">Actions</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {itemOrders.map((o, idx) => {
                                    const isOpen = o.statusId === STATUS_OPEN_INVOICE;
                                    const isExpanded = expandedRow === o.transactionId;
                                    // Left accent: amber for open invoices, violet for the expanded row.
                                    const accent = isOpen
                                        ? 'shadow-[inset_3px_0_0_0_var(--color-amber-400)]'
                                        : isExpanded ? 'shadow-[inset_3px_0_0_0_var(--color-violet-400)]' : '';
                                    return (
                                        <React.Fragment key={`${o.transactionId}-${idx}`}>
                                            {/* Main row */}
                                            <tr
                                                className={`cursor-pointer border-b border-gray-100 align-middle transition-colors dark:border-white/[0.06] ${
                                                    isExpanded ? 'bg-gray-50/80 dark:bg-white/[0.03]' : 'hover:bg-gray-50/70 dark:hover:bg-white/[0.02]'
                                                }`}
                                                onClick={() => setExpandedRow(isExpanded ? null : (o.transactionId ?? null))}
                                            >
                                                {/* Invoice # + date/time */}
                                                <td className={`py-3 pl-5 pr-4 ${accent}`}>
                                                    <InvoiceCell id={o.transactionId} createdOn={o.createdOn} />
                                                </td>

                                                {/* Cashier */}
                                                <td className="max-w-[200px] px-4 py-3">
                                                    <div className="truncate font-medium text-gray-800 dark:text-gray-200">
                                                        {o.createdBy?.split('@')[0] ?? '—'}
                                                    </div>
                                                    <div className="truncate text-xs text-gray-500 dark:text-gray-400">{o.createdBy}</div>
                                                </td>

                                                {/* Items preview */}
                                                <td className="px-4 py-3">
                                                    {o.items && o.items.length > 0 ? (
                                                        <div className="flex max-w-[360px] flex-wrap items-center gap-1">
                                                            {o.items.slice(0, 2).map((item, ii) => (
                                                                <span key={ii} className="inline-flex max-w-full items-center gap-1 rounded-md border border-gray-200/80 bg-white px-1.5 py-0.5 text-xs text-gray-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-300">
                                                                    <span className="truncate font-medium">{item.itemName}</span>
                                                                    <span className="font-semibold tabular-nums text-violet-600 dark:text-violet-300">×{item.quantity}</span>
                                                                    {item.categoryName && (
                                                                        <span className="truncate text-gray-400 dark:text-gray-500">· {item.categoryName}</span>
                                                                    )}
                                                                </span>
                                                            ))}
                                                            {o.items.length > 2 && (
                                                                <span className="text-xs text-gray-500 dark:text-gray-400">+{o.items.length - 2} more</span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-gray-400 dark:text-gray-500">No items</span>
                                                    )}
                                                </td>

                                                {/* Total */}
                                                <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                                                    ${o.totalPrice.toFixed(2)}
                                                </td>

                                                {/* Status */}
                                                <td className="px-4 py-3">
                                                    <StatusBadge statusId={o.statusId} />
                                                </td>

                                                {/* Actions */}
                                                <td className="py-3 pl-4 pr-5" onClick={e => e.stopPropagation()}>
                                                    <div className={ROW_ACTIONS_CLS}>
                                                        <Tooltip title={isExpanded ? 'Collapse' : 'Expand items'}>
                                                            <Button
                                                                type="text"
                                                                size="small"
                                                                icon={isExpanded ? <UpOutlined /> : <DownOutlined />}
                                                                aria-label={isExpanded ? `Collapse invoice ${o.transactionId}` : `Expand items of invoice ${o.transactionId}`}
                                                                aria-expanded={isExpanded}
                                                                onClick={() => setExpandedRow(isExpanded ? null : (o.transactionId ?? null))}
                                                            />
                                                        </Tooltip>
                                                        <Dropdown
                                                            trigger={["click"]}
                                                            menu={{
                                                                items: [
                                                                    { key: "edit", icon: <EditOutlined />, label: "Edit", onClick: () => handleEdit(o) },
                                                                    { key: "delete", icon: <DeleteOutlined />, label: "Delete", danger: true, onClick: () => { if (o.transactionId !== undefined) handleDeleteClick(o.transactionId); } },
                                                                ],
                                                            }}
                                                        >
                                                            <Button type="text" size="small" icon={<MoreOutlined />} aria-label={`Actions for invoice ${o.transactionId}`} />
                                                        </Dropdown>
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* ── Expanded item detail row ── */}
                                            {isExpanded && (
                                                <tr className="border-b border-gray-100 dark:border-white/[0.06]">
                                                    <td colSpan={6} className={`bg-gray-50/80 px-5 py-4 dark:bg-white/[0.03] ${accent}`}>
                                                        {isOpen && (
                                                            <div className="mb-3 flex w-fit items-center gap-2 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                                                                <WarningFilled />
                                                                Open Invoice — you can remove individual items below
                                                            </div>
                                                        )}
                                                        <div className="overflow-hidden rounded-xl border border-gray-200/80 bg-white dark:border-white/[0.06] dark:bg-transparent">
                                                            <table className="w-full text-sm">
                                                                <thead>
                                                                    <tr className="border-b border-gray-100 text-[11px] uppercase tracking-wide text-gray-500 dark:border-white/[0.06] dark:text-gray-400">
                                                                        <th className="px-4 py-2 text-left font-semibold">Item</th>
                                                                        <th className="px-4 py-2 text-left font-semibold">Category</th>
                                                                        <th className="px-4 py-2 text-center font-semibold">Qty</th>
                                                                        <th className="px-4 py-2 text-right font-semibold">Unit Price</th>
                                                                        <th className="px-4 py-2 text-right font-semibold">Line Total</th>
                                                                        {isOpen && <th className="px-4 py-2 text-right font-semibold">Remove</th>}
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-gray-100 dark:divide-white/[0.06]">
                                                                    {(o.items || []).map((item, ii) => {
                                                                        const rmKey = `${o.transactionId}-${item.itemId}`;
                                                                        const isRemoving = removingItem === rmKey;
                                                                        return (
                                                                            <tr key={ii}>
                                                                                <td className="px-4 py-2">
                                                                                    <div className="flex items-center gap-2">
                                                                                        {item.imagePath && (
                                                                                            <img src={item.imagePath} alt="" className="h-8 w-8 rounded-md object-cover" />
                                                                                        )}
                                                                                        <span className="font-medium text-gray-800 dark:text-gray-200">{item.itemName}</span>
                                                                                    </div>
                                                                                </td>
                                                                                <td className="px-4 py-2">
                                                                                    {item.categoryName
                                                                                        ? <Pill tone="gray">{item.categoryName}</Pill>
                                                                                        : <span className="text-gray-400 dark:text-gray-500">—</span>}
                                                                                </td>
                                                                                <td className="px-4 py-2 text-center font-semibold tabular-nums text-violet-600 dark:text-violet-300">
                                                                                    ×{item.quantity}
                                                                                </td>
                                                                                <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums text-gray-600 dark:text-gray-400">
                                                                                    {item.unitPrice != null ? `$${item.unitPrice.toFixed(2)}` : '—'}
                                                                                </td>
                                                                                <td className="whitespace-nowrap px-4 py-2 text-right font-semibold tabular-nums text-gray-800 dark:text-gray-200">
                                                                                    {item.lineTotal != null ? `$${item.lineTotal.toFixed(2)}` : '—'}
                                                                                </td>
                                                                                {isOpen && (
                                                                                    <td className="px-4 py-2 text-right">
                                                                                        <Button
                                                                                            size="small"
                                                                                            danger
                                                                                            icon={isRemoving ? undefined : <CloseOutlined />}
                                                                                            disabled={isRemoving}
                                                                                            onClick={() => handleRemoveItem(o, item.itemId)}
                                                                                        >
                                                                                            {isRemoving ? 'Removing…' : 'Remove'}
                                                                                        </Button>
                                                                                    </td>
                                                                                )}
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                        </div>
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

                {/* Pagination */}
                {!loadingItems && itemTotal > pageSize && (
                    <OrdersPager
                        label={<>Page {itemPage} of {totalItemPages} — {itemTotal} orders</>}
                        atStart={itemPage <= 1}
                        atEnd={itemPage >= totalItemPages}
                        onFirst={() => setItemPage(1)}
                        onPrev={() => setItemPage(p => p - 1)}
                        onNext={() => setItemPage(p => p + 1)}
                        onLast={() => setItemPage(totalItemPages)}
                    />
                )}
            </Panel>

            {/* ══════════════════════════════════════════════════════════
                GAME SESSION ORDERS  — unchanged logic, enhanced design
            ══════════════════════════════════════════════════════════ */}
            <Panel
                title={<span className="inline-flex items-center gap-2"><TrophyOutlined className="text-violet-600 dark:text-violet-400" /> Game Session Orders</span>}
                subtitle="Room and table sessions"
                bodyClassName="p-0"
                extra={
                    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                        <Pill tone="gray"><span className="tabular-nums">{gameTotal} sessions</span></Pill>
                        <AntInput
                            allowClear
                            prefix={<SearchOutlined className="text-gray-400" />}
                            placeholder="Search sessions..."
                            value={gameSearch}
                            onChange={(e) => { setGameSearch(e.target.value); setGamePage(1); }}
                            className="w-full sm:w-56"
                            aria-label="Search game session orders"
                        />
                    </div>
                }
            >
                {loadingGames && <div className="p-5"><Skeleton active paragraph={{ rows: 6 }} /></div>}
                {!loadingGames && gameOrders.length === 0 && (
                    <div className="py-12"><Empty description="No game session orders found." /></div>
                )}

                {!loadingGames && gameOrders.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[1000px] text-sm">
                            <thead>
                                <tr className="border-b border-gray-100 bg-gray-50/70 text-left dark:border-white/[0.06] dark:bg-white/[0.02]">
                                    <th className={`${TH} pl-5`}>Invoice</th>
                                    <th className={TH}>Cashier</th>
                                    <th className={TH}>Room / Game</th>
                                    <th className={TH}>Setting</th>
                                    <th className={`${TH} text-right`}>Hours</th>
                                    <th className={`${TH} text-right`}>Total</th>
                                    <th className={TH}>Status</th>
                                    <th className={`${TH} pr-5 text-right`}><span className="sr-only">Actions</span></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-white/[0.06]">
                                {gameOrders.map((o, idx) => (
                                    <tr key={`${o.transactionId}-${idx}`} className="align-middle transition-colors hover:bg-gray-50/70 dark:hover:bg-white/[0.02]">
                                        <td className="py-3 pl-5 pr-4">
                                            <InvoiceCell id={o.transactionId} createdOn={o.createdOn} />
                                        </td>
                                        <td className="max-w-[200px] px-4 py-3">
                                            <div className="truncate font-medium text-gray-800 dark:text-gray-200">{o.createdBy?.split('@')[0]}</div>
                                            {o.setName && <div className="truncate text-xs text-gray-500 dark:text-gray-400">Set: {o.setName}</div>}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-gray-800 dark:text-gray-200">{o.roomName || '—'}</div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">{o.gameName || '—'}</div>
                                        </td>
                                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                                            <div>{o.gameSettingName || '—'}</div>
                                            {o.gameCategoryName && <div className="text-xs text-gray-500 dark:text-gray-400">{o.gameCategoryName}</div>}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                                            {o.hours === 0 ? <Pill tone="amber" dot>Open</Pill> : `${o.hours}h`}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                                            ${o.totalPrice.toFixed(2)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <StatusBadge statusId={o.statusId} />
                                        </td>
                                        <td className="py-3 pl-4 pr-5">
                                            <div className={ROW_ACTIONS_CLS}>
                                                <Dropdown
                                                    trigger={["click"]}
                                                    menu={{
                                                        items: [
                                                            { key: "edit", icon: <EditOutlined />, label: "Edit", onClick: () => handleEdit(o) },
                                                            { key: "delete", icon: <DeleteOutlined />, label: "Delete", danger: true, onClick: () => { if (typeof o.transactionId === 'number') handleDeleteClick(o.transactionId); } },
                                                        ],
                                                    }}
                                                >
                                                    <Button type="text" size="small" icon={<MoreOutlined />} aria-label={`Actions for session ${o.transactionId}`} />
                                                </Dropdown>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {!loadingGames && gameTotal > pageSize && (
                    <OrdersPager
                        label={<>Page {gamePage} of {totalGamePages} — {gameTotal} sessions</>}
                        atStart={gamePage <= 1}
                        atEnd={gamePage >= totalGamePages}
                        onFirst={() => setGamePage(1)}
                        onPrev={() => setGamePage(p => p - 1)}
                        onNext={() => setGamePage(p => p + 1)}
                        onLast={() => setGamePage(totalGamePages)}
                    />
                )}
            </Panel>

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
