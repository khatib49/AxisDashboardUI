import { useEffect, useState } from 'react';
import { Button, Empty, Skeleton, Switch as AntSwitch } from 'antd';
import {
    CalendarOutlined,
    ControlOutlined,
    DeleteOutlined,
    EditOutlined,
    EyeInvisibleOutlined,
    GiftOutlined,
    PlusOutlined,
    TagOutlined,
} from '@ant-design/icons';
import { getSettings, GameSettingDto, createSetting, CreateSettingRequest, updateSetting, deleteSetting } from '../../services/gameSettingsService';
import { getGames } from '../../services/gameService';
import { getCategoriesByType, CategoryDto } from '../../services/categoryService';
import { getItems, ItemDto } from '../../services/itemService';
import Modal from '../../components/ui/Modal';
import Label from '../../components/form/Label';
import Input from '../../components/form/input/InputField';
import Select from '../../components/form/Select';
import Switch from '../../components/form/switch/Switch';
import { PageHeader, Panel, Pill, StatTile } from '../../components/ui/PageKit';
import { IconChip, VenuePager } from '../../components/admin/venue/VenueKit';
import { Field, FormSection, ToggleTile } from '../../components/admin/game/GameKit';
import { FOOTER_BTN, MODAL_LG, MODAL_SM, fmtDate, fmtDateTime, typeTone } from '../../components/admin/game/format';

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

    const openEdit = (s: GameSettingDto) => {
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
    };

    // ── List presentation (derived from the page already loaded) ────────
    const firstLoad = loading && totalCount === null;
    const gameNameOf = (s: GameSettingDto) => s.gameName ?? (games.find(g => g.id === s.gameId)?.name ?? s.gameId);
    const dayPassesOnPage = settings.filter(s => s.isDayPass).length;
    const eventsOnPage = settings.filter(s => s.isEvent).length;
    const offersOnPage = settings.filter(s => s.isOffer).length;
    const hiddenOnPage = settings.filter(s => s.isActive === false).length;

    const rowActions = (s: GameSettingDto, hidden: boolean) => (
        <div className="flex shrink-0 items-center justify-end gap-1">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(s)} aria-label={`Edit ${s.name}`}>
                Edit
            </Button>
            {!hidden && (
                <Button
                    size="small"
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => setDeleteId(s.id)}
                    aria-label={`Delete ${s.name}`}
                    title="Delete"
                />
            )}
        </div>
    );

    return (
        <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6">
            <PageHeader
                tone="violet"
                icon={<ControlOutlined />}
                title="Game Settings"
                description="Prices and session rules for each game: hourly or open-hour play, day passes, offers and event bundles. Hidden settings stay on file but don't reach the cashier."
            />

            {/* KPIs — derived from the data already loaded (no extra requests) */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatTile
                    label="Settings"
                    loading={firstLoad}
                    value={<span className="tabular-nums">{(totalCount ?? settings.length).toLocaleString('en-US')}</span>}
                    sub={showHidden ? `Including hidden · ${hiddenOnPage} hidden on this page` : 'Visible to the cashier'}
                    accent={<IconChip tone="violet"><ControlOutlined /></IconChip>}
                />
                <StatTile
                    label="Day passes"
                    loading={firstLoad}
                    value={<span className="tabular-nums">{dayPassesOnPage}</span>}
                    sub="On this page"
                    accent={<IconChip tone="blue"><CalendarOutlined /></IconChip>}
                />
                <StatTile
                    label="Events"
                    loading={firstLoad}
                    value={<span className="tabular-nums">{eventsOnPage}</span>}
                    sub="On this page"
                    accent={<IconChip tone="violet"><GiftOutlined /></IconChip>}
                />
                <StatTile
                    label="Offers"
                    loading={firstLoad}
                    value={<span className="tabular-nums">{offersOnPage}</span>}
                    sub="On this page"
                    accent={<IconChip tone="amber"><TagOutlined /></IconChip>}
                />
            </div>

            <Panel
                title="All settings"
                subtitle={totalCount !== null ? `${totalCount.toLocaleString('en-US')} setting${totalCount === 1 ? '' : 's'}${showHidden ? ' · including hidden' : ''}` : undefined}
                bodyClassName="p-0"
                extra={
                    <div className="flex flex-wrap items-center gap-3">
                        <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                            <AntSwitch
                                size="small"
                                checked={showHidden}
                                onChange={(checked) => { setShowHidden(checked); setPage(1); }}
                            />
                            Show hidden
                        </label>
                        <Button type="primary" icon={<PlusOutlined />} onClick={openModal}>Add Setting</Button>
                    </div>
                }
            >
                {loading && <div className="p-5"><Skeleton active paragraph={{ rows: 6 }} /></div>}

                {!loading && (
                    <>
                        {settings.length === 0 ? (
                            <div className="py-12">
                                <Empty description={showHidden ? 'No settings yet' : 'No visible settings — turn on “Show hidden” to see hidden ones'} />
                            </div>
                        ) : (
                            <>
                                {/* ≥ xl: table (sidebar + 7 columns need the room) */}
                                <div className="relative hidden overflow-x-auto xl:block">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500 dark:border-white/[0.06] dark:text-gray-400">
                                                <th className="px-5 py-3 font-medium">Setting</th>
                                                <th className="px-3 py-3 font-medium">Type</th>
                                                <th className="px-3 py-3 font-medium">Flags</th>
                                                <th className="px-3 py-3 font-medium">Hours</th>
                                                <th className="px-3 py-3 text-right font-medium">Price</th>
                                                <th className="px-3 py-3 font-medium">Dates</th>
                                                <th className="px-5 py-3 text-right font-medium"><span className="sr-only">Actions</span></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-white/[0.06]">
                                            {settings.map((s: GameSettingDto) => {
                                                const hidden = s.isActive === false;
                                                const dim = hidden ? 'opacity-60' : '';
                                                return (
                                                    <tr key={s.id} className={`align-top transition hover:bg-gray-50/70 dark:hover:bg-white/[0.02] ${hidden ? 'bg-gray-50/60 dark:bg-white/[0.015]' : ''}`}>
                                                        <td className={`min-w-[200px] px-5 py-3.5 ${dim}`}>
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => openEdit(s)}
                                                                    className="text-left font-medium text-gray-900 hover:text-violet-700 dark:text-gray-100 dark:hover:text-violet-300"
                                                                >
                                                                    {s.name}
                                                                </button>
                                                                {hidden && <HiddenPill />}
                                                            </div>
                                                            <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{gameNameOf(s)}</div>
                                                        </td>
                                                        <td className={`px-3 py-3.5 ${dim}`}><Pill tone={typeTone(s.type)}>{s.type}</Pill></td>
                                                        <td className={`max-w-[220px] px-3 py-3.5 ${dim}`}><SettingFlags s={s} /></td>
                                                        <td className={`whitespace-nowrap px-3 py-3.5 ${dim}`}><HoursCell hours={s.hours} /></td>
                                                        <td className={`whitespace-nowrap px-3 py-3.5 text-right font-medium tabular-nums text-gray-900 dark:text-gray-100 ${dim}`}>{fmtPrice(s.price)}</td>
                                                        <td className={`whitespace-nowrap px-3 py-3.5 text-xs leading-5 text-gray-500 dark:text-gray-400 ${dim}`}>
                                                            <div title={fmtDateTime(s.createdOn)}><span className="text-gray-400 dark:text-gray-500">Created</span> {fmtDate(s.createdOn)}</div>
                                                            <div title={fmtDateTime(s.modifiedOn)}><span className="text-gray-400 dark:text-gray-500">Modified</span> {fmtDate(s.modifiedOn)}</div>
                                                        </td>
                                                        <td className="px-5 py-3.5">{rowActions(s, hidden)}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* < xl: cards */}
                                <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:hidden">
                                    {settings.map((s: GameSettingDto) => {
                                        const hidden = s.isActive === false;
                                        return (
                                            <div
                                                key={s.id}
                                                className={`min-w-0 rounded-xl border p-4 ${hidden ? 'border-dashed border-gray-300 bg-gray-50/60 dark:border-white/10 dark:bg-white/[0.015]' : 'border-gray-200/80 bg-white dark:border-white/[0.06] dark:bg-white/[0.02]'}`}
                                            >
                                                <div className="flex items-start gap-2">
                                                    <div className={`min-w-0 flex-1 ${hidden ? 'opacity-60' : ''}`}>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => openEdit(s)}
                                                                className="min-w-0 break-words text-left font-medium text-gray-900 dark:text-gray-100"
                                                            >
                                                                {s.name}
                                                            </button>
                                                            {hidden && <HiddenPill />}
                                                        </div>
                                                        <div className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">{gameNameOf(s)}</div>
                                                    </div>
                                                    {rowActions(s, hidden)}
                                                </div>
                                                <div className={hidden ? 'opacity-60' : ''}>
                                                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                                                        <Pill tone={typeTone(s.type)}>{s.type}</Pill>
                                                        <SettingFlags s={s} inline />
                                                    </div>
                                                    <div className="mt-3 grid grid-cols-2 gap-3 border-t border-gray-100 pt-3 dark:border-white/[0.06]">
                                                        <Field label="Hours"><HoursCell hours={s.hours} /></Field>
                                                        <Field label="Price"><span className="font-medium tabular-nums">{fmtPrice(s.price)}</span></Field>
                                                        <Field label="Created"><span className="text-xs tabular-nums">{fmtDateTime(s.createdOn)}</span></Field>
                                                        <Field label="Modified"><span className="text-xs tabular-nums">{fmtDateTime(s.modifiedOn)}</span></Field>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}

                        <VenuePager
                            shown={settings.length}
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
                    </>
                )}
            </Panel>

            <Modal
                isOpen={isOpen}
                onClose={() => { setIsOpen(false); setEditingId(null); }}
                title={editingId ? "Edit Setting" : "Create Setting"}
                subtitle={editingId ? 'Changes apply to new sessions at the cashier.' : 'A price and session rule the cashier can pick for a game.'}
                className={MODAL_LG}
                footer={(
                    <>
                        <Button className={FOOTER_BTN} onClick={() => setIsOpen(false)}>Cancel</Button>
                        <Button className={FOOTER_BTN} type="primary" onClick={handleCreateOrUpdate} disabled={creating}>{creating ? 'Saving...' : (editingId ? 'Save' : 'Create')}</Button>
                    </>
                )}
            >
                <div className="space-y-4">
                    {/* ── Basics ─────────────────────────────────────────── */}
                    <FormSection title="Basics" description="What the cashier sees and which game it applies to.">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="min-w-0">
                                <Label>Name</Label>
                                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name" />
                            </div>
                            <div className="min-w-0">
                                <Label>Type</Label>
                                <Select
                                    options={types.map(t => ({ value: t.name, label: t.name }))}
                                    defaultValue={newType}
                                    placeholder="Select a type"
                                    onChange={(v) => setNewType(typeof v === 'number' ? String(v) : v)}
                                />
                            </div>
                            <div className="min-w-0 sm:col-span-2">
                                <Label>Game</Label>
                                <Select options={games.map(g => ({ value: g.id, label: g.name }))} defaultValue={newGameId} onChange={(v) => setNewGameId(typeof v === 'number' ? String(v) : v)} />
                            </div>
                        </div>
                    </FormSection>

                    {/* ── Pricing & duration ─────────────────────────────── */}
                    <FormSection title="Pricing & duration" description="Open-hour and day-pass settings don't use a fixed number of hours.">
                        <div className="grid gap-2 sm:grid-cols-3">
                            <ToggleTile>
                                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Open Hour</div>
                                <Switch key={String(isOpenHour)} label="Is this open hour?" defaultChecked={isOpenHour} onChange={(checked) => {
                                    setIsOpenHour(checked);
                                    if (checked) {
                                        setNewHours('');
                                    }
                                }} />
                            </ToggleTile>
                            <ToggleTile>
                                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Day Pass</div>
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
                            </ToggleTile>
                            <ToggleTile>
                                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Offer</div>
                                <Switch key={String(newIsOffer)} label="Is this an offer?" defaultChecked={newIsOffer} onChange={(checked) => setNewIsOffer(checked)} />
                            </ToggleTile>
                        </div>
                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                            <div className="min-w-0">
                                <Label>Hours</Label>
                                <Input
                                    type="number"
                                    value={newHours === '' ? '' : String(newHours)}
                                    onChange={(e) => setNewHours(e.target.value === '' ? '' : Number(e.target.value))}
                                    placeholder="Hours"
                                    disabled={isOpenHour || newIsDayPass}
                                />
                                {(isOpenHour || newIsDayPass) && (
                                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                        Not used for {isOpenHour ? 'open-hour' : 'day-pass'} settings.
                                    </p>
                                )}
                            </div>
                            <div className="min-w-0">
                                <Label>Price</Label>
                                <Input type="number" value={newPrice === '' ? '' : String(newPrice)} onChange={(e) => setNewPrice(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Price" />
                            </div>
                        </div>
                    </FormSection>

                    {/* ── Event kit ──────────────────────────────────────── */}
                    <FormSection title="Event bundle" description="Events (Pre Release, Draft…) can hand out stock items with each session.">
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
                            <div className="mt-4 space-y-3">
                                <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs leading-5 text-gray-600 dark:bg-white/[0.03] dark:text-gray-400">
                                    Items handed out with this event. They come <b>off stock</b> when the
                                    session starts, but add <b>nothing</b> to the bill — the price above is
                                    what the customer pays. Quantity is <b>per person</b>.
                                </p>

                                {kitLines.length > 0 && (
                                    <div className="hidden grid-cols-[minmax(0,1fr)_7rem_auto] gap-2 px-0.5 text-xs font-medium text-gray-500 sm:grid dark:text-gray-400">
                                        <span>Item</span>
                                        <span>Qty / person</span>
                                        <span className="w-[94px]" aria-hidden />
                                    </div>
                                )}

                                {kitLines.map((line, idx) => {
                                    const taken = usedItemIds(idx);
                                    return (
                                        <div
                                            key={idx}
                                            className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-lg border border-gray-200 p-2 sm:grid-cols-[minmax(0,1fr)_7rem_auto] sm:items-end sm:border-0 sm:p-0 dark:border-white/10"
                                        >
                                            <div className="col-span-2 min-w-0 sm:col-span-1">
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
                                            <div className="min-w-0">
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
                                            <Button
                                                danger
                                                icon={<DeleteOutlined />}
                                                onClick={() => removeKitLine(idx)}
                                                className="h-11!"
                                            >
                                                Remove
                                            </Button>
                                        </div>
                                    );
                                })}

                                <Button type="dashed" block icon={<PlusOutlined />} onClick={addKitLine}>
                                    Add item
                                </Button>

                                {/* Concrete preview beats explaining the multiplication. */}
                                {kitLines.some((l) => l.itemId !== '' && Number(l.quantityPerPerson) > 0) && (
                                    <p className="rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
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
                    </FormSection>

                    {/* Active toggle — only shown when editing. Lets admins hide a
                        setting from the cashier UI without losing it, or restore a
                        previously hidden one. */}
                    {editingId && (
                        <FormSection title="Visibility">
                            <Label>Active</Label>
                            <div className="flex items-center gap-2">
                                <Switch
                                    key={String(newIsActive)}
                                    label={newIsActive ? "Visible to cashier" : "Hidden from cashier"}
                                    defaultChecked={newIsActive}
                                    onChange={(checked) => setNewIsActive(checked)}
                                />
                            </div>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                Turn off to hide this setting from the cashier and game-cashier
                                screens. Historical transactions that referenced it remain intact.
                            </p>
                        </FormSection>
                    )}
                    {/* actions are rendered in the Modal footer */}
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
                            {deleting ? 'Deleting...' : 'Delete'}
                        </Button>
                    </>
                )}
            >
                <div className="space-y-4">
                    <p className="text-gray-700 dark:text-gray-300">Are you sure you want to delete this setting?</p>
                </div>
            </Modal>
        </div>
    );
}

// ── Row presentation helpers (pure UI) ───────────────────────────────────

function HiddenPill() {
    return (
        <Pill tone="red">
            <EyeInvisibleOutlined className="text-[10px]" /> Hidden
        </Pill>
    );
}

/** Offer / Day pass / Event as compact pills, plus the event bundle line. */
function SettingFlags({ s, inline = false }: { s: GameSettingDto; inline?: boolean }) {
    const none = !s.isOffer && !s.isDayPass && !s.isEvent;
    const bundle = s.isEvent && (s.items?.length ?? 0) > 0
        ? `${s.items!.map(i => `${i.quantityPerPerson}× ${i.itemName}`).join(', ')} / person`
        : null;
    const pills = (
        <>
            {s.isOffer && <Pill tone="amber">Offer</Pill>}
            {s.isDayPass && <Pill tone="blue">Day pass</Pill>}
            {s.isEvent && <Pill tone="purple" dot>Event</Pill>}
        </>
    );
    if (inline) {
        return (
            <>
                {pills}
                {bundle && <span className="w-full text-[11px] leading-4 text-gray-500 dark:text-gray-400">{bundle}</span>}
            </>
        );
    }
    return (
        <div className="min-w-0">
            {none ? (
                <span className="text-gray-400 dark:text-gray-500">—</span>
            ) : (
                <div className="flex flex-wrap gap-1">{pills}</div>
            )}
            {bundle && <div className="mt-1 text-[11px] leading-4 text-gray-500 dark:text-gray-400">{bundle}</div>}
        </div>
    );
}

/** "Open" for open-hour settings, "N h" otherwise, "—" when unset. */
function HoursCell({ hours }: { hours?: number }) {
    if (typeof hours !== 'number') return <span className="text-gray-400 dark:text-gray-500">—</span>;
    if (hours === 0) return <Pill tone="emerald" dot>Open</Pill>;
    return <span className="tabular-nums text-gray-800 dark:text-gray-200">{hours} h</span>;
}

function fmtPrice(price?: number): string {
    return typeof price === 'number'
        ? `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : '—';
}
