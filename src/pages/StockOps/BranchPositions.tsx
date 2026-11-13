import { useCallback, useEffect, useMemo, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import Modal from "../../components/ui/Modal";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import Loader from "../../components/ui/Loader";
import Alert from "../../components/ui/alert/Alert";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../components/ui/table";
import { useAuth } from "../../context/AuthContext";
import BranchScopeBadge from "./BranchScopeBadge";
import { useBranchScope } from "./useBranchScope";
import {
  BranchStockPositionDto,
  StockPositionsDto,
  StockLocationDto,
  PurchaseLite,
  getBranchPosition,
  getPositions,
  getLocations,
  getPurchases,
  receiveToLocation,
  errorMessage,
} from "../../services/stockOpsService";

type Notice = { variant: "success" | "error" | "warning" | "info"; title: string; message: string };
type View = "branch" | "all";

const th = "px-4 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400 whitespace-nowrap";
const td = "px-4 py-3 text-sm text-gray-700 dark:text-gray-300";
const select = "h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm dark:border-white/10 dark:bg-gray-900 dark:text-white/90";
const qty = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 3 });
const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function statusOf(err: unknown): number | undefined {
  return (err as { response?: { status?: number } })?.response?.status;
}

function LevelPill({ below }: { below: boolean }) {
  return below ? (
    <span className="rounded bg-red-50 px-2 py-0.5 text-xs text-red-700 dark:bg-red-500/15 dark:text-red-300">Below level</span>
  ) : (
    <span className="rounded bg-green-50 px-2 py-0.5 text-xs text-green-700 dark:bg-green-500/15 dark:text-green-300">OK</span>
  );
}

