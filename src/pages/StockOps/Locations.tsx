import { useCallback, useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import Modal from "../../components/ui/Modal";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import Loader from "../../components/ui/Loader";
import Alert from "../../components/ui/alert/Alert";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../components/ui/table";
import {
  StockLocationDto,
  LocationStockDto,
  getLocations,
  createLocation,
  updateLocation,
  deactivateLocation,
  getLocationStock,
  errorMessage,
} from "../../services/stockOpsService";

type Notice = { variant: "success" | "error" | "warning" | "info"; title: string; message: string };

const th = "px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400";
const td = "px-5 py-3 text-sm text-gray-700 dark:text-gray-300";

export default function Locations() {
  const [locations, setLocations] = useState<StockLocationDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<StockLocationDto | null>(null);
  const [form, setForm] = useState({ name: "", code: "", isDefault: false, isActive: true });
  const [submitting, setSubmitting] = useState(false);

  const [stockFor, setStockFor] = useState<StockLocationDto | null>(null);
  const [stock, setStock] = useState<LocationStockDto[]>([]);
  const [stockSearch, setStockSearch] = useState("");
  const [stockLoading, setStockLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setLocations(await getLocations(includeInactive));
    } catch (err) {
      setError(errorMessage(err, "Failed to load locations"));
    } finally {
      setLoading(false);
    }
  }, [includeInactive]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    if (!stockFor) return;
    let mounted = true;
    setStockLoading(true);
    const t = setTimeout(() => {
      getLocationStock(stockFor.id, stockSearch || undefined)
        .then((rows) => mounted && setStock(rows))
        .catch((err) => mounted && setNotice({ variant: "error", title: "Error", message: errorMessage(err) }))
        .finally(() => mounted && setStockLoading(false));
    }, 250);
    return () => {
      mounted = false;
      clearTimeout(t);
    };
  }, [stockFor, stockSearch]);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", code: "", isDefault: false, isActive: true });
    setIsFormOpen(true);
  }

  function openEdit(l: StockLocationDto) {
    setEditing(l);
    setForm({ name: l.name, code: l.code, isDefault: l.isDefault, isActive: l.isActive });
    setIsFormOpen(true);
  }

  async function submit() {
    if (!form.name.trim() || !form.code.trim()) {
      setNotice({ variant: "warning", title: "Missing fields", message: "Name and code are required." });
      return;
    }
    setSubmitting(true);
    try {
      if (editing) await updateLocation(editing.id, form);
      else await createLocation(form);
      setNotice({ variant: "success", title: "Saved", message: `Location ${editing ? "updated" : "created"}.` });
      setIsFormOpen(false);
      await load();
    } catch (err) {
      setNotice({ variant: "error", title: "Error", message: errorMessage(err, "Failed to save location") });
    } finally {
      setSubmitting(false);
    }
  }

  async function deactivate(l: StockLocationDto) {
    if (!window.confirm(`Deactivate location "${l.name}"?`)) return;
    try {
      await deactivateLocation(l.id);
      setNotice({ variant: "success", title: "Deactivated", message: `${l.name} is now inactive.` });
      await load();
    } catch (err) {
      setNotice({ variant: "error", title: "Error", message: errorMessage(err, "Failed to deactivate") });
    }
  }

  return (
    <div className="p-6">
      <PageMeta title="Stock Locations | Axis" description="Manage the places stock is held" />
      <PageBreadcrumb pageTitle="Stock Locations" />

      {notice && (
        <div className="mb-4">
          <Alert variant={notice.variant} title={notice.title} message={notice.message} />
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />
          Show inactive
        </label>
        <button className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition" onClick={openCreate}>
          + Add Location
        </button>
      </div>

      <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
        The default location mirrors the ingredient quantities on the main stock page. Other locations hold their own quantities fed by transfers and stocktakes.
      </p>

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
                  <TableCell isHeader className={th}>Name</TableCell>
                  <TableCell isHeader className={th}>Code</TableCell>
                  <TableCell isHeader className={th}>Default</TableCell>
                  <TableCell isHeader className={th}>Status</TableCell>
                  <TableCell isHeader className={th}>Actions</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {locations.length === 0 && (
                  <TableRow>
                    <TableCell className={`${td} text-center`}>No locations yet.</TableCell>
                  </TableRow>
                )}
                {locations.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className={`${td} font-medium text-gray-800 dark:text-white/90`}>{l.name}</TableCell>
                    <TableCell className={td}>{l.code}</TableCell>
                    <TableCell className={td}>{l.isDefault ? <span className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">Default</span> : "—"}</TableCell>
                    <TableCell className={td}>
                      <span className={`rounded px-2 py-0.5 text-xs ${l.isActive ? "bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-300" : "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300"}`}>
                        {l.isActive ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                    <TableCell className={td}>
                      <div className="flex items-center gap-3">
                        <button className="text-blue-600 hover:underline" onClick={() => { setStockSearch(""); setStockFor(l); }}>Stock</button>
                        <button className="text-blue-600 hover:underline" onClick={() => openEdit(l)}>Edit</button>
                        {!l.isDefault && l.isActive && (
                          <button className="text-red-600 hover:underline" onClick={() => deactivate(l)}>Deactivate</button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editing ? "Edit Location" : "New Location"}
        className="max-w-lg"
        footer={
          <>
            <button className="px-4 py-2 rounded border dark:border-white/10" onClick={() => setIsFormOpen(false)} disabled={submitting}>Cancel</button>
            <button className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50" onClick={submit} disabled={submitting}>
              {submitting ? "Saving..." : "Save"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="loc-name">Name</Label>
            <Input id="loc-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Bar fridge" />
          </div>
          <div>
            <Label htmlFor="loc-code">Code</Label>
            <Input id="loc-code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="BAR" />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={form.isActive} disabled={editing?.isDefault} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
            Active
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={form.isDefault} disabled={editing?.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />
            Default location (mirrors the main ingredient stock)
          </label>
        </div>
      </Modal>

      <Modal isOpen={!!stockFor} onClose={() => setStockFor(null)} title={stockFor ? `Stock at ${stockFor.name}` : ""} className="max-w-2xl">
        <div className="mb-3 w-64">
          <Input placeholder="Search ingredients..." value={stockSearch} onChange={(e) => setStockSearch(e.target.value)} />
        </div>
        {stockLoading ? (
          <div className="flex justify-center py-6"><Loader /></div>
        ) : stock.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">No ingredients.</p>
        ) : (
          <div className="max-h-[50vh] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell isHeader className={th}>Ingredient</TableCell>
                  <TableCell isHeader className={`${th} text-end`}>Quantity</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {stock.map((s) => (
                  <TableRow key={s.ingredientId}>
                    <TableCell className={td}>{s.ingredientName}</TableCell>
                    <TableCell className={`${td} text-end tabular-nums`}>{s.quantity} {s.unit}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Modal>
    </div>
  );
}
