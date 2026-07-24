// Printers admin page
// ===================
// CRUD for the physical kitchen/bar printers that food & beverage tickets are
// routed to. Mirrors the Channels page so it fits the admin section. The cloud
// API dispatches print jobs over SignalR; an on-site "print agent" forwards the
// bytes to the printer described here. Deleting a printer just stops routing to
// it — it doesn't touch past orders.

import { useEffect, useState } from "react";
import {
  getPrinters,
  createPrinter,
  updatePrinter,
  deletePrinter,
  testPrinter,
  PrinterDto,
  PrinterCreateDto,
  PrinterUpdateDto,
} from "../../services/printerService";
import Modal from "../../components/ui/Modal";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import Loader from "../../components/ui/Loader";
import Alert from "../../components/ui/alert/Alert";
import Switch from "../../components/form/switch/Switch";

const STATIONS = ["Kitchen", "Bar"] as const;
const CONNECTION_TYPES = ["Network", "Usb"] as const;

type FormState = {
  name: string;
  station: string;
  connectionType: string;
  address: string;
  copyCount: number;
  isEnabled: boolean;
};

const emptyForm: FormState = {
  name: "",
  station: "Kitchen",
  connectionType: "Network",
  address: "",
  copyCount: 1,
  isEnabled: true,
};

