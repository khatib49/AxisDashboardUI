import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
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
  createSelfOrderTable, deleteSelfOrderTable, getSelfOrderTableQrs, SelfOrderTableQrDto,
  SelfOrderTableUpsertDto, updateSelfOrderTable,
} from "../../services/selfOrderService";

const errMsg = (e: unknown) => (e as { message?: string })?.message || "Request failed";
const th = "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase";
const td = "px-4 py-3 text-sm text-gray-700 dark:text-gray-200";
const empty: SelfOrderTableUpsertDto = { code: "", label: "", isActive: true };

export default function SelfOrderTablesAdmin() {
  const [tables, setTables] = useState<SelfOrderTableQrDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<SelfOrderTableUpsertDto>(empty);
  const [editing, setEditing] = useState<SelfOrderTableQrDto | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<SelfOrderTableQrDto | null>(null);
  const [confirm, setConfirm] = useState<SelfOrderTableQrDto | null>(null);
  const [notification, setNotification] = useState<{ variant: "success" | "error" | "warning" | "info"; title: string; message: string } | null>(null);

  useEffect(() => {
    if (!notification) return;
    const t = setTimeout(() => setNotification(null), 4000);
    return () => clearTimeout(t);
  }, [notification]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTables(await getSelfOrderTableQrs(window.location.origin));
      setError(null);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      if (editing) await updateSelfOrderTable(editing.id, form); else await createSelfOrderTable(form);
      setNotification({ variant: "success", title: "Saved", message: `Table ${form.code.toUpperCase()} saved.` });
      setFormOpen(false); await load();
    } catch (e) {
      setNotification({ variant: "error", title: "Error", message: errMsg(e) });
    } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!confirm) return;
    const t = confirm; setConfirm(null);
    try {
      await deleteSelfOrderTable(t.id);
      setNotification({ variant: "success", title: "Removed", message: `Table ${t.code} removed.` });
      await load();
    } catch (e) {
      setNotification({ variant: "error", title: "Error", message: errMsg(e) });
    }
  };

  const printAll = (list: SelfOrderTableQrDto[]) => {
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) { setNotification({ variant: "warning", title: "Popup blocked", message: "Allow popups to print QR codes." }); return; }
    const cards = list.map((t) => {
      const svg = document.getElementById(`qr-${t.id}`)?.outerHTML ?? "";
      return `<div class="card"><div class="qr">${svg}</div><div class="label">${escapeHtml(t.label)}</div><div class="code">Scan to order · ${escapeHtml(t.code)}</div><div class="url">${escapeHtml(t.publicUrl)}</div></div>`;
    }).join("");
    w.document.write(`<!doctype html><html><head><title>Table QR codes</title><style>
      body{font-family:Arial,sans-serif;margin:16px;display:grid;grid-template-columns:repeat(2,1fr);gap:16px}
      .card{border:1px dashed #999;border-radius:12px;padding:16px;text-align:center;page-break-inside:avoid}
      .qr svg{width:220px;height:220px}.label{font-size:22px;font-weight:bold;margin-top:8px}.code{color:#444;margin-top:4px}.url{font-size:10px;color:#888;margin-top:6px;word-break:break-all}
    </style></head><body>${cards}<script>window.onload=function(){window.print()}</script></body></html>`);
    w.document.close();
  };

  return (
    <div>
      <PageMeta title="Self-order tables | Axis" description="QR self-ordering tables" />
      <PageBreadcrumb pageTitle="Self-order tables (QR)" />
      {notification && <div className="mb-4"><Alert variant={notification.variant} title={notification.title} message={notification.message} /></div>}
      {error && <div className="mb-4"><Alert variant="error" title="Could not load" message={error} /></div>}

      {/* Hidden QR renders used by the printer */}
      <div className="hidden" aria-hidden>
        {tables.map((t) => <QRCodeSVG key={t.id} id={`qr-${t.id}`} value={t.qrPayload} size={220} level="M" />)}
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03]">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <div>
            <h3 className="font-semibold text-gray-800 dark:text-white/90">Tables</h3>
            <p className="text-xs text-gray-500">Guests scan the QR → <code>{window.location.origin}/order/&lt;code&gt;</code></p>
          </div>
          <div className="flex gap-2">
            <button disabled={tables.length === 0} onClick={() => printAll(tables.filter((t) => t.isActive))} className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 disabled:opacity-50">Print all active</button>
            <button onClick={() => { setEditing(null); setForm(empty); setFormOpen(true); }} className="px-3 py-1.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700">+ Table</button>
          </div>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 text-gray-500 p-6"><Loader /> Loading…</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableCell isHeader className={th}>Code</TableCell><TableCell isHeader className={th}>Label</TableCell>
                <TableCell isHeader className={th}>Public URL</TableCell><TableCell isHeader className={th}>Active</TableCell>
                <TableCell isHeader className={th}>Actions</TableCell>
              </TableRow></TableHeader>
              <TableBody>
                {tables.length === 0 && <TableRow><TableCell colSpan={5} className={`${td} text-center text-gray-500`}>No tables yet. Add one and print its QR.</TableCell></TableRow>}
                {tables.map((t) => (
                  <TableRow key={t.id} className="border-t border-gray-100 dark:border-gray-800">
                    <TableCell className={`${td} font-mono`}>{t.code}</TableCell>
                    <TableCell className={td}>{t.label}</TableCell>
                    <TableCell className={`${td} text-xs break-all`}><a href={t.publicUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{t.publicUrl}</a></TableCell>
                    <TableCell className={td}>{t.isActive ? "Yes" : "No"}</TableCell>
                    <TableCell className={td}>
                      <div className="flex items-center gap-3">
                        <button className="text-blue-600 hover:underline" onClick={() => setPreview(t)}>QR</button>
                        <button className="text-blue-600 hover:underline" onClick={() => { setEditing(t); setForm({ code: t.code, label: t.label, isActive: t.isActive }); setFormOpen(true); }}>Edit</button>
                        <DeleteIconButton onClick={() => setConfirm(t)} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} title={editing ? "Edit table" : "New table"} className="max-w-md"
        footer={<><button onClick={() => setFormOpen(false)} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700">Cancel</button><button disabled={saving || !form.code.trim() || !form.label.trim()} onClick={save} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg disabled:opacity-50">{saving ? "Saving…" : "Save"}</button></>}>
        <div className="space-y-3">
          <div><Label>Code (printed in the QR, letters/digits/-/_)</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="T1" /></div>
          <div><Label>Label</Label><Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Table 1 — terrace" /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active (guests can order)</label>
        </div>
      </Modal>

      <Modal isOpen={!!preview} onClose={() => setPreview(null)} title={preview ? `QR — ${preview.label}` : ""} className="max-w-sm"
        footer={<><button onClick={() => preview && printAll([preview])} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700">Print</button><button onClick={() => setPreview(null)} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg">Close</button></>}>
        {preview && (
          <div className="flex flex-col items-center gap-3">
            <div className="bg-white p-3 rounded-lg"><QRCodeSVG value={preview.qrPayload} size={220} level="M" /></div>
            <div className="font-semibold text-gray-800 dark:text-white/90">{preview.label} · {preview.code}</div>
            <div className="text-xs text-gray-500 break-all text-center">{preview.publicUrl}</div>
          </div>
        )}
      </Modal>

      <Modal isOpen={!!confirm} onClose={() => setConfirm(null)} title="Remove table?" className="max-w-md"
        footer={<><button onClick={() => setConfirm(null)} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700">Keep</button><button onClick={remove} className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg">Remove</button></>}>
        <p className="text-sm text-gray-600 dark:text-gray-300">Printed QR codes for {confirm?.code} will stop working.</p>
      </Modal>
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
