import React, { useEffect, useState } from 'react';
import {
    getOpenFnbInvoices,
    addItemsToOpenInvoice,
    closeOpenInvoice,
    OpenInvoiceDto,
    ItemTransaction
} from '../../services/transactionService';
import { getItems, ItemDto, ItemListResponse } from '../../services/itemService';
import { getCategoriesByType, CategoryDto } from '../../services/categoryService';
import Loader from '../../components/ui/Loader';
import Modal from '../../components/ui/Modal';
import Input from '../../components/form/input/InputField';
import Select from '../../components/form/Select';
import Alert from '../../components/ui/alert/Alert';
import ItemInvoice from '../../components/invoice/ItemInvoice';

const OpenInvoices: React.FC = () => {
    // Open invoices state
    const [openInvoices, setOpenInvoices] = useState<OpenInvoiceDto[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Selected invoice for adding items
    const [selectedInvoice, setSelectedInvoice] = useState<OpenInvoiceDto | null>(null);

    // Items selection state
    const [items, setItems] = useState<ItemDto[]>([]);
    const [itemLookup, setItemLookup] = useState<Record<string, ItemDto>>({});
    const [categories, setCategories] = useState<CategoryDto[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [total, setTotal] = useState(0);
    const [loadingItems, setLoadingItems] = useState(false);

    // Selected items for adding to invoice
    const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});

    // Modal states
    const [isAddItemsModalOpen, setIsAddItemsModalOpen] = useState(false);
    const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
    const [currentInvoice, setCurrentInvoice] = useState<ItemTransaction | null>(null);

    // Submitting state
    const [submitting, setSubmitting] = useState(false);
    const [closingInvoiceId, setClosingInvoiceId] = useState<number | null>(null);

    // Notifications
    const [notification, setNotification] = useState<{
        variant: 'success' | 'error' | 'warning' | 'info';
        title: string;
        message: string;
    } | null>(null);

    // Auto-dismiss notifications
    useEffect(() => {
        if (!notification) return;
        const t = setTimeout(() => setNotification(null), 4000);
        return () => clearTimeout(t);
    }, [notification]);

    // Load open invoices
    const loadOpenInvoices = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await getOpenFnbInvoices();
            if (response.success) {
                setOpenInvoices(response.data || []);
            } else {
                setError(response.message || 'Failed to load open invoices');
            }
        } catch (err: unknown) {
            let message = 'Failed to load open invoices';
            if (err && typeof err === 'object') {
                const maybe = err as { message?: unknown };
                if (typeof maybe.message === 'string') message = maybe.message;
            }
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadOpenInvoices();
    }, []);

    // Load categories
    useEffect(() => {
        let mounted = true;
        getCategoriesByType('item', 1, 100)
            .then((res) => {
                if (!mounted) return;
                setCategories(res.data || []);
            })
            .catch(() => {
                /* ignore */
            });
        return () => {
            mounted = false;
        };
    }, []);

    // Load items when modal opens
    useEffect(() => {
        if (!isAddItemsModalOpen) return;
        let mounted = true;
        setLoadingItems(true);
        getItems(page, pageSize, selectedCategory, debouncedSearch)
            .then((data: ItemListResponse) => {
                if (!mounted) return;
                setItems(data.data || []);
                setTotal(data.totalCount || 0);
                // Merge into lookup
                setItemLookup((prev) => {
                    const next = { ...prev };
                    (data.data || []).forEach((it) => {
                        next[String(it.id)] = it;
                    });
                    return next;
                });
            })
            .catch((err) => {
                if (!mounted) return;
                console.error('Failed to load items:', err);
            })
            .finally(() => {
                if (!mounted) return;
                setLoadingItems(false);
            });

        return () => {
            mounted = false;
        };
    }, [isAddItemsModalOpen, page, pageSize, selectedCategory, debouncedSearch]);

    // Debounce search
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 300);
        return () => clearTimeout(t);
    }, [search]);

    // Handle close invoice
    // Handle close invoice - UPDATED

    // Handle close invoice - UPDATED WITH CORRECT PROPERTY NAMES
