// Cashier Events board
// ====================
// What's on TODAY (big, unmissable), what's coming up, and a quick form to
// book a new event. Cashier-created events land UNPUBLISHED — they show on
// internal boards immediately but reach the public website only after an
// admin reviews and publishes them.

import { useCallback, useEffect, useRef, useState } from "react";
import Modal from "../../components/ui/Modal";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import Select from "../../components/form/Select";
import Loader from "../../components/ui/Loader";
import Alert from "../../components/ui/alert/Alert";
import { getUpcomingEvents, quickCreateEvent } from "../../services/eventService";
import type { EventDto } from "../../services/eventService";
import {
    getAttendees, checkInTicket, undoCheckIn, confirmCashTicket, extractTicketCode,
} from "../../services/eventTicketService";
import type { EventAttendeeList, CheckInResult } from "../../services/eventTicketService";

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

    // Door drawer (check-in) — which event is open
    const [doorEvent, setDoorEvent] = useState<EventDto | null>(null);

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
            <button
                type="button"
                onClick={() => setDoorEvent(e)}
                className={`mt-3 w-full rounded-xl font-semibold transition ${big
                    ? "h-10 bg-indigo-600 text-white hover:bg-indigo-700 text-sm"
                    : "h-9 border border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs"}`}
            >
                🎟 Door — check in
            </button>
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

            {doorEvent && (
                <DoorDrawer
                    event={doorEvent}
                    onClose={() => { setDoorEvent(null); load(); }}
                    notify={(variant, title, message) => setNotification({ variant, title, message })}
                />
            )}

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

// ── Door drawer: scan / check in / attendee list ─────────────────────────
type ScanLog = { at: Date; code: string; result: CheckInResult };

const OUTCOME_STYLE: Record<string, { box: string; icon: string; title: string }> = {
    ok:          { box: "bg-green-600 text-white",  icon: "✓", title: "Checked in" },
    already:     { box: "bg-amber-500 text-white",  icon: "↺", title: "Already checked in" },
    unpaid:      { box: "bg-red-600 text-white",    icon: "✕", title: "Not paid" },
    not_found:   { box: "bg-red-600 text-white",    icon: "?", title: "Ticket not found" },
    wrong_event: { box: "bg-red-600 text-white",    icon: "✕", title: "Wrong event" },
    rejected:    { box: "bg-red-600 text-white",    icon: "✕", title: "Rejected" },
};

const PAY_PILL: Record<string, string> = {
    Paid: "bg-green-100 text-green-700",
    Pending: "bg-amber-100 text-amber-700",
    Rejected: "bg-red-100 text-red-700",
    Refunded: "bg-gray-100 text-gray-600",
};

const timeOf = (iso?: string | null) => iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";

