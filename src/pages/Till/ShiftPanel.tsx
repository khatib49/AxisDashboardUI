import { useCallback, useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import Modal from "../../components/ui/Modal";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import Loader from "../../components/ui/Loader";
import Alert from "../../components/ui/alert/Alert";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../components/ui/table";
import {
  openShift,
  getCurrentShift,
  payIn,
  payOut,
  getXReport,
  closeShift,
  errorMessage,
  type CashierShiftDto,
  type ShiftReportDto,
} from "../../services/tillService";
import { getRates, pickSecondaryRate } from "../../services/currencyService";
import { formatDual, formatUsd } from "../../utils/money";
import ShiftReportView from "./ShiftReportView";

type Notice = { variant: "success" | "error" | "warning" | "info"; title: string; message: string };

export default function ShiftPanel() {
  const [shift, setShift] = useState<CashierShiftDto | null>(null);
  const [report, setReport] = useState<ShiftReportDto | null>(null);
  const [zReport, setZReport] = useState<ShiftReportDto | null>(null);
  const [rate, setRate] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);

  const [register, setRegister] = useState(() => {
    try { return localStorage.getItem("till.register") || "Register 1"; } catch { return "Register 1"; }
  });
  const [openingFloat, setOpeningFloat] = useState("0");
  const [openNotes, setOpenNotes] = useState("");

  const [movement, setMovement] = useState<{ type: "PayIn" | "PayOut"; amount: string; reason: string } | null>(null);
  const [closing, setClosing] = useState<{ counted: string; notes: string } | null>(null);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const s = await getCurrentShift();
      setShift(s);
      if (s) {
        const x = await getXReport(s.id);
        setReport(x.success && x.data ? x.data : null);
      } else {
        setReport(null);
      }
    } catch (err) {
      setError(errorMessage(err, "Failed to load shift"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    getRates().then((c) => setRate(pickSecondaryRate(c))).catch(() => setRate(0));
  }, [refresh]);

  // Live X report: poll every 30s while a shift is open.
  useEffect(() => {
    if (!shift) return;
    const t = setInterval(() => {
      getXReport(shift.id).then((x) => { if (x.success && x.data) setReport(x.data); }).catch(() => undefined);
    }, 30000);
    return () => clearInterval(t);
  }, [shift]);

  async function handleOpen() {
    const f = parseFloat(openingFloat);
    if (!register.trim()) return setNotice({ variant: "error", title: "Validation", message: "Register name is required" });
    if (Number.isNaN(f) || f < 0) return setNotice({ variant: "error", title: "Validation", message: "Opening float must be 0 or more" });
    setBusy(true);
    try {
      const r = await openShift(register.trim(), f, openNotes);
      if (!r.success) return setNotice({ variant: "error", title: "Cannot open", message: r.error || r.message });
      try { localStorage.setItem("till.register", register.trim()); } catch { /* ignore */ }
      setZReport(null);
      setNotice({ variant: "success", title: "Shift opened", message: `Float ${formatUsd(f)} on ${register.trim()}` });
      await refresh();
    } catch (err) {
      setNotice({ variant: "error", title: "Cannot open", message: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  async function handleMovement() {
    if (!movement || !shift) return;
    const a = parseFloat(movement.amount);
    if (Number.isNaN(a) || a <= 0) return setNotice({ variant: "error", title: "Validation", message: "Amount must be greater than zero" });
    if (!movement.reason.trim()) return setNotice({ variant: "error", title: "Validation", message: "Reason is required" });
    setBusy(true);
    try {
      const r = movement.type === "PayIn" ? await payIn(a, movement.reason.trim(), shift.id) : await payOut(a, movement.reason.trim(), shift.id);
      if (!r.success) return setNotice({ variant: "error", title: "Failed", message: r.error || r.message });
      setMovement(null);
      setNotice({ variant: "success", title: movement.type === "PayIn" ? "Pay-in recorded" : "Pay-out recorded", message: formatUsd(a) });
      await refresh();
    } catch (err) {
      setNotice({ variant: "error", title: "Failed", message: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  async function handleClose() {
    if (!closing || !shift) return;
    const c = parseFloat(closing.counted);
    if (Number.isNaN(c) || c < 0) return setNotice({ variant: "error", title: "Validation", message: "Counted cash must be 0 or more" });
    setBusy(true);
    try {
      const r = await closeShift(c, closing.notes, shift.id);
      if (!r.success || !r.data) return setNotice({ variant: "error", title: "Cannot close", message: r.error || r.message });
      setClosing(null);
      setZReport(r.data);
      setNotice({ variant: "success", title: "Shift closed", message: `Variance ${formatUsd(r.data.variance ?? 0)}` });
      await refresh();
    } catch (err) {
      setNotice({ variant: "error", title: "Cannot close", message: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  const expectedPreview = report?.expectedCash ?? shift?.openingFloat ?? 0;

  return (
    <>
      <PageMeta title="Shift | Axis" description="Open, manage and close your cashier shift" />
      <PageBreadcrumb pageTitle="My Shift" />

      {notice && <div className="mb-4 print:hidden"><Alert variant={notice.variant} title={notice.title} message={notice.message} /></div>}
      {error && <div className="mb-4 print:hidden"><Alert variant="error" title="Error" message={error} /></div>}

      {loading ? (
        <div className="flex justify-center py-10"><Loader /></div>
      ) : zReport ? (
        <div className="space-y-4">
          <ShiftReportView report={zReport} rate={rate} onPrint={() => window.print()} />
          <div className="flex gap-2 print:hidden">
            <button onClick={() => setZReport(null)} className="rounded-lg bg-brand-500 px-4 py-2 text-sm text-white hover:bg-brand-600">Start a new shift</button>
          </div>
        </div>
      ) : !shift ? (
        <div className="max-w-lg rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white">Open a shift</h3>
          <div className="space-y-4">
            <div>
              <Label htmlFor="register">Register</Label>
              <Input id="register" value={register} onChange={(e) => setRegister(e.target.value)} placeholder="Register 1" />
            </div>
            <div>
              <Label htmlFor="float">Opening float (USD)</Label>
              <Input id="float" type="number" min="0" step={0.01} value={openingFloat} onChange={(e) => setOpeningFloat(e.target.value)} />
              {rate > 0 && <p className="mt-1 text-xs text-gray-500">{formatDual(parseFloat(openingFloat) || 0, rate)}</p>}
            </div>
            <div>
              <Label htmlFor="notes">Notes (optional)</Label>
              <Input id="notes" value={openNotes} onChange={(e) => setOpenNotes(e.target.value)} />
            </div>
            <button disabled={busy} onClick={handleOpen} className="rounded-lg bg-brand-500 px-4 py-2 text-sm text-white hover:bg-brand-600 disabled:opacity-50">
              {busy ? "Opening…" : "Open shift"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4 print:hidden">
            <Stat label="Register" value={shift.registerName} sub={`Opened ${new Date(shift.openedOn).toLocaleString()}`} />
            <Stat label="Opening float" value={formatUsd(shift.openingFloat)} sub={rate > 0 ? formatDual(shift.openingFloat, rate) : undefined} />
            <Stat label="Expected cash" value={formatUsd(expectedPreview)} sub={rate > 0 ? formatDual(expectedPreview, rate) : undefined} />
            <Stat label="Tendered (all methods)" value={formatUsd(report?.tenderedTotalInBase ?? 0)} sub={`${report?.transactionCount ?? 0} paid transactions`} />
          </div>

          <div className="flex flex-wrap gap-2 print:hidden">
            <button onClick={() => setMovement({ type: "PayIn", amount: "", reason: "" })} className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 dark:border-gray-600 dark:text-white dark:hover:bg-gray-700">+ Pay in</button>
            <button onClick={() => setMovement({ type: "PayOut", amount: "", reason: "" })} className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 dark:border-gray-600 dark:text-white dark:hover:bg-gray-700">− Pay out</button>
            <button onClick={() => void refresh()} className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 dark:border-gray-600 dark:text-white dark:hover:bg-gray-700">Refresh X report</button>
            <button onClick={() => setClosing({ counted: "", notes: "" })} className="ml-auto rounded-lg bg-error-500 px-4 py-2 text-sm text-white hover:bg-error-600">Close shift</button>
          </div>

          {report ? <ShiftReportView report={report} rate={rate} onPrint={() => window.print()} /> : <p className="text-sm text-gray-500">X report unavailable.</p>}

          <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 print:hidden">
            <h4 className="border-b border-gray-200 px-4 py-3 text-sm font-semibold dark:border-gray-700 dark:text-white">Cash movements</h4>
            {shift.movements.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-500">No pay-ins or pay-outs yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-gray-50 dark:bg-gray-900/40">
                    <TableRow>
                      <TableCell isHeader className="px-4 py-2 text-left text-xs">When</TableCell>
                      <TableCell isHeader className="px-4 py-2 text-left text-xs">Type</TableCell>
                      <TableCell isHeader className="px-4 py-2 text-right text-xs">Amount</TableCell>
                      <TableCell isHeader className="px-4 py-2 text-left text-xs">Reason</TableCell>
                      <TableCell isHeader className="px-4 py-2 text-left text-xs">By</TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shift.movements.map((m) => (
                      <TableRow key={m.id} className="border-t border-gray-100 dark:border-gray-700">
                        <TableCell className="px-4 py-2 text-sm">{new Date(m.createdOn).toLocaleTimeString()}</TableCell>
                        <TableCell className="px-4 py-2 text-sm">
                          <span className={`rounded px-2 py-0.5 text-xs ${m.type === "PayIn" ? "bg-success-50 text-success-700" : "bg-error-50 text-error-700"}`}>{m.type === "PayIn" ? "Pay in" : "Pay out"}</span>
                        </TableCell>
                        <TableCell className="px-4 py-2 text-right text-sm tabular-nums">{formatUsd(m.amount)}</TableCell>
                        <TableCell className="px-4 py-2 text-sm">{m.reason}</TableCell>
                        <TableCell className="px-4 py-2 text-sm text-gray-500">{m.createdBy}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      )}

      <Modal
        isOpen={!!movement}
        onClose={() => setMovement(null)}
        title={movement?.type === "PayIn" ? "Pay in (add cash to drawer)" : "Pay out (take cash from drawer)"}
        className="max-w-md"
        footer={
          <>
            <button onClick={() => setMovement(null)} className="rounded-lg border px-4 py-2 text-sm dark:border-gray-600 dark:text-white">Cancel</button>
            <button disabled={busy} onClick={handleMovement} className="rounded-lg bg-brand-500 px-4 py-2 text-sm text-white disabled:opacity-50">{busy ? "Saving…" : "Save"}</button>
          </>
        }
      >
        {movement && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="mv-amount">Amount (USD)</Label>
              <Input id="mv-amount" type="number" min="0" step={0.01} value={movement.amount} onChange={(e) => setMovement({ ...movement, amount: e.target.value })} />
              {rate > 0 && <p className="mt-1 text-xs text-gray-500">{formatDual(parseFloat(movement.amount) || 0, rate)}</p>}
            </div>
            <div>
              <Label htmlFor="mv-reason">Reason</Label>
              <Input id="mv-reason" value={movement.reason} onChange={(e) => setMovement({ ...movement, reason: e.target.value })} placeholder={movement.type === "PayIn" ? "Change from safe" : "Supplier paid in cash"} />
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!closing}
        onClose={() => setClosing(null)}
        title="Close shift"
        className="max-w-md"
        footer={
          <>
            <button onClick={() => setClosing(null)} className="rounded-lg border px-4 py-2 text-sm dark:border-gray-600 dark:text-white">Cancel</button>
            <button disabled={busy} onClick={handleClose} className="rounded-lg bg-error-500 px-4 py-2 text-sm text-white disabled:opacity-50">{busy ? "Closing…" : "Close & print Z"}</button>
          </>
        }
      >
        {closing && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">Count the cash in the drawer (all currencies converted to USD). The expected amount is <strong>{formatUsd(expectedPreview)}</strong>{rate > 0 ? ` (${formatDual(expectedPreview, rate)})` : ""}.</p>
            <div>
              <Label htmlFor="counted">Counted cash (USD)</Label>
              <Input id="counted" type="number" min="0" step={0.01} value={closing.counted} onChange={(e) => setClosing({ ...closing, counted: e.target.value })} />
              {closing.counted !== "" && !Number.isNaN(parseFloat(closing.counted)) && (
                <p className="mt-1 text-xs text-gray-500">Variance: {formatUsd(parseFloat(closing.counted) - expectedPreview)}</p>
              )}
            </div>
            <div>
              <Label htmlFor="close-notes">Notes (optional)</Label>
              <Input id="close-notes" value={closing.notes} onChange={(e) => setClosing({ ...closing, notes: e.target.value })} />
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  );
}
