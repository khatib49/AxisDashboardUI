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
  createDisplay, deleteDisplay, DisplayStateDto, displayUrl, getDisplayRegister, getDisplays, rotateDisplayToken, setDisplayRegister,
} from "../../services/displayService";

const errMsg = (e: unknown) => (e as { message?: string })?.message || "Request failed";
const th = "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase";
const td = "px-4 py-3 text-sm text-gray-700 dark:text-gray-200";
const statusClass: Record<string, string> = {
  Idle: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  Cart: "bg-blue-100 text-blue-700",
  Awaiting: "bg-amber-100 text-amber-700",
  Paid: "bg-green-100 text-green-700",
  Thanks: "bg-green-100 text-green-700",
};

/** Admin: one customer-facing display per register, its screen link (token) and which register THIS till pushes to. */
export default function DisplaysAdmin() {
  const [rows, setRows] = useState<DisplayStateDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<{ kind: "delete" | "rotate"; row: DisplayStateDto } | null>(null);
  const [thisRegister, setThisRegister] = useState<string | null>(getDisplayRegister());
  const [notification, setNotification] = useState<{ variant: "success" | "error" | "warning" | "info"; title: string; message: string } | null>(null);

  useEffect(() => {
    if (!notification) return;
    const t = setTimeout(() => setNotification(null), 4000);
    return () => clearTimeout(t);
  }, [notification]);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await getDisplays()); setError(null); }
    catch (e) { setError(errMsg(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await createDisplay(name.trim());
      setNotification({ variant: "success", title: "Created", message: `Display for "${name.trim()}" created.` });
      setFormOpen(false); setName(""); await load();
    } catch (e) {
      setNotification({ variant: "error", title: "Error", message: errMsg(e) });
    } finally { setSaving(false); }
  };

  const confirmAction = async () => {
    if (!confirm) return;
    const c = confirm; setConfirm(null);
    try {
      if (c.kind === "delete") { await deleteDisplay(c.row.id); setNotification({ variant: "success", title: "Removed", message: `${c.row.registerName} removed.` }); }
      else { await rotateDisplayToken(c.row.id); setNotification({ variant: "success", title: "Token rotated", message: `Open the new link on the "${c.row.registerName}" screen.` }); }
      await load();
    } catch (e) {
      setNotification({ variant: "error", title: "Error", message: errMsg(e) });
    }
  };

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setNotification({ variant: "success", title: "Copied", message: "Display link copied to clipboard." }); }
    catch { setNotification({ variant: "warning", title: "Copy failed", message: text }); }
  };

  const attachHere = (register: string | null) => {
    setDisplayRegister(register);
    setThisRegister(register);
    setNotification({ variant: "info", title: "This till", message: register ? `The cashier screen on this device now pushes its cart to "${register}".` : "This device no longer pushes to a display." });
  };

  return (
    <div>
      <PageMeta title="Customer displays | Axis" description="Customer-facing display screens per register" />
      <PageBreadcrumb pageTitle="Customer displays" />
      {notification && <div className="mb-4"><Alert variant={notification.variant} title={notification.title} message={notification.message} /></div>}
      {error && <div className="mb-4"><Alert variant="error" title="Could not load" message={error} /></div>}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          One display per register. Open the link on the customer-facing screen (full screen). The till on this device pushes to:{" "}
          <span className="font-medium text-gray-800 dark:text-gray-100">{thisRegister ?? "none"}</span>
          {thisRegister && <button type="button" onClick={() => attachHere(null)} className="ml-2 text-xs text-red-600 hover:underline">detach</button>}
        </p>
        <button type="button" onClick={() => { setName(""); setFormOpen(true); }} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">+ New display</button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        {loading ? <div className="p-8 flex justify-center"><Loader /></div> : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">No displays yet. Create one per register, or push a cart from the cashier screen and it appears here.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <TableCell isHeader className={th}>Register</TableCell>
                  <TableCell isHeader className={th}>Status</TableCell>
                  <TableCell isHeader className={th}>Showing</TableCell>
                  <TableCell isHeader className={th}>Updated</TableCell>
                  <TableCell isHeader className={th}>Screen link</TableCell>
                  <TableCell isHeader className={`${th} text-right`}>Actions</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className={`${td} font-medium`}>
                      {r.registerName}
                      {thisRegister === r.registerName && <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">this till</span>}
                    </TableCell>
                    <TableCell className={td}><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClass[r.status] ?? statusClass.Idle}`}>{r.status}</span></TableCell>
                    <TableCell className={td}>
                      {r.status === "Idle" ? "—" : `$${r.totalUsd.toFixed(2)} · ${Math.round(r.totalLbp).toLocaleString()} LL`}
                      {r.transactionId ? <span className="ml-2 text-xs text-gray-400">inv #{r.transactionId}</span> : null}
                    </TableCell>
                    <TableCell className={`${td} whitespace-nowrap`}>{r.updatedOn ? new Date(r.updatedOn).toLocaleString() : "—"}</TableCell>
                    <TableCell className={td}>
                      <div className="flex items-center gap-2">
                        <code className="max-w-[220px] truncate rounded bg-gray-100 px-2 py-1 text-xs dark:bg-gray-800">{r.token}</code>
                        <button type="button" onClick={() => copy(displayUrl(r.token))} className="text-xs text-blue-600 hover:underline">Copy link</button>
                        <a href={displayUrl(r.token)} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">Open display</a>
                      </div>
                    </TableCell>
                    <TableCell className={`${td} text-right`}>
                      <div className="flex items-center justify-end gap-2">
                        {thisRegister !== r.registerName && (
                          <button type="button" onClick={() => attachHere(r.registerName)} className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-white/5">Use on this till</button>
                        )}
                        <button type="button" onClick={() => setConfirm({ kind: "rotate", row: r })} className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-white/5">Rotate token</button>
                        <DeleteIconButton onClick={() => setConfirm({ kind: "delete", row: r })} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} title="New customer display" className="max-w-md"
        footer={<>
          <button type="button" onClick={() => setFormOpen(false)} className="rounded-lg border px-4 py-2 text-sm dark:border-gray-700">Cancel</button>
          <button type="button" onClick={save} disabled={saving || !name.trim()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? "Saving…" : "Create"}</button>
        </>}>
        <div className="space-y-3">
          <div>
            <Label>Register name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Main till, Bar" />
          </div>
          <p className="text-xs text-gray-500">Use the same register name the cashier opens their shift with, so the right screen shows their cart.</p>
        </div>
      </Modal>

      <Modal isOpen={!!confirm} onClose={() => setConfirm(null)} title={confirm?.kind === "delete" ? "Remove display" : "Rotate token"} className="max-w-md"
        footer={<>
          <button type="button" onClick={() => setConfirm(null)} className="rounded-lg border px-4 py-2 text-sm dark:border-gray-700">Cancel</button>
          <button type="button" onClick={confirmAction} className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${confirm?.kind === "delete" ? "bg-red-600" : "bg-blue-600"}`}>{confirm?.kind === "delete" ? "Remove" : "Rotate"}</button>
        </>}>
        <p className="text-sm">
          {confirm?.kind === "delete"
            ? <>Remove the display for <strong>{confirm.row.registerName}</strong>? Its screen link stops working.</>
            : <>Issue a new link for <strong>{confirm?.row.registerName}</strong>? The screen currently open with the old link stops updating until you open the new one.</>}
        </p>
      </Modal>
    </div>
  );
}