export default function Printers() {
  const [printers, setPrinters] = useState<PrinterDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<PrinterDto | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [testingId, setTestingId] = useState<number | null>(null);

  const [notification, setNotification] = useState<{
    variant: "success" | "error" | "warning" | "info";
    title: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!notification) return;
    const t = setTimeout(() => setNotification(null), 4000);
    return () => clearTimeout(t);
  }, [notification]);

  function loadPrinters() {
    setLoading(true);
    setError(null);
    getPrinters(true)
      .then((data) => setPrinters(data))
      .catch((err) => setError(err?.message || "Failed to load printers"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadPrinters();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setIsFormOpen(true);
  }

  function openEdit(p: PrinterDto) {
    setEditing(p);
    setForm({
      name: p.name,
      station: p.station,
      connectionType: p.connectionType,
      address: p.address,
      copyCount: p.copyCount,
      isEnabled: p.isEnabled,
    });
    setIsFormOpen(true);
  }

  const addressPlaceholder =
    form.connectionType === "Network" ? "192.168.1.50:9100" : "EPSON TM-T20II Receipt";
  const addressHint =
    form.connectionType === "Network"
      ? "Printer IP and port. Most network thermal printers use port 9100."
      : "The exact Windows printer name as it appears on the agent's PC.";

  async function submitForm() {
    if (!form.name.trim()) {
      setNotification({ variant: "error", title: "Validation", message: "Name is required" });
      return;
    }
    if (!form.address.trim()) {
      setNotification({ variant: "error", title: "Validation", message: "Address is required" });
      return;
    }
    setSubmitting(true);
    try {
      if (editing) {
        const dto: PrinterUpdateDto = {
          name: form.name,
          station: form.station,
          connectionType: form.connectionType,
          address: form.address,
          copyCount: form.copyCount,
          isEnabled: form.isEnabled,
        };
        await updatePrinter(editing.id, dto);
        setNotification({ variant: "success", title: "Updated", message: "Printer updated" });
      } else {
        const dto: PrinterCreateDto = {
          name: form.name,
          station: form.station,
          connectionType: form.connectionType,
          address: form.address,
          copyCount: form.copyCount,
        };
        await createPrinter(dto);
        setNotification({ variant: "success", title: "Created", message: "Printer created" });
      }
      setIsFormOpen(false);
      setEditing(null);
      loadPrinters();
    } catch (err: unknown) {
      let message = "Failed to save";
      if (err && typeof err === "object") {
        const m = err as { message?: unknown };
        if (typeof m.message === "string") message = m.message;
      }
      setNotification({ variant: "error", title: "Save failed", message });
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deletePrinter(deleteId);
      setDeleteId(null);
      loadPrinters();
      setNotification({ variant: "success", title: "Deleted", message: "Printer removed" });
    } catch (err: unknown) {
      let message = "Failed to delete";
      if (err && typeof err === "object") {
        const m = err as { message?: unknown };
        if (typeof m.message === "string") message = m.message;
      }
      setNotification({ variant: "error", title: "Delete failed", message });
    } finally {
      setDeleting(false);
    }
  }

  async function handleTest(p: PrinterDto) {
    setTestingId(p.id);
    try {
      const res = await testPrinter(p.id);
      setNotification({
        variant: "info",
        title: "Test sent",
        message: res?.message || "Test ticket dispatched.",
      });
    } catch (err: unknown) {
      let message = "Failed to send test";
      if (err && typeof err === "object") {
        const m = err as { message?: unknown };
        if (typeof m.message === "string") message = m.message;
      }
      setNotification({ variant: "error", title: "Test failed", message });
    } finally {
      setTestingId(null);
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-semibold">Printers</h1>
        <button
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
          onClick={openCreate}
        >
          + Add Printer
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Food tickets route to <span className="font-medium">Kitchen</span> printers and
        drink/tobacco tickets to <span className="font-medium">Bar</span> printers. An on-site
        print agent must be running to forward jobs to these devices.
      </p>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader />
        </div>
      )}

      {error && <div className="text-red-600 bg-red-50 p-3 rounded mb-4">{error}</div>}

      {!loading && !error && (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Station</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Connection</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Address</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Copies</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {printers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-gray-500">
                    No printers configured yet
                  </td>
                </tr>
              )}
              {printers.map((p) => (
                <tr key={p.id} className={`hover:bg-gray-50 ${p.isEnabled ? "" : "opacity-60"}`}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{p.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        p.station === "Kitchen"
                          ? "bg-orange-100 text-orange-800"
                          : "bg-purple-100 text-purple-800"
                      }`}
                    >
                      {p.station}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{p.connectionType}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">{p.address}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{p.copyCount}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {p.isEnabled ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Enabled
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-700">
                        Disabled
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      className="text-emerald-600 hover:text-emerald-900 mr-3 disabled:opacity-50"
                      onClick={() => handleTest(p)}
                      disabled={testingId === p.id}
                    >
                      {testingId === p.id ? "Sending..." : "Test"}
                    </button>
                    <button
                      className="text-indigo-600 hover:text-indigo-900 mr-3"
                      onClick={() => openEdit(p)}
                    >
                      Edit
                    </button>
                    <button className="text-red-600 hover:text-red-900" onClick={() => setDeleteId(p.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit modal */}
      <Modal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} title={editing ? "Edit Printer" : "Add Printer"}>
        <div className="flex flex-col gap-4">
          <div>
            <Label>Name *</Label>
            <Input
              placeholder="Kitchen Printer"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div>
            <Label>Station *</Label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={form.station}
              onChange={(e) => setForm((f) => ({ ...f, station: e.target.value }))}
            >
              {STATIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-400">
              Kitchen = food items · Bar = drinks &amp; tobacco.
            </p>
          </div>

          <div>
            <Label>Connection type *</Label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={form.connectionType}
              onChange={(e) => setForm((f) => ({ ...f, connectionType: e.target.value }))}
            >
              {CONNECTION_TYPES.map((c) => (
                <option key={c} value={c}>
                  {c === "Usb" ? "USB / Windows printer" : "Network (IP)"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label>Address *</Label>
            <Input
              placeholder={addressPlaceholder}
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            />
            <p className="mt-1 text-xs text-gray-400">{addressHint}</p>
          </div>

          <div>
            <Label>Copies</Label>
            <Input
              type="number"
              min="1"
              value={form.copyCount}
              onChange={(e) =>
                setForm((f) => ({ ...f, copyCount: Math.max(1, Number(e.target.value) || 1) }))
              }
            />
          </div>

          {editing && (
            <div>
              <Label>Enabled</Label>
              <Switch
                key={String(form.isEnabled)}
                label={form.isEnabled ? "Routing tickets here" : "Not routing tickets"}
                defaultChecked={form.isEnabled}
                onChange={(checked) => setForm((f) => ({ ...f, isEnabled: checked }))}
              />
              <p className="mt-1 text-xs text-gray-400">
                Turn off to stop sending tickets to this printer without deleting it.
              </p>
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <button
              className="px-4 py-2 bg-green-600 text-white rounded flex items-center gap-2 disabled:opacity-50"
              onClick={submitForm}
              disabled={submitting}
            >
              {submitting ? <Loader size={16} /> : editing ? "Save Changes" : "Add Printer"}
            </button>
            <button className="px-4 py-2 bg-gray-200 rounded" onClick={() => setIsFormOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Printer">
        <div className="space-y-4">
          <p>Remove this printer? Tickets will stop routing to it. Past orders are unaffected.</p>
          <div className="flex items-center gap-2">
            <button
              className="px-4 py-2 bg-red-600 text-white rounded flex items-center gap-2 disabled:opacity-50"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? <Loader size={16} /> : "Delete"}
            </button>
            <button className="px-4 py-2 bg-gray-200 rounded" onClick={() => setDeleteId(null)}>
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* Toast */}
      <div className="fixed bottom-6 right-6 z-50">
        {notification && (
          <div className="max-w-sm">
            <Alert variant={notification.variant} title={notification.title} message={notification.message} />
          </div>
        )}
      </div>
    </div>
  );
}
