import { useEffect, useState } from "react";
import {
    getExpenseCategories,
    createExpenseCategory,
    updateExpenseCategory,
    deleteExpenseCategory,
    getExpenseAccounts,
    rebuildExpenseCategory,
    ExpenseCategoryDto,
    ExpenseCategoryCreateDto,
    ExpenseCategoryUpdateDto,
    AccountDto,
} from "../../services/expenseService";
import Modal from "../../components/ui/Modal";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import Loader from "../../components/ui/Loader";
import Alert from "../../components/ui/alert/Alert";


export default function ExpenseCategories() {
    const [categories, setCategories] = useState<ExpenseCategoryDto[]>([]);
    const [accounts, setAccounts] = useState<AccountDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editing, setEditing] = useState<ExpenseCategoryDto | null>(null);
    const [form, setForm] = useState<{
        name: string;
        description: string;
        accountId: number | null;
        isCapital: boolean;
    }>({
        name: "",
        description: "",
        accountId: null,
        isCapital: false,
    });
    const [submitting, setSubmitting] = useState(false);
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [rebuilding, setRebuilding] = useState(false);

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
        setError(null);

        Promise.all([getExpenseCategories(), getExpenseAccounts()])
            .then(([categoriesData, accountsData]) => {
                if (!mounted) return;
                setCategories(categoriesData || []);
                setAccounts(accountsData || []);
            })
            .catch((err) => {
                if (!mounted) return;
                setError(err?.message || "Failed to load data");
            })
            .finally(() => {
                if (!mounted) return;
                setLoading(false);
            });

        return () => { mounted = false; };
    }, []);

    function openCreateForm() {
        setEditing(null);
        setForm({ name: "", description: "", accountId: null, isCapital: false });
        setIsFormOpen(true);
    }

    function openEditForm(category: ExpenseCategoryDto) {
        setEditing(category);
        setForm({
            name: category.name,
            description: category.description || "",
            accountId: category.accountId || null,
            isCapital: category.isCapital ?? false,
        });
        setIsFormOpen(true);
    }

    async function submitForm() {
        if (!form.name.trim()) {
            setNotification({ variant: "error", title: "Validation", message: "Category name is required" });
            return;
        }

        setSubmitting(true);
        try {
            if (editing) {
                const dto: ExpenseCategoryUpdateDto = {
                    name: form.name,
                    description: form.description || null,
                    accountId: form.accountId,
                    isCapital: form.isCapital,
                };
                const updated = await updateExpenseCategory(editing.id, dto);
                setCategories((s) => s.map((c) => (c.id === editing.id ? updated : c)));
                setNotification({ variant: "success", title: "Updated", message: "Category updated successfully" });
            } else {
                const dto: ExpenseCategoryCreateDto = {
                    name: form.name,
                    description: form.description || null,
                    accountId: form.accountId,
                    isCapital: form.isCapital,
                };
                const created = await createExpenseCategory(dto);
                setCategories((s) => [...s, created]);
                setNotification({ variant: "success", title: "Created", message: "Category created successfully" });
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

    // Manually trigger the per-category backfill (re-points existing journal
    // entries to the currently mapped account and creates entries for any
    // expense that has none). Synchronous: returns the actual stats so the
    // admin can tell whether the category had expenses to process.
    async function handleRebuild() {
        if (!editing) return;
        if (!form.accountId) {
            setNotification({ variant: "warning", title: "No mapping", message: "Save a mapping first, then rebuild." });
            return;
        }
        setRebuilding(true);
        try {
            const result = await rebuildExpenseCategory(editing.id);
            if (result.total === 0) {
                setNotification({
                    variant: "info",
                    title: "Nothing to rebuild",
                    message: "This category has no expenses yet — nothing to post to the account.",
                });
            } else if (result.failed > 0) {
                setNotification({
                    variant: "warning",
                    title: `Rebuilt with ${result.failed} failure(s)`,
                    message: `Processed ${result.total} expense(s), succeeded ${result.success}. ${result.errors.slice(0, 2).join("; ")}`,
                });
            } else {
                setNotification({
                    variant: "success",
                    title: "Rebuild complete",
                    message: `Processed ${result.total} expense(s). Account balance should be updated — refresh Chart of Accounts.`,
                });
            }
        } catch (err: unknown) {
            let message = "Failed to rebuild";
            if (err && typeof err === "object") {
                const maybe = err as { message?: unknown };
                if (typeof maybe.message === "string") message = maybe.message;
            }
            setNotification({ variant: "error", title: "Rebuild failed", message });
        } finally {
            setRebuilding(false);
        }
    }

    async function confirmDelete() {
        if (!deleteId) return;
        setDeleting(true);
        try {
            await deleteExpenseCategory(deleteId);
            setCategories((s) => s.filter((c) => c.id !== deleteId));
            setDeleteId(null);
            setNotification({ variant: "success", title: "Deleted", message: "Category deleted successfully" });
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
                <h1 className="text-2xl font-semibold">Expense Categories</h1>
                <button
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
                    onClick={openCreateForm}
                >
                    + Add Category
                </button>
            </div>

            {loading && (
                <div className="flex items-center justify-center py-20">
                    <Loader />
                </div>
            )}

            {error && (
                <div className="text-red-600 bg-red-50 p-3 rounded mb-4">{error}</div>
            )}

            {!loading && !error && (
                <>
                    <div className="bg-white rounded-lg shadow overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mapped Account</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {categories.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                                            No categories found
                                        </td>
                                    </tr>
                                )}
                                {categories.map((category) => (
                                    <tr key={category.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {category.id}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                                            {category.name}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {category.description || "-"}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            {category.isCapital ? (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                                    🏗️ Capital
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                    📋 Operating
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            {category.accountNumber ? (
                                                <span className="text-blue-600 font-mono">
                                                    {category.accountNumber} - {category.accountName}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400 italic">Not mapped</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                className="text-indigo-600 hover:text-indigo-900 mr-3"
                                                onClick={() => openEditForm(category)}
                                            >
                                                Edit
                                            </button>
                                            <button
                                                className="text-red-600 hover:text-red-900"
                                                onClick={() => setDeleteId(category.id)}
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-4 text-sm text-gray-600">
                        Total: {categories.length} categories &nbsp;·&nbsp;
                        <span className="text-purple-700 font-medium">
                            {categories.filter(c => c.isCapital).length} Capital
                        </span>
                        &nbsp;·&nbsp;
                        <span className="text-blue-700 font-medium">
                            {categories.filter(c => !c.isCapital).length} Operating
                        </span>
                    </div>
                </>
            )}

            {/* Create/Edit Modal */}
            <Modal
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                title={editing ? "Edit Category" : "Create Category"}
            >
                <div className="flex flex-col gap-4">
                    <div>
                        <Label>Name *</Label>
                        <Input
                            placeholder="Category name"
                            value={form.name}
                            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        />
                    </div>

                    <div>
                        <Label>Description</Label>
                        <textarea
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            rows={3}
                            placeholder="Optional description..."
                            value={form.description}
                            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                        />
                    </div>

                    {/* Capital toggle */}
                    <div>
                        <Label>Expense Type</Label>
                        <div className="flex items-center gap-4 mt-1">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="expenseType"
                                    checked={!form.isCapital}
                                    onChange={() => setForm((f) => ({ ...f, isCapital: false }))}
                                    className="w-4 h-4 text-blue-600"
                                />
                                <span className="text-sm font-medium text-gray-700">
                                    📋 Operating
                                </span>
                                <span className="text-xs text-gray-400">
                                    (recurring — shown in monthly P&L)
                                </span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="expenseType"
                                    checked={form.isCapital}
                                    onChange={() => setForm((f) => ({ ...f, isCapital: true }))}
                                    className="w-4 h-4 text-purple-600"
                                />
                                <span className="text-sm font-medium text-gray-700">
                                    🏗️ Capital
                                </span>
                                <span className="text-xs text-gray-400">
                                    (one-time investment — shown separately)
                                </span>
                            </label>
                        </div>
                    </div>

                    {/* Account mapping */}
                    <div>
                        <Label>Map to Account (Optional)</Label>
                        <select
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            value={form.accountId || ""}
                            onChange={(e) =>
                                setForm((f) => ({
                                    ...f,
                                    accountId: e.target.value ? Number(e.target.value) : null,
                                }))
                            }
                        >
                            <option value="">-- No mapping --</option>
                            {/* Group by AccountType so non-expense mappings (Equity for owner
                                draws like "Omar cash out", Revenue for manual income like
                                "Toters income") are easy to find. */}
                            {Array.from(
                                accounts.reduce((map, a) => {
                                    const key = a.accountTypeName || "Other";
                                    if (!map.has(key)) map.set(key, []);
                                    map.get(key)!.push(a);
                                    return map;
                                }, new Map<string, typeof accounts>())
                            )
                                .sort(([a], [b]) => {
                                    // Show in natural accounting order
                                    const order = ["Asset", "Liability", "Equity", "Revenue", "Expense", "Other"];
                                    return order.indexOf(a) - order.indexOf(b);
                                })
                                .map(([groupName, items]) => (
                                    <optgroup key={groupName} label={groupName}>
                                        {items.map((account) => (
                                            <option key={account.id} value={account.id}>
                                                {account.accountNumber} - {account.accountName}
                                            </option>
                                        ))}
                                    </optgroup>
                                ))}
                        </select>
                        <p className="mt-1 text-xs text-gray-500">
                            Pick the real account this category posts to. Equity (owner draws),
                            Revenue (manual income) and Expense accounts are all selectable —
                            the dashboard classifies entries by account type, not by category.
                            Changing this will backfill missing journal entries automatically.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2">
                        <button
                            className="px-4 py-2 bg-green-600 text-white rounded flex items-center gap-2 disabled:opacity-50"
                            onClick={submitForm}
                            disabled={submitting}
                        >
                            {submitting ? (
                                <Loader size={16} />
                            ) : editing ? (
                                "Save Changes"
                            ) : (
                                "Create Category"
                            )}
                        </button>
                        {/* Rebuild Balances — only meaningful when editing an
                            existing category that has a mapped account. Runs
                            the per-category backfill synchronously and reports
                            exactly how many expenses were processed. Use this
                            if Save says "ok" but the account balance still
                            doesn't reflect what you expect. */}
                        {editing && (
                            <button
                                type="button"
                                className="px-4 py-2 bg-indigo-600 text-white rounded flex items-center gap-2 disabled:opacity-50"
                                onClick={handleRebuild}
                                disabled={rebuilding || !form.accountId}
                                title={!form.accountId ? "Map an account first" : "Re-post all expenses in this category"}
                            >
                                {rebuilding ? <Loader size={16} /> : "Rebuild Balances"}
                            </button>
                        )}
                        <button
                            className="px-4 py-2 bg-gray-200 rounded"
                            onClick={() => setIsFormOpen(false)}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Delete Modal */}
            <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Confirm Delete">
                <div className="space-y-4">
                    <p>Are you sure you want to delete this category? This action cannot be undone.</p>
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

            {/* Toast */}
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