function DoorDrawer({ event, onClose, notify }: {
    event: EventDto;
    onClose: () => void;
    notify: (variant: "success" | "error", title: string, message: string) => void;
}) {
    const [list, setList] = useState<EventAttendeeList | null>(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [scan, setScan] = useState("");
    const [scanning, setScanning] = useState(false);
    const [last, setLast] = useState<ScanLog | null>(null);
    const [log, setLog] = useState<ScanLog[]>([]);
    const [busyId, setBusyId] = useState<number | null>(null);
    const scanRef = useRef<HTMLInputElement>(null);
    const searchRef = useRef("");
    searchRef.current = search;

    // Reloads with the current search box value; identity is stable so the
    // initial-load effect runs once per event.
    const reload = useCallback(async (q?: string) => {
        try {
            setList(await getAttendees(event.key, q ?? searchRef.current));
        } catch {
            notify("error", "Load failed", "Could not load the attendee list.");
        } finally {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [event.key]);

    useEffect(() => { reload(); }, [reload]);

    // Focus the scan box on open and keep it focused (USB scanners type into it).
    useEffect(() => { scanRef.current?.focus(); }, []);
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    const doScan = async (raw: string) => {
        const code = extractTicketCode(raw);
        if (!code || scanning) return;
        setScanning(true);
        try {
            const result = await checkInTicket(code, event.key);
            const entry: ScanLog = { at: new Date(), code, result };
            setLast(entry);
            setLog((l) => [entry, ...l].slice(0, 5));
            await reload();
        } catch {
            const result: CheckInResult = { ok: false, outcome: "error", message: "Could not reach the server. Try again." };
            setLast({ at: new Date(), code, result });
        } finally {
            setScanning(false);
            setScan("");
            window.setTimeout(() => scanRef.current?.focus(), 0);
        }
    };

    const rowAction = async (id: number, fn: () => Promise<void>, okMsg: string) => {
        setBusyId(id);
        try {
            await fn();
            notify("success", "Done", okMsg);
            await reload();
        } catch {
            notify("error", "Action failed", "Could not update this registration.");
        } finally {
            setBusyId(null);
            scanRef.current?.focus();
        }
    };

    const style = last ? (OUTCOME_STYLE[last.result.outcome] ?? { box: "bg-gray-700 text-white", icon: "!", title: "Error" }) : null;
    const lastName = last?.result.ticket ? `${last.result.ticket.firstName} ${last.result.ticket.lastName}` : null;

    return (
        <div className="fixed inset-0 z-[99998] flex justify-end bg-black/40" onClick={onClose}>
            <div
                className="h-full w-full sm:w-[560px] bg-white shadow-2xl flex flex-col"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-label={`Door — ${event.title}`}
            >
                {/* Header + counters */}
                <div className="px-5 py-4 border-b border-gray-100">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="text-[11px] uppercase tracking-wide text-indigo-600 font-bold">Door check-in</div>
                            <div className="text-lg font-bold text-gray-900 truncate">{list?.eventTitle ?? event.title}</div>
                            <div className="text-xs text-gray-500">
                                {event.eventDate ? new Date(event.eventDate).toLocaleString([], { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                                {event.location ? ` · ${event.location}` : ""}
                            </div>
                        </div>
                        <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none" aria-label="Close">✕</button>
                    </div>
                    <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                        <Counter label="Paid" value={list?.paid ?? 0} tone="text-green-700 bg-green-50" />
                        <Counter label="Pending" value={list?.pending ?? 0} tone="text-amber-700 bg-amber-50" />
                        <Counter label="Checked in" value={list?.checkedIn ?? 0} tone="text-indigo-700 bg-indigo-50" />
                        <Counter label="Capacity" value={list?.capacity ?? event.capacity ?? "∞"} tone="text-gray-700 bg-gray-50" />
                    </div>
                </div>

                {/* Scan box */}
                <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
                    <form onSubmit={(e) => { e.preventDefault(); doScan(scan); }} className="flex gap-2">
                        <input
                            ref={scanRef}
                            value={scan}
                            onChange={(e) => setScan(e.target.value)}
                            placeholder="Scan QR or type ticket code (TK-…)"
                            autoFocus
                            autoComplete="off"
                            autoCapitalize="characters"
                            spellCheck={false}
                            className="flex-1 h-12 rounded-xl border border-gray-300 px-4 font-mono text-base uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <button type="submit" disabled={scanning || !scan.trim()}
                            className="h-12 px-5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50">
                            {scanning ? "…" : "Check in"}
                        </button>
                    </form>

                    {last && style && (
                        <div className={`mt-3 rounded-2xl px-4 py-4 ${style.box}`}>
                            <div className="flex items-center gap-3">
                                <div className="h-12 w-12 shrink-0 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold">{style.icon}</div>
                                <div className="min-w-0">
                                    <div className="text-lg font-bold leading-tight">{style.title}{lastName ? ` — ${lastName}` : ""}</div>
                                    <div className="text-sm opacity-90">{last.result.message}</div>
                                    <div className="text-[11px] opacity-75 font-mono mt-0.5">{last.code} · {timeOf(last.at.toISOString())}</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {log.length > 1 && (
                        <div className="mt-2 space-y-0.5">
                            {log.slice(1).map((l, i) => (
                                <div key={i} className="flex items-center gap-2 text-[11px] text-gray-500">
                                    <span className={`h-2 w-2 rounded-full ${l.result.outcome === "ok" ? "bg-green-500" : l.result.outcome === "already" ? "bg-amber-500" : "bg-red-500"}`} />
                                    <span className="font-mono">{l.code}</span>
                                    <span className="truncate">{l.result.ticket ? `${l.result.ticket.firstName} ${l.result.ticket.lastName} · ` : ""}{l.result.message}</span>
                                    <span className="ml-auto shrink-0">{timeOf(l.at.toISOString())}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Attendee list */}
                <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") reload(search); }}
                        placeholder="Search name, phone or code…"
                        className="flex-1 h-10 rounded-xl border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button type="button" onClick={() => reload(search)} className="h-10 px-3 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50">Search</button>
                </div>

                <div className="flex-1 overflow-auto">
                    {loading && <div className="flex justify-center py-10"><Loader /></div>}
                    {!loading && list && list.attendees.length === 0 && (
                        <div className="py-10 text-center text-sm text-gray-400">No registrations{search ? " match your search" : " yet"}.</div>
                    )}
                    {!loading && list && list.attendees.map((a) => {
                        const canCheckIn = a.paymentStatus === "Paid" && !a.checkedInOn;
                        const busy = busyId === a.id;
                        return (
                            <div key={a.id} className={`px-5 py-3 border-b border-gray-50 flex items-center gap-3 ${a.checkedInOn ? "bg-indigo-50/40" : ""}`}>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-gray-900 truncate">{a.firstName} {a.lastName}</span>
                                        <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold ${PAY_PILL[a.paymentStatus] ?? "bg-gray-100 text-gray-600"}`}>{a.paymentStatus}</span>
                                        {a.checkedInOn && <span className="shrink-0 text-[10px] text-indigo-700 font-semibold">✓ {timeOf(a.checkedInOn)}</span>}
                                    </div>
                                    <div className="text-xs text-gray-500 flex flex-wrap gap-x-2">
                                        <span>{a.phone}</span>
                                        <span className="font-mono">{a.ticketCode}</span>
                                        <span>{a.paymentMethod} · {a.currency === "USD" ? "$" : a.currency + " "}{a.amount.toFixed(2)}</span>
                                    </div>
                                </div>
                                <div className="shrink-0 flex gap-1.5">
                                    {canCheckIn && (
                                        <button type="button" disabled={busy}
                                            onClick={() => rowAction(a.id, async () => {
                                                const r = await checkInTicket(a.ticketCode, event.key);
                                                if (!r.ok) throw new Error(r.message);
                                            }, `${a.firstName} ${a.lastName} checked in.`)}
                                            className="h-8 px-3 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50">
                                            Check in
                                        </button>
                                    )}
                                    {a.checkedInOn && (
                                        <button type="button" disabled={busy}
                                            onClick={() => rowAction(a.id, () => undoCheckIn(a.id), "Check-in undone.")}
                                            className="h-8 px-3 rounded-lg border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50 disabled:opacity-50">
                                            Undo
                                        </button>
                                    )}
                                    {a.paymentStatus === "Pending" && (
                                        <button type="button" disabled={busy}
                                            onClick={() => {
                                                if (!window.confirm(`Confirm ${a.currency === "USD" ? "$" : a.currency + " "}${a.amount.toFixed(2)} cash received from ${a.firstName} ${a.lastName}?`)) return;
                                                rowAction(a.id, () => confirmCashTicket(a.id), `${a.firstName} ${a.lastName} marked as paid (cash).`);
                                            }}
                                            className="h-8 px-3 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 disabled:opacity-50">
                                            Confirm cash
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="px-5 py-2 border-t border-gray-100 text-[11px] text-gray-400">
                    Scanner or keyboard: type the code and press Enter. Esc closes.
                </div>
            </div>
        </div>
    );
}

function Counter({ label, value, tone }: { label: string; value: number | string; tone: string }) {
    return (
        <div className={`rounded-xl py-2 ${tone}`}>
            <div className="text-xl font-bold leading-tight">{value}</div>
            <div className="text-[10px] uppercase tracking-wide opacity-80">{label}</div>
        </div>
    );
}
