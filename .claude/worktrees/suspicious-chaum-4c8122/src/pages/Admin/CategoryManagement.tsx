import { useEffect, useState } from "react";
import {
    getCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    deleteCategory,
    CategoryDto,
    CategoryListResponse,
} from "../../services/categoryService";
import Modal from "../../components/ui/Modal";
import Select from "../../components/form/Select";
import Input from "../../components/form/input/InputField";
import Loader from "../../components/ui/Loader";
import Alert from "../../components/ui/alert/Alert";
import DeleteIconButton from "../../components/ui/DeleteIconButton";
import {
    Table,
    TableBody,
    TableCell,
    TableHeader,
    TableRow,
} from "../../components/ui/table";
import { CategoryTypes } from "../../utils/common-data/commonData";

export default function CategoryManagement() {
    const [categories, setCategories] = useState<CategoryDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalCount, setTotalCount] = useState<number | null>(null);

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editing, setEditing] = useState<CategoryDto | null>(null);
    const [form, setForm] = useState<{ name: string; type: string; itemType: string }>({ name: "", type: "item", itemType: "" });
    const [submitting, setSubmitting] = useState(false);

    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [deleting, setDeleting] = useState(false);

    const [notification, setNotification] = useState<{
        variant: "success" | "error" | "warning" | "info";
        title: string;
        message: string;
    } | null>(null);

    useEffect(() => {
        if (!notification) return;
        const t = setTimeout(() => setNotification(null), 3500);
        return () => clearTimeout(t);
    }, [notification]);

    useEffect(() => {
        let mounted = true;
        setLoading(true);
        getCategories(page, pageSize)
            .then((res: CategoryListResponse) => {
                if (!mounted) return;
                setCategories(res.data || []);
                setTotalCount(res.totalCount ?? null);
            })
            .catch((err) => {
                if (!mounted) return;
                setError(err?.message || "Failed to load categories");
            })
            .finally(() => {
                if (!mounted) return;
                setLoading(false);
            });
        return () => { mounted = false; };
    }, [page, pageSize]);

    function openCreate() {
        setEditing(null);
        setForm({ name: "", type: "item", itemType: "" });
        setIsFormOpen(true);
    }

    async function openEdit(id: number) {
        setLoading(true);
        try {
            const dto = await getCategoryById(id);
            setEditing(dto);
            setForm({ name: dto.name, type: dto.type ?? "item", itemType: dto.itemType ?? "" });
            setIsFormOpen(true);
        } catch (err: unknown) {
            let message = "Failed to load category";
            if (err && typeof err === 'object') {
                const maybe = err as { message?: unknown };
                if (typeof maybe.message === 'string') message = maybe.message;
            }
            setNotification({ variant: "error", title: "Load failed", message });
        } finally {
            setLoading(false);
        }
    }

    async function submitForm() {
        setSubmitting(true);
        try {
            if (editing) {
                await updateCategory(editing.id, form);
                setCategories((s) => s.map((c) => (c.id === editing.id ? { ...c, ...form } : c)));
                setNotification({ variant: "success", title: "Updated", message: "Category updated" });
            } else {
                const created = await createCategory(form);
                setCategories((s) => [created, ...s]);
                setNotification({ variant: "success", title: "Created", message: `Category '${created.name}' created` });
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

    return (
        <div className="p-6">
            <h1 className="text-2xl font-semibold mb-4">Category Management</h1>

            <div className="mb-4 flex items-center gap-3">
                <button className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded" onClick={openCreate}>
                    Add Category
                </button>
            </div>

            {loading && <div className="text-gray-600">Loading categories...</div>}

            {error && <div className="text-red-600 bg-red-50 p-3 rounded">{error}</div>}

            {!loading && !error && (
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
                    <div className="max-w-full overflow-x-auto">
                        <Table>
                            <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                                <TableRow>
                                    <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Name</TableCell>
                                    <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Type</TableCell>
                                    <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Item Type</TableCell>
                                    <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Actions</TableCell>
                                </TableRow>
                            </TableHeader>

                            <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                                {categories.map((c) => (
                                    <TableRow key={c.id}>
                                        <TableCell className="px-5 py-4 sm:px-6 text-start">
                                            <div className="font-medium text-gray-800 dark:text-white/90">{c.name}</div>
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">{c.type}</TableCell>
                                        <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">{c.itemType || "-"}</TableCell>
                                        <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                                            <div className="flex items-center gap-2">
                                                <button className="text-sm px-2 py-1 bg-gray-200 rounded" onClick={() => openEdit(c.id)}>Edit</button>
                                                <DeleteIconButton onClick={() => setDeleteId(c.id)} />
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
                <div className="text-sm text-gray-600">{totalCount !== null ? `Showing ${categories.length} of ${totalCount}` : ''}</div>
                <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">Page size</label>
                    <Select options={[{ value: 5, label: '5' }, { value: 10, label: '10' }, { value: 25, label: '25' }, { value: 50, label: '50' }]} defaultValue={pageSize} onChange={(v: string | number) => { setPageSize(Number(v)); setPage(1); }} className="w-24" />
                    <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Prev</button>
                    <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => setPage((p) => p + 1)} disabled={totalCount !== null && page * pageSize >= (totalCount || 0)}>Next</button>
                </div>
            </div>

            <Modal
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                title={editing ? "Edit Category" : "Create Category"}
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
                    <label className="text-sm text-gray-600">Type</label>
                    <Select options={CategoryTypes} defaultValue={form.type} onChange={(v: string | number) => setForm((f) => ({ ...f, type: String(v) }))} />
                    <label className="text-sm text-gray-600">Item Type</label>
                    <Select options={[
                        { value: "", label: "-- None --" },
                        { value: "Retail", label: "Retail" },
                        { value: "Drinks", label: "Drinks" },
                        { value: "Tobacco", label: "Tobacco" },
                        { value: "Food", label: "Food" }
                    ]} defaultValue={form.itemType} onChange={(v: string | number) => setForm((f) => ({ ...f, itemType: v === "" ? "" : String(v) }))} />
                </div>
            </Modal>

            <Modal
                isOpen={!!deleteId}
                onClose={() => setDeleteId(null)}
                title="Confirm delete"
                footer={(
                    <>
                        <button className="px-3 py-1 bg-red-600 text-white rounded flex items-center gap-2" onClick={async () => {
                            if (deleteId === null) return;
                            setDeleting(true);
                            try {
                                await deleteCategory(deleteId);
                                setCategories((s) => s.filter(x => x.id !== deleteId));
                                setDeleteId(null);
                                setError(null);
                                setNotification({ variant: "success", title: "Deleted", message: "Category deleted" });
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
                    <p>Are you sure you want to delete this category?</p>
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
