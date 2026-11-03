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
  StockTransferDto,
  StockLocationDto,
  IngredientLite,
  LocationStockDto,
  getTransfers,
  getTransfer,
  createTransfer,
  updateTransfer,
  postTransfer,
  cancelTransfer,
  getLocations,
  getIngredients,
  getLocationStock,
  errorMessage,
} from "../../services/stockOpsService";

type Notice = { variant: "success" | "error" | "warning" | "info"; title: string; message: string };
type LineDraft = { ingredientId: number; quantity: string };

const th = "px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400";
const td = "px-5 py-3 text-sm text-gray-700 dark:text-gray-300";
const select = "h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm dark:border-white/10 dark:bg-gray-900 dark:text-white/90";
const qty = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 3 });

function StatusPill({ status }: { status: string }) {
  const cls =
    status === "Posted"
      ? "bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-300"
      : status === "Cancelled"
      ? "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300"
      : "bg-yellow-50 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-300";
  return <span className={`rounded px-2 py-0.5 text-xs ${cls}`}>{status}</span>;
}

export default function StockTransfers() {
  const [transfers, setTransfers] = useState<StockTransferDto[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const [locations, setLocations] = useState<StockLocationDto[]>([]);
  const [ingredients, setIngredients] = useState<IngredientLite[]>([]);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<StockTransferDto | null>(null);
  const [fromId, setFromId] = useState<number | "">("");
  const [toId, setToId] = useState<number | "">("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [pickerSearch, setPickerSearch] = useState("");
  const [sourceStock, setSourceStock] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);

  const [viewing, setViewing] = useState<StockTransferDto | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getTransfers({ status: statusFilter || undefined, page, pageSize });
      setTransfers(res.data ?? []);
      setTotalCount(res.totalCount ?? 0);
    } catch (err) {
      setError(errorMessage(err, "Failed to load transfers"));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    getLocations().then(setLocations).catch(() => setLocations([]));
    getIngredients().then((i) => setIngredients(i.filter((x) => x.isActive))).catch(() => setIngredients([]));
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(t);
  }, [notice]);

  // Available quantities at the chosen source location (for hints + client-side validation).
  useEffect(() => {
    if (fromId === "") {
      setSourceStock({});
      return;
    }
    let mounted = true;
    getLocationStock(Number(fromId))
      .then((rows: LocationStockDto[]) => {
        if (!mounted) return;
        const m: Record<number, number> = {};
        for (const r of rows) m[r.ingredientId] = r.quantity;
        setSourceStock(m);
      })
      .catch(() => mounted && setSourceStock({}));
    return () => {
      mounted = false;
    };
  }, [fromId]);

  function openCreate() {
    setEditing(null);
    const def = locations.find((l) => l.isDefault);
    setFromId(def ? def.id : "");
    setToId("");
    setNotes("");
    setLines([]);
    setPickerSearch("");
    setIsFormOpen(true);
  }

  function openEdit(t: StockTransferDto) {
    setEditing(t);
    setFromId(t.fromLocationId);
    setToId(t.toLocationId);
    setNotes(t.notes ?? "");
    setLines(t.lines.map((l) => ({ ingredientId: l.ingredientId, quantity: String(l.quantity) })));
    setPickerSearch("");
    setIsFormOpen(true);
  }

  const pickerOptions = useMemo(() => {
    const used = new Set(lines.map((l) => l.ingredientId));
    const s = pickerSearch.trim().toLowerCase();
    return ingredients.filter((i) => !used.has(i.id) && (!s || i.name.toLowerCase().includes(s))).slice(0, 8);
  }, [ingredients, lines, pickerSearch]);

  const ingredientById = useMemo(() => {
    const m: Record<number, IngredientLite> = {};
    for (const i of ingredients) m[i.id] = i;
    return m;
  }, [ingredients]);

  function addLine(i: IngredientLite) {
    setLines([...lines, { ingredientId: i.id, quantity: "" }]);
    setPickerSearch("");
  }

  async function submit() {
    if (fromId === "" || toId === "") {
      setNotice({ variant: "warning", title: "Missing locations", message: "Pick both a source and a destination." });
      return;
    }
    if (fromId === toId) {
      setNotice({ variant: "warning", title: "Same location", message: "Source and destination must differ." });
      return;
    }
    const parsed = lines.map((l) => ({ ingredientId: l.ingredientId, quantity: Number(l.quantity) }));
    if (parsed.length === 0 || parsed.some((l) => !(l.quantity > 0))) {
      setNotice({ variant: "warning", title: "Check lines", message: "Add at least one line with a quantity greater than zero." });
      return;
    }
    setSubmitting(true);
    try {
      const dto = { fromLocationId: Number(fromId), toLocationId: Number(toId), notes: notes || null, lines: parsed };
      if (editing) await updateTransfer(editing.id, dto);
      else await createTransfer(dto);
      setNotice({ variant: "success", title: "Saved", message: `Transfer ${editing ? "updated" : "created"} as draft.` });
      setIsFormOpen(false);
      await load();
    } catch (err) {
      setNotice({ variant: "error", title: "Error", message: errorMessage(err, "Failed to save transfer") });
    } finally {
      setSubmitting(false);
    }
  }

  async function post(t: StockTransferDto) {
    if (!window.confirm(`Post ${t.reference} (${t.fromLocationName} → ${t.toLocationName})? Stock will move.`)) return;
    setBusyId(t.id);
    try {
      await postTransfer(t.id);
      setNotice({ variant: "success", title: "Posted", message: `${t.reference} posted.` });
      await load();
    } catch (err) {
      setNotice({ variant: "error", title: "Could not post", message: errorMessage(err, "Failed to post transfer") });
    } finally {
      setBusyId(null);
    }
  }

  async function cancel(t: StockTransferDto) {
    if (!window.confirm(`Cancel ${t.reference}?`)) return;
    setBusyId(t.id);
    try {
      await cancelTransfer(t.id);
      setNotice({ variant: "success", title: "Cancelled", message: `${t.reference} cancelled.` });
      await load();
    } catch (err) {
      setNotice({ variant: "error", title: "Error", message: errorMessage(err, "Failed to cancel") });
    } finally {
      setBusyId(null);
    }
  }

  async function view(id: number) {
    try {
      setViewing(await getTransfer(id));
    } catch (err) {
      setNotice({ variant: "error", title: "Error", message: errorMessage(err, "Failed to load transfer") });
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="p-6">
      <PageMeta title="Stock Transfers | Axis" description="Move stock between locations" />
      <PageBreadcrumb pageTitle="Stock Transfers" />

      {notice && (
        <div className="mb-4">
          <Alert variant={notice.variant} title={notice.title} message={notice.message} />
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <select className="h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm dark:border-white/10 dark:bg-gray-900 dark:text-white/90" value={statusFilter} onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}>
          <option value="">All statuses</option>
          <option value="Draft">Draft</option>
          <option value="Posted">Posted</option>
          <option value="Cancelled">Cancelled</option>
        </select>
        <button className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition" onClick={openCreate}>
          + New Transfer
        </button>
      </div>

      {loading && <div className="flex justify-center py-10"><Loader /></div>}
      {error && <div className="text-red-600 bg-red-50 p-3 rounded mb-4">{error}</div>}

      {!loading && !error && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="max-w-full overflow-x-auto">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <TableCell isHeader className={th}>Reference</TableCell>
                  <TableCell isHeader className={th}>From</TableCell>
                  <TableCell isHeader className={th}>To</TableCell>
                  <TableCell isHeader className={th}>Lines</TableCell>
                  <TableCell isHeader className={th}>Status</TableCell>
                  <TableCell isHeader className={th}>Created</TableCell>
                  <TableCell isHeader className={th}>Actions</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {transfers.length === 0 && (
                  <TableRow><TableCell className={`${td} text-center`}>No transfers yet.</TableCell></TableRow>
                )}
                {transfers.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className={`${td} font-medium text-gray-800 dark:text-white/90`}>{t.reference}</TableCell>
                    <TableCell className={td}>{t.fromLocationName}</TableCell>
                    <TableCell className={td}>{t.toLocationName}</TableCell>
                    <TableCell className={td}>{t.lines.length}</TableCell>
                    <TableCell className={td}><StatusPill status={t.status} /></TableCell>
                    <TableCell className={td}>{new Date(t.createdOn).toLocaleString()}<div className="text-xs text-gray-400">{t.createdBy}</div></TableCell>
                    <TableCell className={td}>
                      <div className="flex items-center gap-3">
                        <button className="text-blue-600 hover:underline" onClick={() => view(t.id)}>View</button>
                        {t.status === "Draft" && (
                          <>
                            <button className="text-blue-600 hover:underline" onClick={() => openEdit(t)}>Edit</button>
                            <button className="text-green-600 hover:underline disabled:opacity-50" disabled={busyId === t.id} onClick={() => post(t)}>Post</button>
                            <button className="text-red-600 hover:underline disabled:opacity-50" disabled={busyId === t.id} onClick={() => cancel(t)}>Cancel</button>
                          </>
                        )}
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
                <button className="px-3 py-1 rounded border dark:border-white/10 disabled:opacity-50" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
                <button className="px-3 py-1 rounded border dark:border-white/10 disabled:opacity-50" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create / edit */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editing ? `Edit ${editing.reference}` : "New Transfer"}
        className="max-w-3xl"
        footer={
          <>
            <button className="px-4 py-2 rounded border dark:border-white/10" onClick={() => setIsFormOpen(false)} disabled={submitting}>Cancel</button>
            <button className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50" onClick={submit} disabled={submitting}>
              {submitting ? "Saving..." : "Save draft"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="tr-from">From</Label>
              <select id="tr-from" className={select} value={fromId} onChange={(e) => setFromId(e.target.value === "" ? "" : Number(e.target.value))}>
                <option value="">Select source</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}{l.isDefault ? " (default)" : ""}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="tr-to">To</Label>
              <select id="tr-to" className={select} value={toId} onChange={(e) => setToId(e.target.value === "" ? "" : Number(e.target.value))}>
                <option value="">Select destination</option>
                {locations.filter((l) => l.id !== fromId).map((l) => <option key={l.id} value={l.id}>{l.name}{l.isDefault ? " (default)" : ""}</option>)}
              </select>
            </div>
          </div>
          <div>
            <Label htmlFor="tr-notes">Notes</Label>
            <Input id="tr-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Friday bar restock" />
          </div>

          <div>
            <Label>Lines</Label>
            {lines.length === 0 && <p className="mb-2 text-sm text-gray-500">No lines yet — search an ingredient below to add one.</p>}
            {lines.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableCell isHeader className={th}>Ingredient</TableCell>
                    <TableCell isHeader className={`${th} text-end`}>Available</TableCell>
                    <TableCell isHeader className={`${th} text-end`}>Quantity</TableCell>
                    <TableCell isHeader className={th}>{""}</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                  {lines.map((l, idx) => {
                    const ing = ingredientById[l.ingredientId];
                    const avail = sourceStock[l.ingredientId];
                    const over = avail != null && Number(l.quantity) > avail;
                    return (
                      <TableRow key={l.ingredientId}>
                        <TableCell className={td}>{ing?.name ?? `#${l.ingredientId}`} <span className="text-xs text-gray-400">{ing?.unit}</span></TableCell>
                        <TableCell className={`${td} text-end tabular-nums ${over ? "text-red-600" : ""}`}>{avail == null ? "—" : qty(avail)}</TableCell>
                        <TableCell className={`${td} text-end`}>
                          <input
                            type="number"
                            step={0.001}
                            min="0"
                            className={`h-9 w-28 rounded border px-2 text-end text-sm dark:bg-gray-900 dark:text-white/90 ${over ? "border-red-500" : "border-gray-300 dark:border-white/10"}`}
                            value={l.quantity}
                            onChange={(e) => setLines(lines.map((x, i) => (i === idx ? { ...x, quantity: e.target.value } : x)))}
                          />
                        </TableCell>
                        <TableCell className={td}><DeleteIconButton title="Remove" onClick={() => setLines(lines.filter((_, i) => i !== idx))} /></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
            <div className="mt-3">
              <Input placeholder="Search ingredient to add..." value={pickerSearch} onChange={(e) => setPickerSearch(e.target.value)} />
              {pickerSearch && (
                <div className="mt-1 max-h-48 overflow-auto rounded border border-gray-200 bg-white dark:border-white/10 dark:bg-gray-900">
                  {pickerOptions.length === 0 && <div className="px-3 py-2 text-sm text-gray-500">No matches</div>}
                  {pickerOptions.map((i) => (
                    <button key={i.id} className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-white/5" onClick={() => addLine(i)}>
                      {i.name} <span className="text-xs text-gray-400">{i.unit}{sourceStock[i.id] != null ? ` · ${qty(sourceStock[i.id])} available` : ""}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* View */}
      <Modal isOpen={!!viewing} onClose={() => setViewing(null)} title={viewing ? `${viewing.reference}` : ""} className="max-w-2xl">
        {viewing && (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
              <StatusPill status={viewing.status} />
              <span>{viewing.fromLocationName} → {viewing.toLocationName}</span>
              {viewing.postedOn && <span>Posted {new Date(viewing.postedOn).toLocaleString()}</span>}
            </div>
            {viewing.notes && <p className="mb-3 text-xs text-gray-500">{viewing.notes}</p>}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell isHeader className={th}>Ingredient</TableCell>
                  <TableCell isHeader className={`${th} text-end`}>Quantity</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {viewing.lines.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className={td}>{l.ingredientName}</TableCell>
                    <TableCell className={`${td} text-end tabular-nums`}>{qty(l.quantity)} {l.unit}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </Modal>
    </div>
  );
}
