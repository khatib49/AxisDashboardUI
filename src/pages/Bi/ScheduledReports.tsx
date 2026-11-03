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
  ReportPreviewDto,
  ReportRunDto,
  ScheduledReportDto,
  createReport,
  deleteReport,
  getReportRuns,
  getReportTypes,
  getReports,
  previewReport,
  runReportNow,
  updateReport,
} from "../../services/biService";

type Notice = { variant: "success" | "error" | "warning" | "info"; title: string; message: string };

type Form = {
  name: string;
  reportType: string;
  frequency: string;
  runAtHourUtc: number;
  dayOfWeek: number;
  recipients: string;
  channel: string;
  format: string;
  isActive: boolean;
};

const FALLBACK_TYPES = ["DailySales", "WeeklySales", "LowStock", "OpenInvoices", "ShiftSummary"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const emptyForm: Form = {
  name: "",
  reportType: "DailySales",
  frequency: "Daily",
  runAtHourUtc: 6,
  dayOfWeek: 1,
  recipients: "",
  channel: "Email",
  format: "Html",
  isActive: true,
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
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function statusClass(s?: string | null): string {
  if (!s) return "bg-gray-100 text-gray-500 dark:bg-white/10";
  if (s.startsWith("Failed") || s.includes("failed")) return "bg-red-50 text-red-700 dark:bg-red-500/10";
  if (s.startsWith("Skipped") || s.includes("skipped")) return "bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10";
  return "bg-green-50 text-green-700 dark:bg-green-500/10";
}

const th = "px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400";
const td = "px-5 py-3 text-sm text-gray-700 dark:text-gray-300";
const btn = "inline-flex items-center px-3 py-1.5 rounded text-sm transition";
const select = "h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white";

export default function ScheduledReports() {
  const [reports, setReports] = useState<ScheduledReportDto[]>([]);
  const [types, setTypes] = useState<string[]>(FALLBACK_TYPES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduledReportDto | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ScheduledReportDto | null>(null);

  const [runningId, setRunningId] = useState<number | null>(null);
  const [runsFor, setRunsFor] = useState<ScheduledReportDto | null>(null);
  const [runs, setRuns] = useState<ReportRunDto[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [preview, setPreview] = useState<{ report: ScheduledReportDto; data: ReportPreviewDto } | null>(null);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReports(await getReports());
    } catch (err) {
      setError(errMessage(err, "Failed to load scheduled reports"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    getReportTypes().then((t) => { if (Array.isArray(t) && t.length) setTypes(t); }).catch(() => undefined);
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEdit(r: ScheduledReportDto) {
    setEditing(r);
    setForm({
      name: r.name,
      reportType: r.reportType,
      frequency: r.frequency,
      runAtHourUtc: r.runAtHourUtc,
      dayOfWeek: r.dayOfWeek ?? 1,
      recipients: r.recipients,
      channel: r.channel,
      format: r.format,
      isActive: r.isActive,
    });
    setFormOpen(true);
  }

  async function submitForm() {
    if (!form.name.trim() || !form.recipients.trim()) {
      setNotice({ variant: "error", title: "Validation", message: "Name and at least one recipient are required" });
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        reportType: form.reportType,
        frequency: form.frequency,
        runAtHourUtc: Number(form.runAtHourUtc),
        dayOfWeek: form.frequency === "Weekly" ? Number(form.dayOfWeek) : null,
        recipients: form.recipients.trim(),
        channel: form.channel,
        format: form.format,
        isActive: form.isActive,
      };
      if (editing) await updateReport(editing.id, payload);
      else await createReport(payload);
      setNotice({ variant: "success", title: "Saved", message: editing ? "Report updated" : "Report scheduled" });
      setFormOpen(false);
      await load();
    } catch (err) {
      setNotice({ variant: "error", title: "Save failed", message: errMessage(err, "Could not save report") });
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteReport(deleteTarget.id);
      setDeleteTarget(null);
      setNotice({ variant: "success", title: "Deleted", message: "Report removed" });
      await load();
    } catch (err) {
      setNotice({ variant: "error", title: "Delete failed", message: errMessage(err, "Could not delete report") });
    }
  }

  async function runNow(r: ScheduledReportDto) {
    setRunningId(r.id);
    try {
      const run = await runReportNow(r.id);
      const ok = !run.status.startsWith("Failed");
      setNotice({ variant: ok ? (run.status.includes("Skipped") ? "warning" : "success") : "error", title: "Run finished", message: run.status });
      await load();
    } catch (err) {
      setNotice({ variant: "error", title: "Run failed", message: errMessage(err, "Could not run report") });
    } finally {
      setRunningId(null);
    }
  }

  async function openRuns(r: ScheduledReportDto) {
    setRunsFor(r);
    setRunsLoading(true);
    try {
      setRuns(await getReportRuns(r.id));
    } catch (err) {
      setNotice({ variant: "error", title: "Load failed", message: errMessage(err, "Could not load runs") });
      setRuns([]);
    } finally {
      setRunsLoading(false);
    }
  }

  async function openPreview(r: ScheduledReportDto) {
    try {
      setPreview({ report: r, data: await previewReport(r.id) });
    } catch (err) {
      setNotice({ variant: "error", title: "Preview failed", message: errMessage(err, "Could not build preview") });
    }
  }

  async function toggleActive(r: ScheduledReportDto) {
    try {
      await updateReport(r.id, { isActive: !r.isActive });
      setReports((rs) => rs.map((x) => (x.id === r.id ? { ...x, isActive: !r.isActive } : x)));
    } catch (err) {
      setNotice({ variant: "error", title: "Update failed", message: errMessage(err, "Could not update report") });
    }
  }

  return (
    <div className="p-6">
      <PageMeta title="Scheduled Reports | Axis" description="Automated e-mail / WhatsApp reports" />
      <PageBreadcrumb pageTitle="Scheduled reports" />

      {notice && (
        <div className="mb-4"><Alert variant={notice.variant} title={notice.title} message={notice.message} /></div>
      )}

      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Reports are sent by the hourly job at the chosen UTC hour. E-mail needs the <code>Smtp.*</code> integration settings; WhatsApp needs <code>Reports.WhatsAppTemplate</code>.
        </p>
        <button className={`${btn} bg-blue-600 text-white hover:bg-blue-700 px-4 py-2`} onClick={openCreate}>+ New report</button>
      </div>

      {loading && <div className="flex justify-center py-10"><Loader /></div>}
      {error && <div className="text-red-600 bg-red-50 p-3 rounded mb-4">{error}</div>}

      {!loading && !error && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="max-w-full overflow-x-auto">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <TableCell isHeader className={th}>Name</TableCell>
                  <TableCell isHeader className={th}>Type</TableCell>
                  <TableCell isHeader className={th}>Schedule</TableCell>
                  <TableCell isHeader className={th}>Channel</TableCell>
                  <TableCell isHeader className={th}>Recipients</TableCell>
                  <TableCell isHeader className={th}>Last run</TableCell>
                  <TableCell isHeader className={th}>Active</TableCell>
                  <TableCell isHeader className={th}>Actions</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {reports.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="px-5 py-8 text-center text-sm text-gray-500">No scheduled reports yet.</TableCell>
                  </TableRow>
                )}
                {reports.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className={`${td} font-medium text-gray-800 dark:text-white/90`}>{r.name}</TableCell>
                    <TableCell className={td}>{r.reportType}</TableCell>
                    <TableCell className={td}>
                      {r.frequency}{r.frequency === "Weekly" && r.dayOfWeek != null ? ` (${DAYS[r.dayOfWeek]})` : ""}{r.frequency === "Monthly" ? " (1st)" : ""} @ {String(r.runAtHourUtc).padStart(2, "0")}:00 UTC
                    </TableCell>
                    <TableCell className={td}>{r.channel} · {r.format}</TableCell>
                    <TableCell className={`${td} max-w-[220px] truncate`} >{r.recipients}</TableCell>
                    <TableCell className={td}>
                      <div className="text-xs">{fmtDate(r.lastRunOn)}</div>
                      {r.lastStatus && <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs ${statusClass(r.lastStatus)}`}>{r.lastStatus}</span>}
                    </TableCell>
                    <TableCell className={td}>
                      <button onClick={() => toggleActive(r)} className={`rounded-full px-2 py-0.5 text-xs ${r.isActive ? "bg-green-50 text-green-700 dark:bg-green-500/10" : "bg-gray-100 text-gray-500 dark:bg-white/10"}`}>
                        {r.isActive ? "Active" : "Paused"}
                      </button>
                    </TableCell>
                    <TableCell className={td}>
                      <div className="flex items-center gap-2">
                        <button className={`${btn} bg-blue-600 text-white hover:bg-blue-700`} disabled={runningId === r.id} onClick={() => runNow(r)}>
                          {runningId === r.id ? "Running…" : "Run now"}
                        </button>
                        <button className={`${btn} bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:text-white`} onClick={() => openPreview(r)}>Preview</button>
                        <button className={`${btn} bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:text-white`} onClick={() => openRuns(r)}>Runs</button>
                        <button className={`${btn} bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:text-white`} onClick={() => openEdit(r)}>Edit</button>
                        <DeleteIconButton onClick={() => setDeleteTarget(r)} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Create / edit */}
      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit ${editing.name}` : "New scheduled report"}
        className="max-w-2xl"
        footer={
          <>
            <button className={`${btn} bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:text-white`} onClick={() => setFormOpen(false)}>Cancel</button>
            <button className={`${btn} bg-blue-600 text-white hover:bg-blue-700`} disabled={submitting} onClick={submitForm}>{submitting ? "Saving…" : "Save"}</button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>Name</Label>
            <Input value={form.name} placeholder="Morning sales digest" onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Report</Label>
            <select className={select} value={form.reportType} onChange={(e) => setForm({ ...form, reportType: e.target.value })}>
              {types.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <Label>Frequency</Label>
            <select className={select} value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
              <option value="Daily">Daily</option>
              <option value="Weekly">Weekly</option>
              <option value="Monthly">Monthly (1st)</option>
            </select>
          </div>
          <div>
            <Label>Hour (UTC, 0–23)</Label>
            <Input type="number" min="0" max="23" value={form.runAtHourUtc} onChange={(e) => setForm({ ...form, runAtHourUtc: Number(e.target.value) })} />
          </div>
          {form.frequency === "Weekly" && (
            <div>
              <Label>Day of week</Label>
              <select className={select} value={form.dayOfWeek} onChange={(e) => setForm({ ...form, dayOfWeek: Number(e.target.value) })}>
                {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </select>
            </div>
          )}
          <div>
            <Label>Channel</Label>
            <select className={select} value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
              <option value="Email">Email</option>
              <option value="WhatsApp">WhatsApp</option>
              <option value="Both">Both</option>
            </select>
          </div>
          <div>
            <Label>Format</Label>
            <select className={select} value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })}>
              <option value="Html">Html</option>
              <option value="Csv">Csv (attachment)</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <Label>Recipients (comma-separated e-mails and/or phone numbers)</Label>
            <Input value={form.recipients} placeholder="owner@axislb.com, +96170123456" onChange={(e) => setForm({ ...form, recipients: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
            Active
          </label>
        </div>
      </Modal>

      {/* Delete */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete report"
        className="max-w-md"
        footer={
          <>
            <button className={`${btn} bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:text-white`} onClick={() => setDeleteTarget(null)}>Cancel</button>
            <button className={`${btn} bg-red-600 text-white hover:bg-red-700`} onClick={confirmDelete}>Delete</button>
          </>
        }
      >
        <p className="text-sm text-gray-700 dark:text-gray-300">Delete <strong>{deleteTarget?.name}</strong> and its run history?</p>
      </Modal>

      {/* Runs */}
      <Modal isOpen={!!runsFor} onClose={() => setRunsFor(null)} title={`Runs — ${runsFor?.name ?? ""}`}>
        {runsLoading ? (
          <div className="flex justify-center py-6"><Loader /></div>
        ) : runs.length === 0 ? (
          <p className="text-sm text-gray-500">No runs yet.</p>
        ) : (
          <div className="space-y-3">
            {runs.map((run) => (
              <details key={run.id} className="rounded-lg border border-gray-200 p-3 dark:border-white/[0.05]">
                <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm">
                  <span className="text-gray-700 dark:text-gray-300">{fmtDate(run.ranOn)}{run.isManual ? " · manual" : ""}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${statusClass(run.status)}`}>{run.status}</span>
                </summary>
                {run.error && <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-red-50 p-2 text-xs text-red-700 dark:bg-red-500/10">{run.error}</pre>}
                {run.payloadPreview && (
                  run.payloadPreview.trimStart().startsWith("<")
                    ? <iframe title={`run-${run.id}`} sandbox="" srcDoc={run.payloadPreview} className="mt-2 h-64 w-full rounded border border-gray-200 bg-white" />
                    : <pre className="mt-2 max-h-64 overflow-auto rounded bg-gray-50 p-2 text-xs dark:bg-white/5 dark:text-gray-300">{run.payloadPreview}</pre>
                )}
              </details>
            ))}
          </div>
        )}
      </Modal>

      {/* Preview */}
      <Modal isOpen={!!preview} onClose={() => setPreview(null)} title={preview ? `${preview.data.title} (${preview.data.rowCount} rows)` : "Preview"}>
        {preview && (
          preview.data.format === "Csv"
            ? <pre className="max-h-[60vh] overflow-auto rounded bg-gray-50 p-3 text-xs dark:bg-white/5 dark:text-gray-300">{preview.data.content}</pre>
            : <iframe title="report-preview" sandbox="" srcDoc={preview.data.content} className="h-[60vh] w-full rounded border border-gray-200 bg-white" />
        )}
      </Modal>
    </div>
  );
}
