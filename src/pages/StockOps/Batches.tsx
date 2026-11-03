import { useCallback, useEffect, useMemo, useState } from "react";
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
  StockBatchDto,
  IngredientLite,
  getBatches,
  getExpiringBatches,
  getExpiredBatches,
  receiveBatch,
  updateBatch,
  deleteBatch,
  writeOffBatch,
  getIngredients,
  errorMessage,
} from "../../services/stockOpsService";

type Notice = { variant: "success" | "error" | "warning" | "info"; title: string; message: string };

const th = "px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400";
const td = "px-5 py-3 text-sm text-gray-700 dark:text-gray-300";
const select = "h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm dark:border-white/10 dark:bg-gray-900 dark:text-white/90";
const qty = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 3 });
const toDateInput = (iso?: string | null) => (iso ? iso.slice(0, 10) : "");

function ExpiryPill({ b }: { b: StockBatchDto }) {
  if (b.writtenOffOn) return <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-white/10 dark:text-gray-300">Written off</span>;
  if (!b.expiresOn) return <span className="text-xs text-gray-400">No expiry</span>;
  const d = b.daysToExpiry ?? 0;
  if (b.isExpired) return <span className="rounded bg-red-50 px-2 py-0.5 text-xs text-red-700 dark:bg-red-500/15 dark:text-red-300">Expired {Math.abs(d)}d ago</span>;
  if (d <= 7) return <span className="rounded bg-yellow-50 px-2 py-0.5 text-xs text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-300">{d === 0 ? "Expires today" : `${d}d left`}</span>;
  return <span className="rounded bg-green-50 px-2 py-0.5 text-xs text-green-700 dark:bg-green-500/15 dark:text-green-300">{d}d left</span>;
}

