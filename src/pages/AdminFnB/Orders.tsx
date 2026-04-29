import React, { useEffect, useState, useCallback } from "react";
import { getItemTransactions, ItemTransaction, updateTransaction, deleteTransaction, TransactionUpdateDto } from '../../services/transactionService';
import { getStatusName, STATUS_PROCESSED_PAID } from '../../services/statuses';
import Loader from '../../components/ui/Loader';
import Modal from '../../components/ui/Modal';
import Label from '../../components/form/Label';
import Input from '../../components/form/input/InputField';
import Select from '../../components/form/Select';

const Orders: React.FC = () => {
    const [itemOrders, setItemOrders] = useState<ItemTransaction[]>([]);
    const [loadingItems, setLoadingItems] = useState(false);
    const [itemPage, setItemPage] = useState(1);
    const [pageSize] = useState(10);
    const [itemTotal, setItemTotal] = useState(0);

    // Edit modal states
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<ItemTransaction | null>(null);
    const [editData, setEditData] = useState<TransactionUpdateDto>({});
    const [saving, setSaving] = useState(false);

    // Delete modal states
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deletingTransaction, setDeletingTransaction] = useState<number | null>(null);
    const [deleting, setDeleting] = useState(false);

    const [message, setMessage] = useState<string | null>(null);

    // Load item transactions
    const loadItemTransactions = useCallback(() => {
        setLoadingItems(true);
        getItemTransactions({ Page: itemPage, PageSize: pageSize })
            .then((res) => {
                setItemOrders(res.data || []);
                setItemTotal(res.totalCount);
            })
            .catch(() => { /* ignore */ })
            .finally(() => setLoadingItems(false));
    }, [itemPage, pageSize]);

    useEffect(() => {
        loadItemTransactions();
    }, [loadItemTransactions]);

    const handleEdit = (transaction: ItemTransaction) => {
        setEditingTransaction(transaction);
        setEditData({
            statusId: transaction.statusId,
            totalPrice: transaction.totalPrice,
        });
        setMessage(null);
        setEditModalOpen(true);
    };

    const handleSaveEdit = async () => {
        if (!editingTransaction) return;
        setSaving(true);
        setMessage(null);
        try {
            await updateTransaction(editingTransaction.transactionId, editData);
            setMessage('Transaction updated successfully');
            setEditModalOpen(false);
            setEditingTransaction(null);
            // Reload list
            loadItemTransactions();
        } catch (err: unknown) {
            console.error(err);
            let msg = 'Failed to update transaction';
            if (err instanceof Error) msg = err.message;
            else msg = String(err);
            setMessage(msg);
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
            setMessage('Transaction deleted successfully');
            setDeleteModalOpen(false);
            setDeletingTransaction(null);
            // Reload list
            loadItemTransactions();
        } catch (err: unknown) {
            console.error(err);
            let msg = 'Failed to delete transaction';
            if (err instanceof Error) msg = err.message;
            else msg = String(err);
            setMessage(msg);
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="p-6">
            <h1 className="text-2xl font-semibold mb-6">Food & Beverage Orders Management</h1>

            {message && (
                <div className="mb-4 p-3 bg-blue-100 text-blue-800 rounded">
                    {message}
                </div>
            )}

            {/* Item Transactions Section */}
            <div className="mb-10">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold">Coffee Shop Orders</h2>
                    <span className="text-sm text-gray-600">Total: {itemTotal}</span>
                </div>

                {loadingItems && (
                    <div className="flex justify-center py-10">
                        <Loader />
                    </div>
                )}

                {!loadingItems && itemOrders.length === 0 && (
                    <div className="text-sm text-gray-500 text-center py-10">No coffee shop orders found.</div>
                )}

                {!loadingItems && itemOrders.length > 0 && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-12 gap-2 font-medium text-sm border-b pb-2">
                            <div className="col-span-2">Date/Time</div>
                            <div className="col-span-2">Cashier</div>
                            <div className="col-span-3">Items</div>
                            <div className="col-span-1">Total</div>
                            <div className="col-span-2">Status</div>
                            <div className="col-span-2">Actions</div>
                        </div>
                        {itemOrders.map((o, idx) => (
                            <div key={`${o.transactionId}-${idx}`} className="grid grid-cols-12 gap-2 items-center p-3 bg-white border rounded hover:shadow-md transition">
                                <div className="col-span-2">
                                    <div className="font-medium text-sm">
                                        {new Date(o.createdOn).toLocaleDateString()}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        {new Date(o.createdOn).toLocaleTimeString()}
                                    </div>
                                </div>
                                <div className="col-span-2 text-sm">
                                    <div className="font-medium">{o.createdBy}</div>
                                    {o.roomName && <div className="text-xs text-gray-500">{o.roomName}</div>}
                                </div>
                                <div className="col-span-3 text-sm">
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
                                <div className="col-span-1 text-sm font-semibold">${o.totalPrice.toFixed(2)}</div>
                                <div className="col-span-2 text-sm">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${o.statusId === 1 ? 'bg-green-100 text-green-800' :
                                        o.statusId === STATUS_PROCESSED_PAID ? 'bg-green-100 text-green-800' :
                                            'bg-gray-100 text-gray-800'
                                        }`}>
                                        {getStatusName(o.statusId) ?? o.statusId}
                                    </span>
                                </div>
                                <div className="col-span-2 text-sm">
                                    <div className="flex items-center gap-2">
                                        <button className="text-blue-600 hover:text-blue-800 text-xs" onClick={() => handleEdit(o)}>Edit</button>
                                        <button className="text-red-600 hover:text-red-800 text-xs" onClick={() => handleDeleteClick(o.transactionId)}>Delete</button>
                                    </div>
                                </div>
                            </div>
                        ))}

                        <div className="flex items-center justify-between">
                            <div className="text-sm text-gray-600">Page {itemPage} — {itemTotal} orders</div>
                            <div className="space-x-2">
                                <button className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50" disabled={itemPage <= 1} onClick={() => setItemPage(p => Math.max(1, p - 1))}>Prev</button>
                                <button className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50" disabled={itemPage >= Math.max(1, Math.ceil(itemTotal / pageSize))} onClick={() => setItemPage(p => p + 1)}>Next</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            <Modal
                isOpen={editModalOpen}
                onClose={() => {
                    setEditModalOpen(false);
                    setEditingTransaction(null);
                    setMessage(null);
                }}
                title="Edit Transaction"
                footer={(
                    <>
                        <button
                            className="bg-gray-200 text-gray-800 px-3 py-1 rounded"
                            onClick={() => {
                                setEditModalOpen(false);
                                setEditingTransaction(null);
                                setMessage(null);
                            }}
                            disabled={saving}
                        >
                            Cancel
                        </button>
                        <button
                            className="bg-blue-600 text-white px-3 py-1 rounded"
                            onClick={handleSaveEdit}
                            disabled={saving}
                        >
                            {saving ? 'Saving...' : 'Save'}
                        </button>
                    </>
                )}
            >
                <div className="space-y-4">
                    <div>
                        <Label>Status</Label>
                        <Select
                            options={[
                                { value: 1, label: 'Pending' },
                                { value: STATUS_PROCESSED_PAID, label: 'Processed/Paid' },
                                { value: 2, label: 'Cancelled' },
                            ]}
                            defaultValue={editData.statusId ?? 1}
                            onChange={(v: string | number) => setEditData({ ...editData, statusId: Number(v) })}
                        />
                    </div>
                    <div>
                        <Label htmlFor="totalPrice">Total Price</Label>
                        <Input
                            id="totalPrice"
                            type="number"
                            value={editData.totalPrice ?? ''}
                            onChange={(e) => setEditData({ ...editData, totalPrice: parseFloat(e.target.value) })}
                        />
                    </div>
                </div>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={deleteModalOpen}
                onClose={() => {
                    setDeleteModalOpen(false);
                    setDeletingTransaction(null);
                }}
                title="Confirm Delete"
                footer={(
                    <>
                        <button
                            className="bg-gray-200 text-gray-800 px-3 py-1 rounded"
                            onClick={() => {
                                setDeleteModalOpen(false);
                                setDeletingTransaction(null);
                            }}
                            disabled={deleting}
                        >
                            Cancel
                        </button>
                        <button
                            className="bg-red-600 text-white px-3 py-1 rounded flex items-center gap-2"
                            onClick={handleDeleteConfirm}
                            disabled={deleting}
                        >
                            {deleting ? <Loader size={16} /> : 'Delete'}
                        </button>
                    </>
                )}
            >
                <div>
                    <p>Are you sure you want to delete this transaction? This action cannot be undone.</p>
                </div>
            </Modal>
        </div>
    );
};

export default Orders;
