import { useEffect, useState } from "react";
import {
    Button,
    Dropdown,
    Empty,
    Input as AntInput,
    Segmented,
    Select as AntSelect,
    Skeleton,
    Table,
    Tooltip,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
    AppstoreOutlined,
    DeleteOutlined,
    EditOutlined,
    ExperimentOutlined,
    MoreOutlined,
    PictureOutlined,
    PlusOutlined,
    ReloadOutlined,
    SearchOutlined,
    ShoppingCartOutlined,
    WarningOutlined,
} from "@ant-design/icons";
import {
    getItems,
    getItem,
    createItem,
    updateItem,
    deleteItem,
    ItemDto,
    ItemListResponse,
} from "../../services/itemService";
import Modal from "../../components/ui/Modal";
import Select from "../../components/form/Select";
import Input from "../../components/form/input/InputField";
import Loader from "../../components/ui/Loader";
import Alert from "../../components/ui/alert/Alert";
import { getCategoriesByType, CategoryDto } from "../../services/categoryService";
import { getItemAddOns, setItemAddOns, getItemVariants, setItemVariants } from "../../services/itemService";
import { getStatusName, STATUS_ENABLED, STATUS_DISABLED } from '../../services/statuses';
import StatusToggle from '../../components/ui/StatusToggle';
import RecipeEditorModal from '../../components/stock/RecipeEditorModal';
import { PageHeader, Panel, Pill, StatTile } from "../../components/ui/PageKit";
import PagerFooter from "../../components/inventory/PagerFooter";

const PLACEHOLDER_IMG = '/images/image-placeholder.svg';

// Stock thresholds for the list badge: nothing left (or oversold) = Out, a handful = Low.
const LOW_STOCK_MAX = 5;
const stockLevel = (qty: number) => (qty <= 0 ? "out" : qty <= LOW_STOCK_MAX ? "low" : "ok");

const STATUS_FILTERS = [
    { value: STATUS_ENABLED, label: 'Enabled' },
    { value: STATUS_DISABLED, label: 'Disabled' },
    { value: 3, label: 'Deleted' },
    { value: 0, label: 'All' },
];

const usd = (n: number) => `$${Number(n).toFixed(2)}`;

