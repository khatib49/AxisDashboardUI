import React, { useEffect, useMemo, useState } from 'react'
import { getGames, GameDto } from '../../services/gameService';
import { getSettings, GameSettingDto } from '../../services/gameSettingsService';
import { getStatusName, STATUS_ENABLED, STATUS_PROCESSED_PAID } from '../../services/statuses';
import Loader from '../../components/ui/Loader';
import Modal from '../../components/ui/Modal';
import Label from '../../components/form/Label';
import Input from '../../components/form/input/InputField';
import Select from '../../components/form/Select';
import Alert from '../../components/ui/alert/Alert';
import { createGameSession } from '../../services/gameSession';
import ChangeCalculator from '../../components/common/ChangeCalculator';
import { getRooms, RoomDto } from '../../services/roomsService';
import { getSetAvailability, SetAvailabilityDto } from '../../services/setService';
import { getGameTransactions, GameTransaction } from '../../services/transactionService';
import { useAuth } from '../../context/AuthContext';
import GameInvoice from '../../components/invoice/GameInvoice';
import { getDiscounts, DiscountDto } from '../../services/discountService';
import { searchClientsByPhone, ClientUserDto } from '../../services/clientService';
// ...existing imports...

const PAGE_SIZE = 8;

const GameSession: React.FC = () => {
    const { claims } = useAuth();
    const [games, setGames] = useState<GameDto[]>([]);
    const [settings, setSettings] = useState<GameSettingDto[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState<number | null>(null);
    const [selectedSetting, setSelectedSetting] = useState<GameSettingDto | null>(null);
    const [startModalOpen, setStartModalOpen] = useState(false);
    const [startHours, setStartHours] = useState<number>(1);
    const [numberOfPersons, setNumberOfPersons] = useState<number>(1);
    const [starting, setStarting] = useState(false);
    const [toast, setToast] = useState<{ variant: 'success' | 'error' | 'info', title: string, message: string } | null>(null);

    // Quick find over the loaded page — matches game names AND setting names,
    // so typing "draft" surfaces MTG even though the game is called "Magic".
    const [gameSearch, setGameSearch] = useState('');

    // Room and set selection
    const [rooms, setRooms] = useState<RoomDto[]>([]);
    const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
    const [setAvailability, setSetAvailability] = useState<SetAvailabilityDto | null>(null);
    const [selectedSetId, setSelectedSetId] = useState<number | null>(null);
    const [loadingAvailability, setLoadingAvailability] = useState(false);

    // Invoice states
    const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
    const [currentInvoice, setCurrentInvoice] = useState<GameTransaction | null>(null);
    const [userInvoices, setUserInvoices] = useState<GameTransaction[]>([]);
    const [loadingInvoices, setLoadingInvoices] = useState(false);
    const [showInvoicesSection, setShowInvoicesSection] = useState(false);
    const [totalInvoices, setTotalInvoices] = useState<number>(0);

    // Session summary modal for open sessions (status 7)
    const [sessionSummaryModalOpen, setSessionSummaryModalOpen] = useState(false);

    // Change calculator modal
    const [calculatorOpen, setCalculatorOpen] = useState(false);
    const [sessionSummaryData, setSessionSummaryData] = useState<GameTransaction | null>(null);

    // Discount states
    const [discounts, setDiscounts] = useState<DiscountDto[]>([]);
    const [loadingDiscounts, setLoadingDiscounts] = useState(false);
    const [selectedDiscountId, setSelectedDiscountId] = useState<number | null>(null);

    // Client search states
    const [clientPhone, setClientPhone] = useState('');
    const [searchingClient, setSearchingClient] = useState(false);
    const [clientResults, setClientResults] = useState<ClientUserDto[]>([]);
    const [selectedClient, setSelectedClient] = useState<ClientUserDto | null>(null);

    // Comment state
    const [comment, setComment] = useState('');

    const handleClientSearch = async () => {
        if (!clientPhone.trim()) {
            setClientResults([]);
            return;
        }
        setSearchingClient(true);
        try {
            const results = await searchClientsByPhone(clientPhone);
            setClientResults(results || []);
            if (results.length === 0) {
                setToast({
                    variant: "info",
                    title: "No Results",
                    message: "No clients found with that phone number"
                });
            }
        } catch (err: unknown) {
            let message = "Failed to search clients";
            if (err && typeof err === "object") {
                const maybe = err as { message?: unknown };
                if (typeof maybe.message === "string") message = maybe.message;
            }
            setToast({ variant: "error", title: "Search failed", message });
        } finally {
            setSearchingClient(false);
        }
    };

    useEffect(() => {
        let mounted = true;
        setLoading(true);
        setError(null);

        // load games (paged)
        getGames(page, PAGE_SIZE)
            .then((res) => {
                if (!mounted) return;
                setGames(res.data || []);
                setTotalCount(res.totalCount ?? null);
            })
            .catch((err) => {
                if (!mounted) return;
                setError(err?.message || 'Failed to load games');
            })
            .finally(() => {
                if (!mounted) return;
                setLoading(false);
            });

        // load all settings (we'll request a large page to include settings for listed games)
        getSettings(1, 1000)
            .then((res) => {
                if (!mounted) return;
                setSettings(res.data || []);
            })
            .catch(() => {
                // ignore settings errors for now or show a lighter UI
            });

        return () => { mounted = false; };
    }, [page]);

    // Load rooms for set selection
    useEffect(() => {
        let mounted = true;
        getRooms(1, 100)
            .then((res) => {
                if (!mounted) return;
                setRooms(res.data || []);
            })
            .catch(() => { /* ignore */ });
        return () => { mounted = false; };
    }, []);

    // Load active discounts when modal opens
    useEffect(() => {
        if (!startModalOpen) return;
        let mounted = true;
        setLoadingDiscounts(true);
        getDiscounts(1, 100)
            .then((res) => {
                if (!mounted) return;
                // Filter only active discounts
                const activeDiscounts = (res.data || []).filter(d => d.isActive);
                setDiscounts(activeDiscounts);
            })
            .catch(() => {
                /* ignore */
            })
            .finally(() => {
                if (mounted) setLoadingDiscounts(false);
            });
        return () => { mounted = false; };
    }, [startModalOpen]);

    // Load set availability when room is selected
    useEffect(() => {
        if (!selectedRoomId || !startModalOpen) {
            setSetAvailability(null);
            setSelectedSetId(null);
            return;
        }
        const selectedRoom = rooms.find(r => String(r.id) === String(selectedRoomId));
        console.log('useEffect - Selected room:', selectedRoom);
        if (selectedRoom?.isOpenSet) {
            // Skip loading sets for open set rooms - auto-enable submit
            console.log('Room is open set, skipping set loading');
            setSetAvailability(null);
            setSelectedSetId(null);
            setLoadingAvailability(false);
            return;
        }
        let mounted = true;
        setLoadingAvailability(true);
        const roomIdNum = Number(selectedRoomId);
        getSetAvailability(roomIdNum, 7)
            .then((res) => {
                if (!mounted) return;
                setSetAvailability(res);
            })
            .catch(() => { /* ignore */ })
            .finally(() => { if (mounted) setLoadingAvailability(false); });
        return () => { mounted = false; };
    }, [selectedRoomId, startModalOpen, rooms]);

    const settingsByGame = useMemo(() => {
        const map = new Map<string, GameSettingDto[]>();
        settings.forEach((s) => {
            const list = map.get(s.gameId) || [];
            list.push(s);
            map.set(s.gameId, list);
        });
        return map;
    }, [settings]);

    // Load user's invoices (yesterday and today full days)
    useEffect(() => {
        if (!showInvoicesSection || !claims?.name) return;
        let mounted = true;
        setLoadingInvoices(true);

        // Get transactions from yesterday 00:00:00 to today 23:59:59
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const fromDate = yesterday.toISOString(); // Yesterday at 00:00:00
        const endOfToday = new Date(today);
        endOfToday.setDate(endOfToday.getDate() + 1);
        endOfToday.setMilliseconds(-1); // Today at 23:59:59.999
        const toDate = endOfToday.toISOString();

        getGameTransactions({
            CreatedBy: [claims.name],
            PageSize: 50,
            From: fromDate,
            To: toDate,
        })
            .then((res) => {
                if (!mounted) return;
                setUserInvoices(res.data || []);
                setTotalInvoices(res.totalInvoices || 0);
            })
            .catch(() => { /* ignore */ })
            .finally(() => { if (mounted) setLoadingInvoices(false); });
        return () => { mounted = false; };
    }, [showInvoicesSection, claims?.name]);

    return (
        <div className="p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900">Game Sessions</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Pick a game, choose a setting, hit Start.</p>
                </div>
                <div className="flex items-center gap-2">
                    {/* Quick find — filters the loaded games as you type. */}
                    <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" strokeLinecap="round" />
                            </svg>
                        </span>
                        <input
                            value={gameSearch}
                            onChange={(e) => setGameSearch(e.target.value)}
                            placeholder="Find a game or setting…"
                            className="h-10 w-64 rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
                        />
                    </div>
                    <button
                        onClick={() => setCalculatorOpen(true)}
                        className="h-10 px-4 bg-green-600 text-white rounded-xl shadow-sm hover:bg-green-700 hover:shadow transition flex items-center gap-2 text-sm font-medium"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        Calculator
                    </button>
                </div>
            </div>

            {loading && (
                <div className="flex items-center justify-center py-20">
                    <Loader />
                </div>
            )}

            {error && (
                <div className="text-red-600 bg-red-50 p-3 rounded mb-4">{error}</div>
            )}

            {!loading && !error && (() => {
                // Category → consistent accent color, so PS5 always looks like
                // PS5 and TCG like TCG across visits.
                const accentFor = (cat?: string | null) => {
                    const c = (cat || '').toLowerCase();
                    if (c.includes('tcg')) return { bar: 'from-violet-500 to-purple-400', chip: 'bg-violet-50 text-violet-700', avatar: 'bg-violet-100 text-violet-700' };
                    if (c.includes('ps5') || c.includes('play')) return { bar: 'from-blue-500 to-sky-400', chip: 'bg-blue-50 text-blue-700', avatar: 'bg-blue-100 text-blue-700' };
                    if (c.includes('board')) return { bar: 'from-amber-500 to-orange-400', chip: 'bg-amber-50 text-amber-700', avatar: 'bg-amber-100 text-amber-700' };
                    return { bar: 'from-emerald-500 to-teal-400', chip: 'bg-emerald-50 text-emerald-700', avatar: 'bg-emerald-100 text-emerald-700' };
                };

                const q = gameSearch.trim().toLowerCase();
                const visibleGames = !q ? games : games.filter((g) =>
                    g.name.toLowerCase().includes(q) ||
                    (g.categoryName ?? '').toLowerCase().includes(q) ||
                    (settingsByGame.get(g.id) || []).some((s) => s.name.toLowerCase().includes(q)));

                return (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                        {visibleGames.map((g) => {
                            const accent = accentFor(g.categoryName);
                            const statusIdNum = g.statusId === null || g.statusId === undefined ? null : Number(g.statusId);
                            const enabled = statusIdNum === STATUS_ENABLED || statusIdNum === STATUS_PROCESSED_PAID;
                            return (
                            <div key={g.id} className="group rounded-2xl bg-white shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden border border-gray-100">
                                {/* Category accent strip */}
                                <div className={`h-1.5 bg-gradient-to-r ${accent.bar}`} />

                                <div className="p-4">
                                    <div className="flex items-start gap-3">
                                        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-base font-bold ${accent.avatar}`}>
                                            {g.name.slice(0, 2).toUpperCase()}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-[15px] font-semibold text-gray-900 leading-snug truncate" title={g.name}>{g.name}</div>
                                            <span className={`mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${accent.chip}`}>
                                                {g.categoryName ?? '—'}
                                            </span>
                                        </div>
                                        <span className={`mt-0.5 inline-flex items-center gap-1.5 text-[11px] font-medium ${enabled ? 'text-green-600' : 'text-red-500'}`}>
                                            <span className={`h-1.5 w-1.5 rounded-full ${enabled ? 'bg-green-500' : 'bg-red-400'}`} />
                                            {getStatusName(statusIdNum) ?? (g.statusId ?? '-')}
                                        </span>
                                    </div>

                                    <div className="mt-4 space-y-1.5">
                                        {(settingsByGame.get(g.id) || []).map((s) => (
                                            <div key={s.id} className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 bg-gray-50/80 hover:bg-indigo-50/60 transition-colors">
                                                <div className="min-w-0">
                                                    <div className="text-sm font-medium text-gray-800 flex items-center gap-1.5 truncate">
                                                        <span className="truncate">{s.name}</span>
                                                        {s.isEvent && (
                                                            <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-700">
                                                                🎟 Event
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-gray-500 mt-0.5">
                                                        {s.hours === 0 ? '⏱ Open Hour' : (s.hours ? `⏱ ${s.hours} hrs` : '')}
                                                    </div>
                                                    {/* Bundle preview — the cashier sees exactly what to hand
                                                        over. Deducted from stock automatically at start. */}
                                                    {s.isEvent && (s.items?.length ?? 0) > 0 && (
                                                        <div className="text-[11px] text-indigo-600 mt-0.5">
                                                            Includes {s.items!.map(i => `${i.quantityPerPerson}x ${i.itemName}`).join(', ')} / person
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex shrink-0 items-center gap-2.5">
                                                    {s.price ? <span className="text-sm font-bold text-gray-900">${s.price}</span> : null}
                                                    <button
                                                        className="px-3.5 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg shadow-sm hover:bg-indigo-700 hover:shadow active:scale-95 transition-all"
                                                        onClick={() => {
                                                            setSelectedSetting(s);
                                                            setStartHours(s.isDayPass ? 0 : (s.hours ?? 1));
                                                            setNumberOfPersons(1);
                                                            setSelectedRoomId(null);
                                                            setSelectedSetId(null);
                                                            setSetAvailability(null);
                                                            setSelectedDiscountId(null);
                                                            setStartModalOpen(true);
                                                        }}
                                                    >
                                                        Start ▸
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                        {((settingsByGame.get(g.id) || []).length === 0) && (
                                            <div className="rounded-xl border border-dashed border-gray-200 px-3 py-4 text-center text-sm text-gray-400">
                                                No settings available
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            );
                        })}
                    </div>

                    {q && visibleGames.length === 0 && (
                        <div className="mt-8 text-center text-gray-500">
                            <div className="text-3xl mb-2">🔍</div>
                            No games match “{gameSearch}” on this page — try the next page or clear the search.
                        </div>
                    )}

                    {/* Pagination */}
                    <div className="mt-6 flex items-center justify-between">
                        <div className="text-sm text-gray-500">{totalCount !== null ? `Showing ${games.length} of ${totalCount}` : ''}</div>
                        <div className="flex items-center gap-1">
                            <button
                                className="h-9 px-4 rounded-lg border border-gray-200 bg-white text-sm font-medium shadow-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                            >← Prev</button>
                            <span className="px-3 text-sm text-gray-600">Page {page}</span>
                            <button
                                className="h-9 px-4 rounded-lg border border-gray-200 bg-white text-sm font-medium shadow-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                onClick={() => setPage((p) => p + 1)} disabled={totalCount !== null && page * PAGE_SIZE >= (totalCount || 0)}
                            >Next →</button>
                        </div>
                    </div>
                </>
                );
            })()}
            {/* Start session modal */}
            <Modal isOpen={startModalOpen} onClose={() => { setStartModalOpen(false); setSelectedRoomId(null); setSelectedSetId(null); }} title={selectedSetting ? `Start: ${selectedSetting.name}` : 'Start session'}>
                <div className="space-y-4">
                    {toast && (
                        <div className="mb-4">
                            <Alert variant={toast.variant} title={toast.title} message={toast.message} />
                        </div>
                    )}
                    <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-4">
                        <div>
                            <Label>Room</Label>
                            <Select
                                key={startModalOpen ? 'room-select-open' : 'room-select-closed'}
                                options={[...rooms.map(r => ({ value: r.id, label: r.name }))]}
                                defaultValue={selectedRoomId ?? ''}
                                isPlaceHolderDisabled={false}
                                placeholder='Select a room'
                                onChange={(v) => {
                                    const roomId = v === '' ? null : String(v);
                                    console.log('Selected room ID:', roomId);
                                    console.log('Available rooms:', rooms.map(r => ({ id: r.id, name: r.name, isOpenSet: r.isOpenSet })));
                                    setSelectedRoomId(roomId);
                                }}
                            />
                        </div>

                        {selectedRoomId && (() => {
                            const selectedRoom = rooms.find(r => String(r.id) === String(selectedRoomId));
                            console.log('Selected room ID:', selectedRoomId);
                            console.log('Found room:', selectedRoom);
                            if (selectedRoom?.isOpenSet) {
                                return (
                                    <div className="text-sm text-green-600 bg-green-50 p-3 rounded">
                                        This is an open set room — no set selection required.
                                    </div>
                                );
                            }
                            return null;
                        })()}

                        {selectedRoomId && !rooms.find(r => String(r.id) === String(selectedRoomId))?.isOpenSet && loadingAvailability && <div className="text-sm text-gray-500">Loading sets...</div>}

                        {selectedRoomId && !rooms.find(r => String(r.id) === String(selectedRoomId))?.isOpenSet && !loadingAvailability && setAvailability && (
                            <div>
                                <Label>Select Set</Label>
                                <div className="flex gap-3 text-xs mb-2">
                                    <div className="flex items-center gap-1">
                                        <div className="w-3 h-3 bg-green-100 border-2 border-green-500 rounded"></div>
                                        <span>Available ({setAvailability.availableCount})</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <div className="w-3 h-3 bg-red-100 border-2 border-red-500 rounded"></div>
                                        <span>Occupied ({setAvailability.unavailableCount})</span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-6 gap-2">
                                    {setAvailability.available.map((set) => (
                                        <button
                                            key={set.id}
                                            onClick={() => setSelectedSetId(set.id)}
                                            className={`px-2 py-2 rounded-lg border-2 text-center text-sm font-medium transition ${selectedSetId === set.id
                                                ? 'border-blue-600 bg-blue-100 text-blue-700'
                                                : 'border-green-500 bg-green-50 text-green-700 hover:bg-green-100'
                                                }`}
                                        >
                                            {set.name}
                                        </button>
                                    ))}
                                    {setAvailability.unavailable.map((set) => (
                                        <div
                                            key={set.id}
                                            className="px-2 py-2 rounded-lg border-2 border-red-500 bg-red-50 text-center text-sm font-medium text-red-700 cursor-not-allowed opacity-60"
                                        >
                                            {set.name}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div>
                            <Label>Hours</Label>
                            <Input type="number" value={startHours.toString()} onChange={(e) => setStartHours(Number(e.target.value))} min={'1'} disabled={!!selectedSetting?.isOffer || selectedSetting?.hours === 0 || !!selectedSetting?.isDayPass} />
                            {selectedSetting?.isOffer && (
                                <div className="text-xs text-gray-500 mt-1">This setting is an offer — duration is fixed.</div>
                            )}
                            {selectedSetting?.hours === 0 && (
                                <div className="text-xs text-gray-500 mt-1">This is an open hour setting — duration is not applicable.</div>
                            )}
                            {selectedSetting?.isDayPass && (
                                <div className="text-xs text-gray-500 mt-1">This is an open day pass — duration is not applicable.</div>
                            )}
                        </div>

                        <div>
                            <Label>Number of Persons</Label>
                            <Input
                                type="number"
                                value={numberOfPersons.toString()}
                                onChange={(e) => setNumberOfPersons(Math.max(1, Number(e.target.value)))}
                                min={'1'}
                            />
                            <div className="text-xs text-gray-500 mt-1">Total will be calculated per person.</div>
                        </div>

                        {/* Event bundle preview — concrete quantities for THIS
                            headcount, so the cashier knows what to hand over. */}
                        {selectedSetting?.isEvent && (selectedSetting.items?.length ?? 0) > 0 && (
                            <div className="rounded-lg bg-indigo-50 border border-indigo-200 p-3 text-sm">
                                <div className="font-medium text-indigo-800 mb-1">Hand out with this event:</div>
                                <ul className="space-y-0.5 text-indigo-700">
                                    {selectedSetting.items!.map((i) => (
                                        <li key={i.itemId}>
                                            {i.quantityPerPerson * numberOfPersons}x {i.itemName}
                                            <span className="text-indigo-400"> ({i.quantityPerPerson} / person)</span>
                                        </li>
                                    ))}
                                </ul>
                                <div className="text-[11px] text-indigo-500 mt-1.5">
                                    Deducted from stock automatically — included in the event price, not billed separately.
                                </div>
                            </div>
                        )}

                        {/* Discount Selection */}
                        <div>
                            <Label>Apply Discount</Label>
                            {loadingDiscounts ? (
                                <div className="text-xs text-gray-500">Loading discounts...</div>
                            ) : (
                                <Select
                                    options={[
                                        { value: '', label: 'No Discount' },
                                        ...discounts.map(d => ({
                                            value: d.id,
                                            label: `${d.name} (${d.percentage}% off)`
                                        }))
                                    ]}
                                    defaultValue={selectedDiscountId ?? ''}
                                    onChange={(v: string | number) => setSelectedDiscountId(v === '' ? null : Number(v))}
                                />
                            )}
                        </div>

                        {/* Client Selection */}
                        <div>
                            <Label>Client (Optional)</Label>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Search by phone..."
                                    value={clientPhone}
                                    onChange={(e) => setClientPhone(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleClientSearch();
                                        }
                                    }}
                                    className="flex-1"
                                />
                                <button
                                    className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 transition text-sm"
                                    onClick={handleClientSearch}
                                    disabled={searchingClient}
                                >
                                    {searchingClient ? <Loader size={14} /> : 'Search'}
                                </button>
                            </div>
                            {clientResults.length > 0 && (
                                <Select
                                    options={[
                                        { value: '', label: 'Select client...' },
                                        ...clientResults.map(c => {
                                            const firstName = c.firstName || '';
                                            const lastName = c.lastName || '';
                                            const fullName = `${firstName} ${lastName}`.trim() || c.email || 'Unknown';
                                            const phone = c.phoneNumber || 'No phone';
                                            return {
                                                value: c.id,
                                                label: `${fullName} (${phone})`
                                            };
                                        })
                                    ]}
                                    defaultValue={selectedClient?.id ?? ''}
                                    onChange={(v: string | number) => {
                                        const client = clientResults.find(c => c.id === Number(v));
                                        setSelectedClient(client || null);
                                    }}
                                    className="mt-2 w-80"
                                />
                            )}
                            {selectedClient && (
                                <div className="mt-2 text-xs bg-blue-50 text-blue-700 p-2 rounded flex items-center justify-between">
                                    <span>
                                        Selected: {(() => {
                                            const firstName = selectedClient.firstName || '';
                                            const lastName = selectedClient.lastName || '';
                                            const fullName = `${firstName} ${lastName}`.trim();
                                            return fullName || selectedClient.email || 'Unknown';
                                        })()}
                                    </span>
                                    <button
                                        onClick={() => {
                                            setSelectedClient(null);
                                            setClientResults([]);
                                            setClientPhone('');
                                        }}
                                        className="text-blue-600 hover:text-blue-800"
                                    >
                                        ✕
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Comment Section */}
                        <div>
                            <Label>Comment (Optional)</Label>
                            <textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder="Add any notes or comments..."
                                rows={3}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                            />
                        </div>

                        <div>
                            <Label>Total</Label>
                            {(() => {
                                const basePrice = selectedSetting?.hours === 0 ? (selectedSetting?.price ?? 0) : ((selectedSetting?.price ?? 0) * startHours);
                                const subtotal = basePrice * numberOfPersons;
                                const selectedDiscount = discounts.find(d => d.id === selectedDiscountId);
                                const discountAmount = selectedDiscount ? (subtotal * selectedDiscount.percentage) / 100 : 0;
                                const total = subtotal - discountAmount;
                                return (
                                    <div>
                                        {selectedDiscount ? (
                                            <div className="space-y-1">
                                                <div className="text-sm text-gray-600">${basePrice.toFixed(2)} × {numberOfPersons} person{numberOfPersons !== 1 ? 's' : ''} = ${subtotal.toFixed(2)}</div>
                                                <div className="text-sm text-green-600">Discount ({selectedDiscount.name} - {selectedDiscount.percentage}%): -${discountAmount.toFixed(2)}</div>
                                                <div className="text-lg font-semibold">${total.toFixed(2)}</div>
                                            </div>
                                        ) : (
                                            <div>
                                                <div className="text-sm text-gray-600 mb-1">${basePrice.toFixed(2)} × {numberOfPersons} person{numberOfPersons !== 1 ? 's' : ''}</div>
                                                <div className="text-lg font-semibold">${subtotal.toFixed(2)}</div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                className="px-3 py-1 bg-green-600 text-white rounded flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={(() => {
                                    if (!selectedRoomId) return true;
                                    const selectedRoom = rooms.find(r => String(r.id) === String(selectedRoomId));
                                    console.log('Submit button - Selected room:', selectedRoom);
                                    if (selectedRoom?.isOpenSet) return false; // Enable immediately for open set rooms
                                    return !selectedSetId; // Require set selection for non-open-set rooms
                                })()}
                                onClick={async () => {
                                    if (!selectedSetting || !selectedRoomId) return;
                                    const selectedRoom = rooms.find(r => String(r.id) === String(selectedRoomId));
                                    const isOpenSetRoom = selectedRoom?.isOpenSet;
                                    if (!isOpenSetRoom && !selectedSetId) return;

                                    setStarting(true);
                                    try {
                                        const response = await createGameSession({
                                            gameId: selectedSetting.gameId,
                                            gameSettingId: selectedSetting.id,
                                            hours: startHours,
                                            status: String(STATUS_ENABLED),
                                            setId: isOpenSetRoom ? undefined : selectedSetId!,
                                            isOpenHour: selectedSetting.isOpenHour,
                                            discountId: selectedDiscountId,
                                            userId: selectedClient?.id,
                                            isDayPass: selectedSetting?.isDayPass,
                                            numberOfPersons: numberOfPersons,
                                            comment: comment,
                                        });

                                        // Check if the response indicates success
                                        if (response && response.success === false) {
                                            setStarting(false);
                                            setToast({
                                                variant: 'error',
                                                title: 'Failed',
                                                message: response.message || response.error || 'Failed to start session'
                                            });
                                            setTimeout(() => setToast(null), 5000);
                                            return;
                                        }

                                        // Show invoice for closed sessions or summary for open sessions (status 7)
                                        if (response?.data) {
                                            if (response.data.statusId === 7) {
                                                // Show summary modal for open session (no price)
                                                setSessionSummaryData(response.data as unknown as GameTransaction);
                                                setSessionSummaryModalOpen(true);
                                            } else {
                                                // Show full invoice for closed sessions
                                                setCurrentInvoice(response.data as unknown as GameTransaction);
                                                setInvoiceModalOpen(true);
                                            }
                                        }

                                        setToast({
                                            variant: 'success',
                                            title: 'Session started',
                                            message: response?.message || 'Session created successfully'
                                        });
                                        setStartModalOpen(false);
                                        setSelectedRoomId(null);
                                        setSelectedSetId(null);
                                        setSelectedDiscountId(null);
                                        setSelectedClient(null);
                                        setClientResults([]);
                                        setClientPhone('');
                                        setNumberOfPersons(1);
                                        setComment('');

                                        // Refresh invoices list if it's visible
                                        if (showInvoicesSection) {
                                            setShowInvoicesSection(false);
                                            setTimeout(() => setShowInvoicesSection(true), 100);
                                        }
                                    } catch (e: unknown) {
                                        let message = 'Failed to start session';
                                        if (e && typeof e === 'object') {
                                            const maybe = e as { message?: unknown };
                                            if (typeof maybe.message === 'string') message = maybe.message;
                                        }
                                        setToast({ variant: 'error', title: 'Failed', message });
                                    } finally {
                                        setStarting(false);
                                        setTimeout(() => setToast(null), 3000);
                                    }
                                }}
                            >
                                {starting ? <Loader size={14} /> : 'Submit'}
                            </button>
                            <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => { setStartModalOpen(false); setSelectedRoomId(null); setSelectedSetId(null); }}>Cancel</button>
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Invoice Modal */}
            <Modal
                isOpen={invoiceModalOpen}
                onClose={() => {
                    setInvoiceModalOpen(false);
                    setCurrentInvoice(null);
                }}
                title="Invoice"
            >
                <div className="max-h-[80vh] overflow-y-auto">
                    {currentInvoice && <GameInvoice transaction={currentInvoice} />}
                </div>
            </Modal>

            {/* Session Summary Modal (for open sessions - status 7) */}
            <Modal
                isOpen={sessionSummaryModalOpen}
                onClose={() => {
                    setSessionSummaryModalOpen(false);
                    setSessionSummaryData(null);
                }}
                title="Session Started"
            >
                <div className="p-4">
                    {sessionSummaryData && (
                        <div className="space-y-4">
                            <div className="text-center mb-4">
                                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-3">
                                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-semibold text-gray-900">Session Active</h3>
                                <p className="text-sm text-gray-600 mt-1">Your game session has been started successfully</p>
                            </div>

                            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                                <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                                    <span className="text-sm font-medium text-gray-600">Transaction ID:</span>
                                    <span className="text-sm font-semibold text-gray-900">#{sessionSummaryData.id || sessionSummaryData.transactionId}</span>
                                </div>

                                {(sessionSummaryData.room || sessionSummaryData.roomName) && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-medium text-gray-600">Room:</span>
                                        <span className="text-sm font-semibold text-gray-900">{sessionSummaryData.room || sessionSummaryData.roomName}</span>
                                    </div>
                                )}

                                {(sessionSummaryData.set || sessionSummaryData.setName) && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-medium text-gray-600">Set:</span>
                                        <span className="text-sm font-semibold text-gray-900">{sessionSummaryData.set || sessionSummaryData.setName}</span>
                                    </div>
                                )}

                                {(sessionSummaryData.game || sessionSummaryData.gameName) && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-medium text-gray-600">Game:</span>
                                        <span className="text-sm font-semibold text-gray-900">{sessionSummaryData.game || sessionSummaryData.gameName}</span>
                                    </div>
                                )}

                                {(sessionSummaryData.gameType || sessionSummaryData.gameTypeName) && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-medium text-gray-600">Game Type:</span>
                                        <span className="text-sm font-semibold text-gray-900">{sessionSummaryData.gameType || sessionSummaryData.gameTypeName}</span>
                                    </div>
                                )}

                                {(sessionSummaryData.gameSetting || sessionSummaryData.gameSettingName) && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-medium text-gray-600">Setting:</span>
                                        <span className="text-sm font-semibold text-gray-900">{sessionSummaryData.gameSetting || sessionSummaryData.gameSettingName}</span>
                                    </div>
                                )}

                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium text-gray-600">Duration:</span>
                                    <span className="text-sm font-semibold text-gray-900">
                                        {sessionSummaryData.isDayPass ? 'Day Pass' : (sessionSummaryData.hours === 0 ? 'Open Hour' : `${sessionSummaryData.hours}h`)}
                                    </span>
                                </div>

                                {sessionSummaryData.numberOfPersons && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-medium text-gray-600">Persons:</span>
                                        <span className="text-sm font-semibold text-gray-900">{sessionSummaryData.numberOfPersons}</span>
                                    </div>
                                )}

                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium text-gray-600">Started:</span>
                                    <span className="text-sm font-semibold text-gray-900">
                                        {new Date(sessionSummaryData.createdOn).toLocaleString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </span>
                                </div>
                            </div>

                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
                                <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="text-sm text-blue-800">
                                    This is an open session. Close the session to generate the final invoice.
                                </p>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        // Print the session summary using same format as ItemInvoice
                                        const formattedDate = new Date(sessionSummaryData.createdOn).toLocaleString('en-US', {
                                            year: 'numeric',
                                            month: '2-digit',
                                            day: '2-digit',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        });

                                        const win = window.open('', 'PRINT', 'width=420,height=700');
                                        if (!win) return;

                                        win.document.open();
                                        win.document.write(`
                                            <html>
                                                <head>
                                                    <meta charSet="utf-8" />
                                                    <title>Session Started #${sessionSummaryData.id || sessionSummaryData.transactionId}</title>
                                                    <style>
                                                        /* --- POS PAGE: 80mm roll --- */
                                                        @page {
                                                            size: 80mm auto;
                                                            margin: 0 0 18mm 0; /* bottom margin to guarantee extra feed */
                                                        }
                                                        html, body {
                                                            width: 80mm;
                                                            margin: 0;
                                                            padding: 0;
                                                            background: #fff;
                                                            -webkit-print-color-adjust: exact;
                                                            print-color-adjust: exact;
                                                        }

                                                        /* Root container in popup */
                                                        .pos-print {
                                                            width: 76mm !important;          /* safe printable width */
                                                            margin: 0 auto !important;
                                                            padding: 5mm 2mm 16mm !important; /* extra bottom padding */
                                                            box-sizing: border-box !important;
                                                            page-break-inside: avoid !important;
                                                            max-width: none !important;
                                                        }

                                                        /* Larger, receipt-friendly typography */
                                                        .pos-print, .pos-print * {
                                                            font-family: 'Courier New', ui-monospace, Menlo, Consolas, monospace !important;
                                                            font-size: 15px !important;
                                                            line-height: 1.5 !important;
                                                            color: #000 !important;
                                                        }

                                                        .pos-print .text-xs { font-size: 12px !important; }
                                                        .pos-print .text-sm { font-size: 15px !important; }
                                                        .pos-print .text-lg { font-size: 18px !important; }
                                                        .pos-print .text-xl { font-size: 20px !important; }
                                                        .pos-print .text-2xl { font-size: 22px !important; }
                                                        .pos-print .font-bold { font-weight: 700 !important; }
                                                        .pos-print .font-semibold { font-weight: 600 !important; }
                                                        .pos-print .border-b-2 { border-bottom-width: 2px !important; border-color: #000 !important; }
                                                        .pos-print .flex { display: flex !important; }
                                                        .pos-print .justify-between { justify-content: space-between !important; }
                                                        .pos-print .text-center { text-align: center !important; }
                                                        .pos-print .mb-4 { margin-bottom: 8px !important; }
                                                        .pos-print .pb-4 { padding-bottom: 8px !important; }
                                                        .pos-print .mb-2 { margin-bottom: 6px !important; }
                                                        .pos-print .mb-3 { margin-bottom: 8px !important; }
                                                        .pos-print .mt-1 { margin-top: 4px !important; }
                                                        .pos-print .mt-2 { margin-top: 6px !important; }
                                                        .pos-print .space-y-1 > * + * { margin-top: 4px !important; }
                                                        .pos-print button { display: none !important; }

                                                        /* Final spacer in case the driver trims trailing blanks */
                                                        .pos-spacer { height: 20mm; width: 100%; display: block; }
                                                    </style>
                                                </head>
                                                <body>
                                                    <div class="pos-print">
                                                        <!-- Header -->
                                                        <div class="text-center border-b-2 pb-4 mb-4">
                                                            <div class="text-xl font-bold mb-1">SESSION STARTED</div>
                                                            <div class="text-xs">AXIS GAMING</div>
                                                            <div class="text-xs mt-2">${formattedDate}</div>
                                                        </div>

                                                        <!-- Session Details -->
                                                        <div class="border-b-2 pb-4 mb-4">
                                                            <div class="font-bold mb-2">SESSION DETAILS:</div>
                                                            <div class="space-y-1">
                                                                <div class="flex justify-between">
                                                                    <span>Transaction ID:</span>
                                                                    <span class="font-semibold">#${sessionSummaryData.id || sessionSummaryData.transactionId}</span>
                                                                </div>
                                                                ${(sessionSummaryData.room || sessionSummaryData.roomName) ? `
                                                                <div class="flex justify-between">
                                                                    <span>Room:</span>
                                                                    <span class="font-semibold">${sessionSummaryData.room || sessionSummaryData.roomName}</span>
                                                                </div>
                                                                ` : ''}
                                                                ${(sessionSummaryData.set || sessionSummaryData.setName) ? `
                                                                <div class="flex justify-between">
                                                                    <span>Set:</span>
                                                                    <span class="font-semibold">${sessionSummaryData.set || sessionSummaryData.setName}</span>
                                                                </div>
                                                                ` : ''}
                                                                ${(sessionSummaryData.game || sessionSummaryData.gameName) ? `
                                                                <div class="flex justify-between">
                                                                    <span>Game:</span>
                                                                    <span class="font-semibold">${sessionSummaryData.game || sessionSummaryData.gameName}</span>
                                                                </div>
                                                                ` : ''}
                                                                ${(sessionSummaryData.gameType || sessionSummaryData.gameTypeName) ? `
                                                                <div class="flex justify-between">
                                                                    <span>Game Type:</span>
                                                                    <span class="font-semibold">${sessionSummaryData.gameType || sessionSummaryData.gameTypeName}</span>
                                                                </div>
                                                                ` : ''}
                                                                ${(sessionSummaryData.gameSetting || sessionSummaryData.gameSettingName) ? `
                                                                <div class="flex justify-between">
                                                                    <span>Setting:</span>
                                                                    <span class="font-semibold">${sessionSummaryData.gameSetting || sessionSummaryData.gameSettingName}</span>
                                                                </div>
                                                                ` : ''}
                                                                <div class="flex justify-between">
                                                                    <span>Duration:</span>
                                                                    <span class="font-semibold">${sessionSummaryData.isDayPass ? 'Day Pass' : (sessionSummaryData.hours === 0 ? 'Open Hour' : `${sessionSummaryData.hours}h`)}</span>
                                                                </div>
                                                                ${sessionSummaryData.numberOfPersons ? `
                                                                <div class="flex justify-between">
                                                                    <span>Persons:</span>
                                                                    <span class="font-semibold">${sessionSummaryData.numberOfPersons}</span>
                                                                </div>
                                                                ` : ''}
                                                            </div>
                                                        </div>

                                                        <!-- Footer -->
                                                        <div class="text-center text-xs pb-8 mb-4">
                                                            <p class="font-bold">Session Active</p>
                                                            <p class="mt-1">Close session to generate invoice</p>
                                                        </div>
                                                    </div>
                                                    <div class="pos-spacer"></div>
                                                </body>
                                            </html>
                                        `);
                                        win.document.close();

                                        setTimeout(() => { win.focus(); win.print(); win.close(); }, 150);
                                    }}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                    </svg>
                                    Print
                                </button>
                                <button
                                    onClick={() => {
                                        setSessionSummaryModalOpen(false);
                                        setSessionSummaryData(null);
                                    }}
                                    className="flex-1 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition"
                                >
                                    OK
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </Modal>

            {/* Change Calculator */}
            <ChangeCalculator
                isOpen={calculatorOpen}
                onClose={() => setCalculatorOpen(false)}
                totalAmount={0}
            />

            {/* Invoices Section */}
            <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold">My Invoices</h2>
                    <button
                        onClick={() => setShowInvoicesSection(!showInvoicesSection)}
                        className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition"
                    >
                        {showInvoicesSection ? 'Hide Invoices' : 'Show Invoices'}
                    </button>
                </div>

                {showInvoicesSection && (
                    <div className="space-y-4">
                        {/* Info Banner */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                            <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div className="flex-1">
                                <p className="text-sm font-medium text-blue-900">Displaying Recent Invoices</p>
                                <p className="text-sm text-blue-700 mt-1">Showing all invoices from yesterday and today.</p>
                            </div>
                        </div>

                        {/* Total Fees Widget */}
                        <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-lg shadow-lg p-6 text-white">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium opacity-90">Total Fees</p>
                                    <p className="text-3xl font-bold mt-1">${totalInvoices.toFixed(2)}</p>
                                    <p className="text-xs opacity-75 mt-1">Yesterday & Today</p>
                                </div>
                                <div className="bg-white/20 rounded-full p-4">
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        {/* Invoices List */}
                        <div className="bg-white rounded-lg shadow p-6">
                            {loadingInvoices && (
                                <div className="flex justify-center py-10">
                                    <Loader />
                                </div>
                            )}

                            {!loadingInvoices && userInvoices.length === 0 && (
                                <div className="text-center py-10 text-gray-500">
                                    No invoices found
                                </div>
                            )}

                            {!loadingInvoices && userInvoices.length > 0 && (
                                <div className="space-y-4">
                                    {userInvoices.map((invoice) => (
                                        <div
                                            key={invoice.transactionId}
                                            className="border rounded-lg p-4 hover:shadow-md transition cursor-pointer"
                                            onClick={() => {
                                                setCurrentInvoice(invoice);
                                                setInvoiceModalOpen(true);
                                            }}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <span className="text-lg font-semibold text-gray-800">
                                                            Invoice #{invoice.transactionId}
                                                        </span>
                                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${invoice.statusId === STATUS_ENABLED || invoice.statusId === STATUS_PROCESSED_PAID
                                                            ? 'bg-green-100 text-green-800'
                                                            : 'bg-gray-100 text-gray-800'
                                                            }`}>
                                                            {getStatusName(invoice.statusId) || 'Unknown'}
                                                        </span>
                                                    </div>
                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                                        <div>
                                                            <p className="text-gray-500">Date</p>
                                                            <p className="font-medium text-gray-800">
                                                                {new Date(invoice.createdOn).toLocaleDateString()}
                                                            </p>
                                                        </div>
                                                        {invoice.roomName && (
                                                            <div>
                                                                <p className="text-gray-500">Room</p>
                                                                <p className="font-medium text-gray-800">{invoice.roomName}</p>
                                                            </div>
                                                        )}
                                                        {invoice.gameName && (
                                                            <div>
                                                                <p className="text-gray-500">Game</p>
                                                                <p className="font-medium text-gray-800">{invoice.gameName}</p>
                                                            </div>
                                                        )}
                                                        <div>
                                                            <p className="text-gray-500">Durations</p>
                                                            <p className="font-medium text-gray-800">
                                                                {invoice.isDayPass ? 'Day Pass' : (invoice.hours === 0 ? 'Open Hour' : `${invoice.hours}h`)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right ml-4">
                                                    <p className="text-sm text-gray-500">Total</p>
                                                    <p className="text-2xl font-bold text-gray-800">
                                                        ${invoice.totalPrice.toFixed(2)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default GameSession