export default function BranchPositions() {
  const { hasAnyRole } = useAuth();
  const isAdmin = hasAnyRole("admin");
  const { branchId, branch } = useBranchScope();

  const [view, setView] = useState<View>(isAdmin ? "all" : "branch");
  const [position, setPosition] = useState<BranchStockPositionDto | null>(null);
  const [positions, setPositions] = useState<StockPositionsDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [search, setSearch] = useState("");
  const [onlyBelow, setOnlyBelow] = useState(false);

  // Receive-purchase dialog
  const [isReceiveOpen, setIsReceiveOpen] = useState(false);
  const [purchases, setPurchases] = useState<PurchaseLite[]>([]);
  const [locations, setLocations] = useState<StockLocationDto[]>([]);
  const [purchaseId, setPurchaseId] = useState<number | "">("");
  const [locationId, setLocationId] = useState<number | "">("");
  const [receiveNotes, setReceiveNotes] = useState("");
  const [dialogLoading, setDialogLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (view === "all") {
        try {
          setPositions(await getPositions());
          setPosition(null);
          return;
        } catch (err) {
          // Not an admin on the API side (403) => fall back to the single-branch view.
          if (statusOf(err) !== 403) throw err;
          setView("branch");
        }
      }
      setPosition(await getBranchPosition(null));
      setPositions(null);
    } catch (err) {
      const status = statusOf(err);
      setError(
        status === 404
          ? "Branch positions are not available on this server yet (endpoint missing)."
          : errorMessage(err, "Failed to load stock positions")
      );
    } finally {
      setLoading(false);
    }
  }, [view]);

  useEffect(() => {
    void load();
  }, [load, branchId]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  const filteredLines = useMemo(() => {
    const lines = position?.lines ?? [];
    const s = search.trim().toLowerCase();
    return lines.filter((l) => (!s || l.ingredientName.toLowerCase().includes(s)) && (!onlyBelow || l.belowLevel));
  }, [position, search, onlyBelow]);

  const filteredRows = useMemo(() => {
    const rows = positions?.rows ?? [];
    const s = search.trim().toLowerCase();
    return rows.filter((r) => (!s || r.ingredientName.toLowerCase().includes(s)) && (!onlyBelow || r.cells.some((c) => c.belowLevel)));
  }, [positions, search, onlyBelow]);

  async function openReceive() {
    setPurchaseId("");
    setLocationId("");
    setReceiveNotes("");
    setIsReceiveOpen(true);
    setDialogLoading(true);
    try {
      const [p, l] = await Promise.all([
        getPurchases({ page: 1, pageSize: 50 }).catch(() => ({ data: [] as PurchaseLite[], totalCount: 0, pageNumber: 1, pageSize: 50 })),
        getLocations().catch(() => [] as StockLocationDto[]),
      ]);
      setPurchases(p.data ?? []);
      // Purchases already sit at the global default; offer every other active location.
      const targets = l.filter((x) => x.isActive && !(x.isDefault && x.branchId == null));
      setLocations(targets);
      const preferred = targets.find((x) => x.isDefault && x.branchId === (branchId ?? -1)) ?? targets.find((x) => x.isDefault);
      if (preferred) setLocationId(preferred.id);
    } finally {
      setDialogLoading(false);
    }
  }

  async function submitReceive() {
    if (purchaseId === "" || locationId === "") {
      setNotice({ variant: "warning", title: "Missing fields", message: "Pick a purchase and a destination location." });
      return;
    }
    setSubmitting(true);
    try {
      const r = await receiveToLocation(Number(purchaseId), Number(locationId), receiveNotes);
      if (!r.success) {
        setNotice({ variant: "error", title: "Not received", message: r.error || r.message || "Request failed" });
        return;
      }
      const d = r.data;
      setNotice(
        d?.alreadyReceived
          ? { variant: "info", title: "Already received", message: r.message }
          : { variant: "success", title: "Received", message: `${r.message} Transfer ${d?.transfer.reference ?? ""} posted.` }
      );
      setIsReceiveOpen(false);
      await load();
    } catch (err) {
      setNotice({ variant: "error", title: "Error", message: errorMessage(err, "Failed to receive purchase") });
    } finally {
      setSubmitting(false);
    }
  }

  const purchaseLabel = (p: PurchaseLite) =>
    `#${p.id} · ${p.purchaseDate?.slice(0, 10) ?? ""}${p.invoiceNumber ? ` · ${p.invoiceNumber}` : ""}${p.supplierName ? ` · ${p.supplierName}` : ""} · ${p.lines?.length ?? 0} line(s) · ${money(p.totalCost ?? 0)}`;

  return (
    <div className="p-6">
      <PageMeta title="Branch Stock Positions | Axis" description="What every branch holds, against its reorder levels" />
      <PageBreadcrumb pageTitle="Branch Positions" />
      <BranchScopeBadge note={view === "all" ? "All branches side by side; the first column is the shared Main store." : undefined} />

      {notice && (
        <div className="mb-4">
          <Alert variant={notice.variant} title={notice.title} message={notice.message} />
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {isAdmin && (
            <div className="inline-flex rounded-lg border border-gray-200 p-0.5 dark:border-gray-700">
              {(["all", "branch"] as View[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={`rounded-md px-3 py-1.5 text-sm ${view === v ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5"}`}
                >
                  {v === "all" ? "All branches" : branch ? branch.name : "Selected branch"}
                </button>
              ))}
            </div>
          )}
          <div className="w-56">
            <Input placeholder="Search ingredients..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <input type="checkbox" checked={onlyBelow} onChange={(e) => setOnlyBelow(e.target.checked)} />
            Only below level
          </label>
        </div>
        <button className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition" onClick={() => void openReceive()}>
          Receive purchase to location
        </button>
      </div>

      {loading && <div className="flex justify-center py-10"><Loader /></div>}
      {error && <div className="text-red-600 bg-red-50 p-3 rounded mb-4 dark:bg-red-500/10 dark:text-red-300">{error}</div>}

      {/* ── Single branch ── */}
      {!loading && !error && position && (
        <>
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
              <div className="text-xs text-gray-400">Scope</div>
              <div className="font-semibold text-gray-800 dark:text-white/90">{position.branchName} <span className="font-mono text-xs text-gray-400">{position.branchCode}</span></div>
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Default: {position.defaultLocationName}
                {position.otherLocations.length > 0 && <> · Others: {position.otherLocations.map((l) => l.name).join(", ")}</>}
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
              <div className="text-xs text-gray-400">Stock value (at buy price)</div>
              <div className="text-2xl font-semibold text-gray-900 dark:text-white">{money(position.totalValue)}</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
              <div className="text-xs text-gray-400">Below reorder level</div>
              <div className={`text-2xl font-semibold ${position.belowLevelCount > 0 ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-white"}`}>{position.belowLevelCount}</div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03] text-gray-800 dark:text-white/90">
            <div className="max-w-full overflow-x-auto">
              <Table>
                <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                  <TableRow>
                    <TableCell isHeader className={th}>Ingredient</TableCell>
                    <TableCell isHeader className={`${th} text-end`}>At {position.defaultLocationName}</TableCell>
                    <TableCell isHeader className={`${th} text-end`}>Other locations</TableCell>
                    <TableCell isHeader className={`${th} text-end`}>Total</TableCell>
                    <TableCell isHeader className={`${th} text-end`}>Reorder level</TableCell>
                    <TableCell isHeader className={th}>Status</TableCell>
                    <TableCell isHeader className={`${th} text-end`}>Unit cost</TableCell>
                    <TableCell isHeader className={`${th} text-end`}>Value</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                  {filteredLines.length === 0 && (
                    <TableRow>
                      <TableCell className={`${td} text-center`}>No ingredients match.</TableCell>
                    </TableRow>
                  )}
                  {filteredLines.map((l) => (
                    <TableRow key={l.ingredientId} className={l.belowLevel ? "bg-red-50/40 dark:bg-red-500/5" : ""}>
                      <TableCell className={`${td} font-medium text-gray-800 dark:text-white/90`}>{l.ingredientName} <span className="text-xs text-gray-400">{l.unit}</span></TableCell>
                      <TableCell className={`${td} text-end tabular-nums`}>{qty(l.defaultQty)}</TableCell>
                      <TableCell className={`${td} text-end tabular-nums`}>{qty(l.otherQty)}</TableCell>
                      <TableCell className={`${td} text-end tabular-nums font-semibold`}>{qty(l.totalQty)}</TableCell>
                      <TableCell className={`${td} text-end tabular-nums`}>{l.reorderLevel != null ? qty(l.reorderLevel) : "—"}</TableCell>
                      <TableCell className={td}><LevelPill below={l.belowLevel} /></TableCell>
                      <TableCell className={`${td} text-end tabular-nums`}>{l.unitCost != null ? money(l.unitCost) : "—"}</TableCell>
                      <TableCell className={`${td} text-end tabular-nums`}>{money(l.value)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}

      {/* ── All branches ── */}
      {!loading && !error && positions && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03] text-gray-800 dark:text-white/90">
          <div className="max-w-full overflow-x-auto">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <TableCell isHeader className={th}>Ingredient</TableCell>
                  <TableCell isHeader className={`${th} text-end`}>Level</TableCell>
                  {positions.columns.map((c) => (
                    <TableCell key={c.branchId ?? "shared"} isHeader className={`${th} text-end`}>
                      <div>{c.name}</div>
                      <div className="font-normal text-[11px] text-gray-400">{c.defaultLocationName} · {c.belowLevelCount} low</div>
                    </TableCell>
                  ))}
                  <TableCell isHeader className={`${th} text-end`}>Total</TableCell>
                  <TableCell isHeader className={`${th} text-end`}>Value</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {filteredRows.length === 0 && (
                  <TableRow>
                    <TableCell className={`${td} text-center`}>No ingredients match.</TableCell>
                  </TableRow>
                )}
                {filteredRows.map((r) => (
                  <TableRow key={r.ingredientId}>
                    <TableCell className={`${td} font-medium text-gray-800 dark:text-white/90`}>{r.ingredientName} <span className="text-xs text-gray-400">{r.unit}</span></TableCell>
                    <TableCell className={`${td} text-end tabular-nums`}>{r.reorderLevel != null ? qty(r.reorderLevel) : "—"}</TableCell>
                    {r.cells.map((c) => (
                      <TableCell
                        key={c.branchId ?? "shared"}
                        className={`${td} text-end tabular-nums ${c.belowLevel ? "text-red-600 dark:text-red-400 font-semibold" : ""}`}
                      >
                        <span title={c.belowLevel ? "At or below reorder level" : undefined}>{qty(c.qty)}</span>
                      </TableCell>
                    ))}
                    <TableCell className={`${td} text-end tabular-nums font-semibold`}>{qty(r.totalQty)}</TableCell>
                    <TableCell className={`${td} text-end tabular-nums`}>{money(r.totalValue)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-gray-50 dark:bg-white/[0.02]">
                  <TableCell className={`${td} font-semibold`}>Value at buy price</TableCell>
                  <TableCell className={td}>{""}</TableCell>
                  {positions.columns.map((c) => (
                    <TableCell key={c.branchId ?? "shared"} className={`${td} text-end tabular-nums font-semibold`}>{money(c.totalValue)}</TableCell>
                  ))}
                  <TableCell className={td}>{""}</TableCell>
                  <TableCell className={`${td} text-end tabular-nums font-semibold`}>{money(positions.totalValue)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <p className="mt-3 text-xs text-gray-400">
        Branch stock moves through transfers: Main → "Main – CODE" sends stock to a branch; "Receive purchase to location" posts such a transfer (PO-#) for a whole purchase, once per purchase.
      </p>

      <Modal
        isOpen={isReceiveOpen}
        onClose={() => !submitting && setIsReceiveOpen(false)}
        title="Receive purchase to location"
        className="max-w-xl"
        footer={
          <>
            <button className="px-4 py-2 rounded border dark:border-white/10 text-gray-700 dark:text-gray-300" onClick={() => setIsReceiveOpen(false)} disabled={submitting}>Cancel</button>
            <button className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50" onClick={() => void submitReceive()} disabled={submitting || dialogLoading}>
              {submitting ? "Receiving..." : "Receive"}
            </button>
          </>
        }
      >
        {dialogLoading ? (
          <div className="flex justify-center py-6"><Loader /></div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Moves the purchased quantities from the main store to the chosen location by posting a stock transfer referenced <code>PO-&lt;purchase&gt;</code>. Running it twice for the same purchase does nothing more.
            </p>
            <div>
              <Label htmlFor="rcv-purchase">Purchase</Label>
              <select id="rcv-purchase" className={select} value={purchaseId} onChange={(e) => setPurchaseId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">Select a purchase...</option>
                {purchases.map((p) => (
                  <option key={p.id} value={p.id}>{purchaseLabel(p)}</option>
                ))}
              </select>
              {purchases.length === 0 && <p className="mt-1 text-xs text-gray-400">No purchases found. Create one on the Purchases page first.</p>}
            </div>
            <div>
              <Label htmlFor="rcv-location">Destination location</Label>
              <select id="rcv-location" className={select} value={locationId} onChange={(e) => setLocationId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">Select a location...</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name} ({l.code}){l.isDefault ? " · branch default" : ""}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="rcv-notes">Notes (optional)</Label>
              <Input id="rcv-notes" value={receiveNotes} onChange={(e) => setReceiveNotes(e.target.value)} placeholder="Delivered by van, morning run" />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
