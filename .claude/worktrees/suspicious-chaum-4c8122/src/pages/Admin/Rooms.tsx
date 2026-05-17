import { useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal';
import Label from '../../components/form/Label';
import Input from '../../components/form/input/InputField';
import Select from '../../components/form/Select';
import Switch from '../../components/form/switch/Switch';
import DeleteIconButton from '../../components/ui/DeleteIconButton';
import { PlayStationIcon, PcIcon } from '../../icons';
import { getRooms, RoomDto, CreateRoomRequest, createRoom, updateRoom, deleteRoom } from '../../services/roomsService';
import { getCategoriesByType, CategoryDto } from '../../services/categoryService';
import { getSets, SetDto, createSet, updateSet, deleteSet, CreateSetRequest } from '../../services/setService';

export default function Rooms() {
    const [rooms, setRooms] = useState<RoomDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalCount, setTotalCount] = useState<number | null>(null);
    const [categories, setCategories] = useState<CategoryDto[]>([]);

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
    }, [page, pageSize]);

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

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-2xl font-semibold">Rooms</h1>
                <button className="bg-green-600 text-white px-3 py-1 rounded" onClick={openCreate}>Add Room</button>
            </div>

            {loading && <div className="text-gray-600">Loading rooms...</div>}

            {!loading && (
                <div>
                    {/* Grid of room cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {rooms.map(r => {
                            const catName = (r.categoryName || '').toString();
                            const lower = catName.toLowerCase();
                            const isPc = lower.includes('pc');
                            const isPlay = lower.includes('play') || lower.includes('playstation');
                            return (
                                <div key={r.id} className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition flex flex-col justify-between">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <div className="text-lg font-medium">{r.name}</div>
                                            <div className="text-sm text-gray-500">{r.categoryName ?? r.categoryId}</div>
                                        </div>
                                        <div className="ml-4">
                                            {isPc && <PcIcon className="w-6 h-6 text-gray-600" />}
                                            {(!isPc && isPlay) && <PlayStationIcon className="w-6 h-6 text-gray-600" />}
                                        </div>
                                    </div>
                                    <div className="mt-4 flex items-center justify-between">
                                        <div className="text-sm text-gray-600">
                                            {r.isOpenSet ? (
                                                <span className="text-green-600 font-semibold">Open Set</span>
                                            ) : (
                                                <>Sets: <span className="font-semibold">{r.sets}</span></>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {!r.isOpenSet && <button className="text-xs px-2 py-1 bg-blue-500 text-white rounded" onClick={() => openSetsManagement(r.id, r.name)}>Manage Sets</button>}
                                            <button className="text-sm px-2 py-1 bg-gray-200 rounded" onClick={() => {
                                                setEditingId(r.id);
                                                setName(r.name);
                                                setCategoryId(r.categoryId);
                                                setIsOpenSet(!!r.isOpenSet);
                                                setIsOpen(true);
                                            }}>Edit</button>
                                            <DeleteIconButton onClick={() => setDeleteId(r.id)} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Pagination controls */}
                    <div className="mt-4 p-2 flex items-center justify-between">
                        <div className="text-sm text-gray-600">{totalCount !== null ? `Showing ${rooms.length} of ${totalCount}` : ''}</div>
                        <div className="flex items-center gap-2">
                            <label className="text-sm text-gray-600">Page size</label>
                            <Select options={[{ value: 5, label: '5' }, { value: 10, label: '10' }, { value: 25, label: '25' }]} defaultValue={pageSize} onChange={(v: string | number) => { setPageSize(Number(v)); setPage(1); }} className="w-24" />
                            <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Prev</button>
                            <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => setPage((p) => p + 1)} disabled={totalCount !== null && page * pageSize >= (totalCount || 0)}>Next</button>
                        </div>
                    </div>
                </div>
            )}

            <Modal
                isOpen={isOpen}
                onClose={() => { setIsOpen(false); setEditingId(null); }}
                title={editingId ? 'Edit Room' : 'Create Room'}
                footer={(
                    <>
                        <button className="bg-gray-200 px-3 py-1 rounded" onClick={() => setIsOpen(false)}>Cancel</button>
                        <button className="bg-blue-600 text-white px-3 py-1 rounded" onClick={handleSave} disabled={submitting}>{submitting ? 'Saving...' : (editingId ? 'Save' : 'Create')}</button>
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
                    <div>
                        <Label>Open Set</Label>
                        <div className="flex items-center gap-2">
                            <Switch key={String(isOpenSet)} label="Is this an open set room?" defaultChecked={isOpenSet} onChange={(checked) => setIsOpenSet(checked)} />
                        </div>
                        {isOpenSet && (
                            <div className="text-xs text-gray-500 mt-1">Open set rooms do not require set selection.</div>
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
                footer={(
                    <>
                        <button className="px-3 py-1 bg-red-600 text-white rounded flex items-center gap-2" onClick={handleDelete}>
                            {deleting ? 'Deleting...' : 'Delete'}
                        </button>
                        <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => setDeleteId(null)}>Cancel</button>
                    </>
                )}
            >
                <div className="space-y-4">
                    <p>Are you sure you want to delete this room?</p>
                </div>
            </Modal>

            {/* Set Management Modal */}
            <Modal
                isOpen={setsModalOpen}
                onClose={() => setSetsModalOpen(false)}
                title={`Manage Sets - ${selectedRoomName}`}
                footer={(
                    <>
                        <button className="bg-green-600 text-white px-3 py-1 rounded" onClick={openCreateSet}>Add Set</button>
                        <button className="bg-gray-200 px-3 py-1 rounded" onClick={() => setSetsModalOpen(false)}>Close</button>
                    </>
                )}
            >
                {/* Scrollable content area to keep footer actions visible */}
                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                    {setsLoading && <div className="text-gray-600">Loading sets...</div>}
                    {!setsLoading && sets_list.length === 0 && <div className="text-gray-500">No sets found for this room.</div>}
                    {!setsLoading && sets_list.length > 0 && (
                        <div className="space-y-2">
                            {sets_list.map(s => (
                                <div key={s.id} className="bg-gray-50 p-3 rounded flex items-center justify-between">
                                    <div className="font-medium">{s.name}</div>
                                    <div className="flex items-center gap-2">
                                        <button className="text-sm px-2 py-1 bg-blue-500 text-white rounded" onClick={() => openEditSet(s)}>Edit</button>
                                        <DeleteIconButton onClick={() => setDeleteSetId(s.id)} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {/* Sets pagination */}
                    {setsTotalCount !== null && setsTotalCount > setsPageSize && (
                        <div className="mt-4 flex items-center justify-between">
                            <div className="text-sm text-gray-600">Showing {sets_list.length} of {setsTotalCount}</div>
                            <div className="flex items-center gap-2">
                                <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => { setSetsPage(p => Math.max(1, p - 1)); if (selectedRoomId) loadSets(selectedRoomId, Math.max(1, setsPage - 1), setsPageSize); }} disabled={setsPage <= 1}>Prev</button>
                                <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => { setSetsPage(p => p + 1); if (selectedRoomId) loadSets(selectedRoomId, setsPage + 1, setsPageSize); }} disabled={setsPage * setsPageSize >= (setsTotalCount || 0)}>Next</button>
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
                footer={(
                    <>
                        <button className="bg-gray-200 px-3 py-1 rounded" onClick={() => setSetModalOpen(false)}>Cancel</button>
                        <button className="bg-blue-600 text-white px-3 py-1 rounded" onClick={handleSaveSet} disabled={setFormSubmitting}>{setFormSubmitting ? 'Saving...' : (editingSetId ? 'Save' : 'Create')}</button>
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
                footer={(
                    <>
                        <button className="px-3 py-1 bg-red-600 text-white rounded" onClick={handleDeleteSet}>
                            {deletingSet ? 'Deleting...' : 'Delete'}
                        </button>
                        <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => setDeleteSetId(null)}>Cancel</button>
                    </>
                )}
            >
                <div className="space-y-4">
                    <p>Are you sure you want to delete this set?</p>
                </div>
            </Modal>
        </div>
    );
}
