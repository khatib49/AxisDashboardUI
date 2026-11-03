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
  HrLeaveRequest, HrLeaveType, HrLeaveBalance, HrEmployee, getLeaveRequests, getLeaveTypes, getLeaveBalances, getEmployees,
  createLeaveRequest, decideLeaveRequest, cancelLeaveRequest, createLeaveType, updateLeaveType, deleteLeaveType, toDateOnly, errorMessage,
} from "../../services/hrService";

type Notice = { variant: "success" | "error" | "warning" | "info"; title: string; message: string };
type Tab = "requests" | "balances" | "types";
const btn = "rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50";
const btnPrimary = `${btn} bg-brand-500 text-white hover:bg-brand-600`;
const btnGhost = `${btn} border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/5`;
const th = "px-4 py-3 text-left text-xs font-medium uppercase text-gray-500";
const td = "px-4 py-3 text-sm text-gray-700 dark:text-gray-300";
const selectCls = "h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white/90";

const statusCls: Record<string, string> = {
  Pending: "bg-warning-50 text-warning-600 dark:bg-warning-500/15",
  Approved: "bg-success-50 text-success-600 dark:bg-success-500/15",
  Rejected: "bg-error-50 text-error-600 dark:bg-error-500/15",
  Cancelled: "bg-gray-100 text-gray-500 dark:bg-white/10",
};

