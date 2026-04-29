import { useEffect, useState } from 'react';
import { getSettings, GameSettingDto, createSetting, CreateSettingRequest, updateSetting, deleteSetting } from '../../services/gameSettingsService';
import { getGames } from '../../services/gameService';
import { getCategoriesByType, CategoryDto } from '../../services/categoryService';
import Modal from '../../components/ui/Modal';
import Label from '../../components/form/Label';
import Input from '../../components/form/input/InputField';
import Select from '../../components/form/Select';
import Switch from '../../components/form/switch/Switch';
import DeleteIconButton from '../../components/ui/DeleteIconButton';

export default function GameSettings() {
    const [settings, setSettings] = useState<GameSettingDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState<number>(1);
    const [pageSize, setPageSize] = useState<number>(10);
    const [totalCount, setTotalCount] = useState<number | null>(null);
    const [games, setGames] = useState<Array<{ id: string; name: string }>>([]);
    const [types, setTypes] = useState<CategoryDto[]>([]);

    // add modal state
    const [isOpen, setIsOpen] = useState(false);
    const [newName, setNewName] = useState('');
    const [newType, setNewType] = useState('');
    const [newIsOffer, setNewIsOffer] = useState(false);
    const [newGameId, setNewGameId] = useState('');
    const [newHours, setNewHours] = useState<number | ''>('');
    const [newPrice, setNewPrice] = useState<number | ''>('');
    const [isOpenHour, setIsOpenHour] = useState(false);
    const [newIsDayPass, setNewIsDayPass] = useState(false);
    const [creating, setCreating] = useState(false);

    // edit/delete state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        let mounted = true;
        setLoading(true);
        getSettings(page, pageSize)
            .then((res) => {
                if (!mounted) return;
                setSettings((res.data || []).map(s => {
                    const it = s as Partial<GameSettingDto>;
                    return { ...(it as GameSettingDto), isOffer: !!it.isOffer } as GameSettingDto;
                }));
                setTotalCount(res.totalCount ?? null);
            })
            .catch(() => {
                /* ignore */
            })
            .finally(() => { if (mounted) setLoading(false); });

        return () => { mounted = false; };
    }, [page, pageSize]);

    useEffect(() => {
        // load games for dropdown (load many pages briefly)
        getGames(1, 100)
            .then((res) => {
                setGames(res.data.map(g => ({ id: g.id, name: g.name })));
            })
            .catch(() => { /* ignore */ });
        // load types (categories with type 'gameType')
        getCategoriesByType('gameSettingsType', 1, 200)
            .then((res) => {
                setTypes(res.data || []);
            })
            .catch(() => { /* ignore */ });
    }, []);

    const openModal = () => {
        setNewName('');
        setNewType(types[0]?.name || '');
        setNewIsOffer(false);
        setNewGameId(games[0]?.id || '');
        setNewHours('');
        setNewPrice('');
        setIsOpenHour(false);
        setNewIsDayPass(false);
        setIsOpen(true);
    };

    const handleCreateOrUpdate = async () => {
        setCreating(true);
        try {
            const body: CreateSettingRequest = {
                name: newName,
                type: newType,
                isOffer: newIsOffer,
                gameId: newGameId,
                hours: isOpenHour ? 0 : (newHours === '' ? undefined : newHours),
                price: newPrice === '' ? undefined : newPrice,
                isOpenHour: isOpenHour,
                isDayPass: newIsDayPass,
            };
            if (editingId) {
                await updateSetting(editingId, body);
            } else {
                await createSetting(body);
            }
            // refresh list
            const refreshed = await getSettings(page, pageSize);
            setSettings((refreshed.data || []).map(s => {
                const it = s as Partial<GameSettingDto>;
                return { ...(it as GameSettingDto), isOffer: !!it.isOffer } as GameSettingDto;
            }));
            setTotalCount(refreshed.totalCount ?? null);
            setIsOpen(false);
            setEditingId(null);
        } catch {
            // ignore for now
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        setDeleting(true);
        try {
            await deleteSetting(deleteId);
            const refreshed = await getSettings(page, pageSize);
            setSettings((refreshed.data || []).map(s => {
                const it = s as Partial<GameSettingDto>;
                return { ...(it as GameSettingDto), isOffer: !!it.isOffer } as GameSettingDto;
            }));
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
            <h1 className="text-2xl font-semibold mb-4">Game Settings</h1>

            <div className="mb-4 flex items-center justify-end">
                <button className="bg-green-600 text-white px-3 py-1 rounded" onClick={openModal}>Add Setting</button>
            </div>

            {loading && <div className="text-gray-600">Loading settings...</div>}

            {!loading && (
                <div className="bg-white rounded shadow">
                    <div className="p-4">
                        <table className="min-w-full">
                            <thead>
                                <tr>
                                    <th className="text-left px-4 py-2">Name</th>
                                    <th className="text-left px-4 py-2">Type</th>
                                    <th className="text-left px-4 py-2">Offer</th>
                                    <th className="text-left px-4 py-2">DayPass</th>
                                    <th className="text-left px-4 py-2">Game</th>
                                    <th className="text-left px-4 py-2">Hours</th>
                                    <th className="text-left px-4 py-2">Price</th>
                                    <th className="text-left px-4 py-2">Created</th>
                                    <th className="text-left px-4 py-2">Modified</th>
                                </tr>
                            </thead>
                            <tbody>
                                {settings.map((s: GameSettingDto) => (
                                    <tr key={s.id} className="border-t">
                                        <td className="px-4 py-2 align-top">{s.name}</td>
                                        <td className="px-4 py-2 align-top">{s.type}</td>
                                        <td className="px-4 py-2 align-top">{s.isOffer ? 'Yes' : 'No'}</td>
                                        <td className="px-4 py-2 align-top">{s.isDayPass ? 'Yes' : 'No'}</td>
                                        <td className="px-4 py-2 align-top">{s.gameName ?? (games.find(g => g.id === s.gameId)?.name ?? s.gameId)}</td>
                                        <td className="px-4 py-2 align-top">{typeof s.hours === 'number' ? (s.hours === 0 ? 'Open' : s.hours) : '-'}</td>
                                        <td className="px-4 py-2 align-top">{typeof s.price === 'number' ? s.price : '-'}</td>
                                        <td className="px-4 py-2 align-top">{s.createdOn ? new Date(s.createdOn).toLocaleString() : '-'}</td>
                                        <td className="px-4 py-2 align-top">{s.modifiedOn ? new Date(s.modifiedOn).toLocaleString() : '-'}</td>
                                        <td className="px-4 py-2 text-right">
                                            <div className="flex justify-end items-center gap-2">
                                                <button className="text-sm px-2 py-1 bg-gray-200 rounded" onClick={() => {
                                                    // open edit modal
                                                    setEditingId(s.id);
                                                    setNewName(s.name);
                                                    setNewType(s.type);
                                                    setNewIsOffer(!!s.isOffer);
                                                    setNewIsDayPass(!!s.isDayPass);
                                                    setNewGameId(s.gameId);
                                                    const hoursValue = typeof s.hours === 'number' ? s.hours : '';
                                                    setIsOpenHour(hoursValue === 0);
                                                    setNewHours(hoursValue === 0 ? '' : hoursValue);
                                                    setNewPrice(typeof s.price === 'number' ? s.price : '');
                                                    setIsOpen(true);
                                                }}>Edit</button>
                                                <DeleteIconButton onClick={() => setDeleteId(s.id)} />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="p-4 flex items-center justify-between">
                        <div className="text-sm text-gray-600">{totalCount !== null ? `Showing ${settings.length} of ${totalCount}` : ''}</div>
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
                title={editingId ? "Edit Setting" : "Create Setting"}
                footer={(
                    <>
                        <button className="bg-gray-200 px-3 py-1 rounded" onClick={() => setIsOpen(false)}>Cancel</button>
                        <button className="bg-blue-600 text-white px-3 py-1 rounded" onClick={handleCreateOrUpdate} disabled={creating}>{creating ? 'Saving...' : (editingId ? 'Save' : 'Create')}</button>
                    </>
                )}
            >
                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                    <div>
                        <Label>Name</Label>
                        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name" />
                    </div>
                    <div>
                        <Label>Type</Label>
                        <Select
                            options={types.map(t => ({ value: t.name, label: t.name }))}
                            defaultValue={newType}
                            placeholder="Select a type"
                            onChange={(v) => setNewType(typeof v === 'number' ? String(v) : v)}
                        />
                    </div>
                    <div>
                        <Label>Offer</Label>
                        <div className="flex items-center gap-2">
                            <Switch key={String(newIsOffer)} label="Is this an offer?" defaultChecked={newIsOffer} onChange={(checked) => setNewIsOffer(checked)} />
                        </div>
                    </div>
                    <div>
                        <Label>Open Hour</Label>
                        <div className="flex items-center gap-2">
                            <Switch key={String(isOpenHour)} label="Is this open hour?" defaultChecked={isOpenHour} onChange={(checked) => {
                                setIsOpenHour(checked);
                                if (checked) {
                                    setNewHours('');
                                }
                            }} />
                        </div>
                    </div>
                    <div>
                        <Label>Day Pass</Label>
                        <div className="flex items-center gap-2">
                            <Switch
                                key={String(newIsDayPass)}
                                label="Is this a day pass?"
                                defaultChecked={newIsDayPass}
                                onChange={(checked) => {
                                    setNewIsDayPass(checked);
                                    if (checked) {
                                        // clear hours when day pass is enabled and ensure hours input is blocked
                                        setNewHours('');
                                    }
                                }}
                            />
                        </div>
                    </div>
                    <div>
                        <Label>Hours</Label>
                        <Input
                            type="number"
                            value={newHours === '' ? '' : String(newHours)}
                            onChange={(e) => setNewHours(e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder="Hours"
                            disabled={isOpenHour || newIsDayPass}
                        />
                    </div>
                    <div>
                        <Label>Price</Label>
                        <Input type="number" value={newPrice === '' ? '' : String(newPrice)} onChange={(e) => setNewPrice(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Price" />
                    </div>
                    <div>
                        <Label>Game</Label>
                        <Select options={games.map(g => ({ value: g.id, label: g.name }))} defaultValue={newGameId} onChange={(v) => setNewGameId(typeof v === 'number' ? String(v) : v)} />
                    </div>
                    {/* actions are rendered in the Modal footer */}
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
                    <p>Are you sure you want to delete this setting?</p>
                </div>
            </Modal>
        </div>
    );
}
