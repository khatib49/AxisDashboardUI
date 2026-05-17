import { useEffect, useState } from "react";
import {
    getDiscounts,
    getDiscountById,
    createDiscount,
    updateDiscount,
    deleteDiscount,
    DiscountDto,
    DiscountListResponse,
    DiscountCreateDto,
    DiscountUpdateDto,
} from "../../services/discountService";
import Modal from "../../components/ui/Modal";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
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

export default function DiscountManagement() {
    const [discounts, setDiscounts] = useState<DiscountDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [totalCount, setTotalCount] = useState<number | null>(null);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editing, setEditing] = useState<DiscountDto | null>(null);
    const [form, setForm] = useState<{
        name: string;
        type: string;
        description: string;
        percentage: number;
        isActive: boolean;
    }>({
        name: "",
        type: "",
        description: "",
        percentage: 0,
        isActive: true,
    });
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

    // Debounce search input
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 300);
        return () => clearTimeout(t);
    }, [search]);

    useEffect(() => {
        let mounted = true;
        setLoading(true);
        getDiscounts(page, pageSize, debouncedSearch || undefined)
            .then((res: DiscountListResponse) => {
                if (!mounted) return;
                setDiscounts(res.data || []);
                setTotalCount(res.totalCount ?? null);
            })
            .catch((err) => {
                if (!mounted) return;
                setError(err?.message || "Failed to load discounts");
            })
            .finally(() => {
                if (!mounted) return;
                setLoading(false);
            });
        return () => {
            mounted = false;
        };
    }, [page, pageSize, debouncedSearch]);

    function openCreate() {
        setEditing(null);
        setForm({
            name: "",
            type: "",
            description: "",
            percentage: 0,
            isActive: true,
        });
        setIsFormOpen(true);
    }

    async function openEdit(id: number) {
        setLoading(true);
        try {
            const dto = await getDiscountById(id);
            setEditing(dto);
            setForm({
                name: dto.name,
                type: dto.type,
                description: dto.description || "",
                percentage: dto.percentage,
                isActive: dto.isActive,
            });
            setIsFormOpen(true);
        } catch (err: unknown) {
            let message = "Failed to load discount";
            if (err && typeof err === "object") {
                const maybe = err as { message?: unknown };
                if (typeof maybe.message === "string") message = maybe.message;
            }
            setNotification({ variant: "error", title: "Load failed", message });
        } finally {
            setLoading(false);
        }
    }

    async function submitForm() {
        if (!form.name.trim()) {
            setNotification({
                variant: "error",
                title: "Validation",
                message: "Name is required",
            });
            return;
        }

        if (!form.type.trim()) {
            setNotification({
                variant: "error",
                title: "Validation",
                message: "Type is required",
            });
            return;
        }

        if (form.percentage < 0 || form.percentage > 100) {
            setNotification({
                variant: "error",
                title: "Validation",
                message: "Percentage must be between 0 and 100",
            });
            return;
        }

        setSubmitting(true);
        try {
            if (editing) {
                const dto: DiscountUpdateDto = {
                    name: form.name,
                    type: form.type,
                    description: form.description || null,
                    percentage: form.percentage,
                    isActive: form.isActive,
                };
                await updateDiscount(editing.id, dto);
                setDiscounts((s) =>
                    s.map((d) =>
                        d.id === editing.id
                            ? {
                                ...d,
                                name: form.name,
                                type: form.type,
                                description: form.description || null,
                                percentage: form.percentage,
                                isActive: form.isActive,
                            }
                            : d
                    )
                );
                setNotification({
                    variant: "success",
                    title: "Updated",
                    message: "Discount updated successfully",
                });
            } else {
                const dto: DiscountCreateDto = {
                    name: form.name,
                    type: form.type,
                    description: form.description || null,
                    percentage: form.percentage,
                    isActive: form.isActive,
                };
                const created = await createDiscount(dto);
                setDiscounts((s) => [created, ...s]);
                setNotification({
                    variant: "success",
                    title: "Created",
                    message: `Discount '${created.name}' created successfully`,
                });
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

    async function toggleDiscountStatus(discount: DiscountDto) {
        try {
            const dto: DiscountUpdateDto = {
                isActive: !discount.isActive,
            };
            await updateDiscount(discount.id, dto);
            setDiscounts((s) =>
                s.map((d) =>
                    d.id === discount.id ? { ...d, isActive: !d.isActive } : d
                )
            );
            setNotification({
                variant: "success",
                title: "Status Updated",
                message: `Discount ${!discount.isActive ? "activated" : "deactivated"} successfully`,
            });
        } catch (err: unknown) {
            let message = "Failed to update status";
            if (err && typeof err === "object") {
                const maybe = err as { message?: unknown };
                if (typeof maybe.message === "string") message = maybe.message;
            }
            setNotification({ variant: "error", title: "Update failed", message });
        }
    }

    return (
        <div className="p-6">
            <h1 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
                Discount Management
            </h1>

            <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-64">
                        <Input
                            placeholder="Search discounts..."
                            value={search}
                            onChange={(e) => {
                                setPage(1);
                                setSearch(e.target.value);
                            }}
                        />
                    </div>
                </div>
                <button
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                    onClick={openCreate}
                >
                    + Add Discount
                </button>
            </div>

            {loading && (
                <div className="flex justify-center py-10">
                    <Loader />
                </div>
            )}

            {error && <div className="text-red-600 bg-red-50 p-3 rounded mb-4">{error}</div>}

            {!loading && !error && (
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
                    <div className="max-w-full overflow-x-auto">
                        <Table>
                            <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                                <TableRow>
                                    <TableCell
                                        isHeader
                                        className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                                    >
                                        Name
                                    </TableCell>
                                    <TableCell
                                        isHeader
                                        className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                                    >
                                        Type
                                    </TableCell>
                                    <TableCell
                                        isHeader
                                        className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                                    >
                                        Percentage
                                    </TableCell>
                                    <TableCell
                                        isHeader
                                        className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                                    >
                                        Description
                                    </TableCell>
                                    <TableCell
                                        isHeader
                                        className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                                    >
                                        Status
                                    </TableCell>
                                    <TableCell
                                        isHeader
                                        className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                                    >
                                        Actions
                                    </TableCell>
                                </TableRow>
                            </TableHeader>

                            <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                                {discounts.length === 0 && (
                                    <TableRow>
                                        <TableCell className="px-5 py-10 text-center text-gray-500">
                                            <div className="col-span-6">No discounts found</div>
                                        </TableCell>
                                    </TableRow>
                                )}
                                {discounts.map((discount) => (
                                    <TableRow key={discount.id}>
                                        <TableCell className="px-5 py-4 sm:px-6 text-start">
                                            <div className="font-medium text-gray-800 dark:text-white/90">
                                                {discount.name}
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                                            {discount.type}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                                            <span className="font-semibold text-blue-600 dark:text-blue-400">
                                                {discount.percentage}%
                                            </span>
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                                            <div className="max-w-xs truncate">
                                                {discount.description || "-"}
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-start">
                                            <button
                                                onClick={() => toggleDiscountStatus(discount)}
                                                className={`px-3 py-1 rounded-full text-xs font-medium transition ${discount.isActive
                                                    ? "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400"
                                                    : "bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400"
                                                    }`}
                                            >
                                                {discount.isActive ? "Active" : "Inactive"}
                                            </button>
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    className="text-sm px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                                                    onClick={() => openEdit(discount.id)}
                                                >
                                                    Edit
                                                </button>
                                                <DeleteIconButton onClick={() => setDeleteId(discount.id)} />
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
                <div className="text-sm text-gray-600 dark:text-gray-400">
                    {totalCount !== null ? `Showing ${discounts.length} of ${totalCount}` : ""}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded disabled:opacity-50"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                    >
                        Prev
                    </button>
                    <span className="text-sm text-gray-600 dark:text-gray-400">Page {page}</span>
                    <button
                        className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded disabled:opacity-50"
                        onClick={() => setPage((p) => p + 1)}
                        disabled={totalCount !== null && page * pageSize >= totalCount}
                    >
                        Next
                    </button>
                </div>
            </div>

            {/* Create/Edit Modal */}
            <Modal
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                title={editing ? "Edit Discount" : "Create Discount"}
                footer={
                    <>
                        <button
                            className="px-4 py-2 bg-green-600 text-white rounded flex items-center gap-2 hover:bg-green-700 transition disabled:opacity-50"
                            onClick={submitForm}
                            disabled={submitting}
                        >
                            {submitting ? <Loader size={16} /> : editing ? "Save" : "Create"}
                        </button>
                        <button
                            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                            onClick={() => setIsFormOpen(false)}
                        >
                            Cancel
                        </button>
                    </>
                }
            >
                <div className="flex flex-col gap-4">
                    <div>
                        <Label>Name *</Label>
                        <Input
                            placeholder="e.g., Summer Sale"
                            value={form.name}
                            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        />
                    </div>
                    <div>
                        <Label>Type *</Label>
                        <Input
                            placeholder="e.g., seasonal, promotional"
                            value={form.type}
                            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                        />
                    </div>
                    <div>
                        <Label>Percentage *</Label>
                        <Input
                            type="number"
                            min="0"
                            max="100"
                            placeholder="0-100"
                            value={form.percentage}
                            onChange={(e) =>
                                setForm((f) => ({ ...f, percentage: Number(e.target.value) }))
                            }
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Enter a value between 0 and 100
                        </p>
                    </div>
                    <div>
                        <Label>Description</Label>
                        <textarea
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white resize-none"
                            rows={3}
                            placeholder="Optional description..."
                            value={form.description}
                            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="isActive"
                            checked={form.isActive}
                            onChange={(e) =>
                                setForm((f) => ({ ...f, isActive: e.target.checked }))
                            }
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <Label htmlFor="isActive" className="mb-0 cursor-pointer">
                            Active
                        </Label>
                    </div>
                </div>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={!!deleteId}
                onClose={() => setDeleteId(null)}
                title="Confirm Delete"
                footer={
                    <>
                        <button
                            className="px-4 py-2 bg-red-600 text-white rounded flex items-center gap-2 hover:bg-red-700 transition disabled:opacity-50"
                            onClick={async () => {
                                if (deleteId === null) return;
                                setDeleting(true);
                                try {
                                    await deleteDiscount(deleteId);
                                    setDiscounts((s) => s.filter((x) => x.id !== deleteId));
                                    setDeleteId(null);
                                    setError(null);
                                    setNotification({
                                        variant: "success",
                                        title: "Deleted",
                                        message: "Discount deleted successfully",
                                    });
                                } catch (err) {
                                    let message = "Failed to delete";
                                    if (err && typeof err === "object") {
                                        const maybe = err as { message?: unknown };
                                        if (typeof maybe.message === "string") message = maybe.message;
                                    }
                                    setError(message);
                                    setNotification({
                                        variant: "error",
                                        title: "Delete failed",
                                        message,
                                    });
                                } finally {
                                    setDeleting(false);
                                }
                            }}
                            disabled={deleting}
                        >
                            {deleting ? <Loader size={16} /> : "Delete"}
                        </button>
                        <button
                            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                            onClick={() => setDeleteId(null)}
                        >
                            Cancel
                        </button>
                    </>
                }
            >
                <div className="space-y-4">
                    <p className="text-gray-700 dark:text-gray-300">
                        Are you sure you want to delete this discount? This action cannot be undone.
                    </p>
                </div>
            </Modal>

            {/* Toast notification */}
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
}
