import { useEffect, useState, useCallback } from "react";
import { Button as AntButton, Dropdown, Empty, Input as AntInput, Skeleton, Table, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
    CheckCircleOutlined,
    DeleteOutlined,
    EditOutlined,
    MoreOutlined,
    PlusOutlined,
    ReloadOutlined,
    SearchOutlined,
    StopOutlined,
    TeamOutlined,
    WarningOutlined,
} from "@ant-design/icons";
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
import { getRoles, roleLabel } from "../../services/roleService";
import { PageHeader, Panel, Pill, StatTile } from "../../components/ui/PageKit";
import PagerFooter from "../../components/inventory/PagerFooter";
import PersonAvatar from "../../components/admin/people/PersonAvatar";

type PillTone = "gray" | "violet" | "purple" | "blue" | "emerald" | "amber" | "red";

// statusId → label + tone. Text always shown next to the dot (never colour alone).
const STATUS_META: Record<number, { label: string; tone: PillTone }> = {
    1: { label: "Enabled", tone: "emerald" },
    2: { label: "Disabled", tone: "amber" },
    8: { label: "Suspended", tone: "red" },
};

function StatusPill({ statusId }: { statusId: number }) {
    const meta = STATUS_META[statusId] ?? { label: "Unknown", tone: "gray" as const };
    return <Pill tone={meta.tone} dot>{meta.label}</Pill>;
}

const DEFAULT_ROLE_OPTIONS = [
    { value: 'cashier', label: 'Cashier' }, { value: 'admin', label: 'Admin' }, { value: 'gamecashier', label: 'Gamecashier' },
    { value: 'admin_fnb', label: 'Admin fnb' }, { value: 'chef', label: 'Chef' }, { value: 'bartender', label: 'Bartender' },
    { value: 'stock', label: 'Stock' }, { value: 'social_media', label: 'Social media' },
];

const ROLE_TONE: Record<string, PillTone> = {
    admin: "violet",
    cashier: "blue",
    gamecashier: "purple",
    chef: "amber",
    bartender: "red",
    admin_fnb: "emerald",
    client: "gray",
};

function RolePill({ role }: { role: string }) {
    return <Pill tone={ROLE_TONE[role] ?? "gray"}>{roleLabel(role)}</Pill>;
}

