import { useCallback, useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import Modal from "../../components/ui/Modal";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import Loader from "../../components/ui/Loader";
import Alert from "../../components/ui/alert/Alert";
import DeleteIconButton from "../../components/ui/DeleteIconButton";
import {
  HrWeekView, HrShift, HrShiftTemplate, getWeek, getTemplates, createShift, updateShift, deleteShift, copyPreviousWeek,
  createTemplate, updateTemplate, deleteTemplate, mondayOf, toDateOnly, addDays, errorMessage,
} from "../../services/hrService";

type Notice = { variant: "success" | "error" | "warning" | "info"; title: string; message: string };
const btn = "rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50";
const btnPrimary = `${btn} bg-brand-500 text-white hover:bg-brand-600`;
const btnGhost = `${btn} border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/5`;

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
/** Local datetime-local string for an ISO instant. */
const toLocalInput = (iso: string) => { const d = new Date(iso); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const fromLocalInput = (s: string) => new Date(s).toISOString();

export default function Schedule() {
  const [weekStart, setWeekStart] = useState(toDateOnly(mondayOf(new Date())));
  const [week, setWeek] = useState<HrWeekView | null>(null);
  const [templates, setTemplates] = useState<HrShiftTemplate[]>([]);
  const [activeTemplate, setActiveTemplate] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);

  // shift editor
  const [editor, setEditor] = useState<{ employeeId: number; employeeName: string; date: string; shift?: HrShift } | null>(null);
  const [sf, setSf] = useState({ templateId: "", start: "", end: "", role: "", notes: "", status: "Planned" });

  // template editor
  const [tplOpen, setTplOpen] = useState(false);
  const [tplEditing, setTplEditing] = useState<HrShiftTemplate | null>(null);
  const [tf, setTf] = useState({ name: "", startTime: "09:00", endTime: "17:00", color: "#3b82f6" });

  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(null), 3500); return () => clearTimeout(t); }, [notice]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [w, t] = await Promise.all([getWeek(weekStart), getTemplates().catch(() => [] as HrShiftTemplate[])]);
      setWeek(w); setTemplates(t);
    } catch (e) {
      setError(errorMessage(e, "Failed to load schedule")); setWeek(null);
    } finally { setLoading(false); }
  }, [weekStart]);

  useEffect(() => { void load(); }, [load]);

  function openCell(employeeId: number, employeeName: string, date: string, shift?: HrShift) {
    setEditor({ employeeId, employeeName, date, shift });
    if (shift) {
      setSf({ templateId: shift.templateId != null ? String(shift.templateId) : "", start: toLocalInput(shift.startOn), end: toLocalInput(shift.endOn), role: shift.role ?? "", notes: shift.notes ?? "", status: shift.status });
    } else {
      const tpl = templates.find((t) => t.id === activeTemplate);
      setSf({ templateId: tpl ? String(tpl.id) : "", start: tpl ? `${date}T${tpl.startTime.slice(0, 5)}` : `${date}T09:00`, end: tpl ? `${date}T${tpl.endTime.slice(0, 5)}` : `${date}T17:00`, role: "", notes: "", status: "Planned" });
    }
  }

  async function quickAdd(employeeId: number, date: string) {
    const tpl = templates.find((t) => t.id === activeTemplate);
    if (!tpl) return false;
    setBusy(true);
    try {
      // Template times are wall-clock; apply them in the browser's zone and send UTC instants.
      const start = new Date(`${date}T${tpl.startTime.slice(0, 5)}`);
      let end = new Date(`${date}T${tpl.endTime.slice(0, 5)}`);
      if (end <= start) end = new Date(end.getTime() + 86400000);
      const r = await createShift({ employeeId, date, templateId: tpl.id, startOn: start.toISOString(), endOn: end.toISOString() });
      if (!r.success) throw new Error(r.message);
      await load();
      return true;
    } catch (e) { setNotice({ variant: "error", title: "Could not add shift", message: errorMessage(e) }); return true; }
    finally { setBusy(false); }
  }

  async function saveShift() {
    if (!editor) return;
    setBusy(true);
    try {
      const start = fromLocalInput(sf.start);
      let end = fromLocalInput(sf.end);
      if (new Date(end) <= new Date(start)) end = new Date(new Date(end).getTime() + 86400000).toISOString();
      const payload = { startOn: start, endOn: end, templateId: sf.templateId ? Number(sf.templateId) : null, role: sf.role || null, notes: sf.notes || null };
      const r = editor.shift
        ? await updateShift(editor.shift.id, { ...payload, status: sf.status })
        : await createShift({ employeeId: editor.employeeId, date: editor.date, ...payload });
      if (!r.success) throw new Error(r.message);
      setEditor(null); await load();
    } catch (e) { setNotice({ variant: "error", title: "Save failed", message: errorMessage(e) }); }
    finally { setBusy(false); }
  }

  async function removeShift(id: number) {
    setBusy(true);
    try { await deleteShift(id); setEditor(null); await load(); }
    catch (e) { setNotice({ variant: "error", title: "Delete failed", message: errorMessage(e) }); }
    finally { setBusy(false); }
  }

  async function copyWeek() {
    setBusy(true);
    try {
      const r = await copyPreviousWeek(weekStart);
      setNotice({ variant: r.success ? "success" : "warning", title: "Copy previous week", message: r.message });
      await load();
    } catch (e) { setNotice({ variant: "error", title: "Copy failed", message: errorMessage(e) }); }
    finally { setBusy(false); }
  }

  async function saveTemplate() {
    if (!tf.name.trim()) { setNotice({ variant: "error", title: "Validation", message: "Name is required" }); return; }
    setBusy(true);
    try {
      const p = { name: tf.name, startTime: tf.startTime.length === 5 ? tf.startTime + ":00" : tf.startTime, endTime: tf.endTime.length === 5 ? tf.endTime + ":00" : tf.endTime, color: tf.color };
      if (tplEditing) await updateTemplate(tplEditing.id, p); else await createTemplate(p);
      setTplOpen(false); setTplEditing(null); await load();
    } catch (e) { setNotice({ variant: "error", title: "Template not saved", message: errorMessage(e) }); }
    finally { setBusy(false); }
  }

  async function removeTemplate(id: number) {
    setBusy(true);
    try { await deleteTemplate(id); if (activeTemplate === id) setActiveTemplate(null); await load(); }
    catch (e) { setNotice({ variant: "error", title: "Delete failed", message: errorMessage(e) }); }
    finally { setBusy(false); }
  }

  const tplColor = (id?: number | null) => templates.find((t) => t.id === id)?.color || "#6b7280";
  const dayLabel = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });

  return (
    <div>
      <PageMeta title="Shift Schedule | Axis" description="Weekly staff schedule" />
      <PageBreadcrumb pageTitle="Shift Schedule" />
      {notice && <div className="mb-4"><Alert variant={notice.variant} title={notice.title} message={notice.message} /></div>}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button className={btnGhost} onClick={() => setWeekStart(addDays(weekStart, -7))}>‹ Prev</button>
        <button className={btnGhost} onClick={() => setWeekStart(toDateOnly(mondayOf(new Date())))}>This week</button>
        <button className={btnGhost} onClick={() => setWeekStart(addDays(weekStart, 7))}>Next ›</button>
        <div className="w-44"><Input type="date" value={weekStart} onChange={(e) => e.target.value && setWeekStart(toDateOnly(mondayOf(new Date(e.target.value + "T00:00:00"))))} /></div>
        <div className="ml-auto flex gap-2">
          <button className={btnGhost} disabled={busy} onClick={copyWeek}>Copy previous week</button>
          <button className={btnPrimary} onClick={() => { setTplEditing(null); setTf({ name: "", startTime: "09:00", endTime: "17:00", color: "#3b82f6" }); setTplOpen(true); }}>New template</button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-white/[0.03]">
        <span className="text-xs uppercase text-gray-500">Palette:</span>
        <button className={`rounded-full border px-3 py-1 text-xs ${activeTemplate == null ? "border-brand-500 text-brand-500" : "border-gray-300 text-gray-600 dark:border-gray-700 dark:text-gray-300"}`} onClick={() => setActiveTemplate(null)}>Custom (open editor)</button>
        {templates.map((t) => (
          <span key={t.id} className="inline-flex items-center gap-1">
            <button onClick={() => setActiveTemplate(activeTemplate === t.id ? null : t.id)} title="Click, then click a cell to add this shift"
              className={`rounded-full px-3 py-1 text-xs text-white ${activeTemplate === t.id ? "ring-2 ring-offset-1 ring-brand-500" : ""}`} style={{ backgroundColor: t.color || "#6b7280" }}>
              {t.name} {t.startTime.slice(0, 5)}–{t.endTime.slice(0, 5)}
            </button>
            <button className="text-xs text-gray-400 hover:text-gray-600" title="Edit template" onClick={() => { setTplEditing(t); setTf({ name: t.name, startTime: t.startTime.slice(0, 5), endTime: t.endTime.slice(0, 5), color: t.color || "#3b82f6" }); setTplOpen(true); }}>✎</button>
          </span>
        ))}
        {templates.length === 0 && <span className="text-xs text-gray-400">No templates yet — create one to add shifts with one click.</span>}
      </div>

      {error && <Alert variant="error" title="Error" message={error} />}
      {loading ? <div className="flex justify-center py-10"><Loader /></div> : week && (
        week.rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-gray-500 dark:border-gray-700">No active employees. Add staff on the Employees page first.</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
            <table className="min-w-full table-fixed text-sm">
              <thead className="border-b border-gray-100 dark:border-white/[0.05]">
                <tr>
                  <th className="w-44 px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Employee</th>
                  {week.days.map((d) => <th key={d} className={`px-2 py-2 text-left text-xs font-medium uppercase ${d === toDateOnly(new Date()) ? "text-brand-500" : "text-gray-500"}`}>{dayLabel(d)}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {week.rows.map((r) => (
                  <tr key={r.employeeId}>
                    <td className="px-3 py-2 align-top">
                      <div className="font-medium text-gray-800 dark:text-white/90">{r.employeeName}</div>
                      <div className="text-xs text-gray-500">{r.position || ""}</div>
                    </td>
                    {week.days.map((d) => {
                      const shifts = r.shifts.filter((s) => s.date === d);
                      return (
                        <td key={d} className="h-16 cursor-pointer px-1 py-1 align-top hover:bg-gray-50 dark:hover:bg-white/5"
                          onClick={async () => { if (!(await quickAdd(r.employeeId, d))) openCell(r.employeeId, r.employeeName, d); }}>
                          <div className="flex flex-col gap-1">
                            {shifts.map((s) => (
                              <button key={s.id} onClick={(e) => { e.stopPropagation(); openCell(r.employeeId, r.employeeName, d, s); }}
                                className={`rounded px-2 py-1 text-left text-xs text-white ${s.status === "Cancelled" ? "line-through opacity-50" : ""}`}
                                style={{ backgroundColor: tplColor(s.templateId) }} title={s.notes || ""}>
                                {hhmm(s.startOn)}–{hhmm(s.endOn)}{s.role ? ` · ${s.role}` : ""}{s.status === "Confirmed" ? " ✓" : ""}
                              </button>
                            ))}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      <Modal isOpen={!!editor} onClose={() => setEditor(null)} title={editor ? `${editor.shift ? "Edit" : "Add"} shift — ${editor.employeeName}, ${editor.date}` : ""} className="max-w-lg"
        footer={<>
          {editor?.shift && <DeleteIconButton onClick={() => editor.shift && removeShift(editor.shift.id)} />}
          <button className={btnGhost} onClick={() => setEditor(null)}>Cancel</button>
          <button className={btnPrimary} disabled={busy} onClick={saveShift}>Save</button>
        </>}>
        <div className="grid gap-3">
          <div>
            <Label>Template</Label>
            <select className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white/90" value={sf.templateId}
              onChange={(e) => { const t = templates.find((x) => String(x.id) === e.target.value); setSf((f) => ({ ...f, templateId: e.target.value, ...(t && editor ? { start: `${editor.date}T${t.startTime.slice(0, 5)}`, end: `${editor.date}T${t.endTime.slice(0, 5)}` } : {}) })); }}>
              <option value="">— none —</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Start</Label><Input type="datetime-local" value={sf.start} onChange={(e) => setSf((f) => ({ ...f, start: e.target.value }))} /></div>
            <div><Label>End</Label><Input type="datetime-local" value={sf.end} onChange={(e) => setSf((f) => ({ ...f, end: e.target.value }))} /></div>
          </div>
          <div><Label>Role / position</Label><Input value={sf.role} onChange={(e) => setSf((f) => ({ ...f, role: e.target.value }))} /></div>
          <div><Label>Notes</Label><Input value={sf.notes} onChange={(e) => setSf((f) => ({ ...f, notes: e.target.value }))} /></div>
          {editor?.shift && (
            <div><Label>Status</Label>
              <select className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white/90" value={sf.status} onChange={(e) => setSf((f) => ({ ...f, status: e.target.value }))}>
                {["Planned", "Confirmed", "Cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
        </div>
      </Modal>

      <Modal isOpen={tplOpen} onClose={() => setTplOpen(false)} title={tplEditing ? "Edit template" : "New shift template"} className="max-w-md"
        footer={<>
          {tplEditing && <DeleteIconButton onClick={() => { removeTemplate(tplEditing.id); setTplOpen(false); }} />}
          <button className={btnGhost} onClick={() => setTplOpen(false)}>Cancel</button>
          <button className={btnPrimary} disabled={busy} onClick={saveTemplate}>Save</button>
        </>}>
        <div className="grid gap-3">
          <div><Label>Name</Label><Input value={tf.name} onChange={(e) => setTf((f) => ({ ...f, name: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Start</Label><Input type="time" value={tf.startTime} onChange={(e) => setTf((f) => ({ ...f, startTime: e.target.value }))} /></div>
            <div><Label>End</Label><Input type="time" value={tf.endTime} onChange={(e) => setTf((f) => ({ ...f, endTime: e.target.value }))} /></div>
          </div>
          <div><Label>Colour</Label><input type="color" value={tf.color} onChange={(e) => setTf((f) => ({ ...f, color: e.target.value }))} className="h-10 w-20 cursor-pointer rounded border border-gray-300 dark:border-gray-700" /></div>
          <p className="text-xs text-gray-500">An end time earlier than the start means the shift ends the next day.</p>
        </div>
      </Modal>
    </div>
  );
}
