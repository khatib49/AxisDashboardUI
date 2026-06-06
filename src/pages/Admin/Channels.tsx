// Channels admin page
// ===================
// CRUD for sales channels (Toters, etc.) that cashiers can attach to F&B
// orders. Mirrors the look of Discount/ExpenseCategories so it fits the
// admin section without surprise. Hide instead of delete — historical
// transactions keep their ChannelId.

import { useEffect, useState } from "react";
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
import Alert from "../../components/ui/alert/Alert";
import Switch from "../../components/form/switch/Switch";

export default function Channels() {
  const [channels, setChannels] = useState<ChannelDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Hidden filter — admin only. When on, the API call passes
  // includeHidden=true so soft-deleted channels also show up and can be
  // restored via the edit modal.
  const [showHidden, setShowHidden] = useState(false);

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
  }, [showHidden]);

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

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Channels</h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={showHidden}
              onChange={(e) => setShowHidden(e.target.checked)}
              className="w-4 h-4"
            />
            Show hidden
          </label>
          <button
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
            onClick={openCreate}
          >
            + Add Channel
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader />
        </div>
      )}

      {error && <div className="text-red-600 bg-red-50 p-3 rounded mb-4">{error}</div>}

      {!loading && !error && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {channels.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                    No channels found
                  </td>
                </tr>
              )}
              {channels.map((c) => (
                <tr key={c.id} className={`hover:bg-gray-50 ${c.isActive ? "" : "opacity-60"}`}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{c.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                    <div className="flex items-center gap-2">
                      <span>{c.name}</span>
                      {!c.isActive && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700">
                          Hidden
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{c.description || "-"}</td>
                  <td className="px-6 py-4 text-sm">
                    {c.isActive ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-700">
                        Hidden
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      className="text-indigo-600 hover:text-indigo-900 mr-3"
                      onClick={() => openEdit(c)}
                    >
                      Edit
                    </button>
                    {c.isActive && (
                      <button
                        className="text-red-600 hover:text-red-900"
                        onClick={() => setDeleteId(c.id)}
                      >
                        Hide
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editing ? "Edit Channel" : "Create Channel"}
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              rows={3}
              placeholder="Optional notes about this channel..."
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          {editing && (
            <div>
              <Label>Active</Label>
              <div className="flex items-center gap-2">
                <Switch
                  key={String(form.isActive)}
                  label={form.isActive ? "Visible to cashier" : "Hidden from cashier"}
                  defaultChecked={form.isActive}
                  onChange={(checked) => setForm((f) => ({ ...f, isActive: checked }))}
                />
              </div>
              <p className="mt-1 text-xs text-gray-400">
                Turn off to hide this channel from the cashier order form. Historical
                transactions that referenced it remain intact.
              </p>
            </div>
          )}
          <div className="flex items-center gap-2 pt-2">
            <button
              className="px-4 py-2 bg-green-600 text-white rounded flex items-center gap-2 disabled:opacity-50"
              onClick={submitForm}
              disabled={submitting}
            >
              {submitting ? <Loader size={16} /> : editing ? "Save Changes" : "Create Channel"}
            </button>
            <button className="px-4 py-2 bg-gray-200 rounded" onClick={() => setIsFormOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* Hide confirmation */}
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Hide Channel">
        <div className="space-y-4">
          <p>
            Hide this channel from the cashier order form? Past transactions that
            reference it stay intact. You can restore it from "Show hidden".
          </p>
          <div className="flex items-center gap-2">
            <button
              className="px-4 py-2 bg-red-600 text-white rounded flex items-center gap-2 disabled:opacity-50"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? <Loader size={16} /> : "Hide"}
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
            <Alert
              variant={notification.variant}
              title={notification.title}
              message={notification.message}
            />
          </div>
        )}
      </div>
    </div>
  );
}
