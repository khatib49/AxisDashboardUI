import { Fragment, useCallback, useEffect, useState } from "react";
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
  HrTipPool, HrTipReport, HrEmployee, getTipPools, getTipReport, getEmployees, createTipPool, updateTipPool,
  computeTipPool, distributeTipPool, deleteTipPool, toDateOnly, addDays, errorMessage,
} from "../../services/hrService";

type Notice = { variant: "success" | "error" | "warning" | "info"; title: string; message: string };
const btn = "rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50";
const btnPrimary = `${btn} bg-brand-500 text-white hover:bg-brand-600`;
const btnGhost = `${btn} border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/5`;
const th = "px-4 py-3 text-left text-xs font-medium uppercase text-gray-500";
const td = "px-4 py-3 text-sm text-gray-700 dark:text-gray-300";
const selectCls = "h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white/90";

type Participant = { employeeId: number; points: string };

export default function TipPools() {
  const today = toDateOnly(new Date());
  const [from, setFrom] = useState(addDays(today, -13));
  const [to, setTo] = useState(today);
  const [pools, setPools] = useState<HrTipPool[]>([]);
  const [report, setReport] = useState<HrTipReport | null>(null);
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  const [editor, setEditor] = useState<{ pool?: HrTipPool } | null>(null);
  const [pf, setPf] = useState({ date: today, totalAmount: "", method: "Equal", notes: "" });
  const [parts, setParts] = useState<Participant[]>([]);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(null), 3500); return () => clearTimeout(t); }, [notice]);
  useEffect(() => { getEmployees(undefined, false, 1, 500).then((r) => setEmployees(r.data ?? [])).catch(() => setEmployees([])); }, []);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [p, r] = await Promise.all([getTipPools(from, to), getTipReport(from, to).catch(() => null)]);
      setPools(p); setReport(r);
    } catch (e) { setError(errorMessage(e, "Failed to load tip pools")); setPools([]); }
    finally { setLoading(false); }
  }, [from, to]);

  useEffect(() => { void load(); }, [load]);

  function openNew() {
    setEditor({});
    setPf({ date: today, totalAmount: "", method: "Equal", notes: "" });
    setParts(employees.map((e) => ({ employeeId: e.id, points: "1" })));
  }
  function openEdit(p: HrTipPool) {
    setEditor({ pool: p });
    setPf({ date: p.date, totalAmount: String(p.totalAmount), method: p.method, notes: p.notes ?? "" });
    setParts(p.allocations.map((a) => ({ employeeId: a.employeeId, points: a.points != null ? String(a.points) : "1" })));
  }
  const toggle = (id: number) => setParts((ps) => (ps.some((p) => p.employeeId === id) ? ps.filter((p) => p.employeeId !== id) : [...ps, { employeeId: id, points: "1" }]));

  async function save() {
    if (!editor) return;
    const total = Number(pf.totalAmount);
    if (!(total >= 0)) { setNotice({ variant: "error", title: "Validation", message: "Enter a valid total" }); return; }
    if (parts.length === 0) { setNotice({ variant: "error", title: "Validation", message: "Choose at least one employee" }); return; }
    setBusy(true);
    try {
      const participants = parts.map((p) => ({ employeeId: p.employeeId, points: pf.method === "ByPoints" ? Number(p.points) || 0 : null }));
      const payload = { date: pf.date, totalAmount: total, method: pf.method, notes: pf.notes || null, participants };
      const r = editor.pool ? await updateTipPool(editor.pool.id, payload) : await createTipPool(payload);
      if (!r.success) throw new Error(r.message);
      setEditor(null); setExpanded(r.data?.id ?? null); await load();
    } catch (e) { setNotice({ variant: "error", title: "Save failed", message: errorMessage(e) }); }
    finally { setBusy(false); }
  }

  async function act(fn: () => Promise<{ success: boolean; message: string }>, title: string) {
    setBusy(true);
    try { const r = await fn(); if (!r.success) throw new Error(r.message); setNotice({ variant: "success", title, message: r.message }); await load(); }
    catch (e) { setNotice({ variant: "error", title: `${title} failed`, message: errorMessage(e) }); }
    finally { setBusy(false); }
  }

  async function confirmDelete() {
    if (deleteId == null) return;
    setBusy(true);
    try { await deleteTipPool(deleteId); setDeleteId(null); await load(); }
    catch (e) { setNotice({ variant: "error", title: "Delete failed", message: errorMessage(e, "Distributed pools cannot be deleted") }); }
    finally { setBusy(false); }
  }

  const money = (n: number) => n.toFixed(2);

  return (
    <div>
      <PageMeta title="Tip Pools | Axis" description="Daily tip pools and distribution" />
      <PageBreadcrumb pageTitle="Tip Pools" />
      {notice && <div className="mb-4"><Alert variant={notice.variant} title={notice.title} message={notice.message} /></div>}

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-40"><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="w-40"><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div className="ml-auto"><button className={btnPrimary} onClick={openNew}>New tip pool</button></div>
      </div>

      {report && (
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]"><div className="text-xs uppercase text-gray-500">Distributed in range</div><div className="text-2xl font-semibold text-gray-800 dark:text-white/90">{money(report.total)}</div><div className="text-xs text-gray-500">{report.byDay.length} day(s)</div></div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 md:col-span-2 dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="mb-1 text-xs uppercase text-gray-500">By employee</div>
            {report.byEmployee.length === 0 ? <div className="text-sm text-gray-400">Nothing distributed yet.</div> : (
              <div className="flex flex-wrap gap-2">{report.byEmployee.map((e) => <span key={e.employeeId} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700 dark:bg-white/10 dark:text-gray-200">{e.employeeName}: <b>{money(e.amount)}</b></span>)}</div>
            )}
          </div>
        </div>
      )}

      {error && <Alert variant="error" title="Error" message={error} />}
      {loading ? <div className="flex justify-center py-10"><Loader /></div> : pools.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-gray-500 dark:border-gray-700">No tip pools in this range.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
          <Table>
            <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]"><TableRow>{["Date", "Total", "Method", "Staff", "Status", "By", ""].map((h) => <TableCell key={h} isHeader className={th}>{h}</TableCell>)}</TableRow></TableHeader>
            <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
              {pools.map((p) => (
                <Fragment key={p.id}>
                  <TableRow className="cursor-pointer">
                    <TableCell className={td}><button className="font-medium hover:underline" onClick={() => setExpanded(expanded === p.id ? null : p.id)}>{p.date}</button></TableCell>
                    <TableCell className={td}>{money(p.totalAmount)}</TableCell>
                    <TableCell className={td}>{p.method}</TableCell>
                    <TableCell className={td}>{p.allocations.length}</TableCell>
                    <TableCell className={td}><span className={`rounded-full px-2 py-0.5 text-xs ${p.status === "Distributed" ? "bg-success-50 text-success-600 dark:bg-success-500/15" : "bg-warning-50 text-warning-600 dark:bg-warning-500/15"}`}>{p.status}</span></TableCell>
                    <TableCell className={td}>{p.createdBy}</TableCell>
                    <TableCell className="px-4 py-3 text-right text-sm">
                      {p.status === "Draft" ? (
                        <span className="flex justify-end gap-3">
                          <button className="text-brand-500 hover:underline" disabled={busy} onClick={() => openEdit(p)}>Edit</button>
                          <button className="text-gray-500 hover:underline" disabled={busy} onClick={() => act(() => computeTipPool(p.id), "Recompute")}>Recompute</button>
                          <button className="text-success-600 hover:underline" disabled={busy} onClick={() => act(() => distributeTipPool(p.id), "Distribute")}>Distribute</button>
                          <DeleteIconButton onClick={() => setDeleteId(p.id)} />
                        </span>
                      ) : <span className="text-xs text-gray-400">frozen {p.distributedOn ? new Date(p.distributedOn).toLocaleDateString() : ""}</span>}
                    </TableCell>
                  </TableRow>
                  {expanded === p.id && (
                    <TableRow>
                      <TableCell colSpan={7} className="bg-gray-50 px-6 py-3 dark:bg-white/[0.02]">
                        {p.allocations.length === 0 ? <span className="text-sm text-gray-400">No staff in this pool.</span> : (
                          <div className="flex flex-wrap gap-2">
                            {p.allocations.map((a) => <span key={a.id} className="rounded-lg border border-gray-200 bg-white px-3 py-1 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">{a.employeeName}: <b>{money(a.amount)}</b>{p.method === "ByHours" ? <span className="text-xs text-gray-500"> · {a.hours ?? 0}h</span> : p.method === "ByPoints" ? <span className="text-xs text-gray-500"> · {a.points ?? 0} pts</span> : null}</span>)}
                          </div>
                        )}
                        {p.notes && <div className="mt-2 text-xs text-gray-500">{p.notes}</div>}
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Modal isOpen={!!editor} onClose={() => setEditor(null)} title={editor?.pool ? "Edit tip pool" : "New tip pool"}
        footer={<><button className={btnGhost} onClick={() => setEditor(null)}>Cancel</button><button className={btnPrimary} disabled={busy} onClick={save}>Save & compute</button></>}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div><Label>Date</Label><Input type="date" value={pf.date} onChange={(e) => setPf((f) => ({ ...f, date: e.target.value }))} /></div>
          <div><Label>Total amount</Label><Input type="number" step={0.01} value={pf.totalAmount} onChange={(e) => setPf((f) => ({ ...f, totalAmount: e.target.value }))} /></div>
          <div><Label>Method</Label>
            <select className={selectCls} value={pf.method} onChange={(e) => setPf((f) => ({ ...f, method: e.target.value }))}>
              <option value="Equal">Equal split</option><option value="ByHours">By hours worked (attendance)</option><option value="ByPoints">By points</option>
            </select>
          </div>
          <div className="md:col-span-3"><Label>Notes</Label><Input value={pf.notes} onChange={(e) => setPf((f) => ({ ...f, notes: e.target.value }))} /></div>
        </div>
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between"><Label>Staff in this pool ({parts.length})</Label>
            <span className="flex gap-3 text-xs"><button className="text-brand-500" onClick={() => setParts(employees.map((e) => ({ employeeId: e.id, points: "1" })))}>All</button><button className="text-gray-500" onClick={() => setParts([])}>None</button></span>
          </div>
          {employees.length === 0 ? <div className="text-sm text-gray-400">No active employees.</div> : (
            <div className="grid max-h-72 grid-cols-1 gap-2 overflow-auto md:grid-cols-2">
              {employees.map((e) => { const p = parts.find((x) => x.employeeId === e.id); return (
                <label key={e.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${p ? "border-brand-300 bg-brand-50/40 dark:border-brand-800 dark:bg-brand-500/10" : "border-gray-200 dark:border-gray-700"}`}>
                  <input type="checkbox" checked={!!p} onChange={() => toggle(e.id)} />
                  <span className="flex-1 text-gray-800 dark:text-white/90">{e.fullName}<span className="text-xs text-gray-500"> {e.position || ""}</span></span>
                  {pf.method === "ByPoints" && p && <input type="number" className="w-20 rounded border border-gray-300 bg-transparent px-2 py-1 text-sm dark:border-gray-700" value={p.points} onChange={(ev) => setParts((ps) => ps.map((x) => (x.employeeId === e.id ? { ...x, points: ev.target.value } : x)))} />}
                </label>); })}
            </div>
          )}
          {pf.method === "ByHours" && <p className="mt-2 text-xs text-gray-500">Shares are weighted by minutes clocked on {pf.date}; staff with no closed attendance that day get 0.</p>}
        </div>
      </Modal>

      <Modal isOpen={deleteId != null} onClose={() => setDeleteId(null)} title="Delete tip pool" className="max-w-md"
        footer={<><button className={btnGhost} onClick={() => setDeleteId(null)}>Cancel</button><button className={`${btn} bg-error-500 text-white`} disabled={busy} onClick={confirmDelete}>Delete</button></>}>
        <p className="text-sm text-gray-600 dark:text-gray-300">Delete this draft pool? Distributed pools are frozen and cannot be deleted.</p>
      </Modal>
    </div>
  );
}
