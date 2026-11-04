import React, { useEffect, useMemo, useState } from 'react'
import { getGames, GameDto } from '../../services/gameService';
import { getSettings, GameSettingDto } from '../../services/gameSettingsService';
import { getStatusName, STATUS_DISABLED, STATUS_ENABLED, STATUS_PROCESSED_PAID } from '../../services/statuses';
import Loader from '../../components/ui/Loader';
import Modal from '../../components/ui/Modal';
import Label from '../../components/form/Label';
import Input from '../../components/form/input/InputField';
import Select from '../../components/form/Select';
import Alert from '../../components/ui/alert/Alert';
import { createGameSession, CreateGameSessionResponse } from '../../services/gameSession';
import { OFFLINE_MODE_ENABLED } from '../../offline/flags';
import {
    closeGameSessionOfflineAware,
    createGameSessionOfflineAware,
    listQueuedGameSessions,
    QueuedGameSessionPlaceholder,
} from '../../offline/offlineGames';
import { subscribeQueue } from '../../offline/queue';
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

    // Offline mode (VITE_ENABLE_OFFLINE_MODE): sessions queued on this device
    // while the server was unreachable. Empty and never read when the flag is off.
    const [queuedSessions, setQueuedSessions] = useState<QueuedGameSessionPlaceholder[]>([]);
    const [closingQueuedId, setClosingQueuedId] = useState<number | null>(null);

    const reloadQueuedSessions = React.useCallback(async () => {
        if (!OFFLINE_MODE_ENABLED) return;
        try {
            setQueuedSessions(await listQueuedGameSessions());
        } catch {
            /* no IndexedDB: nothing queued to show */
        }
    }, []);

    useEffect(() => {
        if (!OFFLINE_MODE_ENABLED) return;
        // subscribeQueue fires immediately and on every queue change (enqueue, replay).
        return subscribeQueue(() => { void reloadQueuedSessions(); });
    }, [reloadQueuedSessions]);

    const handleCloseQueuedSession = async (ps: QueuedGameSessionPlaceholder) => {
        setClosingQueuedId(ps.id);
        try {
            const r = await closeGameSessionOfflineAware<CreateGameSessionResponse>(ps.id);
            if (r.queued) {
                setToast({ variant: 'info', title: 'Close queued (offline)', message: 'The session will be closed on the server as soon as the connection is back.' });
            } else if (r.response?.success === false) {
                setToast({ variant: 'error', title: 'Failed', message: r.response.message || r.response.error || 'Failed to close session' });
            } else {
                setToast({ variant: 'success', title: 'Session closed', message: r.response?.message || 'Session closed' });
                if (r.response?.data) {
                    setCurrentInvoice(r.response.data as unknown as GameTransaction);
                    setInvoiceModalOpen(true);
                }
            }
            await reloadQueuedSessions();
        } catch (e: unknown) {
            const message = e && typeof e === 'object' && typeof (e as { message?: unknown }).message === 'string'
                ? (e as { message: string }).message
                : 'Failed to close session';
            setToast({ variant: 'error', title: 'Failed', message });
        } finally {
            setClosingQueuedId(null);
            setTimeout(() => setToast(null), 4000);
        }
    };

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
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-2xl font-semibold text-gray-800 dark:text-white/90">Game Sessions</h1>
                <button
                    onClick={() => setCalculatorOpen(true)}
                    className="px-4 py-2 bg-green-600 text-white rounded shadow hover:bg-green-700 transition flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    Calculator
                </button>
            </div>

            {loading && (
                <div className="flex items-center justify-center py-20">
                    <Loader />
                </div>
            )}

            {error && (
                <div className="text-red-600 bg-red-50 p-3 rounded mb-4 dark:bg-red-500/10 dark:text-red-400">{error}</div>
            )}

            {toast && !startModalOpen && (
                <div className="mb-4">
                    <Alert variant={toast.variant} title={toast.title} message={toast.message} />
                </div>
            )}

            {!loading && !error && (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {games.map((g) => (
                            <div key={g.id} className="border rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition dark:bg-white/[0.03] dark:border-gray-800">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="text-lg font-semibold text-gray-800 dark:text-white/90">{g.name}</div>
                                        <div className="text-sm text-gray-500 dark:text-gray-400">{g.categoryName ?? '—'}</div>
                                    </div>
                                    <div className="text-sm">
                                        {(() => {
                                            // coerce to number for reliable comparisons (API may return strings)
                                            const statusIdNum = g.statusId === null || g.statusId === undefined ? null : Number(g.statusId);
                                            const name = getStatusName(statusIdNum) ?? (g.statusId ?? '-');
                                            if (statusIdNum === STATUS_ENABLED || statusIdNum === STATUS_PROCESSED_PAID) {
                                                return <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-100 text-green-800 text-xs font-medium">{name}</span>;
                                            }
                                            if (statusIdNum === STATUS_DISABLED) {
                                                return <span className="inline-flex items-center px-2 py-1 rounded-full bg-red-100 text-red-800 text-xs font-medium">{name}</span>;
                                            }
                                            // default neutral badge
                                            return <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 text-gray-800 text-xs">{name}</span>;
                                        })()}
                                    </div>
                                </div>

                                <div className="mt-3">
                                    <div className="text-sm font-medium mb-2 text-gray-700 dark:text-white/90">Settings</div>
                                    <div className="space-y-2">
                                        {(settingsByGame.get(g.id) || []).map((s) => (
                                            <div key={s.id} className="flex items-center justify-between p-2 rounded bg-gray-50 dark:bg-white/5">
                                                <div>
                                                    <div className="text-sm font-medium text-gray-800 dark:text-white/90">{s.name}</div>
                                                    <div className="text-xs text-gray-500">
                                                        {s.hours === 0 ? 'Open Hour' : (s.hours ? `${s.hours} hrs` : '')}
                                                        {((s.hours === 0 || s.hours) && s.price) ? ' • ' : ''}
                                                        {s.price ? `$${s.price}` : ''}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <button className="px-2 py-1 bg-blue-600 text-white text-xs rounded" onClick={() => {
                                                        setSelectedSetting(s);
                                                        setStartHours(s.isDayPass ? 0 : (s.hours ?? 1));
                                                        setNumberOfPersons(1);
                                                        setSelectedRoomId(null);
                                                        setSelectedSetId(null);
                                                        setSetAvailability(null);
                                                        setSelectedDiscountId(null);
                                                        setStartModalOpen(true);
                                                    }}>Start</button>
                                                </div>
                                            </div>
                                        ))}
                                        {((settingsByGame.get(g.id) || []).length === 0) && (
                                            <div className="text-sm text-gray-500 dark:text-gray-400">No settings available</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Pagination */}
                    <div className="mt-6 flex items-center justify-between">
                        <div className="text-sm text-gray-600 dark:text-gray-300">{totalCount !== null ? `Showing ${games.length} of ${totalCount}` : ''}</div>
                        <div className="flex items-center gap-2">
                            <button className="px-3 py-1 bg-gray-200 rounded dark:bg-gray-700 dark:text-gray-200" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Prev</button>
                            <div className="text-sm text-gray-700 dark:text-gray-300">Page {page}</div>
                            <button className="px-3 py-1 bg-gray-200 rounded dark:bg-gray-700 dark:text-gray-200" onClick={() => setPage((p) => p + 1)} disabled={totalCount !== null && page * PAGE_SIZE >= (totalCount || 0)}>Next</button>
                        </div>
                    </div>
                </>
            )}
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
                                <div className="flex gap-3 text-xs mb-2 text-gray-700 dark:text-gray-300">
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
                                    className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 transition text-sm dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
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
                                                <div className="text-sm text-gray-600 dark:text-gray-300">${basePrice.toFixed(2)} × {numberOfPersons} person{numberOfPersons !== 1 ? 's' : ''} = ${subtotal.toFixed(2)}</div>
                                                <div className="text-sm text-green-600">Discount ({selectedDiscount.name} - {selectedDiscount.percentage}%): -${discountAmount.toFixed(2)}</div>
                                                <div className="text-lg font-semibold text-gray-800 dark:text-white/90">${total.toFixed(2)}</div>
                                            </div>
                                        ) : (
                                            <div>
                                                <div className="text-sm text-gray-600 mb-1 dark:text-gray-300">${basePrice.toFixed(2)} × {numberOfPersons} person{numberOfPersons !== 1 ? 's' : ''}</div>
                                                <div className="text-lg font-semibold text-gray-800 dark:text-white/90">${subtotal.toFixed(2)}</div>
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
                                        let response: CreateGameSessionResponse | null;
                                        if (OFFLINE_MODE_ENABLED) {
                                            // Same request; queued locally when the server is unreachable.
                                            const r = await createGameSessionOfflineAware<CreateGameSessionResponse>({
                                                gameId: Number(selectedSetting.gameId),
                                                gameSettingId: Number(selectedSetting.id),
                                                hours: startHours,
                                                status: STATUS_ENABLED,
                                                setId: isOpenSetRoom ? undefined : selectedSetId!,
                                                discountId: selectedDiscountId ?? undefined,
                                                userId: selectedClient?.id,
                                                isDayPass: selectedSetting?.isDayPass,
                                                numberOfPersons: numberOfPersons,
                                                comment: comment,
                                            });
                                            if (r.queued) {
                                                setToast({
                                                    variant: 'info',
                                                    title: 'Session queued (offline)',
                                                    message: `The session was saved on this device and will be sent when the connection is back. Estimated total $${r.placeholder.totalPrice.toFixed(2)}.`,
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
                                                await reloadQueuedSessions();
                                                return;
                                            }
                                            response = r.response;
                                        } else {
                                            response = await createGameSession({
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
                                        }

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
                            <button className="px-3 py-1 bg-gray-200 rounded dark:bg-gray-700 dark:text-gray-200" onClick={() => { setStartModalOpen(false); setSelectedRoomId(null); setSelectedSetId(null); }}>Cancel</button>
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
                                <h3 className="text-xl font-semibold text-gray-900 dark:text-white/90">Session Active</h3>
                                <p className="text-sm text-gray-600 mt-1 dark:text-gray-300">Your game session has been started successfully</p>
                            </div>

                            <div className="bg-gray-50 rounded-lg p-4 space-y-3 dark:bg-white/5">
                                <div className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-gray-700">
                                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Transaction ID:</span>
                                    <span className="text-sm font-semibold text-gray-900 dark:text-white/90">#{sessionSummaryData.id || sessionSummaryData.transactionId}</span>
                                </div>

                                {(sessionSummaryData.room || sessionSummaryData.roomName) && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Room:</span>
                                        <span className="text-sm font-semibold text-gray-900 dark:text-white/90">{sessionSummaryData.room || sessionSummaryData.roomName}</span>
                                    </div>
                                )}

                                {(sessionSummaryData.set || sessionSummaryData.setName) && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Set:</span>
                                        <span className="text-sm font-semibold text-gray-900 dark:text-white/90">{sessionSummaryData.set || sessionSummaryData.setName}</span>
                                    </div>
                                )}

                                {(sessionSummaryData.game || sessionSummaryData.gameName) && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Game:</span>
                                        <span className="text-sm font-semibold text-gray-900 dark:text-white/90">{sessionSummaryData.game || sessionSummaryData.gameName}</span>
                                    </div>
                                )}

                                {(sessionSummaryData.gameType || sessionSummaryData.gameTypeName) && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Game Type:</span>
                                        <span className="text-sm font-semibold text-gray-900 dark:text-white/90">{sessionSummaryData.gameType || sessionSummaryData.gameTypeName}</span>
                                    </div>
                                )}

                                {(sessionSummaryData.gameSetting || sessionSummaryData.gameSettingName) && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Setting:</span>
                                        <span className="text-sm font-semibold text-gray-900 dark:text-white/90">{sessionSummaryData.gameSetting || sessionSummaryData.gameSettingName}</span>
                                    </div>
                                )}

                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Duration:</span>
                                    <span className="text-sm font-semibold text-gray-900 dark:text-white/90">
                                        {sessionSummaryData.isDayPass ? 'Day Pass' : (sessionSummaryData.hours === 0 ? 'Open Hour' : `${sessionSummaryData.hours}h`)}
                                    </span>
                                </div>

                                {sessionSummaryData.numberOfPersons && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Persons:</span>
                                        <span className="text-sm font-semibold text-gray-900 dark:text-white/90">{sessionSummaryData.numberOfPersons}</span>
                                    </div>
                                )}

                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Started:</span>
                                    <span className="text-sm font-semibold text-gray-900 dark:text-white/90">
                                        {new Date(sessionSummaryData.createdOn).toLocaleString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </span>
                                </div>
                            </div>

                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2 dark:bg-blue-500/10 dark:border-blue-500/30">
                                <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="text-sm text-blue-800 dark:text-blue-200">
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

            {/* Queued (offline) sessions — only rendered when the offline flag is on and something is queued */}
            {OFFLINE_MODE_ENABLED && queuedSessions.length > 0 && (
                <div className="mt-8">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">Queued sessions (offline)</h2>
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                            {queuedSessions.length} waiting to sync
                        </span>
                    </div>
                    <div className="space-y-3">
                        {queuedSessions.map((ps) => (
                            <div key={ps.opId} data-testid="queued-session" className="border border-amber-300 rounded-lg p-4 bg-amber-50/40 dark:bg-amber-500/5 dark:border-amber-500/40">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="text-lg font-semibold text-gray-800 dark:text-white/90">
                                                Session #offline-{Math.abs(ps.id)}
                                            </span>
                                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                                                {ps.syncStatus === 'failed' ? 'Queued — failing' : 'Queued'}
                                            </span>
                                            {ps.closeQueued && (
                                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-white/10 dark:text-gray-200">Close queued</span>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                            <div>
                                                <p className="text-gray-500 dark:text-gray-400">Queued at</p>
                                                <p className="font-medium text-gray-800 dark:text-white/90">{new Date(ps.createdOn).toLocaleString()}</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-500 dark:text-gray-400">Game</p>
                                                <p className="font-medium text-gray-800 dark:text-white/90">{ps.gameName ?? `#${ps.gameId}`}{ps.gameSettingName ? ` · ${ps.gameSettingName}` : ''}</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-500 dark:text-gray-400">Room / set</p>
                                                <p className="font-medium text-gray-800 dark:text-white/90">{ps.roomName ?? '—'}{ps.setName ? ` / ${ps.setName}` : ps.setId ? ` / set #${ps.setId}` : ''}</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-500 dark:text-gray-400">Duration</p>
                                                <p className="font-medium text-gray-800 dark:text-white/90">
                                                    {ps.isDayPass ? 'Day Pass' : (ps.hours === 0 ? 'Open Hour' : `${ps.hours}h`)} · {ps.numberOfPersons} person{ps.numberOfPersons !== 1 ? 's' : ''}
                                                </p>
                                            </div>
                                        </div>
                                        {ps.lastError && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{ps.lastError}</p>}
                                    </div>
                                    <div className="text-right ml-4">
                                        <p className="text-sm text-gray-500 dark:text-gray-400">{ps.estimated ? 'Estimated total' : 'Total'}</p>
                                        <p className="text-2xl font-bold text-gray-800 dark:text-white/90">${ps.totalPrice.toFixed(2)}</p>
                                        {ps.statusId === 7 && !ps.closeQueued && (
                                            <button
                                                onClick={() => void handleCloseQueuedSession(ps)}
                                                disabled={closingQueuedId === ps.id}
                                                className="mt-2 px-3 py-1 bg-gray-800 text-white text-xs rounded hover:bg-gray-700 disabled:opacity-50 dark:bg-gray-700 dark:hover:bg-gray-600"
                                            >
                                                {closingQueuedId === ps.id ? 'Closing…' : 'Close session'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Invoices Section */}
            <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">My Invoices</h2>
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
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3 dark:bg-blue-500/10 dark:border-blue-500/30">
                            <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div className="flex-1">
                                <p className="text-sm font-medium text-blue-900 dark:text-blue-200">Displaying Recent Invoices</p>
                                <p className="text-sm text-blue-700 mt-1 dark:text-blue-300">Showing all invoices from yesterday and today.</p>
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
                        <div className="bg-white rounded-lg shadow p-6 dark:bg-white/[0.03]">
                            {loadingInvoices && (
                                <div className="flex justify-center py-10">
                                    <Loader />
                                </div>
                            )}

                            {!loadingInvoices && userInvoices.length === 0 && (
                                <div className="text-center py-10 text-gray-500 dark:text-gray-400">
                                    No invoices found
                                </div>
                            )}

                            {!loadingInvoices && userInvoices.length > 0 && (
                                <div className="space-y-4">
                                    {userInvoices.map((invoice) => (
                                        <div
                                            key={invoice.transactionId}
                                            className="border rounded-lg p-4 hover:shadow-md transition cursor-pointer dark:border-gray-800"
                                            onClick={() => {
                                                setCurrentInvoice(invoice);
                                                setInvoiceModalOpen(true);
                                            }}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <span className="text-lg font-semibold text-gray-800 dark:text-white/90">
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
                                                            <p className="text-gray-500 dark:text-gray-400">Date</p>
                                                            <p className="font-medium text-gray-800 dark:text-white/90">
                                                                {new Date(invoice.createdOn).toLocaleDateString()}
                                                            </p>
                                                        </div>
                                                        {invoice.roomName && (
                                                            <div>
                                                                <p className="text-gray-500 dark:text-gray-400">Room</p>
                                                                <p className="font-medium text-gray-800 dark:text-white/90">{invoice.roomName}</p>
                                                            </div>
                                                        )}
                                                        {invoice.gameName && (
                                                            <div>
                                                                <p className="text-gray-500 dark:text-gray-400">Game</p>
                                                                <p className="font-medium text-gray-800 dark:text-white/90">{invoice.gameName}</p>
                                                            </div>
                                                        )}
                                                        <div>
                                                            <p className="text-gray-500 dark:text-gray-400">Durations</p>
                                                            <p className="font-medium text-gray-800 dark:text-white/90">
                                                                {invoice.isDayPass ? 'Day Pass' : (invoice.hours === 0 ? 'Open Hour' : `${invoice.hours}h`)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right ml-4">
                                                    <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
                                                    <p className="text-2xl font-bold text-gray-800 dark:text-white/90">
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