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
  createKioskDevice, deleteKioskDevice, getKioskDevices, KioskDeviceDto, KioskDeviceUpsertDto,
  rotateKioskToken, updateKioskDevice,
} from "../../services/kioskService";

const errMsg = (e: unknown) => (e as { message?: string })?.message || "Request failed";
const th = "px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase";
const td = "px-4 py-3 text-sm text-gray-700 dark:text-gray-200";
const empty: KioskDeviceUpsertDto = { name: "", isActive: true };
const kioskUrl = (token: string) => `${window.location.origin}/kiosk?token=${encodeURIComponent(token)}`;

export default function KioskDevicesAdmin() {
  const [devices, setDevices] = useState<KioskDeviceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<KioskDeviceUpsertDto>(empty);
  const [editing, setEditing] = useState<KioskDeviceDto | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<{ kind: "delete" | "rotate"; device: KioskDeviceDto } | null>(null);
  const [notification, setNotification] = useState<{ variant: "success" | "error" | "warning" | "info"; title: string; message: string } | null>(null);

  useEffect(() => {
    if (!notification) return;
    const t = setTimeout(() => setNotification(null), 4000);
    return () => clearTimeout(t);
  }, [notification]);

  const load = useCallback(async () => {
    setLoading(true);
    try { setDevices(await getKioskDevices()); setError(null); }
    catch (e) { setError(errMsg(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      if (editing) await updateKioskDevice(editing.id, form); else await createKioskDevice(form);
      setNotification({ variant: "success", title: "Saved", message: `Device "${form.name}" saved.` });
      setFormOpen(false); await load();
    } catch (e) {
      setNotification({ variant: "error", title: "Error", message: errMsg(e) });
    } finally { setSaving(false); }
  };

  const confirmAction = async () => {
    if (!confirm) return;
    const c = confirm; setConfirm(null);
    try {
      if (c.kind === "delete") { await deleteKioskDevice(c.device.id); setNotification({ variant: "success", title: "Removed", message: `${c.device.name} removed.` }); }
      else { await rotateKioskToken(c.device.id); setNotification({ variant: "success", title: "Token rotated", message: `Update the link on "${c.device.name}".` }); }
      await load();
    } catch (e) {
      setNotification({ variant: "error", title: "Error", message: errMsg(e) });
    }
  };

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setNotification({ variant: "success", title: "Copied", message: "Kiosk link copied to clipboard." }); }
    catch { setNotification({ variant: "warning", title: "Copy failed", message: text }); }
  };

  return (
    <div>
      <PageMeta title="Kiosk devices | Axis" description="Self-service kiosk devices" />
      <PageBreadcrumb pageTitle="Kiosk devices" />
      {notification && <div className="mb-4"><Alert variant={notification.variant} title={notification.title} message={notification.message} /></div>}
      {error && <div className="mb-4"><Alert variant="error" title="Could not load" message={error} /></div>}

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] text-gray-800 dark:text-white/90">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <div>
            <h3 className="font-semibold text-gray-800 dark:text-white/90">Devices</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Open the device link in full-screen on the kiosk. Orders arrive as Takeaway on the delivery board.</p>
          </div>
          <button onClick={() => { setEditing(null); setForm(empty); setFormOpen(true); }} className="px-3 py-1.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700">+ Device</button>
        </div>
        {loading ? <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 p-6"><Loader /> Loading…</div> : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableCell isHeader className={th}>Name</TableCell><TableCell isHeader className={th}>Token</TableCell>
                <TableCell isHeader className={th}>Last seen</TableCell><TableCell isHeader className={th}>Active</TableCell>
                <TableCell isHeader className={th}>Actions</TableCell>
              </TableRow></TableHeader>
              <TableBody>
                {devices.length === 0 && <TableRow><TableCell colSpan={5} className={`${td} text-center text-gray-500 dark:text-gray-400`}>No kiosk devices yet.</TableCell></TableRow>}
                {devices.map((d) => (
                  <TableRow key={d.id} className="border-t border-gray-100 dark:border-gray-800">
                    <TableCell className={td}>{d.name}</TableCell>
                    <TableCell className={`${td} font-mono text-xs`}>{d.token.slice(0, 8)}…{d.token.slice(-4)}</TableCell>
                    <TableCell className={td}>{d.lastSeenOn ? new Date(d.lastSeenOn).toLocaleString() : "never"}</TableCell>
                    <TableCell className={td}>{d.isActive ? "Yes" : "No"}</TableCell>
                    <TableCell className={td}>
                      <div className="flex items-center gap-3 flex-wrap">
                        <button className="text-blue-600 dark:text-blue-400 hover:underline" onClick={() => copy(kioskUrl(d.token))}>Copy link</button>
                        <a className="text-blue-600 dark:text-blue-400 hover:underline" href={kioskUrl(d.token)} target="_blank" rel="noreferrer">Open</a>
                        <button className="text-blue-600 dark:text-blue-400 hover:underline" onClick={() => { setEditing(d); setForm({ name: d.name, isActive: d.isActive }); setFormOpen(true); }}>Edit</button>
                        <button className="text-amber-600 hover:underline" onClick={() => setConfirm({ kind: "rotate", device: d })}>Rotate token</button>
                        <DeleteIconButton onClick={() => setConfirm({ kind: "delete", device: d })} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} title={editing ? "Edit device" : "New device"} className="max-w-md"
        footer={<><button onClick={() => setFormOpen(false)} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300">Cancel</button><button disabled={saving || !form.name.trim()} onClick={save} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg disabled:opacity-50">{saving ? "Saving…" : "Save"}</button></>}>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Entrance kiosk" /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active</label>
          {!editing && <p className="text-xs text-gray-500 dark:text-gray-400">A token is generated on save; copy the link from the table afterwards.</p>}
        </div>
      </Modal>

      <Modal isOpen={!!confirm} onClose={() => setConfirm(null)} title={confirm?.kind === "delete" ? "Remove device?" : "Rotate token?"} className="max-w-md"
        footer={<><button onClick={() => setConfirm(null)} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300">Keep</button><button onClick={confirmAction} className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg">{confirm?.kind === "delete" ? "Remove" : "Rotate"}</button></>}>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {confirm?.kind === "delete" ? `"${confirm.device.name}" will stop accepting orders.` : `The current link for "${confirm?.device.name}" stops working immediately; you must open the new one on the device.`}
        </p>
      </Modal>
    </div>
  );
}
