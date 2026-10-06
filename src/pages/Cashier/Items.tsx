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
import PaymentChoiceModal from '../../components/wallet/PaymentChoiceModal';
import ItemAddOnsPanel from '../../components/items/ItemAddOnsPanel';
import { variantPickTotal, variantDeltaTotal } from '../../components/items/ItemVariantPicker';
import { getCategoriesByType, CategoryDto } from "../../services/categoryService";
import StatusToggle from '../../components/ui/StatusToggle';
import { STATUS_ENABLED, getStatusName, STATUS_PROCESSED_PAID } from '../../services/statuses';
import Select from "../../components/form/Select";
import ItemInvoice from "../../components/invoice/ItemInvoice";
import { getDiscounts, DiscountDto } from "../../services/discountService";
import { searchClientsByPhone, createClient, ClientUserDto } from "../../services/clientService";
import ChangeCalculator from "../../components/common/ChangeCalculator";
import { getSets, SetDto } from '../../services/setService';
import { getChannels, ChannelDto } from '../../services/channelService';
import { getItemsWithoutRecipe } from '../../services/recipeService';
import { Panel, Pill, StatTile } from '../../components/ui/PageKit';
import PosCategoryBar from '../../components/till/pos/PosCategoryBar';
import PosItemCard from '../../components/till/pos/PosItemCard';
import PosVariantPicker from '../../components/till/pos/PosVariantPicker';
import PosCartLine from '../../components/till/pos/PosCartLine';
import PosTotals from '../../components/till/pos/PosTotals';
import QtyStepper from '../../components/till/pos/QtyStepper';
import PosItemGridSkeleton from '../../components/till/pos/PosItemGridSkeleton';
import { POS_GRID_CLASS } from '../../components/till/pos/posGrid';

