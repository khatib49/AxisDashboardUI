import { useCallback, useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import Modal from "../../components/ui/Modal";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import Loader from "../../components/ui/Loader";
import Alert from "../../components/ui/alert/Alert";
import DeleteIconButton from "../../components/ui/DeleteIconButton";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../components/ui/table";
import {
  HrAttendance, HrDailySummaryRow, HrTimesheet, HrEmployee, getAttendance, getDailySummary, getTimesheet, getEmployees,
  addManualAttendance, updateAttendance, deleteAttendance, downloadAttendanceCsv, toDateOnly, addDays, errorMessage,
} from "../../services/hrService";

type Notice = { variant: "success" | "error" | "warning" | "info"; title: string; message: string };
type Tab = "records" | "daily" | "timesheet";
const btn = "rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50";
const btnPrimary = `${btn} bg-brand-500 text-white hover:bg-brand-600`;
const btnGhost = `${btn} border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/5`;
const th = "px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400";
const td = "px-4 py-3 text-sm text-gray-700 dark:text-gray-300";
const selectCls = "h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white/90";

const fmtT = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—");
const fmtD = (iso: string) => new Date(iso).toLocaleDateString();
const hm = (m: number) => `${Math.floor(m / 60)}h ${m % 60}m`;
const toLocalInput = (iso?: string | null) => { if (!iso) return ""; const d = new Date(iso); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const fromLocalInput = (s: string) => (s ? new Date(s).toISOString() : null);

export default function Attendance() {
  const today = toDateOnly(new Date());
  const [tab, setTab] = useState<Tab>("records");
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [from, setFrom] = useState(addDays(today, -6));
  const [to, setTo] = useState(today);
  const [employeeId, setEmployeeId] = useState("");
  const [records, setRecords] = useState<HrAttendance[]>([]);

  const [day, setDay] = useState(today);
  const [daily, setDaily] = useState<HrDailySummaryRow[]>([]);

  const [tsEmployee, setTsEmployee] = useState("");
  const [tsMonth, setTsMonth] = useState(today.slice(0, 7));
  const [sheet, setSheet] = useState<HrTimesheet | null>(null);

  const [editor, setEditor] = useState<{ rec?: HrAttendance } | null>(null);
  const [ef, setEf] = useState({ employeeId: "", clockIn: "", clockOut: "", notes: "" });
  const [deleteId, setDeleteId] = useState<number | null>(null);

  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(null), 3500); return () => clearTimeout(t); }, [notice]);
  useEffect(() => { getEmployees(undefined, true, 1, 500).then((r) => setEmployees(r.data ?? [])).catch(() => setEmployees([])); }, []);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      if (tab === "records") setRecords(await getAttendance(from, to, employeeId ? Number(employeeId) : undefined));
      else if (tab === "daily") setDaily(await getDailySummary(day));
      else if (tsEmployee) { const [y, m] = tsMonth.split("-").map(Number); setSheet(await getTimesheet(Number(tsEmployee), y, m)); }
      else setSheet(null);
    } catch (e) { setError(errorMessage(e, "Failed to load attendance")); }
    finally { setLoading(false); }
  }, [tab, from, to, employeeId, day, tsEmployee, tsMonth]);

  useEffect(() => { void load(); }, [load]);

  function openAdd() { setEditor({}); setEf({ employeeId: employeeId || String(employees[0]?.id ?? ""), clockIn: toLocalInput(new Date().toISOString()), clockOut: "", notes: "" }); }
  function openEdit(rec: HrAttendance) { setEditor({ rec }); setEf({ employeeId: String(rec.employeeId), clockIn: toLocalInput(rec.clockIn), clockOut: toLocalInput(rec.clockOut), notes: rec.notes ?? "" }); }

  async function save() {
    if (!editor) return;
    if (!ef.clockIn) { setNotice({ variant: "error", title: "Validation", message: "Clock in is required" }); return; }
    setBusy(true);
    try {
      const r = editor.rec
        ? await updateAttendance(editor.rec.id, { clockIn: fromLocalInput(ef.clockIn), clockOut: fromLocalInput(ef.clockOut), notes: ef.notes })
        : await addManualAttendance({ employeeId: Number(ef.employeeId), clockIn: fromLocalInput(ef.clockIn)!, clockOut: fromLocalInput(ef.clockOut), notes: ef.notes || null });
      if (!r.success) throw new Error(r.message);
      setEditor(null); setNotice({ variant: "success", title: "Saved", message: r.message }); await load();
    } catch (e) { setNotice({ variant: "error", title: "Save failed", message: errorMessage(e) }); }
    finally { setBusy(false); }
  }

  async function confirmDelete() {
    if (deleteId == null) return;
    setBusy(true);
    try { await deleteAttendance(deleteId); setDeleteId(null); await load(); }
    catch (e) { setNotice({ variant: "error", title: "Delete failed", message: errorMessage(e) }); }
    finally { setBusy(false); }
  }

  async function exportCsv(f: string, t: string, emp?: number) {
    setBusy(true);
    try {
      const blob = await downloadAttendanceCsv(f, t, emp);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `attendance_${f}_${t}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setNotice({ variant: "error", title: "Export failed", message: errorMessage(e) }); }
    finally { setBusy(false); }
  }

  const empSelect = (value: string, onChange: (v: string) => void, allowAll: boolean) => (
    <select className={selectCls} value={value} onChange={(e) => onChange(e.target.value)}>
      {allowAll && <option value="">All employees</option>}
      {!allowAll && <option value="">Select employee…</option>}
      {employees.map((e) => <option key={e.id} value={e.id}>{e.fullName}{e.isActive ? "" : " (inactive)"}</option>)}
    </select>
  );

  const empty = (msg: string) => <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-gray-500 dark:text-gray-400 dark:border-gray-700">{msg}</div>;
  const wrap = (children: React.ReactNode) => <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] text-gray-800 dark:text-white/90">{children}</div>;

  return (
    <div>
      <PageMeta title="Attendance | Axis" description="Staff attendance records" />
      <PageBreadcrumb pageTitle="Attendance" />
      {notice && <div className="mb-4"><Alert variant={notice.variant} title={notice.title} message={notice.message} /></div>}

      <div className="mb-4 flex gap-1 border-b border-gray-200 dark:border-gray-800">
        {([["records", "Records"], ["daily", "Daily summary"], ["timesheet", "Monthly timesheet"]] as [Tab, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`-mb-px border-b-2 px-4 py-2 text-sm ${tab === k ? "border-brand-500 text-brand-500 dark:text-brand-400" : "border-transparent text-gray-500 dark:text-gray-400"}`}>{l}</button>
        ))}
      </div>

      {tab === "records" && (
        <>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div className="w-40"><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div className="w-40"><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            <div className="w-56"><Label>Employee</Label>{empSelect(employeeId, setEmployeeId, true)}</div>
            <div className="ml-auto flex gap-2">
              <button className={btnGhost} disabled={busy} onClick={() => exportCsv(from, to, employeeId ? Number(employeeId) : undefined)}>Export CSV</button>
              <button className={btnPrimary} onClick={openAdd}>Add record</button>
            </div>
          </div>
          {error && <Alert variant="error" title="Error" message={error} />}
          {loading ? <div className="flex justify-center py-10"><Loader /></div> : records.length === 0 ? empty("No attendance in this range.") : wrap(
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]"><TableRow>{["Employee", "Date", "In", "Out", "Worked", "Source", "Device", "Notes", ""].map((h) => <TableCell key={h} isHeader className={th}>{h}</TableCell>)}</TableRow></TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {records.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className={td}><button className="font-medium hover:underline" onClick={() => openEdit(r)}>{r.employeeName}</button></TableCell>
                    <TableCell className={td}>{fmtD(r.clockIn)}</TableCell>
                    <TableCell className={td}>{fmtT(r.clockIn)}</TableCell>
                    <TableCell className={td}>{r.clockOut ? fmtT(r.clockOut) : <span className="text-warning-500">open</span>}</TableCell>
                    <TableCell className={td}>{r.workedMinutes != null ? hm(r.workedMinutes) : "—"}</TableCell>
                    <TableCell className={td}>{r.source}</TableCell>
                    <TableCell className={td}>{r.deviceName || "—"}</TableCell>
                    <TableCell className={td}>{r.notes || ""}</TableCell>
                    <TableCell className="px-4 py-3 text-right"><DeleteIconButton onClick={() => setDeleteId(r.id)} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}

      {tab === "daily" && (
        <>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div className="w-40"><Label>Date</Label><Input type="date" value={day} onChange={(e) => setDay(e.target.value)} /></div>
            <button className={btnGhost} onClick={() => setDay(addDays(day, -1))}>‹</button>
            <button className={btnGhost} onClick={() => setDay(addDays(day, 1))}>›</button>
          </div>
          {error && <Alert variant="error" title="Error" message={error} />}
          {loading ? <div className="flex justify-center py-10"><Loader /></div> : daily.length === 0 ? empty("Nothing scheduled or recorded on this day.") : wrap(
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]"><TableRow>{["Employee", "Scheduled", "First in", "Last out", "Worked", "Late", "Status"].map((h) => <TableCell key={h} isHeader className={th}>{h}</TableCell>)}</TableRow></TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {daily.map((r) => (
                  <TableRow key={r.employeeId}>
                    <TableCell className={td}>{r.employeeName}</TableCell>
                    <TableCell className={td}>{r.scheduledStart ? `${fmtT(r.scheduledStart)}–${fmtT(r.scheduledEnd)}` : "—"}</TableCell>
                    <TableCell className={td}>{fmtT(r.firstClockIn)}</TableCell>
                    <TableCell className={td}>{fmtT(r.lastClockOut)}</TableCell>
                    <TableCell className={td}>{hm(r.workedMinutes)}</TableCell>
                    <TableCell className={td}>{r.lateMinutes > 0 ? <span className="text-error-500">{r.lateMinutes} min</span> : "—"}</TableCell>
                    <TableCell className={td}>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${r.status === "Present" ? "bg-success-50 text-success-600 dark:bg-success-500/15" : r.status === "Open" ? "bg-warning-50 text-warning-600 dark:bg-warning-500/15" : "bg-error-50 text-error-600 dark:bg-error-500/15"}`}>{r.status}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}

      {tab === "timesheet" && (
        <>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div className="w-56"><Label>Employee</Label>{empSelect(tsEmployee, setTsEmployee, false)}</div>
            <div className="w-44"><Label>Month</Label><Input type="month" value={tsMonth} onChange={(e) => e.target.value && setTsMonth(e.target.value)} /></div>
            <div className="ml-auto">
              <button className={btnGhost} disabled={busy || !tsEmployee} onClick={() => { const [y, m] = tsMonth.split("-").map(Number); const f = `${tsMonth}-01`; const t = toDateOnly(new Date(y, m, 0)); exportCsv(f, t, Number(tsEmployee)); }}>Export CSV (payroll)</button>
            </div>
          </div>
          {error && <Alert variant="error" title="Error" message={error} />}
          {loading ? <div className="flex justify-center py-10"><Loader /></div> : !sheet ? empty("Pick an employee to see their timesheet.") : (
            <>
              <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                {[["Employee", sheet.employeeName], ["Hourly rate", sheet.hourlyRate != null ? String(sheet.hourlyRate) : "—"], ["Total hours", hm(sheet.totalMinutes)], ["Amount", sheet.totalAmount.toFixed(2)]].map(([l, v]) => (
                  <div key={l} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03] text-gray-800 dark:text-white/90"><div className="text-xs uppercase text-gray-500 dark:text-gray-400">{l}</div><div className="text-lg font-semibold text-gray-800 dark:text-white/90">{v}</div></div>
                ))}
              </div>
              {sheet.rows.length === 0 ? empty("No attendance this month.") : wrap(
                <Table>
                  <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]"><TableRow>{["Date", "In", "Out", "Minutes", "Amount"].map((h) => <TableCell key={h} isHeader className={th}>{h}</TableCell>)}</TableRow></TableHeader>
                  <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                    {sheet.rows.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className={td}>{r.date}</TableCell>
                        <TableCell className={td}>{fmtT(r.clockIn)}</TableCell>
                        <TableCell className={td}>{fmtT(r.clockOut)}</TableCell>
                        <TableCell className={td}>{r.minutes}</TableCell>
                        <TableCell className={td}>{r.amount.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </>
          )}
        </>
      )}

      <Modal isOpen={!!editor} onClose={() => setEditor(null)} title={editor?.rec ? "Edit attendance" : "Manual attendance"} className="max-w-md"
        footer={<><button className={btnGhost} onClick={() => setEditor(null)}>Cancel</button><button className={btnPrimary} disabled={busy} onClick={save}>Save</button></>}>
        <div className="grid gap-3">
          {!editor?.rec && <div><Label>Employee</Label>{empSelect(ef.employeeId, (v) => setEf((f) => ({ ...f, employeeId: v })), false)}</div>}
          <div><Label>Clock in</Label><Input type="datetime-local" value={ef.clockIn} onChange={(e) => setEf((f) => ({ ...f, clockIn: e.target.value }))} /></div>
          <div><Label>Clock out (leave empty if still working)</Label><Input type="datetime-local" value={ef.clockOut} onChange={(e) => setEf((f) => ({ ...f, clockOut: e.target.value }))} /></div>
          <div><Label>Notes</Label><Input value={ef.notes} onChange={(e) => setEf((f) => ({ ...f, notes: e.target.value }))} /></div>
        </div>
      </Modal>

      <Modal isOpen={deleteId != null} onClose={() => setDeleteId(null)} title="Delete record" className="max-w-md"
        footer={<><button className={btnGhost} onClick={() => setDeleteId(null)}>Cancel</button><button className={`${btn} bg-error-500 text-white`} disabled={busy} onClick={confirmDelete}>Delete</button></>}>
        <p className="text-sm text-gray-600 dark:text-gray-300">This attendance record will be removed permanently.</p>
      </Modal>
    </div>
  );
}
