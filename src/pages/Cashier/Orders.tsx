import React, { useEffect, useState } from 'react';
import { CoffeeOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext';
import { getItemTransactions, ItemTransaction } from '../../services/transactionService';
import { getStatusName, STATUS_PROCESSED_PAID } from '../../services/statuses';
import { Pill } from '../../components/ui/PageKit';
import { CardSkeletons, DeskEmpty, DeskHeader } from '../../components/till/desk/DeskKit';
import { deskBtn, deskCard } from '../../components/till/desk/deskStyles';

// Status pill: Enabled / Processed & Paid read as done (green); everything else neutral.
function OrderStatus({ statusId }: { statusId: number }) {
    const done = statusId === 1 || statusId === STATUS_PROCESSED_PAID;
    return <Pill tone={done ? 'emerald' : 'gray'} dot>{getStatusName(statusId) ?? statusId}</Pill>;
}

const CashierOrders: React.FC = () => {
    const auth = useAuth();
    const [orders, setOrders] = useState<ItemTransaction[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [total, setTotal] = useState(0);

    useEffect(() => {
        let mounted = true;
        const name = auth?.claims?.name ?? null;
        if (!name) return;
        setLoading(true);

        // Fetch only item transactions (coffee shop orders)
        getItemTransactions({ CreatedBy: [name], Page: page, PageSize: pageSize })
            .then((res) => {
                if (!mounted) return;
                setOrders(res.data || []);
                setTotal(res.totalCount);
            })
            .catch(() => {
                /* ignore */
            })
            .finally(() => { if (mounted) setLoading(false); });

        return () => { mounted = false; };
    }, [auth?.claims?.name, page, pageSize]);

    const lastPage = Math.max(1, Math.ceil(total / pageSize));

    return (
        <div className="mx-auto max-w-5xl space-y-4 p-3 sm:p-6">
            <DeskHeader
                icon={<CoffeeOutlined />}
                title="Coffee Shop Orders"
                badge={!loading && total > 0 ? <Pill tone="violet">{total} orders</Pill> : undefined}
                description="Orders you rang up at the till."
            />

            {loading && <CardSkeletons count={4} className="space-y-3" height={96} />}

            {!loading && orders.length === 0 && (
                <DeskEmpty icon={<CoffeeOutlined />} title="No orders found." />
            )}

            {!loading && orders.length > 0 && (
                <div className="space-y-3">
                    {orders.map((o, idx) => (
                        <article
                            key={`${o.transactionId}-${idx}`}
                            className={`${deskCard} border-gray-200/80 p-4 dark:border-white/[0.06]`}
                        >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                {/* Date / time */}
                                <div className="min-w-[110px]">
                                    <div className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
                                        {new Date(o.createdOn).toLocaleDateString()}
                                    </div>
                                    <div className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
                                        {new Date(o.createdOn).toLocaleTimeString()}
                                    </div>
                                </div>

                                {/* Total + status — the key figure */}
                                <div className="order-2 ml-auto flex flex-col items-end gap-1.5 sm:order-3">
                                    <div className="text-2xl font-bold leading-none tabular-nums text-gray-900 dark:text-white">
                                        ${o.totalPrice.toFixed(2)}
                                    </div>
                                    <OrderStatus statusId={o.statusId} />
                                </div>

                                {/* Items */}
                                <div className="order-3 w-full min-w-0 sm:order-2 sm:w-auto sm:flex-1">
                                    {o.items && o.items.length > 0 ? (
                                        <ul className="flex flex-wrap gap-1.5">
                                            {o.items.map((item, itemIdx) => (
                                                <li
                                                    key={itemIdx}
                                                    className="inline-flex items-baseline gap-1.5 rounded-lg bg-gray-50 px-2.5 py-1 text-sm ring-1 ring-gray-200/70 dark:bg-white/[0.04] dark:ring-white/10"
                                                >
                                                    <span className="font-bold tabular-nums text-gray-900 dark:text-white">x{item.quantity}</span>
                                                    <span className="font-medium text-gray-800 dark:text-gray-100">{item.itemName}</span>
                                                    {item.categoryName && (
                                                        <span className="text-xs text-gray-400 dark:text-gray-500">({item.categoryName})</span>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <span className="text-sm text-gray-400 dark:text-gray-500">No items</span>
                                    )}
                                </div>
                            </div>
                        </article>
                    ))}

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        <div className="text-sm tabular-nums text-gray-600 dark:text-gray-400">Page {page} of {lastPage} — {total} orders</div>
                        <div className="flex gap-2">
                            <button className={deskBtn('outline')} disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                                <LeftOutlined /> Prev
                            </button>
                            <button className={deskBtn('outline')} disabled={page >= Math.max(1, Math.ceil(total / pageSize))} onClick={() => setPage(p => p + 1)}>
                                Next <RightOutlined />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CashierOrders;
