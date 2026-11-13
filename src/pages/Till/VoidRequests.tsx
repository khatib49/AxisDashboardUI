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
  getVoidReasons,
  createVoidRequest,
  listVoidRequests,
  approveVoidRequest,
  rejectVoidRequest,
  errorMessage,
  type VoidReasonDto,
  type VoidRequestDto,
} from "../../services/tillService";
import { formatUsd } from "../../utils/money";

type Notice = { variant: "success" | "error" | "warning" | "info"; title: string; message: string };

const STATUS_CLASS: Record<string, string> = {
  Pending: "bg-warning-50 text-warning-700",
  Approved: "bg-success-50 text-success-700",
  Rejected: "bg-error-50 text-error-700",
};

/**
 * Till side: create a void/refund request. Admin side: approve / reject the queue.
 * Approve/reject buttons simply fail with 403 for non-admins, so the page works for both.
 */
export default function VoidRequests() {
  const [status, setStatus] = useState("Pending");
  const [rows, setRows] = useState<VoidRequestDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [reasons, setReasons] = useState<VoidReasonDto[]>([]);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState<{ transactionId: string; type: "Void" | "Refund"; amount: string; reasonId: string; reasonText: string } | null>(null);
  const [decision, setDecision] = useState<{ id: number; action: "approve" | "reject"; note: string } | null>(null);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await listVoidRequests(status || undefined, undefined, page, pageSize);
      setRows(r.data || []);
      setTotal(r.totalCount || 0);
    } catch (err) {
      setError(errorMessage(err, "Failed to load requests"));
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { getVoidReasons(false).then(setReasons).catch(() => setReasons([])); }, []);

  async function submitRequest() {
    if (!form) return;
    const txId = parseInt(form.transactionId, 10);
    if (!txId || txId <= 0) return setNotice({ variant: "error", title: "Validation", message: "Transaction id is required" });
    if (!form.reasonId) return setNotice({ variant: "error", title: "Validation", message: "Pick a reason" });
    const amount = form.amount ? parseFloat(form.amount) : null;
    if (amount != null && (Number.isNaN(amount) || amount <= 0)) return setNotice({ variant: "error", title: "Validation", message: "Amount must be greater than zero" });
    setBusy(true);
    try {
      const r = await createVoidRequest({ transactionId: txId, type: form.type, amount, reasonId: parseInt(form.reasonId, 10), reasonText: form.reasonText || null });
      if (!r.success) return setNotice({ variant: "error", title: "Rejected", message: r.error || r.message });
      setNotice({ variant: "success", title: r.data?.status === "Approved" ? "Applied" : "Submitted", message: r.message });
      setForm(null);
      await load();
    } catch (err) {
      setNotice({ variant: "error", title: "Failed", message: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  async function submitDecision() {
    if (!decision) return;
    setBusy(true);
    try {
      const r = decision.action === "approve" ? await approveVoidRequest(decision.id, decision.note) : await rejectVoidRequest(decision.id, decision.note);
      if (!r.success) return setNotice({ variant: "error", title: "Failed", message: r.error || r.message });
      setNotice({ variant: "success", title: decision.action === "approve" ? "Approved" : "Rejected", message: r.data?.decisionNote || r.message });
      setDecision(null);
      await load();
    } catch (err) {
      setNotice({ variant: "error", title: "Failed", message: errorMessage(err, "Not allowed") });
    } finally {
      setBusy(false);
    }
  }

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const selectedReason = form ? reasons.find((r) => String(r.id) === form.reasonId) : undefined;

  return (
    <>
      <PageMeta title="Void Requests | Axis" description="Void and refund approvals" />
      <PageBreadcrumb pageTitle="Void / Refund Requests" />
      {notice && <div className="mb-4"><Alert variant={notice.variant} title={notice.title} message={notice.message} /></div>}
      {error && <div className="mb-4"><Alert variant="error" title="Error" message={error} /></div>}

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <Label>Status</Label>
          <select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }} className="h-11 rounded-lg border border-gray-300 bg-transparent px-3 text-sm dark:border-gray-600 dark:text-white">
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
            <option value="">All</option>
          </select>
        </div>
        <p className="pb-3 text-sm text-gray-500 dark:text-gray-400">{total} request(s)</p>
        <button onClick={() => setForm({ transactionId: "", type: "Void", amount: "", reasonId: reasons[0] ? String(reasons[0].id) : "", reasonText: "" })} className="ml-auto rounded-lg bg-brand-500 px-4 py-2 text-sm text-white hover:bg-brand-600">+ New request</button>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 text-gray-800 dark:text-white/90">
        {loading ? (
          <div className="flex justify-center py-10"><Loader /></div>
        ) : rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">Nothing here.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-gray-50 dark:bg-gray-900/40">
                <TableRow>
                  {["#", "Tx", "Type", "Amount", "Reason", "Requested by", "When", "Status", "Decision", ""].map((h) => (
                    <TableCell key={h} isHeader className="px-4 py-2 text-left text-xs uppercase text-gray-500 dark:text-gray-400">{h}</TableCell>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((v) => (
                  <TableRow key={v.id} className="border-t border-gray-100 text-sm dark:border-gray-700 dark:text-gray-200">
                    <TableCell className="px-4 py-2">{v.id}</TableCell>
                    <TableCell className="px-4 py-2">#{v.transactionId}</TableCell>
                    <TableCell className="px-4 py-2">{v.type}</TableCell>
                    <TableCell className="px-4 py-2 tabular-nums">{v.amount != null ? formatUsd(v.amount) : "—"}</TableCell>
                    <TableCell className="px-4 py-2">
                      <div>{v.reasonName}</div>
                      {v.reasonText && <div className="text-xs text-gray-500 dark:text-gray-400">{v.reasonText}</div>}
                    </TableCell>
                    <TableCell className="px-4 py-2">{v.requestedBy}</TableCell>
                    <TableCell className="px-4 py-2 whitespace-nowrap">{new Date(v.requestedOn).toLocaleString()}</TableCell>
                    <TableCell className="px-4 py-2"><span className={`rounded px-2 py-0.5 text-xs ${STATUS_CLASS[v.status] || ""}`}>{v.status}</span></TableCell>
                    <TableCell className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
                      {v.decidedBy ? <>{v.decidedBy}<br />{v.decisionNote}</> : "—"}
                    </TableCell>
                    <TableCell className="px-4 py-2">
                      {v.status === "Pending" && (
                        <div className="flex gap-2">
                          <button onClick={() => setDecision({ id: v.id, action: "approve", note: "" })} className="rounded bg-success-600 px-2 py-1 text-xs text-white hover:bg-success-700">Approve</button>
                          <button onClick={() => setDecision({ id: v.id, action: "reject", note: "" })} className="rounded bg-error-500 px-2 py-1 text-xs text-white">Reject</button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm dark:border-gray-700">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border px-3 py-1 disabled:opacity-40 dark:border-gray-600 dark:text-white">Prev</button>
          <span className="text-gray-500 dark:text-gray-400">Page {page} / {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="rounded border px-3 py-1 disabled:opacity-40 dark:border-gray-600 dark:text-white">Next</button>
        </div>
      </div>

      <Modal
        isOpen={!!form}
        onClose={() => setForm(null)}
        title="Request a void / refund"
        className="max-w-md"
        footer={
          <>
            <button onClick={() => setForm(null)} className="rounded-lg border px-4 py-2 text-sm dark:border-gray-600 dark:text-white">Cancel</button>
            <button disabled={busy} onClick={submitRequest} className="rounded-lg bg-brand-500 px-4 py-2 text-sm text-white disabled:opacity-50">{busy ? "Sending…" : "Submit"}</button>
          </>
        }
      >
        {form && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="vq-tx">Transaction id</Label>
              <Input id="vq-tx" type="number" min="1" value={form.transactionId} onChange={(e) => setForm({ ...form, transactionId: e.target.value })} />
            </div>
            <div>
              <Label>Type</Label>
              <div className="flex gap-4 text-sm dark:text-gray-200">
                <label className="flex items-center gap-1"><input type="radio" checked={form.type === "Void"} onChange={() => setForm({ ...form, type: "Void" })} /> Void (cancel the sale, restock)</label>
                <label className="flex items-center gap-1"><input type="radio" checked={form.type === "Refund"} onChange={() => setForm({ ...form, type: "Refund" })} /> Refund (cash back)</label>
              </div>
            </div>
            <div>
              <Label htmlFor="vq-amount">Amount (USD, blank = full total)</Label>
              <Input id="vq-amount" type="number" min="0" step={0.01} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div>
              <Label>Reason</Label>
              {reasons.length === 0 ? (
                <p className="text-sm text-warning-600">No active reasons. Ask an admin to add some under Void Reasons.</p>
              ) : (
                <select value={form.reasonId} onChange={(e) => setForm({ ...form, reasonId: e.target.value })} className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm dark:border-gray-600 dark:text-white">
                  {reasons.map((r) => <option key={r.id} value={r.id}>{r.name}{r.requiresApproval ? "" : " (auto)"}</option>)}
                </select>
              )}
              {selectedReason && form.type === "Void" && !selectedReason.requiresApproval && (
                <p className="mt-1 text-xs text-success-600">This reason applies the void immediately, without admin approval.</p>
              )}
              {form.type === "Refund" && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Refunds always wait for an admin, who pays out from their open shift.</p>}
            </div>
            <div>
              <Label htmlFor="vq-text">Details (optional)</Label>
              <Input id="vq-text" value={form.reasonText} onChange={(e) => setForm({ ...form, reasonText: e.target.value })} />
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!decision}
        onClose={() => setDecision(null)}
        title={decision?.action === "approve" ? "Approve request" : "Reject request"}
        className="max-w-md"
        footer={
          <>
            <button onClick={() => setDecision(null)} className="rounded-lg border px-4 py-2 text-sm dark:border-gray-600 dark:text-white">Cancel</button>
            <button disabled={busy} onClick={submitDecision} className={`rounded-lg px-4 py-2 text-sm text-white disabled:opacity-50 ${decision?.action === "approve" ? "bg-success-600 hover:bg-success-700" : "bg-error-500 hover:bg-error-600"}`}>{busy ? "Working…" : decision?.action === "approve" ? "Approve" : "Reject"}</button>
          </>
        }
      >
        {decision && (
          <div className="space-y-3">
            {decision.action === "approve" && <p className="text-sm text-gray-600 dark:text-gray-300">A void deletes the transaction and restores stock. A refund records a pay-out on your open shift.</p>}
            <div>
              <Label htmlFor="dec-note">Note (optional)</Label>
              <Input id="dec-note" value={decision.note} onChange={(e) => setDecision({ ...decision, note: e.target.value })} />
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
