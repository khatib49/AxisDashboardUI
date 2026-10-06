// Channels admin page
// ===================
// CRUD for sales channels (Toters, etc.) that cashiers can attach to F&B
// orders. Mirrors the look of Discount/ExpenseCategories so it fits the
// admin section without surprise. Hide instead of delete — historical
// transactions keep their ChannelId.

import { useEffect, useMemo, useState } from "react";
import { Button, Empty, Input as AntInput, Skeleton, Switch as AntSwitch, Tooltip } from "antd";
import {
  CheckCircleOutlined,
  EditOutlined,
  EyeInvisibleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  ShareAltOutlined,
} from "@ant-design/icons";
import {
  getChannels,
  createChannel,
  updateChannel,
  deactivateChannel,
  ChannelDto,
  ChannelCreateDto,
  ChannelUpdateDto,
} from "../../services/channelService";
import Modal from "../../components/ui/Modal";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import Loader from "../../components/ui/Loader";
import Switch from "../../components/form/switch/Switch";
import { PageHeader, Panel, Pill, StatTile } from "../../components/ui/PageKit";
import { ErrorNote, IconChip, RowMenu, Toast } from "../../components/admin/venue/VenueKit";

export default function Channels() {
  const [channels, setChannels] = useState<ChannelDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Hidden filter — admin only. When on, the API call passes
  // includeHidden=true so soft-deleted channels also show up and can be
  // restored via the edit modal.
  const [showHidden, setShowHidden] = useState(false);
  // Bumped by the Refresh button to re-run the same list request.
  const [reloadToken, setReloadToken] = useState(0);
  // Client-side search over the loaded list (presentation only).
  const [q, setQ] = useState("");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<ChannelDto | null>(null);
  const [form, setForm] = useState<{
    name: string;
    description: string;
    isActive: boolean;
  }>({ name: "", description: "", isActive: true });
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    getChannels(showHidden)
      .then((data) => mounted && setChannels(data))
      .catch((err) => mounted && setError(err?.message || "Failed to load channels"))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [showHidden, reloadToken]);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", description: "", isActive: true });
    setIsFormOpen(true);
  }

  function openEdit(ch: ChannelDto) {
    setEditing(ch);
    setForm({ name: ch.name, description: ch.description ?? "", isActive: ch.isActive });
    setIsFormOpen(true);
  }

  async function submitForm() {
    if (!form.name.trim()) {
      setNotification({ variant: "error", title: "Validation", message: "Name is required" });
      return;
    }
    setSubmitting(true);
    try {
      if (editing) {
        const dto: ChannelUpdateDto = {
          name: form.name,
          description: form.description || null,
          isActive: form.isActive,
        };
        const updated = await updateChannel(editing.id, dto);
        setChannels((s) => s.map((c) => (c.id === editing.id ? updated : c)));
        setNotification({ variant: "success", title: "Updated", message: "Channel updated" });
      } else {
        const dto: ChannelCreateDto = { name: form.name, description: form.description || null };
        const created = await createChannel(dto);
        setChannels((s) => [...s, created]);
        setNotification({ variant: "success", title: "Created", message: "Channel created" });
      }
      setIsFormOpen(false);
      setEditing(null);
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
      await deactivateChannel(deleteId);
      // Reload so the row either disappears (default view) or stays as Hidden
      // (showHidden view).
      const refreshed = await getChannels(showHidden);
      setChannels(refreshed);
      setDeleteId(null);
      setNotification({ variant: "success", title: "Hidden", message: "Channel hidden from cashier" });
    } catch (err: unknown) {
      let message = "Failed to hide";
      if (err && typeof err === "object") {
        const m = err as { message?: unknown };
        if (typeof m.message === "string") message = m.message;
      }
      setNotification({ variant: "error", title: "Hide failed", message });
    } finally {
      setDeleting(false);
    }
  }

  // ── List presentation (derived from the list already loaded) ────────
  const firstLoad = loading && channels.length === 0;
  const activeCount = channels.filter((c) => c.isActive).length;
  const hiddenCount = channels.length - activeCount;
  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return channels;
    return channels.filter((c) => [String(c.id), c.name, c.description ?? ""].join(" ").toLowerCase().includes(s));
  }, [channels, q]);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6">
      <PageHeader
        tone="blue"
        icon={<ShareAltOutlined />}
        title="Channels"
        description="Sales channels (Toters, etc.) cashiers can attach to F&B orders. Hiding a channel removes it from the cashier — past transactions keep it."
        actions={
          <>
            <Tooltip title="Refresh">
              <Button icon={<ReloadOutlined />} onClick={() => setReloadToken((t) => t + 1)} loading={loading} aria-label="Refresh" />
            </Tooltip>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Add channel</Button>
          </>
        }
      />

      {/* KPIs — derived from the list already loaded (no extra requests) */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Channels"
          loading={firstLoad}
          value={<span className="tabular-nums">{channels.length}</span>}
          sub={showHidden ? "Including hidden" : "Visible to cashier"}
          accent={<IconChip tone="blue"><ShareAltOutlined /></IconChip>}
        />
        <StatTile
          label="Active"
          loading={firstLoad}
          value={<span className="tabular-nums">{activeCount}</span>}
          sub="Shown on the cashier order form"
          accent={<IconChip tone="emerald"><CheckCircleOutlined /></IconChip>}
        />
        <StatTile
          label="Hidden"
          loading={firstLoad}
          value={<span className="tabular-nums">{showHidden ? hiddenCount : "—"}</span>}
          sub={showHidden ? "Restore one from its edit dialog" : "Turn on “Show hidden” to list them"}
          accent={<IconChip tone="gray"><EyeInvisibleOutlined /></IconChip>}
        />
      </div>

      <Panel
        title={showHidden ? "All channels" : "Active channels"}
        subtitle={q.trim() ? `${visible.length} of ${channels.length}` : `${channels.length} channel${channels.length === 1 ? "" : "s"}`}
        bodyClassName="p-0"
        extra={
          <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <AntSwitch size="small" checked={showHidden} onChange={(checked) => setShowHidden(checked)} />
              Show hidden
            </label>
            <AntInput
              allowClear
              prefix={<SearchOutlined className="text-gray-400" />}
              placeholder="Search channels…"
              aria-label="Search channels"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full sm:w-60!"
            />
          </div>
        }
      >
        {error ? (
          <ErrorNote>{error}</ErrorNote>
        ) : loading ? (
          <div className="p-5"><Skeleton active paragraph={{ rows: 5 }} /></div>
        ) : visible.length === 0 ? (
          <div className="py-12"><Empty description={q.trim() ? `Nothing matches “${q.trim()}”` : "No channels found"} /></div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-white/[0.06]">
            {visible.map((c) => (
              <li
                key={c.id}
                className={`flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3.5 transition hover:bg-gray-50/70 dark:hover:bg-white/[0.02] ${c.isActive ? "" : "bg-gray-50/50 dark:bg-white/[0.01]"}`}
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold uppercase ${
                    c.isActive
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
                      : "bg-gray-100 text-gray-400 dark:bg-white/5 dark:text-gray-500"
                  }`}
                  aria-hidden
                >
                  {c.name.trim().charAt(0) || "#"}
                </span>

                <div className="min-w-[180px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(c)}
                      className={`text-left font-medium hover:text-blue-700 dark:hover:text-blue-300 ${c.isActive ? "text-gray-900 dark:text-gray-100" : "text-gray-500 dark:text-gray-400"}`}
                    >
                      {c.name}
                    </button>
                    <span className="text-[11px] tabular-nums text-gray-400 dark:text-gray-500">#{c.id}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{c.description || "-"}</div>
                </div>

                <div className="flex items-center gap-2">
                  {c.isActive ? (
                    <Pill tone="emerald" dot>Active</Pill>
                  ) : (
                    <Pill tone="gray" dot>Hidden</Pill>
                  )}
                  <RowMenu
                    label={c.name}
                    items={[
                      { key: "edit", icon: <EditOutlined />, label: c.isActive ? "Edit" : "Edit / restore", onClick: () => openEdit(c) },
                      // Only active channels can be hidden; hidden ones are restored from the edit dialog.
                      ...(c.isActive
                        ? [
                            { type: "divider" as const },
                            { key: "hide", icon: <EyeInvisibleOutlined />, label: "Hide", danger: true, onClick: () => setDeleteId(c.id) },
                          ]
                        : []),
                    ]}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* Create / Edit modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editing ? "Edit Channel" : "Create Channel"}
        className="sm:max-w-xl!"
        footer={
          <>
            <Button onClick={() => setIsFormOpen(false)}>Cancel</Button>
            <Button type="primary" onClick={submitForm} disabled={submitting} icon={submitting ? <Loader size={16} /> : undefined}>
              {editing ? "Save Changes" : "Create Channel"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <Label>Name *</Label>
            <Input
              placeholder="Toters"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <Label>Description</Label>
            <textarea
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              rows={3}
              placeholder="Optional notes about this channel..."
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          {editing && (
            <div className="rounded-lg border border-gray-200 p-3 dark:border-white/10">
              <Label>Active</Label>
              <div className="flex items-center gap-2">
                <Switch
                  key={String(form.isActive)}
                  label={form.isActive ? "Visible to cashier" : "Hidden from cashier"}
                  defaultChecked={form.isActive}
                  onChange={(checked) => setForm((f) => ({ ...f, isActive: checked }))}
                />
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Turn off to hide this channel from the cashier order form. Historical
                transactions that referenced it remain intact.
              </p>
            </div>
          )}
        </div>
      </Modal>

      {/* Hide confirmation */}
      <Modal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Hide Channel"
        className="sm:max-w-md!"
        footer={
          <>
            <Button onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button danger type="primary" onClick={confirmDelete} disabled={deleting} icon={deleting ? <Loader size={16} /> : undefined}>
              Hide
            </Button>
          </>
        }
      >
        <p className="text-gray-700 dark:text-gray-300">
          Hide this channel from the cashier order form? Past transactions that
          reference it stay intact. You can restore it from "Show hidden".
        </p>
      </Modal>

      {/* Toast */}
      <Toast notification={notification} />
    </div>
  );
}
