import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import Modal from "../../components/ui/Modal";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import Loader from "../../components/ui/Loader";
import Alert from "../../components/ui/alert/Alert";
import DeleteIconButton from "../../components/ui/DeleteIconButton";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../components/ui/table";
import { getItems, ItemDto } from "../../services/itemService";
import {
    BarcodeDto, SYMBOLOGIES, ItemVariantLite,
    listBarcodes, createBarcode, generateBarcode, setPrimaryBarcode, deleteBarcode, getItemVariants,
} from "../../services/retailService";
import { BarcodeSvg } from "./Labels";

type Notice = { variant: "success" | "error" | "warning" | "info"; title: string; message: string };

/** Admin: barcodes per item — list, add, generate in-house EAN-13, set primary, print labels. */
export default function RetailBarcodes() {
    const navigate = useNavigate();
    const [items, setItems] = useState<ItemDto[]>([]);
    const [loadingItems, setLoadingItems] = useState(false);
    const [search, setSearch] = useState("");
    const [debounced, setDebounced] = useState("");
    const [error, setError] = useState<string | null>(null);

    const [codesByItem, setCodesByItem] = useState<Record<number, BarcodeDto[]>>({});
    const [loadingCodes, setLoadingCodes] = useState(false);
    const [selected, setSelected] = useState<Record<number, boolean>>({});
    const [busy, setBusy] = useState<string | null>(null);

    const [formItem, setFormItem] = useState<ItemDto | null>(null);
    const [variants, setVariants] = useState<ItemVariantLite[]>([]);
    const [form, setForm] = useState<{ code: string; symbology: string; variantId: number | null; isPrimary: boolean }>({ code: "", symbology: "CODE128", variantId: null, isPrimary: false });
    const [saving, setSaving] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<BarcodeDto | null>(null);
    const [notice, setNotice] = useState<Notice | null>(null);

    useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(null), 3500); return () => clearTimeout(t); }, [notice]);
    useEffect(() => { const t = setTimeout(() => setDebounced(search), 300); return () => clearTimeout(t); }, [search]);

    useEffect(() => {
        let mounted = true;
        setLoadingItems(true);
        setError(null);
        getItems(1, 100, null, debounced || null)
            .then((res) => { if (mounted) setItems(res.data || []); })
            .catch((err: { message?: string }) => { if (mounted) setError(err?.message || "Failed to load items"); })
            .finally(() => { if (mounted) setLoadingItems(false); });
        return () => { mounted = false; };
    }, [debounced]);

    async function reloadCodes() {
        setLoadingCodes(true);
        try {
            const all = await listBarcodes(null, null);
            const map: Record<number, BarcodeDto[]> = {};
            for (const b of all) (map[b.itemId] ||= []).push(b);
            setCodesByItem(map);
        } catch (err) {
            const st = (err as { response?: { status?: number } })?.response?.status;
            setNotice({ variant: "warning", title: "Barcodes unavailable", message: st === 404 ? "The barcode endpoints are not live on this server yet." : st === 403 ? "You are not allowed to view barcodes." : "Could not load barcodes." });
        } finally {
            setLoadingCodes(false);
        }
    }
    useEffect(() => { reloadCodes(); }, []);

    async function run(key: string, fn: () => Promise<{ success: boolean; message: string; error: string | null }>, okTitle: string) {
        setBusy(key);
        try {
            const r = await fn();
            setNotice(r.success ? { variant: "success", title: okTitle, message: r.message } : { variant: "error", title: "Failed", message: r.error || r.message });
            if (r.success) await reloadCodes();
        } finally {
            setBusy(null);
        }
    }

    async function openAdd(item: ItemDto) {
        setFormItem(item);
        setForm({ code: "", symbology: "CODE128", variantId: null, isPrimary: false });
        setVariants(await getItemVariants(Number(item.id)));
    }

    async function submitAdd() {
        if (!formItem) return;
        setSaving(true);
        try {
            const r = await createBarcode({ itemId: Number(formItem.id), variantId: form.variantId, code: form.code, symbology: form.symbology, isPrimary: form.isPrimary });
            if (r.success) { setNotice({ variant: "success", title: "Barcode added", message: r.message }); setFormItem(null); await reloadCodes(); }
            else setNotice({ variant: "error", title: "Failed", message: r.error || r.message });
        } finally {
            setSaving(false);
        }
    }

    const selectedIds = Object.entries(selected).filter(([, v]) => v).map(([k]) => Number(k));
    function printLabels(ids: number[]) {
        if (ids.length === 0) return;
        navigate(`/admin/retail/labels?ids=${ids.join(",")}`);
    }

    return (
        <div className="p-6">
            <PageMeta title="Barcodes | Axis" description="Item barcodes and labels" />
            <PageBreadcrumb pageTitle="Barcodes" />

            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="w-72">
                    <Input placeholder="Search items…" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <div className="flex items-center gap-2">
                    <button type="button" disabled={selectedIds.length === 0} onClick={() => printLabels(selectedIds)}
                        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50">
                        Print labels ({selectedIds.length})
                    </button>
                    <button type="button" onClick={() => setSelected({})} disabled={selectedIds.length === 0}
                        className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5">
                        Clear
                    </button>
                </div>
            </div>

            {error && <div className="mb-3 rounded bg-red-50 p-3 text-red-600 dark:bg-red-500/10">{error}</div>}
            {(loadingItems || loadingCodes) && <div className="flex justify-center py-6"><Loader /></div>}

            {!loadingItems && !error && items.length === 0 && (
                <div className="rounded border border-dashed border-gray-300 p-8 text-center text-gray-500 dark:border-gray-700 dark:text-gray-400">No items match.</div>
            )}

            {!loadingItems && items.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                    <Table>
                        <TableHeader className="border-b border-gray-200 dark:border-gray-700">
                            <TableRow>
                                <TableCell isHeader className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400"> </TableCell>
                                <TableCell isHeader className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Item</TableCell>
                                <TableCell isHeader className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Barcodes</TableCell>
                                <TableCell isHeader className="px-3 py-2 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Actions</TableCell>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {items.map((it) => {
                                const id = Number(it.id);
                                const codes = codesByItem[id] || [];
                                return (
                                    <TableRow key={it.id} className="border-b border-gray-100 align-top dark:border-gray-700/60">
                                        <TableCell className="px-3 py-3">
                                            <input type="checkbox" checked={!!selected[id]} onChange={(e) => setSelected((s) => ({ ...s, [id]: e.target.checked }))} aria-label={`Select ${it.name}`} />
                                        </TableCell>
                                        <TableCell className="px-3 py-3">
                                            <div className="font-medium text-gray-800 dark:text-white/90">{it.name}</div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">#{it.id} · ${Number(it.price).toFixed(2)} · stock {it.quantity}</div>
                                        </TableCell>
                                        <TableCell className="px-3 py-3">
                                            {codes.length === 0 && <span className="text-sm text-gray-400 dark:text-gray-500">No barcode</span>}
                                            <div className="space-y-1">
                                                {codes.map((b) => (
                                                    <div key={b.id} className="flex flex-wrap items-center gap-2 text-sm">
                                                        <span className="font-mono text-gray-800 dark:text-white/90">{b.code}</span>
                                                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 dark:bg-white/10 dark:text-gray-300">{b.symbology}</span>
                                                        {b.variantName && <span className="text-xs text-gray-500 dark:text-gray-400">{b.variantName}</span>}
                                                        {b.isPrimary ? (
                                                            <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700 dark:bg-green-500/15 dark:text-green-400">primary</span>
                                                        ) : (
                                                            <button type="button" disabled={busy === `p${b.id}`} onClick={() => run(`p${b.id}`, () => setPrimaryBarcode(b.id), "Primary set")}
                                                                className="text-xs text-indigo-600 hover:underline dark:text-indigo-400">make primary</button>
                                                        )}
                                                        <DeleteIconButton onClick={() => setDeleteTarget(b)} title="Delete barcode" />
                                                    </div>
                                                ))}
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-3 py-3 text-right">
                                            <div className="flex flex-wrap justify-end gap-1">
                                                <button type="button" onClick={() => openAdd(it)} className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5">Add</button>
                                                <button type="button" disabled={busy === `g${id}`} onClick={() => run(`g${id}`, () => generateBarcode(id, null), "Generated")}
                                                    className="rounded bg-indigo-600 px-2 py-1 text-xs text-white hover:bg-indigo-700 disabled:opacity-50">
                                                    {busy === `g${id}` ? <Loader size={12} /> : "Generate EAN-13"}
                                                </button>
                                                <button type="button" disabled={codes.length === 0} onClick={() => printLabels([id])}
                                                    className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5">Labels</button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            )}

            <Modal isOpen={!!formItem} onClose={() => setFormItem(null)} title={formItem ? `Add barcode — ${formItem.name}` : "Add barcode"} className="max-w-lg">
                <div className="space-y-3">
                    <div>
                        <Label>Code</Label>
                        <Input placeholder="Scan or type the code" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === "Enter") submitAdd(); }} />
                    </div>
                    <div>
                        <Label>Symbology</Label>
                        <select value={form.symbology} onChange={(e) => setForm((f) => ({ ...f, symbology: e.target.value }))}
                            className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white/90">
                            {SYMBOLOGIES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    {variants.length > 0 && (
                        <div>
                            <Label>Option (variant)</Label>
                            <select value={form.variantId ?? ""} onChange={(e) => setForm((f) => ({ ...f, variantId: e.target.value === "" ? null : Number(e.target.value) }))}
                                className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white/90">
                                <option value="">Whole item</option>
                                {variants.map((v) => <option key={v.id} value={v.id}>{v.name}{v.sku ? ` (${v.sku})` : ""}</option>)}
                            </select>
                            {form.variantId != null && (
                                <div className="mt-2 flex gap-2">
                                    <button type="button" onClick={() => formItem && run(`gv${form.variantId}`, () => generateBarcode(Number(formItem.id), form.variantId), "Generated")}
                                        className="rounded border border-indigo-300 px-2 py-1 text-xs text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-white/5">
                                        Generate EAN-13 for this option
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <input type="checkbox" checked={form.isPrimary} onChange={(e) => setForm((f) => ({ ...f, isPrimary: e.target.checked }))} /> Make it the primary (printed) code
                    </label>
                    {form.code.trim() && <div className="rounded bg-white p-2 dark:bg-white"><BarcodeSvg code={form.code.trim()} height={32} /></div>}
                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={() => setFormItem(null)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-300">Cancel</button>
                        <button type="button" disabled={saving || !form.code.trim()} onClick={submitAdd} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50">
                            {saving ? <Loader size={14} /> : "Add"}
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete barcode" className="max-w-md">
                <p className="text-sm text-gray-700 dark:text-gray-300">Remove <span className="font-mono">{deleteTarget?.code}</span> from {deleteTarget?.itemName}?</p>
                <div className="mt-4 flex justify-end gap-2">
                    <button type="button" onClick={() => setDeleteTarget(null)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-300">Cancel</button>
                    <button type="button" onClick={async () => { const t = deleteTarget; setDeleteTarget(null); if (t) await run(`d${t.id}`, () => deleteBarcode(t.id), "Deleted"); }}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700">Delete</button>
                </div>
            </Modal>

            <div className="fixed bottom-6 right-6 z-50">
                {notice && <div className="max-w-sm"><Alert variant={notice.variant} title={notice.title} message={notice.message} /></div>}
            </div>
        </div>
    );
}
