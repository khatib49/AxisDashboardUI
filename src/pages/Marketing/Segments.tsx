import { useCallback, useEffect, useRef, useState } from "react";
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
  AudiencePreviewDto,
  SegmentDto,
  SegmentRules,
  createSegment,
  deleteSegment,
  getSegments,
  previewRules,
  previewSegment,
  updateSegment,
} from "../../services/marketingService";

type Notice = { variant: "success" | "error" | "warning" | "info"; title: string; message: string };

type Form = {
  name: string;
  isActive: boolean;
  lastVisitWithinDays: string;
  lastVisitOlderThanDays: string;
  minSpend: string;
  spendPeriodDays: string;
  minVisits: string;
  loyaltyTicketsMin: string;
  hasEmail: "" | "yes" | "no";
  hasPhone: "" | "yes" | "no";
  branchId: string;
};

const emptyForm: Form = {
  name: "",
  isActive: true,
  lastVisitWithinDays: "",
  lastVisitOlderThanDays: "",
  minSpend: "",
  spendPeriodDays: "",
  minVisits: "",
  loyaltyTicketsMin: "",
  hasEmail: "",
  hasPhone: "",
  branchId: "",
};

function errMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object") {
    const e = err as { message?: unknown; details?: { error?: unknown } };
    if (e.details && typeof e.details.error === "string") return e.details.error;
    if (typeof e.message === "string") return e.message;
  }
  return fallback;
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString();
}

function num(s: string): number | null {
  const n = Number(s);
  return s.trim() === "" || Number.isNaN(n) ? null : n;
}

function tri(v: "" | "yes" | "no"): boolean | null {
  return v === "" ? null : v === "yes";
}

function formToRules(f: Form): SegmentRules {
  return {
    lastVisitWithinDays: num(f.lastVisitWithinDays),
    lastVisitOlderThanDays: num(f.lastVisitOlderThanDays),
    minSpend: num(f.minSpend),
    spendPeriodDays: num(f.spendPeriodDays),
    minVisits: num(f.minVisits),
    loyaltyTicketsMin: num(f.loyaltyTicketsMin),
    hasEmail: tri(f.hasEmail),
    hasPhone: tri(f.hasPhone),
    branchId: num(f.branchId),
  };
}

function rulesToForm(s: SegmentDto): Form {
  const r = s.rules ?? {};
  const str = (v?: number | null) => (v == null ? "" : String(v));
  const t = (v?: boolean | null): "" | "yes" | "no" => (v == null ? "" : v ? "yes" : "no");
  return {
    name: s.name,
    isActive: s.isActive,
    lastVisitWithinDays: str(r.lastVisitWithinDays),
    lastVisitOlderThanDays: str(r.lastVisitOlderThanDays),
    minSpend: str(r.minSpend),
    spendPeriodDays: str(r.spendPeriodDays),
    minVisits: str(r.minVisits),
    loyaltyTicketsMin: str(r.loyaltyTicketsMin),
    hasEmail: t(r.hasEmail),
    hasPhone: t(r.hasPhone),
    branchId: str(r.branchId),
  };
}

function describeRules(r: SegmentRules | undefined): string {
  if (!r) return "Everyone";
  const parts: string[] = [];
  if (r.lastVisitWithinDays != null) parts.push(`visited in last ${r.lastVisitWithinDays}d`);
  if (r.lastVisitOlderThanDays != null) parts.push(`inactive > ${r.lastVisitOlderThanDays}d`);
  if (r.minSpend != null) parts.push(`spend ≥ ${r.minSpend}${r.spendPeriodDays != null ? ` (${r.spendPeriodDays}d)` : ""}`);
  if (r.minVisits != null) parts.push(`visits ≥ ${r.minVisits}${r.spendPeriodDays != null && r.minSpend == null ? ` (${r.spendPeriodDays}d)` : ""}`);
  if (r.loyaltyTicketsMin != null) parts.push(`loyalty tickets ≥ ${r.loyaltyTicketsMin}`);
  if (r.hasEmail != null) parts.push(r.hasEmail ? "has e-mail" : "no e-mail");
  if (r.hasPhone != null) parts.push(r.hasPhone ? "has phone" : "no phone");
  if (r.branchId != null) parts.push(`branch #${r.branchId}`);
  return parts.length ? parts.join(" AND ") : "Everyone";
}

