import { useEffect, useState } from "react";
import {
    createClient,
    searchClientsByPhone,
    getUsersByRoleId,
    updateClient,
    ClientUserDto,
    ClientUserCreateRequest,
    ClientUserUpdateRequest,
} from "../../services/clientService";
import Modal from "../../components/ui/Modal";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import Loader from "../../components/ui/Loader";
import Alert from "../../components/ui/alert/Alert";
import {
    Table,
    TableBody,
    TableCell,
    TableHeader,
    TableRow,
} from "../../components/ui/table";

const CLIENT_ROLE_ID = 6;

export default function ClientManagement() {
    const [clients, setClients] = useState<ClientUserDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchPhone, setSearchPhone] = useState("");
    const [searching, setSearching] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [totalPages, setTotalPages] = useState(0);

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editing, setEditing] = useState<ClientUserDto | null>(null);
    const [form, setForm] = useState<ClientUserCreateRequest>({
        phoneNumber: "",
        firstName: "",
        lastName: "",
        email: "",
    });
    const [submitting, setSubmitting] = useState(false);

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

    // Load all clients on mount and when page changes
    useEffect(() => {
        loadAllClients();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page]);

    async function loadAllClients() {
        setLoading(true);
        setError(null);
        try {
            const response = await getUsersByRoleId(CLIENT_ROLE_ID, page, pageSize);
            setClients(response.data || []);
            setTotalPages(response.totalPages || Math.ceil(response.totalCount / pageSize));
        } catch (err: unknown) {
            let message = "Failed to load clients";
            if (err && typeof err === "object") {
                const maybe = err as { message?: unknown };
                if (typeof maybe.message === "string") message = maybe.message;
            }
            setError(message);
        } finally {
            setLoading(false);
        }
    }

    async function handleSearch() {
        if (!searchPhone.trim()) {
            loadAllClients();
            return;
        }

        setSearching(true);
        setError(null);
        try {
            const data = await searchClientsByPhone(searchPhone);
            setClients(data || []);
            if (data.length === 0) {
                setNotification({
                    variant: "info",
                    title: "No Results",
                    message: "No clients found with that phone number",
                });
            }
        } catch (err: unknown) {
            let message = "Failed to search clients";
            if (err && typeof err === "object") {
                const maybe = err as { message?: unknown };
                if (typeof maybe.message === "string") message = maybe.message;
            }
            setError(message);
        } finally {
            setSearching(false);
        }
    }

    function openCreate() {
        setEditing(null);
        setForm({
            phoneNumber: "",
            firstName: "",
            lastName: "",
            email: "",
        });
        setIsFormOpen(true);
    }

    function openEdit(client: ClientUserDto) {
        setEditing(client);
        setForm({
            phoneNumber: client.phoneNumber || "",
            firstName: client.firstName || "",
            lastName: client.lastName || "",
            email: client.email || "",
        });
        setIsFormOpen(true);
    }

    async function submitForm() {
        // Validation
        if (!form.phoneNumber.trim()) {
            setNotification({
                variant: "error",
                title: "Validation",
                message: "Phone number is required",
            });
            return;
        }

        if (!form.firstName.trim()) {
            setNotification({
                variant: "error",
                title: "Validation",
                message: "First name is required",
            });
            return;
        }

        if (!form.lastName.trim()) {
            setNotification({
                variant: "error",
                title: "Validation",
                message: "Last name is required",
            });
            return;
        }

        if (!form.email.trim()) {
            setNotification({
                variant: "error",
                title: "Validation",
                message: "Email is required",
            });
            return;
        }

        setSubmitting(true);
        try {
            if (editing) {
                const request: ClientUserUpdateRequest = {
                    phoneNumber: form.phoneNumber,
                    firstName: form.firstName,
                    lastName: form.lastName,
                    email: form.email,
                };
                await updateClient(editing.id, request);
                setNotification({
                    variant: "success",
                    title: "Updated",
                    message: "Client updated successfully",
                });
            } else {
                const response = await createClient(form);
                if (response.isNewlyCreated) {
                    setNotification({
                        variant: "success",
                        title: "Created",
                        message: `Client '${response.displayName}' created successfully`,
                    });
                } else {
                    setNotification({
                        variant: "info",
                        title: "Existing Client",
                        message: `Client '${response.displayName}' already exists`,
                    });
                }
            }
            setIsFormOpen(false);
            setEditing(null);
            loadAllClients();
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
            <h1 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
                Client Management
            </h1>

            <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-64">
                        <Input
                            placeholder="Search by phone number..."
                            value={searchPhone}
                            onChange={(e) => setSearchPhone(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleSearch();
                            }}
                        />
                    </div>
                    <button
                        className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
                        onClick={handleSearch}
                        disabled={searching}
                    >
                        {searching ? <Loader size={16} /> : "Search"}
                    </button>
                    {searchPhone && (
                        <button
                            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                            onClick={() => {
                                setSearchPhone("");
                                loadAllClients();
                            }}
                        >
                            Clear
                        </button>
                    )}
                </div>
                <button
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                    onClick={openCreate}
                >
                    + Add Client
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
                                        Phone Number
                                    </TableCell>
                                    <TableCell
                                        isHeader
                                        className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                                    >
                                        Email
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
                                {clients.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="px-5 py-10 text-center text-gray-500">
                                            <div>No clients found</div>
                                        </TableCell>
                                    </TableRow>
                                )}
                                {clients.map((client) => (
                                    <TableRow key={client.id}>
                                        <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                                            <div className="font-medium text-gray-800 dark:text-white/90">
                                                {`${client.firstName || ""} ${client.lastName || ""}`.trim() || "-"}
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                                            {client.phoneNumber || "-"}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                                            {client.email || "-"}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                                            <button
                                                className="text-sm px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                                                onClick={() => openEdit(client)}
                                            >
                                                Edit
                                            </button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            )}

            {/* Pagination controls */}
            {!loading && !error && clients.length > 0 && (
                <div className="mt-4 flex items-center justify-between">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                        Page {page} of {totalPages}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded disabled:opacity-50"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page <= 1}
                        >
                            Prev
                        </button>
                        <span className="text-sm text-gray-600 dark:text-gray-400">Page {page} of {totalPages}</span>
                        <button
                            className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded disabled:opacity-50"
                            onClick={() => setPage((p) => p + 1)}
                            disabled={page >= totalPages}
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}

            {/* Create/Edit Modal */}
            <Modal
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                title={editing ? "Edit Client" : "Add Client"}
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
                        <Label>Phone Number *</Label>
                        <Input
                            placeholder="e.g., +961 70 123456"
                            value={form.phoneNumber}
                            onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))}
                        />
                    </div>
                    <div>
                        <Label>First Name *</Label>
                        <Input
                            placeholder="First name"
                            value={form.firstName}
                            onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                        />
                    </div>
                    <div>
                        <Label>Last Name *</Label>
                        <Input
                            placeholder="Last name"
                            value={form.lastName}
                            onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                        />
                    </div>
                    <div>
                        <Label>Email *</Label>
                        <Input
                            type="email"
                            placeholder="email@example.com"
                            value={form.email}
                            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                        />
                    </div>
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
