import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import Loader from "../../components/ui/Loader";
import { getLabels, LabelDto } from "../../services/retailService";
import { encodeCode128, code128Bars } from "../../components/retail/code128";

/** One Code 128 label rendered as inline SVG (no dependency). */
export function BarcodeSvg({ code, height = 40, moduleWidth = 1.4 }: { code: string; height?: number; moduleWidth?: number }) {
    const enc = useMemo(() => encodeCode128(code), [code]);
    if (!enc) return null;
    const quiet = 10; // quiet zone modules on each side
    const width = (enc.modules + quiet * 2) * moduleWidth;
    return (
        <svg
            viewBox={`0 0 ${enc.modules + quiet * 2} ${height}`}
            width={width}
            height={height}
            shapeRendering="crispEdges"
            role="img"
            aria-label={`Barcode ${code}`}
        >
            <rect x={0} y={0} width={enc.modules + quiet * 2} height={height} fill="#fff" />
            {code128Bars(enc.pattern).map((b, i) => (
                <rect key={i} x={quiet + b.x} y={0} width={b.w} height={height} fill="#000" />
            ))}
        </svg>
    );
}

/**
 * /admin/retail/labels?ids=9,10 — printable grid of Code 128 labels, one per
 * item (and per active variant). Print with the button or Ctrl+P.
 */
export default function RetailLabels() {
    const [params] = useSearchParams();
    const ids = useMemo(
        () => (params.get("ids") || params.get("itemIds") || "").split(/[,\s;]+/).map((s) => Number(s)).filter((n) => Number.isInteger(n) && n > 0),
        [params],
    );
    const [labels, setLabels] = useState<LabelDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copies, setCopies] = useState(1);
    const [showPrice, setShowPrice] = useState(true);

    useEffect(() => {
        if (ids.length === 0) { setLabels([]); return; }
        let mounted = true;
        setLoading(true);
        setError(null);
        getLabels(ids)
            .then((rows) => { if (mounted) setLabels(rows); })
            .catch((err: { response?: { status?: number }; message?: string }) => {
                if (!mounted) return;
                const st = err?.response?.status;
                setError(st === 403 ? "You are not allowed to print labels." : st === 404 ? "Label data is not available on this server yet." : err?.message || "Failed to load labels");
            })
            .finally(() => { if (mounted) setLoading(false); });
        return () => { mounted = false; };
    }, [ids]);

    const printable = labels.filter((l) => !!l.code);
    const missing = labels.filter((l) => !l.code);
    const sheet: LabelDto[] = [];
    for (const l of printable) for (let i = 0; i < Math.max(1, Math.min(50, copies)); i++) sheet.push(l);

    return (
        <div className="p-6">
            <PageMeta title="Barcode labels | Axis" description="Printable barcode labels" />
            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    #label-sheet, #label-sheet * { visibility: visible; }
                    #label-sheet { position: absolute; left: 0; top: 0; width: 100%; padding: 0; margin: 0; background: #fff; }
                    .label-card { break-inside: avoid; page-break-inside: avoid; border: 1px dashed #bbb !important; }
                }
            `}</style>

            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-800 dark:text-white/90">Barcode labels</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {ids.length === 0 ? "No items selected." : `${printable.length} label${printable.length === 1 ? "" : "s"} for ${ids.length} item${ids.length === 1 ? "" : "s"}`}
                        {" · "}
                        <Link to="/admin/retail/barcodes" className="text-indigo-600 hover:underline dark:text-indigo-400">Back to barcodes</Link>
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                        Copies
                        <input type="number" min={1} max={50} value={copies} onChange={(e) => setCopies(Math.max(1, Number(e.target.value) || 1))}
                            className="h-9 w-16 rounded-lg border border-gray-300 bg-white px-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white/90" />
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} /> Price
                    </label>
                    <button type="button" onClick={() => window.print()} disabled={printable.length === 0}
                        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50">
                        Print
                    </button>
                </div>
            </div>

            {loading && <div className="flex justify-center py-10"><Loader /></div>}
            {error && <div className="rounded bg-red-50 p-3 text-red-600 dark:bg-red-500/10">{error}</div>}
            {!loading && !error && ids.length > 0 && labels.length === 0 && (
                <div className="rounded border border-dashed border-gray-300 p-8 text-center text-gray-500 dark:border-gray-700 dark:text-gray-400">No labels for these items.</div>
            )}
            {missing.length > 0 && (
                <div className="mb-3 rounded bg-yellow-50 p-3 text-sm text-yellow-800 dark:bg-yellow-500/10 dark:text-yellow-300 print:hidden">
                    No barcode yet for: {missing.map((m) => `${m.itemName}${m.variantName ? ` (${m.variantName})` : ""}`).join(", ")}. Generate one on the Barcodes page.
                </div>
            )}

            <div id="label-sheet" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {sheet.map((l, i) => (
                    <div key={`${l.itemId}-${l.variantId ?? 0}-${i}`} className="label-card flex flex-col items-center rounded border border-gray-200 bg-white p-3 text-center text-black dark:border-gray-700">
                        <div className="w-full truncate text-sm font-semibold" title={l.itemName}>{l.itemName}</div>
                        {l.variantName && <div className="text-xs text-gray-600">{l.variantName}</div>}
                        <div className="my-1 max-w-full overflow-hidden">
                            <BarcodeSvg code={l.code!} />
                        </div>
                        <div className="font-mono text-xs tracking-wider">{l.code}</div>
                        {showPrice && <div className="mt-1 text-sm font-bold">${Number(l.price).toFixed(2)}</div>}
                    </div>
                ))}
            </div>
        </div>
    );
}