const th = "px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400";
const td = "px-5 py-3 text-sm text-gray-700 dark:text-gray-300";
const btn = "inline-flex items-center px-3 py-1.5 rounded text-sm transition";
const select = "h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white";

function AudienceTable({ data }: { data: AudiencePreviewDto }) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-white/[0.05]">
      <div className="max-h-72 overflow-auto">
        <Table>
          <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
            <TableRow>
              <TableCell isHeader className={th}>Name</TableCell>
              <TableCell isHeader className={th}>Phone</TableCell>
              <TableCell isHeader className={th}>E-mail</TableCell>
              <TableCell isHeader className={th}>Last visit</TableCell>
              <TableCell isHeader className={th}>Spend</TableCell>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
            {data.rows.length === 0 && (
              <TableRow><TableCell colSpan={5} className="px-5 py-6 text-center text-sm text-gray-500 dark:text-gray-400">No customers match these rules.</TableCell></TableRow>
            )}
            {data.rows.map((r) => (
              <TableRow key={r.userId}>
                <TableCell className={`${td} font-medium text-gray-800 dark:text-white/90`}>{r.name}</TableCell>
                <TableCell className={td}>{r.phone || "—"}</TableCell>
                <TableCell className={td}>{r.email || "—"}</TableCell>
                <TableCell className={td}>{fmtDate(r.lastVisit)}</TableCell>
                <TableCell className={td}>{r.spend.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default function Segments() {
  const [segments, setSegments] = useState<SegmentDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SegmentDto | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SegmentDto | null>(null);

  const [livePreview, setLivePreview] = useState<AudiencePreviewDto | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const liveTimer = useRef<number | null>(null);

  const [previewFor, setPreviewFor] = useState<SegmentDto | null>(null);
  const [preview, setPreview] = useState<AudiencePreviewDto | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSegments(await getSegments());
    } catch (err) {
      setError(errMessage(err, "Failed to load segments"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Live audience preview while editing rules (debounced).
  useEffect(() => {
    if (!formOpen) return;
    if (liveTimer.current) window.clearTimeout(liveTimer.current);
    liveTimer.current = window.setTimeout(async () => {
      setLiveLoading(true);
      setLiveError(null);
      try {
        setLivePreview(await previewRules(formToRules(form)));
      } catch (err) {
        setLiveError(errMessage(err, "Preview unavailable"));
        setLivePreview(null);
      } finally {
        setLiveLoading(false);
      }
    }, 400);
    return () => { if (liveTimer.current) window.clearTimeout(liveTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formOpen, form.lastVisitWithinDays, form.lastVisitOlderThanDays, form.minSpend, form.spendPeriodDays, form.minVisits, form.loyaltyTicketsMin, form.hasEmail, form.hasPhone, form.branchId]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setLivePreview(null);
    setFormOpen(true);
  }

  function openEdit(s: SegmentDto) {
    setEditing(s);
    setForm(rulesToForm(s));
    setLivePreview(null);
    setFormOpen(true);
  }

  async function submitForm() {
    if (!form.name.trim()) {
      setNotice({ variant: "error", title: "Validation", message: "Name is required" });
      return;
    }
    setSubmitting(true);
    try {
      const payload = { name: form.name.trim(), rules: formToRules(form), isActive: form.isActive };
      if (editing) await updateSegment(editing.id, payload);
      else await createSegment(payload);
      setNotice({ variant: "success", title: "Saved", message: editing ? "Segment updated" : "Segment created" });
      setFormOpen(false);
      await load();
    } catch (err) {
      setNotice({ variant: "error", title: "Save failed", message: errMessage(err, "Could not save segment") });
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteSegment(deleteTarget.id);
      setDeleteTarget(null);
      setNotice({ variant: "success", title: "Deleted", message: "Segment removed" });
      await load();
    } catch (err) {
      setNotice({ variant: "error", title: "Delete failed", message: errMessage(err, "Could not delete segment (is it used by a campaign?)") });
    }
  }

  async function openPreview(s: SegmentDto) {
    setPreviewFor(s);
    setPreview(null);
    setPreviewLoading(true);
    try {
      setPreview(await previewSegment(s.id));
    } catch (err) {
      setNotice({ variant: "error", title: "Preview failed", message: errMessage(err, "Could not build audience") });
      setPreviewFor(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function toggleActive(s: SegmentDto) {
    try {
      await updateSegment(s.id, { isActive: !s.isActive });
      setSegments((xs) => xs.map((x) => (x.id === s.id ? { ...x, isActive: !s.isActive } : x)));
    } catch (err) {
      setNotice({ variant: "error", title: "Update failed", message: errMessage(err, "Could not update segment") });
    }
  }

  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  return (
    <div className="p-6">
      <PageMeta title="Marketing Segments | Axis" description="Customer segments for marketing campaigns" />
      <PageBreadcrumb pageTitle="Marketing segments" />

      {notice && (
        <div className="mb-4"><Alert variant={notice.variant} title={notice.title} message={notice.message} /></div>
      )}

      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          A segment is a saved set of rules over your client customers (role <code>client</code>), their paid sales and loyalty tickets. All rules are combined with AND; the audience is rebuilt every time a campaign is sent.
        </p>
        <button className={`${btn} bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 whitespace-nowrap`} onClick={openCreate}>+ New segment</button>
      </div>

      {loading && <div className="flex justify-center py-10"><Loader /></div>}
      {error && <div className="text-red-600 bg-red-50 p-3 rounded mb-4 dark:bg-red-500/10">{error}</div>}

      {!loading && !error && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03] text-gray-800 dark:text-white/90">
          <div className="max-w-full overflow-x-auto">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <TableCell isHeader className={th}>Name</TableCell>
                  <TableCell isHeader className={th}>Rules</TableCell>
                  <TableCell isHeader className={th}>Created</TableCell>
                  <TableCell isHeader className={th}>Active</TableCell>
                  <TableCell isHeader className={th}>Actions</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {segments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="px-5 py-8 text-center text-sm text-gray-500 dark:text-gray-400">No segments yet. Create one to target a group of customers.</TableCell>
                  </TableRow>
                )}
                {segments.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className={`${td} font-medium text-gray-800 dark:text-white/90`}>{s.name}</TableCell>
                    <TableCell className={`${td} max-w-[420px]`}>{describeRules(s.rules)}</TableCell>
                    <TableCell className={td}>
                      <div className="text-xs">{fmtDate(s.createdOn)}</div>
                      <div className="text-xs text-gray-400">{s.createdBy}</div>
                    </TableCell>
                    <TableCell className={td}>
                      <button onClick={() => toggleActive(s)} className={`rounded-full px-2 py-0.5 text-xs ${s.isActive ? "bg-green-50 text-green-700 dark:bg-green-500/10" : "bg-gray-100 text-gray-500 dark:text-gray-400 dark:bg-white/10"}`}>
                        {s.isActive ? "Active" : "Inactive"}
                      </button>
                    </TableCell>
                    <TableCell className={td}>
                      <div className="flex items-center gap-2">
                        <button className={`${btn} bg-blue-600 text-white hover:bg-blue-700`} onClick={() => openPreview(s)}>Preview audience</button>
                        <button className={`${btn} bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:text-white`} onClick={() => openEdit(s)}>Edit</button>
                        <DeleteIconButton onClick={() => setDeleteTarget(s)} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Create / edit with live preview */}
      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit ${editing.name}` : "New segment"}
        className="max-w-5xl"
        footer={
          <>
            <button className={`${btn} bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:text-white`} onClick={() => setFormOpen(false)}>Cancel</button>
            <button className={`${btn} bg-blue-600 text-white hover:bg-blue-700`} disabled={submitting} onClick={submitForm}>{submitting ? "Saving…" : "Save"}</button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2 space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={form.name} placeholder="Visited in the last 30 days" onChange={(e) => set({ name: e.target.value })} />
            </div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Rules (leave blank to ignore)</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Visited within (days)</Label>
                <Input type="number" min="1" value={form.lastVisitWithinDays} placeholder="30" onChange={(e) => set({ lastVisitWithinDays: e.target.value })} />
              </div>
              <div>
                <Label>Inactive for more than (days)</Label>
                <Input type="number" min="1" value={form.lastVisitOlderThanDays} placeholder="90" onChange={(e) => set({ lastVisitOlderThanDays: e.target.value })} />
              </div>
              <div>
                <Label>Min spend</Label>
                <Input type="number" min="0" step={0.01} value={form.minSpend} placeholder="100" onChange={(e) => set({ minSpend: e.target.value })} />
              </div>
              <div>
                <Label>Spend / visits period (days)</Label>
                <Input type="number" min="1" value={form.spendPeriodDays} placeholder="all time" onChange={(e) => set({ spendPeriodDays: e.target.value })} />
              </div>
              <div>
                <Label>Min visits</Label>
                <Input type="number" min="1" value={form.minVisits} placeholder="3" onChange={(e) => set({ minVisits: e.target.value })} />
              </div>
              <div>
                <Label>Min loyalty tickets (this month)</Label>
                <Input type="number" min="1" value={form.loyaltyTicketsMin} placeholder="5" onChange={(e) => set({ loyaltyTicketsMin: e.target.value })} />
              </div>
              <div>
                <Label>Has e-mail</Label>
                <select className={select} value={form.hasEmail} onChange={(e) => set({ hasEmail: e.target.value as Form["hasEmail"] })}>
                  <option value="">Any</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div>
                <Label>Has phone</Label>
                <select className={select} value={form.hasPhone} onChange={(e) => set({ hasPhone: e.target.value as Form["hasPhone"] })}>
                  <option value="">Any</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div>
                <Label>Branch id (sales scope)</Label>
                <Input type="number" min="1" value={form.branchId} placeholder="all branches" onChange={(e) => set({ branchId: e.target.value })} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={form.isActive} onChange={(e) => set({ isActive: e.target.checked })} />
              Active
            </label>
          </div>
          <div className="lg:col-span-3">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Live audience preview</h4>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {liveLoading ? "Counting…" : livePreview ? `${livePreview.count} customer${livePreview.count === 1 ? "" : "s"}${livePreview.count > livePreview.rows.length ? ` (first ${livePreview.rows.length} shown)` : ""}` : ""}
              </span>
            </div>
            <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">{describeRules(formToRules(form))}</p>
            {liveError && <div className="mb-2 rounded bg-yellow-50 p-2 text-xs text-yellow-700 dark:bg-yellow-500/10">{liveError}</div>}
            {livePreview ? <AudienceTable data={livePreview} /> : !liveLoading && !liveError && <p className="text-sm text-gray-500 dark:text-gray-400">Adjust the rules to see who matches.</p>}
            {liveLoading && !livePreview && <div className="flex justify-center py-6"><Loader /></div>}
          </div>
        </div>
      </Modal>

      {/* Delete */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete segment"
        className="max-w-md"
        footer={
          <>
            <button className={`${btn} bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:text-white`} onClick={() => setDeleteTarget(null)}>Cancel</button>
            <button className={`${btn} bg-red-600 text-white hover:bg-red-700`} onClick={confirmDelete}>Delete</button>
          </>
        }
      >
        <p className="text-sm text-gray-700 dark:text-gray-300">Delete <strong>{deleteTarget?.name}</strong>? Segments used by a campaign cannot be deleted.</p>
      </Modal>

      {/* Saved segment preview */}
      <Modal isOpen={!!previewFor} onClose={() => setPreviewFor(null)} title={`Audience — ${previewFor?.name ?? ""}`}>
        {previewLoading || !preview ? (
          <div className="flex justify-center py-6"><Loader /></div>
        ) : (
          <>
            <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">
              <strong>{preview.count}</strong> customer{preview.count === 1 ? "" : "s"} match{preview.count === 1 ? "es" : ""}{preview.count > preview.rows.length ? ` — showing the first ${preview.rows.length}` : ""}.
              <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">{describeRules(previewFor?.rules)}</span>
            </p>
            <AudienceTable data={preview} />
          </>
        )}
      </Modal>
    </div>
  );
}
