import { useEffect, useState } from "react";
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
  getVoidReasons,
  createVoidReason,
  updateVoidReason,
  deleteVoidReason,
  errorMessage,
  type VoidReasonDto,
} from "../../services/tillService";

type Notice = { variant: "success" | "error" | "warning" | "info"; title: string; message: string };

export default function VoidReasons() {
  const [rows, setRows] = useState<VoidReasonDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [editing, setEditing] = useState<VoidReasonDto | null>(null);
  const [form, setForm] = useState<{ name: string; requiresApproval: boolean; isActive: boolean } | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setRows(await getVoidReasons(true));
    } catch (err) {
      setError(errorMessage(err, "Failed to load reasons"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function save() {
    if (!form) return;
    if (!form.name.trim()) return setNotice({ variant: "error", title: "Validation", message: "Name is required" });
    setBusy(true);
    try {
      const r = editing
        ? await updateVoidReason(editing.id, form)
        : await createVoidReason({ name: form.name.trim(), requiresApproval: form.requiresApproval, isActive: form.isActive });
      if (!r.success) return setNotice({ variant: "error", title: "Failed", message: r.error || r.message });
      setNotice({ variant: "success", title: editing ? "Updated" : "Created", message: r.message });
      setForm(null);
      setEditing(null);
      await load();
    } catch (err) {
      setNotice({ variant: "error", title: "Failed", message: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (deleteId == null) return;
    setBusy(true);
    try {
      await deleteVoidReason(deleteId);
      setNotice({ variant: "success", title: "Deleted", message: "Reason removed (or deactivated if already used)." });
      setDeleteId(null);
      await load();
    } catch (err) {
      setNotice({ variant: "error", title: "Failed", message: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageMeta title="Void Reasons | Axis" description="Reasons cashiers pick when voiding or refunding" />
      <PageBreadcrumb pageTitle="Void Reasons" />
      {notice && <div className="mb-4"><Alert variant={notice.variant} title={notice.title} message={notice.message} /></div>}
      {error && <div className="mb-4"><Alert variant="error" title="Error" message={error} /></div>}

      <div className="mb-4 flex justify-end">
        <button onClick={() => { setEditing(null); setForm({ name: "", requiresApproval: true, isActive: true }); }} className="rounded-lg bg-brand-500 px-4 py-2 text-sm text-white hover:bg-brand-600">+ New reason</button>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        {loading ? (
          <div className="flex justify-center py-10"><Loader /></div>
        ) : rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-gray-500">No reasons yet. Add e.g. "Wrong item" (no approval) and "Customer complaint" (needs approval).</p>
        ) : (
          <Table>
            <TableHeader className="bg-gray-50 dark:bg-gray-900/40">
              <TableRow>
                <TableCell isHeader className="px-4 py-2 text-left text-xs uppercase text-gray-500">Name</TableCell>
                <TableCell isHeader className="px-4 py-2 text-left text-xs uppercase text-gray-500">Approval</TableCell>
                <TableCell isHeader className="px-4 py-2 text-left text-xs uppercase text-gray-500">Active</TableCell>
                <TableCell isHeader className="px-4 py-2 text-right text-xs uppercase text-gray-500">Actions</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} className="border-t border-gray-100 text-sm dark:border-gray-700 dark:text-gray-200">
                  <TableCell className="px-4 py-2">{r.name}</TableCell>
                  <TableCell className="px-4 py-2">
                    <span className={`rounded px-2 py-0.5 text-xs ${r.requiresApproval ? "bg-warning-50 text-warning-700" : "bg-success-50 text-success-700"}`}>{r.requiresApproval ? "Admin approval" : "Auto-approve voids"}</span>
                  </TableCell>
                  <TableCell className="px-4 py-2">{r.isActive ? "Yes" : "No"}</TableCell>
                  <TableCell className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-3">
                      <button onClick={() => { setEditing(r); setForm({ name: r.name, requiresApproval: r.requiresApproval, isActive: r.isActive }); }} className="text-brand-500 hover:underline">Edit</button>
                      <DeleteIconButton onClick={() => setDeleteId(r.id)} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Modal
        isOpen={!!form}
        onClose={() => setForm(null)}
        title={editing ? "Edit reason" : "New reason"}
        className="max-w-md"
        footer={
          <>
            <button onClick={() => setForm(null)} className="rounded-lg border px-4 py-2 text-sm dark:border-gray-600 dark:text-white">Cancel</button>
            <button disabled={busy} onClick={save} className="rounded-lg bg-brand-500 px-4 py-2 text-sm text-white disabled:opacity-50">{busy ? "Saving…" : "Save"}</button>
          </>
        }
      >
        {form && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="vr-name">Name</Label>
              <Input id="vr-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm dark:text-gray-200">
              <input type="checkbox" checked={form.requiresApproval} onChange={(e) => setForm({ ...form, requiresApproval: e.target.checked })} />
              Requires admin approval (unchecked = voids apply immediately)
            </label>
            <label className="flex items-center gap-2 text-sm dark:text-gray-200">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              Active
            </label>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={deleteId != null}
        onClose={() => setDeleteId(null)}
        title="Delete reason?"
        className="max-w-sm"
        footer={
          <>
            <button onClick={() => setDeleteId(null)} className="rounded-lg border px-4 py-2 text-sm dark:border-gray-600 dark:text-white">Cancel</button>
            <button disabled={busy} onClick={confirmDelete} className="rounded-lg bg-error-500 px-4 py-2 text-sm text-white disabled:opacity-50">Delete</button>
          </>
        }
      >
        <p className="text-sm dark:text-gray-200">Reasons already used by a request are deactivated instead of deleted.</p>
      </Modal>
    </>
  );
}
