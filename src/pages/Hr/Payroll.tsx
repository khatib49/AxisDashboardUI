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
  HrPayrollRun, HrPayrollLine, getPayrollRuns, getPayrollRun, generatePayrollRun, deletePayrollRun, adjustPayrollLine,
  approvePayrollRun, markPayrollRunPaid, getPayslipHtml, downloadPayrollCsv, errorMessage,
} from "../../services/hrService";

type Notice = { variant: "success" | "error" | "warning" | "info"; title: string; message: string };
const btn = "rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50";
const btnPrimary = `${btn} bg-brand-500 text-white hover:bg-brand-600`;
const btnGhost = `${btn} border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/5`;
const btnSuccess = `${btn} bg-success-500 text-white hover:bg-success-600`;
const th = "px-3 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400";
const td = "px-3 py-3 text-sm text-gray-700 dark:text-gray-300";
const tdNum = `${td} text-right tabular-nums`;
const selectCls = "h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white/90";
const card = "rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03] text-gray-800 dark:text-white/90";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const money = (n: number | null | undefined) => (n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const monthLabel = (r: { year: number; month: number }) => `${MONTHS[r.month - 1]} ${r.year}`;

function StatusPill({ status }: { status: string }) {
  const cls = status === "Paid" ? "bg-success-50 text-success-600 dark:bg-success-500/15"
    : status === "Approved" ? "bg-blue-light-50 text-blue-light-600 dark:bg-blue-light-500/15"
    : "bg-warning-50 text-warning-600 dark:bg-warning-500/15";
  return <span className={`rounded-full px-2 py-0.5 text-xs ${cls}`}>{status}</span>;
}

export default function Payroll() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [runs, setRuns] = useState<HrPayrollRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);

  const [gen, setGen] = useState<{ year: number; month: number; notes: string } | null>(null);
  const [run, setRun] = useState<HrPayrollRun | null>(null);
  const [runLoading, setRunLoading] = useState(false);
  const [adjust, setAdjust] = useState<HrPayrollLine | null>(null);
  const [af, setAf] = useState({ notes: "", isExcluded: false, manualAllowance: "", manualDeduction: "" });
  const [payModal, setPayModal] = useState(false);
  const [cashAccount, setCashAccount] = useState("1000");
  const [slip, setSlip] = useState<{ name: string; html: string } | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "approve" | "delete" } | null>(null);
  const [showBreakdown, setShowBreakdown] = useState<number | null>(null);

  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(null), 4000); return () => clearTimeout(t); }, [notice]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setRuns(await getPayrollRuns(year)); }
    catch (e) { setError(errorMessage(e, "Failed to load payroll runs")); setRuns([]); }
    finally { setLoading(false); }
  }, [year]);
  useEffect(() => { void load(); }, [load]);

  async function openRun(id: number) {
    setRunLoading(true);
    try { setRun(await getPayrollRun(id)); }
    catch (e) { setNotice({ variant: "error", title: "Load failed", message: errorMessage(e) }); setRun(null); }
    finally { setRunLoading(false); }
  }

  async function refreshRun() { if (run) await openRun(run.id); await load(); }

  async function doGenerate() {
    if (!gen) return;
    setBusy(true);
    try {
      const r = await generatePayrollRun(gen.year, gen.month, gen.notes || null);
      if (!r.success) throw new Error(r.message);
      setNotice({ variant: "success", title: "Generated", message: r.message });
      setGen(null); setRun(r.data ?? null); await load();
    } catch (e) { setNotice({ variant: "error", title: "Generate failed", message: errorMessage(e) }); }
    finally { setBusy(false); }
  }

  async function act(fn: () => Promise<{ success: boolean; message: string; data?: HrPayrollRun | null }>, title: string) {
    setBusy(true);
    try {
      const r = await fn();
      if (!r.success) throw new Error(r.message);
      setNotice({ variant: "success", title, message: r.message });
      if (r.data) setRun(r.data); else await refreshRun();
      await load();
    } catch (e) { setNotice({ variant: "error", title: `${title} failed`, message: errorMessage(e) }); }
    finally { setBusy(false); }
  }

  function openAdjust(l: HrPayrollLine) {
    setAdjust(l);
    setAf({ notes: l.notes ?? "", isExcluded: l.isExcluded, manualAllowance: l.manualAllowance ? String(l.manualAllowance) : "", manualDeduction: l.manualDeduction ? String(l.manualDeduction) : "" });
  }

  async function saveAdjust() {
    if (!run || !adjust) return;
    setBusy(true);
    try {
      const r = await adjustPayrollLine(run.id, adjust.id, {
        notes: af.notes, isExcluded: af.isExcluded,
        manualAllowance: af.manualAllowance === "" ? 0 : Number(af.manualAllowance),
        manualDeduction: af.manualDeduction === "" ? 0 : Number(af.manualDeduction),
      });
      if (!r.success) throw new Error(r.message);
      setAdjust(null); await refreshRun();
    } catch (e) { setNotice({ variant: "error", title: "Adjustment failed", message: errorMessage(e) }); }
    finally { setBusy(false); }
  }

  async function previewSlip(l: HrPayrollLine) {
    if (!run) return;
    try { setSlip({ name: l.employeeName, html: await getPayslipHtml(run.id, l.employeeId) }); }
    catch (e) { setNotice({ variant: "error", title: "Payslip", message: errorMessage(e) }); }
  }

  async function exportCsv() {
    if (!run) return;
    try {
      const blob = await downloadPayrollCsv(run.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `payroll_${run.year}-${String(run.month).padStart(2, "0")}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setNotice({ variant: "error", title: "Export failed", message: errorMessage(e) }); }
  }

  async function confirmAction() {
    if (!run || !confirm) return;
    const kind = confirm.kind; setConfirm(null);
    if (kind === "approve") await act(() => approvePayrollRun(run.id), "Approve");
    else {
      setBusy(true);
      try { const r = await deletePayrollRun(run.id); if (!r.success) throw new Error(r.message); setRun(null); await load(); }
      catch (e) { setNotice({ variant: "error", title: "Delete failed", message: errorMessage(e) }); }
      finally { setBusy(false); }
    }
  }

  const isDraft = run?.status === "Draft";
  const lines = run?.lines ?? [];

  return (
    <div>
      <PageMeta title="Payroll | Axis" description="Monthly payroll runs, approval and payment" />
      <PageBreadcrumb pageTitle="Payroll" />
      {notice && <div className="mb-4"><Alert variant={notice.variant} title={notice.title} message={notice.message} /></div>}

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-32"><Label>Year</Label><Input type="number" value={String(year)} onChange={(e) => setYear(Number(e.target.value) || now.getFullYear())} /></div>
        <div className="ml-auto flex gap-2">
          <button className={btnPrimary} onClick={() => setGen({ year: now.getFullYear(), month: now.getMonth() + 1, notes: "" })}>Generate month</button>
        </div>
      </div>

      {error && <Alert variant="error" title="Error" message={error} />}
      {loading ? <div className="flex justify-center py-10"><Loader /></div> : runs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-gray-500 dark:text-gray-400 dark:border-gray-700">No payroll runs in {year}. Generate one for a month to get started.</div>
      ) : (
        <div className={`${card} overflow-x-auto p-0`}>
          <Table>
            <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]"><TableRow>
              {["Month", "Status", "Staff", "Gross", "Deductions", "Net", "Generated", "Approved", "Paid", ""].map((h) => <TableCell key={h} isHeader className={th}>{h}</TableCell>)}
            </TableRow></TableHeader>
            <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
              {runs.map((r) => (
                <TableRow key={r.id} className={run?.id === r.id ? "bg-brand-50/40 dark:bg-brand-500/10" : ""}>
                  <TableCell className={td}><button className="font-medium hover:underline" onClick={() => openRun(r.id)}>{monthLabel(r)}</button></TableCell>
                  <TableCell className={td}><StatusPill status={r.status} /></TableCell>
                  <TableCell className={td}>{r.employeeCount}{r.excludedCount ? <span className="text-xs text-gray-400"> (+{r.excludedCount} excl.)</span> : null}</TableCell>
                  <TableCell className={tdNum}>{money(r.totalGross)}</TableCell>
                  <TableCell className={tdNum}>{money(r.totalDeductions)}</TableCell>
                  <TableCell className={`${tdNum} font-semibold`}>{money(r.totalNet)}</TableCell>
                  <TableCell className={td}>{new Date(r.generatedOn).toLocaleDateString()}</TableCell>
                  <TableCell className={td}>{r.approvedOn ? new Date(r.approvedOn).toLocaleDateString() : "—"}</TableCell>
                  <TableCell className={td}>{r.paidOn ? new Date(r.paidOn).toLocaleDateString() : "—"}</TableCell>
                  <TableCell className="px-3 py-3 text-right text-sm"><button className="text-brand-500 dark:text-brand-400 hover:underline" onClick={() => openRun(r.id)}>Open</button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {runLoading && <div className="flex justify-center py-6"><Loader /></div>}
      {run && !runLoading && (
        <div className="mt-6">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">{monthLabel(run)} <StatusPill status={run.status} /></h3>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              generated {new Date(run.generatedOn).toLocaleString()} {run.generatedBy ? `by ${run.generatedBy}` : ""}
              {run.approvedOn ? ` · approved ${new Date(run.approvedOn).toLocaleString()} by ${run.approvedBy ?? ""} (JE #${run.journalEntryId ?? "-"})` : ""}
              {run.paidOn ? ` · paid ${new Date(run.paidOn).toLocaleString()} by ${run.paidBy ?? ""} (JE #${run.paymentJournalEntryId ?? "-"})` : ""}
            </span>
            <div className="ml-auto flex flex-wrap gap-2">
              <button className={btnGhost} onClick={exportCsv}>CSV</button>
              {isDraft && <button className={btnGhost} disabled={busy} onClick={() => setGen({ year: run.year, month: run.month, notes: run.notes ?? "" })}>Regenerate</button>}
              {isDraft && <button className={btnGhost} disabled={busy} onClick={() => setConfirm({ kind: "delete" })}>Delete</button>}
              {isDraft && <button className={btnSuccess} disabled={busy} onClick={() => setConfirm({ kind: "approve" })}>Approve &amp; post</button>}
              {run.status === "Approved" && <button className={btnSuccess} disabled={busy} onClick={() => setPayModal(true)}>Mark paid</button>}
              <button className={btnGhost} onClick={() => setRun(null)}>Close</button>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className={card}><div className="text-xs uppercase text-gray-500 dark:text-gray-400">Gross</div><div className="text-xl font-semibold">{money(run.totalGross)}</div></div>
            <div className={card}><div className="text-xs uppercase text-gray-500 dark:text-gray-400">Deductions</div><div className="text-xl font-semibold">{money(run.totalDeductions)}</div><div className="text-xs text-gray-500 dark:text-gray-400">statutory {money(run.totalStatutory)}</div></div>
            <div className={card}><div className="text-xs uppercase text-gray-500 dark:text-gray-400">Net pay</div><div className="text-xl font-semibold">{money(run.totalNet)}</div></div>
            <div className={card}><div className="text-xs uppercase text-gray-500 dark:text-gray-400">Employees</div><div className="text-xl font-semibold">{run.employeeCount}</div><div className="text-xs text-gray-500 dark:text-gray-400">{run.excludedCount} excluded</div></div>
          </div>

          {lines.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-500 dark:text-gray-400 dark:border-gray-700">No active employees for this month.</div>
          ) : (
            <div className={`${card} overflow-x-auto p-0`}>
              <Table>
                <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]"><TableRow>
                  {["Employee", "Hours", "Base", "OT", "Allowances", "Deductions", "Gross", "Net", ""].map((h) => <TableCell key={h} isHeader className={th}>{h}</TableCell>)}
                </TableRow></TableHeader>
                <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                  {lines.map((l) => (
                    <TableRow key={l.id} className={l.isExcluded ? "opacity-50" : ""}>
                      <TableCell className={td}>
                        <button className="font-medium hover:underline" onClick={() => setShowBreakdown(showBreakdown === l.id ? null : l.id)}>{l.employeeName}</button>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{l.position || ""}{l.monthlySalary ? ` · salary ${money(l.monthlySalary)}` : l.hourlyRate ? ` · ${money(l.hourlyRate)}/h` : " · no rate"}{l.isExcluded ? " · EXCLUDED" : ""}</div>
                        {showBreakdown === l.id && (
                          <ul className="mt-2 space-y-0.5 text-xs text-gray-600 dark:text-gray-300">
                            {l.components.length === 0 && <li>No allowances or deductions.</li>}
                            {l.components.map((c, i) => <li key={i}>{c.kind === "Allowance" ? "+" : "−"} {c.name}{c.method === "PercentOfGross" ? ` (${c.rate}%)` : ""}: <b>{money(c.amount)}</b> <span className="text-gray-400">{c.source}{c.isStatutory ? " · statutory" : ""}</span></li>)}
                            {l.notes && <li className="italic">{l.notes}</li>}
                          </ul>
                        )}
                      </TableCell>
                      <TableCell className={tdNum}>{l.hoursWorked.toFixed(2)}</TableCell>
                      <TableCell className={tdNum}>{money(l.basePay)}</TableCell>
                      <TableCell className={tdNum}>{l.overtimePay ? <>{money(l.overtimePay)}<div className="text-xs text-gray-400">{l.overtimeHours.toFixed(2)} h</div></> : "—"}</TableCell>
                      <TableCell className={tdNum}>{money(l.allowances)}</TableCell>
                      <TableCell className={tdNum}>{money(l.deductions)}{l.advancesRecovered ? <div className="text-xs text-gray-400">adv. {money(l.advancesRecovered)}</div> : null}</TableCell>
                      <TableCell className={tdNum}>{money(l.gross)}</TableCell>
                      <TableCell className={`${tdNum} font-semibold`}>{money(l.net)}</TableCell>
                      <TableCell className="px-3 py-3 text-right text-sm whitespace-nowrap">
                        <span className="flex justify-end gap-3">
                          <button className="text-gray-500 dark:text-gray-400 hover:underline" onClick={() => previewSlip(l)}>Payslip</button>
                          {isDraft && <button className="text-brand-500 dark:text-brand-400 hover:underline" disabled={busy} onClick={() => openAdjust(l)}>Adjust</button>}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {run.notes && <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{run.notes}</p>}
        </div>
      )}

      <Modal isOpen={!!gen} onClose={() => setGen(null)} title="Generate payroll" className="max-w-md"
        footer={<><button className={btnGhost} onClick={() => setGen(null)}>Cancel</button><button className={btnPrimary} disabled={busy} onClick={doGenerate}>Generate</button></>}>
        {gen && (
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Year</Label><Input type="number" value={String(gen.year)} onChange={(e) => setGen({ ...gen, year: Number(e.target.value) || gen.year })} /></div>
            <div><Label>Month</Label>
              <select className={selectCls} value={gen.month} onChange={(e) => setGen({ ...gen, month: Number(e.target.value) })}>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div className="col-span-2"><Label>Notes</Label><Input value={gen.notes} onChange={(e) => setGen({ ...gen, notes: e.target.value })} /></div>
            <p className="col-span-2 text-xs text-gray-500 dark:text-gray-400">Base pay = monthly salary, or closed attendance hours × hourly rate (hours above 208/month at 1.5×). Allowances, deductions and advances of the month are applied. Regenerating a draft keeps exclusions and manual adjustments.</p>
          </div>
        )}
      </Modal>

      <Modal isOpen={!!adjust} onClose={() => setAdjust(null)} title={adjust ? `Adjust — ${adjust.employeeName}` : "Adjust"} className="max-w-md"
        footer={<><button className={btnGhost} onClick={() => setAdjust(null)}>Cancel</button><button className={btnPrimary} disabled={busy} onClick={saveAdjust}>Save</button></>}>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Extra allowance</Label><Input type="number" step={0.01} min="0" value={af.manualAllowance} onChange={(e) => setAf((f) => ({ ...f, manualAllowance: e.target.value }))} /></div>
          <div><Label>Extra deduction</Label><Input type="number" step={0.01} min="0" value={af.manualDeduction} onChange={(e) => setAf((f) => ({ ...f, manualDeduction: e.target.value }))} /></div>
          <div className="col-span-2"><Label>Notes</Label><Input value={af.notes} onChange={(e) => setAf((f) => ({ ...f, notes: e.target.value }))} /></div>
          <label className="col-span-2 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"><input type="checkbox" checked={af.isExcluded} onChange={(e) => setAf((f) => ({ ...f, isExcluded: e.target.checked }))} /> Exclude from this run</label>
        </div>
      </Modal>

      <Modal isOpen={payModal} onClose={() => setPayModal(false)} title="Mark payroll as paid" className="max-w-md"
        footer={<><button className={btnGhost} onClick={() => setPayModal(false)}>Cancel</button><button className={btnSuccess} disabled={busy} onClick={async () => { setPayModal(false); if (run) await act(() => markPayrollRunPaid(run.id, cashAccount), "Mark paid"); }}>Post payment</button></>}>
        <div><Label>Cash / bank account number</Label><Input value={cashAccount} onChange={(e) => setCashAccount(e.target.value)} /></div>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Posts DR Salaries Payable / CR {cashAccount || "1000"} for the net pay {run ? money(run.totalNet) : ""}.</p>
      </Modal>

      <Modal isOpen={!!confirm} onClose={() => setConfirm(null)} title={confirm?.kind === "approve" ? "Approve payroll" : "Delete draft run"} className="max-w-md"
        footer={<><button className={btnGhost} onClick={() => setConfirm(null)}>Cancel</button><button className={confirm?.kind === "approve" ? btnSuccess : `${btn} bg-error-500 text-white`} disabled={busy} onClick={confirmAction}>{confirm?.kind === "approve" ? "Approve & post" : "Delete"}</button></>}>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {confirm?.kind === "approve"
            ? `Approving posts a journal entry: DR Salaries & Wages Expense ${run ? money(run.totalGross) : ""} / CR Salaries Payable and Statutory Deductions Payable. The run is frozen afterwards.`
            : "Delete this draft run? Advances it recovered are released again."}
        </p>
      </Modal>

      <Modal isOpen={!!slip} onClose={() => setSlip(null)} title={slip ? `Payslip — ${slip.name}` : "Payslip"} className="max-w-3xl"
        footer={<><button className={btnGhost} onClick={() => setSlip(null)}>Close</button><button className={btnPrimary} onClick={() => { const w = window.open("", "_blank"); if (w && slip) { w.document.write(slip.html); w.document.close(); } }}>Open / print</button></>}>
        {slip && <iframe title="payslip" srcDoc={slip.html} className="h-[60vh] w-full rounded border border-gray-200 bg-white dark:border-gray-700" />}
      </Modal>
    </div>
  );
}
