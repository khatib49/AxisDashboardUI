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
  createDriver, createZone, deleteDriver, deleteZone, DeliveryZoneDto, DeliveryZoneUpsertDto,
  DriverDto, DriverUpsertDto, getDrivers, getZones, updateDriver, updateZone,
} from "../../services/deliveryService";

const errMsg = (e: unknown) => (e as { message?: string })?.message || "Request failed";
const money = (n: number) => n.toFixed(2);
const th = "px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase";
const td = "px-4 py-3 text-sm text-gray-700 dark:text-gray-200";

const emptyZone: DeliveryZoneUpsertDto = { name: "", fee: 0, minOrder: 0, etaMinutes: 30, isActive: true };
const emptyDriver: DriverUpsertDto = { name: "", phone: "", vehicleNote: "", userId: null, isActive: true };

export default function ZonesDrivers() {
  const [zones, setZones] = useState<DeliveryZoneDto[]>([]);
  const [drivers, setDrivers] = useState<DriverDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ variant: "success" | "error" | "warning" | "info"; title: string; message: string } | null>(null);

  const [zoneForm, setZoneForm] = useState<DeliveryZoneUpsertDto>(emptyZone);
  const [editingZone, setEditingZone] = useState<DeliveryZoneDto | null>(null);
  const [zoneOpen, setZoneOpen] = useState(false);
  const [driverForm, setDriverForm] = useState<DriverUpsertDto>(emptyDriver);
  const [editingDriver, setEditingDriver] = useState<DriverDto | null>(null);
  const [driverOpen, setDriverOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<{ kind: "zone" | "driver"; id: number; name: string } | null>(null);

  useEffect(() => {
    if (!notification) return;
    const t = setTimeout(() => setNotification(null), 4000);
    return () => clearTimeout(t);
  }, [notification]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [z, d] = await Promise.all([getZones(true), getDrivers(true)]);
      setZones(z); setDrivers(d); setError(null);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const saveZone = async () => {
    setSaving(true);
    try {
      if (editingZone) await updateZone(editingZone.id, zoneForm); else await createZone(zoneForm);
      setNotification({ variant: "success", title: "Saved", message: `Zone "${zoneForm.name}" saved.` });
      setZoneOpen(false); await load();
    } catch (e) {
      setNotification({ variant: "error", title: "Error", message: errMsg(e) });
    } finally { setSaving(false); }
  };
  const saveDriver = async () => {
    setSaving(true);
    try {
      if (editingDriver) await updateDriver(editingDriver.id, driverForm); else await createDriver(driverForm);
      setNotification({ variant: "success", title: "Saved", message: `Driver "${driverForm.name}" saved.` });
      setDriverOpen(false); await load();
    } catch (e) {
      setNotification({ variant: "error", title: "Error", message: errMsg(e) });
    } finally { setSaving(false); }
  };
  const doDelete = async () => {
    if (!confirm) return;
    const c = confirm; setConfirm(null);
    try {
      if (c.kind === "zone") await deleteZone(c.id); else await deleteDriver(c.id);
      setNotification({ variant: "success", title: "Removed", message: `${c.name} removed (or deactivated if in use).` });
      await load();
    } catch (e) {
      setNotification({ variant: "error", title: "Error", message: errMsg(e) });
    }
  };

  const inputCls = "h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 px-4 text-sm dark:bg-gray-900 dark:text-white/90";

  return (
    <div>
      <PageMeta title="Delivery zones & drivers | Axis" description="Manage delivery zones and drivers" />
      <PageBreadcrumb pageTitle="Delivery zones & drivers" />
      {notification && <div className="mb-4"><Alert variant={notification.variant} title={notification.title} message={notification.message} /></div>}
      {error && <div className="mb-4"><Alert variant="error" title="Could not load" message={error} /></div>}
      {loading && <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-4"><Loader /> Loading…</div>}

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] text-gray-800 dark:text-white/90">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
            <h3 className="font-semibold text-gray-800 dark:text-white/90">Zones</h3>
            <button onClick={() => { setEditingZone(null); setZoneForm(emptyZone); setZoneOpen(true); }} className="px-3 py-1.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700">+ Zone</button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableCell isHeader className={th}>Name</TableCell><TableCell isHeader className={th}>Fee</TableCell>
                <TableCell isHeader className={th}>Min order</TableCell><TableCell isHeader className={th}>ETA</TableCell>
                <TableCell isHeader className={th}>Active</TableCell><TableCell isHeader className={th}>Actions</TableCell>
              </TableRow></TableHeader>
              <TableBody>
                {zones.length === 0 && !loading && <TableRow><TableCell colSpan={6} className={`${td} text-center text-gray-500 dark:text-gray-400`}>No zones yet.</TableCell></TableRow>}
                {zones.map((z) => (
                  <TableRow key={z.id} className="border-t border-gray-100 dark:border-gray-800">
                    <TableCell className={td}>{z.name}</TableCell><TableCell className={td}>{money(z.fee)}</TableCell>
                    <TableCell className={td}>{money(z.minOrder)}</TableCell><TableCell className={td}>{z.etaMinutes} min</TableCell>
                    <TableCell className={td}>{z.isActive ? "Yes" : "No"}</TableCell>
                    <TableCell className={td}>
                      <div className="flex items-center gap-3">
                        <button className="text-blue-600 dark:text-blue-400 hover:underline" onClick={() => { setEditingZone(z); setZoneForm({ name: z.name, fee: z.fee, minOrder: z.minOrder, etaMinutes: z.etaMinutes, isActive: z.isActive }); setZoneOpen(true); }}>Edit</button>
                        <DeleteIconButton onClick={() => setConfirm({ kind: "zone", id: z.id, name: z.name })} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] text-gray-800 dark:text-white/90">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
            <h3 className="font-semibold text-gray-800 dark:text-white/90">Drivers</h3>
            <button onClick={() => { setEditingDriver(null); setDriverForm(emptyDriver); setDriverOpen(true); }} className="px-3 py-1.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700">+ Driver</button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableCell isHeader className={th}>Name</TableCell><TableCell isHeader className={th}>Phone</TableCell>
                <TableCell isHeader className={th}>Vehicle</TableCell><TableCell isHeader className={th}>User id</TableCell>
                <TableCell isHeader className={th}>Active</TableCell><TableCell isHeader className={th}>Actions</TableCell>
              </TableRow></TableHeader>
              <TableBody>
                {drivers.length === 0 && !loading && <TableRow><TableCell colSpan={6} className={`${td} text-center text-gray-500 dark:text-gray-400`}>No drivers yet.</TableCell></TableRow>}
                {drivers.map((d) => (
                  <TableRow key={d.id} className="border-t border-gray-100 dark:border-gray-800">
                    <TableCell className={td}>{d.name}</TableCell><TableCell className={td}>{d.phone || "—"}</TableCell>
                    <TableCell className={td}>{d.vehicleNote || "—"}</TableCell><TableCell className={td}>{d.userId ?? "—"}</TableCell>
                    <TableCell className={td}>{d.isActive ? "Yes" : "No"}</TableCell>
                    <TableCell className={td}>
                      <div className="flex items-center gap-3">
                        <button className="text-blue-600 dark:text-blue-400 hover:underline" onClick={() => { setEditingDriver(d); setDriverForm({ name: d.name, phone: d.phone ?? "", vehicleNote: d.vehicleNote ?? "", userId: d.userId ?? null, isActive: d.isActive }); setDriverOpen(true); }}>Edit</button>
                        <DeleteIconButton onClick={() => setConfirm({ kind: "driver", id: d.id, name: d.name })} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>

      <Modal isOpen={zoneOpen} onClose={() => setZoneOpen(false)} title={editingZone ? "Edit zone" : "New zone"} className="max-w-lg"
        footer={<><button onClick={() => setZoneOpen(false)} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300">Cancel</button><button disabled={saving || !zoneForm.name.trim()} onClick={saveZone} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg disabled:opacity-50">{saving ? "Saving…" : "Save"}</button></>}>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={zoneForm.name} onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Fee</Label><Input type="number" step={0.5} min="0" value={zoneForm.fee} onChange={(e) => setZoneForm({ ...zoneForm, fee: Number(e.target.value) })} /></div>
            <div><Label>Min order</Label><Input type="number" step={0.5} min="0" value={zoneForm.minOrder} onChange={(e) => setZoneForm({ ...zoneForm, minOrder: Number(e.target.value) })} /></div>
            <div><Label>ETA (min)</Label><Input type="number" min="0" value={zoneForm.etaMinutes} onChange={(e) => setZoneForm({ ...zoneForm, etaMinutes: Number(e.target.value) })} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={zoneForm.isActive} onChange={(e) => setZoneForm({ ...zoneForm, isActive: e.target.checked })} /> Active</label>
        </div>
      </Modal>

      <Modal isOpen={driverOpen} onClose={() => setDriverOpen(false)} title={editingDriver ? "Edit driver" : "New driver"} className="max-w-lg"
        footer={<><button onClick={() => setDriverOpen(false)} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300">Cancel</button><button disabled={saving || !driverForm.name.trim()} onClick={saveDriver} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg disabled:opacity-50">{saving ? "Saving…" : "Save"}</button></>}>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={driverForm.name} onChange={(e) => setDriverForm({ ...driverForm, name: e.target.value })} /></div>
          <div><Label>Phone</Label><Input value={driverForm.phone ?? ""} onChange={(e) => setDriverForm({ ...driverForm, phone: e.target.value })} /></div>
          <div><Label>Vehicle note</Label><Input value={driverForm.vehicleNote ?? ""} onChange={(e) => setDriverForm({ ...driverForm, vehicleNote: e.target.value })} placeholder="Red scooter, plate…" /></div>
          <div>
            <Label>Linked staff user id (optional)</Label>
            <input type="number" className={inputCls} value={driverForm.userId ?? ""} onChange={(e) => setDriverForm({ ...driverForm, userId: e.target.value ? Number(e.target.value) : null })} placeholder="Lets the driver see 'my orders' when logged in" />
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={driverForm.isActive} onChange={(e) => setDriverForm({ ...driverForm, isActive: e.target.checked })} /> Active</label>
        </div>
      </Modal>

      <Modal isOpen={!!confirm} onClose={() => setConfirm(null)} title="Remove?" className="max-w-md"
        footer={<><button onClick={() => setConfirm(null)} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300">Keep</button><button onClick={doDelete} className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg">Remove</button></>}>
        <p className="text-sm text-gray-600 dark:text-gray-300">Remove {confirm?.name}? If it is used by past orders it will be deactivated instead.</p>
      </Modal>
    </div>
  );
}
