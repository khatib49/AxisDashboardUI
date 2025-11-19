import { useEffect, useState } from "react";
import {
    getItems,
    createItem,
    updateItem,
    deleteItem,
    ItemDto,
    ItemListResponse,
} from "../../services/itemService";
import { createCoffeeShopOrder, OrderItemRequest, getItemTransactions, ItemTransaction } from '../../services/transactionService';
import { useAuth } from '../../context/AuthContext';
import Modal from "../../components/ui/Modal";
import Input from "../../components/form/input/InputField";
import Loader from "../../components/ui/Loader";
import Alert from "../../components/ui/alert/Alert";
import { getCategoriesByType, CategoryDto } from "../../services/categoryService";
import StatusToggle from '../../components/ui/StatusToggle';
import { STATUS_ENABLED, getStatusName, STATUS_PROCESSED_PAID } from '../../services/statuses';
import Select from "../../components/form/Select";
import ItemInvoice from "../../components/invoice/ItemInvoice";
import { getDiscounts, DiscountDto } from "../../services/discountService";
import { searchClientsByPhone, ClientUserDto } from "../../services/clientService";

export default function CashierItems() {
    const [items, setItems] = useState<ItemDto[]>([]);
    // Cache of items by id to persist details across category/page switches
    const [itemLookup, setItemLookup] = useState<Record<string, ItemDto>>({});
    const [categories, setCategories] = useState<CategoryDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [total, setTotal] = useState(0);
    const [itemsReloadToken, setItemsReloadToken] = useState(0);
    const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editing, setEditing] = useState<ItemDto | null>(null);
    const [form, setForm] = useState<Omit<ItemDto, "id">>({
        name: "",
        quantity: 0,
        price: 0,
        type: "",
        categoryId: null,
        gameId: null,
        statusId: STATUS_ENABLED,
    });
    const [submitting, setSubmitting] = useState(false);

    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [orderSubmitting, setOrderSubmitting] = useState(false);
    const [orderTimestamp, setOrderTimestamp] = useState<Date | null>(null);

    // Invoice states
    const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
    const [currentInvoice, setCurrentInvoice] = useState<ItemTransaction | null>(null);
    const [userInvoices, setUserInvoices] = useState<ItemTransaction[]>([]);
    const [loadingInvoices, setLoadingInvoices] = useState(false);
    const [showInvoicesSection, setShowInvoicesSection] = useState(false);
    const [totalInvoices, setTotalInvoices] = useState<number>(0);
    const [dateFilter, setDateFilter] = useState<'today' | 'yesterday'>('today');

    // Discount states
    const [discounts, setDiscounts] = useState<DiscountDto[]>([]);
    const [loadingDiscounts, setLoadingDiscounts] = useState(false);
    const [selectedDiscountId, setSelectedDiscountId] = useState<number | null>(null);

    // Client search states
    const [clientPhone, setClientPhone] = useState('');
    const [searchingClient, setSearchingClient] = useState(false);
    const [clientResults, setClientResults] = useState<ClientUserDto[]>([]);
    const [selectedClient, setSelectedClient] = useState<ClientUserDto | null>(null);

    const auth = useAuth();

    const [notification, setNotification] = useState<{
        variant: "success" | "error" | "warning" | "info";
        title: string;
        message: string;
    } | null>(null);

    useEffect(() => {
        if (!notification) return;
        const t = setTimeout(() => setNotification(null), 4000);
        return () => clearTimeout(t);
    }, [notification]);

    useEffect(() => {
        let mounted = true;
        setLoading(true);
        getItems(page, pageSize, selectedCategory, debouncedSearch)
            .then((data: ItemListResponse) => {
                if (!mounted) return;
                setItems(data.data || []);
                setTotal(data.totalCount || 0);
                // Merge fetched items into lookup cache
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
                setError(err?.message || "Failed to load items");
            })
            .finally(() => {
                if (!mounted) return;
                setLoading(false);
            });

        return () => {
            mounted = false;
        };
    }, [page, pageSize, selectedCategory, debouncedSearch, itemsReloadToken]);

    // Debounce search input (300ms)
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 300);
        return () => clearTimeout(t);
    }, [search]);

    useEffect(() => {
        let mounted = true;
        // load categories only for items (not games)
        getCategoriesByType('item', 1, 100)
            .then((res) => {
                if (!mounted) return;
                setCategories(res.data || []);
            })
            .catch(() => {
                /* ignore */
            });
        return () => { mounted = false; };
    }, []);

    // Load active discounts when drawer opens
    useEffect(() => {
        if (!isDrawerOpen) return;
        let mounted = true;
        setLoadingDiscounts(true);
        getDiscounts(1, 100)
            .then((res) => {
                if (!mounted) return;
                // Filter only active discounts
                const activeDiscounts = (res.data || []).filter(d => d.isActive);
                setDiscounts(activeDiscounts);
            })
            .catch(() => {
                /* ignore */
            })
            .finally(() => {
                if (mounted) setLoadingDiscounts(false);
            });
        return () => { mounted = false; };
    }, [isDrawerOpen]);

    // Load user's item invoices
    useEffect(() => {
        if (!showInvoicesSection || !auth?.claims?.name) return;
        let mounted = true;
        setLoadingInvoices(true);

        // Calculate date range based on filter
        let fromDate: string | undefined;
        let toDate: string | undefined;
        const now = new Date();

        switch (dateFilter) {
            case 'today': {
                const today = new Date();
                fromDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0, 0)).toISOString();
                toDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)).toISOString();
                break;
            }
            case 'yesterday': {
                const yesterday = new Date(now);
                yesterday.setDate(yesterday.getDate() - 1);
                fromDate = new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate(), 0, 0, 0, 0)).toISOString();
                toDate = new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate(), 23, 59, 59, 999)).toISOString();
                break;
            }
            default:
                fromDate = undefined;
                toDate = undefined;
                break;
        }

        getItemTransactions({
            CreatedBy: [auth.claims.name],
            PageSize: 50,
            From: fromDate,
            To: toDate,
        })
            .then((res) => {
                if (!mounted) return;
                setUserInvoices(res.data || []);
                setTotalInvoices(res.totalInvoices || 0);
            })
            .catch(() => { /* ignore */ })
            .finally(() => { if (mounted) setLoadingInvoices(false); });
        return () => { mounted = false; };
    }, [showInvoicesSection, auth?.claims?.name, dateFilter]);

    // total selected items count (used to show View Order button)
    const totalSelected = Object.values(selectedItems).reduce((s, v) => s + (v || 0), 0);

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

    // build order lines from selectedItems and items list (coerce to numbers)
    const orderLines = Object.entries(selectedItems)
        .filter(([, q]) => Number(q) > 0)
        .map(([itemId, q]) => {
            // Use cached lookup so items from other categories/pages are resolved
            const item = itemLookup[String(itemId)];
            const qty = Number(q) || 0;
            const unit = item && item.price != null ? Number(item.price) : 0;
            const name = item ? item.name : String(itemId);
            const lineTotal = unit * qty;
            const image = item?.imagePath ? resolveImageUrl(item.imagePath) : '';
            return { itemId, name, qty, unit, lineTotal, image };
        });

    const orderSubtotal = orderLines.reduce((s, l) => s + l.lineTotal, 0);

    // Calculate discount amount
    const selectedDiscount = discounts.find(d => d.id === selectedDiscountId);
    const discountAmount = selectedDiscount ? (orderSubtotal * selectedDiscount.percentage) / 100 : 0;
    const orderTotal = orderSubtotal - discountAmount;

    // Creation UI is intentionally not exposed to cashiers in the header.

    // Editing is intentionally not exposed in cashier view.

    async function submitForm() {
        setSubmitting(true);
        try {
            if (editing) {
                await updateItem(editing.id, form);
                setItems((s) => s.map((it) => (it.id === editing.id ? { ...it, ...form } : it)));
                setNotification({ variant: "success", title: "Updated", message: "Item updated" });
            } else {
                const created = await createItem(form);
                setItems((s) => [created, ...s]);
                setNotification({ variant: "success", title: "Created", message: `Item '${created.name}' created` });
            }
            setIsFormOpen(false);
            setEditing(null);
        } catch (err: unknown) {
            let message = "Failed to save";
            if (err && typeof err === "object") {
                const maybe = err as { message?: unknown };
                if (typeof maybe.message === "string") message = maybe.message;
            }
            setError(message);
            setNotification({ variant: "error", title: "Save failed", message });
        } finally {
            setSubmitting(false);
        }
    }

    async function handleClientSearch() {
        if (!clientPhone.trim()) {
            setClientResults([]);
            return;
        }
        setSearchingClient(true);
        try {
            const results = await searchClientsByPhone(clientPhone);
            setClientResults(results || []);
            if (results.length === 0) {
                setNotification({
                    variant: "info",
                    title: "No Results",
                    message: "No clients found with that phone number"
                });
            }
        } catch (err: unknown) {
            let message = "Failed to search clients";
            if (err && typeof err === "object") {
                const maybe = err as { message?: unknown };
                if (typeof maybe.message === "string") message = maybe.message;
            }
            setNotification({ variant: "error", title: "Search failed", message });
        } finally {
            setSearchingClient(false);
        }
    }

    return (
        <div className="p-6">
            <h1 className="text-2xl font-semibold mb-4">Items (Cashier)</h1>

            <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex items-center">
                        <label className="text-sm text-gray-600 mr-2">Category</label>
                        <div className="w-48">
                            <Select
                                options={[{ value: '', label: 'All' }, ...categories.map(c => ({ value: c.id, label: c.name }))]}
                                defaultValue={selectedCategory ?? ''}
                                onChange={(v: string | number) => { setPage(1); setSelectedCategory(v === '' ? null : Number(v)); }}
                            />
                        </div>
                    </div>
                    <div className="flex items-center">
                        <label className="text-sm text-gray-600 mr-2">Search</label>
                        <div className="w-56">
                            <Input placeholder="Search items..." value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} className="px-2 py-1" />
                        </div>
                    </div>
                </div>

                <div>
                    {totalSelected > 0 && (
                        <div className="flex items-center gap-2">
                            <button
                                className="px-4 py-2 bg-orange-600 text-white rounded shadow hover:bg-orange-700 transition flex items-center gap-2"
                                onClick={() => setSelectedItems({})}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Reset
                            </button>
                            <button
                                className="px-4 py-2 bg-indigo-600 text-white rounded shadow hover:bg-indigo-700 transition"
                                onClick={() => { setOrderTimestamp(new Date()); setIsDrawerOpen(true); }}
                            >
                                View Order
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {loading && <div className="text-gray-600">Loading items...</div>}

            {error && <div className="text-red-600 bg-red-50 p-3 rounded">{error}</div>}

            {!loading && !error && (
                <div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {items.map(it => {
                            const isOutOfStock = it.quantity <= 0;
                            return (
                                <div key={it.id} className={`border rounded p-3 bg-white shadow-sm ${isOutOfStock ? 'opacity-60 border-gray-200' : (selectedItems[it.id] || 0) > 0 ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-gray-200'}`}>
                                    <div className="flex items-center gap-3 mb-2">
                                        <img
                                            src={it.imagePath ? resolveImageUrl(it.imagePath) : '/images/image-placeholder.svg'}
                                            alt={it.name}
                                            className="w-16 h-12 object-cover rounded"
                                            onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/images/image-placeholder.svg'; }}
                                        />
                                        <div className="font-medium text-gray-800">{it.name}</div>
                                    </div>
                                    <div className="text-sm text-gray-500">Category: {categories.find(c => c.id === it.categoryId)?.name ?? '-'}</div>
                                    <div className="text-sm text-gray-500">Price: ${it.price}</div>
                                    <div className={`text-sm ${isOutOfStock ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                                        Stock: {it.quantity} {isOutOfStock && '(Out of Stock)'}
                                    </div>
                                    <div className="mt-3 flex items-center gap-2">
                                        <button
                                            className="px-2 py-1 bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                            disabled={isOutOfStock}
                                            onClick={() => setSelectedItems(s => {
                                                const key = String(it.id);
                                                const cur = s[key] || 0;
                                                const next = Math.max(0, cur - 1);
                                                const copy = { ...s };
                                                if (next === 0) delete copy[key]; else copy[key] = next;
                                                return copy;
                                            })}
                                        >-</button>
                                        <div className="px-3 py-1 border rounded">{selectedItems[String(it.id)] || 0}</div>
                                        <button
                                            className="px-2 py-1 bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                            disabled={isOutOfStock}
                                            onClick={() => setSelectedItems(s => {
                                                const key = String(it.id);
                                                const cur = s[key] || 0;
                                                return { ...s, [key]: cur + 1 };
                                            })}
                                        >+</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-4 flex items-start justify-between">
                        <div>
                            <div className="text-sm text-gray-600">Showing page {page} — {total} items</div>
                            <div className="mt-2 space-x-2">
                                <button className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Prev</button>
                                <button className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50" disabled={page >= Math.max(1, Math.ceil(total / pageSize))} onClick={() => setPage(p => p + 1)}>Next</button>
                            </div>
                        </div>

                        <div>
                            {/* Drawer backdrop (fades) */}
                            <div className={`fixed inset-0 z-30 transition-opacity ${isDrawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} aria-hidden>
                                <div className="absolute inset-0 bg-black/40" onClick={() => setIsDrawerOpen(false)} />
                            </div>

                            {/* Sliding panel: offset from top to avoid overlapping navbar (adjust 64px if your header height differs) */}
                            <div
                                className="fixed right-0 z-40"
                                style={{
                                    top: '64px',
                                    height: 'calc(100% - 64px)',
                                    width: '320px',
                                    transition: 'transform 300ms ease',
                                    transform: isDrawerOpen ? 'translateX(0)' : 'translateX(100%)',
                                }}
                            >
                                <div className="h-full bg-white shadow-xl p-4 overflow-y-auto">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-medium">Order Summary</h3>
                                        <button className="text-gray-500" onClick={() => setIsDrawerOpen(false)}>Close</button>
                                    </div>
                                    <div className="mt-4">
                                        <div className="text-sm text-gray-700">Date: {orderTimestamp ? orderTimestamp.toLocaleDateString() : ''} {orderTimestamp ? orderTimestamp.toLocaleTimeString() : ''}</div>

                                        {/* Discount Selection */}
                                        <div className="mt-3">
                                            <label className="text-sm font-medium text-gray-700 mb-1 block">Apply Discount</label>
                                            {loadingDiscounts ? (
                                                <div className="text-xs text-gray-500">Loading discounts...</div>
                                            ) : (
                                                <Select
                                                    options={[
                                                        { value: '', label: 'No Discount' },
                                                        ...discounts.map(d => ({
                                                            value: d.id,
                                                            label: `${d.name} (${d.percentage}% off)`
                                                        }))
                                                    ]}
                                                    defaultValue={selectedDiscountId ?? ''}
                                                    onChange={(v: string | number) => setSelectedDiscountId(v === '' ? null : Number(v))}
                                                />
                                            )}
                                        </div>

                                        {/* Client Selection */}
                                        <div className="mt-3">
                                            <label className="text-sm font-medium text-gray-700 mb-1 block">Client (Optional)</label>
                                            <div className="flex gap-2">
                                                <Input
                                                    placeholder="Search by phone..."
                                                    value={clientPhone}
                                                    onChange={(e) => setClientPhone(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            handleClientSearch();
                                                        }
                                                    }}
                                                    className="flex-1"
                                                />
                                                <button
                                                    className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 transition text-sm"
                                                    onClick={handleClientSearch}
                                                    disabled={searchingClient}
                                                >
                                                    {searchingClient ? <Loader size={14} /> : 'Search'}
                                                </button>
                                            </div>
                                            {clientResults.length > 0 && (
                                                <Select
                                                    options={[
                                                        { value: '', label: 'Select client...' },
                                                        ...clientResults.map(c => ({
                                                            value: c.id,
                                                            label: `${c.firstName} ${c.lastName} (${c.phoneNumber})`
                                                        }))
                                                    ]}
                                                    defaultValue={selectedClient?.id ?? ''}
                                                    onChange={(v: string | number) => {
                                                        const client = clientResults.find(c => c.id === Number(v));
                                                        setSelectedClient(client || null);
                                                    }}
                                                    className="mt-2"
                                                />
                                            )}
                                            {selectedClient && (
                                                <div className="mt-2 text-xs bg-blue-50 text-blue-700 p-2 rounded flex items-center justify-between">
                                                    <span>Selected: {selectedClient.firstName} {selectedClient.lastName}</span>
                                                    <button
                                                        onClick={() => {
                                                            setSelectedClient(null);
                                                            setClientResults([]);
                                                            setClientPhone('');
                                                        }}
                                                        className="text-blue-600 hover:text-blue-800"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        <div className="mt-3 bg-gray-50 border p-2 rounded">
                                            <div className="text-sm font-medium border-b pb-2 mb-2">Receipt</div>
                                            <div className="space-y-2">
                                                {orderLines.length === 0 && <div className="text-sm text-gray-500">No items</div>}
                                                {orderLines.map((l) => (
                                                    <div key={l.itemId} className="flex items-center justify-between text-sm">
                                                        <div className="flex items-center gap-3 flex-1">
                                                            <img src={l.image || '/images/image-placeholder.svg'} alt={l.name} className="w-10 h-8 object-cover rounded" onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/images/image-placeholder.svg'; }} />
                                                            <div>
                                                                <div className="font-medium">{l.name}</div>
                                                                <div className="text-xs text-gray-500">{l.qty} × ${l.unit.toFixed(2)}</div>
                                                            </div>
                                                        </div>
                                                        <div className="ml-2 w-24 text-right font-medium">${l.lineTotal.toFixed(2)}</div>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="border-t mt-3 pt-3 text-sm">
                                                <div className="flex items-center justify-between"><div>Subtotal</div><div>${orderSubtotal.toFixed(2)}</div></div>
                                                {selectedDiscount && (
                                                    <div className="flex items-center justify-between mt-1 text-green-600">
                                                        <div>Discount ({selectedDiscount.name} - {selectedDiscount.percentage}%)</div>
                                                        <div>-${discountAmount.toFixed(2)}</div>
                                                    </div>
                                                )}
                                                <div className="flex items-center justify-between mt-1"><div>Tax</div><div>$0.00</div></div>
                                                <div className="flex items-center justify-between mt-2 font-semibold"><div>Total</div><div>${orderTotal.toFixed(2)}</div></div>
                                            </div>
                                        </div>

                                        <div className="mt-4">
                                            <button
                                                className="px-3 py-2 bg-green-600 text-white rounded w-full flex items-center justify-center disabled:opacity-60"
                                                disabled={orderSubmitting}
                                                onClick={async () => {
                                                    const orderItems = Object.entries(selectedItems).filter(([, q]) => q > 0).map(([itemId, q]) => ({ itemId, quantity: q }));
                                                    if (orderItems.length === 0) return;
                                                    setOrderSubmitting(true);
                                                    try {
                                                        const response = await createCoffeeShopOrder(orderItems as OrderItemRequest[], selectedDiscountId, selectedClient?.id);

                                                        // Check if the response indicates failure
                                                        if (response && response.success === false) {
                                                            setOrderSubmitting(false);
                                                            setNotification({
                                                                variant: 'error',
                                                                title: 'Order failed',
                                                                message: response.message || response.error || 'Failed to create order'
                                                            });
                                                            return;
                                                        }

                                                        // Fetch the latest transaction for this user to show as invoice
                                                        if (auth?.claims?.name) {
                                                            const invoiceRes = await getItemTransactions({
                                                                CreatedBy: [auth.claims.name],
                                                                PageSize: 1,
                                                                Page: 1
                                                            });
                                                            if (invoiceRes.data && invoiceRes.data.length > 0) {
                                                                setCurrentInvoice(invoiceRes.data[0]);
                                                                setInvoiceModalOpen(true);
                                                            }
                                                        }

                                                        setSelectedItems({});
                                                        setSelectedDiscountId(null);
                                                        setSelectedClient(null);
                                                        setClientResults([]);
                                                        setClientPhone('');
                                                        setIsDrawerOpen(false);
                                                        // refresh items list to reflect updated stock
                                                        setItemsReloadToken(t => t + 1);
                                                        setNotification({
                                                            variant: 'success',
                                                            title: 'Order Created',
                                                            message: response?.message || 'Order submitted successfully'
                                                        });

                                                        // Refresh invoices list if it's visible
                                                        if (showInvoicesSection) {
                                                            setShowInvoicesSection(false);
                                                            setTimeout(() => setShowInvoicesSection(true), 100);
                                                        }
                                                    } catch (err) {
                                                        let message = 'Failed to create order';
                                                        if (err && typeof err === 'object') {
                                                            const maybe = err as { message?: unknown };
                                                            if (typeof maybe.message === 'string') message = maybe.message;
                                                        }
                                                        setNotification({ variant: 'error', title: 'Order failed', message });
                                                    } finally {
                                                        setOrderSubmitting(false);
                                                    }
                                                }}
                                            >
                                                {orderSubmitting ? <Loader size={16} /> : 'Submit Order'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Invoices Section */}
                    <div className="mt-8">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold">My Invoices</h2>
                            <button
                                onClick={() => setShowInvoicesSection(!showInvoicesSection)}
                                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
                            >
                                {showInvoicesSection ? 'Hide Invoices' : 'Show Invoices'}
                            </button>
                        </div>

                        {showInvoicesSection && (
                            <div className="space-y-4">
                                {/* Date Filter Buttons */}
                                <div className="bg-white rounded-lg shadow p-4">
                                    <div className="flex items-center gap-2 flex-wrap mb-4">
                                        <span className="text-sm font-medium text-gray-700 mr-2">Filter by:</span>
                                        {[
                                            { value: 'today', label: 'Today' },
                                            { value: 'yesterday', label: 'Yesterday' },
                                        ].map((filter) => (
                                            <button
                                                key={filter.value}
                                                onClick={() => setDateFilter(filter.value as typeof dateFilter)}
                                                className={`px-3 py-1.5 rounded text-sm font-medium transition ${dateFilter === filter.value
                                                    ? 'bg-indigo-600 text-white'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                    }`}
                                            >
                                                {filter.label}
                                            </button>
                                        ))}
                                    </div>

                                </div>

                                {/* Total Fees Widget */}
                                <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-lg shadow-lg p-6 text-white">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium opacity-90">Total Fees</p>
                                            <p className="text-3xl font-bold mt-1">${totalInvoices.toFixed(2)}</p>
                                            <p className="text-xs opacity-75 mt-1">
                                                {dateFilter === 'today' ? 'Today' : 'Yesterday'}
                                            </p>
                                        </div>
                                        <div className="bg-white/20 rounded-full p-4">
                                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>

                                {/* Invoices List */}
                                <div className="bg-white rounded-lg shadow p-6">
                                    {loadingInvoices && (
                                        <div className="flex justify-center py-10">
                                            <Loader />
                                        </div>
                                    )}

                                    {!loadingInvoices && userInvoices.length === 0 && (
                                        <div className="text-center py-10 text-gray-500">
                                            No invoices found
                                        </div>
                                    )}

                                    {!loadingInvoices && userInvoices.length > 0 && (
                                        <div className="space-y-4">
                                            {userInvoices.map((invoice) => (
                                                <div
                                                    key={invoice.transactionId}
                                                    className="border rounded-lg p-4 hover:shadow-md transition cursor-pointer"
                                                    onClick={() => {
                                                        setCurrentInvoice(invoice);
                                                        setInvoiceModalOpen(true);
                                                    }}
                                                >
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-3 mb-2">
                                                                <span className="text-lg font-semibold text-gray-800">
                                                                    Invoice #{invoice.transactionId}
                                                                </span>
                                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${invoice.statusId === STATUS_ENABLED || invoice.statusId === STATUS_PROCESSED_PAID
                                                                    ? 'bg-green-100 text-green-800'
                                                                    : 'bg-gray-100 text-gray-800'
                                                                    }`}>
                                                                    {getStatusName(invoice.statusId) || 'Unknown'}
                                                                </span>
                                                            </div>
                                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                                                                <div>
                                                                    <p className="text-gray-500">Date</p>
                                                                    <p className="font-medium text-gray-800">
                                                                        {new Date(invoice.createdOn).toLocaleDateString()}
                                                                    </p>
                                                                </div>
                                                                {invoice.roomName && (
                                                                    <div>
                                                                        <p className="text-gray-500">Room</p>
                                                                        <p className="font-medium text-gray-800">{invoice.roomName}</p>
                                                                    </div>
                                                                )}
                                                                <div>
                                                                    <p className="text-gray-500">Items</p>
                                                                    <p className="font-medium text-gray-800">
                                                                        {invoice.items?.length || 0} item{(invoice.items?.length || 0) !== 1 ? 's' : ''}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="text-right ml-4">
                                                            <p className="text-sm text-gray-500">Total</p>
                                                            <p className="text-2xl font-bold text-gray-800">
                                                                ${invoice.totalPrice.toFixed(2)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Invoice Modal */}
            <Modal
                isOpen={invoiceModalOpen}
                onClose={() => {
                    setInvoiceModalOpen(false);
                    setCurrentInvoice(null);
                }}
                title="Invoice"
            >
                <div className="max-h-[80vh] overflow-y-auto">
                    {currentInvoice && <ItemInvoice transaction={currentInvoice} />}
                </div>
            </Modal>

            <Modal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} title={editing ? "Edit Item" : "Create Item"}>
                <div className="flex flex-col gap-3">
                    <Input placeholder="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                    <label className="text-sm text-gray-600">Quantity</label>
                    <Input type="number" placeholder="Quantity" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: Number(e.target.value) }))} />
                    <label className="text-sm text-gray-600">Price (usd)</label>
                    <Input type="number" step={0.01} placeholder="Price" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) }))} />
                    <Input placeholder="Type" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} />
                    <label className="text-sm text-gray-600">Category</label>
                    <Select options={[{ value: '', label: '-- Select category --' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]} defaultValue={form.categoryId ?? ''} onChange={(v: string | number) => setForm((f) => ({ ...f, categoryId: v === '' ? null : Number(v) }))} />
                    <label className="text-sm text-gray-600">Status</label>
                    <StatusToggle value={form.statusId} onChange={(id) => setForm((f) => ({ ...f, statusId: id }))} />
                    <Input placeholder="GameId" value={form.gameId ?? ""} onChange={(e) => setForm((f) => ({ ...f, gameId: e.target.value || null }))} />
                    <div className="flex items-center gap-2">
                        <button className="px-3 py-1 bg-green-600 text-white rounded flex items-center gap-2" onClick={submitForm}>
                            {submitting ? <Loader size={16} /> : (editing ? 'Save' : 'Create')}
                        </button>
                        <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => setIsFormOpen(false)}>Cancel</button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Confirm delete">
                <div className="space-y-4">
                    <p>Are you sure you want to delete this item?</p>
                    <div className="flex items-center gap-2">
                        <button className="px-3 py-1 bg-red-600 text-white rounded flex items-center gap-2" onClick={async () => {
                            if (!deleteId) return;
                            setDeleting(true);
                            try {
                                await deleteItem(deleteId);
                                setItems((s) => s.filter(x => x.id !== deleteId));
                                setDeleteId(null);
                                setError(null);
                                setNotification({ variant: "success", title: "Deleted", message: "Item deleted" });
                            } catch (err) {
                                let message = 'Failed to delete';
                                if (err && typeof err === 'object') {
                                    const maybe = err as { message?: unknown };
                                    if (typeof maybe.message === 'string') message = maybe.message;
                                }
                                setError(message);
                                setNotification({ variant: "error", title: "Delete failed", message });
                            } finally {
                                setDeleting(false);
                            }
                        }}>
                            {deleting ? <Loader size={16} /> : 'Delete'}
                        </button>
                        <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => setDeleteId(null)}>Cancel</button>
                    </div>
                </div>
            </Modal>

            {/* Toast container bottom-right */}
            <div className="fixed bottom-6 right-6 z-50">
                {notification && (
                    <div className="max-w-sm">
                        <Alert variant={notification.variant} title={notification.title} message={notification.message} />
                    </div>
                )}
            </div>
        </div>
    );
}
