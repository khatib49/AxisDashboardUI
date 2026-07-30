import { useEffect, useState, useCallback, useMemo } from "react";
import Modal from "../../components/ui/Modal";
import { useModal } from "../../hooks/useModal";
import userService, { UserDto, RegisterRequest } from "../../services/userService";
import { updateUser } from "../../services/userService";
import Loader from "../../components/ui/Loader";
import Label from "../../components/form/Label";
import Input from "../../components/form/input/InputField";
import Select from "../../components/form/Select";
import Button from "../../components/ui/button/Button";
import { EyeCloseIcon, EyeIcon } from "../../icons";

const SearchIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
    </svg>
);

const PlusIconSm = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 5v14M5 12h14" />
    </svg>
);

const EditIconSm = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
);

const TrashIconSm = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
);

function avatarColor(seed: unknown) {
    const colors = [
        "from-violet-500 to-fuchsia-500",
        "from-cyan-500 to-blue-500",
        "from-emerald-500 to-teal-500",
        "from-orange-500 to-rose-500",
        "from-pink-500 to-purple-500",
        "from-indigo-500 to-sky-500",
    ];
    const s = String(seed ?? "");
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return colors[h % colors.length];
}

function StatusBadge({ statusId }: { statusId: number }) {
    if (statusId === 1) {
        return (
            <span className="status-pill bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-300 ring-1 ring-inset ring-success-200/50 dark:ring-success-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-success-500" />
                Enabled
            </span>
        );
    }
    if (statusId === 2) {
        return (
            <span className="status-pill bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300 ring-1 ring-inset ring-orange-200/60 dark:ring-orange-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                Disabled
            </span>
        );
    }
    if (statusId === 8) {
        return (
            <span className="status-pill bg-gray-800 text-white dark:bg-gray-700">
                <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
                Suspended
            </span>
        );
    }
    return <span className="status-pill bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-gray-300">Unknown</span>;
}

