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
  CampaignDto,
  CampaignRecipientDto,
  CampaignStatsDto,
  SegmentDto,
  cancelCampaign,
  createCampaign,
  deleteCampaign,
  getCampaignRecipients,
  getCampaignStats,
  getCampaigns,
  getSegments,
  previewSegment,
  scheduleCampaign,
  sendCampaignNow,
  testSendCampaign,
  updateCampaign,
} from "../../services/marketingService";

type Notice = { variant: "success" | "error" | "warning" | "info"; title: string; message: string };

type Form = {
  name: string;
  channel: string;
  segmentId: string;
  subject: string;
  body: string;
  whatsAppTemplate: string;
  promoCode: string;
  scheduledFor: string; // datetime-local
};

const CHANNELS = ["Email", "Sms", "WhatsApp"];
const STATUSES = ["Draft", "Scheduled", "Sending", "Sent", "Cancelled", "Failed"];
const PLACEHOLDERS = ["{{name}}", "{{firstName}}", "{{lastVisit}}", "{{code}}", "{{unsubscribeUrl}}"];
const emptyForm: Form = { name: "", channel: "Email", segmentId: "", subject: "", body: "", whatsAppTemplate: "", promoCode: "", scheduledFor: "" };

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

function toLocalInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function statusClass(s?: string | null): string {
  switch (s) {
    case "Sent": return "bg-green-50 text-green-700 dark:bg-green-500/10";
    case "Failed": return "bg-red-50 text-red-700 dark:bg-red-500/10";
    case "Skipped": case "Cancelled": return "bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10";
    case "Scheduled": case "Sending": case "Pending": return "bg-blue-50 text-blue-700 dark:bg-blue-500/10";
    default: return "bg-gray-100 text-gray-500 dark:text-gray-400 dark:bg-white/10";
  }
}

