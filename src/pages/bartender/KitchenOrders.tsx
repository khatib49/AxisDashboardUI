import { useEffect, useState } from 'react';
import { getKitchenOrders, getKitchenOrderById, startPreparingOrder, markOrderReady, markOrderServed, KitchenOrderDto } from '../../services/kitchenService';
import PageMeta from '../../components/common/PageMeta';
import Loader from '../../components/ui/Loader';
import Modal from '../../components/ui/Modal';
import { useModal } from '../../hooks/useModal';

type FoodStatusFilter = 'all' | 11 | 12 | 13 | 14;

export default function KitchenOrders() {
    const [orders, setOrders] = useState<KitchenOrderDto[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<FoodStatusFilter>('all');
    const [selectedOrder, setSelectedOrder] = useState<KitchenOrderDto | null>(null);
    const { isOpen, openModal, closeModal } = useModal();
    const [actionLoading, setActionLoading] = useState(false);

    const loadOrders = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await getKitchenOrders(statusFilter === 'all' ? undefined : statusFilter);
            setOrders(data);
        } catch (err: unknown) {
            const message = err && typeof err === 'object' && 'message' in err
                ? String(err.message)
                : 'Failed to load kitchen orders';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadOrders();
        // Refresh every 30 seconds
        const interval = setInterval(loadOrders, 30000);
        return () => clearInterval(interval);
    }, [statusFilter]);

    const handleViewDetails = async (transactionId: number) => {
        try {
            setActionLoading(true);
            const detailedOrder = await getKitchenOrderById(transactionId);
            setSelectedOrder(detailedOrder);
            openModal();
        } catch (err: unknown) {
            const message = err && typeof err === 'object' && 'message' in err
                ? String(err.message)
                : 'Failed to load order details';
            setError(message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleStartPreparing = async (transactionId: number) => {
        try {
            setActionLoading(true);
            await startPreparingOrder(transactionId);
            closeModal();
            loadOrders();
        } catch (err: unknown) {
            const message = err && typeof err === 'object' && 'message' in err
                ? String(err.message)
                : 'Failed to start preparing order';
            setError(message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleMarkReady = async (transactionId: number) => {
        try {
            setActionLoading(true);
            await markOrderReady(transactionId);
            closeModal();
            loadOrders();
        } catch (err: unknown) {
            const message = err && typeof err === 'object' && 'message' in err
                ? String(err.message)
                : 'Failed to mark order as ready';
            setError(message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleMarkServed = async (transactionId: number) => {
        try {
            setActionLoading(true);
            await markOrderServed(transactionId);
            closeModal();
            loadOrders();
        } catch (err: unknown) {
            const message = err && typeof err === 'object' && 'message' in err
                ? String(err.message)
                : 'Failed to mark order as served';
            setError(message);
        } finally {
            setActionLoading(false);
        }
    };

    const getStatusBadge = (statusId: number, statusName: string) => {
        const statusConfig: Record<number, { bg: string; text: string; label: string }> = {
            11: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pending' }, // Food Pending
            12: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'In Progress' },     // Food InProgress
            13: { bg: 'bg-green-100', text: 'text-green-800', label: 'Ready' },   // Food Ready
            14: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Served' },    // Food Served
        };
        const config = statusConfig[statusId] || { bg: 'bg-gray-100', text: 'text-gray-800', label: statusName };
        return (
            <span className={`inline-flex items-center px-2 py-1 rounded-full ${config.bg} ${config.text} text-xs font-medium`}>
                {config.label}
            </span>
        );
    };

    const getActionButtons = (order: KitchenOrderDto) => {
        if (order.foodStatusId === 11) { // Food Pending
            return (
                <button
                    onClick={() => handleStartPreparing(order.transactionId)}
                    className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                >
                    Start Preparing
                </button>
            );
        }
        if (order.foodStatusId === 12) { // Food InProgress
            return (
                <button
                    onClick={() => handleMarkReady(order.transactionId)}
                    className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                >
                    Mark Ready
                </button>
            );
        }
        if (order.foodStatusId === 13) { // Food Ready
            return (
                <button
                    onClick={() => handleMarkServed(order.transactionId)}
                    className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm"
                >
                    Mark Served
                </button>
            );
        }
        return null;
    };

    return (
        <>
            <PageMeta title="Kitchen Orders - AXIS" description="Kitchen order management" />
            <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-semibold">Kitchen Orders</h1>
                    <button
                        onClick={loadOrders}
                        className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                    >
                        Refresh
                    </button>
                </div>

                {/* Status Filter */}
                <div className="mb-6 flex gap-2 flex-wrap">
                    {[
                        { value: 'all' as FoodStatusFilter, label: 'All Orders' },
                        { value: 11 as FoodStatusFilter, label: 'Pending' },
                        { value: 12 as FoodStatusFilter, label: 'In Progress' },
                        { value: 13 as FoodStatusFilter, label: 'Ready' },
                        { value: 14 as FoodStatusFilter, label: 'Served' },
                    ].map((filter) => (
                        <button
                            key={filter.value}
                            onClick={() => setStatusFilter(filter.value)}
                            className={`px-4 py-2 rounded-lg font-medium transition ${statusFilter === filter.value
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
                                }`}
                        >
                            {filter.label}
                        </button>
                    ))}
                </div>

                {error && (
                    <div className="mb-4 text-red-600 bg-red-50 p-4 rounded-lg">
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="flex justify-center py-20">
                        <Loader />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {orders.length === 0 ? (
                            <div className="col-span-full text-center py-10 text-gray-500">
                                No orders found
                            </div>
                        ) : (
                            orders.map((order) => (
                                <div
                                    key={order.transactionId}
                                    className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4"
                                    style={{
                                        borderLeftColor:
                                            order.foodStatusId === 11 ? '#FCD34D' : // Food Pending - yellow
                                                order.foodStatusId === 12 ? '#60A5FA' : // Food InProgress - blue
                                                    order.foodStatusId === 13 ? '#34D399' : // Food Ready - green
                                                        '#9CA3AF' // Food Served - gray
                                    }}
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h3 className="text-lg font-semibold">Order #{order.transactionId}</h3>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                                {new Date(order.orderTime).toLocaleString('en-US', {
                                                    timeZone: 'Asia/Beirut',
                                                    dateStyle: 'medium',
                                                    timeStyle: 'short'
                                                })}
                                            </p>
                                        </div>
                                        {getStatusBadge(order.foodStatusId, order.foodStatusName)}
                                    </div>

                                    {order.tableName && (
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                            <strong>Table:</strong> {order.tableName}
                                        </p>
                                    )}

                                    {order.customerName && (
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                            <strong>Customer:</strong> {order.customerName}
                                        </p>
                                    )}

                                    <div className="mb-3">
                                        <p className="text-sm font-semibold mb-1">Items:</p>
                                        <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                                            {order.items.map((item, idx) => (
                                                <li key={idx}>
                                                    {item.quantity}x {item.itemName}
                                                    {item.specialInstructions && (
                                                        <span className="text-xs text-gray-500 italic ml-1">
                                                            ({item.specialInstructions})
                                                        </span>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    {order.comment && (
                                        <div className="mb-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                                            <p className="text-xs font-semibold text-yellow-800 dark:text-yellow-400">Note:</p>
                                            <p className="text-sm text-yellow-700 dark:text-yellow-300">{order.comment}</p>
                                        </div>
                                    )}

                                    <div className="flex gap-2 mt-3">
                                        <button
                                            onClick={() => handleViewDetails(order.transactionId)}
                                            className="flex-1 px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600 text-sm"
                                            disabled={actionLoading}
                                        >
                                            View Details
                                        </button>
                                        {getActionButtons(order)}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* Order Details Modal */}
            <Modal
                isOpen={isOpen}
                onClose={closeModal}
                title={`Order #${selectedOrder?.transactionId || ''}`}
                footer={
                    <>
                        <button
                            className="bg-gray-200 text-gray-800 px-3 py-1 rounded"
                            onClick={closeModal}
                            disabled={actionLoading}
                        >
                            Close
                        </button>
                        {selectedOrder && selectedOrder.foodStatusId === 11 && (
                            <button
                                className="bg-blue-600 text-white px-3 py-1 rounded flex items-center gap-2"
                                onClick={() => handleStartPreparing(selectedOrder.transactionId)}
                                disabled={actionLoading}
                            >
                                {actionLoading ? <Loader size={16} /> : 'Start Preparing'}
                            </button>
                        )}
                        {selectedOrder && selectedOrder.foodStatusId === 12 && (
                            <button
                                className="bg-green-600 text-white px-3 py-1 rounded flex items-center gap-2"
                                onClick={() => handleMarkReady(selectedOrder.transactionId)}
                                disabled={actionLoading}
                            >
                                {actionLoading ? <Loader size={16} /> : 'Mark Ready'}
                            </button>
                        )}
                        {selectedOrder && selectedOrder.foodStatusId === 13 && (
                            <button
                                className="bg-purple-600 text-white px-3 py-1 rounded flex items-center gap-2"
                                onClick={() => handleMarkServed(selectedOrder.transactionId)}
                                disabled={actionLoading}
                            >
                                {actionLoading ? <Loader size={16} /> : 'Mark Served'}
                            </button>
                        )}
                    </>
                }
            >
                {selectedOrder && (
                    <div className="space-y-4">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Status</p>
                            {getStatusBadge(selectedOrder.foodStatusId, selectedOrder.foodStatusName)}
                        </div>

                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Order Time</p>
                            <p className="font-semibold">{new Date(selectedOrder.orderTime).toLocaleString('en-US', {
                                timeZone: 'Asia/Beirut',
                                dateStyle: 'medium',
                                timeStyle: 'short'
                            })}</p>
                        </div>

                        {selectedOrder.tableName && (
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Table</p>
                                <p className="font-semibold">{selectedOrder.tableName}</p>
                            </div>
                        )}

                        {selectedOrder.customerName && (
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Customer</p>
                                <p className="font-semibold">{selectedOrder.customerName}</p>
                            </div>
                        )}

                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Items</p>
                            <div className="space-y-2">
                                {selectedOrder.items.map((item, idx) => (
                                    <div key={idx} className="flex justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                                        <div>
                                            <p className="font-medium">{item.itemName}</p>
                                            {item.categoryName && (
                                                <p className="text-xs text-gray-500">{item.categoryName}</p>
                                            )}
                                            {item.specialInstructions && (
                                                <p className="text-xs text-yellow-700 dark:text-yellow-400 font-medium italic mt-1">⚠ {item.specialInstructions}</p>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <p className="font-semibold">x{item.quantity}</p>
                                            {item.price !== null && item.price !== undefined && (
                                                <p className="text-sm text-gray-600">${item.price.toFixed(2)}</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {selectedOrder.comment && (
                            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                                <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-400 mb-1">Order Note:</p>
                                <p className="text-sm text-yellow-700 dark:text-yellow-300">{selectedOrder.comment}</p>
                            </div>
                        )}

                        {selectedOrder.totalAmount !== null && selectedOrder.totalAmount !== undefined && (
                            <div className="pt-3 border-t">
                                <div className="flex justify-between text-lg font-bold">
                                    <span>Total</span>
                                    <span>${selectedOrder.totalAmount.toFixed(2)}</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </>
    );
}
