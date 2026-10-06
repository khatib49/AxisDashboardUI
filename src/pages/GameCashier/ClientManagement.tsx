import { useEffect, useState } from "react";
import { Empty, Skeleton } from "antd";
import {
    EditOutlined,
    LeftOutlined,
    MailOutlined,
    PhoneOutlined,
    PlusOutlined,
    RightOutlined,
    TeamOutlined,
    WalletOutlined,
    DownOutlined,
} from "@ant-design/icons";
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
import { Pill } from "../../components/ui/PageKit";
import { TillBar, TillButton, TillSearch } from "../../components/till/game/GameTillKit";
import WalletModal from "../../components/wallet/WalletModal";
import WalletMovements from "../../components/wallet/WalletMovements";
import { getWalletBalances } from "../../services/walletService";

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

    // Wallet balances for the rows on screen, plus which client's wallet is open.
    const [balances, setBalances] = useState<Record<number, number>>({});
    const [walletClient, setWalletClient] = useState<ClientUserDto | null>(null);
    // Cash-box feed — collapsed by default so the table stays the hero.
    const [showMovements, setShowMovements] = useState(false);
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

            // One batched call for the visible rows' wallet balances.
            // Failure is non-fatal — the column just shows a dash.
            try {
                const ids = (response.data || []).map((c: ClientUserDto) => c.id);
                if (ids.length > 0) setBalances(await getWalletBalances(ids));
            } catch { /* ignore */ }
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
        <div className="space-y-5 p-4 sm:p-6">
            <TillBar
                tone="violet"
                icon={<TeamOutlined />}
                title="Client Management"
                meta={!loading && !error ? <Pill tone="violet" dot>{clients.length} shown</Pill> : null}
                actions={
                    <TillButton variant="primary" onClick={openCreate} className="w-full sm:w-auto">
                        <PlusOutlined /> Add Client
                    </TillButton>
                }
            />

            {/* Phone lookup — the hero control on this screen */}
            <div className="rounded-2xl border border-gray-200/80 bg-white p-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:border-white/[0.06] dark:bg-white/[0.03] sm:p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <TillSearch
                        size="lg"
                        inputMode="tel"
                        placeholder="Search by phone number..."
                        value={searchPhone}
                        onChange={(v) => setSearchPhone(v)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") handleSearch();
                        }}
                        className="flex-1"
                    />
                    <div className="flex gap-2">
                        <TillButton
                            variant="primary"
                            size="lg"
                            onClick={handleSearch}
                            disabled={searching}
                            className="flex-1 sm:min-w-[8rem] sm:flex-none"
                        >
                            {searching ? <Loader size={16} /> : "Search"}
                        </TillButton>
                        {searchPhone && (
                            <TillButton
                                size="lg"
                                onClick={() => {
                                    setSearchPhone("");
                                    loadAllClients();
                                }}
                                className="flex-1 sm:flex-none"
                            >
                                Clear
                            </TillButton>
                        )}
                    </div>
                </div>
            </div>

            {loading && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Loading clients">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-[13.5rem] rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-white/[0.06] dark:bg-white/[0.03]">
                            <Skeleton active title={{ width: "55%" }} paragraph={{ rows: 3, width: ["70%", "40%", "90%"] }} />
                        </div>
                    ))}
                </div>
            )}

            {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                    {error}
                </div>
            )}

            {!loading && !error && (
                <>
                    {clients.length === 0 && (
                        <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-14 dark:border-white/[0.08] dark:bg-white/[0.02]">
                            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No clients found" />
                        </div>
                    )}
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {clients.map((client) => {
                            const name = `${client.firstName || ""} ${client.lastName || ""}`.trim() || "-";
                            const hasBalance = (balances[client.id] ?? 0) > 0;
                            return (
                                <div
                                    key={client.id}
                                    className="flex flex-col rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:border-white/[0.06] dark:bg-white/[0.03]"
                                >
                                    <div className="flex items-start gap-3 px-5 pt-5">
                                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-100 text-base font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" aria-hidden>
                                            {(client.firstName || client.lastName || "?").trim().charAt(0).toUpperCase() || "?"}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate text-base font-semibold text-gray-900 dark:text-white" title={name}>{name}</div>
                                            <div className="mt-0.5 flex items-center gap-1.5 truncate text-sm tabular-nums text-gray-600 dark:text-gray-300">
                                                <PhoneOutlined className="text-gray-400" />
                                                {client.phoneNumber || "-"}
                                            </div>
                                            <div className="flex items-center gap-1.5 truncate text-xs text-gray-500 dark:text-gray-400" title={client.email || undefined}>
                                                <MailOutlined className="text-gray-400" />
                                                <span className="truncate">{client.email || "-"}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Balance tile doubles as the wallet button (balance, top-up, history) */}
                                    <button
                                        type="button"
                                        onClick={() => setWalletClient(client)}
                                        title="Open wallet"
                                        className={`mx-5 mt-4 flex min-h-[4rem] items-center justify-between gap-3 rounded-xl px-4 py-3 text-left transition ${
                                            hasBalance
                                                ? "bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20"
                                                : "bg-gray-50 hover:bg-gray-100 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
                                        }`}
                                    >
                                        <div>
                                            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                                <WalletOutlined /> Wallet balance
                                            </div>
                                            <div className={`text-2xl font-semibold tabular-nums ${hasBalance ? "text-indigo-700 dark:text-indigo-300" : "text-gray-500 dark:text-gray-400"}`}>
                                                {balances[client.id] !== undefined ? `$${balances[client.id].toFixed(2)}` : "$0.00"}
                                            </div>
                                        </div>
                                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">History ›</span>
                                    </button>

                                    <div className="mt-auto grid grid-cols-2 gap-2 p-5 pt-4">
                                        <TillButton onClick={() => openEdit(client)}>
                                            <EditOutlined /> Edit
                                        </TillButton>
                                        <TillButton variant="emerald" onClick={() => setWalletClient(client)}>
                                            <PlusOutlined /> Top up
                                        </TillButton>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {/* Pagination controls */}
            {!loading && !error && clients.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm tabular-nums text-gray-600 dark:text-gray-400">
                        Page {page} of {totalPages}
                    </div>
                    <div className="flex items-center gap-2">
                        <TillButton
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page <= 1}
                        >
                            <LeftOutlined /> Prev
                        </TillButton>
                        <span className="hidden text-sm tabular-nums text-gray-600 dark:text-gray-400 sm:inline">Page {page} of {totalPages}</span>
                        <TillButton
                            onClick={() => setPage((p) => p + 1)}
                            disabled={page >= totalPages}
                        >
                            Next <RightOutlined />
                        </TillButton>
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
                        <TillButton
                            variant="emerald"
                            onClick={submitForm}
                            disabled={submitting}
                        >
                            {submitting ? <Loader size={16} /> : editing ? "Save" : "Create"}
                        </TillButton>
                        <TillButton
                            onClick={() => setIsFormOpen(false)}
                        >
                            Cancel
                        </TillButton>
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

            {/* Cash-box: every wallet top-up/spend as a filterable feed, so
                the cashier can reconcile the drawer at a glance. */}
            <section className="rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:border-white/[0.06] dark:bg-white/[0.03]">
                <button
                    type="button"
                    onClick={() => setShowMovements(v => !v)}
                    aria-expanded={showMovements}
                    className="flex min-h-[4rem] w-full items-center justify-between gap-3 rounded-2xl px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-white/[0.03]"
                >
                    <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-lg text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300" aria-hidden>
                            <WalletOutlined />
                        </span>
                        <div>
                            <div className="font-semibold text-gray-900 dark:text-white">Wallet money — cash box</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Today's top-ups and spends, with exact cash totals for the drawer.</div>
                        </div>
                    </div>
                    <DownOutlined className={`text-gray-400 transition-transform ${showMovements ? "" : "-rotate-90"}`} />
                </button>
                {showMovements && (
                    <div className="border-t border-gray-100 p-4 dark:border-white/[0.06]">
                        <WalletMovements compact />
                    </div>
                )}
            </section>

            {/* Wallet panel — balance, top-up with bonus preview, history */}
            {walletClient && (
                <WalletModal
                    open
                    userId={walletClient.id}
                    userName={`${walletClient.firstName || ""} ${walletClient.lastName || ""}`.trim() || walletClient.phoneNumber}
                    onClose={() => setWalletClient(null)}
                    onBalanceChange={(userId, newBalance) =>
                        setBalances((b) => ({ ...b, [userId]: newBalance }))}
                />
            )}
        </div>
    );
}
