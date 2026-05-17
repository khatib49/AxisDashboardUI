import { useEffect, useState } from "react";
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
import DeleteIconButton from "../../components/ui/DeleteIconButton";
import { getCategoriesByType, CategoryDto } from "../../services/categoryService";
import { getStatusName, STATUS_ENABLED, STATUS_DISABLED } from '../../services/statuses';
import StatusToggle from '../../components/ui/StatusToggle';
import {
    Table,
    TableBody,
    TableCell,
    TableHeader,
    TableRow,
} from "../../components/ui/table";

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

    // image upload states
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

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
        getItems(page, pageSize, selectedCategory, debouncedSearch)
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
    }, [page, pageSize, selectedCategory, debouncedSearch]);

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

    function openCreate() {
        setEditing(null);
        setForm({ name: "", quantity: 0, price: 0, type: "", categoryId: null, gameId: null, statusId: STATUS_ENABLED });
        // clear any previous selected image
        if (imagePreview) { try { URL.revokeObjectURL(imagePreview); } catch (e) { void e; } }
        setImageFile(null);
        setImagePreview(null);
        setIsFormOpen(true);
    }

    function openEdit(item: ItemDto) {
        setEditing(item);
        setForm({ name: item.name, quantity: item.quantity, price: item.price, type: item.type, categoryId: item.categoryId, gameId: item.gameId, statusId: item.statusId ?? null });
        // prefill image preview if available
        if (item.imagePath) {
            const resolved = resolveImageUrl(item.imagePath);
            setImagePreview(resolved);
        } else {
            setImagePreview(null);
        }
        setImageFile(null);
        setIsFormOpen(true);
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
                setNotification({ variant: "success", title: "Updated", message: "Item updated" });
            } else {
                const created = await createItem({ ...form, image: imageFile });
                // try to fetch full created item (server may populate imagePath)
                let createdFull: ItemDto = created;
                try {
                    createdFull = await getItem(created.id);
                } catch (e) { void e; }
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

    return (
        <div className="p-6">
            <h1 className="text-2xl font-semibold mb-4">Food & Beverage Items Management</h1>

            <div className="mb-4 flex items-center justify-between">
                <button className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded" onClick={openCreate}>
                    Add Item
                </button>

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
            </div>

            {loading && <div className="text-gray-600">Loading items...</div>}

            {error && <div className="text-red-600 bg-red-50 p-3 rounded">{error}</div>}

            {!loading && !error && (
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
                    <div className="max-w-full overflow-x-auto">
                        <Table>
                            <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                                <TableRow>
                                    <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Image</TableCell>
                                    <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Name</TableCell>
                                    <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Quantity</TableCell>
                                    <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Price</TableCell>
                                    <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Type</TableCell>
                                    <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Category</TableCell>
                                    <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Status</TableCell>
                                    <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Actions</TableCell>
                                </TableRow>
                            </TableHeader>

                            <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                                {items.map((it) => (
                                    <TableRow key={it.id}>
                                        <TableCell className="px-4 py-3 text-start">
                                            <img
                                                src={it.imagePath ? resolveImageUrl(it.imagePath) : '/images/image-placeholder.svg'}
                                                alt={it.name}
                                                className="w-12 h-8 object-cover rounded"
                                                onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/images/image-placeholder.svg'; }}
                                            />
                                        </TableCell>
                                        <TableCell className="px-5 py-4 sm:px-6 text-start">
                                            <div className="font-medium text-gray-800 dark:text-white/90">{it.name}</div>
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">{it.quantity}</TableCell>
                                        <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">{it.price}</TableCell>
                                        <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">{it.type}</TableCell>
                                        <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">{categories.find(c => c.id === it.categoryId)?.name ?? String(it.categoryId)}</TableCell>
                                        <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                                            {(() => {
                                                const id = it.statusId;
                                                const name = getStatusName(id) ?? id ?? '-';
                                                if (id === STATUS_ENABLED) {
                                                    return <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-100 text-green-800 text-xs font-medium">{name}</span>;
                                                }
                                                if (id === STATUS_DISABLED) {
                                                    return <span className="inline-flex items-center px-2 py-1 rounded-full bg-red-100 text-red-800 text-xs font-medium">{name}</span>;
                                                }
                                                return <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 text-gray-800 text-xs">{name}</span>;
                                            })()}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                                            <div className="flex items-center gap-2">
                                                <button className="text-sm px-2 py-1 bg-gray-200 rounded" onClick={() => openEdit(it)}>Edit</button>
                                                <DeleteIconButton onClick={() => setDeleteId(it.id)} />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            )}

            {/* Pagination controls */}
            <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-gray-600">{totalCount !== null ? `Showing ${items.length} of ${totalCount}` : ''}</div>
                <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">Page size</label>
                    <Select
                        options={[{ value: 5, label: '5' }, { value: 10, label: '10' }, { value: 25, label: '25' }, { value: 50, label: '50' }]}
                        defaultValue={pageSize}
                        onChange={(v: string | number) => { setPageSize(Number(v)); setPage(1); }}
                        className="w-24"
                    />
                    <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Prev</button>
                    <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => setPage((p) => p + 1)} disabled={totalCount !== null && page * pageSize >= (totalCount || 0)}>Next</button>
                </div>
            </div>

            <Modal
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                title={editing ? "Edit Item" : "Create Item"}
                footer={(
                    <>
                        <button className="px-3 py-1 bg-green-600 text-white rounded flex items-center gap-2" onClick={submitForm}>
                            {submitting ? <Loader size={16} /> : (editing ? 'Save' : 'Create')}
                        </button>
                        <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => setIsFormOpen(false)}>Cancel</button>
                    </>
                )}
            >
                <div className="flex flex-col gap-3">
                    <Input placeholder="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                    {/* Image upload area */}
                    <div
                        className="border border-dashed border-gray-300 rounded p-3 flex flex-col items-center justify-center text-center text-sm text-gray-500"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                            e.preventDefault();
                            const f = e.dataTransfer?.files?.[0];
                            if (f) handleFileSelected(f);
                        }}
                    >
                        {imagePreview ? (
                            <div className="flex items-center gap-3">
                                <img src={imagePreview} alt="preview" className="w-24 h-16 object-cover rounded" />
                                <div className="flex flex-col">
                                    <button type="button" className="px-2 py-1 bg-gray-200 rounded mb-2" onClick={() => handleFileSelected(null)}>Remove</button>
                                    <label className="px-2 py-1 bg-gray-100 rounded cursor-pointer">
                                        Replace
                                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelected(e.target.files?.[0] ?? null)} />
                                    </label>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-2">
                                <div>Drag & drop an image here, or</div>
                                <label className="px-3 py-1 bg-gray-200 rounded cursor-pointer">
                                    Click to select
                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelected(e.target.files?.[0] ?? null)} />
                                </label>
                            </div>
                        )}
                    </div>
                    <label className="text-sm text-gray-600">Quantity</label>
                    <Input type="number" placeholder="Quantity" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: Number(e.target.value) }))} />
                    <label className="text-sm text-gray-600">Price (usd)</label>
                    <Input type="number" step={0.01} placeholder="Price" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) }))} />
                    <Input placeholder="Type" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} />
                    <label className="text-sm text-gray-600">Category</label>
                    <Select options={[{ value: '', label: '-- Select category --' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]} defaultValue={form.categoryId ?? ''} onChange={(v: string | number) => setForm((f) => ({ ...f, categoryId: v === '' ? null : Number(v) }))} />
                    <label className="text-sm text-gray-600">Status</label>
                    <StatusToggle value={form.statusId} onChange={(id) => setForm((f) => ({ ...f, statusId: id }))} />
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
        </div>
    );
}