function RoleChip({ role }: { role: string }) {
    const map: Record<string, string> = {
        admin: "bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/20",
        cashier: "bg-cyan-50 text-cyan-700 ring-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-300 dark:ring-cyan-500/20",
        gamecashier: "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200 dark:bg-fuchsia-500/10 dark:text-fuchsia-300 dark:ring-fuchsia-500/20",
        chef: "bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-500/20",
        bartender: "bg-pink-50 text-pink-700 ring-pink-200 dark:bg-pink-500/10 dark:text-pink-300 dark:ring-pink-500/20",
        admin_fnb: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20",
        client: "bg-gray-100 text-gray-700 ring-gray-200 dark:bg-white/5 dark:text-gray-300 dark:ring-white/10",
    };
    const cls = map[role] || "bg-gray-100 text-gray-700 ring-gray-200 dark:bg-white/5 dark:text-gray-300 dark:ring-white/10";
    return (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold ring-1 ring-inset ${cls}`}>
            {role}
        </span>
    );
}

export default function UsersManagement() {
    const { isOpen, openModal, closeModal } = useModal();
    const [users, setUsers] = useState<UserDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalCount, setTotalCount] = useState(0);
    const [search, setSearch] = useState("");

    // form
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [roleName, setRoleName] = useState("cashier");
    const [statusId, setStatusId] = useState<number>(1);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState<string | null>(null);

    const [showPassword, setShowPassword] = useState(false);

    const loadUsers = useCallback(async () => {
        setLoading(true);
        try {
            const res = await userService.getUsers(page, pageSize);
            setUsers(res.data);
            setTotalCount(res.totalCount ?? 0);
        } catch (e: unknown) {
            console.error(e);
            let msg = 'Failed to load users';
            if (e instanceof Error) msg = e.message;
            else msg = String(e);
            setMessage(msg);
        } finally {
            setLoading(false);
        }
    }, [page, pageSize]);

    useEffect(() => {
        loadUsers();
    }, [loadUsers]);

    // Client-side search filter (server-side pagination is preserved).
    const filteredUsers = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return users;
        return users.filter((u) =>
            (u.email || "").toLowerCase().includes(q) ||
            (u.displayName || "").toLowerCase().includes(q) ||
            (u.roles || []).some((r) => r.toLowerCase().includes(q))
        );
    }, [users, search]);

    const handleOpen = () => {
        setEmail('');
        setPassword('');
        setDisplayName('');
        setRoleName('cashier');
        setStatusId(1);
        setEditingId(null);
        setMessage(null);
        openModal();
    };

    const handleEdit = (u: UserDto) => {
        setEditingId(u.id);
        setEmail(u.email);
        setDisplayName(u.displayName);
        setRoleName(u.roles?.[0] || 'cashier');
        setStatusId(u.statusId ?? 1);
        setPassword('');
        setMessage(null);
        openModal();
    };

    const handleRegister = async () => {
        setSaving(true);
        setMessage(null);
        try {
            if (editingId) {
                const updateBody: { displayName: string; email: string; roles: string[]; statusId: number; password?: string } = {
                    displayName,
                    email,
                    roles: [roleName],
                    statusId
                };
                if (password && password.trim().length > 0) {
                    updateBody.password = password;
                }
                const res = await updateUser(editingId, updateBody);
                setMessage(res?.message || 'User updated');
                closeModal();
                loadUsers();
                return;
            }
            const body: RegisterRequest = { email, password, displayName, roleName, statusId: 1 };
            const res = await userService.registerUser(body);
            setMessage(res?.message || 'User created');
            closeModal();
            loadUsers();
        } catch (err: unknown) {
            console.error(err);
            let msg = 'Registration failed';
            if (err instanceof Error) msg = err.message;
            else msg = String(err);
            const maybeResponse = (err as unknown) as { response?: { data?: { message?: unknown } } };
            const maybe = maybeResponse?.response?.data?.message;
            if (typeof maybe === 'string' && maybe.length) msg = maybe;
            setMessage(msg);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteClick = (userId: string) => {
        setUserToDelete(userId);
        setDeleteModalOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!userToDelete) return;
        setDeleting(true);
        try {
            await userService.deleteUser(userToDelete);
            setMessage('User deleted successfully');
            setDeleteModalOpen(false);
            setUserToDelete(null);
            loadUsers();
        } catch (err: unknown) {
            console.error(err);
            let msg = 'Failed to delete user';
            if (err instanceof Error) msg = err.message;
            else msg = String(err);
            setMessage(msg);
        } finally {
            setDeleting(false);
        }
    };

    const initials = (name: string) =>
        (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");

    return (
        <div className="space-y-5">
            {/* Page header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Users Management</h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {totalCount.toLocaleString()} total users · invite, edit and manage roles.
                    </p>
                </div>
                <Button variant="gradient" size="md" startIcon={<PlusIconSm />} onClick={handleOpen}>
                    Add User
                </Button>
            </div>

            {/* Toolbar: search */}
            <div className="data-table-shell">
                <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between border-b border-gray-100 dark:border-white/5">
                    <div className="relative w-full sm:max-w-sm">
                        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                            <SearchIcon />
                        </span>
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search email, name, or role…"
                            className="h-11 w-full rounded-xl border border-gray-200 bg-white/70 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 transition-all focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/15 dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
                        />
                        {search && (
                            <button
                                type="button"
                                onClick={() => setSearch("")}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-white/5 dark:hover:text-white"
                                aria-label="Clear search"
                            >
                                ×
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <span className="hidden sm:inline">Showing</span>
                        <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                            {filteredUsers.length}
                        </span>
                        <span>of {users.length} on this page</span>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader />
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>User</th>
                                        <th>Email</th>
                                        <th>Role</th>
                                        <th>Status</th>
                                        <th className="text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredUsers.length === 0 ? (
                                        <tr>
                                            <td colSpan={5}>
                                                <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                                                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 dark:bg-white/5">
                                                        <SearchIcon />
                                                    </div>
                                                    <p className="font-semibold text-gray-700 dark:text-gray-200">No users match your search</p>
                                                    <p className="text-sm text-gray-500 dark:text-gray-400">Try a different name, email or role.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredUsers.map((u) => (
                                        <tr key={String(u.id)}>
                                            <td>
                                                <div className="flex items-center gap-3">
                                                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${avatarColor(u.email)} text-white text-xs font-bold shadow-sm`}>
                                                        {initials(u.displayName || u.email)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="font-semibold text-gray-900 dark:text-white truncate">
                                                            {u.displayName || "—"}
                                                        </div>
                                                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                                            ID · {String(u.id).slice(0, 8)}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="whitespace-nowrap text-gray-700 dark:text-gray-300">{u.email}</td>
                                            <td>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {(u.roles || []).map((r) => <RoleChip key={r} role={r} />)}
                                                </div>
                                            </td>
                                            <td>
                                                <StatusBadge statusId={u.statusId ?? 1} />
                                            </td>
                                            <td>
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        onClick={() => handleEdit(u)}
                                                        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10 transition-colors"
                                                        title="Edit"
                                                    >
                                                        <EditIconSm />
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteClick(String(u.id))}
                                                        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-error-600 hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-500/10 transition-colors"
                                                        title="Delete"
                                                    >
                                                        <TrashIconSm />
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between border-t border-gray-100 dark:border-white/5">
                            <div className="flex items-center gap-2">
                                <label className="text-sm text-gray-500 dark:text-gray-400">Rows per page:</label>
                                <Select
                                    options={[{ value: 5, label: '5' }, { value: 10, label: '10' }, { value: 25, label: '25' }, { value: 50, label: '50' }]}
                                    defaultValue={pageSize}
                                    onChange={(v: string | number) => { setPageSize(Number(v)); setPage(1); }}
                                    className="w-24"
                                />
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                    Showing <span className="font-semibold text-gray-900 dark:text-white">{Math.min((page - 1) * pageSize + 1, totalCount || 0)}</span>
                                    {" – "}
                                    <span className="font-semibold text-gray-900 dark:text-white">{Math.min(page * pageSize, totalCount || 0)}</span>
                                    {" of "}
                                    <span className="font-semibold text-gray-900 dark:text-white">{totalCount.toLocaleString()}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <button
                                        className="inline-flex h-9 items-center gap-1 rounded-lg border border-gray-200 bg-white/70 px-3 text-sm font-medium text-gray-700 transition-all hover:border-brand-300 hover:text-brand-700 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-gray-200 disabled:hover:text-gray-700 disabled:hover:shadow-none dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:text-white"
                                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                                        disabled={page <= 1}
                                    >
                                        ‹ Prev
                                    </button>
                                    <button
                                        className="inline-flex h-9 items-center gap-1 rounded-lg border border-gray-200 bg-white/70 px-3 text-sm font-medium text-gray-700 transition-all hover:border-brand-300 hover:text-brand-700 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-gray-200 disabled:hover:text-gray-700 disabled:hover:shadow-none dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:text-white"
                                        onClick={() => setPage((p) => p + 1)}
                                        disabled={page * pageSize >= totalCount}
                                    >
                                        Next ›
                                    </button>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            <Modal
                isOpen={isOpen}
                onClose={closeModal}
                title={editingId ? 'Edit User' : 'Create User'}
                footer={(
                    <>
                        <Button variant="outline" size="sm" onClick={closeModal} disabled={saving}>Cancel</Button>
                        <Button variant="gradient" size="sm" onClick={handleRegister} disabled={saving}>
                            {saving ? 'Saving…' : (editingId ? 'Save changes' : 'Create user')}
                        </Button>
                    </>
                )}
            >
                <div className="space-y-4">
                    {message && (
                        <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-300">
                            {message}
                        </div>
                    )}
                    <div>
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="info@axislb.com" />
                    </div>
                    <div>
                        <Label htmlFor="password">{editingId ? 'New Password (leave blank to keep current)' : 'Password'}</Label>

                        <div className="relative">
                            <Input
                                type={showPassword ? "text" : "password"}
                                placeholder={editingId ? "Leave blank to keep current password" : "Enter password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <span
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                            >
                                {showPassword ? (
                                    <EyeIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                                ) : (
                                    <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                                )}
                            </span>
                        </div>
                    </div>
                    <div>
                        <Label htmlFor="displayName">Display Name</Label>
                        <Input id="displayName" type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name" />
                    </div>
                    <div>
                        <Label>Role</Label>
                        <Select
                            options={[{ value: 'cashier', label: 'cashier' }, { value: 'admin', label: 'admin' }, { value: "gamecashier", label: "game cashier" }, { value: "admin_fnb", label: "admin f&b" }, { value: "chef", label: "chef" }, { value: "bartender", label: "bartender" }, { value: "stock", label: "stock management" }]}
                            placeholder="Select a role"
                            defaultValue={roleName}
                            onChange={(v: string | number) => setRoleName(String(v))}
                        />
                    </div>

                    {editingId && (
                        <div>
                            <Label>Status</Label>
                            <Select
                                options={[
                                    { value: 1, label: 'Enabled' },
                                    { value: 2, label: 'Disabled' },
                                    { value: 8, label: 'Suspended' }
                                ]}
                                placeholder="Select a status"
                                defaultValue={statusId}
                                onChange={(v: string | number) => setStatusId(Number(v))}
                            />
                        </div>
                    )}
                </div>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={deleteModalOpen}
                onClose={() => {
                    setDeleteModalOpen(false);
                    setUserToDelete(null);
                }}
                title="Confirm Delete"
                footer={(
                    <>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setDeleteModalOpen(false);
                                setUserToDelete(null);
                            }}
                            disabled={deleting}
                        >
                            Cancel
                        </Button>
                        <Button variant="danger" size="sm" onClick={handleDeleteConfirm} disabled={deleting}>
                            {deleting ? <Loader size={16} /> : 'Delete'}
                        </Button>
                    </>
                )}
            >
                <p className="text-sm text-gray-600 dark:text-gray-300">
                    Are you sure you want to delete this user? This action cannot be undone.
                </p>
            </Modal>
        </div>
    );
}
