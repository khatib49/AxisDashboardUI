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
  BranchDto,
  BranchSettingDto,
  BranchUserPick,
  UserBranchDto,
  assignUser,
  createBranch,
  deleteBranch,
  getBranchSettings,
  getBranchUsers,
  getBranches,
  listStaffUsers,
  setBranchSettings,
  unassignUser,
  updateBranch,
} from "../../services/branchService";

type Notice = { variant: "success" | "error" | "warning" | "info"; title: string; message: string };

type BranchForm = {
  code: string;
  name: string;
  address: string;
  phone: string;
  currencyCode: string;
  timeZoneId: string;
  isActive: boolean;
  isDefault: boolean;
  openingTime: string;
  closingTime: string;
};

const emptyForm: BranchForm = {
  code: "",
  name: "",
  address: "",
  phone: "",
  currencyCode: "USD",
  timeZoneId: "Asia/Beirut",
  isActive: true,
  isDefault: false,
  openingTime: "",
  closingTime: "",
};

function errMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object") {
    const e = err as { message?: unknown; details?: { error?: unknown } };
    if (e.details && typeof e.details.error === "string") return e.details.error;
    if (typeof e.message === "string") return e.message;
  }
  return fallback;
}

const th = "px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400";
const td = "px-5 py-3 text-sm text-gray-700 dark:text-gray-300";
const btn = "inline-flex items-center px-3 py-1.5 rounded text-sm transition";

