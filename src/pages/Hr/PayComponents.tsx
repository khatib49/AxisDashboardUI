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
  HrPayComponentType, HrPayComponentTypeUpsert, HrEmployeePayComponent, HrPayrollAdvance, HrEmployee,
  getPayComponents, createPayComponent, updatePayComponent, deletePayComponent, getEmployees,
  getEmployeePayComponents, upsertEmployeePayComponent, removeEmployeePayComponent,
  getPayrollAdvances, createPayrollAdvance, deletePayrollAdvance, toDateOnly, errorMessage,
} from "../../services/hrService";

type Notice = { variant: "success" | "error" | "warning" | "info"; title: string; message: string };
const btn = "rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50";
const btnPrimary = `${btn} bg-brand-500 text-white hover:bg-brand-600`;
const btnGhost = `${btn} border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/5`;
const th = "px-3 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400";
const td = "px-3 py-3 text-sm text-gray-700 dark:text-gray-300";
const selectCls = "h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white/90";
const card = "rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] text-gray-800 dark:text-white/90";
const money = (n: number | null | undefined) => (n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const rateLabel = (method: string, rate: number) => (method === "PercentOfGross" ? `${rate}% of gross` : money(rate));

const emptyForm: HrPayComponentTypeUpsert = { name: "", kind: "Deduction", method: "Fixed", rate: 0, isStatutory: false, isActive: true, defaultForAll: false };

export default function PayComponents() {
  const today = new Date();
  const [types, setTypes] = useState<HrPayComponentType[]>([]);
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);

  const [editor, setEditor] = useState<{ id?: number } | null>(null);
  const [form, setForm] = useState<HrPayComponentTypeUpsert>(emptyForm);
  const [rateText, setRateText] = useState("0");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const [employeeId, setEmployeeId] = useState<number | "">("");
  const [effective, setEffective] = useState<HrEmployeePayComponent[]>([]);
  const [effLoading, setEffLoading] = useState(false);
  const [ovr, setOvr] = useState<HrEmployeePayComponent | null>(null);
  const [of, setOf] = useState({ value: "", isActive: true });

  const [advYear, setAdvYear] = useState(today.getFullYear());
  const [advMonth, setAdvMonth] = useState(today.getMonth() + 1);
  const [advances, setAdvances] = useState<HrPayrollAdvance[]>([]);
  const [advLoading, setAdvLoading] = useState(false);
  const [advEditor, setAdvEditor] = useState(false);
  const [advForm, setAdvForm] = useState({ employeeId: "" as number | "", amount: "", on: toDateOnly(today), notes: "" });

  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(null), 4000); return () => clearTimeout(t); }, [notice]);
  useEffect(() => { getEmployees(undefined, false, 1, 500).then((r) => setEmployees(r.data ?? [])).catch(() => setEmployees([])); }, []);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setTypes(await getPayComponents(true)); }
    catch (e) { setError(errorMessage(e, "Failed to load pay components")); setTypes([]); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const loadEffective = useCallback(async () => {
    if (employeeId === "") { setEffective([]); return; }
    setEffLoading(true);
    try { setEffective(await getEmployeePayComponents(employeeId)); }
    catch (e) { setNotice({ variant: "error", title: "Employee components", message: errorMessage(e) }); setEffective([]); }
    finally { setEffLoading(false); }
  }, [employeeId]);
  useEffect(() => { void loadEffective(); }, [loadEffective]);

  const loadAdvances = useCallback(async () => {
    setAdvLoading(true);
    try { setAdvances(await getPayrollAdvances(advYear, advMonth)); }
    catch (e) { setNotice({ variant: "error", title: "Advances", message: errorMessage(e) }); setAdvances([]); }
    finally { setAdvLoading(false); }
  }, [advYear, advMonth]);
  useEffect(() => { void loadAdvances(); }, [loadAdvances]);

  function openNew() { setEditor({}); setForm(emptyForm); setRateText("0"); }
  function openEdit(t: HrPayComponentType) {
    setEditor({ id: t.id });
    setForm({ name: t.name, kind: t.kind, method: t.method, rate: t.rate, isStatutory: t.isStatutory, isActive: t.isActive, defaultForAll: t.defaultForAll });
    setRateText(String(t.rate));
  }

  async function saveType() {
    if (!editor) return;
    const rate = Number(rateText);
    if (!form.name.trim()) { setNotice({ variant: "error", title: "Validation", message: "Name is required" }); return; }
    if (!(rate >= 0)) { setNotice({ variant: "error", title: "Validation", message: "Enter a valid rate" }); return; }
    setBusy(true);
    try {
      const payload = { ...form, name: form.name.trim(), rate };
      const r = editor.id ? await updatePayComponent(editor.id, payload) : await createPayComponent(payload);
      if (!r.success) throw new Error(r.message);
      setEditor(null); await load(); await loadEffective();
    } catch (e) { setNotice({ variant: "error", title: "Save failed", message: errorMessage(e) }); }
    finally { setBusy(false); }
  }

  async function confirmDelete() {
    if (deleteId == null) return;
    setBusy(true);
    try { const r = await deletePayComponent(deleteId); if (!r.success) throw new Error(r.message); setNotice({ variant: "success", title: "Component", message: r.message }); setDeleteId(null); await load(); await loadEffective(); }
    catch (e) { setNotice({ variant: "error", title: "Delete failed", message: errorMessage(e) }); }
    finally { setBusy(false); }
  }

  function openOverride(c: HrEmployeePayComponent) {
    setOvr(c);
    const v = c.method === "Fixed" ? (c.amount ?? c.defaultRate) : (c.rate ?? c.defaultRate);
    setOf({ value: String(v), isActive: c.hasOverride ? (c.overrideIsActive ?? true) : true });
  }

  async function saveOverride() {
    if (!ovr || employeeId === "") return;
    const v = Number(of.value);
    if (!(v >= 0)) { setNotice({ variant: "error", title: "Validation", message: "Enter a valid value" }); return; }
    setBusy(true);
    try {
      const r = await upsertEmployeePayComponent(employeeId, ovr.componentTypeId, ovr.method === "Fixed" ? { amount: v, isActive: of.isActive } : { rate: v, isActive: of.isActive });
      if (!r.success) throw new Error(r.message);
      setOvr(null); await loadEffective();
    } catch (e) { setNotice({ variant: "error", title: "Save failed", message: errorMessage(e) }); }
    finally { setBusy(false); }
  }

  async function clearOverride(c: HrEmployeePayComponent) {
    if (employeeId === "") return;
    setBusy(true);
    try { await removeEmployeePayComponent(employeeId, c.componentTypeId); await loadEffective(); }
    catch (e) { setNotice({ variant: "error", title: "Reset failed", message: errorMessage(e) }); }
    finally { setBusy(false); }
  }

  async function saveAdvance() {
    const amount = Number(advForm.amount);
    if (advForm.employeeId === "") { setNotice({ variant: "error", title: "Validation", message: "Choose an employee" }); return; }
    if (!(amount > 0)) { setNotice({ variant: "error", title: "Validation", message: "Amount must be positive" }); return; }
    setBusy(true);
    try {
      const r = await createPayrollAdvance({ employeeId: advForm.employeeId, amount, on: advForm.on, notes: advForm.notes || null });
      if (!r.success) throw new Error(r.message);
      setAdvEditor(false);
      const d = new Date(advForm.on + "T00:00:00"); setAdvYear(d.getFullYear()); setAdvMonth(d.getMonth() + 1);
      await loadAdvances();
    } catch (e) { setNotice({ variant: "error", title: "Save failed", message: errorMessage(e) }); }
    finally { setBusy(false); }
  }

  async function removeAdvance(id: number) {
    setBusy(true);
    try { const r = await deletePayrollAdvance(id); if (!r.success) throw new Error(r.message); await loadAdvances(); }
    catch (e) { setNotice({ variant: "error", title: "Delete failed", message: errorMessage(e) }); }
    finally { setBusy(false); }
  }

  const empName = (id: number) => employees.find((e) => e.id === id)?.fullName ?? `#${id}`;

  return (
    <div>
      <PageMeta title="Pay Components | Axis" description="Payroll allowances, deductions, employee overrides and advances" />
      <PageBreadcrumb pageTitle="Pay Components" />
      {notice && <div className="mb-4"><Alert variant={notice.variant} title={notice.title} message={notice.message} /></div>}

      {/* ── Component types ── */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">Allowances &amp; deductions</h3>
        <button className={btnPrimary} onClick={openNew}>New component</button>
      </div>
      {error && <Alert variant="error" title="Error" message={error} />}
      {loading ? <div className="flex justify-center py-10"><Loader /></div> : types.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-gray-500 dark:text-gray-400 dark:border-gray-700">No pay components yet.</div>
      ) : (
        <div className={`${card} overflow-x-auto`}>
          <Table>
            <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]"><TableRow>
              {["Name", "Kind", "Rate", "Statutory", "Default for all", "Active", ""].map((h) => <TableCell key={h} isHeader className={th}>{h}</TableCell>)}
            </TableRow></TableHeader>
            <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
              {types.map((t) => (
                <TableRow key={t.id} className={t.isActive ? "" : "opacity-50"}>
                  <TableCell className={`${td} font-medium`}>{t.name}</TableCell>
                  <TableCell className={td}><span className={`rounded-full px-2 py-0.5 text-xs ${t.kind === "Allowance" ? "bg-success-50 text-success-600 dark:bg-success-500/15" : "bg-error-50 text-error-600 dark:bg-error-500/15"}`}>{t.kind}</span></TableCell>
                  <TableCell className={td}>{rateLabel(t.method, t.rate)}</TableCell>
                  <TableCell className={td}>{t.isStatutory ? "Yes" : "—"}</TableCell>
                  <TableCell className={td}>{t.defaultForAll ? "Yes" : "No"}</TableCell>
                  <TableCell className={td}>{t.isActive ? "Yes" : "No"}</TableCell>
                  <TableCell className="px-3 py-3 text-right text-sm"><span className="flex justify-end gap-3">
                    <button className="text-brand-500 dark:text-brand-400 hover:underline" onClick={() => openEdit(t)}>Edit</button>
                    <DeleteIconButton onClick={() => setDeleteId(t.id)} />
                  </span></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ── Employee overrides ── */}
      <div className="mt-8 mb-3 flex flex-wrap items-end gap-3">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">Employee overrides</h3>
        <div className="w-72 ml-auto"><Label>Employee</Label>
          <select className={selectCls} value={employeeId} onChange={(e) => setEmployeeId(e.target.value ? Number(e.target.value) : "")}>
            <option value="">Choose an employee…</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.fullName}{e.position ? ` — ${e.position}` : ""}</option>)}
          </select>
        </div>
      </div>
      {employeeId === "" ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:text-gray-400 dark:border-gray-700">Pick an employee to see which components apply and override amounts or opt out.</div>
      ) : effLoading ? <div className="flex justify-center py-6"><Loader /></div> : effective.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:text-gray-400 dark:border-gray-700">No active components.</div>
      ) : (
        <div className={`${card} overflow-x-auto`}>
          <Table>
            <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]"><TableRow>
              {["Component", "Kind", "Default", "Effective", "Applies", "Source", ""].map((h) => <TableCell key={h} isHeader className={th}>{h}</TableCell>)}
            </TableRow></TableHeader>
            <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
              {effective.map((c) => (
                <TableRow key={c.componentTypeId} className={c.applies ? "" : "opacity-60"}>
                  <TableCell className={`${td} font-medium`}>{c.name}{c.isStatutory && <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-white/10 dark:text-gray-300">statutory</span>}</TableCell>
                  <TableCell className={td}>{c.kind}</TableCell>
                  <TableCell className={td}>{rateLabel(c.method, c.defaultRate)}{c.defaultForAll ? "" : <span className="text-xs text-gray-400"> (opt-in)</span>}</TableCell>
                  <TableCell className={`${td} font-medium`}>{rateLabel(c.method, c.effectiveRate)}</TableCell>
                  <TableCell className={td}>{c.applies ? "Yes" : "No"}</TableCell>
                  <TableCell className={td}>{c.hasOverride ? "Override" : "Default"}</TableCell>
                  <TableCell className="px-3 py-3 text-right text-sm"><span className="flex justify-end gap-3">
                    <button className="text-brand-500 dark:text-brand-400 hover:underline" disabled={busy} onClick={() => openOverride(c)}>{c.hasOverride ? "Edit" : "Override"}</button>
                    {c.hasOverride && <button className="text-gray-500 dark:text-gray-400 hover:underline" disabled={busy} onClick={() => clearOverride(c)}>Reset</button>}
                  </span></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ── Advances ── */}
      <div className="mt-8 mb-3 flex flex-wrap items-end gap-3">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">Advances</h3>
        <div className="ml-auto flex items-end gap-2">
          <div className="w-28"><Label>Year</Label><Input type="number" value={String(advYear)} onChange={(e) => setAdvYear(Number(e.target.value) || today.getFullYear())} /></div>
          <div className="w-28"><Label>Month</Label><Input type="number" min="1" max="12" value={String(advMonth)} onChange={(e) => setAdvMonth(Math.min(12, Math.max(1, Number(e.target.value) || 1)))} /></div>
          <button className={btnPrimary} onClick={() => { setAdvForm({ employeeId: "", amount: "", on: toDateOnly(today), notes: "" }); setAdvEditor(true); }}>New advance</button>
        </div>
      </div>
      {advLoading ? <div className="flex justify-center py-6"><Loader /></div> : advances.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:text-gray-400 dark:border-gray-700">No advances in {advYear}-{String(advMonth).padStart(2, "0")}. Advances are deducted by the payroll run of the month they are given in.</div>
      ) : (
        <div className={`${card} overflow-x-auto`}>
          <Table>
            <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]"><TableRow>
              {["Date", "Employee", "Amount", "Notes", "Recovered", ""].map((h) => <TableCell key={h} isHeader className={th}>{h}</TableCell>)}
            </TableRow></TableHeader>
            <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
              {advances.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className={td}>{a.on}</TableCell>
                  <TableCell className={`${td} font-medium`}>{a.employeeName || empName(a.employeeId)}</TableCell>
                  <TableCell className={td}>{money(a.amount)}</TableCell>
                  <TableCell className={td}>{a.notes || ""}</TableCell>
                  <TableCell className={td}>{a.recoveredInRunId ? <span className="rounded-full bg-success-50 px-2 py-0.5 text-xs text-success-600 dark:bg-success-500/15">run #{a.recoveredInRunId}</span> : <span className="text-xs text-gray-400">pending</span>}</TableCell>
                  <TableCell className="px-3 py-3 text-right text-sm">{!a.recoveredInRunId && <DeleteIconButton onClick={() => removeAdvance(a.id)} />}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ── Modals ── */}
      <Modal isOpen={!!editor} onClose={() => setEditor(null)} title={editor?.id ? "Edit component" : "New component"} className="max-w-lg"
        footer={<><button className={btnGhost} onClick={() => setEditor(null)}>Cancel</button><button className={btnPrimary} disabled={busy} onClick={saveType}>Save</button></>}>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
          <div><Label>Kind</Label><select className={selectCls} value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}><option value="Allowance">Allowance</option><option value="Deduction">Deduction</option></select></div>
          <div><Label>Method</Label><select className={selectCls} value={form.method} onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))}><option value="Fixed">Fixed amount</option><option value="PercentOfGross">Percent of gross</option></select></div>
          <div><Label>{form.method === "PercentOfGross" ? "Rate (%)" : "Amount"}</Label><Input type="number" step={0.01} min="0" value={rateText} onChange={(e) => setRateText(e.target.value)} /></div>
          <div className="flex flex-col justify-end gap-1 text-sm text-gray-700 dark:text-gray-300">
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.defaultForAll} onChange={(e) => setForm((f) => ({ ...f, defaultForAll: e.target.checked }))} /> Applies to everyone by default</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.isStatutory} onChange={(e) => setForm((f) => ({ ...f, isStatutory: e.target.checked }))} /> Statutory (posted to Statutory Deductions Payable)</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} /> Active</label>
          </div>
        </div>
      </Modal>

      <Modal isOpen={deleteId != null} onClose={() => setDeleteId(null)} title="Delete component" className="max-w-md"
        footer={<><button className={btnGhost} onClick={() => setDeleteId(null)}>Cancel</button><button className={`${btn} bg-error-500 text-white`} disabled={busy} onClick={confirmDelete}>Delete</button></>}>
        <p className="text-sm text-gray-600 dark:text-gray-300">Delete this component? If employees have overrides for it, it is deactivated instead so history stays intact.</p>
      </Modal>

      <Modal isOpen={!!ovr} onClose={() => setOvr(null)} title={ovr ? `${ovr.name} — ${empName(employeeId === "" ? 0 : employeeId)}` : "Override"} className="max-w-md"
        footer={<><button className={btnGhost} onClick={() => setOvr(null)}>Cancel</button><button className={btnPrimary} disabled={busy} onClick={saveOverride}>Save</button></>}>
        {ovr && (
          <div className="grid gap-3">
            <div><Label>{ovr.method === "PercentOfGross" ? "Rate (%) for this employee" : "Amount for this employee"}</Label><Input type="number" step={0.01} min="0" value={of.value} onChange={(e) => setOf((f) => ({ ...f, value: e.target.value }))} /></div>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"><input type="checkbox" checked={of.isActive} onChange={(e) => setOf((f) => ({ ...f, isActive: e.target.checked }))} /> Apply this component to the employee</label>
            <p className="text-xs text-gray-500 dark:text-gray-400">Default: {rateLabel(ovr.method, ovr.defaultRate)} · {ovr.defaultForAll ? "applies to everyone unless opted out" : "opt-in only"}.</p>
          </div>
        )}
      </Modal>

      <Modal isOpen={advEditor} onClose={() => setAdvEditor(false)} title="New advance" className="max-w-md"
        footer={<><button className={btnGhost} onClick={() => setAdvEditor(false)}>Cancel</button><button className={btnPrimary} disabled={busy} onClick={saveAdvance}>Save</button></>}>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label>Employee</Label>
            <select className={selectCls} value={advForm.employeeId} onChange={(e) => setAdvForm((f) => ({ ...f, employeeId: e.target.value ? Number(e.target.value) : "" }))}>
              <option value="">Choose…</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.fullName}</option>)}
            </select>
          </div>
          <div><Label>Amount</Label><Input type="number" step={0.01} min="0" value={advForm.amount} onChange={(e) => setAdvForm((f) => ({ ...f, amount: e.target.value }))} /></div>
          <div><Label>Date</Label><Input type="date" value={advForm.on} onChange={(e) => setAdvForm((f) => ({ ...f, on: e.target.value }))} /></div>
          <div className="col-span-2"><Label>Notes</Label><Input value={advForm.notes} onChange={(e) => setAdvForm((f) => ({ ...f, notes: e.target.value }))} /></div>
          <p className="col-span-2 text-xs text-gray-500 dark:text-gray-400">The advance is deducted from the payroll run of the month it is dated in.</p>
        </div>
      </Modal>
    </div>
  );
}
