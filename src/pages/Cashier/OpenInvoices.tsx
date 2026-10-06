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
import { updateOpenInvoiceSet, setTransactionDiscount } from '../../services/transactionService';
import { getSets, SetDto } from '../../services/setService';
import { getDiscounts, DiscountDto } from '../../services/discountService';
import AttachClientModal from '../GameCashier/AttachClientModal';
import PaymentChoiceModal from '../../components/wallet/PaymentChoiceModal';
import ItemAddOnsPanel, { addOnsTotal } from '../../components/items/ItemAddOnsPanel';
import ItemVariantPicker, { variantPickTotal, variantDeltaTotal } from '../../components/items/ItemVariantPicker';
import OpenInvoiceCard from '../../components/till/invoices/OpenInvoiceCard';
import InvoiceDetailPanel from '../../components/till/invoices/InvoiceDetailPanel';
import { money, useIsDesktop, useNow } from '../../components/till/invoices/invoiceUtils';

const OpenInvoices: React.FC = () => {
    const [editingSetInvoiceId, setEditingSetInvoiceId] = useState<number | null>(null);
const [editSetValue, setEditSetValue] = useState<number | null>(null);
const [sets, setSets] = useState<SetDto[]>([]);
const [, setLoadingSets] = useState(false);

    // Discounts the cashier can apply to a still-open invoice. The server
    // recomputes the total, so we just re-read the list afterwards.
    const [discounts, setDiscounts] = useState<DiscountDto[]>([]);
    const [editingDiscountInvoiceId, setEditingDiscountInvoiceId] = useState<number | null>(null);
    const [savingDiscountId, setSavingDiscountId] = useState<number | null>(null);

    // Reuses the game cashier's attach-client modal — same narrow endpoint.
    const [clientModalInvoice, setClientModalInvoice] = useState<OpenInvoiceDto | null>(null);

    // Payment picker (cash / wallet / mix) shown when the cashier hits Pay.
    const [payingInvoice, setPayingInvoice] = useState<OpenInvoiceDto | null>(null);

    // Open invoices state
    const [openInvoices, setOpenInvoices] = useState<OpenInvoiceDto[]>([]);
    // Quick find — client name, invoice #, item, set. All invoices are
    // loaded at once (no server paging here), so filtering locally is exact.
    const [invoiceSearch, setInvoiceSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Selected invoice for adding items
    const [selectedInvoice, setSelectedInvoice] = useState<OpenInvoiceDto | null>(null);

    // UI only: which invoice the detail panel shows, a minute-level clock for
    // the age labels, and whether the detail sits beside the list (lg+).
    const [activeInvoiceId, setActiveInvoiceId] = useState<number | null>(null);
    const now = useNow(30000);
    const isDesktop = useIsDesktop();

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
    // Paid extras per item: itemId -> addOnId -> qty. Sent with the add-items call.
    const [selectedAddOns, setSelectedAddOns] = useState<Record<string, Record<number, number>>>({});
    const [selectedVariants, setSelectedVariants] = useState<Record<string, Record<number, number>>>({});
    const setVariantPicks = (itemId: string, next: Record<number, number>) => {
        setSelectedVariants(prev => { const c = { ...prev }; if (Object.keys(next).length === 0) delete c[itemId]; else c[itemId] = next; return c; });
        const total = variantPickTotal(next);
        setSelectedItems(s => { const c = { ...s }; if (total <= 0) delete c[itemId]; else c[itemId] = total; return c; });
    };

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
}, []);

// Active discounts only — an inactive one contributes 0% server-side, so
// offering it would just confuse the cashier.
useEffect(() => {
    let mounted = true;
    getDiscounts(1, 200)
        .then((res) => {
            if (!mounted) return;
            setDiscounts((res.data || []).filter((d) => d.isActive));
        })
        .catch(() => { /* non-fatal: the picker just stays empty */ });
    return () => { mounted = false; };
}, []);