export default function Leave() {
  const today = toDateOnly(new Date());
  const [tab, setTab] = useState<Tab>("requests");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [types, setTypes] = useState<HrLeaveType[]>([]);
  const [requests, setRequests] = useState<HrLeaveRequest[]>([]);
  const [balances, setBalances] = useState<HrLeaveBalance[]>([]);
  const [status, setStatus] = useState("Pending");
  const [year, setYear] = useState(new Date().getFullYear());

  const [reqOpen, setReqOpen] = useState(false);
  const [rf, setRf] = useState({ employeeId: "", leaveTypeId: "", fromDate: today, toDate: today, reason: "" });
  const [decide, setDecide] = useState<{ req: HrLeaveRequest; approve: boolean } | null>(null);
  const [note, setNote] = useState("");
  const [typeOpen, setTypeOpen] = useState(false);
  const [typeEditing, setTypeEditing] = useState<HrLeaveType | null>(null);
  const [tf, setTf] = useState({ name: "", isPaid: true, defaultDaysPerYear: "0" });

  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(null), 3500); return () => clearTimeout(t); }, [notice]);
  useEffect(() => { getEmployees(undefined, false, 1, 500).then((r) => setEmployees(r.data ?? [])).catch(() => setEmployees([])); }, []);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const t = await getLeaveTypes(); setTypes(t);
      if (tab === "requests") setRequests(await getLeaveRequests(status || undefined, undefined, year));
      else if (tab === "balances") setBalances(await getLeaveBalances(year));
    } catch (e) { setError(errorMessage(e, "Failed to load leave data")); }
    finally { setLoading(false); }
  }, [tab, status, year]);

  useEffect(() => { void load(); }, [load]);

  const days = (f: string, t: string) => Math.max(0, Math.round((new Date(t + "T00:00:00").getTime() - new Date(f + "T00:00:00").getTime()) / 86400000) + 1);

  async function submitRequest() {
    if (!rf.employeeId || !rf.leaveTypeId) { setNotice({ variant: "error", title: "Validation", message: "Employee and leave type are required" }); return; }
    setBusy(true);
    try {
      const r = await createLeaveRequest({ employeeId: Number(rf.employeeId), leaveTypeId: Number(rf.leaveTypeId), fromDate: rf.fromDate, toDate: rf.toDate, reason: rf.reason || null });
      if (!r.success) throw new Error(r.message);
      setReqOpen(false); setNotice({ variant: "success", title: "Requested", message: `${r.data?.days ?? ""} day(s) requested` }); await load();
    } catch (e) { setNotice({ variant: "error", title: "Request failed", message: errorMessage(e) }); }
    finally { setBusy(false); }
  }

  async function submitDecision() {
    if (!decide) return;
    setBusy(true);
    try {
      const r = await decideLeaveRequest(decide.req.id, decide.approve, note || undefined);
      if (!r.success) throw new Error(r.message);
      setDecide(null); setNote(""); setNotice({ variant: "success", title: r.message, message: `${decide.req.employeeName}: ${decide.req.fromDate} → ${decide.req.toDate}` }); await load();
    } catch (e) { setNotice({ variant: "error", title: "Failed", message: errorMessage(e) }); }
    finally { setBusy(false); }
  }

  async function cancel(req: HrLeaveRequest) {
    setBusy(true);
    try { const r = await cancelLeaveRequest(req.id); if (!r.success) throw new Error(r.message); await load(); }
    catch (e) { setNotice({ variant: "error", title: "Cancel failed", message: errorMessage(e) }); }
    finally { setBusy(false); }
  }

  async function saveType() {
    if (!tf.name.trim()) { setNotice({ variant: "error", title: "Validation", message: "Name is required" }); return; }
    setBusy(true);
    try {
      const p = { name: tf.name, isPaid: tf.isPaid, defaultDaysPerYear: Number(tf.defaultDaysPerYear) || 0 };
      if (typeEditing) await updateLeaveType(typeEditing.id, p); else await createLeaveType(p);
      setTypeOpen(false); await load();
    } catch (e) { setNotice({ variant: "error", title: "Save failed", message: errorMessage(e) }); }
    finally { setBusy(false); }
  }

  async function removeType(id: number) {
    setBusy(true);
    try { await deleteLeaveType(id); await load(); }
    catch (e) { setNotice({ variant: "error", title: "Delete failed", message: errorMessage(e, "Type is still used by requests") }); }
    finally { setBusy(false); }
  }

  const empty = (msg: string) => <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-gray-500 dark:border-gray-700">{msg}</div>;
  const wrap = (children: React.ReactNode) => <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">{children}</div>;

  return (
    <div>
      <PageMeta title="Leave | Axis" description="Leave requests and balances" />
      <PageBreadcrumb pageTitle="Leave" />
      {notice && <div className="mb-4"><Alert variant={notice.variant} title={notice.title} message={notice.message} /></div>}

      <div className="mb-4 flex gap-1 border-b border-gray-200 dark:border-gray-800">
        {([["requests", "Requests"], ["balances", "Balances"], ["types", "Leave types"]] as [Tab, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`-mb-px border-b-2 px-4 py-2 text-sm ${tab === k ? "border-brand-500 text-brand-500" : "border-transparent text-gray-500"}`}>{l}</button>
        ))}
      </div>

      {tab !== "types" && (
        <div className="mb-4 flex flex-wrap items-end gap-3">
          {tab === "requests" && (
            <div className="w-44"><Label>Status</Label>
              <select className={selectCls} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">All</option>{["Pending", "Approved", "Rejected", "Cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
          <div className="w-32"><Label>Year</Label><Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value) || year)} /></div>
          {tab === "requests" && <div className="ml-auto"><button className={btnPrimary} onClick={() => { setRf({ employeeId: "", leaveTypeId: String(types[0]?.id ?? ""), fromDate: today, toDate: today, reason: "" }); setReqOpen(true); }}>New request</button></div>}
        </div>
      )}
      {tab === "types" && <div className="mb-4 flex justify-end"><button className={btnPrimary} onClick={() => { setTypeEditing(null); setTf({ name: "", isPaid: true, defaultDaysPerYear: "0" }); setTypeOpen(true); }}>New leave type</button></div>}

      {error && <Alert variant="error" title="Error" message={error} />}
      {loading ? <div className="flex justify-center py-10"><Loader /></div> : (
        <>
          {tab === "requests" && (requests.length === 0 ? empty("No leave requests.") : wrap(
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]"><TableRow>{["Employee", "Type", "From", "To", "Days", "Reason", "Status", "Decided", ""].map((h) => <TableCell key={h} isHeader className={th}>{h}</TableCell>)}</TableRow></TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {requests.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className={td}>{r.employeeName}</TableCell>
                    <TableCell className={td}>{r.leaveTypeName}</TableCell>
                    <TableCell className={td}>{r.fromDate}</TableCell>
                    <TableCell className={td}>{r.toDate}</TableCell>
                    <TableCell className={td}>{r.days}</TableCell>
                    <TableCell className={td}>{r.reason || ""}</TableCell>
                    <TableCell className={td}><span className={`rounded-full px-2 py-0.5 text-xs ${statusCls[r.status] ?? ""}`}>{r.status}</span></TableCell>
                    <TableCell className={td}>{r.decidedBy ? <span title={r.decisionNote || ""}>{r.decidedBy}</span> : "—"}</TableCell>
                    <TableCell className="px-4 py-3 text-right text-sm">
                      {r.status === "Pending" && (
                        <span className="flex justify-end gap-2">
                          <button className="text-success-600 hover:underline" disabled={busy} onClick={() => { setDecide({ req: r, approve: true }); setNote(""); }}>Approve</button>
                          <button className="text-error-500 hover:underline" disabled={busy} onClick={() => { setDecide({ req: r, approve: false }); setNote(""); }}>Reject</button>
                        </span>
                      )}
                      {r.status === "Approved" && <button className="text-gray-500 hover:underline" disabled={busy} onClick={() => cancel(r)}>Cancel</button>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ))}

          {tab === "balances" && (balances.length === 0 ? empty("No employees or leave types yet.") : wrap(
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]"><TableRow><TableCell isHeader className={th}>Employee</TableCell>{types.map((t) => <TableCell key={t.id} isHeader className={th}>{t.name} ({t.defaultDaysPerYear})</TableCell>)}</TableRow></TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {balances.map((b) => (
                  <TableRow key={b.employeeId}>
                    <TableCell className={td}>{b.employeeName}</TableCell>
                    {types.map((t) => { const i = b.items.find((x) => x.leaveTypeId === t.id); return (
                      <TableCell key={t.id} className={td}>
                        {i ? <><span className={i.remaining < 0 ? "text-error-500" : "font-medium text-gray-800 dark:text-white/90"}>{i.remaining}</span> <span className="text-xs text-gray-500">left · {i.usedDays} used{i.pendingDays ? ` · ${i.pendingDays} pending` : ""}</span></> : "—"}
                      </TableCell>); })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ))}

          {tab === "types" && (types.length === 0 ? empty("No leave types. Create Annual, Sick… to start.") : wrap(
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]"><TableRow>{["Name", "Paid", "Days / year", ""].map((h) => <TableCell key={h} isHeader className={th}>{h}</TableCell>)}</TableRow></TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {types.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className={td}><button className="font-medium hover:underline" onClick={() => { setTypeEditing(t); setTf({ name: t.name, isPaid: t.isPaid, defaultDaysPerYear: String(t.defaultDaysPerYear) }); setTypeOpen(true); }}>{t.name}</button></TableCell>
                    <TableCell className={td}>{t.isPaid ? "Yes" : "No"}</TableCell>
                    <TableCell className={td}>{t.defaultDaysPerYear}</TableCell>
                    <TableCell className="px-4 py-3 text-right"><DeleteIconButton onClick={() => removeType(t.id)} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ))}
        </>
      )}

      <Modal isOpen={reqOpen} onClose={() => setReqOpen(false)} title="New leave request" className="max-w-md"
        footer={<><button className={btnGhost} onClick={() => setReqOpen(false)}>Cancel</button><button className={btnPrimary} disabled={busy} onClick={submitRequest}>Submit</button></>}>
        <div className="grid gap-3">
          <div><Label>Employee</Label><select className={selectCls} value={rf.employeeId} onChange={(e) => setRf((f) => ({ ...f, employeeId: e.target.value }))}><option value="">Select…</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.fullName}</option>)}</select></div>
          <div><Label>Leave type</Label><select className={selectCls} value={rf.leaveTypeId} onChange={(e) => setRf((f) => ({ ...f, leaveTypeId: e.target.value }))}><option value="">Select…</option>{types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>From</Label><Input type="date" value={rf.fromDate} onChange={(e) => setRf((f) => ({ ...f, fromDate: e.target.value }))} /></div>
            <div><Label>To</Label><Input type="date" value={rf.toDate} onChange={(e) => setRf((f) => ({ ...f, toDate: e.target.value }))} /></div>
          </div>
          <div className="text-xs text-gray-500">{days(rf.fromDate, rf.toDate)} calendar day(s)</div>
          <div><Label>Reason</Label><Input value={rf.reason} onChange={(e) => setRf((f) => ({ ...f, reason: e.target.value }))} /></div>
        </div>
      </Modal>

      <Modal isOpen={!!decide} onClose={() => setDecide(null)} title={decide ? `${decide.approve ? "Approve" : "Reject"} — ${decide.req.employeeName}` : ""} className="max-w-md"
        footer={<><button className={btnGhost} onClick={() => setDecide(null)}>Cancel</button><button className={`${btn} text-white ${decide?.approve ? "bg-success-500" : "bg-error-500"}`} disabled={busy} onClick={submitDecision}>{decide?.approve ? "Approve" : "Reject"}</button></>}>
        <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">{decide?.req.leaveTypeName}: {decide?.req.fromDate} → {decide?.req.toDate} ({decide?.req.days} days)</p>
        <Label>Note (optional)</Label><Input value={note} onChange={(e) => setNote(e.target.value)} />
      </Modal>

      <Modal isOpen={typeOpen} onClose={() => setTypeOpen(false)} title={typeEditing ? "Edit leave type" : "New leave type"} className="max-w-md"
        footer={<><button className={btnGhost} onClick={() => setTypeOpen(false)}>Cancel</button><button className={btnPrimary} disabled={busy} onClick={saveType}>Save</button></>}>
        <div className="grid gap-3">
          <div><Label>Name</Label><Input value={tf.name} onChange={(e) => setTf((f) => ({ ...f, name: e.target.value }))} /></div>
          <div><Label>Default days per year</Label><Input type="number" value={tf.defaultDaysPerYear} onChange={(e) => setTf((f) => ({ ...f, defaultDaysPerYear: e.target.value }))} /></div>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"><input type="checkbox" checked={tf.isPaid} onChange={(e) => setTf((f) => ({ ...f, isPaid: e.target.checked }))} /> Paid leave</label>
        </div>
      </Modal>
    </div>
  );
}
