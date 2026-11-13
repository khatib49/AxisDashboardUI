import { useCallback, useEffect, useMemo, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import Modal from "../../components/ui/Modal";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import Loader from "../../components/ui/Loader";
import Alert from "../../components/ui/alert/Alert";
import DeleteIconButton from "../../components/ui/DeleteIconButton";
import {
  FloorLayoutDto,
  LayoutTableDto,
  OrderCourseDto,
  BillSplitListDto,
  BillBySeatDto,
  TipDto,
  PAYMENT_METHODS,
  getLayout,
  openTable,
  seatInvoice,
  transferSession,
  mergeInvoices,
  closeSessionByTransaction,
  getCourses,
  setCourses,
  fireCourse,
  getSplits,
  splitEqual,
  splitCustom,
  splitBySeat,
  getBillBySeat,
  paySplit,
  deleteSplit,
  getTips,
  addTip,
  deleteTip,
  errorMessage,
} from "../../services/floorService";
import { getOpenFnbInvoices, closeOpenInvoice, OpenInvoiceDto } from "../../services/transactionService";
import TableOrderPicker from "./TableOrderPicker";
import type { SendOrderResult } from "../../services/waiterService";

const POLL_MS = 10_000;
const LONG_SESSION_MIN = 90;

type Notice = { variant: "success" | "error" | "warning" | "info"; title: string; message: string };
type Dialog = "none" | "table" | "open" | "seat" | "transfer" | "merge" | "split" | "tips" | "courses" | "order" | "bill";

const money = (n: number) => `$${(n ?? 0).toFixed(2)}`;
const btn = "inline-flex items-center justify-center px-3 py-2 rounded text-sm transition disabled:opacity-50";
const primary = `${btn} bg-blue-600 text-white hover:bg-blue-700`;
const neutral = `${btn} bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-white`;
const danger = `${btn} bg-red-600 text-white hover:bg-red-700`;

function tableTone(t: LayoutTableDto): string {
  if (!t.openSession) return "border-green-500 bg-green-50 text-green-900 dark:bg-green-500/15 dark:text-green-100";
  if (t.openSession.openedMinutes >= LONG_SESSION_MIN) return "border-red-500 bg-red-50 text-red-900 dark:bg-red-500/15 dark:text-red-100";
  return "border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-500/15 dark:text-amber-100";
}

export default function FloorView() {
  const [layout, setLayout] = useState<FloorLayoutDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const [selected, setSelected] = useState<LayoutTableDto | null>(null);
  const [dialog, setDialog] = useState<Dialog>("none");

  // open table form
  const [guestCount, setGuestCount] = useState(2);
  const [notes, setNotes] = useState("");
  // seat form
  const [openInvoices, setOpenInvoices] = useState<OpenInvoiceDto[]>([]);
  const [seatInvoiceId, setSeatInvoiceId] = useState<number | null>(null);
  // transfer / merge
  const [targetTableId, setTargetTableId] = useState<number | null>(null);
  // split
  const [splits, setSplits] = useState<BillSplitListDto | null>(null);
  const [ways, setWays] = useState(2);
  const [customAmount, setCustomAmount] = useState("");
  const [customMethod, setCustomMethod] = useState<string>("Cash");
  // tips
  const [tips, setTips] = useState<TipDto[]>([]);
  const [tipAmount, setTipAmount] = useState("");
  const [tipMethod, setTipMethod] = useState<string>("Cash");
  const [tipStaff, setTipStaff] = useState("");
  // courses
  const [courses, setCoursesState] = useState<OrderCourseDto[]>([]);
  const [courseEdits, setCourseEdits] = useState<Record<number, number>>({});
  // bill by seat
  const [bill, setBill] = useState<BillBySeatDto | null>(null);
  const [billError, setBillError] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await getLayout();
      setLayout(data);
      setError(null);
      setLastRefresh(new Date());
      // keep the selected table fresh after a poll
      setSelected((cur) => (cur ? data.areas.flatMap((a) => a.tables).find((t) => t.id === cur.id) ?? null : null));
    } catch (err) {
      if (!silent || !layout) setError(errorMessage(err, "Failed to load the floor"));
    } finally {
      if (!silent) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(() => refresh(true), POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const allTables = useMemo(() => layout?.areas.flatMap((a) => a.tables) ?? [], [layout]);
  const freeTables = useMemo(() => allTables.filter((t) => !t.openSession && t.id !== selected?.id), [allTables, selected]);
  const occupiedTables = useMemo(() => allTables.filter((t) => t.openSession && t.id !== selected?.id), [allTables, selected]);
  const stats = useMemo(() => {
    const occupied = allTables.filter((t) => t.openSession);
    return {
      total: allTables.length,
      occupied: occupied.length,
      guests: occupied.reduce((s, t) => s + (t.openSession?.guestCount ?? 0), 0),
      open: occupied.reduce((s, t) => s + (t.openSession?.total ?? 0), 0),
    };
  }, [allTables]);

  function pick(t: LayoutTableDto) {
    setSelected(t);
    setDialog("table");
  }
  function closeDialog() {
    setDialog("none");
  }

  async function run<T>(label: string, fn: () => Promise<{ success: boolean; message: string; data?: T | null }>, after?: (d: T) => void) {
    setBusy(true);
    try {
      const r = await fn();
      if (!r.success) {
        setNotice({ variant: "error", title: label, message: r.message });
        return false;
      }
      setNotice({ variant: "success", title: label, message: r.message });
      if (after && r.data) after(r.data);
      await refresh(true);
      return true;
    } catch (err) {
      setNotice({ variant: "error", title: label, message: errorMessage(err) });
      return false;
    } finally {
      setBusy(false);
    }
  }

  // ── Actions ────────────────────────────────────────────────────
  async function startOpen() {
    setGuestCount(2);
    setNotes("");
    setDialog("open");
  }
  async function doOpen() {
    if (!selected) return;
    const ok = await run("Open table", () => openTable({ tableId: selected.id, guestCount, notes: notes || null }));
    if (ok) closeDialog();
  }

  async function startSeat() {
    setSeatInvoiceId(null);
    setDialog("seat");
    try {
      const r = await getOpenFnbInvoices();
      setOpenInvoices(r.data ?? []);
    } catch {
      setOpenInvoices([]);
    }
  }
  async function doSeat() {
    if (!selected || !seatInvoiceId) return;
    const ok = await run("Seat invoice", () => seatInvoice(selected.id, seatInvoiceId, guestCount));
    if (ok) closeDialog();
  }

  async function doTransfer() {
    if (!selected?.openSession || !targetTableId) return;
    const ok = await run("Transfer", () => transferSession(selected.openSession!.sessionId, targetTableId));
    if (ok) closeDialog();
  }

  async function doMerge() {
    if (!selected?.openSession || !targetTableId) return;
    const target = allTables.find((t) => t.id === targetTableId)?.openSession;
    if (!target) return;
    const ok = await run("Merge", () => mergeInvoices(selected.openSession!.transactionId, target.transactionId));
    if (ok) closeDialog();
  }

  async function doPayAndClose() {
    if (!selected?.openSession) return;
    const trxId = selected.openSession.transactionId;
    setBusy(true);
    try {
      const r = await closeOpenInvoice(trxId);
      if (!r.success) {
        setNotice({ variant: "error", title: "Close invoice", message: r.message || r.error || "Could not close the invoice" });
        return;
      }
      const s = await closeSessionByTransaction(trxId);
      setNotice({ variant: s.success ? "success" : "warning", title: "Invoice closed", message: s.success ? `Invoice #${trxId} paid, table released` : s.message });
      await refresh(true);
      closeDialog();
    } catch (err) {
      setNotice({ variant: "error", title: "Close invoice", message: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  async function doReleaseOnly() {
    if (!selected?.openSession) return;
    const ok = await run("Release table", () => closeSessionByTransaction(selected.openSession!.transactionId));
    if (ok) closeDialog();
  }

  // split
  async function startSplit() {
    if (!selected?.openSession) return;
    setDialog("split");
    setCustomAmount("");
    try {
      const r = await getSplits(selected.openSession.transactionId);
      setSplits(r.data ?? null);
    } catch (err) {
      setNotice({ variant: "error", title: "Splits", message: errorMessage(err) });
    }
  }
  const trxId = selected?.openSession?.transactionId;
  const splitAction = (label: string, fn: () => Promise<{ success: boolean; message: string; data?: BillSplitListDto | null }>) =>
    run<BillSplitListDto>(label, fn, (d) => setSplits(d));

  // tips
  async function startTips() {
    if (!selected?.openSession) return;
    setDialog("tips");
    setTipAmount("");
    setTipStaff("");
    try {
      setTips(await getTips(selected.openSession.transactionId));
    } catch {
      setTips([]);
    }
  }
  async function doAddTip() {
    if (!trxId) return;
    const amount = Number(tipAmount);
    if (!amount || amount <= 0) {
      setNotice({ variant: "error", title: "Tip", message: "Enter a positive amount" });
      return;
    }
    const ok = await run("Tip", () => addTip(trxId, { amount, method: tipMethod, staffName: tipStaff || null }));
    if (ok) {
      setTipAmount("");
      setTips(await getTips(trxId));
    }
  }
  async function doDeleteTip(id: number) {
    if (!trxId) return;
    const ok = await run("Tip", () => deleteTip(id));
    if (ok) setTips(await getTips(trxId));
  }

  // courses
  async function startCourses() {
    if (!selected?.openSession) return;
    setDialog("courses");
    setCourseEdits({});
    try {
      setCoursesState(await getCourses(selected.openSession.transactionId));
    } catch {
      setCoursesState([]);
    }
  }
  async function doSaveCourses() {
    if (!trxId) return;
    const assignments = Object.entries(courseEdits).map(([itemId, courseNumber]) => ({ itemId: Number(itemId), courseNumber }));
    if (assignments.length === 0) return;
    await run<OrderCourseDto[]>("Courses", () => setCourses(trxId, assignments), (d) => {
      setCoursesState(d);
      setCourseEdits({});
    });
  }
  async function doFire(course: number) {
    if (!trxId) return;
    await run<OrderCourseDto[]>("Fire course", () => fireCourse(trxId, course), (d) => setCoursesState(d));
  }
  // order (item picker) + bill by seat
  function startOrder() {
    if (!selected?.openSession) return;
    setDialog("order");
  }
  function onOrderSent(r: SendOrderResult) {
    setNotice({ variant: r.seatWarning ? "warning" : "success", title: "Order sent", message: r.seatWarning ? `${r.message}: ${r.seatWarning}` : r.message });
    refresh(true);
    setDialog("table");
  }
  async function startBill() {
    if (!selected?.openSession) return;
    setDialog("bill");
    setBill(null);
    setBillError(null);
    try {
      const r = await getBillBySeat(selected.openSession.transactionId);
      if (r.success && r.data) setBill(r.data); else setBillError(r.message || "Could not load the bill");
    } catch (err) {
      setBillError(errorMessage(err));
    }
  }
  async function doSplitBySeat(backTo: Dialog) {
    if (!trxId) return;
    const ok = await splitAction("Split by seat", () => splitBySeat(trxId));
    if (ok && backTo === "split") setDialog("split");
  }

  const courseNumbers = useMemo(
    () => Array.from(new Set(courses.map((c) => courseEdits[c.itemId] ?? c.courseNumber))).sort((a, b) => a - b),
    [courses, courseEdits]
  );

  const select = "h-11 w-full rounded-lg border border-gray-300 px-3 text-sm dark:bg-gray-900 dark:text-white/90 dark:border-gray-700";

  return (
    <div className="p-4 md:p-6">
      <PageMeta title="Floor | Axis" description="Live floor and table service" />
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Floor</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {stats.occupied}/{stats.total} tables busy · {stats.guests} guests · {money(stats.open)} open
            {lastRefresh ? ` · refreshed ${lastRefresh.toLocaleTimeString()}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300"><i className="w-3 h-3 rounded-sm bg-green-400 inline-block" /> Free</span>
          <span className="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300"><i className="w-3 h-3 rounded-sm bg-amber-400 inline-block" /> Occupied</span>
          <span className="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300"><i className="w-3 h-3 rounded-sm bg-red-400 inline-block" /> &gt; {LONG_SESSION_MIN} min</span>
          <button className={neutral} onClick={() => refresh()} disabled={loading}>Refresh</button>
        </div>
      </div>

      {notice && (
        <div className="mb-4">
          <Alert variant={notice.variant} title={notice.title} message={notice.message} />
        </div>
      )}
      {error && <div className="text-red-600 bg-red-50 p-3 rounded mb-4">{error}</div>}
      {loading && !layout && (
        <div className="flex justify-center py-10">
          <Loader />
        </div>
      )}

      {layout && layout.areas.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center text-gray-500 dark:text-gray-400">
          No floor areas configured yet. An admin can set them up under Floor Plan.
        </div>
      )}

      {layout?.areas.map((area) => (
        <div key={area.id} className="mb-6">
          <h2 className="font-semibold text-gray-800 dark:text-white/90 mb-2">{area.name}</h2>
          {area.tables.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">No tables in this area.</p>}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
            {[...area.tables]
              .sort((a, b) => a.posY - b.posY || a.posX - b.posX)
              .map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => pick(t)}
                  className={`text-left border-2 p-3 transition hover:shadow ${t.shape === "Round" ? "rounded-3xl" : "rounded-xl"} ${tableTone(t)}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-lg">{t.code}</span>
                    <span className="text-xs opacity-70">{t.capacity} seats</span>
                  </div>
                  <div className="text-xs opacity-80 truncate">{t.name}</div>
                  {t.openSession ? (
                    <div className="mt-2 text-xs space-y-0.5">
                      <div className="flex justify-between"><span>#{t.openSession.transactionId}</span><span className="font-semibold">{money(t.openSession.total)}</span></div>
                      <div className="flex justify-between"><span>{t.openSession.guestCount} guest{t.openSession.guestCount === 1 ? "" : "s"}</span><span>{t.openSession.itemsCount} items</span></div>
                      <div>{t.openSession.openedMinutes} min</div>
                    </div>
                  ) : (
                    <div className="mt-2 text-xs opacity-70">Free</div>
                  )}
                </button>
              ))}
          </div>
        </div>
      ))}

      {/* Table action sheet */}
      <Modal isOpen={dialog === "table" && !!selected} onClose={closeDialog} title={selected ? `${selected.code} — ${selected.name}` : ""} className="max-w-lg">
        {selected && !selected.openSession && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-300">Table is free ({selected.capacity} seats).</p>
            <div className="grid grid-cols-2 gap-2">
              <button className={primary} onClick={startOpen}>Open table</button>
              <button className={neutral} onClick={startSeat}>Seat open invoice</button>
            </div>
          </div>
        )}
        {selected?.openSession && (
          <div className="space-y-3">
            <div className="rounded-lg bg-gray-50 dark:bg-white/[0.03] p-3 text-sm grid grid-cols-2 gap-y-1">
              <span className="text-gray-500 dark:text-gray-400">Invoice</span><span className="font-medium">#{selected.openSession.transactionId}</span>
              <span className="text-gray-500 dark:text-gray-400">Total</span><span className="font-medium">{money(selected.openSession.total)}</span>
              <span className="text-gray-500 dark:text-gray-400">Guests</span><span>{selected.openSession.guestCount}</span>
              <span className="text-gray-500 dark:text-gray-400">Items</span><span>{selected.openSession.itemsCount}</span>
              <span className="text-gray-500 dark:text-gray-400">Opened</span><span>{selected.openSession.openedMinutes} min ago by {selected.openSession.openedBy}</span>
              {selected.openSession.notes && (<><span className="text-gray-500 dark:text-gray-400">Notes</span><span>{selected.openSession.notes}</span></>)}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button className={primary} onClick={startOrder}>Order</button>
              <button className={neutral} onClick={startBill}>Bill by seat</button>
              <button className={neutral} onClick={startCourses}>Courses</button>
              <button className={neutral} onClick={startSplit}>Split bill</button>
              <button className={neutral} onClick={startTips}>Tips</button>
              <button className={neutral} onClick={() => { setTargetTableId(null); setDialog("transfer"); }}>Transfer</button>
              <button className={neutral} onClick={() => { setTargetTableId(null); setDialog("merge"); }}>Merge into…</button>
              <button className={neutral} onClick={doReleaseOnly} disabled={busy} title="Only release the table; invoice stays open">Release table</button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">"Order" adds items per seat to invoice #{selected.openSession.transactionId}; the F&amp;B till (Orders page) still works too.</p>
            <button className={`${danger} w-full`} onClick={doPayAndClose} disabled={busy}>
              Pay &amp; close invoice ({money(selected.openSession.total)})
            </button>
          </div>
        )}
      </Modal>

      {/* Open table */}
      <Modal
        isOpen={dialog === "open"}
        onClose={() => setDialog("table")}
        title={`Open ${selected?.code ?? ""}`}
        className="max-w-md"
        footer={<><button className={neutral} onClick={() => setDialog("table")}>Back</button><button className={primary} onClick={doOpen} disabled={busy}>Open</button></>}
      >
        <div className="space-y-3">
          <div>
            <Label>Guests</Label>
            <Input type="number" min="1" value={guestCount} onChange={(e) => setGuestCount(Math.max(1, Number(e.target.value) || 1))} />
          </div>
          <div>
            <Label>Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Birthday, allergy, high chair…" />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">An empty open invoice is created; add items from the F&amp;B till.</p>
        </div>
      </Modal>

      {/* Seat invoice */}
      <Modal
        isOpen={dialog === "seat"}
        onClose={() => setDialog("table")}
        title={`Seat an open invoice at ${selected?.code ?? ""}`}
        className="max-w-md"
        footer={<><button className={neutral} onClick={() => setDialog("table")}>Back</button><button className={primary} onClick={doSeat} disabled={busy || !seatInvoiceId}>Seat</button></>}
      >
        <div className="space-y-3">
          <div>
            <Label>Open invoice</Label>
            <select className={select} value={seatInvoiceId ?? ""} onChange={(e) => setSeatInvoiceId(Number(e.target.value) || null)}>
              <option value="">— choose —</option>
              {openInvoices.map((i) => (
                <option key={i.id} value={i.id}>
                  #{i.id} · {money(i.totalPrice)} · {i.items?.length ?? 0} items{i.comment ? ` · ${i.comment}` : ""}
                </option>
              ))}
            </select>
            {openInvoices.length === 0 && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">No open F&amp;B invoices.</p>}
          </div>
          <div>
            <Label>Guests</Label>
            <Input type="number" min="1" value={guestCount} onChange={(e) => setGuestCount(Math.max(1, Number(e.target.value) || 1))} />
          </div>
        </div>
      </Modal>

      {/* Transfer */}
      <Modal
        isOpen={dialog === "transfer"}
        onClose={() => setDialog("table")}
        title={`Transfer ${selected?.code ?? ""} to…`}
        className="max-w-md"
        footer={<><button className={neutral} onClick={() => setDialog("table")}>Back</button><button className={primary} onClick={doTransfer} disabled={busy || !targetTableId}>Transfer</button></>}
      >
        <Label>Free table</Label>
        <select className={select} value={targetTableId ?? ""} onChange={(e) => setTargetTableId(Number(e.target.value) || null)}>
          <option value="">— choose —</option>
          {freeTables.map((t) => (<option key={t.id} value={t.id}>{t.code} — {t.name} ({t.capacity})</option>))}
        </select>
        {freeTables.length === 0 && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">No free tables.</p>}
      </Modal>

      {/* Merge */}
      <Modal
        isOpen={dialog === "merge"}
        onClose={() => setDialog("table")}
        title={`Merge invoice #${selected?.openSession?.transactionId ?? ""} into…`}
        className="max-w-md"
        footer={<><button className={neutral} onClick={() => setDialog("table")}>Back</button><button className={danger} onClick={doMerge} disabled={busy || !targetTableId}>Merge</button></>}
      >
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
          All items of this table move to the target invoice. This invoice is zeroed and closed, and {selected?.code} is released.
        </p>
        <Label>Target table (occupied)</Label>
        <select className={select} value={targetTableId ?? ""} onChange={(e) => setTargetTableId(Number(e.target.value) || null)}>
          <option value="">— choose —</option>
          {occupiedTables.map((t) => (<option key={t.id} value={t.id}>{t.code} — #{t.openSession?.transactionId} · {money(t.openSession?.total ?? 0)}</option>))}
        </select>
        {occupiedTables.length === 0 && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">No other occupied tables.</p>}
      </Modal>

      {/* Split bill */}
      <Modal isOpen={dialog === "split"} onClose={() => setDialog("table")} title={`Split bill — invoice #${trxId ?? ""}`} className="max-w-xl"
        footer={<button className={neutral} onClick={() => setDialog("table")}>Back</button>}>
        {!splits && <div className="flex justify-center py-4"><Loader /></div>}
        {splits && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-2 text-sm text-center">
              <div className="rounded bg-gray-50 dark:bg-white/[0.03] p-2"><div className="text-xs text-gray-500 dark:text-gray-400">Total</div><div className="font-semibold">{money(splits.totalPrice)}</div></div>
              <div className="rounded bg-gray-50 dark:bg-white/[0.03] p-2"><div className="text-xs text-gray-500 dark:text-gray-400">Split</div><div className="font-semibold">{money(splits.splitTotal)}</div></div>
              <div className="rounded bg-gray-50 dark:bg-white/[0.03] p-2"><div className="text-xs text-gray-500 dark:text-gray-400">Paid</div><div className="font-semibold text-green-600">{money(splits.paidTotal)}</div></div>
              <div className="rounded bg-gray-50 dark:bg-white/[0.03] p-2"><div className="text-xs text-gray-500 dark:text-gray-400">Remaining</div><div className="font-semibold text-red-600">{money(splits.remaining)}</div></div>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="w-24">
                <Label>Ways</Label>
                <Input type="number" min="2" value={ways} onChange={(e) => setWays(Math.max(2, Number(e.target.value) || 2))} />
              </div>
              <button className={primary} disabled={busy || !trxId} onClick={() => trxId && splitAction("Equal split", () => splitEqual(trxId, ways))}>Split equally</button>
              <div className="w-28">
                <Label>Amount</Label>
                <Input type="number" min="0" step={0.5} value={customAmount} onChange={(e) => setCustomAmount(e.target.value)} />
              </div>
              <div className="w-28">
                <Label>Method</Label>
                <select className={select} value={customMethod} onChange={(e) => setCustomMethod(e.target.value)}>
                  {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <button className={neutral} disabled={busy || !trxId || !Number(customAmount)} onClick={() => trxId && splitAction("Custom split", () => splitCustom(trxId, [{ amount: Number(customAmount), method: customMethod }])).then((ok) => ok && setCustomAmount(""))}>Add split</button>
              <button className={neutral} disabled={busy || !trxId} title="One split per seat with the seat's amount (replaces unpaid splits)" onClick={() => doSplitBySeat("split")}>Split by seat</button>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-white/[0.05] border rounded border-gray-200 dark:border-white/[0.05]">
              {splits.splits.length === 0 && <p className="p-3 text-sm text-gray-500 dark:text-gray-400">No splits yet.</p>}
              {splits.splits.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-2 text-sm">
                  <div>
                    <span className="font-medium">#{s.splitNumber}</span> · {money(s.amount)} · {s.method}
                    {s.paidOn ? <span className="ml-2 text-green-600">paid by {s.paidBy}</span> : <span className="ml-2 text-amber-600">unpaid</span>}
                    {s.note && <span className="ml-2 text-gray-500 dark:text-gray-400">{s.note}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    {!s.paidOn && (
                      <>
                        <select className="h-8 rounded border border-gray-300 px-2 text-xs dark:bg-gray-900 dark:border-gray-700" defaultValue={s.method} id={`pay-${s.id}`}>
                          {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <button className={`${primary} !py-1`} disabled={busy} onClick={() => {
                          const m = (document.getElementById(`pay-${s.id}`) as HTMLSelectElement | null)?.value ?? s.method;
                          splitAction("Pay split", () => paySplit(s.id, m));
                        }}>Pay</button>
                        <DeleteIconButton onClick={() => splitAction("Remove split", () => deleteSplit(s.id))} />
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Splits track who paid what; when remaining is 0 use "Pay &amp; close invoice" on the table.</p>
          </div>
        )}
      </Modal>

      {/* Tips */}
      <Modal isOpen={dialog === "tips"} onClose={() => setDialog("table")} title={`Tips — invoice #${trxId ?? ""}`} className="max-w-lg"
        footer={<button className={neutral} onClick={() => setDialog("table")}>Back</button>}>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div><Label>Amount</Label><Input type="number" min="0" step={0.5} value={tipAmount} onChange={(e) => setTipAmount(e.target.value)} /></div>
            <div><Label>Method</Label>
              <select className={select} value={tipMethod} onChange={(e) => setTipMethod(e.target.value)}>
                {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div><Label>Staff</Label><Input value={tipStaff} onChange={(e) => setTipStaff(e.target.value)} placeholder="Waiter name" /></div>
          </div>
          <button className={primary} onClick={doAddTip} disabled={busy}>Add tip</button>
          <div className="divide-y divide-gray-100 dark:divide-white/[0.05] border rounded border-gray-200 dark:border-white/[0.05]">
            {tips.length === 0 && <p className="p-3 text-sm text-gray-500 dark:text-gray-400">No tips recorded.</p>}
            {tips.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-2 text-sm">
                <span>{money(t.amount)} · {t.method}{t.staffName ? ` · ${t.staffName}` : ""} <span className="text-gray-500 dark:text-gray-400">by {t.createdBy}</span></span>
                <DeleteIconButton onClick={() => doDeleteTip(t.id)} />
              </div>
            ))}
            {tips.length > 0 && <div className="p-2 text-sm font-semibold text-right">Total {money(tips.reduce((s, t) => s + t.amount, 0))}</div>}
          </div>
        </div>
      </Modal>

      {/* Courses */}
      <Modal isOpen={dialog === "courses"} onClose={() => setDialog("table")} title={`Courses — invoice #${trxId ?? ""}`} className="max-w-xl"
        footer={<><button className={neutral} onClick={() => setDialog("table")}>Back</button><button className={primary} onClick={doSaveCourses} disabled={busy || Object.keys(courseEdits).length === 0}>Save courses</button></>}>
        <div className="space-y-3">
          {courses.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">No items on this invoice yet.</p>}
          {courses.length > 0 && (
            <div className="divide-y divide-gray-100 dark:divide-white/[0.05] border rounded border-gray-200 dark:border-white/[0.05]">
              {courses.map((c) => (
                <div key={c.itemId} className="flex items-center justify-between p-2 text-sm gap-2">
                  <div className="flex-1">
                    <span className="font-medium">{c.quantity}× {c.itemName}</span>
                    {c.firedOn ? <span className="ml-2 text-xs text-green-600">fired {new Date(c.firedOn).toLocaleTimeString()}</span> : <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">not fired</span>}
                  </div>
                  <select className="h-8 rounded border border-gray-300 px-2 text-xs dark:bg-gray-900 dark:border-gray-700"
                    value={courseEdits[c.itemId] ?? c.courseNumber}
                    onChange={(e) => setCourseEdits((p) => ({ ...p, [c.itemId]: Number(e.target.value) }))}>
                    {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>Course {n}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}
          {courseNumbers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {courseNumbers.map((n) => {
                const lines = courses.filter((c) => (courseEdits[c.itemId] ?? c.courseNumber) === n);
                const allFired = lines.length > 0 && lines.every((l) => l.firedOn);
                return (
                  <button key={n} className={allFired ? neutral : primary} disabled={busy || allFired} onClick={() => doFire(n)}>
                    {allFired ? `Course ${n} fired` : `Fire course ${n}`}
                  </button>
                );
              })}
            </div>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400">Save course changes before firing. Firing stamps the course as sent to the kitchen.</p>
        </div>
      </Modal>

      {/* Order drawer (item picker with seat + course per line) */}
      {dialog === "order" && selected?.openSession && (
        <>
          <div className="fixed inset-0 z-[99999] bg-black/40" onClick={() => setDialog("table")} aria-hidden="true" />
          <TableOrderPicker
            transactionId={selected.openSession.transactionId}
            guestCount={selected.openSession.guestCount}
            tableLabel={`${selected.code} — ${selected.name}`}
            mode="drawer"
            onSent={onOrderSent}
            onClose={() => setDialog("table")}
          />
        </>
      )}

      {/* Bill by seat */}
      <Modal isOpen={dialog === "bill"} onClose={() => setDialog("table")} title={`Bill by seat — invoice #${trxId ?? ""}`} className="max-w-2xl"
        footer={<>
          <button className={neutral} onClick={() => setDialog("table")}>Back</button>
          <button className={neutral} onClick={startOrder}>Order more</button>
          <button className={primary} disabled={busy || !bill || !bill.seats.some((s) => s.seatNumber !== null)} onClick={() => doSplitBySeat("split")}>Split by seat</button>
        </>}>
        {billError && <div className="text-red-600 bg-red-50 p-3 rounded mb-3">{billError}</div>}
        {!bill && !billError && <div className="flex justify-center py-4"><Loader /></div>}
        {bill && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-sm text-center">
              <div className="rounded bg-gray-50 dark:bg-white/[0.03] p-2"><div className="text-xs text-gray-500 dark:text-gray-400">Invoice</div><div className="font-semibold">{money(bill.totalPrice)}</div></div>
              <div className="rounded bg-gray-50 dark:bg-white/[0.03] p-2"><div className="text-xs text-gray-500 dark:text-gray-400">On seats</div><div className="font-semibold">{money(bill.assignedTotal)}</div></div>
              <div className="rounded bg-gray-50 dark:bg-white/[0.03] p-2"><div className="text-xs text-gray-500 dark:text-gray-400">Table / unassigned</div><div className="font-semibold">{money(bill.unassignedTotal)}</div></div>
            </div>
            {bill.discountPercentage > 0 && <p className="text-xs text-gray-500 dark:text-gray-400">Invoice discount {bill.discountPercentage}% applied to each seat's net amount.</p>}
            {bill.seats.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">No items on this invoice yet.</p>}
            {bill.seats.map((s) => (
              <div key={s.label} className="border rounded border-gray-200 dark:border-white/[0.05]">
                <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-white/[0.03] text-sm">
                  <span className="font-semibold">{s.label}</span>
                  <span className="font-semibold">{money(s.net)}{s.net !== s.subtotal ? <span className="ml-1 text-xs text-gray-500 dark:text-gray-400 line-through">{money(s.subtotal)}</span> : null}</span>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                  {s.lines.map((l) => (
                    <div key={`${l.itemId}-${l.seatNumber ?? "t"}`} className="flex items-center justify-between px-3 py-1.5 text-sm">
                      <span>{l.quantity}× {l.itemName}
                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">course {l.courseNumber}{l.extrasPerUnit ? ` · +${money(l.extrasPerUnit)}/unit extras` : ""}{l.firedOn ? " · fired" : ""}</span>
                      </span>
                      <span>{money(l.lineTotal)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <p className="text-xs text-gray-500 dark:text-gray-400">Seat amounts come from item price × quantity plus the add-on / option extras stored on the invoice lines.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
