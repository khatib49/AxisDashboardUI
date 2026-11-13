import { useCallback, useEffect, useMemo, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import BranchScopeBadge from "./BranchScopeBadge";
import { useBranchScope } from "./useBranchScope";
import Modal from "../../components/ui/Modal";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import Loader from "../../components/ui/Loader";
import Alert from "../../components/ui/alert/Alert";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../components/ui/table";
import {
  StockCountSummaryDto,
  StockCountDto,
  StockCountLineDto,
  StockCountVarianceReportDto,
  StockLocationDto,
  getStockCounts,
  getStockCount,
  createStockCount,
  updateStockCountLines,
  postStockCount,
  cancelStockCount,
  getStockCountVariance,
  getLocations,
  errorMessage,
} from "../../services/stockOpsService";

type Notice = { variant: "success" | "error" | "warning" | "info"; title: string; message: string };

const th = "px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400";
const td = "px-5 py-3 text-sm text-gray-700 dark:text-gray-300";
const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

export default function StockCounts() {
  const { branchId } = useBranchScope();
  const [counts, setCounts] = useState<StockCountSummaryDto[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [locations, setLocations] = useState<StockLocationDto[]>([]);

  // New sheet
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [newLocationId, setNewLocationId] = useState<number | "">("");
  const [newNotes, setNewNotes] = useState("");
  const [creating, setCreating] = useState(false);

  // Sheet editor
  const [sheet, setSheet] = useState<StockCountDto | null>(null);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [draftCounts, setDraftCounts] = useState<Record<number, string>>({});
  const [search, setSearch] = useState("");
  const [onlyUncounted, setOnlyUncounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [posting, setPosting] = useState(false);

  // Variance report
  const [report, setReport] = useState<StockCountVarianceReportDto | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getStockCounts({ status: statusFilter || undefined, page, pageSize });
      setCounts(res.data ?? []);
      setTotalCount(res.totalCount ?? 0);
    } catch (err) {
      setError(errorMessage(err, "Failed to load stocktakes"));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => {
    load();
    // Re-run when the header BranchSwitcher changes the X-Branch-Id scope.
  }, [load, branchId]);

  useEffect(() => {
    getLocations()
      .then((ls) => {
        setLocations(ls);
        const def = ls.find((l) => l.isDefault);
        if (def) setNewLocationId(def.id);
      })
      .catch(() => setLocations([]));
    // Locations are branch-scoped: refetch when the header BranchSwitcher changes.
  }, [branchId]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(t);
  }, [notice]);

  function hydrate(dto: StockCountDto) {
    setSheet(dto);
    const d: Record<number, string> = {};
    for (const l of dto.lines) d[l.id] = l.countedQty == null ? "" : String(l.countedQty);
    setDraftCounts(d);
  }

  async function openSheet(id: number) {
    setSheetLoading(true);
    setSearch("");
    setOnlyUncounted(false);
    try {
      hydrate(await getStockCount(id));
    } catch (err) {
      setNotice({ variant: "error", title: "Error", message: errorMessage(err, "Failed to open stocktake") });
    } finally {
      setSheetLoading(false);
    }
  }

  async function createSheet() {
    setCreating(true);
    try {
      const dto = await createStockCount(newLocationId === "" ? null : Number(newLocationId), newNotes);
      setIsNewOpen(false);
      setNewNotes("");
      setNotice({ variant: "success", title: "Created", message: `Stocktake ${dto.reference} created with ${dto.lines.length} lines.` });
      await load();
      hydrate(dto);
    } catch (err) {
      setNotice({ variant: "error", title: "Error", message: errorMessage(err, "Failed to create stocktake") });
    } finally {
      setCreating(false);
    }
  }

  const changedLines = useMemo(() => {
    if (!sheet) return [];
    return sheet.lines
      .filter((l) => {
        const raw = draftCounts[l.id] ?? "";
        const current = l.countedQty == null ? "" : String(l.countedQty);
        return raw !== current;
      })
      .map((l) => {
        const raw = (draftCounts[l.id] ?? "").trim();
        return { lineId: l.id, countedQty: raw === "" ? null : Number(raw) };
      })
      .filter((c) => c.countedQty === null || !Number.isNaN(c.countedQty));
  }, [sheet, draftCounts]);

  async function saveCounts(): Promise<StockCountDto | null> {
    if (!sheet) return null;
    if (changedLines.length === 0) return sheet;
    setSaving(true);
    try {
      const dto = await updateStockCountLines(sheet.id, changedLines);
      hydrate(dto);
      setNotice({ variant: "success", title: "Saved", message: `${changedLines.length} line(s) saved.` });
      return dto;
    } catch (err) {
      setNotice({ variant: "error", title: "Error", message: errorMessage(err, "Failed to save counts") });
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function post() {
    if (!sheet) return;
    const saved = await saveCounts();
    if (!saved) return;
    const counted = saved.lines.filter((l) => l.countedQty != null).length;
    if (counted === 0) {
      setNotice({ variant: "warning", title: "Nothing counted", message: "Enter at least one counted quantity before posting." });
      return;
    }
    if (!window.confirm(`Post ${saved.reference}? ${counted} counted line(s) will adjust stock; uncounted lines are left untouched.`)) return;
    setPosting(true);
    try {
      const dto = await postStockCount(saved.id);
      hydrate(dto);
      setNotice({ variant: "success", title: "Posted", message: `${dto.reference} posted.` });
      await load();
    } catch (err) {
      setNotice({ variant: "error", title: "Error", message: errorMessage(err, "Failed to post stocktake") });
    } finally {
      setPosting(false);
    }
  }

  async function cancel(id: number, reference: string) {
    if (!window.confirm(`Cancel stocktake ${reference}?`)) return;
    try {
      await cancelStockCount(id);
      setNotice({ variant: "success", title: "Cancelled", message: `${reference} cancelled.` });
      if (sheet?.id === id) setSheet(null);
      await load();
    } catch (err) {
      setNotice({ variant: "error", title: "Error", message: errorMessage(err, "Failed to cancel") });
    }
  }

  async function openReport(id: number) {
    setReportLoading(true);
    try {
      setReport(await getStockCountVariance(id, 15));
    } catch (err) {
      setNotice({ variant: "error", title: "Error", message: errorMessage(err, "Failed to load variance") });
    } finally {
      setReportLoading(false);
    }
  }

  // Live variance preview for the open sheet.
  const preview = useMemo(() => {
    if (!sheet) return null;
    const isDraft = sheet.status === "Draft";
    const rows = sheet.lines.map((l) => {
      const raw = (draftCounts[l.id] ?? "").trim();
      const counted = isDraft ? (raw === "" ? null : Number(raw)) : l.countedQty ?? null;
      const variance = counted == null || Number.isNaN(counted) ? null : isDraft ? counted - l.expectedQty : l.variance;
      const unitCost = l.unitCost ?? null;
      const value = variance == null ? null : isDraft ? (unitCost == null ? null : variance * unitCost) : l.varianceValue;
      return { line: l, counted, variance, value };
    });
    const s = search.trim().toLowerCase();
    const visible = rows.filter((r) => (!s || r.line.ingredientName.toLowerCase().includes(s)) && (!onlyUncounted || r.counted == null));
    const countedRows = rows.filter((r) => r.variance != null);
    const shrink = countedRows.filter((r) => (r.value ?? 0) < 0).reduce((a, r) => a + (r.value ?? 0), 0);
    const surplus = countedRows.filter((r) => (r.value ?? 0) > 0).reduce((a, r) => a + (r.value ?? 0), 0);
    return { visible, counted: countedRows.length, withVariance: countedRows.filter((r) => r.variance !== 0).length, shrink: -shrink, surplus };
  }, [sheet, draftCounts, search, onlyUncounted]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="p-6">
      <PageMeta title="Stocktakes | Axis" description="Count stock and post variances" />
      <PageBreadcrumb pageTitle="Stocktakes" />
      <BranchScopeBadge note={"Showing stocktakes at this branch's locations plus the shared ones. A new stocktake without a location counts the branch default."} />

      {notice && (
        <div className="mb-4">
          <Alert variant={notice.variant} title={notice.title} message={notice.message} />
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <select
          className="h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm dark:border-white/10 dark:bg-gray-900 dark:text-white/90"
          value={statusFilter}
          onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}
        >
          <option value="">All statuses</option>
          <option value="Draft">Draft</option>
          <option value="Posted">Posted</option>
          <option value="Cancelled">Cancelled</option>
        </select>
        <button className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition" onClick={() => setIsNewOpen(true)}>
          + New Stocktake
        </button>
      </div>

      {loading && <div className="flex justify-center py-10"><Loader /></div>}
      {error && <div className="text-red-600 bg-red-50 p-3 rounded mb-4">{error}</div>}

      {!loading && !error && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03] text-gray-800 dark:text-white/90">
          <div className="max-w-full overflow-x-auto">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <TableCell isHeader className={th}>Reference</TableCell>
                  <TableCell isHeader className={th}>Location</TableCell>
                  <TableCell isHeader className={th}>Status</TableCell>
                  <TableCell isHeader className={th}>Progress</TableCell>
                  <TableCell isHeader className={th}>Created</TableCell>
                  <TableCell isHeader className={th}>Posted</TableCell>
                  <TableCell isHeader className={th}>Actions</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {counts.length === 0 && (
                  <TableRow>
                    <TableCell className={`${td} text-center`}>No stocktakes yet. Create one to start counting.</TableCell>
                  </TableRow>
                )}
                {counts.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className={`${td} font-medium text-gray-800 dark:text-white/90`}>{c.reference}</TableCell>
                    <TableCell className={td}>{c.locationName}</TableCell>
                    <TableCell className={td}><StatusPill status={c.status} /></TableCell>
                    <TableCell className={td}>{c.countedLines}/{c.lineCount} counted</TableCell>
                    <TableCell className={td}>{new Date(c.createdOn).toLocaleString()}<div className="text-xs text-gray-400">{c.createdBy}</div></TableCell>
                    <TableCell className={td}>{c.postedOn ? new Date(c.postedOn).toLocaleString() : "—"}</TableCell>
                    <TableCell className={td}>
                      <div className="flex items-center gap-3">
                        <button className="text-blue-600 dark:text-blue-400 hover:underline" onClick={() => openSheet(c.id)}>{c.status === "Draft" ? "Count" : "View"}</button>
                        {c.status === "Posted" && <button className="text-blue-600 dark:text-blue-400 hover:underline" onClick={() => openReport(c.id)}>Variance</button>}
                        {c.status === "Draft" && <button className="text-red-600 hover:underline" onClick={() => cancel(c.id, c.reference)}>Cancel</button>}
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

      {/* New sheet */}
      <Modal
        isOpen={isNewOpen}
        onClose={() => setIsNewOpen(false)}
        title="New Stocktake"
        className="max-w-lg"
        footer={
          <>
            <button className="px-4 py-2 rounded border dark:border-white/10 text-gray-700 dark:text-gray-300" onClick={() => setIsNewOpen(false)} disabled={creating}>Cancel</button>
            <button className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50" onClick={createSheet} disabled={creating}>
              {creating ? "Creating..." : "Create sheet"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="sc-loc">Location</Label>
            <select
              id="sc-loc"
              className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm dark:border-white/10 dark:bg-gray-900 dark:text-white/90"
              value={newLocationId}
              onChange={(e) => setNewLocationId(e.target.value === "" ? "" : Number(e.target.value))}
            >
              <option value="">Default location</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}{l.isDefault ? " (default)" : ""}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="sc-notes">Notes</Label>
            <Input id="sc-notes" value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="Month-end count" />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Every active ingredient is added with its current system quantity as the expected amount.</p>
        </div>
      </Modal>

      {/* Sheet editor */}
      <Modal
        isOpen={!!sheet || sheetLoading}
        onClose={() => setSheet(null)}
        title={sheet ? `${sheet.reference} — ${sheet.locationName}` : "Loading..."}
        className="max-w-6xl"
        footer={
          sheet && sheet.status === "Draft" ? (
            <>
              <button className="px-4 py-2 rounded border dark:border-white/10 text-gray-700 dark:text-gray-300" onClick={() => setSheet(null)}>Close</button>
              <button className="px-4 py-2 rounded border border-blue-600 text-blue-600 dark:text-blue-400 disabled:opacity-50" onClick={saveCounts} disabled={saving || posting || changedLines.length === 0}>
                {saving ? "Saving..." : `Save counts${changedLines.length ? ` (${changedLines.length})` : ""}`}
              </button>
              <button className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50" onClick={post} disabled={saving || posting}>
                {posting ? "Posting..." : "Post stocktake"}
              </button>
            </>
          ) : (
            <button className="px-4 py-2 rounded border dark:border-white/10 text-gray-700 dark:text-gray-300" onClick={() => setSheet(null)}>Close</button>
          )
        }
      >
        {sheetLoading || !sheet || !preview ? (
          <div className="flex justify-center py-10"><Loader /></div>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <StatusPill status={sheet.status} />
              <div className="w-64">
                <Input placeholder="Search ingredient..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              {sheet.status === "Draft" && (
                <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <input type="checkbox" checked={onlyUncounted} onChange={(e) => setOnlyUncounted(e.target.checked)} />
                  Only uncounted
                </label>
              )}
              <div className="ml-auto flex gap-4 text-sm">
                <span className="text-gray-600 dark:text-gray-300">Counted: <b>{preview.counted}/{sheet.lines.length}</b></span>
                <span className="text-gray-600 dark:text-gray-300">With variance: <b>{preview.withVariance}</b></span>
                <span className="text-red-600">Shrink: <b>{money(preview.shrink)}</b></span>
                <span className="text-green-600">Surplus: <b>{money(preview.surplus)}</b></span>
              </div>
            </div>
            {sheet.notes && <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">{sheet.notes}</p>}
            <div className="max-h-[55vh] overflow-auto rounded-lg border border-gray-200 dark:border-white/[0.05]">
              <Table>
                <TableHeader className="sticky top-0 bg-white dark:bg-gray-800 text-gray-800 dark:text-white/90">
                  <TableRow>
                    <TableCell isHeader className={th}>Ingredient</TableCell>
                    <TableCell isHeader className={`${th} text-end`}>Expected</TableCell>
                    <TableCell isHeader className={`${th} text-end`}>Counted</TableCell>
                    <TableCell isHeader className={`${th} text-end`}>Variance</TableCell>
                    <TableCell isHeader className={`${th} text-end`}>Value</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                  {preview.visible.length === 0 && (
                    <TableRow><TableCell className={`${td} text-center`}>No lines match.</TableCell></TableRow>
                  )}
                  {preview.visible.map(({ line, variance, value }) => (
                    <TableRow key={line.id}>
                      <TableCell className={`${td} font-medium text-gray-800 dark:text-white/90`}>{line.ingredientName} <span className="text-xs text-gray-400">{line.unit}</span></TableCell>
                      <TableCell className={`${td} text-end tabular-nums`}>{qty(line.expectedQty)}</TableCell>
                      <TableCell className={`${td} text-end`}>
                        {sheet.status === "Draft" ? (
                          <input
                            type="number"
                            step={0.001}
                            min="0"
                            className="h-9 w-28 rounded border border-gray-300 px-2 text-end text-sm dark:border-white/10 dark:bg-gray-900 dark:text-white/90"
                            value={draftCounts[line.id] ?? ""}
                            onChange={(e) => setDraftCounts({ ...draftCounts, [line.id]: e.target.value })}
                          />
                        ) : (
                          <span className="tabular-nums">{line.countedQty == null ? "—" : qty(line.countedQty)}</span>
                        )}
                      </TableCell>
                      <TableCell className={`${td} text-end tabular-nums ${variance == null ? "" : variance < 0 ? "text-red-600" : variance > 0 ? "text-green-600" : ""}`}>
                        {variance == null ? "—" : (variance > 0 ? "+" : "") + qty(variance)}
                      </TableCell>
                      <TableCell className={`${td} text-end tabular-nums ${value == null ? "" : value < 0 ? "text-red-600" : value > 0 ? "text-green-600" : ""}`}>
                        {value == null ? "—" : money(value)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </Modal>

      {/* Variance report */}
      <Modal isOpen={!!report || reportLoading} onClose={() => setReport(null)} title={report ? `Variance — ${report.reference}` : "Loading..."} className="max-w-3xl">
        {reportLoading || !report ? (
          <div className="flex justify-center py-10"><Loader /></div>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Lines counted" value={String(report.linesCounted)} />
              <Stat label="With variance" value={String(report.linesWithVariance)} />
              <Stat label="Shrink value" value={money(report.totalShrinkValue)} tone="red" />
              <Stat label="Net variance" value={money(report.netVarianceValue)} tone={report.netVarianceValue < 0 ? "red" : "green"} />
            </div>
            <h4 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Top variances</h4>
            {report.topVariances.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No variances on this stocktake.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableCell isHeader className={th}>Ingredient</TableCell>
                    <TableCell isHeader className={`${th} text-end`}>Expected</TableCell>
                    <TableCell isHeader className={`${th} text-end`}>Counted</TableCell>
                    <TableCell isHeader className={`${th} text-end`}>Variance</TableCell>
                    <TableCell isHeader className={`${th} text-end`}>Value</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                  {report.topVariances.map((l: StockCountLineDto) => (
                    <TableRow key={l.id}>
                      <TableCell className={td}>{l.ingredientName}</TableCell>
                      <TableCell className={`${td} text-end tabular-nums`}>{qty(l.expectedQty)} {l.unit}</TableCell>
                      <TableCell className={`${td} text-end tabular-nums`}>{l.countedQty == null ? "—" : qty(l.countedQty)}</TableCell>
                      <TableCell className={`${td} text-end tabular-nums ${l.variance < 0 ? "text-red-600" : "text-green-600"}`}>{(l.variance > 0 ? "+" : "") + qty(l.variance)}</TableCell>
                      <TableCell className={`${td} text-end tabular-nums ${l.varianceValue < 0 ? "text-red-600" : "text-green-600"}`}>{money(l.varianceValue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "red" | "green" }) {
  const color = tone === "red" ? "text-red-600" : tone === "green" ? "text-green-600" : "text-gray-800 dark:text-white/90";
  return (
    <div className="rounded-lg border border-gray-200 p-3 dark:border-white/[0.05]">
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      <div className={`text-lg font-semibold ${color}`}>{value}</div>
    </div>
  );
}
