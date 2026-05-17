import { useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal';
import Select from '../../components/form/Select';
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
        <div className="p-6">
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-2xl font-semibold">Rooms</h1>
            </div>

            {loading && <div className="text-gray-600">Loading rooms...</div>}

            {!loading && (
                <div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {rooms.map(r => {
                            const catName = (r.categoryName || '').toString();
                            const lower = catName.toLowerCase();
                            const isPc = lower.includes('pc');
                            const isPlay = lower.includes('play') || lower.includes('playstation');
                            const availableCount = roomAvailability[r.id] ?? 0;
                            return (
                                <div key={r.id} className="bg-white rounded-lg shadow-sm p-3 hover:shadow-md transition flex flex-col justify-between cursor-pointer" onClick={() => setSelectedRoom(r)}>
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <div className="text-base font-medium">{r.name}</div>
                                            <div className="text-xs text-gray-500">{r.categoryName ?? r.categoryId}</div>
                                        </div>
                                        <div className="ml-2">
                                            {isPc && <PcIcon className="w-5 h-5 text-gray-600" />}
                                            {(!isPc && isPlay) && <PlayStationIcon className="w-5 h-5 text-gray-600" />}
                                        </div>
                                    </div>
                                    <div className="mt-3 text-sm text-gray-600">
                                        {r.isOpenSet ? (
                                            <span className="font-semibold text-green-600">Open Set</span>
                                        ) : (
                                            <>Available Sets: <span className="font-semibold text-green-600">{availableCount}</span></>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-4 p-2 flex items-center justify-between">
                        <div className="text-sm text-gray-600">{totalCount !== null ? `Showing ${rooms.length} of ${totalCount}` : ''}</div>
                        <div className="flex items-center gap-2">
                            <label className="text-sm text-gray-600">Page size</label>
                            <Select options={[{ value: 6, label: '6' }, { value: 12, label: '12' }, { value: 24, label: '24' }]} defaultValue={pageSize} onChange={(v: string | number) => { setPageSize(Number(v)); setPage(1); }} className="w-24" />
                            <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Prev</button>
                            <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => setPage((p) => p + 1)} disabled={totalCount !== null && page * pageSize >= (totalCount || 0)}>Next</button>
                        </div>
                    </div>
                </div>
            )}

            <Modal isOpen={!!selectedRoom} onClose={() => setSelectedRoom(null)} title={selectedRoom ? selectedRoom.name : 'Room'}>
                <div className="space-y-4">
                    <div className="text-sm text-gray-600">Category: {selectedRoom?.categoryName ?? selectedRoom?.categoryId}</div>
                    {selectedRoom?.isOpenSet && (
                        <div className="text-sm text-green-600 bg-green-50 p-3 rounded">
                            This is an open set room — no set management required.
                        </div>
                    )}
                    {!selectedRoom?.isOpenSet && loadingAvailability && <div className="text-sm text-gray-500">Loading sets...</div>}
                    {!selectedRoom?.isOpenSet && !loadingAvailability && setAvailability && (
                        <>
                            <div className="text-sm font-medium text-gray-700">Sets Availability:</div>
                            <div className="flex gap-4 text-xs mb-2">
                                <div className="flex items-center gap-1">
                                    <div className="w-4 h-4 bg-green-100 border-2 border-green-500 rounded"></div>
                                    <span>Available ({setAvailability.availableCount})</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="w-4 h-4 bg-red-100 border-2 border-red-500 rounded"></div>
                                    <span>Occupied ({setAvailability.unavailableCount})</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-6 gap-2">
                                {setAvailability.available.map((set) => (
                                    <div key={set.id} className="px-2 py-2 rounded-lg border-2 border-green-500 bg-green-50 text-center text-sm font-medium text-green-700 cursor-default">
                                        {set.name}
                                    </div>
                                ))}
                                {setAvailability.unavailable.map((set) => (
                                    <div key={set.id} className="px-2 py-2 rounded-lg border-2 border-red-500 bg-red-50 text-center text-sm font-medium text-red-700 cursor-not-allowed opacity-60">
                                        {set.name}
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
