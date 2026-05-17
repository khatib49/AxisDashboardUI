import { useEffect, useState } from "react";
import {
    queryExpenses,
    createExpense,
    updateExpense,
    deleteExpense,
    getExpenseCategories,
    ExpenseDto,
    ExpenseCreateDto,
    ExpenseUpdateDto,
    ExpenseCategoryDto,
} from "../../services/expenseService";
import Modal from "../../components/ui/Modal";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import Loader from "../../components/ui/Loader";
import Alert from "../../components/ui/alert/Alert";
import Select from "../../components/form/Select";
import DateTimePicker from "../../components/form/DateTimePicker";

export default function Expenses() {
    const [expenses, setExpenses] = useState<ExpenseDto[]>([]);
    const [categories, setCategories] = useState<ExpenseCategoryDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(20);
    const [totalCount, setTotalCount] = useState(0);
    const [totalAmount, setTotalAmount] = useState(0);
    const [totalAmountAll, setTotalAmountAll] = useState(0);
    const [reloadToken, setReloadToken] = useState(0);

    // Filters
    const [filterCategoryId, setFilterCategoryId] = useState<number | null>(null);
    const [filterFromDate, setFilterFromDate] = useState<string>("");
    const [filterToDate, setFilterToDate] = useState<string>("");

    // Form states
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editing, setEditing] = useState<ExpenseDto | null>(null);
    const [form, setForm] = useState<{
        categoryId: number | null;
        amount: number;
        paymentMethod: string;
        comment: string;
        fromDate: string;
        toDate: string;
    }>({
        categoryId: null,
        amount: 0,
        paymentMethod: "",
        comment: "",
        fromDate: "",
        toDate: "",
    });
    const [submitting, setSubmitting] = useState(false);

    // Delete confirmation
    const [deleteId, setDeleteId] = useState<number | null>(null);
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

    // Load expenses
    useEffect(() => {
        let mounted = true;
        setLoading(true);
        setError(null);

        queryExpenses({
            page,
            pageSize,
            categoryId: filterCategoryId || undefined,
            from: filterFromDate || undefined,
            to: filterToDate || undefined,
        })
            .then((result) => {
                if (!mounted) return;
                setExpenses(result.items || []);
                setTotalCount(result.totalCount || 0);
                setTotalAmount(result.totalAmount || 0);
                setTotalAmountAll(result.totalAmountAll || 0);
            })
            .catch((err) => {
                if (!mounted) return;
                setError(err?.message || "Failed to load expenses");
            })
            .finally(() => {
                if (!mounted) return;
                setLoading(false);
            });

        return () => {
            mounted = false;
        };
    }, [page, pageSize, filterCategoryId, filterFromDate, filterToDate, reloadToken]);

    // Load categories
    useEffect(() => {
        let mounted = true;
        getExpenseCategories()
            .then((data) => {
                if (!mounted) return;
                setCategories(data || []);
            })
            .catch(() => {
                /* ignore */
            });
        return () => {
            mounted = false;
        };
    }, []);

    function openCreateForm() {
        setEditing(null);
        setForm({
            categoryId: null,
            amount: 0,
            paymentMethod: "",
            comment: "",
            fromDate: "",
            toDate: "",
        });
        setIsFormOpen(true);
    }

    function openEditForm(expense: ExpenseDto) {
        setEditing(expense);
        setForm({
            categoryId: expense.categoryId,
            amount: expense.amount,
            paymentMethod: expense.paymentMethod || "",
            comment: expense.comment || "",
            fromDate: expense.fromDate, // ISO string for DateTimePicker
            toDate: expense.toDate,
        });
        setIsFormOpen(true);
    }

    async function submitForm() {
        if (!form.categoryId) {
            setNotification({ variant: "error", title: "Validation", message: "Please select a category" });
            return;
        }
        if (!form.fromDate || !form.toDate) {
            setNotification({ variant: "error", title: "Validation", message: "Please select from and to dates" });
            return;
        }

        setSubmitting(true);
        try {
            if (editing) {
                const dto: ExpenseUpdateDto = {
                    amount: form.amount,
                    paymentMethod: form.paymentMethod || null,
                    comment: form.comment || null,
                    fromDate: form.fromDate, // Already ISO string from DateTimePicker
                    toDate: form.toDate,
                    categoryId: form.categoryId,
                };
                const updated = await updateExpense(editing.id, dto);
                setExpenses((s) => s.map((e) => (e.id === editing.id ? updated : e)));
                setNotification({ variant: "success", title: "Updated", message: "Expense updated successfully" });
            } else {
                const dto: ExpenseCreateDto = {
                    categoryId: form.categoryId,
                    amount: form.amount,
                    paymentMethod: form.paymentMethod || null,
                    comment: form.comment || null,
                    fromDate: form.fromDate, // Already ISO string from DateTimePicker
                    toDate: form.toDate,
                };
                await createExpense(dto);
                setReloadToken((t) => t + 1);
                setNotification({ variant: "success", title: "Created", message: "Expense created successfully" });
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

    async function confirmDelete() {
        if (!deleteId) return;
        setDeleting(true);
        try {
            await deleteExpense(deleteId);
            setExpenses((s) => s.filter((e) => e.id !== deleteId));
            setDeleteId(null);
            setNotification({ variant: "success", title: "Deleted", message: "Expense deleted successfully" });
            setReloadToken((t) => t + 1);
        } catch (err: unknown) {
            let message = "Failed to delete";
            if (err && typeof err === "object") {
                const maybe = err as { message?: unknown };
                if (typeof maybe.message === "string") message = maybe.message;
            }
            setError(message);
            setNotification({ variant: "error", title: "Delete failed", message });
        } finally {
            setDeleting(false);
        }
    }

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-semibold">Expenses</h1>
                <button
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
                    onClick={openCreateForm}
                >
                    + Add Expense
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow p-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <Label>Category</Label>
                        <Select
                            options={[
                                { value: "", label: "All Categories" },
                                ...categories.map((c) => ({ value: c.id, label: c.name })),
                            ]}
                            defaultValue={filterCategoryId ?? ""}
                            onChange={(v) => {
                                setFilterCategoryId(v === "" ? null : Number(v));
                                setPage(1);
                            }}
                        />
                    </div>
                    <div>
                        <DateTimePicker
                            label="From Date"
                            mode="date"
                            value={filterFromDate}
                            onChange={(value) => {
                                setFilterFromDate(value);
                                setPage(1);
                            }}
                            placeholder="Select start date"
                        />
                    </div>
                    <div>
                        <DateTimePicker
                            label="To Date"
                            mode="date"
                            value={filterToDate}
                            onChange={(value) => {
                                setFilterToDate(value);
                                setPage(1);
                            }}
                            placeholder="Select end date"
                        />
                    </div>
                </div>
                {(filterCategoryId || filterFromDate || filterToDate) && (
                    <div className="mt-3">
                        <button
                            className="text-sm text-indigo-600 hover:text-indigo-800"
                            onClick={() => {
                                setFilterCategoryId(null);
                                setFilterFromDate("");
                                setFilterToDate("");
                                setPage(1);
                            }}
                        >
                            Clear Filters
                        </button>
                    </div>
                )}
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg shadow-lg p-6 text-white">
                    <p className="text-sm font-medium opacity-90">Total Expenses (Page)</p>
                    <p className="text-3xl font-bold mt-1">${totalAmount.toFixed(2)}</p>
                    <p className="text-xs opacity-75 mt-1">Current page total</p>
                </div>
                <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-lg shadow-lg p-6 text-white">
                    <p className="text-sm font-medium opacity-90">Total Expenses (All)</p>
                    <p className="text-3xl font-bold mt-1">${totalAmountAll.toFixed(2)}</p>
                    <p className="text-xs opacity-75 mt-1">All filtered results</p>
                </div>
                <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-lg shadow-lg p-6 text-white">
                    <p className="text-sm font-medium opacity-90">Total Records</p>
                    <p className="text-3xl font-bold mt-1">{totalCount}</p>
                    <p className="text-xs opacity-75 mt-1">Total expense entries</p>
                </div>
            </div>

            {loading && (
                <div className="flex items-center justify-center py-20">
                    <Loader />
                </div>
            )}

            {error && <div className="text-red-600 bg-red-50 p-3 rounded mb-4">{error}</div>}

            {!loading && !error && (
                <>
                    <div className="bg-white rounded-lg shadow overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        ID
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Category
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Amount
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Payment Method
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Period
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Comment
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Created
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {expenses.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-10 text-center text-gray-500">
                                            No expenses found
                                        </td>
                                    </tr>
                                )}
                                {expenses.map((expense) => (
                                    <tr key={expense.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {expense.id}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {expense.categoryName}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                                            ${expense.amount.toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {expense.paymentMethod || "-"}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            <div className="space-y-1">
                                                <div>From: {new Date(expense.fromDate).toLocaleDateString()}</div>
                                                <div>To: {new Date(expense.toDate).toLocaleDateString()}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                                            {expense.comment || "-"}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(expense.createdOn).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                className="text-indigo-600 hover:text-indigo-900 mr-3"
                                                onClick={() => openEditForm(expense)}
                                            >
                                                Edit
                                            </button>
                                            <button
                                                className="text-red-600 hover:text-red-900"
                                                onClick={() => setDeleteId(expense.id)}
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="mt-6 flex items-center justify-between">
                        <div className="text-sm text-gray-600">
                            Showing page {page} of {Math.max(1, Math.ceil(totalCount / pageSize))} — {totalCount} total
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page <= 1}
                            >
                                Prev
                            </button>
                            <div className="text-sm">Page {page}</div>
                            <button
                                className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
                                onClick={() => setPage((p) => p + 1)}
                                disabled={page >= Math.ceil(totalCount / pageSize)}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* Create/Edit Modal */}
            <Modal
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                title={editing ? "Edit Expense" : "Create Expense"}
            >
                <div className="flex flex-col gap-4">
                    <div>
                        <Label>Category *</Label>
                        <Select
                            options={[
                                { value: "", label: "-- Select category --" },
                                ...categories.map((c) => ({ value: c.id, label: c.name })),
                            ]}
                            defaultValue={form.categoryId ?? ""}
                            onChange={(v: string | number) =>
                                setForm((f) => ({ ...f, categoryId: v === "" ? null : Number(v) }))
                            }
                        />
                    </div>
                    <div>
                        <Label>Amount *</Label>
                        <Input
                            type="number"
                            placeholder="0.00"
                            value={form.amount}
                            onChange={(e) => setForm((f) => ({ ...f, amount: Number(e.target.value) }))}
                        />
                    </div>
                    <div>
                        <Label>Payment Method</Label>
                        <Input
                            placeholder="Cash, Card, Bank Transfer, etc."
                            value={form.paymentMethod}
                            onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))}
                        />
                    </div>
                    <div>
                        <DateTimePicker
                            label="From Date"
                            mode="date"
                            value={form.fromDate}
                            onChange={(value) => setForm((f) => ({ ...f, fromDate: value }))}
                            placeholder="Select start date"
                            required
                        />
                    </div>
                    <div>
                        <DateTimePicker
                            label="To Date"
                            mode="date"
                            value={form.toDate}
                            onChange={(value) => setForm((f) => ({ ...f, toDate: value }))}
                            placeholder="Select end date"
                            required
                        />
                    </div>
                    <div>
                        <Label>Comment</Label>
                        <textarea
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            rows={3}
                            placeholder="Additional notes..."
                            value={form.comment}
                            onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
                        />
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                        <button
                            className="px-4 py-2 bg-green-600 text-white rounded flex items-center gap-2 disabled:opacity-50"
                            onClick={submitForm}
                            disabled={submitting}
                        >
                            {submitting ? <Loader size={16} /> : editing ? "Save Changes" : "Create Expense"}
                        </button>
                        <button
                            className="px-4 py-2 bg-gray-200 rounded"
                            onClick={() => setIsFormOpen(false)}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Confirm Delete">
                <div className="space-y-4">
                    <p>Are you sure you want to delete this expense? This action cannot be undone.</p>
                    <div className="flex items-center gap-2">
                        <button
                            className="px-4 py-2 bg-red-600 text-white rounded flex items-center gap-2 disabled:opacity-50"
                            onClick={confirmDelete}
                            disabled={deleting}
                        >
                            {deleting ? <Loader size={16} /> : "Delete"}
                        </button>
                        <button className="px-4 py-2 bg-gray-200 rounded" onClick={() => setDeleteId(null)}>
                            Cancel
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Toast notification */}
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
