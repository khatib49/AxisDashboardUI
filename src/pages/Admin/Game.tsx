import { useEffect, useState } from "react";
import { Button, Empty, Skeleton } from "antd";
import {
    AppstoreOutlined,
    CheckCircleOutlined,
    DeleteOutlined,
    EditOutlined,
    PlusOutlined,
    StopOutlined,
    TagsOutlined,
    TrophyOutlined,
} from "@ant-design/icons";
import { getGames, GameDto } from "../../services/gameService";
import { createGame } from "../../services/gameService";
import { updateGame } from "../../services/gameService";
import Modal from "../../components/ui/Modal";
import Loader from "../../components/ui/Loader";
import { STATUS_ENABLED, STATUS_DISABLED } from '../../services/statuses';
import { deleteGame } from "../../services/gameService";
import Label from "../../components/form/Label";
import Input from "../../components/form/input/InputField";
import Select from "../../components/form/Select";
import { getCategoriesByType, CategoryDto } from "../../services/categoryService";
import { PageHeader, Panel, Pill, StatTile } from "../../components/ui/PageKit";
import { ErrorNote, IconChip, Toast, VenuePager } from "../../components/admin/venue/VenueKit";
import { FormSection, GameStatusPill, StatusSegment } from "../../components/admin/game/GameKit";
import { FOOTER_BTN, MODAL_MD, MODAL_SM, fmtDateTime } from "../../components/admin/game/format";

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

    const openCreate = () => {
        // open create modal with default values
        setEditingId(null);
        setName("");
        setCategoryId(null);
        setStatusId(STATUS_ENABLED);
        setError(null);
        setShowForm(true);
    };

    const openEdit = (g: GameDto) => {
        // open edit
        setEditingId(g.id);
        setName(g.name);
        setCategoryId(g.categoryId ?? null);
        setStatusId(g.statusId ?? null);
        setShowForm(true);
    };

    const handleSave = async () => {
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
    };

    const handleDelete = async () => {
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
    };

    // ── List presentation (derived from the page already loaded) ────────
    const typeName = (g: GameDto) =>
        g.categoryName ?? (categories.find(cat => cat.id === g.categoryId)?.name) ?? g.categoryId ?? '—';
    const firstLoad = loading && totalCount === null;
    const enabledOnPage = games.filter(g => g.statusId === STATUS_ENABLED).length;
    const disabledOnPage = games.filter(g => g.statusId === STATUS_DISABLED).length;

    const rowActions = (g: GameDto) => (
        <div className="flex shrink-0 items-center gap-1">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(g)} aria-label={`Edit ${g.name}`}>
                Edit
            </Button>
            <Button
                size="small"
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => setDeleteId(g.id)}
                aria-label={`Delete ${g.name}`}
                title="Delete"
            />
        </div>
    );

    return (
        <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6">
            <PageHeader
                tone="violet"
                icon={<TrophyOutlined />}
                title="Games"
                description="The games your venue offers. Each game belongs to a type, and only enabled games can be picked when setting up prices and sessions."
                actions={
                    <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Add Game</Button>
                }
            />

            {/* KPIs — derived from the data already loaded (no extra requests) */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatTile
                    label="Games"
                    loading={firstLoad}
                    value={<span className="tabular-nums">{(totalCount ?? games.length).toLocaleString('en-US')}</span>}
                    sub="All games"
                    accent={<IconChip tone="violet"><TrophyOutlined /></IconChip>}
                />
                <StatTile
                    label="Enabled"
                    loading={firstLoad}
                    value={<span className="tabular-nums">{enabledOnPage}</span>}
                    sub="On this page"
                    accent={<IconChip tone="emerald"><CheckCircleOutlined /></IconChip>}
                />
                <StatTile
                    label="Disabled"
                    loading={firstLoad}
                    value={<span className="tabular-nums">{disabledOnPage}</span>}
                    sub="On this page"
                    accent={<IconChip tone="red"><StopOutlined /></IconChip>}
                />
                <StatTile
                    label="Game types"
                    loading={loading && categories.length === 0}
                    value={<span className="tabular-nums">{categories.length}</span>}
                    sub="Available for games"
                    accent={<IconChip tone="amber"><TagsOutlined /></IconChip>}
                />
            </div>

            <Panel
                title="All games"
                subtitle={totalCount !== null ? `${totalCount.toLocaleString('en-US')} game${totalCount === 1 ? '' : 's'}` : undefined}
                bodyClassName="p-0"
            >
                {loading && <div className="p-5"><Skeleton active paragraph={{ rows: 5 }} /></div>}

                {error && <ErrorNote>{error}</ErrorNote>}

                {!loading && !error && (
                    games.length === 0 ? (
                        <div className="py-12"><Empty description="No games yet" /></div>
                    ) : (
                        <>
                            {/* ≥ md: table */}
                            <div className="relative hidden overflow-x-auto md:block">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500 dark:border-white/[0.06] dark:text-gray-400">
                                            <th className="px-5 py-3 font-medium">Name</th>
                                            <th className="px-4 py-3 font-medium">Type</th>
                                            <th className="px-4 py-3 font-medium">Created</th>
                                            <th className="px-4 py-3 font-medium">Status</th>
                                            <th className="px-5 py-3 text-right font-medium">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-white/[0.06]">
                                        {games.map((g) => (
                                            <tr key={g.id} className="transition hover:bg-gray-50/70 dark:hover:bg-white/[0.02]">
                                                <td className="px-5 py-3.5">
                                                    <div className="flex min-w-0 items-center gap-3">
                                                        <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300">
                                                            <AppstoreOutlined />
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => openEdit(g)}
                                                            className="min-w-0 truncate text-left font-medium text-gray-900 hover:text-violet-700 dark:text-gray-100 dark:hover:text-violet-300"
                                                        >
                                                            {g.name}
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3.5"><Pill tone="violet">{typeName(g)}</Pill></td>
                                                <td className="whitespace-nowrap px-4 py-3.5 tabular-nums text-gray-500 dark:text-gray-400">{fmtDateTime(g.createdOn)}</td>
                                                <td className="px-4 py-3.5"><GameStatusPill statusId={g.statusId} /></td>
                                                <td className="px-5 py-3.5"><div className="flex justify-end">{rowActions(g)}</div></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* < md: cards */}
                            <ul className="divide-y divide-gray-100 md:hidden dark:divide-white/[0.06]">
                                {games.map((g) => (
                                    <li key={g.id} className="px-4 py-3.5">
                                        <div className="flex items-start gap-3">
                                            <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300">
                                                <AppstoreOutlined />
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <button
                                                    type="button"
                                                    onClick={() => openEdit(g)}
                                                    className="block max-w-full truncate text-left font-medium text-gray-900 dark:text-gray-100"
                                                >
                                                    {g.name}
                                                </button>
                                                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                                    <Pill tone="violet">{typeName(g)}</Pill>
                                                    <GameStatusPill statusId={g.statusId} />
                                                </div>
                                                <div className="mt-1.5 text-xs tabular-nums text-gray-500 dark:text-gray-400">Created {fmtDateTime(g.createdOn)}</div>
                                            </div>
                                            {rowActions(g)}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </>
                    )
                )}

                {/* Pagination controls */}
                <VenuePager
                    shown={games.length}
                    total={totalCount}
                    page={page}
                    pageSize={pageSize}
                    pageSizeOptions={[5, 10, 25, 50]}
                    onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
                    onPrev={() => setPage((p) => Math.max(1, p - 1))}
                    onNext={() => setPage((p) => p + 1)}
                    prevDisabled={page <= 1}
                    nextDisabled={totalCount !== null && page * pageSize >= (totalCount || 0)}
                />
            </Panel>

            <Modal
                isOpen={showForm}
                onClose={() => setShowForm(false)}
                title={editingId ? "Edit Game" : "Create Game"}
                subtitle={editingId ? "Update the game's name, type or status." : "Add a game your venue offers."}
                className={MODAL_MD}
                footer={(
                    <>
                        <Button className={FOOTER_BTN} onClick={() => setShowForm(false)}>Cancel</Button>
                        <Button className={FOOTER_BTN} type="primary" onClick={handleSave}>
                            {submitting ? <Loader size={16} /> : (editingId ? 'Save' : 'Create')}
                        </Button>
                    </>
                )}
            >
                <div className="flex flex-col gap-4">
                    {error && (
                        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</div>
                    )}
                    <FormSection title="Details" description="How the game appears across the dashboard and cashier.">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="min-w-0">
                                <Label htmlFor="game-name">Name</Label>
                                <Input id="game-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
                            </div>
                            <div className="min-w-0">
                                <Label>Category</Label>
                                <Select
                                    options={categories.map((c) => ({ value: c.id, label: c.name }))}
                                    placeholder="Select a category"
                                    defaultValue={categoryId ?? ""}
                                    onChange={(v) => setCategoryId(v === '' ? null : (typeof v === 'number' ? v : Number(v)))}
                                />
                            </div>
                        </div>
                    </FormSection>
                    <FormSection title="Status" description="Disabled games stay on file but can't be used.">
                        <StatusSegment value={statusId} onChange={(id) => setStatusId(id)} />
                    </FormSection>

                    {/* actions moved to Modal footer */}
                </div>
            </Modal>

            <Modal
                isOpen={!!deleteId}
                onClose={() => setDeleteId(null)}
                title="Confirm delete"
                className={MODAL_SM}
                footer={(
                    <>
                        <Button className={FOOTER_BTN} onClick={() => setDeleteId(null)}>Cancel</Button>
                        <Button className={FOOTER_BTN} danger type="primary" onClick={handleDelete}>
                            {deleting ? <Loader size={16} /> : 'Delete'}
                        </Button>
                    </>
                )}
            >
                <div className="space-y-4">
                    <p className="text-gray-700 dark:text-gray-300">Are you sure you want to delete this game?</p>
                </div>
            </Modal>

            {/* Toast container bottom-right */}
            <Toast notification={notification} />
        </div>
    );
}