const handleCloseInvoice = async (invoiceId: number) => {
    if (!confirm(`Close invoice #${invoiceId} and mark as paid?`)) return;

    setClosingInvoiceId(invoiceId);
    try {
        const response = await closeOpenInvoice(invoiceId);
        if (response.success) {
            setNotification({
                variant: 'success',
                title: 'Invoice Closed',
                message: 'Invoice closed successfully',
            });

            // Convert response to ItemTransaction
            if (response.data) {
                const invoiceData: ItemTransaction = {
                    transactionId: response.data.id,
                    createdOn: response.data.createdOn,
                    statusId: response.data.statusId,
                    createdBy: response.data.createdBy,
                    totalPrice: response.data.totalPrice,
                    roomId: response.data.roomId,
                    roomName: response.data.room,        // backend sends "room" not "roomName"
                    setId: response.data.setId,
                    setName: response.data.set,          // backend sends "set" not "setName"
                    userId: response.data.userId,
                    userName: response.data.userName,
                    comment: response.data.comment,
                    discount: response.data.discountId ? {
                        name: response.data.discountName || '',
                        percentage: response.data.discountPercentage || 0
                    } : null,
                    items: response.data.items?.map((item: any) => ({
                        itemId: item.itemId,
                        itemName: item.itemName,
                        quantity: item.quantity,
                        unitPrice: item.price,
                        lineTotal: item.price * item.quantity,
                        categoryName: '',      // Not needed for receipt
                        itemType: item.type || '',
                    })) || []
                };

                setCurrentInvoice(invoiceData);
                setIsInvoiceModalOpen(true);
            }

            // Refresh list
            await loadOpenInvoices();
        } else {
            setNotification({
                variant: 'error',
                title: 'Failed',
                message: response.message || 'Failed to close invoice',
            });
        }
    } catch (err: unknown) {
        let message = 'Failed to close invoice';
        if (err && typeof err === 'object') {
            const maybe = err as { message?: unknown };
            if (typeof maybe.message === 'string') message = maybe.message;
        }
        setNotification({
            variant: 'error',
            title: 'Error',
            message,
        });
    } finally {
        setClosingInvoiceId(null);
    }
};

    // Handle add items to invoice
    const handleAddItems = async () => {
        if (!selectedInvoice) return;

        const orderItems = Object.entries(selectedItems)
            .filter(([, q]) => q > 0)
            .map(([itemId, q]) => ({
                itemId: parseInt(itemId), // keep as string
                quantity: q,
            }));

        if (orderItems.length === 0) {
            setNotification({
                variant: 'warning',
                title: 'No Items',
                message: 'Please select at least one item',
            });
            return;
        }

        setSubmitting(true);
        try {
            const response = await addItemsToOpenInvoice(
                selectedInvoice.id,
                orderItems
            );

            if (response.success) {
                setNotification({
                    variant: 'success',
                    title: 'Items Added',
                    message: `Items added to invoice #${selectedInvoice.id}`,
                });

                // Reset and close modal
                setSelectedItems({});
                setSelectedInvoice(null);
                setIsAddItemsModalOpen(false);
                setPage(1);
                setSearch('');
                setSelectedCategory(null);

                // Refresh invoices
                await loadOpenInvoices();
            } else {
                setNotification({
                    variant: 'error',
                    title: 'Failed',
                    message: response.message || 'Failed to add items',
                });
            }
        } catch (err: unknown) {
            let message = 'Failed to add items';
            if (err && typeof err === 'object') {
                const maybe = err as { message?: unknown };
                if (typeof maybe.message === 'string') message = maybe.message;
            }
            setNotification({
                variant: 'error',
                title: 'Error',
                message,
            });
        } finally {
            setSubmitting(false);
        }
    };

    // Resolve image URL
    function resolveImageUrl(path?: string | null) {
        if (!path) return '';
        try {
            const url = new URL(path);
            return url.toString();
        } catch {
            const base = (import.meta.env.VITE_API_IMAGE_BASE_URL as string) || '';
            if (base) return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
            return path;
        }
    }

    // Calculate selected items total for display
    const selectedItemsTotal = Object.entries(selectedItems)
        .filter(([, q]) => q > 0)
        .reduce((sum, [itemId, qty]) => {
            const item = itemLookup[String(itemId)];
            if (!item) return sum;
            return sum + item.price * qty;
        }, 0);

    const selectedItemsCount = Object.values(selectedItems).reduce(
        (s, v) => s + (v || 0),
        0
    );

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-semibold">Open Invoices</h1>
                <button
                    onClick={loadOpenInvoices}
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                    </svg>
                    Refresh
                </button>
            </div>

            {loading && (
                <div className="flex items-center justify-center py-20">
                    <Loader />
                </div>
            )}

            {error && !loading && (
                <div className="text-red-600 bg-red-50 p-4 rounded-lg border border-red-200">
                    {error}
                </div>
            )}

            {!loading && !error && openInvoices.length === 0 && (
                <div className="text-center py-20 text-gray-500">
                    <svg
                        className="w-16 h-16 mx-auto mb-4 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                    </svg>
                    <p className="text-lg font-medium">No open invoices</p>
                    <p className="text-sm mt-1">All invoices have been closed</p>
                </div>
            )}

            {!loading && !error && openInvoices.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {openInvoices.map((invoice) => (
                        <div
                            key={invoice.id}
                            className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border border-orange-200 hover:border-orange-400"
                        >
                            <div className="bg-gradient-to-r from-orange-600 to-orange-700 p-4 text-white">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-semibold">Invoice #{invoice.id}</h3>
                                    <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-medium">
                                        OPEN
                                    </span>
                                </div>
                            </div>

                            <div className="p-4 space-y-3">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-600">Created:</span>
                                    <span className="font-medium text-gray-900">
                                        {new Date(invoice.createdOn).toLocaleDateString()}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-600">Time:</span>
                                    <span className="font-medium text-gray-900">
                                        {new Date(invoice.createdOn).toLocaleTimeString()}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-600">Created By:</span>
                                    <span
                                        className="font-medium text-gray-900 text-xs truncate max-w-[150px]"
                                        title={invoice.createdBy}
                                    >
                                        {invoice.createdBy}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-600">Items:</span>
                                    <span className="font-medium text-gray-900">
                                        {invoice.items?.length || 0}
                                    </span>
                                </div>

                                {invoice.discountName && (
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-600">Discount:</span>
                                        <span className="font-medium text-green-600">
                                            {invoice.discountName}
                                        </span>
                                    </div>
                                )}

                                {/* Items Preview */}
                                <div className="border-t border-gray-200 pt-3">
                                    <p className="text-xs font-medium text-gray-600 mb-2">
                                        Items in Invoice:
                                    </p>
                                    <div className="space-y-1 max-h-32 overflow-y-auto">
                                        {invoice.items?.map((item) => (
                                            <div
                                                key={item.itemId}
                                                className="flex justify-between text-xs"
                                            >
                                                <span className="text-gray-700 truncate max-w-[150px]">
                                                    {item.itemName}
                                                </span>
                                                <span className="text-gray-600">
                                                    {item.quantity} × ${item.price.toFixed(2)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-200">
                                    <span className="text-gray-600">Total:</span>
                                    <span className="font-bold text-lg text-orange-600">
                                        ${invoice.totalPrice.toFixed(2)}
                                    </span>
                                </div>

                                <div className="flex gap-2 mt-4">
                                    <button
                                        onClick={() => {
                                            setSelectedInvoice(invoice);
                                            setIsAddItemsModalOpen(true);
                                        }}
                                        className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all duration-300 flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                                    >
                                        <svg
                                            className="w-4 h-4"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                                            />
                                        </svg>
                                        Add Items
                                    </button>
                                    <button
                                        onClick={() => handleCloseInvoice(invoice.id)}
                                        disabled={closingInvoiceId === invoice.id}
                                        className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                                    >
                                        {closingInvoiceId === invoice.id ? (
                                            <>
                                                <Loader size={16} />
                                                Closing...
                                            </>
                                        ) : (
                                            <>
                                                <svg
                                                    className="w-4 h-4"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                                    />
                                                </svg>
                                                Close & Pay
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add Items Modal */}
            <Modal
                isOpen={isAddItemsModalOpen}
                onClose={() => {
                    setIsAddItemsModalOpen(false);
                    setSelectedInvoice(null);
                    setSelectedItems({});
                    setPage(1);
                    setSearch('');
                    setSelectedCategory(null);
                }}
                title={`Add Items to Invoice #${selectedInvoice?.id || ''}`}
            >
                <div className="space-y-4">
                    {/* Filters */}
                    <div className="flex items-center gap-3">
                        <div className="flex-1">
                            <label className="text-sm text-gray-600 mb-1 block">Category</label>
                            <Select
                                options={[
                                    { value: '', label: 'All Categories' },
                                    ...categories.map((c) => ({ value: c.id, label: c.name })),
                                ]}
                                defaultValue={selectedCategory ?? ''}
                                onChange={(v: string | number) => {
                                    setPage(1);
                                    setSelectedCategory(v === '' ? null : Number(v));
                                }}
                            />
                        </div>
                        <div className="flex-1">
                            <label className="text-sm text-gray-600 mb-1 block">Search</label>
                            <Input
                                placeholder="Search items..."
                                value={search}
                                onChange={(e) => {
                                    setPage(1);
                                    setSearch(e.target.value);
                                }}
                            />
                        </div>
                    </div>

                    {/* Selected Items Summary */}
                    {selectedItemsCount > 0 && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-blue-800">
                                        {selectedItemsCount} item(s) selected
                                    </p>
                                    <p className="text-xs text-blue-600">
                                        Subtotal: ${selectedItemsTotal.toFixed(2)}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setSelectedItems({})}
                                    className="text-sm text-blue-600 hover:text-blue-800"
                                >
                                    Clear All
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Items Grid */}
                    {loadingItems && (
                        <div className="flex items-center justify-center py-10">
                            <Loader />
                        </div>
                    )}

                    {!loadingItems && items.length === 0 && (
                        <div className="text-center py-10 text-gray-500">
                            <p>No items found</p>
                        </div>
                    )}

                    {!loadingItems && items.length > 0 && (
                        <>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
                                {items.map((item) => {
                                    const isOutOfStock = item.quantity <= 0;
                                    const selected = selectedItems[String(item.id)] || 0;
                                    return (
                                        <div
                                            key={item.id}
                                            className={`border rounded p-3 bg-white ${
                                                isOutOfStock
                                                    ? 'opacity-60 border-gray-200'
                                                    : selected > 0
                                                    ? 'border-blue-500 ring-2 ring-blue-100'
                                                    : 'border-gray-200'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2 mb-2">
                                                <img
                                                    src={
                                                        item.imagePath
                                                            ? resolveImageUrl(item.imagePath)
                                                            : '/images/image-placeholder.svg'
                                                    }
                                                    alt={item.name}
                                                    className="w-12 h-12 object-cover rounded"
                                                    onError={(e) => {
                                                        (e.currentTarget as HTMLImageElement).src =
                                                            '/images/image-placeholder.svg';
                                                    }}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium text-sm text-gray-800 truncate">
                                                        {item.name}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        ${item.price}
                                                    </div>
                                                </div>
                                            </div>
                                            <div
                                                className={`text-xs mb-2 ${
                                                    isOutOfStock
                                                        ? 'text-red-600 font-medium'
                                                        : 'text-gray-500'
                                                }`}
                                            >
                                                Stock: {item.quantity}{' '}
                                                {isOutOfStock && '(Out)'}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    className="px-2 py-1 bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                                    disabled={isOutOfStock}
                                                    onClick={() =>
                                                        setSelectedItems((s) => {
                                                            const key = String(item.id);
                                                            const cur = s[key] || 0;
                                                            const next = Math.max(0, cur - 1);
                                                            const copy = { ...s };
                                                            if (next === 0) delete copy[key];
                                                            else copy[key] = next;
                                                            return copy;
                                                        })
                                                    }
                                                >
                                                    -
                                                </button>
                                                <div className="px-3 py-1 border rounded text-sm min-w-[40px] text-center">
                                                    {selected}
                                                </div>
                                                <button
                                                    className="px-2 py-1 bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                                    disabled={isOutOfStock}
                                                    onClick={() =>
                                                        setSelectedItems((s) => {
                                                            const key = String(item.id);
                                                            const cur = s[key] || 0;
                                                            return { ...s, [key]: cur + 1 };
                                                        })
                                                    }
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Pagination */}
                            <div className="flex items-center justify-between pt-3 border-t">
                                <div className="text-sm text-gray-600">
                                    Page {page} — {total} items
                                </div>
                                <div className="space-x-2">
                                    <button
                                        className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50 text-sm"
                                        disabled={page <= 1}
                                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    >
                                        Prev
                                    </button>
                                    <button
                                        className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50 text-sm"
                                        disabled={page >= Math.max(1, Math.ceil(total / pageSize))}
                                        onClick={() => setPage((p) => p + 1)}
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 pt-4 border-t">
                        <button
                            className="flex-1 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 transition"
                            onClick={() => {
                                setIsAddItemsModalOpen(false);
                                setSelectedInvoice(null);
                                setSelectedItems({});
                                setPage(1);
                                setSearch('');
                                setSelectedCategory(null);
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            disabled={submitting || selectedItemsCount === 0}
                            onClick={handleAddItems}
                        >
                            {submitting ? (
                                <>
                                    <Loader size={16} />
                                    Adding...
                                </>
                            ) : (
                                'Add to Invoice'
                            )}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Invoice Modal */}
            <Modal
                isOpen={isInvoiceModalOpen}
                onClose={() => {
                    setIsInvoiceModalOpen(false);
                    setCurrentInvoice(null);
                }}
                title="Invoice"
            >
                <div className="max-h-[80vh] overflow-y-auto">
                    {currentInvoice && <ItemInvoice transaction={currentInvoice} />}
                </div>
            </Modal>

            {/* Toast Notifications */}
            <div className="fixed bottom-6 right-6 z-50">
                {notification && (
                    <div className="max-w-sm">
                        <Alert
                            variant={notification.variant}
                            title={notification.title}
                            message={notification.message}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default OpenInvoices;