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
import HappyHourBanner from "../../components/promotions/HappyHourBanner";
import { CategoryDto, getCategories } from "../../services/categoryService";
import {
  createHappyHourRule,
  deleteHappyHourRule,
  errorMessage,
  getHappyHourActiveNow,
  HappyHourRuleDto,
  HappyHourRuleUpsertDto,
  listHappyHourRules,
  updateHappyHourRule,
} from "../../services/promotionsService";

type Notice = { variant: "success" | "error" | "warning" | "info"; title: string; message: string };

const DAYS: { iso: number; label: string }[] = [
  { iso: 1, label: "Mon" }, { iso: 2, label: "Tue" }, { iso: 3, label: "Wed" }, { iso: 4, label: "Thu" },
  { iso: 5, label: "Fri" }, { iso: 6, label: "Sat" }, { iso: 7, label: "Sun" },
];

type Form = {
  name: string; days: number[]; startTime: string; endTime: string; discountPercent: string;
  categoryIds: number[]; itemIdsCsv: string; isActive: boolean; priority: string;
};
const emptyForm: Form = { name: "", days: [], startTime: "17:00", endTime: "19:00", discountPercent: "", categoryIds: [], itemIdsCsv: "", isActive: true, priority: "0" };

const csvToIds = (csv?: string | null) => (csv ?? "").split(",").map((s) => Number(s)).filter((n) => n > 0);

