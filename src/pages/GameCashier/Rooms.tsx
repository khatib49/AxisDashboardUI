import { useEffect, useState } from 'react';
import { Empty, Skeleton } from 'antd';
import { HomeOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import Modal from '../../components/ui/Modal';
import Select from '../../components/form/Select';
import { Pill } from '../../components/ui/PageKit';
import { TillBar, TillButton } from '../../components/till/game/GameTillKit';
import { getRooms, RoomDto } from '../../services/roomsService';
import { getSetAvailability, SetAvailabilityDto } from '../../services/setService';
import { PcIcon, PlayStationIcon } from '../../icons';

export default function GameCashierRooms() {
    const [rooms, setRooms] = useState<RoomDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(12);
    const [totalCount, setTotalCount] = useState<number | null>(null);
    const [selectedRoom, setSelectedRoom] = useState<RoomDto | null>(null);
    const [setAvailability, setSetAvailability] = useState<SetAvailabilityDto | null>(null);
    const [loadingAvailability, setLoadingAvailability] = useState(false);
    const [roomAvailability, setRoomAvailability] = useState<Record<string, number>>({});

    useEffect(() => {
        let mounted = true;
        setLoading(true);
        getRooms(page, pageSize)
            .then(res => {
                if (!mounted) return;
                setRooms(res.data || []);
                setTotalCount(res.totalCount ?? null);
                // Load availability for all rooms (skip open set rooms)
                const availabilityPromises = (res.data || [])
                    .filter(room => !room.isOpenSet)
                    .map(room =>
                        getSetAvailability(Number(room.id), 1)
                            .then(availability => ({ roomId: room.id, availableCount: availability.availableCount }))
                            .catch(() => ({ roomId: room.id, availableCount: 0 }))
                    );
                return Promise.all(availabilityPromises);
            })
            .then(availabilities => {
                if (!mounted || !availabilities) return;
                const availabilityMap: Record<string, number> = {};
                availabilities.forEach(({ roomId, availableCount }) => {
                    availabilityMap[roomId] = availableCount;
                });
                setRoomAvailability(availabilityMap);
            })
            .catch(() => { /* ignore */ })
            .finally(() => { if (mounted) setLoading(false); });
        return () => { mounted = false; };
    }, [page, pageSize]);

    useEffect(() => {
        if (!selectedRoom) {
            setSetAvailability(null);
            return;
        }
        if (selectedRoom.isOpenSet) {
            // Skip loading sets for open set rooms
            setSetAvailability(null);
            return;
        }
        let mounted = true;
        setLoadingAvailability(true);
        const roomIdNum = Number(selectedRoom.id);
        getSetAvailability(roomIdNum, 7)
            .then(res => {
                if (!mounted) return;
                setSetAvailability(res);
            })
            .catch(() => { /* ignore */ })
            .finally(() => { if (mounted) setLoadingAvailability(false); });
        return () => { mounted = false; };
    }, [selectedRoom]);

    return (
        <div className="space-y-5 p-4 sm:p-6">
            <TillBar
                tone="violet"
                icon={<HomeOutlined />}
                title="Rooms"
                meta={totalCount !== null ? <Pill tone="violet" dot>{totalCount} rooms</Pill> : null}
            />

            {loading && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 xl:grid-cols-6" aria-label="Loading rooms...">
                    {Array.from({ length: Math.min(pageSize, 12) }).map((_, i) => (
                        <div key={i} className="h-40 rounded-2xl border border-gray-200/80 bg-white p-4 dark:border-white/[0.06] dark:bg-white/[0.03]">
                            <Skeleton active title={{ width: '70%' }} paragraph={{ rows: 2, width: ['50%', '30%'] }} />
                        </div>
                    ))}
                </div>
            )}

            {!loading && (
                <div>
                    {rooms.length === 0 && (
                        <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-14 dark:border-white/[0.08] dark:bg-white/[0.02]">
                            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No rooms found." />
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 xl:grid-cols-6">
                        {rooms.map(r => {
                            const catName = (r.categoryName || '').toString();
                            const lower = catName.toLowerCase();
                            const isPc = lower.includes('pc');
                            const isPlay = lower.includes('play') || lower.includes('playstation');
                            const availableCount = roomAvailability[r.id] ?? 0;
                            // Display only: a room with no free sets reads as "Full".
                            const full = !r.isOpenSet && availableCount <= 0;
                            return (
                                <button
                                    type="button"
                                    key={r.id}
                                    onClick={() => setSelectedRoom(r)}
                                    className={`flex h-40 flex-col justify-between rounded-2xl border bg-white p-4 text-left shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:shadow-md active:scale-[0.99] dark:bg-white/[0.03] ${
                                        full
                                            ? 'border-red-200 dark:border-red-500/30'
                                            : 'border-gray-200/80 hover:border-violet-300 dark:border-white/[0.06] dark:hover:border-violet-500/40'
                                    }`}
                                >
                                    <div className="flex w-full items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <div className="truncate text-base font-semibold text-gray-900 dark:text-white" title={r.name}>{r.name}</div>
                                            <div className="truncate text-xs text-gray-500 dark:text-gray-400">{r.categoryName ?? r.categoryId}</div>
                                        </div>
                                        <div className="shrink-0 text-gray-500 dark:text-gray-400">
                                            {isPc && <PcIcon className="h-6 w-6" fill="currentColor" aria-hidden />}
                                            {(!isPc && isPlay) && <PlayStationIcon className="h-6 w-6" fill="currentColor" aria-hidden />}
                                        </div>
                                    </div>
                                    {r.isOpenSet ? (
                                        <div>
                                            <Pill tone="emerald" dot>Open Set</Pill>
                                            <div className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">No set management</div>
                                        </div>
                                    ) : (
                                        <div className="flex w-full items-end justify-between gap-2">
                                            <div>
                                                <div className={`text-3xl font-semibold leading-none tabular-nums ${full ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{availableCount}</div>
                                                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">Available Sets</div>
                                            </div>
                                            {full ? <Pill tone="red" dot>Full</Pill> : <Pill tone="emerald" dot>Free</Pill>}
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                        <div className="text-sm tabular-nums text-gray-600 dark:text-gray-400">{totalCount !== null ? `Showing ${rooms.length} of ${totalCount}` : ''}</div>
                        <div className="flex flex-wrap items-center gap-2">
                            <label className="text-sm text-gray-600 dark:text-gray-400">Page size</label>
                            <Select options={[{ value: 6, label: '6' }, { value: 12, label: '12' }, { value: 24, label: '24' }]} defaultValue={pageSize} onChange={(v: string | number) => { setPageSize(Number(v)); setPage(1); }} className="w-24" />
                            <TillButton onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}><LeftOutlined /> Prev</TillButton>
                            <TillButton onClick={() => setPage((p) => p + 1)} disabled={totalCount !== null && page * pageSize >= (totalCount || 0)}>Next <RightOutlined /></TillButton>
                        </div>
                    </div>
                </div>
            )}

            <Modal isOpen={!!selectedRoom} onClose={() => setSelectedRoom(null)} title={selectedRoom ? selectedRoom.name : 'Room'}>
                <div className="space-y-4">
                    <div className="text-sm text-gray-600 dark:text-gray-400">Category: <span className="font-medium text-gray-900 dark:text-white">{selectedRoom?.categoryName ?? selectedRoom?.categoryId}</span></div>
                    {selectedRoom?.isOpenSet && (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                            This is an open set room — no set management required.
                        </div>
                    )}
                    {!selectedRoom?.isOpenSet && loadingAvailability && (
                        <div aria-label="Loading sets...">
                            <Skeleton active title={false} paragraph={{ rows: 3 }} />
                        </div>
                    )}
                    {!selectedRoom?.isOpenSet && !loadingAvailability && setAvailability && (
                        <>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">Sets Availability</div>
                                <div className="flex flex-wrap gap-2">
                                    <Pill tone="emerald" dot>Available ({setAvailability.availableCount})</Pill>
                                    <Pill tone="red" dot>Occupied ({setAvailability.unavailableCount})</Pill>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                                {setAvailability.available.map((set) => (
                                    <div key={set.id} className="flex min-h-14 cursor-default flex-col items-center justify-center rounded-xl border-2 border-emerald-500 bg-emerald-50 px-2 py-2 text-center dark:border-emerald-500/60 dark:bg-emerald-500/10">
                                        <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{set.name}</span>
                                        <span className="text-[10px] font-medium uppercase tracking-wide text-emerald-600/80 dark:text-emerald-400/80">Free</span>
                                    </div>
                                ))}
                                {setAvailability.unavailable.map((set) => (
                                    <div key={set.id} className="flex min-h-14 cursor-not-allowed flex-col items-center justify-center rounded-xl border-2 border-red-400 bg-red-50 px-2 py-2 text-center opacity-70 dark:border-red-500/50 dark:bg-red-500/10">
                                        <span className="text-sm font-semibold text-red-700 dark:text-red-300">{set.name}</span>
                                        <span className="text-[10px] font-medium uppercase tracking-wide text-red-600/80 dark:text-red-400/80">In use</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </Modal>
        </div>
    );
}
