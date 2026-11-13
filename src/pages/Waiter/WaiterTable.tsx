import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import Loader from "../../components/ui/Loader";
import WaiterShell, { NoticeBar, Notice, money, neutralBtn, primaryBtn, dangerBtn, tap } from "./WaiterShell";
import {
  LayoutTableDto,
  BillBySeatDto,
  getLayout,
  openTable,
  seatInvoice,
  getCourses,
  fireCourse,
  getBillBySeat,
  splitBySeat,
  closeSessionByTransaction,
  errorMessage,
} from "../../services/floorService";
import { getOpenFnbInvoices, OpenInvoiceDto } from "../../services/transactionService";

export default function WaiterTable() {
  const { tableId } = useParams();
  const id = Number(tableId);
  const navigate = useNavigate();
  const loc = useLocation();

  const [table, setTable] = useState<LayoutTableDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>((loc.state as { notice?: Notice } | null)?.notice ?? null);
  const [busy, setBusy] = useState(false);

  const [guests, setGuests] = useState(2);
  const [notes, setNotes] = useState("");
  const [seatMode, setSeatMode] = useState(false);
  const [openInvoices, setOpenInvoices] = useState<OpenInvoiceDto[]>([]);
  const [invoiceId, setInvoiceId] = useState<number | null>(null);

  const [bill, setBill] = useState<BillBySeatDto | null>(null);
  const [billOpen, setBillOpen] = useState(false);
  const [unfiredCourses, setUnfiredCourses] = useState<number[]>([]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const layout = await getLayout();
      const t = layout.areas.flatMap((a) => a.tables).find((x) => x.id === id) ?? null;
      setTable(t);
      setError(t ? null : "Table not found.");
      if (t?.openSession) {
        const trx = t.openSession.transactionId;
        const [courses, b] = await Promise.all([getCourses(trx).catch(() => []), getBillBySeat(trx).catch(() => null)]);
        setUnfiredCourses(Array.from(new Set(courses.filter((c) => !c.firedOn).map((c) => c.courseNumber))).sort((a, b2) => a - b2));
        setBill(b?.success && b.data ? b.data : null);
      } else {
        setBill(null);
        setUnfiredCourses([]);
      }
    } catch (err) {
      setError(errorMessage(err, "Could not load the table"));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const session = table?.openSession ?? null;
  const trxId = session?.transactionId;
  const title = table ? `${table.code} — ${table.name}` : "Table";
  const seatedTotal = useMemo(() => bill?.seats.filter((s) => s.seatNumber !== null).length ?? 0, [bill]);

  async function run(label: string, fn: () => Promise<{ success: boolean; message: string }>) {
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

  async function startSeat() {
    setSeatMode(true);
    setInvoiceId(null);
    try {
      const r = await getOpenFnbInvoices();
      setOpenInvoices(r.data ?? []);
    } catch {
      setOpenInvoices([]);
    }
  }

  async function sendToKitchen() {
    if (!trxId) return;
    if (unfiredCourses.length === 0) {
      // Nothing explicitly assigned yet: course 1 covers every unassigned line.
      await run("Send to kitchen", () => fireCourse(trxId, 1));
      return;
    }
    setBusy(true);
    try {
      let fired = 0;
      for (const c of unfiredCourses) {
        const r = await fireCourse(trxId, c);
        if (r.success) fired++;
        else setNotice({ variant: "error", message: `Course ${c}: ${r.message}` });
      }
      if (fired > 0) setNotice({ variant: "success", message: `Sent ${fired} course${fired === 1 ? "" : "s"} to the kitchen` });
      await load(true);
    } catch (err) {
      setNotice({ variant: "error", message: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <WaiterShell title={title} subtitle={session ? `Invoice #${session.transactionId} · ${session.guestCount} guest${session.guestCount === 1 ? "" : "s"} · ${session.openedMinutes} min` : table ? `${table.capacity} seats · free` : undefined} back="/waiter?tab=tables" tab="tables"
      footer={session ? (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={`${primaryBtn} h-12 text-base`} onClick={() => navigate(`/waiter/order/${id}`)}>Order</button>
          <button type="button" className={`${neutralBtn} h-12 text-base`} disabled={busy} onClick={sendToKitchen}>Send to kitchen{unfiredCourses.length ? ` (${unfiredCourses.length})` : ""}</button>
        </div>
      ) : undefined}>
      <NoticeBar notice={notice} onClose={() => setNotice(null)} />
      {error && <div className="mx-3 mt-2 rounded-lg bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-200 px-3 py-2 text-sm">{error}</div>}
      {loading && <div className="flex justify-center py-10"><Loader /></div>}

      {!loading && table && !session && (
        <div className="p-3 space-y-4">
          <div className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 space-y-3 text-gray-800 dark:text-white/90">
            <div className="font-semibold">Guests</div>
            <div className="flex items-center justify-center gap-3">
              <button type="button" className={`${neutralBtn} w-14 h-14 text-2xl`} onClick={() => setGuests((g) => Math.max(1, g - 1))} aria-label="Fewer guests">−</button>
              <span className="w-16 text-center text-3xl font-bold">{guests}</span>
              <button type="button" className={`${neutralBtn} w-14 h-14 text-2xl`} onClick={() => setGuests((g) => Math.min(50, g + 1))} aria-label="More guests">+</button>
            </div>
            <input className="min-h-[44px] w-full rounded-lg border border-gray-300 px-3 text-base bg-white dark:bg-gray-800 dark:text-white dark:border-gray-600" placeholder="Notes (allergy, birthday…)" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <button type="button" className={`${primaryBtn} w-full h-12 text-base`} disabled={busy} onClick={async () => {
              const ok = await run("Open table", () => openTable({ tableId: id, guestCount: guests, notes: notes || null }));
              if (ok) navigate(`/waiter/order/${id}`);
            }}>Open table & order</button>
          </div>
          {!seatMode ? (
            <button type="button" className={`${neutralBtn} w-full`} onClick={startSeat}>Seat an existing open invoice</button>
          ) : (
            <div className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 space-y-3 text-gray-800 dark:text-white/90">
              <div className="font-semibold">Open invoices</div>
              {openInvoices.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">No open F&amp;B invoices.</p>}
              <div className="space-y-2">
                {openInvoices.map((i) => (
                  <button key={i.id} type="button" onClick={() => setInvoiceId(i.id)}
                    className={`w-full min-h-[48px] rounded-lg border px-3 text-left text-sm ${invoiceId === i.id ? "border-blue-600 bg-blue-50 dark:bg-blue-500/10" : "border-gray-200 dark:border-gray-700"}`}>
                    #{i.id} · {money(i.totalPrice)} · {i.items?.length ?? 0} items{i.comment ? ` · ${i.comment}` : ""}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button type="button" className={neutralBtn} onClick={() => setSeatMode(false)}>Cancel</button>
                <button type="button" className={`${primaryBtn} flex-1`} disabled={busy || !invoiceId} onClick={() => invoiceId && run("Seat invoice", () => seatInvoice(id, invoiceId, guests, notes || undefined))}>Seat here</button>
              </div>
            </div>
          )}
        </div>
      )}

      {!loading && table && session && (
        <div className="p-3 space-y-3">
          <div className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 grid grid-cols-2 gap-y-1 text-sm text-gray-800 dark:text-white/90">
            <span className="text-gray-500 dark:text-gray-400">Total</span><span className="font-semibold text-lg">{money(session.total)}</span>
            <span className="text-gray-500 dark:text-gray-400">Items</span><span>{session.itemsCount}</span>
            <span className="text-gray-500 dark:text-gray-400">Opened by</span><span>{session.openedBy}</span>
            {session.notes && (<><span className="text-gray-500 dark:text-gray-400">Notes</span><span>{session.notes}</span></>)}
          </div>

          <button type="button" className={`${neutralBtn} w-full justify-between px-4`} onClick={() => setBillOpen((o) => !o)} aria-expanded={billOpen}>
            <span>Bill by seat{bill ? ` · ${seatedTotal} seat${seatedTotal === 1 ? "" : "s"} · ${money(bill.unassignedTotal)} on table` : ""}</span>
            <span aria-hidden="true" className="ml-2">{billOpen ? "▴" : "▾"}</span>
          </button>
          {billOpen && (
            <div className="space-y-2">
              {!bill && <p className="text-sm text-gray-500 dark:text-gray-400">{session.itemsCount === 0 ? "Nothing ordered yet." : "Bill by seat is not available right now."}</p>}
              {bill?.seats.map((s) => (
                <div key={s.label} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-800 dark:text-white/90">
                  <div className="flex items-center justify-between px-3 py-2 font-semibold text-sm border-b border-gray-100 dark:border-gray-800">
                    <span>{s.label}</span><span>{money(s.net)}</span>
                  </div>
                  {s.lines.map((l) => (
                    <div key={`${l.itemId}-${l.seatNumber ?? "t"}`} className="flex items-center justify-between px-3 py-1.5 text-sm">
                      <span>{l.quantity}× {l.itemName} <span className="text-xs text-gray-500 dark:text-gray-400">c{l.courseNumber}{l.firedOn ? " · fired" : ""}</span></span>
                      <span>{money(l.lineTotal)}</span>
                    </div>
                  ))}
                </div>
              ))}
              {bill && bill.seats.some((s) => s.seatNumber !== null) && (
                <button type="button" className={`${neutralBtn} w-full`} disabled={busy} onClick={() => trxId && run("Split by seat", () => splitBySeat(trxId))}>Split bill by seat</button>
              )}
            </div>
          )}

          <button type="button" className={`${primaryBtn} w-full h-12 text-base !bg-emerald-600 active:!bg-emerald-800`} onClick={() => navigate(`/cashier/open-invoices?invoice=${session.transactionId}`)}>
            Request payment ({money(session.total)})
          </button>
          <button type="button" className={`${dangerBtn} w-full`} disabled={busy} onClick={() => {
            if (window.confirm(`Release ${table.code}? The invoice stays open at the till.`)) run("Release table", () => closeSessionByTransaction(session.transactionId));
          }}>Release table (invoice stays open)</button>
          <p className={`${tap} w-full text-xs text-gray-500 dark:text-gray-400 !min-h-0`}>Payment is taken at the till: "Request payment" opens the invoice in Open Invoices.</p>
        </div>
      )}
    </WaiterShell>
  );
}