const th = "px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400";
const td = "px-5 py-3 text-sm text-gray-700 dark:text-gray-300";
const btn = "inline-flex items-center px-3 py-1.5 rounded text-sm transition disabled:opacity-50";
const select = "h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white";
const textarea = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-mono dark:border-gray-700 dark:bg-gray-900 dark:text-white";
const chip = "rounded-full border border-gray-300 px-2 py-0.5 text-xs hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-white/10";

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<CampaignDto[]>([]);
  const [segments, setSegments] = useState<SegmentDto[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CampaignDto | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [testAddress, setTestAddress] = useState("");
  const [testing, setTesting] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<CampaignDto | null>(null);
  const [sendTarget, setSendTarget] = useState<CampaignDto | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [statsFor, setStatsFor] = useState<CampaignDto | null>(null);
  const [stats, setStats] = useState<CampaignStatsDto | null>(null);
  const [recipients, setRecipients] = useState<CampaignRecipientDto[]>([]);
  const [recipientsTotal, setRecipientsTotal] = useState(0);
  const [recipientsPage, setRecipientsPage] = useState(1);
  const [recipientStatus, setRecipientStatus] = useState("");
  const [recipientSearch, setRecipientSearch] = useState("");
  const [statsLoading, setStatsLoading] = useState(false);
  const PAGE = 25;

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCampaigns(await getCampaigns(statusFilter || undefined));
    } catch (err) {
      setError(errMessage(err, "Failed to load campaigns"));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { getSegments().then(setSegments).catch(() => setSegments([])); }, []);

  // Audience count for the picked segment.
  useEffect(() => {
    if (!formOpen || !form.segmentId) { setAudienceCount(null); return; }
    let alive = true;
    previewSegment(Number(form.segmentId)).then((p) => { if (alive) setAudienceCount(p.count); }).catch(() => { if (alive) setAudienceCount(null); });
    return () => { alive = false; };
  }, [formOpen, form.segmentId]);

  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, segmentId: segments[0] ? String(segments[0].id) : "" });
    setTestAddress("");
    setFormOpen(true);
  }

  function openEdit(c: CampaignDto) {
    setEditing(c);
    setForm({
      name: c.name,
      channel: c.channel,
      segmentId: String(c.segmentId),
      subject: c.subject ?? "",
      body: c.body ?? "",
      whatsAppTemplate: c.whatsAppTemplate ?? "",
      promoCode: c.promoCode ?? "",
      scheduledFor: toLocalInput(c.scheduledFor),
    });
    setTestAddress("");
    setFormOpen(true);
  }

  function insertPlaceholder(p: string) {
    const el = bodyRef.current;
    if (!el) { set({ body: form.body + p }); return; }
    const start = el.selectionStart ?? form.body.length;
    const end = el.selectionEnd ?? start;
    const next = form.body.slice(0, start) + p + form.body.slice(end);
    set({ body: next });
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + p.length, start + p.length); });
  }

  function validate(): string | null {
    if (!form.name.trim()) return "Name is required";
    if (!form.segmentId) return "Pick a segment";
    if (form.channel === "Email" && !form.subject.trim()) return "E-mail campaigns need a subject";
    if (form.channel === "WhatsApp" && !form.whatsAppTemplate.trim()) return "WhatsApp campaigns need a Meta template name";
    if (form.channel !== "WhatsApp" && !form.body.trim()) return "Body is required";
    return null;
  }

  function payload() {
    return {
      name: form.name.trim(),
      channel: form.channel,
      segmentId: Number(form.segmentId),
      subject: form.subject.trim() || null,
      body: form.body,
      whatsAppTemplate: form.whatsAppTemplate.trim() || null,
      promoCode: form.promoCode.trim() || null,
      scheduledFor: form.scheduledFor ? new Date(form.scheduledFor).toISOString() : null,
    };
  }

  /** Saves the form (create or update) and returns the saved campaign. */
  async function save(): Promise<CampaignDto | null> {
    const v = validate();
    if (v) { setNotice({ variant: "error", title: "Validation", message: v }); return null; }
    setSubmitting(true);
    try {
      const saved = editing ? await updateCampaign(editing.id, payload()) : await createCampaign(payload());
      setEditing(saved);
      await load();
      return saved;
    } catch (err) {
      setNotice({ variant: "error", title: "Save failed", message: errMessage(err, "Could not save campaign") });
      return null;
    } finally {
      setSubmitting(false);
    }
  }

  async function saveAndClose() {
    const saved = await save();
    if (!saved) return;
    setNotice({ variant: "success", title: "Saved", message: saved.status === "Scheduled" ? `Scheduled for ${fmtDate(saved.scheduledFor)}` : "Campaign saved as draft" });
    setFormOpen(false);
  }

  async function saveAndSend() {
    const saved = await save();
    if (!saved) return;
    setFormOpen(false);
    setSendTarget(saved);
  }

  async function runTestSend() {
    if (!testAddress.trim()) { setNotice({ variant: "error", title: "Validation", message: "Enter an address to test-send to" }); return; }
    const saved = await save();
    if (!saved) return;
    setTesting(true);
    try {
      const r = await testSendCampaign(saved.id, testAddress.trim());
      setNotice({
        variant: r.status === "Sent" ? "success" : r.status === "Skipped" ? "warning" : "error",
        title: `Test send ${r.status.toLowerCase()}`,
        message: r.status === "Sent" ? `Message sent to ${r.address}` : `${r.address}: ${r.error ?? r.status}`,
      });
    } catch (err) {
      setNotice({ variant: "error", title: "Test send failed", message: errMessage(err, "Could not send test message") });
    } finally {
      setTesting(false);
    }
  }

  async function confirmSend() {
    if (!sendTarget) return;
    setBusyId(sendTarget.id);
    const target = sendTarget;
    setSendTarget(null);
    try {
      const r = await sendCampaignNow(target.id);
      setNotice({
        variant: r.status === "Failed" ? "error" : r.failed > 0 ? "warning" : "success",
        title: `Campaign ${r.status.toLowerCase()}`,
        message: `Audience ${r.audienceCount} · sent ${r.sent} · failed ${r.failed} · skipped ${r.skipped}`,
      });
      await load();
    } catch (err) {
      setNotice({ variant: "error", title: "Send failed", message: errMessage(err, "Could not send campaign") });
    } finally {
      setBusyId(null);
    }
  }

  async function cancel(c: CampaignDto) {
    try {
      await cancelCampaign(c.id);
      setNotice({ variant: "success", title: "Cancelled", message: `${c.name} will not be sent` });
      await load();
    } catch (err) {
      setNotice({ variant: "error", title: "Cancel failed", message: errMessage(err, "Could not cancel campaign") });
    }
  }

  async function reschedule(c: CampaignDto) {
    const when = window.prompt("Send at (local date & time, e.g. 2026-11-05 18:00)", toLocalInput(c.scheduledFor).replace("T", " "));
    if (!when) return;
    const d = new Date(when.replace(" ", "T"));
    if (Number.isNaN(d.getTime())) { setNotice({ variant: "error", title: "Invalid date", message: "Could not parse the date" }); return; }
    try {
      await scheduleCampaign(c.id, d.toISOString());
      setNotice({ variant: "success", title: "Scheduled", message: `Will be sent at ${d.toLocaleString()}` });
      await load();
    } catch (err) {
      setNotice({ variant: "error", title: "Schedule failed", message: errMessage(err, "Could not schedule campaign") });
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteCampaign(deleteTarget.id);
      setDeleteTarget(null);
      setNotice({ variant: "success", title: "Deleted", message: "Campaign removed" });
      await load();
    } catch (err) {
      setNotice({ variant: "error", title: "Delete failed", message: errMessage(err, "Could not delete campaign") });
    }
  }

  const loadRecipients = useCallback(async (c: CampaignDto, page: number, status: string, search: string) => {
    setStatsLoading(true);
    try {
      const [s, r] = await Promise.all([
        getCampaignStats(c.id),
        getCampaignRecipients(c.id, { status: status || undefined, search: search || undefined, page, pageSize: PAGE }),
      ]);
      setStats(s);
      setRecipients(r.data);
      setRecipientsTotal(r.totalCount);
    } catch (err) {
      setNotice({ variant: "error", title: "Load failed", message: errMessage(err, "Could not load campaign stats") });
      setStats(null);
      setRecipients([]);
      setRecipientsTotal(0);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  function openStats(c: CampaignDto) {
    setStatsFor(c);
    setStats(null);
    setRecipients([]);
    setRecipientsPage(1);
    setRecipientStatus("");
    setRecipientSearch("");
    void loadRecipients(c, 1, "", "");
  }

  useEffect(() => {
    if (!statsFor) return;
    const t = setTimeout(() => { void loadRecipients(statsFor, recipientsPage, recipientStatus, recipientSearch); }, 250);
    return () => clearTimeout(t);
  }, [statsFor, recipientsPage, recipientStatus, recipientSearch, loadRecipients]);

  const canEdit = (c: CampaignDto) => ["Draft", "Scheduled", "Cancelled"].includes(c.status);
  const pages = Math.max(1, Math.ceil(recipientsTotal / PAGE));

  return (
    <div className="p-6">
      <PageMeta title="Marketing Campaigns | Axis" description="E-mail, SMS and WhatsApp campaigns" />
      <PageBreadcrumb pageTitle="Marketing campaigns" />

      {notice && (
        <div className="mb-4"><Alert variant={notice.variant} title={notice.title} message={notice.message} /></div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <select className={`${select} w-44`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Scheduled campaigns are sent by the 5-minute job. E-mail needs <code>Smtp.*</code>, SMS needs <code>Sms.*</code>, WhatsApp needs <code>WhatsApp.*</code> integration settings.
          </p>
        </div>
        <button className={`${btn} bg-blue-600 text-white hover:bg-blue-700 px-4 py-2`} onClick={openCreate}>+ New campaign</button>
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
                  <TableCell isHeader className={th}>Channel</TableCell>
                  <TableCell isHeader className={th}>Segment</TableCell>
                  <TableCell isHeader className={th}>Status</TableCell>
                  <TableCell isHeader className={th}>Schedule / sent</TableCell>
                  <TableCell isHeader className={th}>Results</TableCell>
                  <TableCell isHeader className={th}>Actions</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {campaigns.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="px-5 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                      {segments.length === 0 ? "No campaigns yet. Create a segment first, then a campaign." : "No campaigns match this filter."}
                    </TableCell>
                  </TableRow>
                )}
                {campaigns.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className={`${td} font-medium text-gray-800 dark:text-white/90`}>
                      {c.name}
                      {c.subject && <div className="text-xs font-normal text-gray-400 truncate max-w-[260px]">{c.subject}</div>}
                    </TableCell>
                    <TableCell className={td}>{c.channel}</TableCell>
                    <TableCell className={td}>{c.segmentName ?? `#${c.segmentId}`}</TableCell>
                    <TableCell className={td}><span className={`rounded-full px-2 py-0.5 text-xs ${statusClass(c.status)}`}>{c.status}</span></TableCell>
                    <TableCell className={td}>
                      {c.status === "Scheduled" && <div className="text-xs">Due {fmtDate(c.scheduledFor)}</div>}
                      {c.sentOn && <div className="text-xs">Sent {fmtDate(c.sentOn)}</div>}
                      {!c.sentOn && c.status !== "Scheduled" && <span className="text-xs text-gray-400">—</span>}
                    </TableCell>
                    <TableCell className={td}>
                      {c.sentOn ? (
                        <span className="text-xs">{c.audienceCount} audience · <span className="text-green-700 dark:text-green-400">{c.sentCount} sent</span> · <span className="text-red-700 dark:text-red-400">{c.failedCount} failed</span></span>
                      ) : <span className="text-xs text-gray-400">—</span>}
                    </TableCell>
                    <TableCell className={td}>
                      <div className="flex flex-wrap items-center gap-2">
                        {canEdit(c) && (
                          <button className={`${btn} bg-blue-600 text-white hover:bg-blue-700`} disabled={busyId === c.id} onClick={() => setSendTarget(c)}>
                            {busyId === c.id ? "Sending…" : "Send now"}
                          </button>
                        )}
                        {canEdit(c) && <button className={`${btn} bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:text-white`} onClick={() => reschedule(c)}>Schedule</button>}
                        {(c.status === "Draft" || c.status === "Scheduled") && <button className={`${btn} bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:text-white`} onClick={() => cancel(c)}>Cancel</button>}
                        <button className={`${btn} bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:text-white`} onClick={() => openStats(c)}>Stats</button>
                        {canEdit(c) && <button className={`${btn} bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:text-white`} onClick={() => openEdit(c)}>Edit</button>}
                        {c.status !== "Sending" && <DeleteIconButton onClick={() => setDeleteTarget(c)} />}
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
        title={editing ? `Edit ${editing.name}` : "New campaign"}
        className="max-w-4xl"
        footer={
          <>
            <button className={`${btn} bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:text-white`} onClick={() => setFormOpen(false)}>Cancel</button>
            <button className={`${btn} bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:text-white`} disabled={submitting} onClick={saveAndClose}>
              {submitting ? "Saving…" : form.scheduledFor ? "Save & schedule" : "Save draft"}
            </button>
            <button className={`${btn} bg-blue-600 text-white hover:bg-blue-700`} disabled={submitting} onClick={saveAndSend}>Save & send now</button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>Name</Label>
            <Input value={form.name} placeholder="November comeback offer" onChange={(e) => set({ name: e.target.value })} />
          </div>
          <div>
            <Label>Channel</Label>
            <select className={select} value={form.channel} onChange={(e) => set({ channel: e.target.value })}>
              {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <Label>Segment {audienceCount != null && <span className="text-xs text-gray-500 dark:text-gray-400">· {audienceCount} customer{audienceCount === 1 ? "" : "s"}</span>}</Label>
            <select className={select} value={form.segmentId} onChange={(e) => set({ segmentId: e.target.value })}>
              <option value="">— pick a segment —</option>
              {segments.map((s) => <option key={s.id} value={s.id}>{s.name}{s.isActive ? "" : " (inactive)"}</option>)}
            </select>
          </div>
          {form.channel === "Email" && (
            <div className="md:col-span-2">
              <Label>Subject</Label>
              <Input value={form.subject} placeholder="We miss you, {{firstName}}!" onChange={(e) => set({ subject: e.target.value })} />
            </div>
          )}
          {form.channel === "WhatsApp" && (
            <div className="md:col-span-2">
              <Label>WhatsApp template (Meta template name; parameter 1 = first name)</Label>
              <Input value={form.whatsAppTemplate} placeholder="comeback_offer_v1" onChange={(e) => set({ whatsAppTemplate: e.target.value })} />
            </div>
          )}
          <div className="md:col-span-2">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <Label>{form.channel === "WhatsApp" ? "Body (notes only — WhatsApp sends the approved template)" : form.channel === "Sms" ? "SMS text" : "E-mail body (plain text, or HTML starting with <)"}</Label>
              <div className="flex flex-wrap gap-1">
                {PLACEHOLDERS.map((p) => <button key={p} type="button" className={chip} onClick={() => insertPlaceholder(p)}>{p}</button>)}
              </div>
            </div>
            <textarea ref={bodyRef} className={textarea} rows={8} value={form.body} placeholder={"Hi {{firstName}}, it has been a while since {{lastVisit}}. Use code {{code}} for 10% off this week."} onChange={(e) => set({ body: e.target.value })} />
            {form.channel === "Email" && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">An unsubscribe link is appended automatically unless you place {"{{unsubscribeUrl}}"} yourself.</p>}
          </div>
          <div>
            <Label>Promo code ({"{{code}}"})</Label>
            <Input value={form.promoCode} placeholder="COMEBACK10" onChange={(e) => set({ promoCode: e.target.value })} />
          </div>
          <div>
            <Label>Schedule (leave empty to keep as draft)</Label>
            <Input type="datetime-local" value={form.scheduledFor} onChange={(e) => set({ scheduledFor: e.target.value })} />
          </div>
          <div className="md:col-span-2 rounded-lg border border-dashed border-gray-300 p-3 dark:border-gray-600">
            <Label>Test send (saves the campaign first)</Label>
            <div className="flex gap-2">
              <Input value={testAddress} placeholder={form.channel === "Email" ? "you@example.com" : "+96170123456"} onChange={(e) => setTestAddress(e.target.value)} />
              <button type="button" className={`${btn} bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:text-white whitespace-nowrap`} disabled={testing || submitting} onClick={runTestSend}>{testing ? "Sending…" : "Send test"}</button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Send now confirm */}
      <Modal
        isOpen={!!sendTarget}
        onClose={() => setSendTarget(null)}
        title="Send campaign now"
        className="max-w-md"
        footer={
          <>
            <button className={`${btn} bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:text-white`} onClick={() => setSendTarget(null)}>Cancel</button>
            <button className={`${btn} bg-blue-600 text-white hover:bg-blue-700`} onClick={confirmSend}>Send now</button>
          </>
        }
      >
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Send <strong>{sendTarget?.name}</strong> over <strong>{sendTarget?.channel}</strong> to everyone in <strong>{sendTarget?.segmentName ?? "the segment"}</strong> right now? Unsubscribed and address-less customers are skipped automatically.
        </p>
      </Modal>

      {/* Delete */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete campaign"
        className="max-w-md"
        footer={
          <>
            <button className={`${btn} bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:text-white`} onClick={() => setDeleteTarget(null)}>Cancel</button>
            <button className={`${btn} bg-red-600 text-white hover:bg-red-700`} onClick={confirmDelete}>Delete</button>
          </>
        }
      >
        <p className="text-sm text-gray-700 dark:text-gray-300">Delete <strong>{deleteTarget?.name}</strong> and its recipient log?</p>
      </Modal>

      {/* Stats drawer */}
      <Modal isOpen={!!statsFor} onClose={() => setStatsFor(null)} title={`Stats — ${statsFor?.name ?? ""}`} className="max-w-5xl">
        {stats && (
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              ["Audience", stats.audienceCount, ""],
              ["Sent", stats.sent, "text-green-700 dark:text-green-400"],
              ["Failed", stats.failed, "text-red-700 dark:text-red-400"],
              ["Skipped", stats.skipped, "text-yellow-700 dark:text-yellow-400"],
              ["Pending", stats.pending, "text-blue-700 dark:text-blue-400"],
            ].map(([label, value, cls]) => (
              <div key={String(label)} className="rounded-lg border border-gray-200 p-3 dark:border-white/[0.05]">
                <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
                <div className={`text-xl font-semibold ${cls}`}>{value}</div>
              </div>
            ))}
          </div>
        )}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <select className={`${select} w-40`} value={recipientStatus} onChange={(e) => { setRecipientsPage(1); setRecipientStatus(e.target.value); }}>
            <option value="">All recipients</option>
            {["Pending", "Sent", "Failed", "Skipped"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <div className="w-64">
            <Input value={recipientSearch} placeholder="Search address…" onChange={(e) => { setRecipientsPage(1); setRecipientSearch(e.target.value); }} />
          </div>
          <span className="text-sm text-gray-500 dark:text-gray-400">{recipientsTotal} row{recipientsTotal === 1 ? "" : "s"}</span>
          {stats?.sentOn && <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">Sent {fmtDate(stats.sentOn)} · status {stats.status}</span>}
        </div>
        {statsLoading && recipients.length === 0 ? (
          <div className="flex justify-center py-6"><Loader /></div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-white/[0.05]">
            <div className="max-h-80 overflow-auto">
              <Table>
                <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                  <TableRow>
                    <TableCell isHeader className={th}>Address</TableCell>
                    <TableCell isHeader className={th}>User</TableCell>
                    <TableCell isHeader className={th}>Status</TableCell>
                    <TableCell isHeader className={th}>Error</TableCell>
                    <TableCell isHeader className={th}>Sent on</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                  {recipients.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="px-5 py-6 text-center text-sm text-gray-500 dark:text-gray-400">No recipients yet — the list is built when the campaign is sent.</TableCell></TableRow>
                  )}
                  {recipients.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className={`${td} font-medium text-gray-800 dark:text-white/90`}>{r.address}{r.isTest && <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-white/10 dark:text-gray-400">test</span>}</TableCell>
                      <TableCell className={td}>{r.userId ?? "—"}</TableCell>
                      <TableCell className={td}><span className={`rounded-full px-2 py-0.5 text-xs ${statusClass(r.status)}`}>{r.status}</span></TableCell>
                      <TableCell className={`${td} max-w-[280px]`}><span className="block truncate" title={r.error ?? ""}>{r.error ?? "—"}</span></TableCell>
                      <TableCell className={td}>{fmtDate(r.sentOn)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
        {pages > 1 && (
          <div className="mt-3 flex items-center justify-end gap-2 text-sm">
            <button className={`${btn} bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:text-white`} disabled={recipientsPage <= 1} onClick={() => setRecipientsPage((p) => p - 1)}>Prev</button>
            <span className="text-gray-500 dark:text-gray-400">{recipientsPage} / {pages}</span>
            <button className={`${btn} bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:text-white`} disabled={recipientsPage >= pages} onClick={() => setRecipientsPage((p) => p + 1)}>Next</button>
          </div>
        )}
      </Modal>
    </div>
  );
}
