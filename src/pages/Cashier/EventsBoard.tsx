// Cashier Events board
// ====================
// What's on TODAY (big, unmissable), what's coming up, and a quick form to
// book a new event. Cashier-created events land UNPUBLISHED — they show on
// internal boards immediately but reach the public website only after an
// admin reviews and publishes them.

import { useEffect, useState } from "react";
import Modal from "../../components/ui/Modal";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import Select from "../../components/form/Select";
import Loader from "../../components/ui/Loader";
import Alert from "../../components/ui/alert/Alert";
import { getUpcomingEvents, quickCreateEvent, EventDto } from "../../services/eventService";

const EVENT_TYPES = ["PS5 Session", "Board Games", "Billiards", "TCG Event", "Social Event", "Tournament", "Other"];

const TYPE_STYLES: Record<string, string> = {
    "PS5 Session": "bg-violet-100 text-violet-700",
    "Board Games": "bg-amber-100 text-amber-700",
    "Billiards": "bg-green-100 text-green-700",
    "TCG Event": "bg-purple-100 text-purple-700",
    "Social Event": "bg-pink-100 text-pink-700",
    "Tournament": "bg-blue-100 text-blue-700",
    "Other": "bg-gray-100 text-gray-600",
};

const isToday = (iso: string) => {
    const d = new Date(iso), n = new Date();
    return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
};

export default function EventsBoard() {
    const [events, setEvents] = useState<EventDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [notification, setNotification] = useState<{ variant: "success" | "error"; title: string; message: string } | null>(null);

    // Quick-create form
    const [formOpen, setFormOpen] = useState(false);
    const [title, setTitle] = useState("");
    const [type, setType] = useState("Other");
    const [date, setDate] = useState("");     // datetime-local
    const [location, setLocation] = useState("");
    const [price, setPrice] = useState<string>("");
    const [capacity, setCapacity] = useState<string>("");
    const [saving, setSaving] = useState(false);

    const load = () => {
        setLoading(true);
        getUpcomingEvents(21)
            .then(setEvents)
            .catch(() => setNotification({ variant: "error", title: "Load failed", message: "Could not load events." }))
            .finally(() => setLoading(false));
    };
    useEffect(load, []);

    useEffect(() => {
        if (!notification) return;
        const t = setTimeout(() => setNotification(null), 4000);
        return () => clearTimeout(t);
    }, [notification]);

    const todays = events.filter(e => e.eventDate && isToday(e.eventDate));
    const upcoming = events.filter(e => e.eventDate && !isToday(e.eventDate));

    const submit = async () => {
        if (!title.trim()) { setNotification({ variant: "error", title: "Missing title", message: "Give the event a name." }); return; }
        setSaving(true);
        try {
            await quickCreateEvent({
                title: title.trim(),
                type,
                eventDate: date ? new Date(date).toISOString() : null,
                location: location.trim() || null,
                price: Number(price) || 0,
                capacity: capacity ? Number(capacity) : null,
            });
            setNotification({ variant: "success", title: "Event booked", message: "It's on the board — an admin can publish it to the website." });
            setFormOpen(false);
            setTitle(""); setType("Other"); setDate(""); setLocation(""); setPrice(""); setCapacity("");
            load();
        } catch {
            setNotification({ variant: "error", title: "Create failed", message: "Could not create the event." });
        } finally { setSaving(false); }
    };

    const EventCard = ({ e, big }: { e: EventDto; big?: boolean }) => (
        <div className={`rounded-2xl border bg-white shadow-sm p-4 ${big ? "border-indigo-200 ring-2 ring-indigo-100" : "border-gray-100"}`}>
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <div className={`font-semibold text-gray-900 ${big ? "text-lg" : "text-sm"} truncate`}>{e.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                        {e.eventDate ? new Date(e.eventDate).toLocaleString([], { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                        {e.location ? ` · ${e.location}` : ""}
                    </div>
                </div>
                <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold ${TYPE_STYLES[e.type ?? "Other"] ?? TYPE_STYLES.Other}`}>
                    {e.type ?? "Other"}
                </span>
            </div>
            <div className="mt-2 flex items-center gap-3 text-sm">
                {e.price > 0 && <span className="font-bold text-gray-900">${e.price}</span>}
                <span className="text-indigo-600 font-medium">
                    🎟 {e.paidCount}{e.capacity ? ` / ${e.capacity}` : ""} sold
                </span>
                {!e.isPublished && (
                    <span className="ml-auto px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-100 text-orange-700" title="Not on the website yet — waiting for admin to publish">
                        Internal
                    </span>
                )}
            </div>
        </div>
    );

    return (
        <div className="p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900">Events</h1>
                    <p className="text-sm text-gray-500 mt-0.5">What's on today and coming up. Booked here = internal until admin publishes.</p>
                </div>
                <button
                    onClick={() => setFormOpen(true)}
                    className="h-10 px-4 bg-indigo-600 text-white rounded-xl shadow-sm hover:bg-indigo-700 transition text-sm font-semibold"
                >
                    + New Event
                </button>
            </div>

            {loading && <div className="flex justify-center py-16"><Loader /></div>}

            {!loading && (
                <>
                    <div className="mb-6">
                        <h2 className="text-sm font-bold uppercase tracking-wide text-indigo-700 mb-2">🎟 Today</h2>
                        {todays.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-gray-200 py-6 text-center text-sm text-gray-400">
                                Nothing scheduled today.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {todays.map(e => <EventCard key={e.id} e={e} big />)}
                            </div>
                        )}
                    </div>

                    <div>
                        <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-2">Coming up</h2>
                        {upcoming.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-gray-200 py-6 text-center text-sm text-gray-400">
                                No upcoming events in the next 3 weeks.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                {upcoming.map(e => <EventCard key={e.id} e={e} />)}
                            </div>
                        )}
                    </div>
                </>
            )}

            <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} title="Book a new event">
                <div className="space-y-3">
                    <div>
                        <Label>Title</Label>
                        <Input placeholder="Catan Tournament" value={title} onChange={(e) => setTitle(e.target.value)} />
                    </div>
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <Label>Type</Label>
                            <Select options={EVENT_TYPES.map(t => ({ value: t, label: t }))} defaultValue={type} onChange={(v) => setType(String(v))} />
                        </div>
                        <div className="flex-1">
                            <Label>Date & time</Label>
                            <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
                        </div>
                    </div>
                    <div>
                        <Label>Location (optional)</Label>
                        <Input placeholder="Board Game Room, Floor 2" value={location} onChange={(e) => setLocation(e.target.value)} />
                    </div>
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <Label>Ticket price ($)</Label>
                            <Input type="number" min="0" step={1} placeholder="15" value={price} onChange={(e) => setPrice(e.target.value)} />
                        </div>
                        <div className="flex-1">
                            <Label>Capacity (optional)</Label>
                            <Input type="number" min="0" step={1} placeholder="24" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
                        </div>
                    </div>
                    <p className="text-xs text-gray-500">
                        The event appears on the internal boards right away. Publishing to the public website stays with the admin.
                    </p>
                    <button
                        onClick={submit}
                        disabled={saving}
                        className="w-full h-10 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"
                    >
                        {saving ? "Booking…" : "Book event"}
                    </button>
                </div>
            </Modal>

            <div className="fixed bottom-6 right-6 z-50">
                {notification && (
                    <div className="max-w-sm">
                        <Alert variant={notification.variant} title={notification.title} message={notification.message} />
                    </div>
                )}
            </div>
        </div>
    );
}