const handleApplyDiscount = async (invoiceId: number, discountId: number | null) => {
    setSavingDiscountId(invoiceId);
    try {
        const res = await setTransactionDiscount(invoiceId, discountId);
        if (res?.success) {
            setNotification({
                variant: 'success',
                title: 'Discount updated',
                message: discountId
                    ? 'Discount applied and the total recalculated.'
                    : 'Discount removed and the total recalculated.',
            });
            setEditingDiscountInvoiceId(null);
            await loadOpenInvoices();
        } else {
            setNotification({
                variant: 'error',
                title: 'Could not apply discount',
                message: res?.error || res?.message || 'Please try again.',
            });
        }
    } catch (err: unknown) {
        const e = err as { response?: { data?: { error?: string; message?: string } } };
        setNotification({
            variant: 'error',
            title: 'Could not apply discount',
            message: e?.response?.data?.error || e?.response?.data?.message || 'Please try again.',
        });
    } finally {
        setSavingDiscountId(null);
    }
};

// Add handler for updating set
const handleUpdateSet = async (invoiceId: number, setId: number | null) => {
    try {
        const response = await updateOpenInvoiceSet(invoiceId, setId);
        if (response.success) {
            setNotification({
                variant: 'success',
                title: 'Set Updated',
                message: 'Set number updated successfully',
            });
            setEditingSetInvoiceId(null);
            setEditSetValue(null);
            await loadOpenInvoices();
        } else {
            setNotification({
                variant: 'error',
                title: 'Failed',
                message: response.message || 'Failed to update set',
            });
        }
    } catch (err: unknown) {
        let message = 'Failed to update set';
        if (err && typeof err === 'object') {
            const maybe = err as { message?: unknown };
            if (typeof maybe.message === 'string') message = maybe.message;
        }
        setNotification({
            variant: 'error',
            title: 'Error',
            message,
        });
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
// Handle print invoice - NEW
const handlePrintInvoice = (invoice: OpenInvoiceDto) => {
    // Convert OpenInvoiceDto to ItemTransaction for the invoice component
    const invoiceData: ItemTransaction = {
        transactionId: invoice.id,
        createdOn: invoice.createdOn,
        statusId: invoice.statusId,
        createdBy: invoice.createdBy,
        totalPrice: invoice.totalPrice,
        roomId: invoice.roomId,
        roomName: invoice.room || undefined,
        setId: invoice.setId,
        setName: invoice.set || undefined,
        userId: invoice.userId,
        userName: invoice.userName,
        comment: invoice.comment,
        discount: invoice.discountId ? {
            name: invoice.discountName || '',
            percentage: invoice.discountPercentage || 0
        } : null,
        items: invoice.items?.map((item) => ({
            itemId: item.itemId,
            itemName: item.itemName,
            quantity: item.quantity,
            unitPrice: item.price,
            lineTotal: item.price * item.quantity,
            isIncluded: !!item.isIncluded,
            addOns: item.addOns || [],
            variants: item.variants || [],
            categoryName: '',
            itemType: item.type || '',
        })) || []
    };

    setCurrentInvoice(invoiceData);
    setIsInvoiceModalOpen(true);
};

    // Handle close invoice - UPDATED WITH CORRECT PROPERTY NAMES
const handleCloseInvoice = async (invoiceId: number, walletAmount = 0) => {
    setClosingInvoiceId(invoiceId);
    try {
        const response = await closeOpenInvoice(invoiceId, walletAmount);
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
                        isIncluded: !!item.isIncluded,
                        addOns: item.addOns || [],
                        variants: item.variants || [],
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
                addOns: selectedAddOns[itemId]
                    ? Object.entries(selectedAddOns[itemId])
                        .filter(([, aq]) => aq > 0)
                        .map(([addOnId, aq]) => ({ addOnId: Number(addOnId), quantity: aq }))
                    : undefined,
                variants: selectedVariants[itemId]
                    ? Object.entries(selectedVariants[itemId])
                        .filter(([, vq]) => vq > 0)
                        .map(([variantId, vq]) => ({ variantId: Number(variantId), quantity: vq }))
                    : undefined,
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
                setSelectedItems({}); setSelectedAddOns({}); setSelectedVariants({});
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
            return sum + item.price * qty + addOnsTotal(item.addOns, selectedAddOns[String(itemId)]) + variantDeltaTotal(item.variants, selectedVariants[String(itemId)]);
        }, 0);

    const selectedItemsCount = Object.values(selectedItems).reduce(
        (s, v) => s + (v || 0),
        0
    );


    // Case-insensitive match against everything a cashier might remember.
    const visibleInvoices = (() => {
        const q = invoiceSearch.trim().toLowerCase();
        if (!q) return openInvoices;
        return openInvoices.filter((inv) =>
            (inv.userName ?? '').toLowerCase().includes(q) ||
            String(inv.id).includes(q) ||
            (inv.set ?? '').toLowerCase().includes(q) ||
            (inv.createdBy ?? '').toLowerCase().includes(q) ||
            (inv.items ?? []).some((it) => it.itemName.toLowerCase().includes(q))
        );
    })();

    // Which invoice the detail panel shows. Desktop falls back to the first
    // visible invoice so its actions are always on screen; on smaller screens
    // the detail opens inline under the tapped card.
    const detailInvoice = isDesktop
        ? (visibleInvoices.find((inv) => inv.id === activeInvoiceId) ?? visibleInvoices[0] ?? null)
        : (visibleInvoices.find((inv) => inv.id === activeInvoiceId) ?? null);
    const openTotal = openInvoices.reduce((s, inv) => s + (inv.totalPrice || 0), 0);
    const firstLoad = loading && openInvoices.length === 0;

    const renderDetail = (invoice: OpenInvoiceDto, onBack?: () => void) => (
        <InvoiceDetailPanel
            invoice={invoice}
            now={now}
            onBack={onBack}
            onEditClient={() => setClientModalInvoice(invoice)}
            sets={sets}
            editingSet={editingSetInvoiceId === invoice.id}
            editSetValue={editSetValue}
            onStartEditSet={() => {
                setEditingSetInvoiceId(invoice.id);
                setEditSetValue(invoice.setId || null);
            }}
            onChangeSetValue={(v: string | number) => setEditSetValue(v === '' ? null : Number(v))}
            onSaveSet={() => handleUpdateSet(invoice.id, editSetValue)}
            onCancelSet={() => {
                setEditingSetInvoiceId(null);
                setEditSetValue(null);
            }}
            discounts={discounts}
            editingDiscount={editingDiscountInvoiceId === invoice.id}
            savingDiscount={savingDiscountId === invoice.id}
            onStartEditDiscount={() => setEditingDiscountInvoiceId(invoice.id)}
            onPickDiscount={(v) =>
                handleApplyDiscount(invoice.id, v === '' ? null : Number(v))
            }
            onCancelDiscount={() => setEditingDiscountInvoiceId(null)}
            closing={closingInvoiceId === invoice.id}
            onAddItems={() => {
                setSelectedInvoice(invoice);
                setIsAddItemsModalOpen(true);
            }}
            onPrint={() => handlePrintInvoice(invoice)}
            onPay={() => setPayingInvoice(invoice)}
        />
    );

    const closeAddItemsModal = () => {
        setIsAddItemsModalOpen(false);
        setSelectedInvoice(null);
        setSelectedItems({}); setSelectedAddOns({}); setSelectedVariants({});
        setPage(1);
        setSearch('');
        setSelectedCategory(null);
    };

    return (
        <div className="space-y-4 p-4 sm:p-6">
            {/* Slim header — title, counts, search, refresh */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-600 text-white shadow-lg shadow-orange-600/25">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </span>
                    <div className="min-w-0">
                        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">Open Invoices</h1>
                        <p className="text-sm text-gray-500 tabular-nums dark:text-gray-400">
                            {firstLoad
                                ? 'Loading…'
                                : `${openInvoices.length} open · ${money(openTotal)}`}
                        </p>
                    </div>
                </div>
                <div className="flex w-full items-center gap-2 sm:w-auto">
                    <div className="relative min-w-0 flex-1 sm:flex-none">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" strokeLinecap="round" />
                            </svg>
                        </span>
                        <input
                            value={invoiceSearch}
                            onChange={(e) => setInvoiceSearch(e.target.value)}
                            placeholder="Client, invoice #, item…"
                            aria-label="Search open invoices"
                            className="h-12 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-12 text-base shadow-sm placeholder:text-gray-400 focus:border-orange-400 focus:outline-none focus:ring-4 focus:ring-orange-500/10 dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:placeholder:text-gray-500 sm:w-72"
                        />
                        {invoiceSearch && (
                            <button
                                type="button"
                                onClick={() => setInvoiceSearch('')}
                                className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/5 dark:hover:text-gray-200"
                                aria-label="Clear search"
                            >
                                ×
                            </button>
                        )}
                    </div>
                    <button
                        onClick={loadOpenInvoices}
                        className="flex h-12 shrink-0 items-center gap-2 rounded-xl bg-orange-600 px-4 text-base font-semibold text-white shadow-sm transition hover:bg-orange-700"
                    >
                        <svg className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
            </div>

            {/* First load — skeleton cards at the real card size */}
            {firstLoad && (
                <div className="@container" aria-busy="true" aria-label="Loading open invoices">
                    <div className="grid grid-cols-1 gap-3 @lg:grid-cols-2 @3xl:grid-cols-3 @6xl:grid-cols-4">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="h-[214px] animate-pulse rounded-2xl border border-gray-200/80 bg-white p-4 dark:border-white/[0.06] dark:bg-white/[0.03]">
                                <div className="h-4 w-16 rounded bg-gray-100 dark:bg-white/10" />
                                <div className="mt-4 h-5 w-32 rounded bg-gray-100 dark:bg-white/10" />
                                <div className="mt-2 h-4 w-24 rounded bg-gray-100 dark:bg-white/10" />
                                <div className="mt-6 ml-auto h-8 w-28 rounded bg-gray-100 dark:bg-white/10" />
                                <div className="mt-5 h-12 rounded-xl bg-gray-100 dark:bg-white/10" />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {error && !loading && (
                <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                    {error}
                </div>
            )}

            {!loading && !error && openInvoices.length === 0 && (
                <div className="rounded-2xl border border-dashed border-gray-200 py-20 text-center text-gray-500 dark:border-white/10 dark:text-gray-400">
                    <svg
                        className="mx-auto mb-4 h-16 w-16 text-gray-300 dark:text-gray-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                    </svg>
                    <p className="text-lg font-medium text-gray-700 dark:text-gray-200">No open invoices</p>
                    <p className="mt-1 text-sm">All invoices have been closed</p>
                </div>
            )}

            {/* List + detail. While a reload is in flight the list stays in
                place (no layout jump) but is dimmed and not tappable, so a
                just-paid invoice can't be acted on again. */}
            {!firstLoad && !error && openInvoices.length > 0 && (
                <div
                    aria-busy={loading}
                    className={`grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_440px] ${loading ? 'pointer-events-none opacity-60' : ''}`}
                >
                    <div className="@container min-w-0">
                        {visibleInvoices.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-gray-200 py-16 text-center text-gray-500 dark:border-white/10 dark:text-gray-400">
                                <div className="mb-2 text-3xl">🔍</div>
                                <p className="text-lg font-medium text-gray-700 dark:text-gray-200">No invoice matches “{invoiceSearch}”</p>
                                <p className="mt-1 text-sm">Try the client's name, the invoice number, or an item on it.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-3 @lg:grid-cols-2 @3xl:grid-cols-3 @6xl:grid-cols-4">
                                {visibleInvoices.map((invoice) => {
                                    const isSelected = detailInvoice?.id === invoice.id;
                                    return (
                                        <React.Fragment key={invoice.id}>
                                            <OpenInvoiceCard
                                                invoice={invoice}
                                                now={now}
                                                selected={isSelected}
                                                closing={closingInvoiceId === invoice.id}
                                                onSelect={() =>
                                                    setActiveInvoiceId(!isDesktop && isSelected ? null : invoice.id)
                                                }
                                                onPay={() => setPayingInvoice(invoice)}
                                            />
                                            {!isDesktop && isSelected && (
                                                <div className="col-span-full">
                                                    {renderDetail(invoice, () => setActiveInvoiceId(null))}
                                                </div>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {isDesktop && (
                        <aside className="min-w-0 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto">
                            {detailInvoice ? (
                                renderDetail(detailInvoice)
                            ) : (
                                <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500 dark:border-white/10 dark:text-gray-400">
                                    Select an invoice to see its items
                                </div>
                            )}
                        </aside>
                    )}
                </div>
            )}

            {/* Add Items Modal */}
            <Modal
                isOpen={isAddItemsModalOpen}
                onClose={closeAddItemsModal}
                title={`Add Items to Invoice #${selectedInvoice?.id || ''}`}
            >
                <div className="space-y-4">
                    {/* Filters */}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="flex-1">
                            <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">Category</label>
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
                            <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">Search</label>
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
                        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 dark:border-blue-500/20 dark:bg-blue-500/10">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm font-semibold text-blue-800 tabular-nums dark:text-blue-200">
                                        {selectedItemsCount} item(s) selected
                                    </p>
                                    <p className="text-base font-semibold text-blue-700 tabular-nums dark:text-blue-300">
                                        Subtotal: ${selectedItemsTotal.toFixed(2)}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => { setSelectedItems({}); setSelectedAddOns({}); setSelectedVariants({}); }}
                                    className="min-h-[44px] rounded-lg px-3 text-sm font-medium text-blue-600 hover:bg-blue-100 hover:text-blue-800 dark:text-blue-300 dark:hover:bg-blue-500/10"
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
                        <div className="py-10 text-center text-gray-500 dark:text-gray-400">
                            <p>No items found</p>
                        </div>
                    )}

                    {!loadingItems && items.length > 0 && (
                        <>
                            <div className="grid max-h-96 grid-cols-1 gap-3 overflow-y-auto min-[420px]:grid-cols-2 md:grid-cols-3">
                                {items.map((item) => {
                                    const isOutOfStock = item.quantity <= 0;
                                    const selected = selectedItems[String(item.id)] || 0;
                                    return (
                                        <div
                                            key={item.id}
                                            className={`rounded-xl border bg-white p-3 dark:bg-white/[0.03] ${
                                                selected > 0
                                                    ? 'border-blue-500 ring-2 ring-blue-100 dark:ring-blue-500/20'
                                                    : isOutOfStock
                                                    ? 'border-red-200 dark:border-red-500/30'
                                                    : 'border-gray-200 dark:border-white/10'
                                            }`}
                                        >
                                            <div className="mb-2 flex items-center gap-2">
                                                <img
                                                    src={
                                                        item.imagePath
                                                            ? resolveImageUrl(item.imagePath)
                                                            : '/images/image-placeholder.svg'
                                                    }
                                                    alt={item.name}
                                                    className="h-12 w-12 rounded-lg object-cover"
                                                    onError={(e) => {
                                                        (e.currentTarget as HTMLImageElement).src =
                                                            '/images/image-placeholder.svg';
                                                    }}
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <div className="truncate text-sm font-semibold text-gray-800 dark:text-gray-100">
                                                        {item.name}
                                                    </div>
                                                    <div className="text-sm text-gray-500 tabular-nums dark:text-gray-400">
                                                        ${item.price}
                                                    </div>
                                                </div>
                                            </div>
                                            <div
                                                className={`mb-2 text-xs ${
                                                    isOutOfStock
                                                        ? 'font-medium text-red-600 dark:text-red-400'
                                                        : 'text-gray-500 dark:text-gray-400'
                                                }`}
                                            >
                                                Stock: {item.quantity}{' '}
                                                {isOutOfStock && '(Out)'}
                                            </div>
                                            {/* Out-of-stock no longer blocks — the red badge warns, the
                                                counter goes negative, the sale goes through. */}
                                            {(item.variants?.filter(v => v.isActive !== false).length ?? 0) > 0 ? (
                                                <ItemVariantPicker
                                                    variants={item.variants!}
                                                    picks={selectedVariants[String(item.id)] ?? {}}
                                                    onChange={(next) => setVariantPicks(String(item.id), next)}
                                                    dense
                                                />
                                            ) : (
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    aria-label={`Remove one ${item.name}`}
                                                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-xl font-semibold text-gray-800 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white/10 dark:text-gray-100 dark:hover:bg-white/15"
                                                    disabled={selected === 0}
                                                    onClick={() => {
                                                        setSelectedItems((s) => {
                                                            const key = String(item.id);
                                                            const cur = s[key] || 0;
                                                            const next = Math.max(0, cur - 1);
                                                            const copy = { ...s };
                                                            if (next === 0) delete copy[key];
                                                            else copy[key] = next;
                                                            return copy;
                                                        });
                                                        if ((selectedItems[String(item.id)] || 0) <= 1) {
                                                            setSelectedAddOns((a) => { const c = { ...a }; delete c[String(item.id)]; return c; });
                                                        }
                                                    }}
                                                >
                                                    −
                                                </button>
                                                <div className="flex h-11 min-w-[44px] flex-1 items-center justify-center rounded-xl border border-gray-200 text-lg font-bold text-gray-900 tabular-nums dark:border-white/10 dark:text-white">
                                                    {selected}
                                                </div>
                                                <button
                                                    type="button"
                                                    aria-label={`Add one ${item.name}`}
                                                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-xl font-semibold text-white hover:bg-blue-700"
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
                                            )}
                                            {(item.addOns?.length ?? 0) > 0 && (
                                                <ItemAddOnsPanel
                                                    addOns={item.addOns!}
                                                    picks={selectedAddOns[String(item.id)] ?? {}}
                                                    onChange={(next) => setSelectedAddOns((prev) => {
                                                        const key = String(item.id);
                                                        const copy = { ...prev };
                                                        if (Object.keys(next).length === 0) delete copy[key]; else copy[key] = next;
                                                        return copy;
                                                    })}
                                                    onFirstPick={() => {
                                                        const key = String(item.id);
                                                        if (!(selectedItems[key] > 0)) setSelectedItems((s) => ({ ...s, [key]: 1 }));
                                                    }}
                                                />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Pagination */}
                            <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-3 dark:border-white/[0.06]">
                                <div className="text-sm text-gray-600 tabular-nums dark:text-gray-400">
                                    Page {page} — {total} items
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        className="h-11 rounded-xl bg-gray-100 px-4 text-sm font-medium text-gray-800 hover:bg-gray-200 disabled:opacity-50 dark:bg-white/10 dark:text-gray-100 dark:hover:bg-white/15"
                                        disabled={page <= 1}
                                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    >
                                        Prev
                                    </button>
                                    <button
                                        type="button"
                                        className="h-11 rounded-xl bg-gray-100 px-4 text-sm font-medium text-gray-800 hover:bg-gray-200 disabled:opacity-50 dark:bg-white/10 dark:text-gray-100 dark:hover:bg-white/15"
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
                    <div className="flex items-center gap-2 border-t border-gray-100 pt-4 dark:border-white/[0.06]">
                        <button
                            type="button"
                            className="h-12 flex-1 rounded-xl bg-gray-100 px-4 font-semibold text-gray-800 transition hover:bg-gray-200 dark:bg-white/10 dark:text-gray-100 dark:hover:bg-white/15"
                            onClick={closeAddItemsModal}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
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

            {/* Payment picker — cash / wallet / mixed */}
            {payingInvoice && (
                <PaymentChoiceModal
                    open
                    total={payingInvoice.totalPrice}
                    userId={payingInvoice.userId}
                    userName={payingInvoice.userName}
                    busy={closingInvoiceId === payingInvoice.id}
                    onCancel={() => setPayingInvoice(null)}
                    onConfirm={async (walletAmount) => {
                        const id = payingInvoice.id;
                        setPayingInvoice(null);
                        await handleCloseInvoice(id, walletAmount);
                    }}
                />
            )}

            {/* Attach / change client on an open invoice */}
            {clientModalInvoice && (
                <AttachClientModal
                    open
                    transactionId={clientModalInvoice.id}
                    currentUserId={clientModalInvoice.userId ?? null}
                    currentUserName={clientModalInvoice.userName ?? null}
                    onCancel={() => setClientModalInvoice(null)}
                    onSaved={(userId, userName) => {
                        // Patch in place — no full refetch needed for a name.
                        setOpenInvoices((list) =>
                            list.map((inv) =>
                                inv.id === clientModalInvoice.id
                                    ? { ...inv, userId: userId ?? undefined, userName: userName ?? undefined }
                                    : inv));
                        setClientModalInvoice(null);
                    }}
                />
            )}

            {/* Toast Notifications */}
            <div className="pointer-events-none fixed bottom-4 left-4 right-4 z-50 sm:bottom-6 sm:left-auto sm:right-6">
                {notification && (
                    <div className="pointer-events-auto ml-auto max-w-sm">
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
