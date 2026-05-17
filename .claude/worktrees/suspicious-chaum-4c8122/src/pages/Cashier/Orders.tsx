import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getItemTransactions, ItemTransaction } from '../../services/transactionService';
import { getStatusName, STATUS_PROCESSED_PAID } from '../../services/statuses';
import Loader from '../../components/ui/Loader';

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

    return (
        <div className="p-6">
            <h1 className="text-2xl font-semibold mb-4">Coffee Shop Orders</h1>

            {loading && <div className="text-gray-600"><Loader /></div>}

            {!loading && orders.length === 0 && (
                <div className="text-sm text-gray-500">No orders found.</div>
            )}

            {!loading && orders.length > 0 && (
                <div className="space-y-4">
                    <div className="grid grid-cols-12 gap-2 font-medium text-sm border-b pb-2">
                        <div className="col-span-3">Date/Time</div>
                        <div className="col-span-5">Items</div>
                        <div className="col-span-2">Total</div>
                        <div className="col-span-2">Status</div>
                    </div>
                    {orders.map((o, idx) => (
                        <div key={`${o.transactionId}-${idx}`} className="grid grid-cols-12 gap-2 items-center p-2 bg-white border rounded">
                            <div className="col-span-3">
                                <div className="font-medium text-sm">
                                    {new Date(o.createdOn).toLocaleDateString()}
                                </div>
                                <div className="text-xs text-gray-500">
                                    {new Date(o.createdOn).toLocaleTimeString()}
                                </div>
                            </div>
                            <div className="col-span-5 text-sm">
                                {o.items && o.items.length > 0 ? (
                                    <div className="space-y-1">
                                        {o.items.map((item, itemIdx) => (
                                            <div key={itemIdx} className="flex items-center gap-2">
                                                <span className="font-medium">{item.itemName}</span>
                                                <span className="text-xs text-gray-500">x{item.quantity}</span>
                                                <span className="text-xs text-gray-400">({item.categoryName})</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <span className="text-gray-400">No items</span>
                                )}
                            </div>
                            <div className="col-span-2 text-sm font-semibold">${o.totalPrice.toFixed(2)}</div>
                            <div className="col-span-2 text-sm">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${o.statusId === 1 ? 'bg-green-100 text-green-800' :
                                        o.statusId === STATUS_PROCESSED_PAID ? 'bg-green-100 text-green-800' :
                                            'bg-gray-100 text-gray-800'
                                    }`}>
                                    {getStatusName(o.statusId) ?? o.statusId}
                                </span>
                            </div>
                        </div>
                    ))}

                    <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-600">Page {page} — {total} orders</div>
                        <div className="space-x-2">
                            <button className="px-2 py-1 bg-gray-200 rounded" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Prev</button>
                            <button className="px-2 py-1 bg-gray-200 rounded" disabled={page >= Math.max(1, Math.ceil(total / pageSize))} onClick={() => setPage(p => p + 1)}>Next</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CashierOrders;