export default function Items() {
    const [items, setItems] = useState<ItemDto[]>([]);
    const [categories, setCategories] = useState<CategoryDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalCount, setTotalCount] = useState<number | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
    const [search, setSearch] = useState('');
    // 1 Enabled (default), 2 Disabled, 3 Deleted, 0 all
    const [statusFilter, setStatusFilter] = useState<number>(STATUS_ENABLED);
    const [debouncedSearch, setDebouncedSearch] = useState('');
    // Bumped by the Refresh button to re-run the same list request.
    const [reloadToken, setReloadToken] = useState(0);

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
        sellOnline: true,
        weightKg: null,
    });
    const [submitting, setSubmitting] = useState(false);

    // image upload states
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    // Recipe editor modal state — opens when chef clicks "Recipe" on a row.
    const [recipeItem, setRecipeItem] = useState<ItemDto | null>(null);

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

    // cleanup object URL on unmount
    useEffect(() => {
        return () => {
            if (imagePreview) {
                try { URL.revokeObjectURL(imagePreview); } catch (e) { void e; }
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        let mounted = true;
        setLoading(true);
        getItems(page, pageSize, selectedCategory, debouncedSearch, statusFilter)
            .then((data: ItemListResponse) => {
                if (!mounted) return;
                setItems(data.data || []);
                setTotalCount(data.totalCount ?? null);
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
    }, [page, pageSize, selectedCategory, debouncedSearch, statusFilter, reloadToken]);

    // Debounce search input (300ms)
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 300);
        return () => clearTimeout(t);
    }, [search]);

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
        return () => { mounted = false; };
    }, []);

    // ── Add-ons editor rows (paid extras like "Oat Milk +$1") ──────────
    const [addOnRows, setAddOnRows] = useState<Array<{ id?: number; name: string; price: number | ''; isActive: boolean }>>([]);
    const [addOnsLoading, setAddOnsLoading] = useState(false);
    // ── Variants (colour / type with own stock) ────────────────────────
    type VariantRow = { id?: number; name: string; color: string; priceDelta: number | ''; quantity: number | ''; isActive: boolean };
    const [variantRows, setVariantRows] = useState<VariantRow[]>([]);
    const [variantsLoading, setVariantsLoading] = useState(false);
    const variantStockTotal = variantRows.filter(v => v.isActive).reduce((s, v) => s + (Number(v.quantity) || 0), 0);

    function openCreate() {
        setEditing(null);
        setAddOnRows([]);
        setVariantRows([]);
        setForm({ name: "", quantity: 0, price: 0, type: "", categoryId: null, buyPrice: null, gameId: null, statusId: STATUS_ENABLED, sellOnline: true, weightKg: null });
        // clear any previous selected image
        if (imagePreview) { try { URL.revokeObjectURL(imagePreview); } catch (e) { void e; } }
        setImageFile(null);
        setImagePreview(null);
        setIsFormOpen(true);
    }

    function openEdit(item: ItemDto) {
        setEditing(item);
        setForm({ name: item.name, quantity: item.quantity, price: item.price, type: item.type, categoryId: item.categoryId, buyPrice: item.buyPrice,
             gameId: item.gameId, statusId: item.statusId ?? null,
             sellOnline: item.sellOnline ?? true, weightKg: item.weightKg ?? null });
        // prefill image preview if available
        if (item.imagePath) {
            const resolved = resolveImageUrl(item.imagePath);
            setImagePreview(resolved);
        } else {
            setImagePreview(null);
        }
        setImageFile(null);
        setIsFormOpen(true);

        // Load ALL add-ons (inactive included) for the editor.
        setAddOnsLoading(true);
        getItemAddOns(item.id)
            .then((list) => setAddOnRows(list.map(a => ({ id: a.id, name: a.name, price: a.price, isActive: a.isActive }))))
            .catch(() => setAddOnRows([]))
            .finally(() => setAddOnsLoading(false));

        setVariantsLoading(true);
        getItemVariants(item.id)
            .then((list) => setVariantRows(list.map(v => ({ id: v.id, name: v.name, color: v.color ?? '', priceDelta: v.priceDelta, quantity: v.quantity, isActive: v.isActive }))))
            .catch(() => setVariantRows([]))
            .finally(() => setVariantsLoading(false));
    }

    async function saveVariants(itemId: string | number) {
        const payload = variantRows
            .filter(r => r.name.trim() !== '')
            .map(r => ({ id: r.id ?? null, name: r.name.trim(), color: r.color.trim() || null, priceDelta: Number(r.priceDelta) || 0, quantity: Number(r.quantity) || 0, isActive: r.isActive }));
        if (payload.length === 0 && !editing) return;   // nothing to sync on a fresh item
        try {
            await setItemVariants(itemId, payload);
        } catch (e: unknown) {
            const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
            setNotification({ variant: "error", title: "Options", message: msg ?? "Item saved, but colour/type options failed to save. Reopen and try again." });
        }
    }

    async function saveAddOns(itemId: string | number) {
        // Replace-all sync. Incomplete rows are dropped rather than sent.
        const payload = addOnRows
            .filter(r => r.name.trim() !== '' && r.price !== '' && Number(r.price) >= 0)
            .map(r => ({ id: r.id ?? null, name: r.name.trim(), price: Number(r.price), isActive: r.isActive }));
        try {
            await setItemAddOns(itemId, payload);
        } catch {
            setNotification({ variant: "error", title: "Add-ons", message: "Item saved, but add-ons failed to save. Reopen and try again." });
        }
    }

    async function submitForm() {
        setSubmitting(true);
        try {
            if (editing) {
                // include image file if present
                await updateItem(editing.id, { ...form, image: imageFile });
                // refresh the updated item from server to get imagePath
                try {
                    const refreshed = await getItem(editing.id);
                    setItems((s) => s.map((it) => (it.id === editing.id ? refreshed : it)));
                } catch {
                    // fallback: merge local form
                    setItems((s) => s.map((it) => (it.id === editing.id ? { ...it, ...form } : it)));
                }
                await saveAddOns(editing.id);
                await saveVariants(editing.id);
                try { const again = await getItem(editing.id); setItems((s) => s.map((it) => (it.id === editing.id ? again : it))); } catch { /* keep */ }
                setNotification({ variant: "success", title: "Updated", message: "Item updated" });
            } else {
                const created = await createItem({ ...form, image: imageFile });
                // try to fetch full created item (server may populate imagePath)
                let createdFull: ItemDto = created;
                try {
                    createdFull = await getItem(created.id);
                } catch (e) { void e; }
                await saveAddOns(created.id);
                await saveVariants(created.id);
                setItems((s) => [createdFull, ...s]);
                setNotification({ variant: "success", title: "Created", message: `Item '${createdFull.name}' created` });
            }
            setIsFormOpen(false);
            setEditing(null);
            // cleanup preview after save
            if (imagePreview) { try { URL.revokeObjectURL(imagePreview); } catch (e) { void e; } }
            setImageFile(null);
            setImagePreview(null);
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

    function resolveImageUrl(path?: string | null) {
        if (!path) return '';
        try {
            // if already absolute url
            const url = new URL(path);
            return url.toString();
        } catch {
            // relative path: prefix with VITE_API_BASE_URL
            const base = (import.meta.env.VITE_API_IMAGE_BASE_URL as string) || '';
            if (base) {
                return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
            }
            return path;
        }
    }

    function handleFileSelected(file?: File | null) {
        if (!file) {
            if (imagePreview) { try { URL.revokeObjectURL(imagePreview); } catch (e) { void e; } }
            setImageFile(null);
            setImagePreview(null);
            return;
        }
        if (imagePreview) { try { URL.revokeObjectURL(imagePreview); } catch (e) { void e; } }
        const url = URL.createObjectURL(file);
        setImageFile(file);
        setImagePreview(url);
    }

    // ── List presentation ──────────────────────────────────────────────
    const categoryName = (id: number | null) =>
        id == null ? null : (categories.find(c => c.id === id)?.name ?? `#${id}`);

    const statusPill = (id?: number | null) => {
        const name = getStatusName(id) ?? id ?? '-';
        if (id === STATUS_ENABLED) return <Pill tone="emerald" dot>{name}</Pill>;
        if (id === STATUS_DISABLED) return <Pill tone="red" dot>{name}</Pill>;
        return <Pill tone="gray" dot>{name}</Pill>;
    };

    const outOnPage = items.filter(it => stockLevel(it.quantity) === "out").length;
    const lowOnPage = items.filter(it => stockLevel(it.quantity) === "low").length;
    const onlineOnPage = items.filter(it => it.sellOnline).length;
    const statusLabel = STATUS_FILTERS.find(s => s.value === statusFilter)?.label ?? 'All';
    const firstLoad = loading && totalCount === null;
    const filtersActive = selectedCategory !== null || debouncedSearch !== '';

    const columns: ColumnsType<ItemDto> = [
        {
            title: "",
            key: "image",
            width: 72,
            render: (_, it) => it.imagePath ? (
                <img
                    src={resolveImageUrl(it.imagePath)}
                    alt={it.name}
                    className="h-11 w-11 rounded-lg border border-gray-100 object-cover dark:border-white/10"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = PLACEHOLDER_IMG; }}
                />
            ) : (
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-gray-100 text-base text-gray-400 dark:bg-white/5 dark:text-gray-500" aria-label="No image">
                    <PictureOutlined />
                </span>
            ),
        },
        {
            title: "Item",
            key: "name",
            width: 240,
            render: (_, it) => (
                <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-gray-100">{it.name}</span>
                    {it.sellOnline && (
                        <Tooltip title={it.weightKg != null ? `Sold online · ${it.weightKg} kg` : "Sold online"}>
                            <span><Pill tone="blue" dot>Online</Pill></span>
                        </Tooltip>
                    )}
                </div>
            ),
        },
        {
            title: "Category",
            key: "category",
            width: 160,
            render: (_, it) => {
                const name = categoryName(it.categoryId);
                return name ? <span className="text-gray-700 dark:text-gray-300">{name}</span> : <span className="text-gray-400 dark:text-gray-500">—</span>;
            },
        },
        {
            title: "Description / type",
            dataIndex: "type",
            ellipsis: { showTitle: false },
            render: (v: string) => v
                ? <Tooltip title={v} placement="topLeft"><span className="text-gray-600 dark:text-gray-400">{v}</span></Tooltip>
                : <span className="text-gray-400 dark:text-gray-500">—</span>,
        },
        {
            title: "Buy price",
            dataIndex: "buyPrice",
            align: "right",
            width: 110,
            render: (v: number | null | undefined) => v != null
                ? <span className="whitespace-nowrap tabular-nums text-gray-600 dark:text-gray-400">{usd(v)}</span>
                : <span className="text-gray-400 dark:text-gray-500">—</span>,
        },
        {
            title: "Price",
            dataIndex: "price",
            align: "right",
            width: 110,
            render: (v: number | null | undefined) => v != null
                ? <span className="whitespace-nowrap font-semibold tabular-nums text-gray-900 dark:text-gray-100">{usd(v)}</span>
                : <span className="text-gray-400 dark:text-gray-500">—</span>,
        },
        {
            title: "Stock",
            dataIndex: "quantity",
            align: "right",
            width: 130,
            render: (v: number) => {
                const level = stockLevel(v);
                return (
                    <div className="flex items-center justify-end gap-2">
                        {level === "out" && <Pill tone="red" dot>Out</Pill>}
                        {level === "low" && <Pill tone="amber" dot>Low</Pill>}
                        <span className={`tabular-nums ${level === "out" ? "font-semibold text-red-600 dark:text-red-400" : "text-gray-800 dark:text-gray-200"}`}>{v}</span>
                    </div>
                );
            },
        },
        {
            title: "Status",
            dataIndex: "statusId",
            width: 120,
            render: (v: number | null | undefined) => statusPill(v),
        },
        {
            title: "",
            key: "actions",
            width: 140,
            align: "right",
            fixed: "right",
            render: (_, it) => (
                <div className="flex items-center justify-end gap-1">
                    {/* Recipe button — opens the stock-tracking recipe editor for this item */}
                    <Tooltip title="Configure ingredients consumed when this item is sold">
                        <Button size="small" icon={<ExperimentOutlined />} onClick={() => setRecipeItem(it)}>Recipe</Button>
                    </Tooltip>
                    <Dropdown
                        trigger={["click"]}
                        menu={{
                            items: [
                                { key: "edit", icon: <EditOutlined />, label: "Edit", onClick: () => openEdit(it) },
                                { key: "delete", icon: <DeleteOutlined />, label: "Delete", danger: true, onClick: () => setDeleteId(it.id) },
                            ],
                        }}
                    >
                        <Button type="text" size="small" icon={<MoreOutlined />} aria-label={`Actions for ${it.name}`} />
                    </Dropdown>
                </div>
            ),
        },
    ];

    return (
        <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6">
            <PageHeader
                tone="blue"
                icon={<AppstoreOutlined />}
                title="Items"
                description="Everything the cashier and the online shop can sell — prices, stock, recipes and add-ons."
                actions={
                    <>
                        <Tooltip title="Refresh">
                            <Button icon={<ReloadOutlined />} onClick={() => setReloadToken((t) => t + 1)} loading={loading} aria-label="Refresh" />
                        </Tooltip>
                        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Add item</Button>
                    </>
                }
            >
                <div className="flex flex-wrap items-center gap-3">
                    <div className="max-w-full overflow-x-auto">
                        <Segmented
                            value={statusFilter}
                            onChange={(v) => { setPage(1); setStatusFilter(Number(v)); }}
                            options={STATUS_FILTERS}
                        />
                    </div>
                    <AntSelect
                        allowClear
                        showSearch
                        optionFilterProp="label"
                        placeholder="All categories"
                        className="w-full sm:w-56"
                        value={selectedCategory ?? undefined}
                        onChange={(v?: number) => { setPage(1); setSelectedCategory(v == null ? null : Number(v)); }}
                        options={categories.map(c => ({ value: c.id, label: c.name }))}
                    />
                    <AntInput
                        allowClear
                        prefix={<SearchOutlined className="text-gray-400" />}
                        placeholder="Search items..."
                        className="w-full sm:w-64"
                        value={search}
                        onChange={(e) => { setPage(1); setSearch(e.target.value); }}
                    />
                </div>
            </PageHeader>

            {/* KPIs — derived from the list already loaded (no extra requests) */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatTile
                    label="Items"
                    loading={firstLoad}
                    value={<span className="tabular-nums">{(totalCount ?? items.length).toLocaleString("en-US")}</span>}
                    sub={<>{statusLabel}{selectedCategory !== null ? <> · {categoryName(selectedCategory)}</> : null}{debouncedSearch ? <> · “{debouncedSearch}”</> : null}</>}
                    accent={<span className="rounded-lg bg-blue-50 p-1.5 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300"><AppstoreOutlined /></span>}
                />
                <StatTile
                    label="Out of stock"
                    loading={firstLoad}
                    value={<span className="tabular-nums">{outOnPage}</span>}
                    sub="On this page · 0 or less in stock"
                    accent={outOnPage ? <span className="text-red-500"><WarningOutlined /></span> : undefined}
                />
                <StatTile
                    label="Low stock"
                    loading={firstLoad}
                    value={<span className="tabular-nums">{lowOnPage}</span>}
                    sub={`On this page · ${LOW_STOCK_MAX} or fewer left`}
                    accent={lowOnPage ? <span className="text-amber-500"><WarningOutlined /></span> : undefined}
                />
                <StatTile
                    label="Sold online"
                    loading={firstLoad}
                    value={<span className="tabular-nums">{onlineOnPage}</span>}
                    sub="On this page"
                    accent={<span className="rounded-lg bg-sky-50 p-1.5 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300"><ShoppingCartOutlined /></span>}
                />
            </div>

            <Panel
                title="All items"
                subtitle={totalCount !== null ? `${totalCount.toLocaleString("en-US")} item${totalCount === 1 ? "" : "s"} · ${statusLabel.toLowerCase()}` : undefined}
                bodyClassName="p-0"
            >
                {error ? (
                    <div className="m-5 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</div>
                ) : firstLoad ? (
                    <div className="p-5"><Skeleton active paragraph={{ rows: 6 }} /></div>
                ) : (
                    <Table
                        rowKey="id"
                        size="middle"
                        loading={loading}
                        columns={columns}
                        dataSource={items}
                        pagination={false}
                        scroll={{ x: 1180 }}
                        locale={{ emptyText: <Empty description={filtersActive ? "No items match these filters" : "No items yet"} /> }}
                    />
                )}

                {/* Pagination controls */}
                <PagerFooter
                    shown={items.length}
                    total={totalCount}
                    page={page}
                    pageSize={pageSize}
                    onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
                    onPrev={() => setPage((p) => Math.max(1, p - 1))}
                    onNext={() => setPage((p) => p + 1)}
                    prevDisabled={page <= 1}
                    nextDisabled={totalCount !== null && page * pageSize >= (totalCount || 0)}
                />
            </Panel>

            <Modal
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                title={editing ? "Edit Item" : "Create Item"}
                subtitle={editing ? form.name : "Fill the basics, then stock options and add-ons if the item needs them."}
                footer={(
                    <>
                        <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm" onClick={() => setIsFormOpen(false)}>Cancel</button>
                        <button className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-60" onClick={submitForm} disabled={submitting}>
                            {submitting ? <Loader size={16} /> : (editing ? 'Save changes' : 'Create item')}
                        </button>
                    </>
                )}
            >
                <div className="flex flex-col gap-4">
                    {/* ── Basics: image + name/category/status ───────────── */}
                    <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
                        <div
                            className="rounded-xl border border-dashed border-gray-300 bg-gray-50/60 p-3 flex flex-col items-center justify-center text-center text-xs text-gray-500 min-h-[150px]"
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                                e.preventDefault();
                                const f = e.dataTransfer?.files?.[0];
                                if (f) handleFileSelected(f);
                            }}
                        >
                            {imagePreview ? (
                                <div className="flex flex-col items-center gap-2 w-full">
                                    <img src={imagePreview} alt="preview" className="w-full h-24 object-cover rounded-lg border border-gray-200" />
                                    <div className="flex gap-1.5">
                                        <label className="px-2.5 py-1 bg-white border border-gray-200 rounded-md cursor-pointer hover:bg-gray-50">
                                            Replace
                                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelected(e.target.files?.[0] ?? null)} />
                                        </label>
                                        <button type="button" className="px-2.5 py-1 text-red-600 border border-red-200 rounded-md hover:bg-red-50" onClick={() => handleFileSelected(null)}>Remove</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-2">
                                    <div className="text-2xl">🖼️</div>
                                    <div>Drag &amp; drop an image, or</div>
                                    <label className="px-3 py-1 bg-white border border-gray-200 rounded-md cursor-pointer hover:bg-gray-50">
                                        Choose file
                                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelected(e.target.files?.[0] ?? null)} />
                                    </label>
                                </div>
                            )}
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 content-start">
                            <div className="sm:col-span-2">
                                <label className="text-xs font-medium text-gray-600">Name</label>
                                <Input placeholder="e.g. Penne Arrabbiata" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-600">Category</label>
                                <Select options={[{ value: '', label: '-- Select category --' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]} defaultValue={form.categoryId ?? ''} onChange={(v: string | number) => setForm((f) => ({ ...f, categoryId: v === '' ? null : Number(v) }))} />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-600">Status</label>
                                <div className="mt-1"><StatusToggle value={form.statusId} onChange={(id) => setForm((f) => ({ ...f, statusId: id }))} /></div>
                            </div>
                            <div className="sm:col-span-2">
                                <label className="text-xs font-medium text-gray-600">Description / type</label>
                                <Input placeholder="Shown to customers — e.g. Penne pasta, tomato sauce, parmesan" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} />
                            </div>
                        </div>
                    </div>

                    {/* ── Pricing & stock ────────────────────────────────── */}
                    <div className="rounded-xl border border-gray-200 p-3 sm:p-4">
                        <div className="text-sm font-semibold text-gray-800 mb-2">Pricing &amp; stock</div>
                        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
                            <div>
                                <label className="text-xs font-medium text-gray-600">Sell price (USD)</label>
                                <Input type="number" step={0.01} placeholder="0.00" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) }))} />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-600">Buy price (USD)</label>
                                <Input type="number" step={0.01} placeholder="Cost per unit" value={form.buyPrice ?? ''} onChange={(e) => setForm((f) => ({ ...f, buyPrice: e.target.value ? Number(e.target.value) : null }))} />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-600">Quantity in stock</label>
                                <Input type="number" placeholder="0" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: Number(e.target.value) }))} />
                                {variantRows.some(v => v.isActive) && <div className="text-[11px] text-gray-400 mt-1">Overridden by the options below (sum = {variantStockTotal}).</div>}
                            </div>
                        </div>
                    </div>

                    {/* ── Online shop ───────────────────────────────────── */}
                    <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-3 sm:p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <div className="text-sm font-semibold text-gray-800">Online shop</div>
                                <div className="text-xs text-gray-500">Shown on the website shop when its category is set to "show in shop". Weight is used for Aramex delivery quotes.</div>
                            </div>
                            <button type="button" role="switch" aria-checked={form.sellOnline ?? true}
                                onClick={() => setForm((f) => ({ ...f, sellOnline: !(f.sellOnline ?? true) }))}
                                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border ${(form.sellOnline ?? true) ? 'border-sky-300 text-sky-700 bg-white' : 'border-gray-200 text-gray-500 bg-white'}`}>
                                {(form.sellOnline ?? true) ? '🛒 Sell online: On' : 'Sell online: Off'}
                            </button>
                        </div>
                        <div className="mt-3 sm:max-w-xs">
                            <label className="text-xs font-medium text-gray-600">Weight (kg)</label>
                            <Input type="number" step={0.1} min="0" placeholder="Empty = category default"
                                value={form.weightKg ?? ''}
                                onChange={(e) => setForm((f) => ({ ...f, weightKg: e.target.value === '' ? null : Number(e.target.value) }))} />
                        </div>
                    </div>

                    {/* ── Colour / type options (own stock) ─────────────── */}
                    <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-3 sm:p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <div className="text-sm font-semibold text-gray-800">Colour / type options</div>
                                <div className="text-xs text-gray-500">
                                    Each option has its own stock — e.g. Sleeves: Black 40, Green 12. The cashier and the website must pick one.
                                    {variantRows.some(v => v.isActive) && <> Item stock becomes the sum: <b>{variantStockTotal}</b>.</>}
                                </div>
                            </div>
                            <button type="button"
                                onClick={() => setVariantRows((r) => [...r, { name: '', color: '', priceDelta: 0, quantity: 0, isActive: true }])}
                                className="shrink-0 text-sm px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
                                + Option
                            </button>
                        </div>
                        {variantsLoading ? (
                            <div className="py-3 text-sm text-gray-400">Loading…</div>
                        ) : variantRows.length === 0 ? (
                            <div className="py-3 text-sm text-gray-400">No options — one stock number for the whole item.</div>
                        ) : (
                            <div className="mt-3 space-y-2">
                                <div className="hidden sm:grid grid-cols-12 gap-2 text-[11px] text-gray-500 px-1">
                                    <div className="col-span-4">Name</div><div className="col-span-2">Colour</div><div className="col-span-2">+/− price</div><div className="col-span-2">Stock</div>
                                </div>
                                {variantRows.map((row, idx) => (
                                    <div key={row.id ?? `nv-${idx}`} className={`grid grid-cols-2 sm:grid-cols-12 gap-2 items-center rounded-lg bg-white/70 sm:bg-transparent p-2 sm:p-0 border sm:border-0 border-indigo-100 ${row.isActive ? '' : 'opacity-50'}`}>
                                        <div className="col-span-2 sm:col-span-4">
                                            <label className="sm:hidden text-[11px] text-gray-500">Name</label>
                                            <Input placeholder="Black" value={row.name}
                                                onChange={(e) => setVariantRows((r) => r.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))} />
                                        </div>
                                        <div className="col-span-1 sm:col-span-2 flex items-end gap-1">
                                            <div>
                                                <label className="sm:hidden text-[11px] text-gray-500 block">Colour</label>
                                                <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(row.color) ? row.color : '#888888'}
                                                    onChange={(e) => setVariantRows((r) => r.map((x, i) => i === idx ? { ...x, color: e.target.value } : x))}
                                                    className="h-10 w-10 rounded-lg border border-gray-300 p-0.5 bg-white" title="Swatch shown to cashier & website" />
                                            </div>
                                            <button type="button" onClick={() => setVariantRows((r) => r.map((x, i) => i === idx ? { ...x, color: '' } : x))} className="h-10 text-[10px] text-gray-400" title="No swatch">✕</button>
                                        </div>
                                        <div className="col-span-1 sm:col-span-2">
                                            <label className="sm:hidden text-[11px] text-gray-500">+/− price</label>
                                            <Input type="number" step={0.25} placeholder="0" value={row.priceDelta === '' ? '' : String(row.priceDelta)}
                                                onChange={(e) => setVariantRows((r) => r.map((x, i) => i === idx ? { ...x, priceDelta: e.target.value === '' ? '' : Number(e.target.value) } : x))} />
                                        </div>
                                        <div className="col-span-1 sm:col-span-2">
                                            <label className="sm:hidden text-[11px] text-gray-500">Stock</label>
                                            <Input type="number" step={1} min="0" placeholder="0" value={row.quantity === '' ? '' : String(row.quantity)}
                                                onChange={(e) => setVariantRows((r) => r.map((x, i) => i === idx ? { ...x, quantity: e.target.value === '' ? '' : Number(e.target.value) } : x))} />
                                        </div>
                                        <div className="col-span-1 sm:col-span-2 flex gap-1 justify-end items-end">
                                            <button type="button" title={row.isActive ? 'Disable (kept for history)' : 'Enable'}
                                                onClick={() => setVariantRows((r) => r.map((x, i) => i === idx ? { ...x, isActive: !x.isActive } : x))}
                                                className={`px-2 py-1.5 rounded-lg text-xs border ${row.isActive ? 'border-green-300 text-green-700 bg-green-50' : 'border-gray-200 text-gray-500'}`}>
                                                {row.isActive ? 'On' : 'Off'}
                                            </button>
                                            <button type="button" onClick={() => setVariantRows((r) => r.filter((_, i) => i !== idx))}
                                                className="px-2 py-1.5 rounded-lg text-xs text-red-600 border border-red-200 hover:bg-red-50">✕</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="rounded-xl border border-gray-200 p-3 sm:p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <div className="text-sm font-semibold text-gray-800">Add-ons</div>
                                <div className="text-xs text-gray-500">
                                    Paid extras the cashier can offer with this item — e.g. Oat Milk +$1.00.
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setAddOnRows((r) => [...r, { name: '', price: '', isActive: true }])}
                                className="shrink-0 text-sm px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200"
                            >
                                + Add
                            </button>
                        </div>

                        {addOnsLoading ? (
                            <div className="py-3 text-sm text-gray-400">Loading…</div>
                        ) : addOnRows.length === 0 ? (
                            <div className="py-3 text-sm text-gray-400">No add-ons — this item sells as-is.</div>
                        ) : (
                            <div className="mt-3 space-y-2">
                                {addOnRows.map((row, idx) => (
                                    <div key={row.id ?? `new-${idx}`} className={`flex flex-wrap items-center gap-2 ${row.isActive ? '' : 'opacity-50'}`}>
                                        <div className="flex-1 min-w-[160px]">
                                            <Input
                                                placeholder="Name (e.g. Oat Milk)"
                                                value={row.name}
                                                onChange={(e) => setAddOnRows((r) => r.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))}
                                            />
                                        </div>
                                        <div className="w-24 sm:w-28">
                                            <Input
                                                type="number"
                                                step={0.25}
                                                min="0"
                                                placeholder="Price"
                                                value={row.price === '' ? '' : String(row.price)}
                                                onChange={(e) => setAddOnRows((r) => r.map((x, i) => i === idx ? { ...x, price: e.target.value === '' ? '' : Number(e.target.value) } : x))}
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            title={row.isActive ? 'Disable (kept for history)' : 'Enable'}
                                            onClick={() => setAddOnRows((r) => r.map((x, i) => i === idx ? { ...x, isActive: !x.isActive } : x))}
                                            className={`px-2.5 py-1.5 rounded-lg text-xs border ${row.isActive ? 'border-green-300 text-green-700 bg-green-50' : 'border-gray-200 text-gray-500'}`}
                                        >
                                            {row.isActive ? 'On' : 'Off'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setAddOnRows((r) => r.filter((_, i) => i !== idx))}
                                            className="px-2.5 py-1.5 rounded-lg text-xs text-red-600 border border-red-200 hover:bg-red-50"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={!!deleteId}
                onClose={() => setDeleteId(null)}
                title="Confirm delete"
                footer={(
                    <>
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
                    </>
                )}
            >
                <div className="space-y-4">
                    <p>Are you sure you want to delete this item?</p>
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

            {/* Recipe editor — opens from the Recipe button on each item row.
                Lets the chef define which ingredients (and how much) get
                deducted from stock when this item is sold. */}
            <RecipeEditorModal
                open={!!recipeItem}
                itemId={recipeItem ? Number(recipeItem.id) : null}
                itemName={recipeItem?.name}
                onClose={() => setRecipeItem(null)}
                onSaved={() => { /* nothing else to refresh on the Items list */ }}
            />
        </div>
    );
}