export default function HappyHours() {
  const [rules, setRules] = useState<HappyHourRuleDto[]>([]);
  const [activeIds, setActiveIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [categories, setCategories] = useState<CategoryDto[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<HappyHourRuleDto | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    getCategories(1, 200).then((r) => setCategories(r.data ?? [])).catch(() => setCategories([]));
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, now] = await Promise.all([listHappyHourRules(true), getHappyHourActiveNow().catch(() => null)]);
      setRules(list ?? []);
      setActiveIds((now?.rules ?? []).map((r) => r.id));
    } catch (e) {
      setError(errorMessage(e, "Failed to load happy hour rules"));
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  function openCreate() { setEditing(null); setForm(emptyForm); setFormOpen(true); }
  function openEdit(r: HappyHourRuleDto) {
    setEditing(r);
    setForm({
      name: r.name, days: csvToIds(r.daysOfWeekCsv), startTime: r.startTime, endTime: r.endTime,
      discountPercent: String(r.discountPercent), categoryIds: csvToIds(r.categoryIdsCsv),
      itemIdsCsv: r.itemIdsCsv ?? "", isActive: r.isActive, priority: String(r.priority),
    });
    setFormOpen(true);
  }

  async function submit() {
    const pct = Number(form.discountPercent);
    if (!form.name.trim()) { setNotice({ variant: "error", title: "Validation", message: "Name is required" }); return; }
    if (!pct || pct <= 0 || pct > 100) { setNotice({ variant: "error", title: "Validation", message: "Discount must be 1-100%" }); return; }
    if (!/^\d{2}:\d{2}$/.test(form.startTime) || !/^\d{2}:\d{2}$/.test(form.endTime)) { setNotice({ variant: "error", title: "Validation", message: "Times must be HH:mm" }); return; }
    const dto: HappyHourRuleUpsertDto = {
      name: form.name.trim(),
      daysOfWeekCsv: form.days.slice().sort((a, b) => a - b).join(","),
      startTime: form.startTime,
      endTime: form.endTime,
      discountPercent: pct,
      categoryIdsCsv: form.categoryIds.length ? form.categoryIds.join(",") : null,
      itemIdsCsv: form.itemIdsCsv.trim() || null,
      isActive: form.isActive,
      priority: Number(form.priority) || 0,
    };
    setSubmitting(true);
    try {
      const res = editing ? await updateHappyHourRule(editing.id, dto) : await createHappyHourRule(dto);
      if (!res.success) { setNotice({ variant: "error", title: "Save failed", message: res.message }); return; }
      setNotice({ variant: "success", title: "Saved", message: res.message });
      setFormOpen(false);
      void reload();
    } catch (e) {
      setNotice({ variant: "error", title: "Save failed", message: errorMessage(e) });
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(r: HappyHourRuleDto) {
    if (!window.confirm(`Delete rule "${r.name}"? (A rule that was already applied is deactivated instead.)`)) return;
    try {
      await deleteHappyHourRule(r.id);
      setNotice({ variant: "success", title: "Deleted", message: r.name });
      void reload();
    } catch (e) {
      setNotice({ variant: "error", title: "Delete failed", message: errorMessage(e) });
    }
  }

  const dayLabels = (csv: string) => {
    const ids = csvToIds(csv);
    return ids.length === 0 ? "Every day" : DAYS.filter((d) => ids.includes(d.iso)).map((d) => d.label).join(" ");
  };
  const catNames = (csv?: string | null) => csvToIds(csv).map((id) => categories.find((c) => c.id === id)?.name ?? `#${id}`).join(", ");

  return (
    <>
      <PageMeta title="Happy Hours | Axis" description="Time-based pricing rules" />
      <PageBreadcrumb pageTitle="Happy Hours" />
      <HappyHourBanner className="mb-4" />
      {notice && <div className="mb-4"><Alert variant={notice.variant} title={notice.title} message={notice.message} /></div>}

      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="mb-4 flex items-center">
          <p className="text-sm text-gray-500">Rules are evaluated in venue time (Asia/Beirut). A window that ends before it starts runs overnight.</p>
          <button className="ml-auto rounded bg-brand-500 px-4 py-2 text-sm text-white" onClick={openCreate}>New rule</button>
        </div>
        {error && <Alert variant="error" title="Error" message={error} />}
        {loading ? <div className="flex justify-center py-10"><Loader /></div> : rules.length === 0 ? (
          <div className="py-10 text-center text-gray-500">No happy hour rules yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>{["Name", "Days", "Window", "Discount", "Applies to", "Priority", "Active", "Now", ""].map((h) => <TableCell key={h} isHeader className="px-3 py-3 text-left text-xs font-medium text-gray-500">{h}</TableCell>)}</TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((r) => (
                  <TableRow key={r.id} className="border-b border-gray-100 dark:border-white/[0.05]">
                    <TableCell className="px-3 py-3 text-sm font-medium">{r.name}</TableCell>
                    <TableCell className="px-3 py-3 text-sm">{dayLabels(r.daysOfWeekCsv)}</TableCell>
                    <TableCell className="px-3 py-3 text-sm">{r.startTime} – {r.endTime}{r.startTime > r.endTime ? " (overnight)" : ""}</TableCell>
                    <TableCell className="px-3 py-3 text-sm">{r.discountPercent}%</TableCell>
                    <TableCell className="px-3 py-3 text-xs">{!r.categoryIdsCsv && !r.itemIdsCsv ? "All items" : [catNames(r.categoryIdsCsv), r.itemIdsCsv ? `items ${r.itemIdsCsv}` : ""].filter(Boolean).join("; ")}</TableCell>
                    <TableCell className="px-3 py-3 text-sm">{r.priority}</TableCell>
                    <TableCell className="px-3 py-3 text-sm">{r.isActive ? "Yes" : "No"}</TableCell>
                    <TableCell className="px-3 py-3 text-sm">{activeIds.includes(r.id) ? <span className="rounded bg-success-50 px-2 py-0.5 text-xs text-success-700 dark:bg-success-500/15 dark:text-success-400">LIVE</span> : ""}</TableCell>
                    <TableCell className="px-3 py-3 text-right text-sm">
                      <div className="flex justify-end gap-3">
                        <button className="text-brand-500 hover:underline" onClick={() => openEdit(r)}>Edit</button>
                        <DeleteIconButton onClick={() => void remove(r)} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} title={editing ? `Edit ${editing.name}` : "New happy hour rule"}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="col-span-2"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Discount % *</Label><Input type="number" step={0.5} min="0" max="100" value={form.discountPercent} onChange={(e) => setForm({ ...form, discountPercent: e.target.value })} /></div>
          <div><Label>Priority</Label><Input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} /></div>
          <div><Label>Start (HH:mm)</Label><Input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></div>
          <div><Label>End (HH:mm)</Label><Input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></div>
          <div className="col-span-2 flex items-end gap-4">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active</label>
          </div>
          <div className="col-span-2 md:col-span-4">
            <Label>Days (none = every day)</Label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((d) => {
                const on = form.days.includes(d.iso);
                return <button key={d.iso} type="button" className={`rounded-full border px-3 py-1 text-xs ${on ? "border-brand-500 bg-brand-500 text-white" : "dark:border-gray-700"}`} onClick={() => setForm({ ...form, days: on ? form.days.filter((x) => x !== d.iso) : [...form.days, d.iso] })}>{d.label}</button>;
              })}
            </div>
          </div>
          <div className="col-span-2 md:col-span-4">
            <Label>Categories (none + no items = everything)</Label>
            <div className="flex max-h-28 flex-wrap gap-2 overflow-auto rounded-lg border p-2 dark:border-gray-700">
              {categories.map((c) => {
                const on = form.categoryIds.includes(c.id);
                return <button key={c.id} type="button" className={`rounded-full border px-3 py-1 text-xs ${on ? "border-brand-500 bg-brand-500 text-white" : "dark:border-gray-700"}`} onClick={() => setForm({ ...form, categoryIds: on ? form.categoryIds.filter((id) => id !== c.id) : [...form.categoryIds, c.id] })}>{c.name}</button>;
              })}
            </div>
          </div>
          <div className="col-span-2 md:col-span-4"><Label>Specific item ids (comma separated, optional)</Label><Input value={form.itemIdsCsv} placeholder="e.g. 12,15" onChange={(e) => setForm({ ...form, itemIdsCsv: e.target.value })} /></div>
          <div className="col-span-2 flex justify-end gap-2 md:col-span-4">
            <button className="rounded border px-4 py-2 text-sm dark:border-gray-700" onClick={() => setFormOpen(false)}>Cancel</button>
            <button className="rounded bg-brand-500 px-4 py-2 text-sm text-white disabled:opacity-50" disabled={submitting} onClick={submit}>{submitting ? "Saving…" : "Save"}</button>
          </div>
        </div>
      </Modal>
    </>
  );
}
