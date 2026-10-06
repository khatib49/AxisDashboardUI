import { useEffect, useState } from 'react';
import { Button, Empty, Skeleton, Tooltip } from 'antd';
import {
    AppstoreOutlined,
    ClusterOutlined,
    DeleteOutlined,
    EditOutlined,
    HomeOutlined,
    PlusOutlined,
    ReloadOutlined,
    TagsOutlined,
    UnlockOutlined,
} from '@ant-design/icons';
import Modal from '../../components/ui/Modal';
import Label from '../../components/form/Label';
import Input from '../../components/form/input/InputField';
import Select from '../../components/form/Select';
import Switch from '../../components/form/switch/Switch';
import { PlayStationIcon, PcIcon } from '../../icons';
import { getRooms, RoomDto, CreateRoomRequest, createRoom, updateRoom, deleteRoom } from '../../services/roomsService';
import { getCategoriesByType, CategoryDto } from '../../services/categoryService';
import { getSets, SetDto, createSet, updateSet, deleteSet, CreateSetRequest } from '../../services/setService';
import { PageHeader, Panel, Pill, StatTile } from '../../components/ui/PageKit';
import { IconChip, RowMenu, VenuePager } from '../../components/admin/venue/VenueKit';

export default function Rooms() {
    const [rooms, setRooms] = useState<RoomDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalCount, setTotalCount] = useState<number | null>(null);
    const [categories, setCategories] = useState<CategoryDto[]>([]);
    // Bumped by the Refresh button to re-run the same list request.
    const [reloadToken, setReloadToken] = useState(0);

    const [isOpen, setIsOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [categoryId, setCategoryId] = useState<number | null>(null);
    const [isOpenSet, setIsOpenSet] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    // Set management state
    const [setsModalOpen, setSetsModalOpen] = useState(false);
    const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null); // Room ID is string
    const [selectedRoomName, setSelectedRoomName] = useState<string>('');
    const [sets_list, setSets_list] = useState<SetDto[]>([]);
    const [setsLoading, setSetsLoading] = useState(false);
    const [setsPage, setSetsPage] = useState(1);
    const setsPageSize = 10; // Fixed page size for sets
    const [setsTotalCount, setSetsTotalCount] = useState<number | null>(null);

    // Set create/edit modal
    const [setModalOpen, setSetModalOpen] = useState(false);
    const [editingSetId, setEditingSetId] = useState<number | null>(null);
    const [setNameInput, setSetNameInput] = useState('');
    const [setFormSubmitting, setSetFormSubmitting] = useState(false);
    const [deleteSetId, setDeleteSetId] = useState<number | null>(null);
    const [deletingSet, setDeletingSet] = useState(false);

    useEffect(() => {
        let mounted = true;
        setLoading(true);
        getRooms(page, pageSize)
            .then(res => {
                if (!mounted) return;
                setRooms(res.data || []);
                setTotalCount(res.totalCount ?? null);
            })
            .catch(() => { /* ignore */ })
            .finally(() => { if (mounted) setLoading(false); });
        return () => { mounted = false; };
    }, [page, pageSize, reloadToken]);

    useEffect(() => {
        getCategoriesByType('game', 1, 100)
            .then(res => setCategories(res.data || []))
            .catch(() => { /* ignore */ });
    }, []);

    const openCreate = () => {
        setEditingId(null);
        setName('');
        setCategoryId(categories[0]?.id ?? null);
        setIsOpenSet(false);
        setIsOpen(true);
    };

    const openEdit = (r: RoomDto) => {
        setEditingId(r.id);
        setName(r.name);
        setCategoryId(r.categoryId);
        setIsOpenSet(!!r.isOpenSet);
        setIsOpen(true);
    };

    // Open sets management modal for a room
    const openSetsManagement = async (roomId: string, roomName: string) => {
        setSelectedRoomId(roomId);
        setSelectedRoomName(roomName);
        setSetsModalOpen(true);
        setSetsPage(1);
        loadSets(roomId, 1, setsPageSize);
    };

    const loadSets = async (roomId: string, pg: number, pgSize: number) => {
        setSetsLoading(true);
        try {
            const roomIdNum = Number(roomId);
            const res = await getSets({ RoomId: roomIdNum, Page: pg, PageSize: pgSize });
            setSets_list(res.data || []);
            setSetsTotalCount(res.totalCount ?? null);
        } catch {
            // ignore
        } finally {
            setSetsLoading(false);
        }
    };

    const openCreateSet = () => {
        setEditingSetId(null);
        setSetNameInput('');
        setSetModalOpen(true);
    };

    const openEditSet = (set: SetDto) => {
        setEditingSetId(set.id);
        setSetNameInput(set.name);
        setSetModalOpen(true);
    };

    const handleSaveSet = async () => {
        if (!selectedRoomId) return;
        setSetFormSubmitting(true);
        try {
            const roomIdNum = Number(selectedRoomId);
            const body: CreateSetRequest = { roomId: roomIdNum, name: setNameInput };
            if (editingSetId) {
                await updateSet(editingSetId, body);
            } else {
                await createSet(body);
            }
            await loadSets(selectedRoomId, setsPage, setsPageSize);
            setSetModalOpen(false);
            setEditingSetId(null);
        } catch {
            // ignore
        } finally {
            setSetFormSubmitting(false);
        }
    };

    const handleDeleteSet = async () => {
        if (!deleteSetId || !selectedRoomId) return;
        setDeletingSet(true);
        try {
            await deleteSet(deleteSetId);
            await loadSets(selectedRoomId, setsPage, setsPageSize);
            setDeleteSetId(null);
        } catch {
            // ignore
        } finally {
            setDeletingSet(false);
        }
    };

    // seatsSelected removed — UI simplified to numeric sets input only

    const handleSave = async () => {
        setSubmitting(true);
        try {
            if (!categoryId) {
                // require category
                setSubmitting(false);
                return;
            }
            const body: CreateRoomRequest = { name, categoryId, setCount: 0, isOpenSet }; // setCount defaults to 0, managed via set management
            if (editingId) {
                await updateRoom(editingId, body);
            } else {
                await createRoom(body);
            }
            const refreshed = await getRooms(page, pageSize);
            setRooms(refreshed.data || []);
            setTotalCount(refreshed.totalCount ?? null);
            setIsOpen(false);
            setEditingId(null);
        } catch {
            // ignore
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        setDeleting(true);
        try {
            await deleteRoom(deleteId);
            const refreshed = await getRooms(page, pageSize);
            setRooms(refreshed.data || []);
            setTotalCount(refreshed.totalCount ?? null);
            setDeleteId(null);
        } catch {
            // ignore
        } finally {
            setDeleting(false);
        }
    };

    // ── List presentation (derived from the page already loaded) ────────
    const firstLoad = loading && totalCount === null;
    const openSetRooms = rooms.filter(r => r.isOpenSet).length;
    const setsOnPage = rooms.filter(r => !r.isOpenSet).reduce((sum, r) => sum + (Number(r.sets) || 0), 0);

    return (
        <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6">
            <PageHeader
                tone="violet"
                icon={<HomeOutlined />}
                title="Rooms"
                description="Gaming rooms and their sets. Open-set rooms don't need a set picked at the cashier; the rest are played on the sets you manage here."
                actions={
                    <>
                        <Tooltip title="Refresh">
                            <Button icon={<ReloadOutlined />} onClick={() => setReloadToken((t) => t + 1)} loading={loading} aria-label="Refresh" />
                        </Tooltip>
                        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Add room</Button>
                    </>
                }
            />

            {/* KPIs — derived from the data already loaded (no extra requests) */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatTile
                    label="Rooms"
                    loading={firstLoad}
                    value={<span className="tabular-nums">{(totalCount ?? rooms.length).toLocaleString('en-US')}</span>}
                    sub="All rooms"
                    accent={<IconChip tone="violet"><HomeOutlined /></IconChip>}
                />
                <StatTile
                    label="Sets"
                    loading={firstLoad}
                    value={<span className="tabular-nums">{setsOnPage}</span>}
                    sub="In set rooms on this page"
                    accent={<IconChip tone="blue"><ClusterOutlined /></IconChip>}
                />
                <StatTile
                    label="Open-set rooms"
                    loading={firstLoad}
                    value={<span className="tabular-nums">{openSetRooms}</span>}
                    sub="On this page"
                    accent={<IconChip tone="emerald"><UnlockOutlined /></IconChip>}
                />
                <StatTile
                    label="Game categories"
                    value={<span className="tabular-nums">{categories.length}</span>}
                    sub="Available for rooms"
                    accent={<IconChip tone="amber"><TagsOutlined /></IconChip>}
                />
            </div>

            <Panel
                title="All rooms"
                subtitle={totalCount !== null ? `${totalCount.toLocaleString('en-US')} room${totalCount === 1 ? '' : 's'}` : undefined}
                bodyClassName="p-0"
            >
                {loading ? (
                    <div className="p-5"><Skeleton active paragraph={{ rows: 5 }} /></div>
                ) : rooms.length === 0 ? (
                    <div className="py-12"><Empty description="No rooms yet" /></div>
                ) : (
                    /* Grid of room cards */
                    <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {rooms.map(r => {
                            const catName = (r.categoryName || '').toString();
                            const lower = catName.toLowerCase();
                            const isPc = lower.includes('pc');
                            const isPlay = lower.includes('play') || lower.includes('playstation');
                            return (
                                <div
                                    key={r.id}
                                    className="flex flex-col justify-between gap-4 rounded-xl border border-gray-200/80 bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/[0.06] dark:bg-white/[0.02]"
                                >
                                    <div className="flex items-start gap-3">
                                        <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300">
                                            {isPc && <PcIcon className="h-6 w-6" />}
                                            {(!isPc && isPlay) && <PlayStationIcon className="h-6 w-6" />}
                                            {!isPc && !isPlay && <AppstoreOutlined className="text-lg" />}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <button
                                                type="button"
                                                onClick={() => openEdit(r)}
                                                className="block max-w-full truncate text-left text-base font-semibold text-gray-900 hover:text-violet-700 dark:text-gray-100 dark:hover:text-violet-300"
                                            >
                                                {r.name}
                                            </button>
                                            <div className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">{r.categoryName ?? r.categoryId}</div>
                                        </div>
                                        <RowMenu
                                            label={r.name}
                                            items={[
                                                { key: 'edit', icon: <EditOutlined />, label: 'Edit', onClick: () => openEdit(r) },
                                                { type: 'divider' },
                                                { key: 'delete', icon: <DeleteOutlined />, label: 'Delete', danger: true, onClick: () => setDeleteId(r.id) },
                                            ]}
                                        />
                                    </div>
                                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3 dark:border-white/[0.06]">
                                        {r.isOpenSet ? (
                                            <Pill tone="emerald" dot>Open Set</Pill>
                                        ) : (
                                            <Pill tone="blue" dot>Sets: <span className="font-semibold tabular-nums">{r.sets}</span></Pill>
                                        )}
                                        {!r.isOpenSet && (
                                            <Button size="small" icon={<ClusterOutlined />} onClick={() => openSetsManagement(r.id, r.name)}>
                                                Manage Sets
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Pagination controls */}
                <VenuePager
                    shown={rooms.length}
                    total={totalCount}
                    page={page}
                    pageSize={pageSize}
                    pageSizeOptions={[5, 10, 25]}
                    onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
                    onPrev={() => setPage((p) => Math.max(1, p - 1))}
                    onNext={() => setPage((p) => p + 1)}
                    prevDisabled={page <= 1}
                    nextDisabled={totalCount !== null && page * pageSize >= (totalCount || 0)}
                />
            </Panel>

            <Modal
                isOpen={isOpen}
                onClose={() => { setIsOpen(false); setEditingId(null); }}
                title={editingId ? 'Edit Room' : 'Create Room'}
                className="sm:max-w-xl!"
                footer={(
                    <>
                        <Button onClick={() => setIsOpen(false)}>Cancel</Button>
                        <Button type="primary" onClick={handleSave} disabled={submitting}>{submitting ? 'Saving...' : (editingId ? 'Save' : 'Create')}</Button>
                    </>
                )}
            >
                <div className="space-y-4">
                    <div>
                        <Label>Name</Label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
                    </div>
                    <div>
                        <Label>Category</Label>
                        <Select options={categories.map(c => ({ value: c.id, label: c.name }))} defaultValue={categoryId ?? ""} onChange={(v) => setCategoryId(v === '' ? null : (typeof v === 'number' ? v : Number(v)))} />
                    </div>
                    <div className="rounded-lg border border-gray-200 p-3 dark:border-white/10">
                        <Label>Open Set</Label>
                        <div className="flex items-center gap-2">
                            <Switch key={String(isOpenSet)} label="Is this an open set room?" defaultChecked={isOpenSet} onChange={(checked) => setIsOpenSet(checked)} />
                        </div>
                        {isOpenSet && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Open set rooms do not require set selection.</div>
                        )}
                    </div>
                    {/* Sets field removed - manage sets via "Manage Sets" button on room cards */}
                    {/* actions moved to Modal footer */}
                </div>
            </Modal>

            <Modal
                isOpen={!!deleteId}
                onClose={() => setDeleteId(null)}
                title="Confirm delete"
                className="sm:max-w-md!"
                footer={(
                    <>
                        <Button onClick={() => setDeleteId(null)}>Cancel</Button>
                        <Button danger type="primary" onClick={handleDelete}>
                            {deleting ? 'Deleting...' : 'Delete'}
                        </Button>
                    </>
                )}
            >
                <div className="space-y-4">
                    <p className="text-gray-700 dark:text-gray-300">Are you sure you want to delete this room?</p>
                </div>
            </Modal>

            {/* Set Management Modal */}
            <Modal
                isOpen={setsModalOpen}
                onClose={() => setSetsModalOpen(false)}
                title={`Manage Sets - ${selectedRoomName}`}
                className="sm:max-w-2xl!"
                footer={(
                    <>
                        <Button onClick={() => setSetsModalOpen(false)}>Close</Button>
                        <Button type="primary" icon={<PlusOutlined />} onClick={openCreateSet}>Add Set</Button>
                    </>
                )}
            >
                {/* Scrollable content area to keep footer actions visible */}
                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                    {setsLoading && <Skeleton active title={false} paragraph={{ rows: 4 }} />}
                    {!setsLoading && sets_list.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No sets found for this room." />}
                    {!setsLoading && sets_list.length > 0 && (
                        <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200/80 dark:divide-white/[0.06] dark:border-white/[0.06]">
                            {sets_list.map(s => (
                                <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5 transition hover:bg-gray-50/70 dark:hover:bg-white/[0.02]">
                                    <div className="flex min-w-0 items-center gap-2.5">
                                        <ClusterOutlined className="text-gray-400" />
                                        <span className="truncate font-medium text-gray-900 dark:text-gray-100">{s.name}</span>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1">
                                        {/* Plain title attributes: antd tooltips would sit under the modal's z-index */}
                                        <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEditSet(s)} aria-label={`Edit ${s.name}`} title="Edit" />
                                        <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => setDeleteSetId(s.id)} aria-label={`Delete ${s.name}`} title="Delete" />
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                    {/* Sets pagination */}
                    {setsTotalCount !== null && setsTotalCount > setsPageSize && (
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                            <div className="text-xs tabular-nums text-gray-500 dark:text-gray-400">Showing {sets_list.length} of {setsTotalCount}</div>
                            <div className="flex items-center gap-2">
                                <Button size="small" onClick={() => { setSetsPage(p => Math.max(1, p - 1)); if (selectedRoomId) loadSets(selectedRoomId, Math.max(1, setsPage - 1), setsPageSize); }} disabled={setsPage <= 1}>Prev</Button>
                                <Button size="small" onClick={() => { setSetsPage(p => p + 1); if (selectedRoomId) loadSets(selectedRoomId, setsPage + 1, setsPageSize); }} disabled={setsPage * setsPageSize >= (setsTotalCount || 0)}>Next</Button>
                            </div>
                        </div>
                    )}
                </div>
            </Modal>

            {/* Set Create/Edit Modal */}
            <Modal
                isOpen={setModalOpen}
                onClose={() => setSetModalOpen(false)}
                title={editingSetId ? 'Edit Set' : 'Create Set'}
                className="sm:max-w-md!"
                footer={(
                    <>
                        <Button onClick={() => setSetModalOpen(false)}>Cancel</Button>
                        <Button type="primary" onClick={handleSaveSet} disabled={setFormSubmitting}>{setFormSubmitting ? 'Saving...' : (editingSetId ? 'Save' : 'Create')}</Button>
                    </>
                )}
            >
                <div className="space-y-4">
                    <div>
                        <Label>Set Name</Label>
                        <Input value={setNameInput} onChange={(e) => setSetNameInput(e.target.value)} placeholder="Set name" />
                    </div>
                </div>
            </Modal>

            {/* Set Delete Confirmation */}
            <Modal
                isOpen={!!deleteSetId}
                onClose={() => setDeleteSetId(null)}
                title="Confirm delete set"
                className="sm:max-w-md!"
                footer={(
                    <>
                        <Button onClick={() => setDeleteSetId(null)}>Cancel</Button>
                        <Button danger type="primary" onClick={handleDeleteSet}>
                            {deletingSet ? 'Deleting...' : 'Delete'}
                        </Button>
                    </>
                )}
            >
                <div className="space-y-4">
                    <p className="text-gray-700 dark:text-gray-300">Are you sure you want to delete this set?</p>
                </div>
            </Modal>
        </div>
    );
}
