import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import Loader from "../../components/ui/Loader";
import WaiterShell, { WaiterTab, NoticeBar, Notice, money, neutralBtn, primaryBtn } from "./WaiterShell";
import { FloorLayoutDto, LayoutTableDto, TableSessionDto, getLayout, getOpenSessions, errorMessage } from "../../services/floorService";
import { ReservationDto, ReservationBoardDto, getReservationBoard, confirmReservation, seatReservation } from "../../services/reservationService";

const POLL_MS = 15_000;

function tone(t: LayoutTableDto) {
  if (!t.openSession) return "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/15";
  if (t.openSession.openedMinutes >= 90) return "border-red-500 bg-red-50 dark:bg-red-500/15";
  return "border-amber-500 bg-amber-50 dark:bg-amber-500/15";
}
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export default function WaiterHome() {
  const loc = useLocation();
  const navigate = useNavigate();
  const tab = ((new URLSearchParams(loc.search).get("tab") as WaiterTab | null) ?? "tables") as WaiterTab;

  const [layout, setLayout] = useState<FloorLayoutDto | null>(null);
  const [sessions, setSessions] = useState<TableSessionDto[]>([]);
  const [board, setBoard] = useState<ReservationBoardDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      if (tab === "tables") setLayout(await getLayout());
      else if (tab === "orders") setSessions(await getOpenSessions());
      else setBoard(await getReservationBoard());
      setError(null);
    } catch (err) {
      setError(errorMessage(err, "Could not load"));
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
    const id = setInterval(() => load(true), POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const tableById = useMemo(() => new Map((layout?.areas ?? []).flatMap((a) => a.tables).map((t) => [t.id, t])), [layout]);

  async function act(label: string, fn: () => Promise<{ success: boolean; message: string }>) {
    setBusy(true);
    try {
      const r = await fn();
      setNotice({ variant: r.success ? "success" : "error", message: `${label}: ${r.message}` });
      if (r.success) await load(true);
      return r.success;
    } catch (err) {
      setNotice({ variant: "error", message: `${label}: ${errorMessage(err)}` });
      return false;
    } finally {
      setBusy(false);
    }
  }

  const titles: Record<WaiterTab, string> = { tables: "Tables", orders: "Open orders", reservations: "Today's reservations" };

  return (
    <WaiterShell title={titles[tab]} subtitle="Waiter mode" tab={tab}
      headerRight={<button type="button" className={neutralBtn} onClick={() => load()} disabled={loading}>Refresh</button>}>
      <NoticeBar notice={notice} onClose={() => setNotice(null)} />
      {error && <div className="mx-3 mt-2 rounded-lg bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-200 px-3 py-2 text-sm">{error}</div>}
      {loading && <div className="flex justify-center py-10"><Loader /></div>}

      {!loading && tab === "tables" && layout && (
        <div className="p-3 space-y-4">
          {layout.areas.length === 0 && <p className="text-sm text-gray-500 text-center py-8">No floor areas configured.</p>}
          {layout.areas.map((a) => (
            <section key={a.id}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">{a.name}</h2>
              <div className="grid grid-cols-2 gap-2">
                {[...a.tables].sort((x, y) => x.posY - y.posY || x.posX - y.posX).map((t) => (
                  <button key={t.id} type="button" onClick={() => navigate(`/waiter/table/${t.id}`)}
                    className={`min-h-[84px] rounded-xl border-2 p-3 text-left active:opacity-80 ${tone(t)}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xl font-bold">{t.code}</span>
                      <span className="text-xs text-gray-600 dark:text-gray-300">{t.capacity} seats</span>
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-300 truncate">{t.name}</div>
                    {t.openSession ? (
                      <div className="mt-1 text-sm flex justify-between">
                        <span>{t.openSession.guestCount} guest{t.openSession.guestCount === 1 ? "" : "s"} · {t.openSession.openedMinutes} min</span>
                        <span className="font-semibold">{money(t.openSession.total)}</span>
                      </div>
                    ) : (
                      <div className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">Free</div>
                    )}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {!loading && tab === "orders" && (
        <div className="p-3 space-y-2">
          {sessions.length === 0 && <p className="text-sm text-gray-500 text-center py-8">No open tables right now.</p>}
          {sessions.map((s) => {
            const mins = Math.max(0, Math.round((Date.now() - new Date(s.openedOn).getTime()) / 60000));
            const total = tableById.get(s.tableId)?.openSession?.total;
            return (
              <button key={s.id} type="button" onClick={() => navigate(`/waiter/table/${s.tableId}`)}
                className="w-full min-h-[64px] rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3 text-left active:bg-gray-100 dark:active:bg-gray-800">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-lg">{s.tableCode} <span className="text-sm font-normal text-gray-500">{s.tableName}</span></span>
                  <span className="text-sm">#{s.transactionId}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
                  <span>{s.guestCount} guest{s.guestCount === 1 ? "" : "s"} · {mins} min · {s.openedBy}</span>
                  {total !== undefined && <span className="font-semibold">{money(total)}</span>}
                </div>
                {s.notes && <div className="text-xs text-gray-500 mt-1">{s.notes}</div>}
              </button>
            );
          })}
        </div>
      )}

      {!loading && tab === "reservations" && board && (
        <div className="p-3 space-y-2">
          <div className="grid grid-cols-4 gap-1 text-center text-xs">
            <div className="rounded bg-white dark:bg-gray-900 p-2"><div className="text-gray-500">Pending</div><div className="font-semibold text-base">{board.pending}</div></div>
            <div className="rounded bg-white dark:bg-gray-900 p-2"><div className="text-gray-500">Confirmed</div><div className="font-semibold text-base">{board.confirmed}</div></div>
            <div className="rounded bg-white dark:bg-gray-900 p-2"><div className="text-gray-500">Seated</div><div className="font-semibold text-base">{board.seated}</div></div>
            <div className="rounded bg-white dark:bg-gray-900 p-2"><div className="text-gray-500">No-show</div><div className="font-semibold text-base">{board.noShow}</div></div>
          </div>
          {board.reservations.length === 0 && <p className="text-sm text-gray-500 text-center py-8">No reservations today.</p>}
          {board.reservations.map((r: ReservationDto) => (
            <div key={r.id} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{fmtTime(r.startOn)} · {r.customerName}</div>
                  <div className="text-xs text-gray-500">{r.partySize} guests · {r.resourceType} {r.resourceName ?? ""} · {r.phone}</div>
                </div>
                <span className="shrink-0 text-xs rounded px-2 py-1 bg-gray-100 dark:bg-gray-800">{r.status}{r.reminderSentOn ? " · reminded" : ""}</span>
              </div>
              {(r.status === "Pending" || r.status === "Confirmed") && (
                <div className="flex gap-2">
                  {r.status === "Pending" && <button type="button" className={neutralBtn} disabled={busy} onClick={() => act("Confirm", () => confirmReservation(r.id))}>Confirm</button>}
                  <button type="button" className={`${primaryBtn} flex-1`} disabled={busy} onClick={async () => {
                    const ok = await act("Seat", () => seatReservation(r.id, r.resourceType === "Table", r.partySize));
                    if (ok && r.resourceType === "Table" && r.tableId) navigate(`/waiter/table/${r.tableId}`);
                  }}>Seat{r.resourceType === "Table" ? " & open table" : ""}</button>
                </div>
              )}
              {r.status === "Seated" && r.tableId && (
                <button type="button" className={`${neutralBtn} w-full`} onClick={() => navigate(`/waiter/table/${r.tableId}`)}>Go to table</button>
              )}
            </div>
          ))}
        </div>
      )}
    </WaiterShell>
  );
}