export default function UsersManagement() {
    const { isOpen, openModal, closeModal } = useModal();
    const [users, setUsers] = useState<UserDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalCount, setTotalCount] = useState(0);
    const [search, setSearch] = useState("");
    // What's actually been sent to the server. Kept separate from `search` so
    // the input stays instant while requests are debounced.
    const [appliedSearch, setAppliedSearch] = useState("");
    // Presentation only: skeletons until the first response lands (no fake zeros).
    const [loadedOnce, setLoadedOnce] = useState(false);

    // form
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [roleName, setRoleName] = useState("cashier");
    // Roles come from Admin → Roles & Permissions (built-in + custom).
    const [roleOptions, setRoleOptions] = useState<{ value: string; label: string }[]>(DEFAULT_ROLE_OPTIONS);
    useEffect(() => {
        getRoles()
            .then((rs) => setRoleOptions(rs.map((r) => ({ value: r.name, label: roleLabel(r.name) }))))
            .catch(() => { /* keep the defaults */ });
    }, []);
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
            const res = await userService.getUsers(page, pageSize, appliedSearch);
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
            setLoadedOnce(true);
        }
    }, [page, pageSize, appliedSearch]);

    useEffect(() => {
        loadUsers();
    }, [loadUsers]);

    // Debounce typing into a single request, and jump back to page 1 — staying
    // on page 4 of the old result set would show an empty table.
    useEffect(() => {
        const t = setTimeout(() => {
            // Both plain calls — a setState updater must stay pure, so the
            // page reset can't live inside one. React batches these into a
            // single re-render, hence a single fetch.
            setAppliedSearch(search.trim());
            setPage(1);
        }, 350);
        return () => clearTimeout(t);
    }, [search]);

    // The server already filtered; this is just the rows it sent back.
    const filteredUsers = users;

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

    // KPIs — the total comes from the server; the rest count the page already loaded.
    const firstLoad = !loadedOnce;
    const enabledOnPage = filteredUsers.filter((u) => (u.statusId ?? 1) === 1).length;
    const disabledOnPage = filteredUsers.filter((u) => u.statusId === 2).length;
    const suspendedOnPage = filteredUsers.filter((u) => u.statusId === 8).length;

    const columns: ColumnsType<UserDto> = [
        {
            title: "User",
            key: "user",
            width: 320,
            render: (_, u) => (
                <div className="flex min-w-0 items-center gap-3">
                    <PersonAvatar name={u.displayName || u.email} seed={u.email} />
                    <div className="min-w-0">
                        <button
                            type="button"
                            onClick={() => handleEdit(u)}
                            className="block max-w-full truncate text-left font-medium text-gray-900 hover:text-violet-700 dark:text-gray-100 dark:hover:text-violet-300"
                        >
                            {u.displayName || "—"}
                        </button>
                        <div className="truncate text-xs text-gray-500 dark:text-gray-400">{u.email}</div>
                    </div>
                </div>
            ),
        },
        {
            title: "Role",
            key: "roles",
            width: 220,
            render: (_, u) => (u.roles || []).length ? (
                <div className="flex flex-wrap gap-1.5">
                    {(u.roles || []).map((r) => <RolePill key={r} role={r} />)}
                </div>
            ) : <span className="text-gray-400 dark:text-gray-500">—</span>,
        },
        {
            title: "Status",
            key: "status",
            width: 130,
            render: (_, u) => <StatusPill statusId={u.statusId ?? 1} />,
        },
        {
            title: "ID",
            key: "id",
            width: 120,
            render: (_, u) => (
                <Tooltip title={String(u.id)}>
                    <code className="text-xs text-gray-500 dark:text-gray-400">{String(u.id).slice(0, 8)}</code>
                </Tooltip>
            ),
        },
        {
            title: <span className="sr-only">Actions</span>,
            key: "actions",
            width: 60,
            align: "right",
            fixed: "right",
            render: (_, u) => (
                <Dropdown
                    trigger={["click"]}
                    menu={{
                        items: [
                            { key: "edit", icon: <EditOutlined />, label: "Edit", onClick: () => handleEdit(u) },
                            { key: "delete", icon: <DeleteOutlined />, label: "Delete", danger: true, onClick: () => handleDeleteClick(String(u.id)) },
                        ],
                    }}
                >
                    <AntButton type="text" size="small" icon={<MoreOutlined />} aria-label={`Actions for ${u.displayName || u.email}`} />
                </Dropdown>
            ),
        },
    ];

    return (
        <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6">
            <PageHeader
                icon={<TeamOutlined />}
                title="Users Management"
                badge={!appliedSearch && loadedOnce ? `${totalCount.toLocaleString()} users` : undefined}
                description="Invite, edit and manage roles. Page access for each role is set under Roles & Permissions."
                actions={
                    <>
                        <Tooltip title="Refresh">
                            <AntButton icon={<ReloadOutlined />} onClick={() => loadUsers()} loading={loading} aria-label="Refresh" />
                        </Tooltip>
                        <AntButton type="primary" icon={<PlusOutlined />} onClick={handleOpen}>Add user</AntButton>
                    </>
                }
            >
                <AntInput
                    allowClear
                    prefix={<SearchOutlined className="text-gray-400" />}
                    placeholder="Search name, email, username or phone…"
                    aria-label="Search users"
                    className="w-full sm:max-w-sm"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </PageHeader>

            {/* KPIs — total from the server, the rest from the page already loaded (no extra requests) */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatTile
                    label={appliedSearch ? "Matches" : "Users"}
                    loading={firstLoad}
                    value={<span className="tabular-nums">{totalCount.toLocaleString()}</span>}
                    sub={appliedSearch ? <>For “{appliedSearch}”</> : "All accounts"}
                    accent={<span className="rounded-lg bg-violet-50 p-1.5 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300"><TeamOutlined /></span>}
                />
                <StatTile
                    label="Enabled"
                    loading={firstLoad}
                    value={<span className="tabular-nums">{enabledOnPage}</span>}
                    sub="On this page"
                    accent={<span className="text-emerald-500"><CheckCircleOutlined /></span>}
                />
                <StatTile
                    label="Disabled"
                    loading={firstLoad}
                    value={<span className="tabular-nums">{disabledOnPage}</span>}
                    sub="On this page"
                    accent={disabledOnPage ? <span className="text-amber-500"><StopOutlined /></span> : undefined}
                />
                <StatTile
                    label="Suspended"
                    loading={firstLoad}
                    value={<span className="tabular-nums">{suspendedOnPage}</span>}
                    sub="On this page"
                    accent={suspendedOnPage ? <span className="text-red-500"><WarningOutlined /></span> : undefined}
                />
            </div>

            <Panel
                title={appliedSearch ? "Search results" : "All users"}
                subtitle={loadedOnce ? `${totalCount.toLocaleString()} ${appliedSearch ? "match" : "user"}${totalCount === 1 ? "" : (appliedSearch ? "es" : "s")}${appliedSearch ? ` for “${appliedSearch}”` : ""}` : undefined}
                bodyClassName="p-0"
            >
                {firstLoad ? (
                    <div className="p-5"><Skeleton active avatar paragraph={{ rows: 6 }} /></div>
                ) : (
                    <Table
                        rowKey={(u) => String(u.id)}
                        size="middle"
                        loading={loading}
                        columns={columns}
                        dataSource={filteredUsers}
                        pagination={false}
                        scroll={{ x: 860 }}
                        locale={{
                            emptyText: (
                                <Empty
                                    description={
                                        <div className="space-y-1">
                                            <div className="font-medium text-gray-700 dark:text-gray-200">
                                                {appliedSearch ? "No users match your search" : "No users yet"}
                                            </div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                                {appliedSearch
                                                    ? "Try a different name, email, username or phone number."
                                                    : "Add your first user to get started."}
                                            </div>
                                        </div>
                                    }
                                />
                            ),
                        }}
                    />
                )}

                <PagerFooter
                    shown={filteredUsers.length}
                    total={loadedOnce ? totalCount : null}
                    page={page}
                    pageSize={pageSize}
                    onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
                    onPrev={() => setPage((p) => Math.max(1, p - 1))}
                    onNext={() => setPage((p) => p + 1)}
                    prevDisabled={page <= 1}
                    nextDisabled={page * pageSize >= totalCount}
                />
            </Panel>

            <Modal
                isOpen={isOpen}
                onClose={closeModal}
                title={editingId ? 'Edit User' : 'Create User'}
                subtitle={editingId ? (displayName || email) : 'They sign in with this email and password.'}
                className="sm:max-w-xl!"
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
                                id="password"
                                type={showPassword ? "text" : "password"}
                                placeholder={editingId ? "Leave blank to keep current password" : "Enter password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label={showPassword ? "Hide password" : "Show password"}
                                className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                            >
                                {showPassword ? (
                                    <EyeIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                                ) : (
                                    <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                                )}
                            </button>
                        </div>
                    </div>
                    <div>
                        <Label htmlFor="displayName">Display Name</Label>
                        <Input id="displayName" type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name" />
                    </div>
                    <div className={editingId ? "grid gap-4 sm:grid-cols-2" : undefined}>
                        <div>
                            <Label>Role</Label>
                            <Select
                                options={roleOptions}
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
                className="sm:max-w-md!"
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