export default function Branches() {
  const [branches, setBranches] = useState<BranchDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BranchDto | null>(null);
  const [form, setForm] = useState<BranchForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<BranchDto | null>(null);

  const [usersFor, setUsersFor] = useState<BranchDto | null>(null);
  const [assignments, setAssignments] = useState<UserBranchDto[]>([]);
  const [staff, setStaff] = useState<BranchUserPick[]>([]);
  const [pickUserId, setPickUserId] = useState<string>("");
  const [pickDefault, setPickDefault] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);

  const [settingsFor, setSettingsFor] = useState<BranchDto | null>(null);
  const [settingRows, setSettingRows] = useState<{ key: string; value: string }[]>([]);
  const [removedKeys, setRemovedKeys] = useState<string[]>([]);
  const [settingsLoading, setSettingsLoading] = useState(false);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setBranches(await getBranches(true));
    } catch (err) {
      setError(errMessage(err, "Failed to load branches"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEdit(b: BranchDto) {
    setEditing(b);
    setForm({
      code: b.code,
      name: b.name,
      address: b.address ?? "",
      phone: b.phone ?? "",
      currencyCode: b.currencyCode,
      timeZoneId: b.timeZoneId,
      isActive: b.isActive,
      isDefault: b.isDefault,
      openingTime: b.openingTime ?? "",
      closingTime: b.closingTime ?? "",
    });
    setFormOpen(true);
  }

  async function submitForm() {
    if (!form.code.trim() || !form.name.trim()) {
      setNotice({ variant: "error", title: "Validation", message: "Code and name are required" });
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        address: form.address || null,
        phone: form.phone || null,
        currencyCode: form.currencyCode || "USD",
        timeZoneId: form.timeZoneId || "Asia/Beirut",
        isActive: form.isActive,
        isDefault: form.isDefault,
        openingTime: form.openingTime || null,
        closingTime: form.closingTime || null,
      };
      if (editing) {
        await updateBranch(editing.id, { ...payload, isDefault: form.isDefault ? true : undefined });
        setNotice({ variant: "success", title: "Saved", message: "Branch updated" });
      } else {
        await createBranch(payload);
        setNotice({ variant: "success", title: "Created", message: "Branch created" });
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      setNotice({ variant: "error", title: "Save failed", message: errMessage(err, "Could not save branch") });
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteBranch(deleteTarget.id);
      setNotice({ variant: "success", title: "Deleted", message: `${deleteTarget.name} removed` });
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setNotice({ variant: "error", title: "Delete failed", message: errMessage(err, "Could not delete branch") });
    }
  }

  async function openUsers(b: BranchDto) {
    setUsersFor(b);
    setUsersLoading(true);
    setPickUserId("");
    setPickDefault(false);
    try {
      const [a, s] = await Promise.all([getBranchUsers(b.id), listStaffUsers().catch(() => [] as BranchUserPick[])]);
      setAssignments(a);
      setStaff(s);
    } catch (err) {
      setNotice({ variant: "error", title: "Load failed", message: errMessage(err, "Could not load users") });
    } finally {
      setUsersLoading(false);
    }
  }

  async function doAssign() {
    if (!usersFor || !pickUserId) return;
    try {
      await assignUser(usersFor.id, Number(pickUserId), pickDefault);
      setAssignments(await getBranchUsers(usersFor.id));
      setPickUserId("");
      setPickDefault(false);
      setNotice({ variant: "success", title: "Assigned", message: "User added to branch" });
    } catch (err) {
      setNotice({ variant: "error", title: "Assign failed", message: errMessage(err, "Could not assign user") });
    }
  }

  async function doUnassign(userId: number) {
    if (!usersFor) return;
    try {
      await unassignUser(usersFor.id, userId);
      setAssignments((rows) => rows.filter((r) => r.userId !== userId));
    } catch (err) {
      setNotice({ variant: "error", title: "Remove failed", message: errMessage(err, "Could not remove user") });
    }
  }

  async function openSettings(b: BranchDto) {
    setSettingsFor(b);
    setSettingsLoading(true);
    setRemovedKeys([]);
    try {
      const rows: BranchSettingDto[] = await getBranchSettings(b.id);
      setSettingRows(rows.map((r) => ({ key: r.key, value: r.value ?? "" })));
    } catch (err) {
      setNotice({ variant: "error", title: "Load failed", message: errMessage(err, "Could not load settings") });
      setSettingRows([]);
    } finally {
      setSettingsLoading(false);
    }
  }

  async function saveSettings() {
    if (!settingsFor) return;
    const payload = [
      ...settingRows.filter((r) => r.key.trim()).map((r) => ({ key: r.key.trim(), value: r.value })),
      ...removedKeys.filter((k) => !settingRows.some((r) => r.key.trim() === k)).map((k) => ({ key: k, value: null })),
    ];
    try {
      const saved = await setBranchSettings(settingsFor.id, payload);
      setSettingRows(saved.map((r) => ({ key: r.key, value: r.value ?? "" })));
      setRemovedKeys([]);
      setNotice({ variant: "success", title: "Saved", message: "Branch settings saved" });
    } catch (err) {
      setNotice({ variant: "error", title: "Save failed", message: errMessage(err, "Could not save settings") });
    }
  }

  const assignedIds = new Set(assignments.map((a) => String(a.userId)));
  const pickable = staff.filter((u) => !assignedIds.has(String(u.id)));

  return (
    <div className="p-6">
      <PageMeta title="Branches | Axis" description="Branch registry, user assignment and per-branch settings" />
      <PageBreadcrumb pageTitle="Branches" />

      {notice && (
        <div className="mb-4">
          <Alert variant={notice.variant} title={notice.title} message={notice.message} />
        </div>
      )}

      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Staff pick their branch in the header; the default branch is used when a user has no assignment.
        </p>
        <button className={`${btn} bg-blue-600 text-white hover:bg-blue-700 px-4 py-2`} onClick={openCreate}>
          + Add Branch
        </button>
      </div>

      {loading && (
        <div className="flex justify-center py-10">
          <Loader />
        </div>
      )}
      {error && <div className="text-red-600 bg-red-50 p-3 rounded mb-4">{error}</div>}

      {!loading && !error && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="max-w-full overflow-x-auto">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <TableCell isHeader className={th}>Code</TableCell>
                  <TableCell isHeader className={th}>Name</TableCell>
                  <TableCell isHeader className={th}>Currency</TableCell>
                  <TableCell isHeader className={th}>Hours</TableCell>
                  <TableCell isHeader className={th}>Status</TableCell>
                  <TableCell isHeader className={th}>Actions</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {branches.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="px-5 py-8 text-center text-sm text-gray-500">
                      No branches yet. Create the first one; it becomes the default branch.
                    </TableCell>
                  </TableRow>
                )}
                {branches.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className={`${td} font-mono`}>{b.code}</TableCell>
                    <TableCell className={td}>
                      <div className="font-medium text-gray-800 dark:text-white/90">
                        {b.name}
                        {b.isDefault && (
                          <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-600 dark:bg-brand-500/10">
                            default
                          </span>
                        )}
                      </div>
                      {b.address && <div className="text-xs text-gray-500">{b.address}</div>}
                    </TableCell>
                    <TableCell className={td}>{b.currencyCode}</TableCell>
                    <TableCell className={td}>
                      {b.openingTime || b.closingTime ? `${b.openingTime ?? "—"} – ${b.closingTime ?? "—"}` : "—"}
                    </TableCell>
                    <TableCell className={td}>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${b.isActive ? "bg-green-50 text-green-700 dark:bg-green-500/10" : "bg-gray-100 text-gray-500 dark:bg-white/10"}`}>
                        {b.isActive ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                    <TableCell className={td}>
                      <div className="flex items-center gap-2">
                        <button className={`${btn} bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:text-white`} onClick={() => openEdit(b)}>Edit</button>
                        <button className={`${btn} bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:text-white`} onClick={() => openUsers(b)}>Users</button>
                        <button className={`${btn} bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:text-white`} onClick={() => openSettings(b)}>Settings</button>
                        <DeleteIconButton onClick={() => setDeleteTarget(b)} />
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
        title={editing ? `Edit ${editing.name}` : "New branch"}
        className="max-w-2xl"
        footer={
          <>
            <button className={`${btn} bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:text-white`} onClick={() => setFormOpen(false)}>Cancel</button>
            <button className={`${btn} bg-blue-600 text-white hover:bg-blue-700`} disabled={submitting} onClick={submitForm}>
              {submitting ? "Saving…" : "Save"}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label>Code</Label>
            <Input value={form.code} placeholder="HQ" onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
          </div>
          <div>
            <Label>Name</Label>
            <Input value={form.name} placeholder="Hamra" onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <Label>Address</Label>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <Label>Currency</Label>
            <Input value={form.currencyCode} placeholder="USD" onChange={(e) => setForm({ ...form, currencyCode: e.target.value.toUpperCase() })} />
          </div>
          <div>
            <Label>Time zone</Label>
            <Input value={form.timeZoneId} onChange={(e) => setForm({ ...form, timeZoneId: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Opens</Label>
              <Input type="time" value={form.openingTime} onChange={(e) => setForm({ ...form, openingTime: e.target.value })} />
            </div>
            <div>
              <Label>Closes</Label>
              <Input type="time" value={form.closingTime} onChange={(e) => setForm({ ...form, closingTime: e.target.value })} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
            Active
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={form.isDefault} disabled={!!editing?.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />
            Default branch (legacy data is attributed here)
          </label>
        </div>
      </Modal>

      {/* Delete */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete branch"
        className="max-w-md"
        footer={
          <>
            <button className={`${btn} bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:text-white`} onClick={() => setDeleteTarget(null)}>Cancel</button>
            <button className={`${btn} bg-red-600 text-white hover:bg-red-700`} onClick={confirmDelete}>Delete</button>
          </>
        }
      >
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Delete <strong>{deleteTarget?.name}</strong>? User assignments and settings for this branch are removed too.
        </p>
      </Modal>

      {/* Users */}
      <Modal isOpen={!!usersFor} onClose={() => setUsersFor(null)} title={`Users — ${usersFor?.name ?? ""}`} className="max-w-2xl">
        {usersLoading ? (
          <div className="flex justify-center py-6"><Loader /></div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[220px] flex-1">
                <Label>Add user</Label>
                <select
                  className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  value={pickUserId}
                  onChange={(e) => setPickUserId(e.target.value)}
                >
                  <option value="">Select a user…</option>
                  {pickable.map((u) => (
                    <option key={String(u.id)} value={String(u.id)}>
                      {u.displayName || u.email || `#${u.id}`}{u.email && u.displayName ? ` (${u.email})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 pb-3 text-sm text-gray-700 dark:text-gray-300">
                <input type="checkbox" checked={pickDefault} onChange={(e) => setPickDefault(e.target.checked)} />
                Their default
              </label>
              <button className={`${btn} mb-1 bg-blue-600 text-white hover:bg-blue-700`} disabled={!pickUserId} onClick={doAssign}>Assign</button>
            </div>
            {staff.length === 0 && <p className="text-xs text-gray-500">Could not load the staff list; assignments can still be removed.</p>}
            <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-white/[0.05]">
              <Table>
                <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                  <TableRow>
                    <TableCell isHeader className={th}>User</TableCell>
                    <TableCell isHeader className={th}>Email</TableCell>
                    <TableCell isHeader className={th}>Default</TableCell>
                    <TableCell isHeader className={th}>&nbsp;</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                  {assignments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="px-5 py-6 text-center text-sm text-gray-500">No users assigned.</TableCell>
                    </TableRow>
                  )}
                  {assignments.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className={td}>{a.userName || `#${a.userId}`}</TableCell>
                      <TableCell className={td}>{a.email || "—"}</TableCell>
                      <TableCell className={td}>{a.isDefault ? "Yes" : ""}</TableCell>
                      <TableCell className={td}><DeleteIconButton title="Remove" onClick={() => doUnassign(a.userId)} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </Modal>

      {/* Settings */}
      <Modal
        isOpen={!!settingsFor}
        onClose={() => setSettingsFor(null)}
        title={`Settings — ${settingsFor?.name ?? ""}`}
        className="max-w-2xl"
        footer={
          <>
            <button className={`${btn} bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:text-white`} onClick={() => setSettingRows((r) => [...r, { key: "", value: "" }])}>+ Add key</button>
            <button className={`${btn} bg-blue-600 text-white hover:bg-blue-700`} onClick={saveSettings}>Save</button>
          </>
        }
      >
        {settingsLoading ? (
          <div className="flex justify-center py-6"><Loader /></div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">Per-branch overrides, e.g. <code>Receipt.Header</code>, <code>Tax.Number</code>, <code>Receipt.Footer</code>.</p>
            {settingRows.length === 0 && <p className="text-sm text-gray-500">No settings yet.</p>}
            {settingRows.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-1/3">
                  <Input value={row.key} placeholder="Key" onChange={(e) => setSettingRows((rows) => rows.map((r, j) => (j === i ? { ...r, key: e.target.value } : r)))} />
                </div>
                <div className="flex-1">
                  <Input value={row.value} placeholder="Value" onChange={(e) => setSettingRows((rows) => rows.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))} />
                </div>
                <DeleteIconButton
                  title="Remove"
                  onClick={() => {
                    if (row.key.trim()) setRemovedKeys((k) => [...k, row.key.trim()]);
                    setSettingRows((rows) => rows.filter((_, j) => j !== i));
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