export default function Batches() {
  const [batches, setBatches] = useState<StockBatchDto[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [onlyRemaining, setOnlyRemaining] = useState(true);
  const [ingredientFilter, setIngredientFilter] = useState<number | "">("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const [expiring, setExpiring] = useState<StockBatchDto[]>([]);
  const [expired, setExpired] = useState<StockBatchDto[]>([]);
  const [ingredients, setIngredients] = useState<IngredientLite[]>([]);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<StockBatchDto | null>(null);
  const [form, setForm] = useState({ ingredientId: "" as number | "", quantity: "", remainingQuantity: "", lotNumber: "", expiresOn: "", receivedOn: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, exp, dead] = await Promise.all([
        getBatches({ onlyWithRemaining: onlyRemaining ? true : undefined, ingredientId: ingredientFilter === "" ? undefined : ingredientFilter, page, pageSize }),
        getExpiringBatches(7),
        getExpiredBatches(),
      ]);
      setBatches(list.data ?? []);
      setTotalCount(list.totalCount ?? 0);
      setExpiring(exp);
      setExpired(dead);
    } catch (err) {
      setError(errorMessage(err, "Failed to load batches"));
    } finally {
      setLoading(false);
    }
  }, [onlyRemaining, ingredientFilter, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    getIngredients().then((i) => setIngredients(i.filter((x) => x.isActive))).catch(() => setIngredients([]));
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(t);
  }, [notice]);

  const ingredientById = useMemo(() => {
    const m: Record<number, IngredientLite> = {};
    for (const i of ingredients) m[i.id] = i;
    return m;
  }, [ingredients]);

  function openCreate() {
    setEditing(null);
    setForm({ ingredientId: "", quantity: "", remainingQuantity: "", lotNumber: "", expiresOn: "", receivedOn: new Date().toISOString().slice(0, 10), notes: "" });
    setIsFormOpen(true);
  }

  function openEdit(b: StockBatchDto) {
    setEditing(b);
    setForm({
      ingredientId: b.ingredientId,
      quantity: String(b.quantity),
      remainingQuantity: String(b.remainingQuantity),
      lotNumber: b.lotNumber ?? "",
      expiresOn: toDateInput(b.expiresOn),
      receivedOn: toDateInput(b.receivedOn),
      notes: b.notes ?? "",
    });
    setIsFormOpen(true);
  }

  async function submit() {
    const quantity = Number(form.quantity);
    if (!editing && form.ingredientId === "") {
      setNotice({ variant: "warning", title: "Missing ingredient", message: "Pick an ingredient." });
      return;
    }
    if (!(quantity > 0)) {
      setNotice({ variant: "warning", title: "Check quantity", message: "Quantity must be greater than zero." });
      return;
    }
    setSubmitting(true);
    try {
      if (editing) {
        await updateBatch(editing.id, {
          lotNumber: form.lotNumber,
          quantity,
          remainingQuantity: form.remainingQuantity === "" ? null : Number(form.remainingQuantity),
          expiresOn: form.expiresOn ? `${form.expiresOn}T00:00:00Z` : null,
          receivedOn: form.receivedOn ? `${form.receivedOn}T00:00:00Z` : null,
          notes: form.notes,
        });
      } else {
        await receiveBatch({
          ingredientId: Number(form.ingredientId),
          quantity,
          lotNumber: form.lotNumber || null,
          expiresOn: form.expiresOn ? `${form.expiresOn}T00:00:00Z` : null,
          receivedOn: form.receivedOn ? `${form.receivedOn}T00:00:00Z` : null,
          notes: form.notes || null,
        });
      }
      setIsFormOpen(false);
      setNotice({ variant: "success", title: "Saved", message: editing ? "Batch updated." : "Batch received. Stock itself is unchanged — record the purchase separately if you have not already." });
      await load();
    } catch (err) {
      setNotice({ variant: "error", title: "Error", message: errorMessage(err, "Failed to save batch") });
    } finally {
      setSubmitting(false);
    }
  }

  async function writeOff(b: StockBatchDto) {
    if (!window.confirm(`Write off ${qty(b.remainingQuantity)} ${b.unit} of ${b.ingredientName}${b.lotNumber ? ` (lot ${b.lotNumber})` : ""} as expired waste?`)) return;
    setBusyId(b.id);
    try {
      await writeOffBatch(b.id);
      setNotice({ variant: "success", title: "Written off", message: `${b.ingredientName} batch written off as waste.` });
      await load();
    } catch (err) {
      setNotice({ variant: "error", title: "Error", message: errorMessage(err, "Failed to write off") });
    } finally {
      setBusyId(null);
    }
  }

  async function remove(b: StockBatchDto) {
    if (!window.confirm(`Delete this batch record for ${b.ingredientName}? Stock is not affected.`)) return;
    try {
      await deleteBatch(b.id);
      setNotice({ variant: "success", title: "Deleted", message: "Batch record removed." });
      await load();
    } catch (err) {
      setNotice({ variant: "error", title: "Error", message: errorMessage(err, "Failed to delete") });
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="p-6">
      <PageMeta title="Stock Batches | Axis" description="Lot numbers and expiry tracking" />
      <PageBreadcrumb pageTitle="Batches & Expiry" />

      {notice && (
        <div className="mb-4">
          <Alert variant={notice.variant} title={notice.title} message={notice.message} />
        </div>
      )}

      {!loading && (expired.length > 0 || expiring.length > 0) && (
        <div className="mb-4 space-y-2">
          {expired.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
              <b>{expired.length} expired batch(es)</b> still hold stock: {expired.slice(0, 5).map((b) => `${b.ingredientName} (${qty(b.remainingQuantity)} ${b.unit})`).join(", ")}{expired.length > 5 ? "…" : ""}. Write them off below.
            </div>
          )}
          {expiring.length > 0 && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:border-yellow-500/30 dark:bg-yellow-500/10 dark:text-yellow-200">
              <b>{expiring.length} batch(es) expiring within 7 days:</b> {expiring.slice(0, 5).map((b) => `${b.ingredientName} (${b.daysToExpiry === 0 ? "today" : `${b.daysToExpiry}d`})`).join(", ")}{expiring.length > 5 ? "…" : ""}
            </div>
          )}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select className="h-11 w-64 rounded-lg border border-gray-300 bg-white px-3 text-sm dark:border-white/10 dark:bg-gray-900 dark:text-white/90" value={ingredientFilter} onChange={(e) => { setPage(1); setIngredientFilter(e.target.value === "" ? "" : Number(e.target.value)); }}>
          <option value="">All ingredients</option>
          {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <input type="checkbox" checked={onlyRemaining} onChange={(e) => { setPage(1); setOnlyRemaining(e.target.checked); }} />
          Only with remaining quantity
        </label>
        <button className="ml-auto inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition" onClick={openCreate}>+ Receive Batch</button>
      </div>

      {loading && <div className="flex justify-center py-10"><Loader /></div>}
      {error && <div className="text-red-600 bg-red-50 p-3 rounded mb-4">{error}</div>}

      {!loading && !error && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03] text-gray-800 dark:text-white/90">
          <div className="max-w-full overflow-x-auto">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <TableCell isHeader className={th}>Ingredient</TableCell>
                  <TableCell isHeader className={th}>Lot</TableCell>
                  <TableCell isHeader className={`${th} text-end`}>Received qty</TableCell>
                  <TableCell isHeader className={`${th} text-end`}>Remaining</TableCell>
                  <TableCell isHeader className={th}>Received on</TableCell>
                  <TableCell isHeader className={th}>Expires on</TableCell>
                  <TableCell isHeader className={th}>Status</TableCell>
                  <TableCell isHeader className={th}>Actions</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {batches.length === 0 && (
                  <TableRow><TableCell className={`${td} text-center`}>No batches recorded.</TableCell></TableRow>
                )}
                {batches.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className={`${td} font-medium text-gray-800 dark:text-white/90`}>{b.ingredientName} <span className="text-xs text-gray-400">{b.unit}</span></TableCell>
                    <TableCell className={td}>{b.lotNumber || <span className="text-gray-400">#{b.id}</span>}</TableCell>
                    <TableCell className={`${td} text-end tabular-nums`}>{qty(b.quantity)}</TableCell>
                    <TableCell className={`${td} text-end tabular-nums`}>{qty(b.remainingQuantity)}</TableCell>
                    <TableCell className={td}>{new Date(b.receivedOn).toLocaleDateString()}</TableCell>
                    <TableCell className={td}>{b.expiresOn ? new Date(b.expiresOn).toLocaleDateString() : "—"}</TableCell>
                    <TableCell className={td}><ExpiryPill b={b} /></TableCell>
                    <TableCell className={td}>
                      <div className="flex items-center gap-3">
                        {!b.writtenOffOn && <button className="text-blue-600 dark:text-blue-400 hover:underline" onClick={() => openEdit(b)}>Edit</button>}
                        {b.isExpired && b.remainingQuantity > 0 && !b.writtenOffOn && (
                          <button className="text-red-600 hover:underline disabled:opacity-50" disabled={busyId === b.id} onClick={() => writeOff(b)}>Write off</button>
                        )}
                        <DeleteIconButton onClick={() => remove(b)} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 text-sm text-gray-600 dark:text-gray-300">
              <span>Page {page} of {totalPages} ({totalCount} total)</span>
              <div className="flex gap-2">
                <button className="px-3 py-1 rounded border dark:border-white/10 disabled:opacity-50 text-gray-700 dark:text-gray-300" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
                <button className="px-3 py-1 rounded border dark:border-white/10 disabled:opacity-50 text-gray-700 dark:text-gray-300" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
        Batches are an informational layer over purchases: receiving one does not change stock. Writing off an expired batch records a Waste movement (reason "Expired") for its remaining quantity.
      </p>

      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editing ? `Edit batch — ${editing.ingredientName}` : "Receive Batch"}
        className="max-w-lg"
        footer={
          <>
            <button className="px-4 py-2 rounded border dark:border-white/10 text-gray-700 dark:text-gray-300" onClick={() => setIsFormOpen(false)} disabled={submitting}>Cancel</button>
            <button className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50" onClick={submit} disabled={submitting}>{submitting ? "Saving..." : "Save"}</button>
          </>
        }
      >
        <div className="space-y-4">
          {!editing && (
            <div>
              <Label htmlFor="b-ing">Ingredient</Label>
              <select id="b-ing" className={select} value={form.ingredientId} onChange={(e) => setForm({ ...form, ingredientId: e.target.value === "" ? "" : Number(e.target.value) })}>
                <option value="">Select ingredient</option>
                {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="b-qty">Quantity{form.ingredientId !== "" && ingredientById[Number(form.ingredientId)] ? ` (${ingredientById[Number(form.ingredientId)].unit})` : ""}</Label>
              <Input id="b-qty" type="number" step={0.001} min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </div>
            {editing && (
              <div>
                <Label htmlFor="b-rem">Remaining</Label>
                <Input id="b-rem" type="number" step={0.001} min="0" value={form.remainingQuantity} onChange={(e) => setForm({ ...form, remainingQuantity: e.target.value })} />
              </div>
            )}
          </div>
          <div>
            <Label htmlFor="b-lot">Lot number</Label>
            <Input id="b-lot" value={form.lotNumber} onChange={(e) => setForm({ ...form, lotNumber: e.target.value })} placeholder="Optional" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="b-recv">Received on</Label>
              <Input id="b-recv" type="date" value={form.receivedOn} onChange={(e) => setForm({ ...form, receivedOn: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="b-exp">Expires on</Label>
              <Input id="b-exp" type="date" value={form.expiresOn} onChange={(e) => setForm({ ...form, expiresOn: e.target.value })} />
            </div>
          </div>
          <div>
            <Label htmlFor="b-notes">Notes</Label>
            <Input id="b-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional" />
          </div>
        </div>
      </Modal>
    </div>
  );
}