// Line shape of the order-create response (data.items), as used below.
type OrderResponseLine = {
    itemId: number;
    itemName: string;
    quantity: number;
    price: number;
    type?: string;
    isIncluded?: boolean;
    addOns?: ItemTransaction['items'][number]['addOns'];
};


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
    // Chosen paid extras per item: itemId -> addOnId -> qty. Rides the order
    // request and shows as sublines on the receipt.
    const [selectedAddOns, setSelectedAddOns] = useState<Record<string, Record<number, number>>>({});
    // Colour / type picks per item: itemId -> variantId -> qty. For items with
    // options the line quantity IS the sum of these picks.
    const [selectedVariants, setSelectedVariants] = useState<Record<string, Record<number, number>>>({});
    const setVariantPicks = (itemId: string, next: Record<number, number>) => {
        setSelectedVariants(prev => { const c = { ...prev }; if (Object.keys(next).length === 0) delete c[itemId]; else c[itemId] = next; return c; });
        const total = variantPickTotal(next);
        setSelectedItems(s => { const c = { ...s }; if (total <= 0) delete c[itemId]; else c[itemId] = total; return c; });
        if (total <= 0) setSelectedAddOns(a => { const c = { ...a }; delete c[itemId]; return c; });
    };
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
    // Payment picker for Pay Now when a client is attached (wallet option).
    const [payNowChoiceOpen, setPayNowChoiceOpen] = useState(false);

    // Client search states
    const [clientPhone, setClientPhone] = useState('');
    const [searchingClient, setSearchingClient] = useState(false);
    const [clientResults, setClientResults] = useState<ClientUserDto[]>([]);
    const [selectedClient, setSelectedClient] = useState<ClientUserDto | null>(null);
    // Quick-create when the phone search finds nobody.
    const [clientNotFound, setClientNotFound] = useState(false);
    const [showCreateClient, setShowCreateClient] = useState(false);
    const [newClientFirst, setNewClientFirst] = useState('');
    const [newClientLast, setNewClientLast] = useState('');
    const [creatingClient, setCreatingClient] = useState(false);

    async function quickCreateClient() {
        if (!newClientFirst.trim()) {
            setNotification({ variant: 'warning', title: 'Missing name', message: 'First name is required.' });
            return;
        }
        setCreatingClient(true);
        try {
            const res = await createClient({
                phoneNumber: clientPhone.trim(),
                firstName: newClientFirst.trim(),
                lastName: newClientLast.trim(),
                email: '',
            });
            const created = {
                id: res.id,
                phoneNumber: res.phoneNumber,
                firstName: res.firstName ?? newClientFirst.trim(),
                lastName: res.lastName ?? newClientLast.trim(),
                email: null,
            } as unknown as ClientUserDto;
            setClientResults([created]);
            setSelectedClient(created);          // selected immediately
            setClientNotFound(false);
            setShowCreateClient(false);
            setNewClientFirst(''); setNewClientLast('');
            setNotification({ variant: 'success', title: 'Client created', message: 'Created and attached to this order.' });
        } catch (err: unknown) {
            const e = err as { response?: { data?: { message?: string } } };
            setNotification({ variant: 'error', title: 'Create failed', message: e?.response?.data?.message || 'Could not create the client.' });
        } finally {
            setCreatingClient(false);
        }
    }

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
            const variantDelta = variantDeltaTotal(item?.variants, selectedVariants[String(itemId)]);
            const lineTotal = unit * qty + variantDelta;
            const image = item?.imagePath ? resolveImageUrl(item.imagePath) : '';
            const variantNote = Object.entries(selectedVariants[String(itemId)] ?? {})
                .map(([vid, vq]) => { const def = item?.variants?.find(v => v.id === Number(vid)); return def && vq > 0 ? `${vq}× ${def.name}` : null; })
                .filter(Boolean).join(', ');
            return { itemId, name, qty, unit, lineTotal, image, variantNote };
        });

    // Add-on sublines per order line (looked up from the item's catalog).
    const addOnLinesFor = (itemId: string) => {
        const picks = selectedAddOns[itemId];
        const item = itemLookup[itemId];
        if (!picks || !item?.addOns) return [] as Array<{ addOnId: number; name: string; qty: number; unit: number; total: number }>;
        return Object.entries(picks)
            .map(([addOnId, qty]) => {
                const def = item.addOns!.find(a => a.id === Number(addOnId));
                if (!def || qty <= 0) return null;
                return { addOnId: def.id, name: def.name, qty, unit: def.price, total: def.price * qty };
            })
            .filter((x): x is { addOnId: number; name: string; qty: number; unit: number; total: number } => x !== null);
    };

    const addOnsSubtotal = orderLines.reduce(
        (s, l) => s + addOnLinesFor(String(l.itemId)).reduce((a, x) => a + x.total, 0), 0);

    const orderSubtotal = orderLines.reduce((s, l) => s + l.lineTotal, 0) + addOnsSubtotal;

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
            setClientNotFound((results || []).length === 0);
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

    // Pay-now submit, extracted so the payment picker can pass a wallet
    // amount. walletAmount = 0 is a plain cash sale.
    const submitPayNow = async (walletAmount = 0) => {
                                                    const orderItems = Object.entries(selectedItems)
                                                        .filter(([, q]) => q > 0)
                                                        .map(([itemId, q]) => ({
                                                            itemId: parseInt(itemId), quantity: q,
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
                                                            selectedChannelId,
                                                            walletAmount
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
                                                                items: response.data.items?.map((item: OrderResponseLine) => ({
                                                                    itemId: item.itemId,
                                                                    itemName: item.itemName,
                                                                    quantity: item.quantity,
                                                                    unitPrice: item.price,
                                                                    lineTotal: item.price * item.quantity,
                                                                    categoryName: '',
                                                                    itemType: item.type || '',
                                                                    isIncluded: !!item.isIncluded,
                                                                    addOns: item.addOns || [],
                                                                })) || []
                                                            };

                                                            setCurrentInvoice(invoiceData);
                                                            setInvoiceModalOpen(true);

                                                            // Kitchen/bar tickets print server-side: the API
                                                            // dispatches ESC/POS jobs over SignalR to the
                                                            // printers configured in Admin -> Printers, via
                                                            // the on-site print agent.
                                                        }

                                                        setSelectedItems({}); setSelectedAddOns({}); setSelectedVariants({});
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
    };

    // Pay-later (open invoice) submit. Same request and reset as before —
    // only lifted out of the button's inline onClick so the drawer footer
    // stays readable.
    const submitPayLater = async () => {
        const orderItems = Object.entries(selectedItems)
            .filter(([, q]) => q > 0)
            .map(([itemId, q]) => ({
                itemId: parseInt(itemId), quantity: q,
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
                    items: response.data.items?.map((item: OrderResponseLine) => ({
                        itemId: item.itemId,
                        itemName: item.itemName,
                        quantity: item.quantity,
                        unitPrice: item.price,
                        lineTotal: item.price * item.quantity,
                        categoryName: '',
                        itemType: item.type || '',
                        isIncluded: !!item.isIncluded,
                        addOns: item.addOns || [],
                    })) || []
                };

                setCurrentInvoice(invoiceData);
                setInvoiceModalOpen(true);

                // Kitchen/bar tickets print server-side: the API
                // dispatches ESC/POS jobs over SignalR to the
                // printers configured in Admin -> Printers, via
                // the on-site print agent.
            }

            setSelectedItems({}); setSelectedAddOns({}); setSelectedVariants({});
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
    };

    // −1 / +1 on a plain (no-options) item. Shared by the item card and the
    // cart line; the logic is exactly what the card's buttons always did.
    const decItem = (key: string) => {
        setSelectedItems(s => {
            const cur = s[key] || 0;
            const next = Math.max(0, cur - 1);
            const copy = { ...s };
            if (next === 0) delete copy[key]; else copy[key] = next;
            return copy;
        });
        // No item, no extras.
        setSelectedAddOns(a => {
            if ((selectedItems[key] || 0) > 1) return a;
            const copy = { ...a };
            delete copy[key];
            return copy;
        });
    };
    const incItem = (key: string) => setSelectedItems(s => {
        const cur = s[key] || 0;
        return { ...s, [key]: cur + 1 };
    });
    const hasActiveVariants = (it?: ItemDto) => (it?.variants?.filter(v => v.isActive !== false).length ?? 0) > 0;

    const openOrderDrawer = () => { setOrderTimestamp(new Date()); setIsDrawerOpen(true); };
    const clearOrder = () => { setSelectedItems({}); setSelectedAddOns({}); setSelectedVariants({}); };

    const fieldLabel = "mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-200";

    return (
        <div className="pb-24 lg:pb-0">
            {/* Compact till header */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/25">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                    </span>
                    <div className="min-w-0">
                        <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">Items</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Tap + to build the order, then review and send it.</p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => setCalculatorOpen(true)}
                    className="flex h-11 items-center gap-2 rounded-xl bg-green-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 hover:shadow"
                >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    Calculator
                </button>
            </div>

            <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
                {/* ───────── Catalog column ───────── */}
                <div className="min-w-0">
                    <div className="mb-4 space-y-3">
                        <div className="w-full sm:max-w-sm">
                            {/* Icon lives in the placeholder rather than as an overlay —
                                the shared Input sets its own horizontal padding, and an
                                absolutely-positioned icon could collide with it. */}
                            <Input placeholder="🔍  Search items…" value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} />
                        </div>
                        <PosCategoryBar
                            categories={categories}
                            selected={selectedCategory}
                            onSelect={(id) => { setPage(1); setSelectedCategory(id); }}
                        />
                    </div>

                    {loading && <PosItemGridSkeleton count={pageSize} />}

                    {error && (
                        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                            {error}
                        </div>
                    )}

                    {!loading && !error && (
                        <div>
                            {items.length === 0 ? (
                                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center dark:border-white/10 dark:bg-white/[0.03]">
                                    <div className="text-base font-semibold text-gray-900 dark:text-white">No items found</div>
                                    <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">Try another category or search.</div>
                                </div>
                            ) : (
                                <div className={POS_GRID_CLASS}>
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
                                            <PosItemCard
                                                key={it.id}
                                                name={it.name}
                                                imageSrc={it.imagePath ? resolveImageUrl(it.imagePath) : ''}
                                                categoryName={categories.find(c => c.id === it.categoryId)?.name ?? '—'}
                                                priceLabel={`$${it.price}`}
                                                picked={picked}
                                                outOfStock={isOutOfStock}
                                                stock={
                                                    isOutOfStock ? { label: 'Out of stock', tone: 'red' }
                                                    : hasRecipe ? { label: 'Recipe stock', tone: 'blue' }
                                                    : isLowStock ? { label: `Only ${it.quantity} left`, tone: 'amber' }
                                                    : { label: `${it.quantity} in stock`, tone: 'neutral' }
                                                }
                                            >
                                                {hasActiveVariants(it) ? (
                                                    /* Options with own stock: pick per colour; the item qty is the sum. */
                                                    <PosVariantPicker
                                                        itemName={it.name}
                                                        variants={it.variants!}
                                                        picks={selectedVariants[String(it.id)] ?? {}}
                                                        onChange={(next) => setVariantPicks(String(it.id), next)}
                                                    />
                                                ) : (
                                                    /* Out-of-stock no longer blocks ordering — the badge warns,
                                                        the counter goes negative, the sale goes through. */
                                                    <QtyStepper
                                                        fluid
                                                        label={it.name}
                                                        value={picked}
                                                        decDisabled={picked === 0}
                                                        onDec={() => decItem(String(it.id))}
                                                        onInc={() => incItem(String(it.id))}
                                                    />
                                                )}

                                                {/* Add-ons live on the card — tap to expand, pick right here */}
                                                {(it.addOns?.length ?? 0) > 0 && (
                                                    <ItemAddOnsPanel
                                                        addOns={it.addOns!}
                                                        picks={selectedAddOns[String(it.id)] ?? {}}
                                                        onChange={(next) => setSelectedAddOns((prev) => {
                                                            const key = String(it.id);
                                                            const copy = { ...prev };
                                                            if (Object.keys(next).length === 0) delete copy[key]; else copy[key] = next;
                                                            return copy;
                                                        })}
                                                        onFirstPick={() => {
                                                            // Picking an extra implies they want the item.
                                                            const key = String(it.id);
                                                            if (!(selectedItems[key] > 0)) setSelectedItems(s => ({ ...s, [key]: 1 }));
                                                        }}
                                                    />
                                                )}
                                            </PosItemCard>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Pagination */}
                            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                                <div className="text-sm text-gray-500 tabular-nums dark:text-gray-400">Page {page} · {total} items</div>
                                <div className="flex items-center gap-2">
                                    <button type="button" className="h-11 rounded-xl border border-gray-200 bg-white px-5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-200 dark:hover:bg-white/[0.06]" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>← Prev</button>
                                    <button type="button" className="h-11 rounded-xl border border-gray-200 bg-white px-5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-200 dark:hover:bg-white/[0.06]" disabled={page >= Math.max(1, Math.ceil(total / pageSize))} onClick={() => setPage(p => p + 1)}>Next →</button>
                                </div>
                            </div>

                            {/* Drawer backdrop (fades) */}
                            <div className={`fixed inset-0 z-30 transition-opacity ${isDrawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} aria-hidden>
                                <div className="absolute inset-0 bg-black/40" onClick={() => setIsDrawerOpen(false)} />
                            </div>

                            {/* Sliding order panel: offset from top to avoid overlapping navbar (adjust 64px if your header height differs) */}
                            <div
                                className="fixed right-0 z-40"
                                style={{
                                    top: '64px',
                                    height: 'calc(100% - 64px)',
                                    width: 'min(420px, 100vw)',
                                    transition: 'transform 300ms ease',
                                    transform: isDrawerOpen ? 'translateX(0)' : 'translateX(100%)',
                                }}
                            >
                                <div className="flex h-full flex-col border-l border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-gray-900">
                                    <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-white/[0.06]">
                                        <div className="min-w-0">
                                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Order Summary</h3>
                                            <div className="text-xs text-gray-500 tabular-nums dark:text-gray-400">Date: {orderTimestamp ? orderTimestamp.toLocaleDateString() : ''} {orderTimestamp ? orderTimestamp.toLocaleTimeString() : ''}</div>
                                        </div>
                                        <button type="button" className="h-11 shrink-0 rounded-xl border border-gray-200 px-4 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/[0.06]" onClick={() => setIsDrawerOpen(false)}>Close</button>
                                    </div>

                                    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
                                        {/* Receipt lines */}
                                        <div className="rounded-2xl border border-gray-200/80 bg-gray-50/60 px-3 dark:border-white/[0.06] dark:bg-white/[0.03]">
                                            <div className="flex items-center justify-between border-b border-gray-200/80 py-2.5 dark:border-white/[0.06]">
                                                <span className="text-sm font-semibold text-gray-900 dark:text-white">Receipt</span>
                                                <Pill tone="violet">{totalSelected} item{totalSelected === 1 ? '' : 's'}</Pill>
                                            </div>
                                            {orderLines.length === 0 && <div className="py-4 text-sm text-gray-500 dark:text-gray-400">No items</div>}
                                            <div className="divide-y divide-gray-200/80 dark:divide-white/[0.06]">
                                                {orderLines.map((l) => (
                                                    <PosCartLine
                                                        key={l.itemId}
                                                        name={l.name}
                                                        image={l.image}
                                                        qty={l.qty}
                                                        unit={l.unit}
                                                        lineTotal={l.lineTotal}
                                                        variantNote={l.variantNote}
                                                        addOns={addOnLinesFor(String(l.itemId))}
                                                    />
                                                ))}
                                            </div>
                                        </div>

                                        {/* Discount Selection */}
                                        <div>
                                            <label className={fieldLabel}>Apply Discount</label>
                                            {loadingDiscounts ? (
                                                <div className="h-11 animate-pulse rounded-lg bg-gray-100 px-4 text-xs leading-[44px] text-gray-500 dark:bg-white/5 dark:text-gray-400">Loading discounts...</div>
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
                                        <div>
                                            <label className={fieldLabel}>Client (Optional)</label>
                                            <div className="flex gap-2">
                                                <div className="min-w-0 flex-1">
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
                                                </div>
                                                <button
                                                    type="button"
                                                    className="flex h-11 min-w-[88px] shrink-0 items-center justify-center rounded-xl bg-gray-100 px-4 text-sm font-semibold text-gray-800 transition hover:bg-gray-200 disabled:opacity-60 dark:bg-white/10 dark:text-gray-100 dark:hover:bg-white/15"
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

                                            {/* Nobody found → create them here, phone prefilled */}
                                            {clientNotFound && !searchingClient && clientPhone.trim() !== '' && (
                                                <div className="mt-2 rounded-xl border border-dashed border-gray-300 p-3 dark:border-white/15">
                                                    {!showCreateClient ? (
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className="text-sm text-gray-500 dark:text-gray-400">No client with "{clientPhone.trim()}".</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => setShowCreateClient(true)}
                                                                className="h-11 shrink-0 rounded-xl bg-indigo-600 px-3 text-sm font-semibold text-white hover:bg-indigo-700"
                                                            >
                                                                + Create client
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            <div className="text-sm text-gray-500 dark:text-gray-400">New client — phone <b className="text-gray-800 dark:text-gray-200">{clientPhone.trim()}</b></div>
                                                            <div className="flex gap-2">
                                                                <div className="min-w-0 flex-1"><Input placeholder="First name" value={newClientFirst} onChange={(e) => setNewClientFirst(e.target.value)} /></div>
                                                                <div className="min-w-0 flex-1"><Input placeholder="Last name" value={newClientLast} onChange={(e) => setNewClientLast(e.target.value)} /></div>
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <button
                                                                    type="button"
                                                                    disabled={creatingClient}
                                                                    onClick={quickCreateClient}
                                                                    className="h-11 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                                                                >
                                                                    {creatingClient ? 'Creating…' : 'Create & attach'}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setShowCreateClient(false)}
                                                                    className="h-11 rounded-xl border border-gray-200 px-4 text-sm font-semibold text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/[0.06]"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            {selectedClient && (
                                                <div className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-blue-50 py-1 pl-3 pr-1 text-sm text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                                                    <span className="min-w-0 truncate">Selected: <b>{(() => {
                                                        const firstName = selectedClient.firstName || '';
                                                        const lastName = selectedClient.lastName || '';
                                                        const fullName = `${firstName} ${lastName}`.trim();
                                                        return fullName || selectedClient.email || 'Unknown';
                                                    })()}</b></span>
                                                    <button
                                                        type="button"
                                                        aria-label="Remove client"
                                                        onClick={() => {
                                                            setSelectedClient(null);
                                                            setClientResults([]);
                                                            setClientPhone('');
                                                        }}
                                                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-blue-600 hover:bg-blue-100 hover:text-blue-800 dark:text-blue-300 dark:hover:bg-blue-500/20"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Set Selection */}
                                        <div>
                                            <label className={fieldLabel}>Set/Table (Optional)</label>
                                            {loadingSets ? (
                                                <div className="h-11 animate-pulse rounded-lg bg-gray-100 px-4 text-xs leading-[44px] text-gray-500 dark:bg-white/5 dark:text-gray-400">Loading sets...</div>
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
                                        <div>
                                            <label className={fieldLabel}>Channel (Optional)</label>
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
                                        <div>
                                            <label className={fieldLabel}>Comment (Optional)</label>
                                            <textarea
                                                value={comment}
                                                onChange={(e) => setComment(e.target.value)}
                                                placeholder="Add any notes or comments..."
                                                rows={3}
                                                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-white/10 dark:bg-gray-900/60 dark:text-white dark:placeholder:text-white/30"
                                            />
                                        </div>
                                    </div>

                                    {/* Totals + payment — always visible at the bottom of the panel */}
                                    <div className="space-y-3 border-t border-gray-200 bg-gray-50/80 px-4 py-4 dark:border-white/10 dark:bg-white/[0.03]">
                                        <PosTotals
                                            subtotal={orderSubtotal}
                                            discount={selectedDiscount}
                                            discountAmount={discountAmount}
                                            total={orderTotal}
                                        />

                                        {/* Pay Now Button */}
                                        <button
                                            type="button"
                                            className="flex h-14 w-full items-center justify-center rounded-xl bg-green-600 px-4 text-lg font-semibold text-white shadow-sm shadow-green-600/25 transition hover:bg-green-700 active:bg-green-800 disabled:opacity-60"
                                            disabled={orderSubmitting}
                                            onClick={() => {
                                                // Wallet option only exists with an attached client;
                                                // plain cash keeps the fast path fast.
                                                if (selectedClient?.id) setPayNowChoiceOpen(true);
                                                else void submitPayNow(0);
                                            }}
                                        >
                                            {orderSubmitting ? <Loader size={16} /> : 'Pay Now & Close'}
                                        </button>

                                        {/* Pay Later Button */}
                                        <button
                                            type="button"
                                            className="flex h-12 w-full items-center justify-center rounded-xl bg-orange-600 px-4 text-base font-semibold text-white transition hover:bg-orange-700 active:bg-orange-800 disabled:opacity-60"
                                            disabled={orderSubmitting}
                                            onClick={submitPayLater}
                                        >
                                            {orderSubmitting ? <Loader size={16} /> : 'Pay Later (Open Invoice)'}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Invoices Section */}
                            <div className="mt-8">
                                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">My Invoices</h2>
                                    <button
                                        type="button"
                                        onClick={() => setShowInvoicesSection(!showInvoicesSection)}
                                        className="h-11 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700"
                                    >
                                        {showInvoicesSection ? 'Hide Invoices' : 'Show Invoices'}
                                    </button>
                                </div>

                                {showInvoicesSection && (
                                    <div className="space-y-4">
                                        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                                            {/* Date Filter Buttons */}
                                            <Panel bodyClassName="p-5">
                                                <div className="mb-2 text-sm text-gray-500 dark:text-gray-400">Filter by:</div>
                                                <div className="inline-flex rounded-xl bg-gray-100 p-1 dark:bg-white/5">
                                                    {[
                                                        { value: 'today', label: 'Today' },
                                                        { value: 'yesterday', label: 'Yesterday' },
                                                    ].map((filter) => (
                                                        <button
                                                            key={filter.value}
                                                            type="button"
                                                            aria-pressed={dateFilter === filter.value}
                                                            onClick={() => setDateFilter(filter.value as typeof dateFilter)}
                                                            className={`h-11 rounded-lg px-5 text-sm font-semibold transition ${dateFilter === filter.value
                                                                ? 'bg-white text-indigo-700 shadow-sm dark:bg-white/10 dark:text-white'
                                                                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                                                                }`}
                                                        >
                                                            {filter.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </Panel>

                                            {/* Total Fees Widget */}
                                            <StatTile
                                                label="Total Fees"
                                                value={<span className="tabular-nums">${totalInvoices.toFixed(2)}</span>}
                                                sub={dateFilter === 'today' ? 'Today' : 'Yesterday'}
                                                loading={loadingInvoices}
                                            />
                                        </div>

                                        {/* Invoices List */}
                                        <Panel bodyClassName="p-4 sm:p-5">
                                            {loadingInvoices && (
                                                <div className="flex justify-center py-10">
                                                    <Loader />
                                                </div>
                                            )}

                                            {!loadingInvoices && userInvoices.length === 0 && (
                                                <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                                                    No invoices found
                                                </div>
                                            )}

                                            {!loadingInvoices && userInvoices.length > 0 && (
                                                <div className="space-y-3">
                                                    {userInvoices.map((invoice) => (
                                                        <button
                                                            type="button"
                                                            key={invoice.transactionId}
                                                            className="block w-full rounded-xl border border-gray-200/80 p-4 text-left transition hover:border-gray-300 hover:shadow-md dark:border-white/[0.06] dark:hover:border-white/15"
                                                            onClick={() => {
                                                                setCurrentInvoice(invoice);
                                                                setInvoiceModalOpen(true);
                                                            }}
                                                        >
                                                            <div className="flex items-start justify-between gap-4">
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="mb-2 flex flex-wrap items-center gap-2">
                                                                        <span className="text-base font-semibold text-gray-900 dark:text-white">
                                                                            Invoice #{invoice.transactionId}
                                                                        </span>
                                                                        <Pill
                                                                            dot
                                                                            tone={invoice.statusId === STATUS_ENABLED || invoice.statusId === STATUS_PROCESSED_PAID ? 'emerald' : 'gray'}
                                                                        >
                                                                            {getStatusName(invoice.statusId) || 'Unknown'}
                                                                        </Pill>
                                                                    </div>
                                                                    <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
                                                                        <div>
                                                                            <p className="text-gray-500 dark:text-gray-400">Date</p>
                                                                            <p className="font-medium text-gray-800 dark:text-gray-200">
                                                                                {new Date(invoice.createdOn).toLocaleDateString()}
                                                                            </p>
                                                                        </div>
                                                                        {invoice.roomName && (
                                                                            <div>
                                                                                <p className="text-gray-500 dark:text-gray-400">Room</p>
                                                                                <p className="font-medium text-gray-800 dark:text-gray-200">{invoice.roomName}</p>
                                                                            </div>
                                                                        )}
                                                                        <div>
                                                                            <p className="text-gray-500 dark:text-gray-400">Items</p>
                                                                            <p className="font-medium text-gray-800 dark:text-gray-200">
                                                                                {invoice.items?.length || 0} item{(invoice.items?.length || 0) !== 1 ? 's' : ''}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="shrink-0 text-right">
                                                                    <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
                                                                    <p className="text-2xl font-bold tabular-nums text-gray-900 dark:text-white">
                                                                        ${invoice.totalPrice.toFixed(2)}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </Panel>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* ───────── Sticky cart (lg+) ───────── */}
                <aside className="hidden lg:sticky lg:top-[88px] lg:block" aria-label="Current order">
                    <div className="flex max-h-[calc(100vh-108px)] flex-col overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:border-white/[0.06] dark:bg-white/[0.03]">
                        <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-2 dark:border-white/[0.06]">
                            <div className="flex min-w-0 items-center gap-2">
                                <h2 className="text-[15px] font-semibold text-gray-900 dark:text-white">Current order</h2>
                                <Pill tone={totalSelected > 0 ? 'violet' : 'gray'}>{totalSelected} item{totalSelected === 1 ? '' : 's'}</Pill>
                            </div>
                            <button
                                type="button"
                                disabled={totalSelected === 0}
                                onClick={clearOrder}
                                className="h-11 shrink-0 rounded-xl px-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 disabled:invisible dark:text-gray-300 dark:hover:bg-white/[0.06] dark:hover:text-white"
                            >
                                Clear
                            </button>
                        </div>

                        <div className="min-h-[120px] flex-1 overflow-y-auto px-4">
                            {orderLines.length === 0 ? (
                                <div className="flex h-full min-h-[160px] flex-col items-center justify-center py-8 text-center">
                                    <div className="text-sm font-semibold text-gray-900 dark:text-white">No items yet</div>
                                    <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">Tap + on an item to start the order.</div>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-100 dark:divide-white/[0.06]">
                                    {orderLines.map((l) => {
                                        const key = String(l.itemId);
                                        return (
                                            <PosCartLine
                                                key={l.itemId}
                                                name={l.name}
                                                image={l.image}
                                                qty={l.qty}
                                                unit={l.unit}
                                                lineTotal={l.lineTotal}
                                                variantNote={l.variantNote}
                                                addOns={addOnLinesFor(key)}
                                                controls={hasActiveVariants(itemLookup[key]) ? (
                                                    <div className="text-xs text-gray-500 dark:text-gray-400">Change options on the item card.</div>
                                                ) : (
                                                    <QtyStepper
                                                        label={l.name}
                                                        value={l.qty}
                                                        decDisabled={l.qty === 0}
                                                        onDec={() => decItem(key)}
                                                        onInc={() => incItem(key)}
                                                    />
                                                )}
                                            />
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="space-y-3 border-t border-gray-200 bg-gray-50/80 px-4 py-4 dark:border-white/10 dark:bg-white/[0.02]">
                            <PosTotals
                                subtotal={orderSubtotal}
                                discount={selectedDiscount}
                                discountAmount={discountAmount}
                                total={orderTotal}
                            />
                            <button
                                type="button"
                                disabled={totalSelected === 0}
                                onClick={openOrderDrawer}
                                className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-lg font-semibold text-white shadow-sm shadow-indigo-600/25 transition hover:bg-indigo-700 active:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                View Order &amp; Pay →
                            </button>
                        </div>
                    </div>
                </aside>
            </div>

            {/* Floating order bar (below lg, where there's no side cart) —
                always in reach once something's picked, no matter how far
                the cashier has scrolled. */}
            {totalSelected > 0 && (
                <div className="fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-xl items-center gap-2 rounded-2xl bg-gray-900 py-2 pl-4 pr-2 text-white shadow-2xl lg:hidden dark:bg-gray-800 dark:ring-1 dark:ring-white/10">
                    <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-gray-300">
                            🛒 {totalSelected} item{totalSelected === 1 ? '' : 's'} selected
                        </div>
                        <div className="text-xl font-bold leading-tight tabular-nums">${orderTotal.toFixed(2)}</div>
                    </div>
                    <button
                        type="button"
                        className="h-11 shrink-0 rounded-xl px-3 text-sm font-semibold text-gray-300 transition hover:bg-white/10 hover:text-white"
                        onClick={clearOrder}
                    >
                        Clear
                    </button>
                    <button
                        type="button"
                        className="h-12 shrink-0 rounded-xl bg-indigo-500 px-5 text-base font-semibold text-white transition hover:bg-indigo-400 active:scale-95"
                        onClick={openOrderDrawer}
                    >
                        View Order →
                    </button>
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

            {/* Payment picker — cash / wallet / mixed, shown for Pay Now when
                a client is attached */}
            <PaymentChoiceModal
                open={payNowChoiceOpen}
                total={orderTotal}
                userId={selectedClient?.id}
                userName={selectedClient ? `${selectedClient.firstName || ''} ${selectedClient.lastName || ''}`.trim() || selectedClient.phoneNumber : null}
                busy={orderSubmitting}
                onCancel={() => setPayNowChoiceOpen(false)}
                onConfirm={async (walletAmount) => {
                    setPayNowChoiceOpen(false);
                    await submitPayNow(walletAmount);
                }}
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
