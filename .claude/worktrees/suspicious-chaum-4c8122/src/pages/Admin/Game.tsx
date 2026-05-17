import { useEffect, useState } from "react";
import { getGames, GameDto } from "../../services/gameService";
import { createGame } from "../../services/gameService";
import { updateGame } from "../../services/gameService";
import Modal from "../../components/ui/Modal";
import Loader from "../../components/ui/Loader";
import Alert from "../../components/ui/alert/Alert";
import DeleteIconButton from "../../components/ui/DeleteIconButton";
import StatusToggle from '../../components/ui/StatusToggle';
import { getStatusName, STATUS_ENABLED, STATUS_DISABLED } from '../../services/statuses';
import { deleteGame } from "../../services/gameService";
import Label from "../../components/form/Label";
import Input from "../../components/form/input/InputField";
import Select from "../../components/form/Select";
import { getCategoriesByType, CategoryDto } from "../../services/categoryService";
import {
    Table,
    TableBody,
    TableCell,
    TableHeader,
    TableRow,
} from "../../components/ui/table";

export default function Game() {
    const [games, setGames] = useState<GameDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalCount, setTotalCount] = useState<number | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [name, setName] = useState("");
    const [categoryId, setCategoryId] = useState<number | null>(null);
    const [statusId, setStatusId] = useState<number | null>(STATUS_ENABLED);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [categories, setCategories] = useState<CategoryDto[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [notification, setNotification] = useState<{
        variant: "success" | "error" | "warning" | "info";
        title: string;
        message: string;
    } | null>(null);

    // auto dismiss timer
    useEffect(() => {
        if (!notification) return;
        const t = setTimeout(() => setNotification(null), 4000);
        return () => clearTimeout(t);
    }, [notification]);

    // load categories for game types
    useEffect(() => {
        let mounted = true;
        getCategoriesByType('game', 1, 50)
            .then((res) => {
                if (!mounted) return;
                setCategories(res.data || []);
            })
            .catch(() => {
                // ignore category load errors for now
            });
        return () => { mounted = false; };
    }, []);

    useEffect(() => {
        let mounted = true;
        setLoading(true);
        getGames(page, pageSize)
            .then((data) => {
                if (!mounted) return;
                setGames(data.data || []);
                setTotalCount(data.totalCount ?? null);
            })
            .catch((err) => {
                if (!mounted) return;
                setError(err?.message || "Failed to load games");
            })
            .finally(() => {
                if (!mounted) return;
                setLoading(false);
            });

        return () => {
            mounted = false;
        };
    }, [page, pageSize]);

    return (
        <div className="p-6">
            <h1 className="text-2xl font-semibold mb-4">Games</h1>

            <div className="mb-4 flex items-center gap-3">
                <button
                    className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded"
                    onClick={() => {
                        // open create modal with default values
                        setEditingId(null);
                        setName("");
                        setCategoryId(null);
                        setStatusId(STATUS_ENABLED);
                        setError(null);
                        setShowForm(true);
                    }}
                >
                    Add Game
                </button>
                <Modal
                    isOpen={showForm}
                    onClose={() => setShowForm(false)}
                    title={editingId ? "Edit Game" : "Create Game"}
                    footer={(
                        <>
                            <button
                                className="px-3 py-1 bg-green-600 text-white rounded flex items-center gap-2"
                                onClick={async () => {
                                    setSubmitting(true);
                                    try {
                                        if (!categoryId) {
                                            setError('Category is required');
                                            setSubmitting(false);
                                            return;
                                        }

                                        const payloadStatus = statusId === null ? null : Number(statusId);
                                        if (editingId) {
                                            const updated = await updateGame(editingId, { name, categoryId, statusId: payloadStatus });
                                            const refreshed = await getGames();
                                            setGames(refreshed.data || []);
                                            setNotification({ variant: 'success', title: 'Updated', message: `Game '${updated.name}' updated` });
                                        } else {
                                            const created = await createGame({ name, categoryId, statusId: payloadStatus });
                                            setGames((g) => [created, ...g]);
                                            setNotification({ variant: 'success', title: 'Created', message: `Game '${created.name}' created` });
                                        }
                                        setName("");
                                        setCategoryId(null);
                                        setStatusId(null);
                                        setEditingId(null);
                                        setShowForm(false);
                                        setError(null);
                                    } catch (err: unknown) {
                                        let message = editingId ? "Failed to update game" : "Failed to create game";
                                        if (err && typeof err === "object") {
                                            const maybe = err as { message?: unknown };
                                            if (typeof maybe.message === "string") message = maybe.message;
                                        } else if (typeof err === "string") {
                                            message = err;
                                        }
                                        setError(message);
                                        setNotification({ variant: "error", title: editingId ? "Update failed" : "Create failed", message });
                                    } finally {
                                        setSubmitting(false);
                                    }
                                }}
                            >
                                {submitting ? <Loader size={16} /> : (editingId ? 'Save' : 'Create')}
                            </button>
                            <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => setShowForm(false)}>Cancel</button>
                        </>
                    )}
                >
                    <div className="flex flex-col gap-3">
                        <div>
                            <Label htmlFor="game-name">Name</Label>
                            <Input id="game-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
                        </div>
                        <div>
                            <Label>Category</Label>
                            <Select
                                options={categories.map((c) => ({ value: c.id, label: c.name }))}
                                placeholder="Select a category"
                                defaultValue={categoryId ?? ""}
                                onChange={(v) => setCategoryId(v === '' ? null : (typeof v === 'number' ? v : Number(v)))}
                            />
                        </div>
                        <div>
                            <label className="text-sm text-gray-600">Status</label>
                            <StatusToggle value={statusId} onChange={(id) => setStatusId(id)} />
                        </div>

                        {/* actions moved to Modal footer */}
                    </div>
                </Modal>
            </div>

            {loading && <div className="text-gray-600">Loading games...</div>}

            {error && (
                <div className="text-red-600 bg-red-50 p-3 rounded">{error}</div>
            )}

            {!loading && !error && (
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
                    <div className="max-w-full overflow-x-auto">
                        <Table>
                            <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                                <TableRow>
                                    <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Name</TableCell>
                                    <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Type</TableCell>
                                    <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Created</TableCell>
                                    <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Status</TableCell>
                                    <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Actions</TableCell>
                                </TableRow>
                            </TableHeader>

                            <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                                {games.map((g) => (
                                    <TableRow key={g.id}>
                                        <TableCell className="px-5 py-4 sm:px-6 text-start">
                                            <div className="font-medium text-gray-800 dark:text-white/90">{g.name}</div>
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">{g.categoryName ?? (categories.find(cat => cat.id === g.categoryId)?.name) ?? g.categoryId ?? '—'}</TableCell>
                                        <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">{new Date(g.createdOn).toLocaleString()}</TableCell>
                                        <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                                            {(() => {
                                                const id = g.statusId;
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
                                                <button className="text-sm px-2 py-1 bg-gray-200 rounded" onClick={() => {
                                                    // open edit
                                                    setEditingId(g.id);
                                                    setName(g.name);
                                                    setCategoryId(g.categoryId ?? null);
                                                    setStatusId(g.statusId ?? null);
                                                    setShowForm(true);
                                                }}>Edit</button>
                                                <DeleteIconButton onClick={() => setDeleteId(g.id)} />
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
                <div className="text-sm text-gray-600">{totalCount !== null ? `Showing ${games.length} of ${totalCount}` : ''}</div>
                <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">Page size</label>
                    <Select options={[{ value: 5, label: '5' }, { value: 10, label: '10' }, { value: 25, label: '25' }, { value: 50, label: '50' }]} defaultValue={pageSize} onChange={(v: string | number) => { setPageSize(Number(v)); setPage(1); }} className="w-24" />
                    <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Prev</button>
                    <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => setPage((p) => p + 1)} disabled={totalCount !== null && page * pageSize >= (totalCount || 0)}>Next</button>
                </div>
            </div>

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
                                await deleteGame(deleteId);
                                setGames((s) => s.filter(x => x.id !== deleteId));
                                setDeleteId(null);
                                setError(null);
                                setNotification({ variant: "success", title: "Deleted", message: "Game deleted" });
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
                    <p>Are you sure you want to delete this game?</p>
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
