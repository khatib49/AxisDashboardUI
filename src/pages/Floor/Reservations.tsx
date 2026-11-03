import { useCallback, useEffect, useMemo, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import Modal from "../../components/ui/Modal";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import Loader from "../../components/ui/Loader";
import Alert from "../../components/ui/alert/Alert";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../components/ui/table";
import {
  ReservationDto,
  ReservationUpsertDto,
  ReservationBoardDto,
  ResourceType,
  ReservationSource,
  getReservationBoard,
  createReservation,
  updateReservation,
  confirmReservation,
  seatReservation,
  noShowReservation,
  cancelReservation,
  completeReservation,
  checkAvailability,
} from "../../services/reservationService";
import { getTables, DiningTableDto, errorMessage } from "../../services/floorService";
import { getRooms, RoomDto } from "../../services/roomsService";
import { getGames, GameDto } from "../../services/gameService";

type Notice = { variant: "success" | "error" | "warning" | "info"; title: string; message: string };

const btn = "inline-flex items-center justify-center px-3 py-2 rounded text-sm transition disabled:opacity-50";
const primary = `${btn} bg-blue-600 text-white hover:bg-blue-700`;
const neutral = `${btn} bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-white`;
const select = "h-11 w-full rounded-lg border border-gray-300 px-3 text-sm dark:bg-gray-900 dark:text-white/90 dark:border-gray-700";

const STATUS_TONE: Record<string, string> = {
  Pending: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
  Confirmed: "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200",
  Seated: "bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-200",
  NoShow: "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200",
  Cancelled: "bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200",
  Completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200",
};

const pad = (n: number) => String(n).padStart(2, "0");
const toDateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  return `${toDateInput(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

type Form = {
  customerName: string;
  phone: string;
  resourceType: ResourceType;
  resourceId: number | null;
  start: string;
  end: string;
  partySize: number;
  notes: string;
  source: ReservationSource;
  confirmNow: boolean;
};

function defaultForm(day: string): Form {
  return {
    customerName: "",
    phone: "",
    resourceType: "Table",
    resourceId: null,
    start: `${day}T19:00`,
    end: `${day}T21:00`,
    partySize: 2,
    notes: "",
    source: "Phone",
    confirmNow: true,
  };
}

export default function Reservations() {
  const [day, setDay] = useState(toDateInput(new Date()));
  const [board, setBoard] = useState<ReservationBoardDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  const [tables, setTables] = useState<DiningTableDto[]>([]);
  const [rooms, setRooms] = useState<RoomDto[]>([]);
  const [games, setGames] = useState<GameDto[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ReservationDto | null>(null);
  const [form, setForm] = useState<Form>(defaultForm(day));
  const [availability, setAvailability] = useState<{ available: boolean; conflicts: number } | null>(null);
  const [seatTarget, setSeatTarget] = useState<ReservationDto | null>(null);
  const [seatOpenSession, setSeatOpenSession] = useState(true);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const b = await getReservationBoard(`${day}T00:00:00`);
      setBoard(b);
      setError(null);
    } catch (err) {
      setError(errorMessage(err, "Failed to load reservations"));
    } finally {
      setLoading(false);
    }
  }, [day]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    getTables().then(setTables).catch(() => setTables([]));
    getRooms(1, 200).then((r) => setRooms(r.data ?? [])).catch(() => setRooms([]));
    getGames(1, 200).then((r) => setGames(r.data ?? [])).catch(() => setGames([]));
  }, []);

  const rows = useMemo(() => {
    const list = board?.reservations ?? [];
    const s = search.trim().toLowerCase();
    return list.filter(
      (r) =>
        (!statusFilter || r.status === statusFilter) &&
        (!typeFilter || r.resourceType === typeFilter) &&
        (!s || r.customerName.toLowerCase().includes(s) || r.phone.includes(s))
    );
  }, [board, statusFilter, typeFilter, search]);

  const shiftDay = (n: number) => {
    const d = new Date(`${day}T12:00:00`);
    d.setDate(d.getDate() + n);
    setDay(toDateInput(d));
  };

  function resourceOptions(type: ResourceType) {
    if (type === "Table") return tables.map((t) => ({ id: t.id, label: `${t.code} — ${t.name} (${t.capacity})` }));
    if (type === "Room") return rooms.map((r) => ({ id: Number(r.id), label: r.name }));
    return games.map((g) => ({ id: Number(g.id), label: g.name }));
  }

  function openCreate() {
    setEditing(null);
    setForm(defaultForm(day));
    setAvailability(null);
    setFormOpen(true);
  }
  function openEdit(r: ReservationDto) {
    setEditing(r);
    setForm({
      customerName: r.customerName,
      phone: r.phone,
      resourceType: (r.resourceType as ResourceType) || "Table",
      resourceId: r.tableId ?? r.roomId ?? r.gameId ?? null,
      start: toLocalInput(r.startOn),
      end: toLocalInput(r.endOn),
      partySize: r.partySize,
      notes: r.notes ?? "",
      source: (r.source as ReservationSource) || "Phone",
      confirmNow: false,
    });
    setAvailability(null);
    setFormOpen(true);
  }

  function toDto(): ReservationUpsertDto {
    return {
      customerName: form.customerName,
      phone: form.phone,
      resourceType: form.resourceType,
      startOn: new Date(form.start).toISOString(),
      endOn: new Date(form.end).toISOString(),
      partySize: form.partySize,
      tableId: form.resourceType === "Table" ? form.resourceId : null,
      roomId: form.resourceType === "Room" ? form.resourceId : null,
      gameId: form.resourceType === "Console" ? form.resourceId : null,
      notes: form.notes || null,
      source: form.source,
      confirmNow: form.confirmNow,
    };
  }

  async function doCheck() {
    if (!form.resourceId || !form.start || !form.end) return;
    try {
      const r = await checkAvailability({
        resourceType: form.resourceType,
        startOn: new Date(form.start).toISOString(),
        endOn: new Date(form.end).toISOString(),
        tableId: form.resourceType === "Table" ? form.resourceId : null,
        roomId: form.resourceType === "Room" ? form.resourceId : null,
        gameId: form.resourceType === "Console" ? form.resourceId : null,
        excludeReservationId: editing?.id ?? null,
      });
      setAvailability({ available: r.available, conflicts: r.conflicts.length });
    } catch (err) {
      setNotice({ variant: "error", title: "Availability", message: errorMessage(err) });
    }
  }

  async function submit() {
    if (!form.customerName.trim() || !form.phone.trim()) {
      setNotice({ variant: "error", title: "Validation", message: "Name and phone are required" });
      return;
    }
    if (!form.resourceId) {
      setNotice({ variant: "error", title: "Validation", message: "Pick a table, room or console" });
      return;
    }
    setBusy(true);
    try {
      const r = editing ? await updateReservation(editing.id, toDto()) : await createReservation(toDto());
      if (!r.success) {
        setNotice({ variant: "error", title: "Save failed", message: r.message });
        return;
      }
      setNotice({ variant: "success", title: "Saved", message: r.message });
      setFormOpen(false);
      await load();
    } catch (err) {
      setNotice({ variant: "error", title: "Save failed", message: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  async function act(label: string, fn: () => Promise<{ success: boolean; message: string }>) {
    setBusy(true);
    try {
      const r = await fn();
      setNotice({ variant: r.success ? "success" : "error", title: label, message: r.message });
      if (r.success) await load();
    } catch (err) {
      setNotice({ variant: "error", title: label, message: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  const th = "px-4 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400";
  const td = "px-4 py-3 text-sm text-gray-700 dark:text-gray-300";

  return (
    <div className="p-6">
      <PageMeta title="Reservations | Axis" description="Table, room and console reservations" />
      <PageBreadcrumb pageTitle="Reservations" />

      {notice && (
        <div className="mb-4">
          <Alert variant={notice.variant} title={notice.title} message={notice.message} />
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label>Day</Label>
            <div className="flex items-center gap-1">
              <button className={neutral} onClick={() => shiftDay(-1)} aria-label="Previous day">‹</button>
              <Input type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} />
              <button className={neutral} onClick={() => shiftDay(1)} aria-label="Next day">›</button>
              <button className={neutral} onClick={() => setDay(toDateInput(new Date()))}>Today</button>
            </div>
          </div>
          <div className="w-40">
            <Label>Status</Label>
            <select className={select} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All</option>
              {Object.keys(STATUS_TONE).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="w-36">
            <Label>Resource</Label>
            <select className={select} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">All</option>
              <option value="Table">Table</option>
              <option value="Room">Room</option>
              <option value="Console">Console</option>
            </select>
          </div>
          <div className="w-56">
            <Label>Search</Label>
            <Input placeholder="Name or phone" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <button className={primary} onClick={openCreate}>+ New reservation</button>
      </div>

      {board && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
          {(
            [
              ["Pending", board.pending],
              ["Confirmed", board.confirmed],
              ["Seated", board.seated],
              ["NoShow", board.noShow],
              ["Cancelled", board.cancelled],
            ] as const
          ).map(([k, v]) => (
            <button key={k} className={`rounded-lg p-3 text-left ${STATUS_TONE[k]} ${statusFilter === k ? "ring-2 ring-blue-500" : ""}`} onClick={() => setStatusFilter(statusFilter === k ? "" : k)}>
              <div className="text-xs opacity-80">{k === "NoShow" ? "No-show" : k}</div>
              <div className="text-xl font-semibold">{v}</div>
            </button>
          ))}
        </div>
      )}

      {error && <div className="text-red-600 bg-red-50 p-3 rounded mb-4">{error}</div>}
      {loading && (
        <div className="flex justify-center py-10">
          <Loader />
        </div>
      )}

      {!loading && !error && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="max-w-full overflow-x-auto">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <TableCell isHeader className={th}>Time</TableCell>
                  <TableCell isHeader className={th}>Customer</TableCell>
                  <TableCell isHeader className={th}>Resource</TableCell>
                  <TableCell isHeader className={th}>Party</TableCell>
                  <TableCell isHeader className={th}>Status</TableCell>
                  <TableCell isHeader className={th}>Source</TableCell>
                  <TableCell isHeader className={th}>Actions</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className={`${td} text-center text-gray-500`}>No reservations for this day.</TableCell>
                  </TableRow>
                )}
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className={`${td} whitespace-nowrap`}>{fmtTime(r.startOn)} – {fmtTime(r.endOn)}</TableCell>
                    <TableCell className={td}>
                      <div className="font-medium text-gray-800 dark:text-white/90">{r.customerName}</div>
                      <div className="text-xs text-gray-500">{r.phone}{r.notes ? ` · ${r.notes}` : ""}</div>
                    </TableCell>
                    <TableCell className={td}>
                      <span className="text-xs text-gray-500">{r.resourceType}</span>{" "}
                      {r.resourceName ?? "—"}
                    </TableCell>
                    <TableCell className={td}>{r.partySize}</TableCell>
                    <TableCell className={td}>
                      <span className={`inline-block rounded px-2 py-0.5 text-xs ${STATUS_TONE[r.status] ?? ""}`}>{r.status}</span>
                      {r.seatedTransactionId && <div className="text-xs text-gray-500">#{r.seatedTransactionId}</div>}
                    </TableCell>
                    <TableCell className={td}>{r.source}</TableCell>
                    <TableCell className={td}>
                      <div className="flex flex-wrap items-center gap-2">
                        {r.status === "Pending" && <button className="text-blue-600 hover:underline" disabled={busy} onClick={() => act("Confirm", () => confirmReservation(r.id))}>Confirm</button>}
                        {(r.status === "Pending" || r.status === "Confirmed") && (
                          <>
                            <button className="text-green-600 hover:underline" disabled={busy} onClick={() => { setSeatTarget(r); setSeatOpenSession(r.resourceType === "Table"); }}>Seat</button>
                            <button className="text-red-600 hover:underline" disabled={busy} onClick={() => act("No-show", () => noShowReservation(r.id))}>No-show</button>
                            <button className="text-gray-600 hover:underline" disabled={busy} onClick={() => act("Cancel", () => cancelReservation(r.id))}>Cancel</button>
                            <button className="text-gray-600 hover:underline" onClick={() => openEdit(r)}>Edit</button>
                          </>
                        )}
                        {r.status === "Seated" && <button className="text-emerald-600 hover:underline" disabled={busy} onClick={() => act("Complete", () => completeReservation(r.id))}>Complete</button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Create / edit */}
      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit reservation #${editing.id}` : "New reservation"}
        className="max-w-2xl"
        footer={
          <>
            <button className={neutral} onClick={() => setFormOpen(false)}>Cancel</button>
            <button className={neutral} onClick={doCheck} disabled={!form.resourceId}>Check availability</button>
            <button className={primary} onClick={submit} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
          </>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><Label>Customer name</Label><Input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} /></div>
          <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div>
            <Label>Resource type</Label>
            <select className={select} value={form.resourceType} onChange={(e) => { setForm({ ...form, resourceType: e.target.value as ResourceType, resourceId: null }); setAvailability(null); }}>
              <option value="Table">Table</option>
              <option value="Room">Gaming room</option>
              <option value="Console">Console / game</option>
            </select>
          </div>
          <div>
            <Label>{form.resourceType === "Table" ? "Table" : form.resourceType === "Room" ? "Room" : "Console"}</Label>
            <select className={select} value={form.resourceId ?? ""} onChange={(e) => { setForm({ ...form, resourceId: Number(e.target.value) || null }); setAvailability(null); }}>
              <option value="">— choose —</option>
              {resourceOptions(form.resourceType).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
          <div><Label>Start</Label><Input type="datetime-local" value={form.start} onChange={(e) => { setForm({ ...form, start: e.target.value }); setAvailability(null); }} /></div>
          <div><Label>End</Label><Input type="datetime-local" value={form.end} onChange={(e) => { setForm({ ...form, end: e.target.value }); setAvailability(null); }} /></div>
          <div><Label>Party size</Label><Input type="number" min="1" value={form.partySize} onChange={(e) => setForm({ ...form, partySize: Math.max(1, Number(e.target.value) || 1) })} /></div>
          <div>
            <Label>Source</Label>
            <select className={select} value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value as ReservationSource })}>
              <option value="Phone">Phone</option>
              <option value="WalkIn">Walk-in</option>
              <option value="Online">Online</option>
            </select>
          </div>
          <div className="md:col-span-2"><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Birthday, window seat…" /></div>
          {!editing && (
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 md:col-span-2">
              <input type="checkbox" checked={form.confirmNow} onChange={(e) => setForm({ ...form, confirmNow: e.target.checked })} />
              Confirm immediately (fails if the slot is already booked)
            </label>
          )}
          {availability && (
            <div className={`md:col-span-2 rounded p-2 text-sm ${availability.available ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
              {availability.available ? "Slot is available." : `Slot clashes with ${availability.conflicts} reservation(s).`}
            </div>
          )}
        </div>
      </Modal>

      {/* Seat */}
      <Modal
        isOpen={!!seatTarget}
        onClose={() => setSeatTarget(null)}
        title={seatTarget ? `Seat ${seatTarget.customerName}` : ""}
        className="max-w-md"
        footer={
          <>
            <button className={neutral} onClick={() => setSeatTarget(null)}>Cancel</button>
            <button className={primary} disabled={busy} onClick={async () => {
              if (!seatTarget) return;
              await act("Seat", () => seatReservation(seatTarget.id, seatOpenSession, seatTarget.partySize));
              setSeatTarget(null);
            }}>Seat</button>
          </>
        }
      >
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
          {seatTarget?.resourceType} {seatTarget?.resourceName ?? ""} · party of {seatTarget?.partySize}
        </p>
        {seatTarget?.resourceType === "Table" && (
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={seatOpenSession} onChange={(e) => setSeatOpenSession(e.target.checked)} />
            Open a table session (empty open invoice) on {seatTarget.tableCode}
          </label>
        )}
      </Modal>
    </div>
  );
}
