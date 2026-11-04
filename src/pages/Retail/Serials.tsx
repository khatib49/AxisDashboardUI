import { useCallback, useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import Modal from "../../components/ui/Modal";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import Loader from "../../components/ui/Loader";
import Alert from "../../components/ui/alert/Alert";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../components/ui/table";
import { getItems, ItemDto } from "../../services/itemService";
import {
    SerialNumberDto, SerialSettingDto, SerialStatus, SerialSummaryDto, ItemVariantLite,
    getSerialSetting, setSerialSetting, listSerials, receiveSerials, returnSerial, markSerialFaulty, restockSerial,
    getSerialSummary, getItemVariants,
} from "../../services/retailService";

type Notice = { variant: "success" | "error" | "warning" | "info"; title: string; message: string };
const STATUSES: SerialStatus[] = ["InStock", "Sold", "Returned", "Faulty"];
const statusClass: Record<SerialStatus, string> = {
    InStock: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400",
    Sold: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
    Returned: "bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-300",
    Faulty: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
};

/** Admin: serial numbers — per-item setting, receive, list, return / faulty / restock, summary. */
export default function RetailSerials() {
    const [items, setItems] = useState<ItemDto[]>([]);
    const [search, setSearch] = useState("");
    const [debounced, setDebounced] = useState("");
    const [itemId, setItemId] = useState<number | null>(null);
    const [setting, setSetting] = useState<SerialSettingDto | null>(null);
    const [variants, setVariants] = useState<ItemVariantLite[]>([]);
    const [serials, setSerials] = useState<SerialNumberDto[]>([]);
    const [summary, setSummary] = useState<SerialSummaryDto[]>([]);
    const [statusFilter, setStatusFilter] = useState<SerialStatus | "">("");
    const [serialSearch, setSerialSearch] = useState("");
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [notice, setNotice] = useState<Notice | null>(null);

    const [settingForm, setSettingForm] = useState({ requiresSerial: false, prefix: "" });
    const [receiveOpen, setReceiveOpen] = useState(false);
    const [receive, setReceive] = useState<{ mode: "list" | "count"; list: string; count: number; variantId: number | null; notes: string }>({ mode: "list", list: "", count: 1, variantId: null, notes: "" });
    const [noteTarget, setNoteTarget] = useState<{ row: SerialNumberDto; action: "return" | "faulty" | "restock" } | null>(null);
    const [noteText, setNoteText] = useState("");

    useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(null), 3500); return () => clearTimeout(t); }, [notice]);
    useEffect(() => { const t = setTimeout(() => setDebounced(search), 300); return () => clearTimeout(t); }, [search]);

    useEffect(() => {
        let mounted = true;
        getItems(1, 100, null, debounced || null)
            .then((res) => { if (mounted) setItems(res.data || []); })
            .catch(() => { /* list stays */ });
        return () => { mounted = false; };
    }, [debounced]);

    const describeError = (err: unknown, fallback: string) => {
        const st = (err as { response?: { status?: number } })?.response?.status;
        return st === 404 ? "Serial endpoints are not live on this server yet." : st === 403 ? "You are not allowed to view serial numbers." : fallback;
    };

    const loadSummary = useCallback(async () => {
        try { setSummary(await getSerialSummary(null)); }
        catch (err) { setLoadError(describeError(err, "Could not load the serial summary.")); }
    }, []);
    useEffect(() => { loadSummary(); }, [loadSummary]);

    const loadItem = useCallback(async (id: number) => {
        setLoading(true);
        setLoadError(null);
        try {
            const [s, rows, vs] = await Promise.all([
                getSerialSetting(id),
                listSerials({ itemId: id, status: statusFilter || null, search: serialSearch || null }),
                getItemVariants(id),
            ]);
            setSetting(s);
            setSettingForm({ requiresSerial: s?.requiresSerial ?? false, prefix: s?.prefix ?? "" });
            setSerials(rows);
            setVariants(vs);
        } catch (err) {
            setLoadError(describeError(err, "Could not load serial numbers."));
            setSerials([]);
        } finally {
            setLoading(false);
        }
    }, [statusFilter, serialSearch]);

    useEffect(() => { if (itemId != null) loadItem(itemId); }, [itemId, loadItem]);

    async function act<T>(key: string, fn: () => Promise<{ success: boolean; message: string; error: string | null; data: T | null }>, okTitle: string) {
        setBusy(key);
        try {
            const r = await fn();
            setNotice(r.success ? { variant: "success", title: okTitle, message: r.message } : { variant: "error", title: "Failed", message: r.error || r.message });
            if (r.success) { if (itemId != null) await loadItem(itemId); await loadSummary(); }
            return r;
        } finally {
            setBusy(null);
        }
    }

    const selectedItem = items.find((i) => Number(i.id) === itemId);

    return (
        <div className="p-6">
            <PageMeta title="Serial numbers | Axis" description="Serial-tracked stock" />
            <PageBreadcrumb pageTitle="Serial numbers" />

            {/* Summary */}
            <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                <div className="mb-2 flex items-center justify-between">
                    <h3 className="font-medium text-gray-800 dark:text-white/90">Stock-count summary</h3>
                    <span className="text-xs text-gray-500 dark:text-gray-400">Variance = serials in stock − item quantity</span>
                </div>
                {loadError && summary.length === 0 && <div className="rounded bg-red-50 p-2 text-sm text-red-600 dark:bg-red-500/10">{loadError}</div>}
                {summary.length === 0 && !loadError && <div className="text-sm text-gray-500 dark:text-gray-400">No serial-tracked items yet. Pick an item below and switch on "Requires serial".</div>}
                {summary.length > 0 && (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    {["Item", "Prefix", "In stock", "Sold", "Returned", "Faulty", "Item qty", "Variance"].map((h) => (
                                        <TableCell key={h} isHeader className="px-2 py-1 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">{h}</TableCell>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {summary.map((s) => (
                                    <TableRow key={s.itemId} className="border-t border-gray-100 dark:border-gray-700/60">
                                        <TableCell className="px-2 py-1 text-sm">
                                            <button type="button" onClick={() => setItemId(s.itemId)} className="text-indigo-600 hover:underline dark:text-indigo-400">{s.itemName}</button>
                                            {!s.requiresSerial && <span className="ml-2 text-xs text-gray-400">(not required)</span>}
                                        </TableCell>
                                        <TableCell className="px-2 py-1 text-sm text-gray-700 dark:text-gray-300">{s.prefix || "SN"}</TableCell>
                                        <TableCell className="px-2 py-1 text-sm text-gray-800 dark:text-white/90">{s.inStock}</TableCell>
                                        <TableCell className="px-2 py-1 text-sm text-gray-800 dark:text-white/90">{s.sold}</TableCell>
                                        <TableCell className="px-2 py-1 text-sm text-gray-800 dark:text-white/90">{s.returned}</TableCell>
                                        <TableCell className="px-2 py-1 text-sm text-gray-800 dark:text-white/90">{s.faulty}</TableCell>
                                        <TableCell className="px-2 py-1 text-sm text-gray-800 dark:text-white/90">{s.itemQuantity}</TableCell>
                                        <TableCell className={`px-2 py-1 text-sm font-medium ${s.variance === 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>{s.variance > 0 ? `+${s.variance}` : s.variance}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                {/* Item picker */}
                <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
                    <Label>Item</Label>
                    <Input placeholder="Search items…" value={search} onChange={(e) => setSearch(e.target.value)} />
                    <div className="mt-2 max-h-96 overflow-y-auto">
                        {items.length === 0 && <div className="p-2 text-sm text-gray-500 dark:text-gray-400">No items.</div>}
                        {items.map((it) => (
                            <button key={it.id} type="button" onClick={() => setItemId(Number(it.id))}
                                className={`block w-full rounded px-2 py-1.5 text-left text-sm ${Number(it.id) === itemId ? "bg-indigo-600 text-white" : "text-gray-800 hover:bg-gray-100 dark:text-white/90 dark:hover:bg-white/5"}`}>
                                {it.name} <span className={`text-xs ${Number(it.id) === itemId ? "text-indigo-100" : "text-gray-400"}`}>#{it.id}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Detail */}
                <div className="lg:col-span-3 space-y-4">
                    {itemId == null && (
                        <div className="rounded border border-dashed border-gray-300 p-8 text-center text-gray-500 dark:border-gray-700 dark:text-gray-400">Pick an item to manage its serial numbers.</div>
                    )}
                    {itemId != null && (
                        <>
                            <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                                <div className="flex flex-wrap items-end justify-between gap-3">
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">{setting?.itemName || selectedItem?.name || `Item #${itemId}`}</h3>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                            {setting?.modifiedOn ? `Setting changed ${new Date(setting.modifiedOn).toLocaleString()} by ${setting.modifiedBy}` : "No serial setting yet"}
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-end gap-3">
                                        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                            <input type="checkbox" checked={settingForm.requiresSerial} onChange={(e) => setSettingForm((f) => ({ ...f, requiresSerial: e.target.checked }))} />
                                            Requires serial at the till
                                        </label>
                                        <div className="w-32">
                                            <Label>Prefix</Label>
                                            <Input placeholder="SN" value={settingForm.prefix} onChange={(e) => setSettingForm((f) => ({ ...f, prefix: e.target.value }))} className="h-9" />
                                        </div>
                                        <button type="button" disabled={busy === "setting"} onClick={() => act("setting", () => setSerialSetting(itemId, { requiresSerial: settingForm.requiresSerial, prefix: settingForm.prefix || null }), "Saved")}
                                            className="h-9 rounded-lg bg-indigo-600 px-3 text-sm text-white hover:bg-indigo-700 disabled:opacity-50">Save</button>
                                        <button type="button" onClick={() => { setReceive({ mode: "list", list: "", count: 1, variantId: null, notes: "" }); setReceiveOpen(true); }}
                                            className="h-9 rounded-lg bg-green-600 px-3 text-sm text-white hover:bg-green-700">Receive</button>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                                <div className="mb-3 flex flex-wrap items-center gap-2">
                                    <button type="button" onClick={() => setStatusFilter("")} className={`rounded px-3 py-1 text-sm ${statusFilter === "" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300"}`}>All</button>
                                    {STATUSES.map((s) => (
                                        <button key={s} type="button" onClick={() => setStatusFilter(s)} className={`rounded px-3 py-1 text-sm ${statusFilter === s ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300"}`}>{s}</button>
                                    ))}
                                    <div className="ml-auto w-56">
                                        <Input placeholder="Find serial…" value={serialSearch} onChange={(e) => setSerialSearch(e.target.value)} className="h-9" />
                                    </div>
                                </div>
                                {loading && <div className="flex justify-center py-6"><Loader /></div>}
                                {loadError && <div className="rounded bg-red-50 p-2 text-sm text-red-600 dark:bg-red-500/10">{loadError}</div>}
                                {!loading && !loadError && serials.length === 0 && <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">No serial numbers{statusFilter ? ` with status ${statusFilter}` : ""}.</div>}
                                {!loading && serials.length > 0 && (
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    {["Serial", "Option", "Status", "Invoice", "Received", "Sold / returned", "Notes", ""].map((h, i) => (
                                                        <TableCell key={i} isHeader className="px-2 py-1 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">{h}</TableCell>
                                                    ))}
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {serials.map((s) => (
                                                    <TableRow key={s.id} className="border-t border-gray-100 dark:border-gray-700/60">
                                                        <TableCell className="px-2 py-1.5 font-mono text-sm text-gray-800 dark:text-white/90">{s.serial}</TableCell>
                                                        <TableCell className="px-2 py-1.5 text-sm text-gray-700 dark:text-gray-300">{s.variantName || "—"}</TableCell>
                                                        <TableCell className="px-2 py-1.5"><span className={`rounded px-2 py-0.5 text-xs font-medium ${statusClass[s.status] || ""}`}>{s.status}</span></TableCell>
                                                        <TableCell className="px-2 py-1.5 text-sm text-gray-700 dark:text-gray-300">{s.transactionId ? `#${s.transactionId}` : "—"}</TableCell>
                                                        <TableCell className="px-2 py-1.5 text-xs text-gray-600 dark:text-gray-400">{new Date(s.receivedOn).toLocaleDateString()}</TableCell>
                                                        <TableCell className="px-2 py-1.5 text-xs text-gray-600 dark:text-gray-400">
                                                            {s.soldOn ? `sold ${new Date(s.soldOn).toLocaleDateString()}` : ""}{s.returnedOn ? ` · ret ${new Date(s.returnedOn).toLocaleDateString()}` : ""}
                                                        </TableCell>
                                                        <TableCell className="max-w-[12rem] truncate px-2 py-1.5 text-xs text-gray-600 dark:text-gray-400" >{s.notes || ""}</TableCell>
                                                        <TableCell className="px-2 py-1.5 text-right">
                                                            <div className="flex justify-end gap-1">
                                                                {s.status === "Sold" && <button type="button" onClick={() => { setNoteTarget({ row: s, action: "return" }); setNoteText(""); }} className="rounded border border-yellow-400 px-2 py-0.5 text-xs text-yellow-700 hover:bg-yellow-50 dark:text-yellow-300 dark:hover:bg-white/5">Return</button>}
                                                                {(s.status === "InStock" || s.status === "Returned") && <button type="button" onClick={() => { setNoteTarget({ row: s, action: "faulty" }); setNoteText(""); }} className="rounded border border-red-400 px-2 py-0.5 text-xs text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-white/5">Faulty</button>}
                                                                {(s.status === "Returned" || s.status === "Faulty") && <button type="button" onClick={() => { setNoteTarget({ row: s, action: "restock" }); setNoteText(""); }} className="rounded border border-green-400 px-2 py-0.5 text-xs text-green-700 hover:bg-green-50 dark:text-green-300 dark:hover:bg-white/5">Restock</button>}
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Receive dialog */}
            <Modal isOpen={receiveOpen} onClose={() => setReceiveOpen(false)} title="Receive serial numbers" className="max-w-lg">
                <div className="space-y-3">
                    <div className="flex gap-2">
                        <button type="button" onClick={() => setReceive((r) => ({ ...r, mode: "list" }))} className={`rounded px-3 py-1 text-sm ${receive.mode === "list" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300"}`}>Scan / paste list</button>
                        <button type="button" onClick={() => setReceive((r) => ({ ...r, mode: "count" }))} className={`rounded px-3 py-1 text-sm ${receive.mode === "count" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300"}`}>Generate with prefix</button>
                    </div>
                    {receive.mode === "list" ? (
                        <div>
                            <Label>Serials (one per line — scan them one after another)</Label>
                            <textarea rows={6} value={receive.list} onChange={(e) => setReceive((r) => ({ ...r, list: e.target.value }))} placeholder={"ABC-0001\nABC-0002"}
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white/90" />
                        </div>
                    ) : (
                        <div>
                            <Label>How many ({settingForm.prefix || setting?.prefix || "SN"}-{String(itemId ?? 0).padStart(4, "0")}-…)</Label>
                            <Input type="number" min="1" max="500" value={receive.count} onChange={(e) => setReceive((r) => ({ ...r, count: Math.max(1, Number(e.target.value) || 1) }))} />
                        </div>
                    )}
                    {variants.length > 0 && (
                        <div>
                            <Label>Option (variant)</Label>
                            <select value={receive.variantId ?? ""} onChange={(e) => setReceive((r) => ({ ...r, variantId: e.target.value === "" ? null : Number(e.target.value) }))}
                                className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white/90">
                                <option value="">Not specified</option>
                                {variants.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                            </select>
                        </div>
                    )}
                    <div>
                        <Label>Notes (supplier, box…)</Label>
                        <Input value={receive.notes} onChange={(e) => setReceive((r) => ({ ...r, notes: e.target.value }))} />
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                        <button type="button" onClick={() => setReceiveOpen(false)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-300">Cancel</button>
                        <button type="button" disabled={busy === "receive" || (receive.mode === "list" && !receive.list.trim())}
                            onClick={async () => {
                                if (itemId == null) return;
                                const r = await act("receive", () => receiveSerials({
                                    itemId, variantId: receive.variantId, notes: receive.notes || null,
                                    serials: receive.mode === "list" ? receive.list.split(/\r?\n|,|;/).map((s) => s.trim()).filter(Boolean) : null,
                                    count: receive.mode === "count" ? receive.count : null,
                                }), "Received");
                                if (r.success) setReceiveOpen(false);
                            }}
                            className="rounded-lg bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700 disabled:opacity-50">
                            {busy === "receive" ? <Loader size={14} /> : "Receive"}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Status change note */}
            <Modal isOpen={!!noteTarget} onClose={() => setNoteTarget(null)} title={noteTarget ? `${noteTarget.action === "return" ? "Return" : noteTarget.action === "faulty" ? "Mark faulty" : "Restock"} — ${noteTarget.row.serial}` : ""} className="max-w-md">
                <div className="space-y-3">
                    <div>
                        <Label>Note (optional)</Label>
                        <Input value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Reason…" />
                    </div>
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setNoteTarget(null)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-300">Cancel</button>
                        <button type="button" disabled={!!busy}
                            onClick={async () => {
                                const t = noteTarget; if (!t) return;
                                setNoteTarget(null);
                                const fn = t.action === "return" ? returnSerial : t.action === "faulty" ? markSerialFaulty : restockSerial;
                                await act(`s${t.row.id}`, () => fn(t.row.id, noteText || null), "Updated");
                            }}
                            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50">Confirm</button>
                    </div>
                </div>
            </Modal>

            <div className="fixed bottom-6 right-6 z-50">
                {notice && <div className="max-w-sm"><Alert variant={notice.variant} title={notice.title} message={notice.message} /></div>}
            </div>
        </div>
    );
}
