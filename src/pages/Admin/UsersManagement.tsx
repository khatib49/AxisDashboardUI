import { useEffect, useState, useCallback } from "react";
import Modal from "../../components/ui/Modal";
import { useModal } from "../../hooks/useModal";
import userService, { UserDto, RegisterRequest } from "../../services/userService";
import { updateUser } from "../../services/userService";
import Loader from "../../components/ui/Loader";
import Label from "../../components/form/Label";
import Input from "../../components/form/input/InputField";
import Select from "../../components/form/Select";
import { EyeCloseIcon, EyeIcon } from "../../icons";

export default function UsersManagement() {
    const { isOpen, openModal, closeModal } = useModal();
    const [users, setUsers] = useState<UserDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalCount, setTotalCount] = useState(0);

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
                // update
                const updateBody: { displayName: string; email: string; roles: string[]; statusId: number; password?: string } = {
                    displayName,
                    email,
                    roles: [roleName],
                    statusId
                };
                // Only include password if it's not empty
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
            // try to extract nested response message if present
            // if axios-like error shape exists, try to read nested message
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

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-xl font-semibold">Users Management</h1>
                <button className="bg-green-600 text-white px-3 py-1 rounded" onClick={handleOpen}>Add User</button>
            </div>

            {loading ? (
                <Loader />
            ) : (
                <div className="bg-white rounded shadow">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Display Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Roles</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3" />
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y">
                                {users.map((u) => (
                                    <tr key={u.id}>
                                        <td className="px-6 py-4 whitespace-nowrap">{u.email}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">{u.displayName}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">{u.roles.join(', ')}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {(() => {
                                                const statusId = u.statusId ?? 1;
                                                if (statusId === 1) {
                                                    return <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-100 text-green-800 text-xs font-medium">Enabled</span>;
                                                }
                                                if (statusId === 2) {
                                                    return <span className="inline-flex items-center px-2 py-1 rounded-full bg-orange-100 text-orange-800 text-xs font-medium">Disabled</span>;
                                                }
                                                if (statusId === 8) {
                                                    return <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-700 text-white text-xs font-medium">Suspended</span>;
                                                }
                                                return <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 text-gray-800 text-xs">Unknown</span>;
                                            })()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <button className="text-sm text-blue-600 hover:text-blue-800" onClick={() => handleEdit(u)}>Edit</button>
                                                <button className="text-sm text-red-600 hover:text-red-800" onClick={() => handleDeleteClick(u.id)}>Delete</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex items-center justify-between px-4 py-3 border-t">
                        <div className="flex items-center gap-2">
                            <label className="text-sm text-gray-600">Rows:</label>
                            <Select options={[{ value: 5, label: '5' }, { value: 10, label: '10' }, { value: 25, label: '25' }, { value: 50, label: '50' }]} defaultValue={pageSize} onChange={(v: string | number) => { setPageSize(Number(v)); setPage(1); }} className="w-24" />
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="text-sm text-gray-600">Showing {Math.min((page - 1) * pageSize + 1, totalCount || 0)} - {Math.min(page * pageSize, totalCount || 0)} of {totalCount}</div>
                            <div className="flex items-center gap-2">
                                <button className="px-2 py-1 border rounded disabled:opacity-50" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Prev</button>
                                <button className="px-2 py-1 border rounded disabled:opacity-50" onClick={() => setPage((p) => p + 1)} disabled={page * pageSize >= totalCount}>Next</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <Modal
                isOpen={isOpen}
                onClose={closeModal}
                title={editingId ? 'Edit User' : 'Create User'}
                footer={(
                    <>
                        <button className="bg-gray-200 text-gray-800 px-3 py-1 rounded" onClick={closeModal} disabled={saving}>Cancel</button>
                        <button className="bg-blue-600 text-white px-3 py-1 rounded" onClick={handleRegister} disabled={saving}>{saving ? 'Saving...' : (editingId ? 'Save' : 'Create')}</button>
                    </>
                )}
            >
                <div className="space-y-4">
                    {message && <div className="text-sm text-red-600">{message}</div>}
                    <div>
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="info@gmail.com" />
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
                            options={[{ value: 'cashier', label: 'cashier' }, { value: 'admin', label: 'admin' }, { value: "gamecashier", label: "game cashier" }, { value: "admin_fnb", label: "admin f&b" }, { value: "chef", label: "chef" }]}
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

                    {/* actions moved to Modal footer */}
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
                        <button
                            className="bg-gray-200 text-gray-800 px-3 py-1 rounded"
                            onClick={() => {
                                setDeleteModalOpen(false);
                                setUserToDelete(null);
                            }}
                            disabled={deleting}
                        >
                            Cancel
                        </button>
                        <button
                            className="bg-red-600 text-white px-3 py-1 rounded flex items-center gap-2"
                            onClick={handleDeleteConfirm}
                            disabled={deleting}
                        >
                            {deleting ? <Loader size={16} /> : 'Delete'}
                        </button>
                    </>
                )}
            >
                <div>
                    <p>Are you sure you want to delete this user? This action cannot be undone.</p>
                </div>
            </Modal>
        </div>
    );
}
