// Cashier Events board
// ====================
// What's on TODAY (big, unmissable), what's coming up, and a quick form to
// book a new event. Cashier-created events land UNPUBLISHED — they show on
// internal boards immediately but reach the public website only after an
// admin reviews and publishes them.

import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarOutlined, CloseOutlined, PlusOutlined, SearchOutlined } from "@ant-design/icons";
import Modal from "../../components/ui/Modal";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import Select from "../../components/form/Select";
import Alert from "../../components/ui/alert/Alert";
import { Pill } from "../../components/ui/PageKit";
import { CardSkeletons, CountTile, DeskEmpty, DeskHeader, DeskSection } from "../../components/till/desk/DeskKit";
import { EventCard } from "../../components/till/desk/EventCard";
import { deskBtn, deskInput } from "../../components/till/desk/deskStyles";
import { getUpcomingEvents, quickCreateEvent } from "../../services/eventService";
import type { EventDto } from "../../services/eventService";
import {
    getAttendees, checkInTicket, undoCheckIn, confirmCashTicket, extractTicketCode,
} from "../../services/eventTicketService";
import type { EventAttendeeList, CheckInResult } from "../../services/eventTicketService";

const EVENT_TYPES = ["PS5 Session", "Board Games", "Billiards", "TCG Event", "Social Event", "Tournament", "Other"];

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

    return (
        <div className="space-y-5 p-3 sm:p-6">
            <DeskHeader
                icon={<CalendarOutlined />}
                title="Events"
                description="What's on today and coming up. Booked here = internal until admin publishes."
                actions={
                    <button onClick={() => setFormOpen(true)} className={deskBtn("primary")}>
                        <PlusOutlined /> New Event
                    </button>
                }
            />

            {loading && (
                <>
                    <CardSkeletons count={3} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" height={190} />
                    <CardSkeletons count={4} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" height={170} />
                </>
            )}

            {!loading && (
                <>
                    <DeskSection title="🎟 Today" count={todays.length} tone="violet">
                        {todays.length === 0 ? (
                            <DeskEmpty compact title="Nothing scheduled today." />
                        ) : (
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {todays.map(e => <EventCard key={e.id} e={e} big onDoor={setDoorEvent} />)}
                            </div>
                        )}
                    </DeskSection>

                    <DeskSection title="Coming up" count={upcoming.length}>
                        {upcoming.length === 0 ? (
                            <DeskEmpty compact title="No upcoming events in the next 3 weeks." />
                        ) : (
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                {upcoming.map(e => <EventCard key={e.id} e={e} onDoor={setDoorEvent} />)}
                            </div>
                        )}
                    </DeskSection>
                </>
            )}

            <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} title="Book a new event">
                <div className="space-y-3">
                    <div>
                        <Label>Title</Label>
                        <Input placeholder="Catan Tournament" value={title} onChange={(e) => setTitle(e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:gap-2">
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
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        The event appears on the internal boards right away. Publishing to the public website stays with the admin.
                    </p>
                    <button
                        onClick={submit}
                        disabled={saving}
                        className={`${deskBtn("primary", "lg")} w-full`}
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

const PAY_PILL: Record<string, "emerald" | "amber" | "red" | "gray"> = {
    Paid: "emerald",
    Pending: "amber",
    Rejected: "red",
    Refunded: "gray",
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
                className="flex h-full w-full flex-col bg-white shadow-2xl sm:w-[600px] dark:bg-gray-900"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-label={`Door — ${event.title}`}
            >
                {/* Header + counters */}
                <div className="border-b border-gray-100 px-4 py-4 sm:px-5 dark:border-white/[0.06]">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="text-[11px] font-bold uppercase tracking-wide text-violet-600 dark:text-violet-300">Door check-in</div>
                            <div className="truncate text-lg font-bold text-gray-900 dark:text-white">{list?.eventTitle ?? event.title}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                {event.eventDate ? new Date(event.eventDate).toLocaleString([], { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                                {event.location ? ` · ${event.location}` : ""}
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-white/[0.06] dark:hover:text-gray-200"
                            aria-label="Close"
                        >
                            <CloseOutlined />
                        </button>
                    </div>
                    <div className="mt-3 grid grid-cols-4 gap-2">
                        <CountTile label="Paid" value={list?.paid ?? 0} tone="emerald" />
                        <CountTile label="Pending" value={list?.pending ?? 0} tone="amber" />
                        <CountTile label="Checked in" value={list?.checkedIn ?? 0} tone="violet" />
                        <CountTile label="Capacity" value={list?.capacity ?? event.capacity ?? "∞"} tone="gray" />
                    </div>
                </div>

                {/* Scan box */}
                <div className="border-b border-gray-100 bg-gray-50 px-4 py-4 sm:px-5 dark:border-white/[0.06] dark:bg-white/[0.02]">
                    <form onSubmit={(e) => { e.preventDefault(); doScan(scan); }} className="flex gap-2">
                        <input
                            ref={scanRef}
                            value={scan}
                            onChange={(e) => setScan(e.target.value)}
                            placeholder="Scan QR or type ticket code (TK-…)"
                            aria-label="Ticket code"
                            autoFocus
                            autoComplete="off"
                            autoCapitalize="characters"
                            spellCheck={false}
                            className="h-14 min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-4 font-mono text-lg uppercase text-gray-900 placeholder:text-sm placeholder:normal-case focus:outline-none focus:ring-2 focus:ring-violet-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-gray-500"
                        />
                        <button type="submit" disabled={scanning || !scan.trim()} className={`${deskBtn("primary", "lg")} min-h-14!`}>
                            {scanning ? "…" : "Check in"}
                        </button>
                    </form>

                    {last && style && (
                        <div role="status" className={`mt-3 rounded-2xl px-4 py-4 ${style.box}`}>
                            <div className="flex items-center gap-3">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/20 text-2xl font-bold">{style.icon}</div>
                                <div className="min-w-0">
                                    <div className="text-lg font-bold leading-tight">{style.title}{lastName ? ` — ${lastName}` : ""}</div>
                                    <div className="text-sm opacity-90">{last.result.message}</div>
                                    <div className="mt-0.5 font-mono text-[11px] opacity-75">{last.code} · {timeOf(last.at.toISOString())}</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {log.length > 1 && (
                        <div className="mt-2 space-y-0.5">
                            {log.slice(1).map((l, i) => (
                                <div key={i} className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                    <span className={`h-2 w-2 shrink-0 rounded-full ${l.result.outcome === "ok" ? "bg-green-500" : l.result.outcome === "already" ? "bg-amber-500" : "bg-red-500"}`} />
                                    <span className="font-mono">{l.code}</span>
                                    <span className="truncate">{l.result.ticket ? `${l.result.ticket.firstName} ${l.result.ticket.lastName} · ` : ""}{l.result.message}</span>
                                    <span className="ml-auto shrink-0">{timeOf(l.at.toISOString())}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Attendee list */}
                <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 sm:px-5 dark:border-white/[0.06]">
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") reload(search); }}
                        placeholder="Search name, phone or code…"
                        aria-label="Search registrations"
                        className={`${deskInput} flex-1`}
                    />
                    <button type="button" onClick={() => reload(search)} className={deskBtn("outline")}>
                        <SearchOutlined /> Search
                    </button>
                </div>

                <div className="flex-1 overflow-auto">
                    {loading && <div className="px-5 py-4"><CardSkeletons count={4} className="space-y-2" height={72} /></div>}
                    {!loading && list && list.attendees.length === 0 && (
                        <div className="py-10 text-center text-sm text-gray-400 dark:text-gray-500">No registrations{search ? " match your search" : " yet"}.</div>
                    )}
                    {!loading && list && list.attendees.map((a) => {
                        const canCheckIn = a.paymentStatus === "Paid" && !a.checkedInOn;
                        const busy = busyId === a.id;
                        const amount = `${a.currency === "USD" ? "$" : a.currency + " "}${a.amount.toFixed(2)}`;
                        return (
                            <div
                                key={a.id}
                                className={`flex flex-col gap-2 border-b border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:gap-3 sm:px-5 dark:border-white/[0.04] ${a.checkedInOn ? "bg-violet-50/50 dark:bg-violet-500/[0.06]" : ""}`}
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="truncate text-base font-semibold text-gray-900 dark:text-white">{a.firstName} {a.lastName}</span>
                                        <Pill tone={PAY_PILL[a.paymentStatus] ?? "gray"} dot>{a.paymentStatus}</Pill>
                                        {a.checkedInOn && <Pill tone="violet" dot>✓ Checked in {timeOf(a.checkedInOn)}</Pill>}
                                    </div>
                                    <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-gray-500 dark:text-gray-400">
                                        <span className="tabular-nums">{a.phone}</span>
                                        <span className="font-mono">{a.ticketCode}</span>
                                        {a.ticketTypeName && <span className="font-semibold text-gray-800 dark:text-gray-200">{a.ticketTypeName}</span>}
                                        <span>{a.paymentMethod} · <b className="tabular-nums text-gray-800 dark:text-gray-200">{amount}</b></span>
                                    </div>
                                </div>
                                <div className="flex shrink-0 gap-2">
                                    {canCheckIn && (
                                        <button type="button" disabled={busy}
                                            onClick={() => rowAction(a.id, async () => {
                                                const r = await checkInTicket(a.ticketCode, event.key);
                                                if (!r.ok) throw new Error(r.message);
                                            }, `${a.firstName} ${a.lastName} checked in.`)}
                                            className={`${deskBtn("primary")} flex-1 sm:flex-none`}>
                                            Check in
                                        </button>
                                    )}
                                    {a.checkedInOn && (
                                        <button type="button" disabled={busy}
                                            onClick={() => rowAction(a.id, () => undoCheckIn(a.id), "Check-in undone.")}
                                            className={`${deskBtn("outline")} flex-1 sm:flex-none`}>
                                            Undo
                                        </button>
                                    )}
                                    {a.paymentStatus === "Pending" && (
                                        <button type="button" disabled={busy}
                                            onClick={() => {
                                                if (!window.confirm(`Confirm ${a.currency === "USD" ? "$" : a.currency + " "}${a.amount.toFixed(2)} cash received from ${a.firstName} ${a.lastName}?`)) return;
                                                rowAction(a.id, () => confirmCashTicket(a.id), `${a.firstName} ${a.lastName} marked as paid (cash).`);
                                            }}
                                            className={`${deskBtn("success")} flex-1 sm:flex-none`}>
                                            Confirm cash
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="border-t border-gray-100 px-5 py-2 text-[11px] text-gray-400 dark:border-white/[0.06] dark:text-gray-500">
                    Scanner or keyboard: type the code and press Enter. Esc closes.
                </div>
            </div>
        </div>
    );
}
