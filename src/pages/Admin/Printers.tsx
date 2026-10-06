// Printers admin page
// ===================
// CRUD for the physical kitchen/bar printers that food & beverage tickets are
// routed to. Mirrors the Channels page so it fits the admin section. The cloud
// API dispatches print jobs over SignalR; an on-site "print agent" forwards the
// bytes to the printer described here. Deleting a printer just stops routing to
// it — it doesn't touch past orders.

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button, Empty, Input as AntInput, Skeleton, Tooltip } from "antd";
import {
  ApiOutlined,
  CoffeeOutlined,
  DeleteOutlined,
  EditOutlined,
  FireOutlined,
  GlobalOutlined,
  PlusOutlined,
  PrinterOutlined,
  ReloadOutlined,
  SearchOutlined,
  SendOutlined,
  StopOutlined,
  UsbOutlined,
} from "@ant-design/icons";
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
import Switch from "../../components/form/switch/Switch";
import { PageHeader, Panel, Pill, StatTile } from "../../components/ui/PageKit";
import { ErrorNote, IconChip, RowMenu, Toast } from "../../components/admin/venue/VenueKit";

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

// Tile filters over the loaded list (presentation only).
type Filter = "all" | "Kitchen" | "Bar" | "disabled";

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
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");

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

  // ── List presentation (derived from the list already loaded) ────────
  const counts = {
    all: printers.length,
    Kitchen: printers.filter((p) => p.station === "Kitchen").length,
    Bar: printers.filter((p) => p.station === "Bar").length,
    disabled: printers.filter((p) => !p.isEnabled).length,
  };

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    return printers.filter((p) => {
      if (filter === "disabled" && p.isEnabled) return false;
      if ((filter === "Kitchen" || filter === "Bar") && p.station !== filter) return false;
      if (!s) return true;
      return [p.name, p.station, p.connectionType, p.address].join(" ").toLowerCase().includes(s);
    });
  }, [printers, filter, q]);

  const firstLoad = loading && printers.length === 0;

  const tiles: { key: Filter; label: string; value: number; sub: string; accent: ReactNode }[] = [
    { key: "all", label: "All printers", value: counts.all, sub: "Click a tile to filter", accent: <IconChip tone="blue"><PrinterOutlined /></IconChip> },
    { key: "Kitchen", label: "Kitchen", value: counts.Kitchen, sub: "Food tickets", accent: <IconChip tone="amber"><FireOutlined /></IconChip> },
    { key: "Bar", label: "Bar", value: counts.Bar, sub: "Drinks & tobacco tickets", accent: <IconChip tone="violet"><CoffeeOutlined /></IconChip> },
    {
      key: "disabled",
      label: "Disabled",
      value: counts.disabled,
      sub: counts.disabled ? "Not receiving tickets" : "Every printer is routing",
      accent: <IconChip tone="gray"><StopOutlined /></IconChip>,
    },
  ];

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6">
      <PageHeader
        tone="blue"
        icon={<PrinterOutlined />}
        title="Printers"
        description={
          <>
            Food tickets route to <span className="font-medium">Kitchen</span> printers and
            drink/tobacco tickets to <span className="font-medium">Bar</span> printers. An on-site
            print agent must be running to forward jobs to these devices.
          </>
        }
        actions={
          <>
            <Tooltip title="Refresh">
              <Button icon={<ReloadOutlined />} onClick={() => loadPrinters()} loading={loading} aria-label="Refresh" />
            </Tooltip>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Add printer</Button>
          </>
        }
      />

      {/* Tiles = filters */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <StatTile
            key={t.key}
            label={t.label}
            value={<span className="tabular-nums">{t.value}</span>}
            sub={t.sub}
            accent={t.accent}
            loading={firstLoad}
            active={filter === t.key}
            onClick={() => setFilter(t.key)}
          />
        ))}
      </div>

      <Panel
        title={tiles.find((t) => t.key === filter)!.label}
        subtitle={`${visible.length} of ${printers.length}`}
        bodyClassName="p-0"
        extra={
          <AntInput
            allowClear
            prefix={<SearchOutlined className="text-gray-400" />}
            placeholder="Search name, address…"
            aria-label="Search printers"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full sm:w-64!"
          />
        }
      >
        {error ? (
          <ErrorNote>{error}</ErrorNote>
        ) : loading ? (
          <div className="p-5"><Skeleton active paragraph={{ rows: 5 }} /></div>
        ) : visible.length === 0 ? (
          <div className="py-12">
            <Empty description={printers.length === 0 ? "No printers configured yet" : q.trim() ? `Nothing matches “${q.trim()}”` : "No printers here"} />
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-white/[0.06]">
            {visible.map((p) => {
              const isUsb = p.connectionType === "Usb";
              return (
                <li
                  key={p.id}
                  className={`flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4 transition hover:bg-gray-50/70 dark:hover:bg-white/[0.02] ${p.isEnabled ? "" : "bg-gray-50/50 dark:bg-white/[0.01]"}`}
                >
                  <span
                    aria-hidden
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${
                      p.isEnabled
                        ? "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300"
                        : "bg-gray-100 text-gray-400 dark:bg-white/5 dark:text-gray-500"
                    }`}
                  >
                    <PrinterOutlined />
                  </span>

                  <div className="min-w-[200px] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(p)}
                        className={`text-left font-semibold hover:text-blue-700 dark:hover:text-blue-300 ${p.isEnabled ? "text-gray-900 dark:text-gray-100" : "text-gray-500 dark:text-gray-400"}`}
                      >
                        {p.name}
                      </button>
                      <Pill tone={p.station === "Kitchen" ? "amber" : "purple"} dot>{p.station}</Pill>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                      <Tooltip title={isUsb ? "USB / Windows printer" : "Network (IP)"}>
                        <span className="inline-flex items-center gap-1">
                          {isUsb ? <UsbOutlined /> : <GlobalOutlined />}
                          {isUsb ? "USB" : p.connectionType}
                        </span>
                      </Tooltip>
                      <code className="break-all rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-700 dark:bg-white/5 dark:text-gray-300">{p.address}</code>
                      <span className="tabular-nums">
                        {p.copyCount} cop{p.copyCount === 1 ? "y" : "ies"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {p.isEnabled ? (
                      <Pill tone="emerald" dot>Enabled</Pill>
                    ) : (
                      <Pill tone="gray" dot>Disabled</Pill>
                    )}
                    {/* Fires a test ticket through the on-site agent */}
                    <Button
                      size="small"
                      icon={<SendOutlined />}
                      onClick={() => handleTest(p)}
                      disabled={testingId === p.id}
                      aria-label={`Send a test ticket to ${p.name}`}
                    >
                      {testingId === p.id ? "Sending..." : "Test"}
                    </Button>
                    <RowMenu
                      label={p.name}
                      items={[
                        { key: "edit", icon: <EditOutlined />, label: "Edit", onClick: () => openEdit(p) },
                        { type: "divider" },
                        { key: "delete", icon: <DeleteOutlined />, label: "Delete", danger: true, onClick: () => setDeleteId(p.id) },
                      ]}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {/* Create / Edit modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editing ? "Edit Printer" : "Add Printer"}
        className="sm:max-w-xl!"
        footer={
          <>
            <Button onClick={() => setIsFormOpen(false)}>Cancel</Button>
            <Button type="primary" onClick={submitForm} disabled={submitting} icon={submitting ? <Loader size={16} /> : undefined}>
              {editing ? "Save Changes" : "Add Printer"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <Label>Name *</Label>
            <Input
              placeholder="Kitchen Printer"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="printer-station">Station *</Label>
              <select
                id="printer-station"
                className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                value={form.station}
                onChange={(e) => setForm((f) => ({ ...f, station: e.target.value }))}
              >
                {STATIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Kitchen = food items · Bar = drinks &amp; tobacco.
              </p>
            </div>

            <div>
              <Label htmlFor="printer-connection">Connection type *</Label>
              <select
                id="printer-connection"
                className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
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
          </div>

          <div>
            <Label>Address *</Label>
            <Input
              placeholder={addressPlaceholder}
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            />
            <p className="mt-1 flex items-start gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <ApiOutlined className="mt-0.5" />
              {addressHint}
            </p>
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
            <div className="rounded-lg border border-gray-200 p-3 dark:border-white/10">
              <Label>Enabled</Label>
              <Switch
                key={String(form.isEnabled)}
                label={form.isEnabled ? "Routing tickets here" : "Not routing tickets"}
                defaultChecked={form.isEnabled}
                onChange={(checked) => setForm((f) => ({ ...f, isEnabled: checked }))}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Turn off to stop sending tickets to this printer without deleting it.
              </p>
            </div>
          )}
        </div>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete Printer"
        className="sm:max-w-md!"
        footer={
          <>
            <Button onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button danger type="primary" onClick={confirmDelete} disabled={deleting} icon={deleting ? <Loader size={16} /> : undefined}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-gray-700 dark:text-gray-300">Remove this printer? Tickets will stop routing to it. Past orders are unaffected.</p>
      </Modal>

      {/* Toast */}
      <Toast notification={notification} />
    </div>
  );
}
