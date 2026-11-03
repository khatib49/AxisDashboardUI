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
  HrEmployee, HrEmployeeCreate, getEmployees, createEmployee, updateEmployee, deleteEmployee,
  setEmployeePin, linkEmployeeUser, errorMessage,
} from "../../services/hrService";

type Notice = { variant: "success" | "error" | "warning" | "info"; title: string; message: string };

const emptyForm = {
  fullName: "", phone: "", email: "", position: "", department: "", hourlyRate: "", monthlySalary: "",
  hiredOn: new Date().toISOString().slice(0, 10), notes: "", userId: "", pin: "", isActive: true,
};

const btn = "rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50";
const btnPrimary = `${btn} bg-brand-500 text-white hover:bg-brand-600`;
const btnGhost = `${btn} border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/5`;

export default function Employees() {
  const [rows, setRows] = useState<HrEmployee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<HrEmployee | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  const [pinFor, setPinFor] = useState<HrEmployee | null>(null);
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");

  const [linkFor, setLinkFor] = useState<HrEmployee | null>(null);
  const [linkUserId, setLinkUserId] = useState("");

  const [deleteFor, setDeleteFor] = useState<HrEmployee | null>(null);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getEmployees(debounced || undefined, includeInactive, 1, 200);
      setRows(res.data ?? []);
    } catch (e) {
      setError(errorMessage(e, "Failed to load employees"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [debounced, includeInactive]);

  useEffect(() => { void load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm });
    setFormOpen(true);
  }

  function openEdit(e: HrEmployee) {
    setEditing(e);
    setForm({
      fullName: e.fullName, phone: e.phone ?? "", email: e.email ?? "", position: e.position ?? "", department: e.department ?? "",
      hourlyRate: e.hourlyRate != null ? String(e.hourlyRate) : "", monthlySalary: e.monthlySalary != null ? String(e.monthlySalary) : "",
      hiredOn: e.hiredOn, notes: e.notes ?? "", userId: e.userId != null ? String(e.userId) : "", pin: "", isActive: e.isActive,
    });
    setFormOpen(true);
  }

  const num = (s: string) => (s.trim() === "" ? null : Number(s));

  async function save() {
    if (!form.fullName.trim()) { setNotice({ variant: "error", title: "Validation", message: "Full name is required" }); return; }
    if (!editing && form.pin && !/^\d{4,6}$/.test(form.pin)) { setNotice({ variant: "error", title: "Validation", message: "PIN must be 4-6 digits" }); return; }
    setSaving(true);
    try {
      if (editing) {
        const r = await updateEmployee(editing.id, {
          fullName: form.fullName, phone: form.phone, email: form.email, position: form.position, department: form.department,
          hourlyRate: num(form.hourlyRate), monthlySalary: num(form.monthlySalary), hiredOn: form.hiredOn || null, notes: form.notes, isActive: form.isActive,
        });
        if (!r.success) throw new Error(r.message);
        setNotice({ variant: "success", title: "Saved", message: "Employee updated" });
      } else {
        const payload: HrEmployeeCreate = {
          fullName: form.fullName, phone: form.phone || null, email: form.email || null, position: form.position || null,
          department: form.department || null, hourlyRate: num(form.hourlyRate), monthlySalary: num(form.monthlySalary),
          hiredOn: form.hiredOn || null, notes: form.notes || null, userId: num(form.userId), pin: form.pin || null,
        };
        const r = await createEmployee(payload);
        if (!r.success) throw new Error(r.message);
        setNotice({ variant: "success", title: "Created", message: "Employee added" });
      }
      setFormOpen(false);
      await load();
    } catch (e) {
      setNotice({ variant: "error", title: "Save failed", message: errorMessage(e) });
    } finally {
      setSaving(false);
    }
  }

  async function savePin() {
    if (!pinFor) return;
    if (!/^\d{4,6}$/.test(pin)) { setNotice({ variant: "error", title: "Validation", message: "PIN must be 4-6 digits" }); return; }
    if (pin !== pin2) { setNotice({ variant: "error", title: "Validation", message: "PINs do not match" }); return; }
    setSaving(true);
    try {
      const r = await setEmployeePin(pinFor.id, pin);
      if (!r.success) throw new Error(r.message);
      setNotice({ variant: "success", title: "PIN set", message: `${pinFor.fullName} can now clock in at the till` });
      setPinFor(null);
      await load();
    } catch (e) {
      setNotice({ variant: "error", title: "PIN not saved", message: errorMessage(e) });
    } finally {
      setSaving(false);
    }
  }

  async function saveLink() {
    if (!linkFor) return;
    setSaving(true);
    try {
      const r = await linkEmployeeUser(linkFor.id, linkUserId.trim() === "" ? null : Number(linkUserId));
      if (!r.success) throw new Error(r.message);
      setNotice({ variant: "success", title: "Linked", message: linkUserId ? `Linked to user #${linkUserId}` : "Link removed" });
      setLinkFor(null);
      await load();
    } catch (e) {
      setNotice({ variant: "error", title: "Link failed", message: errorMessage(e) });
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteFor) return;
    setSaving(true);
    try {
      await deleteEmployee(deleteFor.id);
      setNotice({ variant: "success", title: "Deactivated", message: `${deleteFor.fullName} was deactivated` });
      setDeleteFor(null);
      await load();
    } catch (e) {
      setNotice({ variant: "error", title: "Failed", message: errorMessage(e) });
    } finally {
      setSaving(false);
    }
  }

  const field = (label: string, key: keyof typeof form, type = "text") => (
    <div>
      <Label>{label}</Label>
      <Input type={type} value={String(form[key])} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
    </div>
  );

  return (
    <div>
      <PageMeta title="Employees | Axis" description="HR staff profiles" />
      <PageBreadcrumb pageTitle="Employees" />
      {notice && <div className="mb-4"><Alert variant={notice.variant} title={notice.title} message={notice.message} /></div>}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="w-72"><Input placeholder="Search name or phone" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} /> Show inactive
        </label>
        <div className="ml-auto"><button className={btnPrimary} onClick={openCreate}>Add employee</button></div>
      </div>

      {error && <Alert variant="error" title="Error" message={error} />}
      {loading ? (
        <div className="flex justify-center py-10"><Loader /></div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-gray-500 dark:border-gray-700">No employees yet.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
          <Table>
            <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
              <TableRow>
                {["Name", "Position", "Department", "Phone", "Rate / Salary", "PIN", "User", "Status", ""].map((h) => (
                  <TableCell key={h} isHeader className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">{h}</TableCell>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
              {rows.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="px-4 py-3 text-sm text-gray-800 dark:text-white/90">
                    <button className="font-medium hover:underline" onClick={() => openEdit(e)}>{e.fullName}</button>
                    {e.email && <div className="text-xs text-gray-500">{e.email}</div>}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{e.position || "—"}</TableCell>
                  <TableCell className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{e.department || "—"}</TableCell>
                  <TableCell className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{e.phone || "—"}</TableCell>
                  <TableCell className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                    {e.hourlyRate != null ? `${e.hourlyRate}/h` : e.monthlySalary != null ? `${e.monthlySalary}/mo` : "—"}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm">
                    <button className="text-brand-500 hover:underline" onClick={() => { setPinFor(e); setPin(""); setPin2(""); }}>
                      {e.hasPin ? "Reset PIN" : "Set PIN"}
                    </button>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm">
                    <button className="text-brand-500 hover:underline" onClick={() => { setLinkFor(e); setLinkUserId(e.userId != null ? String(e.userId) : ""); }}>
                      {e.userId != null ? `#${e.userId}` : "Link"}
                    </button>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${e.isActive ? "bg-success-50 text-success-600 dark:bg-success-500/15" : "bg-gray-100 text-gray-500 dark:bg-white/10"}`}>
                      {e.isActive ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right">{e.isActive && <DeleteIconButton title="Deactivate" onClick={() => setDeleteFor(e)} />}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} title={editing ? "Edit employee" : "New employee"}
        footer={<><button className={btnGhost} onClick={() => setFormOpen(false)}>Cancel</button><button className={btnPrimary} disabled={saving} onClick={save}>{saving ? "Saving…" : "Save"}</button></>}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {field("Full name", "fullName")}
          {field("Phone", "phone")}
          {field("Email", "email", "email")}
          {field("Position", "position")}
          {field("Department", "department")}
          {field("Hired on", "hiredOn", "date")}
          {field("Hourly rate", "hourlyRate", "number")}
          {field("Monthly salary", "monthlySalary", "number")}
          {!editing && field("Link to user id (optional)", "userId", "number")}
          {!editing && field("Till PIN (4-6 digits, optional)", "pin", "password")}
          <div className="md:col-span-2">
            <Label>Notes</Label>
            <textarea className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2 text-sm dark:border-gray-700 dark:text-white/90" rows={2}
              value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
          {editing && (
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} /> Active
            </label>
          )}
        </div>
      </Modal>

      <Modal isOpen={!!pinFor} onClose={() => setPinFor(null)} title={`Set PIN — ${pinFor?.fullName ?? ""}`} className="max-w-md"
        footer={<><button className={btnGhost} onClick={() => setPinFor(null)}>Cancel</button><button className={btnPrimary} disabled={saving} onClick={savePin}>Save PIN</button></>}>
        <p className="mb-3 text-sm text-gray-500">The PIN is used at the till to clock in and out. It is stored hashed and cannot be read back.</p>
        <div className="grid gap-3">
          <div><Label>PIN (4-6 digits)</Label><Input type="password" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} /></div>
          <div><Label>Confirm PIN</Label><Input type="password" value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, "").slice(0, 6))} /></div>
        </div>
      </Modal>

      <Modal isOpen={!!linkFor} onClose={() => setLinkFor(null)} title={`Link user — ${linkFor?.fullName ?? ""}`} className="max-w-md"
        footer={<><button className={btnGhost} onClick={() => setLinkFor(null)}>Cancel</button><button className={btnPrimary} disabled={saving} onClick={saveLink}>Save</button></>}>
        <p className="mb-3 text-sm text-gray-500">Enter the id of an existing login (Users Management) so this person can see their own schedule and request leave. Leave empty to unlink.</p>
        <Label>User id</Label>
        <Input type="number" value={linkUserId} onChange={(e) => setLinkUserId(e.target.value)} />
      </Modal>

      <Modal isOpen={!!deleteFor} onClose={() => setDeleteFor(null)} title="Deactivate employee" className="max-w-md"
        footer={<><button className={btnGhost} onClick={() => setDeleteFor(null)}>Cancel</button><button className={`${btn} bg-error-500 text-white`} disabled={saving} onClick={confirmDelete}>Deactivate</button></>}>
        <p className="text-sm text-gray-600 dark:text-gray-300">{deleteFor?.fullName} will be marked inactive and their PIN removed. Attendance and leave history is kept.</p>
      </Modal>
    </div>
  );
}
