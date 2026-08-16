import { useEffect, useState } from 'react';
import { getSettings, GameSettingDto, createSetting, CreateSettingRequest, updateSetting, deleteSetting } from '../../services/gameSettingsService';
import { getGames } from '../../services/gameService';
import { getCategoriesByType, CategoryDto } from '../../services/categoryService';
import { getItems, ItemDto } from '../../services/itemService';
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
    const [newIsActive, setNewIsActive] = useState(true);
    const [creating, setCreating] = useState(false);

    // ── Event kit ────────────────────────────────────────────────────────
    // An event setting (Pre Release, Draft…) can hand out stock items. The
    // customer pays only the setting's price; the items come off stock.
    const [newIsEvent, setNewIsEvent] = useState(false);
    const [kitLines, setKitLines] = useState<Array<{ itemId: number | ''; quantityPerPerson: number | '' }>>([]);
    const [allItems, setAllItems] = useState<ItemDto[]>([]);

    // "Show hidden" toggle — when on, the page calls /api/setting?includeHidden=true
    // so admins can see soft-deleted settings and restore them via the edit modal.
    const [showHidden, setShowHidden] = useState(false);

    // edit/delete state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        let mounted = true;
        setLoading(true);
        getSettings(page, pageSize, showHidden)
            .then((res) => {
                if (!mounted) return;
                setSettings((res.data || []).map(s => {
                    const it = s as Partial<GameSettingDto>;
                    return {
                        ...(it as GameSettingDto),
                        isOffer: !!it.isOffer,
                        isActive: it.isActive ?? true,
                    } as GameSettingDto;
                }));
                setTotalCount(res.totalCount ?? null);
            })
            .catch(() => {
                /* ignore */
            })
            .finally(() => { if (mounted) setLoading(false); });

        return () => { mounted = false; };
    }, [page, pageSize, showHidden]);

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
        // Items available to bundle into an event kit.
        getItems(1, 500)
            .then((res) => setAllItems(res.data || []))
            .catch(() => { /* ignore — the picker just stays empty */ });
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
        setNewIsActive(true);
        setNewIsEvent(false);
        setKitLines([]);
        setIsOpen(true);
    };

    // ── Event kit line helpers ───────────────────────────────────────────
    const addKitLine = () => setKitLines((l) => [...l, { itemId: '', quantityPerPerson: 1 }]);
    const removeKitLine = (idx: number) => setKitLines((l) => l.filter((_, i) => i !== idx));
    const patchKitLine = (idx: number, patch: Partial<{ itemId: number | ''; quantityPerPerson: number | '' }>) =>
        setKitLines((l) => l.map((row, i) => (i === idx ? { ...row, ...patch } : row)));

    // Item ids already used on another line — offering them again would hit
    // the unique (SettingId, ItemId) constraint server-side.
    const usedItemIds = (idx: number) =>
        new Set(kitLines.filter((_, i) => i !== idx).map((r) => r.itemId).filter((v) => v !== ''));

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
                isEvent: newIsEvent,
                // Full replacement list. Incomplete rows are dropped rather
                // than sent as zeros, which the server would reject.
                items: newIsEvent
                    ? kitLines
                        .filter((l) => l.itemId !== '' && Number(l.quantityPerPerson) > 0)
                        .map((l) => ({
                            itemId: Number(l.itemId),
                            quantityPerPerson: Number(l.quantityPerPerson),
                        }))
                    : [],
                // Only send on edit — create always starts active.
                ...(editingId ? { isActive: newIsActive } : {}),
            };
            if (editingId) {
                await updateSetting(editingId, body);
            } else {
                await createSetting(body);
            }
            // refresh list
            const refreshed = await getSettings(page, pageSize, showHidden);
            setSettings((refreshed.data || []).map(s => {
                const it = s as Partial<GameSettingDto>;
                return {
                    ...(it as GameSettingDto),
                    isOffer: !!it.isOffer,
                    isActive: it.isActive ?? true,
                } as GameSettingDto;
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
            const refreshed = await getSettings(page, pageSize, showHidden);
            setSettings((refreshed.data || []).map(s => {
                const it = s as Partial<GameSettingDto>;
                return {
                    ...(it as GameSettingDto),
                    isOffer: !!it.isOffer,
                    isActive: it.isActive ?? true,
                } as GameSettingDto;
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

            <div className="mb-4 flex items-center justify-end gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-300">
                    <input
                        type="checkbox"
                        checked={showHidden}
                        onChange={(e) => { setShowHidden(e.target.checked); setPage(1); }}
                        className="w-4 h-4"
                    />
                    Show hidden
                </label>
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
                                    <th className="text-left px-4 py-2">Event</th>
                                    <th className="text-left px-4 py-2">Game</th>
                                    <th className="text-left px-4 py-2">Hours</th>
                                    <th className="text-left px-4 py-2">Price</th>
                                    <th className="text-left px-4 py-2">Created</th>
                                    <th className="text-left px-4 py-2">Modified</th>
                                    <th className="text-left px-4 py-2 sr-only">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {settings.map((s: GameSettingDto) => {
                                    const hidden = s.isActive === false;
                                    return (
                                    <tr key={s.id} className={`border-t ${hidden ? 'opacity-60' : ''}`}>
                                        <td className="px-4 py-2 align-top">
                                            <div className="flex items-center gap-2">
                                                <span>{s.name}</span>
                                                {hidden && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700">
                                                        Hidden
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-2 align-top">{s.type}</td>
                                        <td className="px-4 py-2 align-top">{s.isOffer ? 'Yes' : 'No'}</td>
                                        <td className="px-4 py-2 align-top">{s.isDayPass ? 'Yes' : 'No'}</td>
                                        <td className="px-4 py-2 align-top">
                                            {s.isEvent ? (
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="inline-flex w-fit items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-100 text-indigo-700">
                                                        Event
                                                    </span>
                                                    {(s.items?.length ?? 0) > 0 && (
                                                        <span className="text-[11px] text-gray-500">
                                                            {s.items!.map(i => `${i.quantityPerPerson}x ${i.itemName}`).join(', ')} / person
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-gray-400">No</span>
                                            )}
                                        </td>
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
                                                    setNewIsActive(s.isActive !== false);
                                                    setNewIsEvent(!!s.isEvent);
                                                    setKitLines((s.items ?? []).map(i => ({
                                                        itemId: i.itemId,
                                                        quantityPerPerson: i.quantityPerPerson,
                                                    })));
                                                    setIsOpen(true);
                                                }}>Edit</button>
                                                {!hidden && <DeleteIconButton onClick={() => setDeleteId(s.id)} />}
                                            </div>
                                        </td>
                                    </tr>
                                    );
                                })}
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

                    {/* ── Event kit ──────────────────────────────────────── */}
                    <div className="rounded-lg border border-gray-200 p-3">
                        <Label>Event</Label>
                        <div className="flex items-center gap-2">
                            <Switch
                                key={String(newIsEvent)}
                                label="Is this an event? (Pre Release, Draft…)"
                                defaultChecked={newIsEvent}
                                onChange={(checked) => {
                                    setNewIsEvent(checked);
                                    if (checked && kitLines.length === 0) addKitLine();
                                }}
                            />
                        </div>

                        {newIsEvent && (
                            <div className="mt-3 space-y-2">
                                <p className="text-xs text-gray-500">
                                    Items handed out with this event. They come <b>off stock</b> when the
                                    session starts, but add <b>nothing</b> to the bill — the price above is
                                    what the customer pays. Quantity is <b>per person</b>.
                                </p>

                                {kitLines.map((line, idx) => {
                                    const taken = usedItemIds(idx);
                                    return (
                                        <div key={idx} className="flex items-end gap-2">
                                            <div className="flex-1">
                                                <Select
                                                    options={allItems
                                                        .filter((it) => !taken.has(Number(it.id)))
                                                        .map((it) => ({
                                                            value: Number(it.id),
                                                            label: `${it.name} — $${(it.price ?? 0).toFixed(2)} (stock ${it.quantity})`,
                                                        }))}
                                                    defaultValue={line.itemId === '' ? '' : line.itemId}
                                                    placeholder="Choose an item"
                                                    onChange={(v) => patchKitLine(idx, { itemId: v === '' ? '' : Number(v) })}
                                                />
                                            </div>
                                            <div className="w-28">
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    step={1}
                                                    value={line.quantityPerPerson === '' ? '' : String(line.quantityPerPerson)}
                                                    onChange={(e) =>
                                                        patchKitLine(idx, {
                                                            quantityPerPerson: e.target.value === '' ? '' : Number(e.target.value),
                                                        })
                                                    }
                                                    placeholder="Qty / person"
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removeKitLine(idx)}
                                                className="h-11 px-3 rounded-lg border border-gray-200 text-sm text-red-600 hover:bg-red-50"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    );
                                })}

                                <button
                                    type="button"
                                    onClick={addKitLine}
                                    className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200"
                                >
                                    + Add item
                                </button>

                                {/* Concrete preview beats explaining the multiplication. */}
                                {kitLines.some((l) => l.itemId !== '' && Number(l.quantityPerPerson) > 0) && (
                                    <p className="text-xs text-indigo-700 bg-indigo-50 rounded-md px-2 py-1.5">
                                        A session with 4 people will deduct{' '}
                                        {kitLines
                                            .filter((l) => l.itemId !== '' && Number(l.quantityPerPerson) > 0)
                                            .map((l) => {
                                                const it = allItems.find((x) => Number(x.id) === Number(l.itemId));
                                                return `${Number(l.quantityPerPerson) * 4}x ${it?.name ?? `#${l.itemId}`}`;
                                            })
                                            .join(', ')}
                                        .
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                    {/* Active toggle — only shown when editing. Lets admins hide a
                        setting from the cashier UI without losing it, or restore a
                        previously hidden one. */}
                    {editingId && (
                        <div>
                            <Label>Active</Label>
                            <div className="flex items-center gap-2">
                                <Switch
                                    key={String(newIsActive)}
                                    label={newIsActive ? "Visible to cashier" : "Hidden from cashier"}
                                    defaultChecked={newIsActive}
                                    onChange={(checked) => setNewIsActive(checked)}
                                />
                            </div>
                            <p className="mt-1 text-xs text-gray-400">
                                Turn off to hide this setting from the cashier and game-cashier
                                screens. Historical transactions that referenced it remain intact.
                            </p>
                        </div>
                    )}
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
