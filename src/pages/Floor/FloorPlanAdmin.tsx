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
  FloorAreaDto,
  DiningTableDto,
  DiningTableUpsertDto,
  getAreas,
  createArea,
  updateArea,
  deleteArea,
  getTables,
  createTable,
  updateTable,
  deleteTable,
  saveLayout,
  errorMessage,
} from "../../services/floorService";

const CELL = 28; // px per grid unit in the preview
const GRID_COLS = 24;
const GRID_ROWS = 16;

type Notice = { variant: "success" | "error" | "warning" | "info"; title: string; message: string };

const emptyTable = (areaId: number): DiningTableUpsertDto => ({
  areaId,
  code: "",
  name: "",
  capacity: 4,
  shape: "Rect",
  posX: 0,
  posY: 0,
  width: 2,
  height: 2,
  isActive: true,
});

export default function FloorPlanAdmin() {
  const [areas, setAreas] = useState<FloorAreaDto[]>([]);
  const [tables, setTables] = useState<DiningTableDto[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  // area form
  const [areaModal, setAreaModal] = useState(false);
  const [editingArea, setEditingArea] = useState<FloorAreaDto | null>(null);
  const [areaForm, setAreaForm] = useState({ name: "", sortOrder: 0, isActive: true });

  // table form
  const [tableModal, setTableModal] = useState(false);
  const [editingTable, setEditingTable] = useState<DiningTableDto | null>(null);
  const [tableForm, setTableForm] = useState<DiningTableUpsertDto>(emptyTable(0));
  const [saving, setSaving] = useState(false);

  // layout editing (positions kept locally until "Save layout")
  const [positions, setPositions] = useState<Record<number, { posX: number; posY: number; width: number; height: number }>>({});
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ kind: "area" | "table"; id: number; label: string } | null>(null);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, t] = await Promise.all([getAreas(true), getTables(undefined, true)]);
      setAreas(a);
      setTables(t);
      setPositions({});
      setSelectedAreaId((cur) => cur ?? a[0]?.id ?? null);
    } catch (err) {
      setError(errorMessage(err, "Failed to load the floor plan"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const areaTables = useMemo(
    () => tables.filter((t) => t.areaId === selectedAreaId),
    [tables, selectedAreaId]
  );
  const geometry = (t: DiningTableDto) => positions[t.id] ?? { posX: t.posX, posY: t.posY, width: t.width, height: t.height };
  const dirtyCount = Object.keys(positions).length;
  const selectedTable = areaTables.find((t) => t.id === selectedTableId) ?? null;

  // ── Areas ──────────────────────────────────────────────────────
  function openAreaCreate() {
    setEditingArea(null);
    setAreaForm({ name: "", sortOrder: areas.length + 1, isActive: true });
    setAreaModal(true);
  }
  function openAreaEdit(a: FloorAreaDto) {
    setEditingArea(a);
    setAreaForm({ name: a.name, sortOrder: a.sortOrder, isActive: a.isActive });
    setAreaModal(true);
  }
  async function submitArea() {
    if (!areaForm.name.trim()) {
      setNotice({ variant: "error", title: "Validation", message: "Area name is required" });
      return;
    }
    setSaving(true);
    try {
      if (editingArea) {
        const r = await updateArea(editingArea.id, areaForm);
        if (!r.success) throw new Error(r.message);
      } else {
        const created = await createArea(areaForm);
        setSelectedAreaId(created.id);
      }
      setAreaModal(false);
      setNotice({ variant: "success", title: "Saved", message: "Area saved" });
      await load();
    } catch (err) {
      setNotice({ variant: "error", title: "Save failed", message: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  // ── Tables ─────────────────────────────────────────────────────
  function openTableCreate() {
    if (!selectedAreaId) return;
    setEditingTable(null);
    setTableForm(emptyTable(selectedAreaId));
    setTableModal(true);
  }
  function openTableEdit(t: DiningTableDto) {
    const g = geometry(t);
    setEditingTable(t);
    setTableForm({
      areaId: t.areaId,
      code: t.code,
      name: t.name,
      capacity: t.capacity,
      shape: t.shape === "Round" ? "Round" : "Rect",
      posX: g.posX,
      posY: g.posY,
      width: g.width,
      height: g.height,
      isActive: t.isActive,
    });
    setTableModal(true);
  }
  async function submitTable() {
    if (!tableForm.code.trim() || !tableForm.name.trim()) {
      setNotice({ variant: "error", title: "Validation", message: "Code and name are required" });
      return;
    }
    setSaving(true);
    try {
      const r = editingTable ? await updateTable(editingTable.id, tableForm) : await createTable(tableForm);
      if (!r.success) throw new Error(r.message);
      setTableModal(false);
      setNotice({ variant: "success", title: "Saved", message: "Table saved" });
      await load();
    } catch (err) {
      setNotice({ variant: "error", title: "Save failed", message: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const r = deleteTarget.kind === "area" ? await deleteArea(deleteTarget.id) : await deleteTable(deleteTarget.id);
      if (!r.success) throw new Error(r.message);
      setNotice({ variant: "success", title: "Done", message: r.message });
      if (deleteTarget.kind === "area" && deleteTarget.id === selectedAreaId) setSelectedAreaId(null);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setNotice({ variant: "error", title: "Delete failed", message: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  // ── Layout ─────────────────────────────────────────────────────
  function setGeom(t: DiningTableDto, patch: Partial<{ posX: number; posY: number; width: number; height: number }>) {
    const g = { ...geometry(t), ...patch };
    g.posX = Math.max(0, Math.min(GRID_COLS - 1, g.posX));
    g.posY = Math.max(0, Math.min(GRID_ROWS - 1, g.posY));
    g.width = Math.max(1, Math.min(GRID_COLS - g.posX, g.width));
    g.height = Math.max(1, Math.min(GRID_ROWS - g.posY, g.height));
    setPositions((p) => ({ ...p, [t.id]: g }));
  }
  async function persistLayout() {
    if (dirtyCount === 0) return;
    setSaving(true);
    try {
      const r = await saveLayout(Object.entries(positions).map(([id, g]) => ({ id: Number(id), ...g })));
      if (!r.success) throw new Error(r.message);
      setNotice({ variant: "success", title: "Layout saved", message: `${r.data ?? 0} table(s) updated` });
      await load();
    } catch (err) {
      setNotice({ variant: "error", title: "Save failed", message: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  const num = (v: string) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const th = "px-4 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400";
  const td = "px-4 py-3 text-sm text-gray-700 dark:text-gray-300";
  const btn = "inline-flex items-center px-3 py-2 rounded text-sm transition";

  return (
    <div className="p-6">
      <PageMeta title="Floor Plan | Axis" description="Areas and tables of the venue floor" />
      <PageBreadcrumb pageTitle="Floor Plan" />

      {notice && (
        <div className="mb-4">
          <Alert variant={notice.variant} title={notice.title} message={notice.message} />
        </div>
      )}
      {error && <div className="text-red-600 bg-red-50 p-3 rounded mb-4">{error}</div>}
      {loading && (
        <div className="flex justify-center py-10">
          <Loader />
        </div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Areas */}
          <div className="rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03] p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-800 dark:text-white/90">Areas</h2>
              <button className={`${btn} bg-blue-600 text-white hover:bg-blue-700`} onClick={openAreaCreate}>
                + Area
              </button>
            </div>
            {areas.length === 0 && <p className="text-sm text-gray-500">No areas yet. Create one to start placing tables.</p>}
            <ul className="space-y-1">
              {areas.map((a) => (
                <li
                  key={a.id}
                  className={`flex items-center justify-between rounded px-3 py-2 cursor-pointer ${
                    a.id === selectedAreaId ? "bg-blue-50 dark:bg-blue-500/10" : "hover:bg-gray-50 dark:hover:bg-white/[0.03]"
                  }`}
                  onClick={() => {
                    setSelectedAreaId(a.id);
                    setSelectedTableId(null);
                  }}
                >
                  <div>
                    <div className={`text-sm font-medium ${a.isActive ? "text-gray-800 dark:text-white/90" : "text-gray-400 line-through"}`}>
                      {a.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {a.tableCount} table{a.tableCount === 1 ? "" : "s"} · order {a.sortOrder}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="text-xs text-blue-600 hover:underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        openAreaEdit(a);
                      }}
                    >
                      Edit
                    </button>
                    <DeleteIconButton onClick={() => setDeleteTarget({ kind: "area", id: a.id, label: a.name })} />
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Preview + table list */}
          <div className="lg:col-span-3 space-y-4">
            <div className="rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h2 className="font-semibold text-gray-800 dark:text-white/90">
                  Layout preview {selectedAreaId ? `— ${areas.find((a) => a.id === selectedAreaId)?.name ?? ""}` : ""}
                </h2>
                <div className="flex items-center gap-2">
                  <button className={`${btn} bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50`} onClick={openTableCreate} disabled={!selectedAreaId}>
                    + Table
                  </button>
                  <button
                    className={`${btn} bg-green-600 text-white hover:bg-green-700 disabled:opacity-50`}
                    onClick={persistLayout}
                    disabled={dirtyCount === 0 || saving}
                  >
                    Save layout{dirtyCount > 0 ? ` (${dirtyCount})` : ""}
                  </button>
                </div>
              </div>

              {!selectedAreaId && <p className="text-sm text-gray-500">Select an area to see its tables.</p>}
              {selectedAreaId && (
                <div className="flex flex-col xl:flex-row gap-4">
                  <div className="overflow-auto">
                    <div
                      className="relative rounded border border-dashed border-gray-300 dark:border-gray-600"
                      style={{
                        width: GRID_COLS * CELL,
                        height: GRID_ROWS * CELL,
                        backgroundImage:
                          "linear-gradient(to right, rgba(128,128,128,0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(128,128,128,0.15) 1px, transparent 1px)",
                        backgroundSize: `${CELL}px ${CELL}px`,
                      }}
                    >
                      {areaTables.map((t) => {
                        const g = geometry(t);
                        const selected = t.id === selectedTableId;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            title={`${t.code} — ${t.name} (${t.capacity})`}
                            onClick={() => setSelectedTableId(t.id)}
                            className={`absolute flex flex-col items-center justify-center text-xs font-medium border-2 transition ${
                              t.shape === "Round" ? "rounded-full" : "rounded-md"
                            } ${
                              selected
                                ? "border-blue-600 bg-blue-100 text-blue-900 dark:bg-blue-500/30 dark:text-white"
                                : t.isActive
                                ? "border-gray-400 bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-white"
                                : "border-gray-300 bg-gray-50 text-gray-400 dark:bg-gray-800"
                            }`}
                            style={{ left: g.posX * CELL, top: g.posY * CELL, width: g.width * CELL, height: g.height * CELL }}
                          >
                            <span>{t.code}</span>
                            <span className="text-[10px] opacity-70">{t.capacity} seats</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="w-full xl:w-64 rounded border border-gray-200 dark:border-white/[0.05] p-3">
                    {!selectedTable && <p className="text-sm text-gray-500">Click a table in the preview to adjust its position and size.</p>}
                    {selectedTable && (
                      <div className="space-y-2">
                        <div className="font-medium text-gray-800 dark:text-white/90">
                          {selectedTable.code} — {selectedTable.name}
                        </div>
                        {(["posX", "posY", "width", "height"] as const).map((k) => (
                          <div key={k}>
                            <Label>{{ posX: "X", posY: "Y", width: "Width", height: "Height" }[k]}</Label>
                            <Input
                              type="number"
                              min="0"
                              value={geometry(selectedTable)[k]}
                              onChange={(e) => setGeom(selectedTable, { [k]: num(e.target.value) })}
                            />
                          </div>
                        ))}
                        <button className={`${btn} bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 w-full justify-center`} onClick={() => openTableEdit(selectedTable)}>
                          Edit details
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
              <div className="max-w-full overflow-x-auto">
                <Table>
                  <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                    <TableRow>
                      <TableCell isHeader className={th}>Code</TableCell>
                      <TableCell isHeader className={th}>Name</TableCell>
                      <TableCell isHeader className={th}>Seats</TableCell>
                      <TableCell isHeader className={th}>Shape</TableCell>
                      <TableCell isHeader className={th}>Position</TableCell>
                      <TableCell isHeader className={th}>Active</TableCell>
                      <TableCell isHeader className={th}>Actions</TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                    {areaTables.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className={`${td} text-center text-gray-500`}>
                          {selectedAreaId ? "No tables in this area yet." : "Select an area."}
                        </TableCell>
                      </TableRow>
                    )}
                    {areaTables.map((t) => {
                      const g = geometry(t);
                      return (
                        <TableRow key={t.id} className={t.id === selectedTableId ? "bg-blue-50 dark:bg-blue-500/10" : ""}>
                          <TableCell className={`${td} font-medium`}>{t.code}</TableCell>
                          <TableCell className={td}>{t.name}</TableCell>
                          <TableCell className={td}>{t.capacity}</TableCell>
                          <TableCell className={td}>{t.shape}</TableCell>
                          <TableCell className={td}>
                            ({g.posX}, {g.posY}) {g.width}×{g.height}
                          </TableCell>
                          <TableCell className={td}>{t.isActive ? "Yes" : "No"}</TableCell>
                          <TableCell className={td}>
                            <div className="flex items-center gap-3">
                              <button className="text-blue-600 hover:underline" onClick={() => openTableEdit(t)}>
                                Edit
                              </button>
                              <DeleteIconButton onClick={() => setDeleteTarget({ kind: "table", id: t.id, label: `${t.code} — ${t.name}` })} />
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Area modal */}
      <Modal
        isOpen={areaModal}
        onClose={() => setAreaModal(false)}
        title={editingArea ? "Edit area" : "New area"}
        className="max-w-md"
        footer={
          <>
            <button className={`${btn} bg-gray-100 dark:bg-gray-700`} onClick={() => setAreaModal(false)}>Cancel</button>
            <button className={`${btn} bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50`} onClick={submitArea} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={areaForm.name} onChange={(e) => setAreaForm({ ...areaForm, name: e.target.value })} placeholder="Main hall" />
          </div>
          <div>
            <Label>Sort order</Label>
            <Input type="number" value={areaForm.sortOrder} onChange={(e) => setAreaForm({ ...areaForm, sortOrder: num(e.target.value) })} />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={areaForm.isActive} onChange={(e) => setAreaForm({ ...areaForm, isActive: e.target.checked })} />
            Active
          </label>
        </div>
      </Modal>

      {/* Table modal */}
      <Modal
        isOpen={tableModal}
        onClose={() => setTableModal(false)}
        title={editingTable ? `Edit table ${editingTable.code}` : "New table"}
        className="max-w-xl"
        footer={
          <>
            <button className={`${btn} bg-gray-100 dark:bg-gray-700`} onClick={() => setTableModal(false)}>Cancel</button>
            <button className={`${btn} bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50`} onClick={submitTable} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Area</Label>
            <select
              className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm dark:bg-gray-900 dark:text-white/90 dark:border-gray-700"
              value={tableForm.areaId}
              onChange={(e) => setTableForm({ ...tableForm, areaId: num(e.target.value) })}
            >
              {areas.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Shape</Label>
            <select
              className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm dark:bg-gray-900 dark:text-white/90 dark:border-gray-700"
              value={tableForm.shape}
              onChange={(e) => setTableForm({ ...tableForm, shape: e.target.value === "Round" ? "Round" : "Rect" })}
            >
              <option value="Rect">Rectangle</option>
              <option value="Round">Round</option>
            </select>
          </div>
          <div>
            <Label>Code</Label>
            <Input value={tableForm.code} onChange={(e) => setTableForm({ ...tableForm, code: e.target.value })} placeholder="T1" />
          </div>
          <div>
            <Label>Name</Label>
            <Input value={tableForm.name} onChange={(e) => setTableForm({ ...tableForm, name: e.target.value })} placeholder="Window table" />
          </div>
          <div>
            <Label>Capacity</Label>
            <Input type="number" min="1" value={tableForm.capacity} onChange={(e) => setTableForm({ ...tableForm, capacity: num(e.target.value) })} />
          </div>
          <div className="flex items-end pb-3">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={tableForm.isActive} onChange={(e) => setTableForm({ ...tableForm, isActive: e.target.checked })} />
              Active
            </label>
          </div>
          <div>
            <Label>X</Label>
            <Input type="number" min="0" value={tableForm.posX} onChange={(e) => setTableForm({ ...tableForm, posX: num(e.target.value) })} />
          </div>
          <div>
            <Label>Y</Label>
            <Input type="number" min="0" value={tableForm.posY} onChange={(e) => setTableForm({ ...tableForm, posY: num(e.target.value) })} />
          </div>
          <div>
            <Label>Width</Label>
            <Input type="number" min="1" value={tableForm.width} onChange={(e) => setTableForm({ ...tableForm, width: num(e.target.value) })} />
          </div>
          <div>
            <Label>Height</Label>
            <Input type="number" min="1" value={tableForm.height} onChange={(e) => setTableForm({ ...tableForm, height: num(e.target.value) })} />
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.kind ?? ""}`}
        className="max-w-md"
        footer={
          <>
            <button className={`${btn} bg-gray-100 dark:bg-gray-700`} onClick={() => setDeleteTarget(null)}>Cancel</button>
            <button className={`${btn} bg-red-600 text-white hover:bg-red-700 disabled:opacity-50`} onClick={confirmDelete} disabled={saving}>
              Delete
            </button>
          </>
        }
      >
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Delete <strong>{deleteTarget?.label}</strong>? Items with history are deactivated instead of removed.
        </p>
      </Modal>
    </div>
  );
}
