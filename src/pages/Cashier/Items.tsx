import { useEffect, useState } from "react";
import {
    getItems,
    createItem,
    updateItem,
    deleteItem,
    ItemDto,
    ItemListResponse,
} from "../../services/itemService";
import { createCoffeeShopOrder, getItemTransactions, ItemTransaction } from '../../services/transactionService';
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
import ChangeCalculator from "../../components/common/ChangeCalculator";
import { getSets, SetDto } from '../../services/setService';
import { getChannels, ChannelDto } from '../../services/channelService';
import { getItemsWithoutRecipe } from '../../services/recipeService';


export default function CashierItems() {
    const [sets, setSets] = useState<SetDto[]>([]);
    const [selectedSetId, setSelectedSetId] = useState<number | null>(null);
    const [loadingSets, setLoadingSets] = useState(false);

    const [items, setItems] = useState<ItemDto[]>([]);
    // Item IDs with NO recipe. Items WITH a recipe track stock via
    // ingredients (backend skips the Item.Quantity check for them), so
    // they must stay sellable even when the legacy quantity counter is 0.
    // null = list not loaded (endpoint failed) → fall back to the legacy
    // "quantity <= 0 means out of stock" for ALL items. This makes the
    // fail-safe direction conservative: a network hiccup can never let
    // genuinely out-of-stock non-recipe items be sold.
    const [noRecipeIds, setNoRecipeIds] = useState<Set<number> | null>(null);
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

    // Change calculator state
    const [calculatorOpen, setCalculatorOpen] = useState(false);

    // Discount states
    const [discounts, setDiscounts] = useState<DiscountDto[]>([]);
    const [loadingDiscounts, setLoadingDiscounts] = useState(false);
    const [selectedDiscountId, setSelectedDiscountId] = useState<number | null>(null);

    // Client search states
    const [clientPhone, setClientPhone] = useState('');
    const [searchingClient, setSearchingClient] = useState(false);
    const [clientResults, setClientResults] = useState<ClientUserDto[]>([]);
    const [selectedClient, setSelectedClient] = useState<ClientUserDto | null>(null);

    // Comment state
    const [comment, setComment] = useState('');

    // Sales channel state — Toters and any other external channels the admin
    // has created in /admin/channels. Null = direct / in-house order.
    const [channels, setChannels] = useState<ChannelDto[]>([]);
    const [selectedChannelId, setSelectedChannelId] = useState<number | null>(null);

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

    // Load which items have NO recipe (once per mount). Failure is
    // non-fatal — we fall back to treating all items as legacy (i.e.
    // out-of-stock when quantity <= 0), same behavior as before.
    useEffect(() => {
        let mounted = true;
        getItemsWithoutRecipe()
            .then((ids) => { if (mounted) setNoRecipeIds(new Set(ids)); })
            .catch(() => { /* non-fatal */ });
        return () => { mounted = false; };
    }, []);

    useEffect(() => {
        if (!isDrawerOpen) return;
        let mounted = true;
        setLoadingSets(true);
        getSets()
            .then((res) => {
                if (!mounted) return;
                setSets(res.data || []);
            })
            .catch(() => {
                /* ignore */
            })
            .finally(() => {
                if (mounted) setLoadingSets(false);
            });
        return () => { mounted = false; };
    }, [isDrawerOpen]);

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
        // Load active channels for the F&B order form. The backend already
        // filters out hidden ones by default.
        getChannels()
            .then((data) => { if (mounted) setChannels(data); })
            .catch(() => { /* ignore — channels are optional on the order */ });
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
            <div className="mb-5">
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">Items</h1>
                <p className="text-sm text-gray-500 mt-0.5">Tap + to build the order, then review and send it.</p>
            </div>

            <div className="mb-5 flex flex-wrap items-center gap-3">
                <button
                    onClick={() => setCalculatorOpen(true)}
                    className="h-11 px-4 bg-green-600 text-white rounded-xl shadow-sm hover:bg-green-700 hover:shadow transition flex items-center gap-2 text-sm font-medium"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    Calculator
                </button>
                <div className="w-48">
                    <Select
                        options={[{ value: '', label: 'All categories' }, ...categories.map(c => ({ value: c.id, label: c.name }))]}
                        defaultValue={selectedCategory ?? ''}
                        onChange={(v: string | number) => { setPage(1); setSelectedCategory(v === '' ? null : Number(v)); }}
                    />
                </div>
                <div className="w-64">
                    {/* Icon lives in the placeholder rather than as an overlay —
                        the shared Input sets its own horizontal padding, and an
                        absolutely-positioned icon could collide with it. */}
                    <Input placeholder="🔍  Search items…" value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} />
                </div>
            </div>

            {/* Floating order bar — always in reach once something's picked,
                no matter how far the cashier has scrolled. */}
            {totalSelected > 0 && (
                <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 rounded-2xl bg-gray-900 text-white pl-5 pr-2 py-2 shadow-2xl">
                    <span className="text-sm font-medium">
                        🛒 {totalSelected} item{totalSelected === 1 ? '' : 's'} selected
                    </span>
                    <button
                        className="px-3 py-1.5 text-xs font-medium text-gray-300 hover:text-white transition"
                        onClick={() => setSelectedItems({})}
                    >
                        Clear
                    </button>
                    <button
                        className="px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-semibold rounded-xl transition active:scale-95"
                        onClick={() => { setOrderTimestamp(new Date()); setIsDrawerOpen(true); }}
                    >
                        View Order →
                    </button>
                </div>
            )}

            {loading && <div className="text-gray-600">Loading items...</div>}

            {error && <div className="text-red-600 bg-red-50 p-3 rounded">{error}</div>}

            {!loading && !error && (
                <div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {items.map(it => {
                            // Recipe items track stock on ingredients, not on
                            // the legacy Item.Quantity counter — they stay
                            // sellable at qty 0 (backend enforces ingredient
                            // levels + warns on negatives). When the recipe
                            // list failed to load (null) everyone falls back
                            // to the old quantity check.
                            const hasRecipe = noRecipeIds !== null && !noRecipeIds.has(Number(it.id));
                            const isOutOfStock = it.quantity <= 0 && !hasRecipe;
                            const isLowStock = !hasRecipe && !isOutOfStock && it.quantity <= 5;
                            const picked = selectedItems[String(it.id)] || 0;
                            return (
                                <div
                                    key={it.id}
                                    className={`group relative rounded-2xl bg-white overflow-hidden transition-all duration-200 border ${
                                        isOutOfStock
                                            ? 'opacity-55 border-gray-200 shadow-sm'
                                            : picked > 0
                                                ? 'border-indigo-400 ring-2 ring-indigo-200 shadow-md'
                                                : 'border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-0.5'
                                    }`}
                                >
                                    {/* Picked-count bubble */}
                                    {picked > 0 && (
                                        <span className="absolute top-2 right-2 z-10 flex h-6 min-w-6 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-xs font-bold text-white shadow">
                                            {picked}
                                        </span>
                                    )}

                                    <div className="relative h-28 bg-gray-50">
                                        <img
                                            src={it.imagePath ? resolveImageUrl(it.imagePath) : '/images/image-placeholder.svg'}
                                            alt={it.name}
                                            className="h-full w-full object-cover"
                                            onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/images/image-placeholder.svg'; }}
                                        />
                                        {/* Stock state, on the image where the eye lands first */}
                                        <span className={`absolute bottom-2 left-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                            isOutOfStock ? 'bg-red-600 text-white'
                                            : hasRecipe ? 'bg-teal-600/90 text-white'
                                            : isLowStock ? 'bg-amber-500/95 text-white'
                                            : 'bg-black/50 text-white'
                                        }`}>
                                            {isOutOfStock ? 'Out of stock'
                                                : hasRecipe ? 'Recipe stock'
                                                : isLowStock ? `Only ${it.quantity} left`
                                                : `${it.quantity} in stock`}
                                        </span>
                                    </div>

                                    <div className="p-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2" title={it.name}>{it.name}</div>
                                                <div className="text-[11px] text-gray-400 mt-0.5">
                                                    {categories.find(c => c.id === it.categoryId)?.name ?? '—'}
                                                </div>
                                            </div>
                                            <div className="shrink-0 text-base font-bold text-gray-900">${it.price}</div>
                                        </div>

                                        <div className="mt-3 flex items-center justify-center gap-0 rounded-xl border border-gray-200 overflow-hidden">
                                            <button
                                                className="h-9 flex-1 bg-gray-50 text-lg font-medium text-gray-600 hover:bg-gray-100 active:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition"
                                                disabled={isOutOfStock || picked === 0}
                                                onClick={() => setSelectedItems(s => {
                                                    const key = String(it.id);
                                                    const cur = s[key] || 0;
                                                    const next = Math.max(0, cur - 1);
                                                    const copy = { ...s };
                                                    if (next === 0) delete copy[key]; else copy[key] = next;
                                                    return copy;
                                                })}
                                            >−</button>
                                            <div className={`h-9 w-12 flex items-center justify-center text-sm font-bold border-x border-gray-200 ${picked > 0 ? 'text-indigo-700 bg-indigo-50' : 'text-gray-500 bg-white'}`}>
                                                {picked}
                                            </div>
                                            <button
                                                className="h-9 flex-1 bg-indigo-600 text-lg font-medium text-white hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
                                                disabled={isOutOfStock}
                                                onClick={() => setSelectedItems(s => {
                                                    const key = String(it.id);
                                                    const cur = s[key] || 0;
                                                    return { ...s, [key]: cur + 1 };
                                                })}
                                            >+</button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-4 flex items-start justify-between">
                        <div>
                            <div className="text-sm text-gray-500">Page {page} · {total} items</div>
                            <div className="mt-2 flex items-center gap-1">
                                <button className="h-9 px-4 rounded-lg border border-gray-200 bg-white text-sm font-medium shadow-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>← Prev</button>
                                <button className="h-9 px-4 rounded-lg border border-gray-200 bg-white text-sm font-medium shadow-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed" disabled={page >= Math.max(1, Math.ceil(total / pageSize))} onClick={() => setPage(p => p + 1)}>Next →</button>
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
                                                    placeholder="Search by phone or name..."
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
                                                        ...clientResults.map(c => {
                                                            const firstName = c.firstName || '';
                                                            const lastName = c.lastName || '';
                                                            const fullName = `${firstName} ${lastName}`.trim() || c.email || 'Unknown';
                                                            const phone = c.phoneNumber || 'No phone';
                                                            return {
                                                                value: c.id,
                                                                label: `${fullName} (${phone})`
                                                            };
                                                        })
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
                                                    <span>Selected: {(() => {
                                                        const firstName = selectedClient.firstName || '';
                                                        const lastName = selectedClient.lastName || '';
                                                        const fullName = `${firstName} ${lastName}`.trim();
                                                        return fullName || selectedClient.email || 'Unknown';
                                                    })()}</span>
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

                                        {/* Set Selection */}
                                        <div className="mt-3">
                                            <label className="text-sm font-medium text-gray-700 mb-1 block">Set/Table (Optional)</label>
                                            {loadingSets ? (
                                                <div className="text-xs text-gray-500">Loading sets...</div>
                                            ) : (
                                                <Select
                                                    options={[
                                                        { value: '', label: 'No Set' },
                                                        ...sets.map(s => ({
                                                            value: s.id,
                                                            label: s.name
                                                        }))
                                                    ]}
                                                    defaultValue={selectedSetId ?? ''}
                                                    onChange={(v: string | number) => setSelectedSetId(v === '' ? null : Number(v))}
                                                />
                                            )}
                                        </div>

                                        {/* Channel Selection — for orders coming
                                            from external apps like Toters. Leave
                                            on "Direct / In-house" for walk-in
                                            customers. */}
                                        <div className="mt-3">
                                            <label className="text-sm font-medium text-gray-700 mb-1 block">Channel (Optional)</label>
                                            <Select
                                                options={[
                                                    { value: '', label: 'Direct / In-house' },
                                                    ...channels.map(c => ({
                                                        value: c.id,
                                                        label: c.name,
                                                    })),
                                                ]}
                                                defaultValue={selectedChannelId ?? ''}
                                                onChange={(v: string | number) => setSelectedChannelId(v === '' ? null : Number(v))}
                                            />
                                        </div>

                                        {/* Comment Section */}
                                        <div className="mt-3">
                                            <label className="text-sm font-medium text-gray-700 mb-1 block">Comment (Optional)</label>
                                            <textarea
                                                value={comment}
                                                onChange={(e) => setComment(e.target.value)}
                                                placeholder="Add any notes or comments..."
                                                rows={3}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                            />
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

                                        {/* Inside your drawer, replace the single submit button with two buttons */}
                                        <div className="mt-4 space-y-2">
                                            {/* Pay Now Button */}
                                            <button
                                                className="px-3 py-2 bg-green-600 text-white rounded w-full flex items-center justify-center disabled:opacity-60"
                                                disabled={orderSubmitting}
                                                onClick={async () => {
                                                    const orderItems = Object.entries(selectedItems)
                                                        .filter(([, q]) => q > 0)
                                                        .map(([itemId, q]) => ({ itemId: parseInt(itemId), quantity: q }));

                                                    if (orderItems.length === 0) return;

                                                    setOrderSubmitting(true);
                                                    try {
                                                        const response = await createCoffeeShopOrder(
                                                            orderItems,
                                                            selectedDiscountId,
                                                            selectedClient?.id,
                                                            comment,
                                                            false,
                                                            selectedSetId,   // Close invoice immediately
                                                            selectedChannelId
                                                        );

                                                        if (response && response.success === false) {
                                                            setOrderSubmitting(false);
                                                            setNotification({
                                                                variant: 'error',
                                                                title: 'Order failed',
                                                                message: response.message || response.error || 'Failed to create order'
                                                            });
                                                            return;
                                                        }

                                                        // Convert response to ItemTransaction
                                                        if (response.success && response.data) {
                                                            // Stock-management warnings — if any ingredient
                                                            // went negative as a result of this sale, the
                                                            // backend returns them on data.stockWarnings.
                                                            // Show a yellow toast naming them; the sale
                                                            // still went through.
                                                            const warnings = response.data.stockWarnings as
                                                                | Array<{ ingredientName: string; quantityAfter: number; unit: string }>
                                                                | undefined;
                                                            if (warnings && warnings.length > 0) {
                                                                const list = warnings
                                                                    .map(w => `${w.ingredientName} (${w.quantityAfter} ${w.unit})`)
                                                                    .join(', ');
                                                                setNotification({
                                                                    variant: 'warning',
                                                                    title: 'Stock alert',
                                                                    message: `Sale went through, but these went negative: ${list}`
                                                                });
                                                            }
                                                            const invoiceData: ItemTransaction = {
                                                                transactionId: response.data.id,
                                                                createdOn: response.data.createdOn,
                                                                statusId: response.data.statusId,
                                                                createdBy: response.data.createdBy,
                                                                totalPrice: response.data.totalPrice,
                                                                roomId: response.data.roomId,
                                                                roomName: response.data.room,
                                                                setId: response.data.setId,
                                                                setName: response.data.set,
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
                                                                    categoryName: '',
                                                                    itemType: item.type || '',
                                                                })) || []
                                                            };

                                                            setCurrentInvoice(invoiceData);
                                                            setInvoiceModalOpen(true);

                                                            // Kitchen/bar tickets print server-side: the API
                                                            // dispatches ESC/POS jobs over SignalR to the
                                                            // printers configured in Admin -> Printers, via
                                                            // the on-site print agent.
                                                        }

                                                        setSelectedItems({});
                                                        setSelectedDiscountId(null);
                                                        setSelectedClient(null);
                                                        setClientResults([]);
                                                        setClientPhone('');
                                                        setComment('');
                                                        setSelectedChannelId(null);
                                                        setIsDrawerOpen(false);
                                                        setItemsReloadToken(t => t + 1);
                                                        setNotification({
                                                            variant: 'success',
                                                            title: 'Order Created',
                                                            message: response?.message || 'Order submitted successfully'
                                                        });

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
                                                {orderSubmitting ? <Loader size={16} /> : 'Pay Now & Close'}
                                            </button>

                                            {/* Pay Later Button - UPDATED */}

                                            <button
                                                className="px-3 py-2 bg-orange-600 text-white rounded w-full flex items-center justify-center disabled:opacity-60"
                                                disabled={orderSubmitting}
                                                onClick={async () => {
                                                    const orderItems = Object.entries(selectedItems)
                                                        .filter(([, q]) => q > 0)
                                                        .map(([itemId, q]) => ({ itemId: parseInt(itemId), quantity: q }));

                                                    if (orderItems.length === 0) return;

                                                    setOrderSubmitting(true);
                                                    try {
                                                        const response = await createCoffeeShopOrder(
                                                            orderItems,
                                                            selectedDiscountId,
                                                            selectedClient?.id,
                                                            comment,
                                                            true,
                                                            selectedSetId,  // Keep invoice open
                                                            selectedChannelId
                                                        );

                                                        if (response && response.success === false) {
                                                            setOrderSubmitting(false);
                                                            setNotification({
                                                                variant: 'error',
                                                                title: 'Failed',
                                                                message: response.message || response.error || 'Failed to create open invoice'
                                                            });
                                                            return;
                                                        }

                                                        // Convert response to ItemTransaction
                                                        if (response.success && response.data) {
                                                            const invoiceData: ItemTransaction = {
                                                                transactionId: response.data.id,
                                                                createdOn: response.data.createdOn,
                                                                statusId: response.data.statusId,
                                                                createdBy: response.data.createdBy,
                                                                totalPrice: response.data.totalPrice,
                                                                roomId: response.data.roomId,
                                                                roomName: response.data.room,        // backend sends "room"
                                                                setId: response.data.setId,
                                                                setName: response.data.set,          // backend sends "set"
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
                                                                    categoryName: '',
                                                                    itemType: item.type || '',
                                                                })) || []
                                                            };

                                                            setCurrentInvoice(invoiceData);
                                                            setInvoiceModalOpen(true);

                                                            // Kitchen/bar tickets print server-side: the API
                                                            // dispatches ESC/POS jobs over SignalR to the
                                                            // printers configured in Admin -> Printers, via
                                                            // the on-site print agent.
                                                        }

                                                        setSelectedItems({});
                                                        setSelectedDiscountId(null);
                                                        setSelectedClient(null);
                                                        setClientResults([]);
                                                        setClientPhone('');
                                                        setComment('');
                                                        setSelectedSetId(null);
                                                        setSelectedChannelId(null);
                                                        setIsDrawerOpen(false);
                                                        setItemsReloadToken(t => t + 1);
                                                        setNotification({
                                                            variant: 'success',
                                                            title: 'Open Invoice Created',
                                                            message: 'Invoice created. Customer can pay later.'
                                                        });
                                                    } catch (err) {
                                                        let message = 'Failed to create open invoice';
                                                        if (err && typeof err === 'object') {
                                                            const maybe = err as { message?: unknown };
                                                            if (typeof maybe.message === 'string') message = maybe.message;
                                                        }
                                                        setNotification({ variant: 'error', title: 'Failed', message });
                                                    } finally {
                                                        setOrderSubmitting(false);
                                                    }
                                                }}
                                            >
                                                {orderSubmitting ? <Loader size={16} /> : 'Pay Later (Open Invoice)'}
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

            {/* Change Calculator */}
            <ChangeCalculator
                isOpen={calculatorOpen}
                onClose={() => setCalculatorOpen(false)}
                totalAmount={orderTotal}
            />

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
