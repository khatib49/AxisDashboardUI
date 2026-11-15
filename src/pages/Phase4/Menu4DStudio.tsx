import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router";
import Menu4DButton from "../../components/menu4d/Menu4DButton";
import Dish3D, { type Dish3DHandle } from "../../components/menu4d/Dish3D";
import { Card, Notice, btnGhost, btnPrimary, inputCls, td, th } from "../../components/phase4/ui";
import { assetUrl, setItemModelActive, type ItemModel3DDto } from "../../services/phase4Service";
import {
  analyze4D, analyzeAll4D, list4D, makeAllModels4D, makeModel4D, process4D, publishAll4D, status4D, update4D,
  type Dish4DPart, type Item4DRow, type Menu4DStatus,
} from "../../services/menu4dService";

type Msg = { kind: "ok" | "error" | "info"; text: string } | null;

function Stat({ label, value, tone = "" }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className={`text-2xl font-bold tabular-nums text-gray-900 dark:text-white ${tone}`}>{value}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
    </div>
  );
}

function GenBadge({ r }: { r: Item4DRow }) {
  if (r.genStatus === "Queued") return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">Waiting…</span>;
  if (r.genStatus === "Running") return (
    <span className="inline-flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-blue-100 dark:bg-blue-500/20"><span className="block h-full bg-blue-500" style={{ width: `${Math.max(5, r.genProgress)}%` }} /></span>
      {r.genProgress}%
    </span>
  );
  if (r.genStatus === "Failed") return <span className="text-xs text-red-600 dark:text-red-400" title={r.genError ?? ""}>Failed{r.genError ? `: ${r.genError.slice(0, 60)}` : ""}</span>;
  if (r.hasModel) return <span className="text-xs text-gray-600 dark:text-gray-300">{r.modelIsAi ? "AI model" : "Scan"}</span>;
  return <span className="text-xs text-gray-400">None</span>;
}

/**
 * 4D Studio: the AI labels every part of each dish (bun, patty, foam…), staff
 * check and publish them, and the AI turns photos into 3D models guests can
 * place on their table. Nothing reaches guests until staff publish or approve it.
 */
export default function Menu4DStudio({ scans, onScansChanged }: { scans: ItemModel3DDto[]; onScansChanged: () => void }) {
  const [rows, setRows] = useState<Item4DRow[]>([]);
  const [status, setStatus] = useState<Menu4DStatus | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Item4DRow | null>(null);

  const reload = useCallback(async () => {
    try { const [l, s] = await Promise.all([list4D(), status4D()]); setRows(l); setStatus(s); }
    catch (e) { setMsg({ kind: "error", text: (e as Error).message }); }
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  // While models are being made, refresh every 15 seconds.
  const working = rows.some((r) => r.genStatus === "Queued" || r.genStatus === "Running");
  useEffect(() => {
    if (!working) return;
    const t = window.setInterval(() => { void reload(); onScansChanged(); }, 15000);
    return () => window.clearInterval(t);
  }, [working, reload, onScansChanged]);

  const run = async (key: string, fn: () => Promise<unknown>, ok?: (r: unknown) => string) => {
    setBusy(key); setMsg(null);
    try { const r = await fn(); if (ok) setMsg({ kind: "ok", text: ok(r) }); await reload(); }
    catch (e) { setMsg({ kind: "error", text: (e as Error).message }); }
    finally { setBusy(null); }
  };

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? rows.filter((r) => `${r.itemName} ${r.category ?? ""}`.toLowerCase().includes(t)) : rows;
  }, [rows, q]);
  const cost = status?.estimatedCostPerModelUsd ?? 0.3;
  const without3D = rows.filter((r) => !r.hasModel && r.imagePath && r.genStatus !== "Queued" && r.genStatus !== "Running").length;

  return (
    <Card title="4D Studio" className="mb-4">
      {msg && <Notice kind={msg.kind} text={msg.text} onClose={() => setMsg(null)} />}
      {status && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Items with a photo" value={status.itemsWithPhoto} />
            <Stat label="Parts labelled" value={status.withParts} />
            <Stat label="Labels live" value={status.published} tone="text-green-600 dark:text-green-400" />
            <Stat label="3D models" value={status.withModel} />
            <Stat label="Being made" value={status.queued + status.running} tone={status.queued + status.running ? "text-blue-600 dark:text-blue-400" : ""} />
            <Stat label="Failed" value={status.failed} tone={status.failed ? "text-red-600 dark:text-red-400" : ""} />
          </div>
          {(!status.aiReady || !status.make3DReady) && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              {!status.aiReady && <p>AI part labels need the <b>Anthropic.ApiKey</b> setting.</p>}
              {!status.make3DReady && <p>Photo to 3D needs the <b>Menu4D.Meshy.ApiKey</b> setting (a Meshy account, about ${cost.toFixed(2)} per dish).</p>}
              <Link to="/admin/integrations/all" className="mt-1 inline-block font-semibold underline">Open Integrations → All keys</Link>
            </div>
          )}
        </>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" className={btnPrimary} disabled={!!busy || !status?.aiReady}
          onClick={() => void run("label", analyzeAll4D, (r) => (r as { message: string }).message)}>{busy === "label" ? "Starting…" : "✨ AI-label every dish"}</button>
        <button type="button" className={btnGhost} disabled={!!busy}
          onClick={() => void run("pub", publishAll4D, (r) => (r as { message: string }).message)}>Publish all labels</button>
        <button type="button" className={btnGhost} disabled={!!busy || !status?.make3DReady || without3D === 0}
          onClick={() => { if (window.confirm(`Make 3D models for ${without3D} dishes? Estimated cost about $${(without3D * cost).toFixed(2)}. Each model stays hidden until you approve it.`)) void run("3d", makeAllModels4D, (r) => (r as { message: string }).message); }}>
          {busy === "3d" ? "Queuing…" : `🧊 Make 3D for all (${without3D})`}
        </button>
        <button type="button" className={btnGhost} disabled={!!busy} onClick={() => void run("p", process4D, (r) => `${(r as { changed: number }).changed} updated.`)}>Check progress</button>
        <input className={`${inputCls} ml-auto max-w-xs`} placeholder="Search dishes…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
          <thead><tr><th className={th}>Dish</th><th className={th}>Parts</th><th className={th}>3D</th><th className={th}>On menus</th><th className={th}></th></tr></thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {shown.map((r) => {
              const img = assetUrl(r.imagePath);
              return (
                <tr key={r.itemId}>
                  <td className={td}>
                    <div className="flex items-center gap-3">
                      {img ? <img src={img} alt="" className="h-11 w-11 rounded-lg object-cover" loading="lazy" /> : <div className="h-11 w-11 rounded-lg bg-gray-100 dark:bg-white/5" />}
                      <div><div className="font-medium">{r.itemName}</div><div className="text-xs text-gray-500 dark:text-gray-400">{r.category}</div></div>
                    </div>
                  </td>
                  <td className={td}>
                    {r.parts.length ? (
                      <span className="text-xs">{r.parts.length} parts · {r.partsPublished
                        ? <span className="text-green-600 dark:text-green-400">live</span>
                        : <span className="text-amber-600 dark:text-amber-400">draft</span>}</span>
                    ) : <span className="text-xs text-gray-400">None</span>}
                  </td>
                  <td className={td}><GenBadge r={r} /></td>
                  <td className={td}>
                    {r.hasModel ? (
                      <button type="button" onClick={() => void run(`a${r.itemId}`, async () => { await setItemModelActive(r.itemId, !r.modelActive); onScansChanged(); })}
                        className={`rounded-full px-3 py-1 text-xs font-medium ${r.modelActive ? "bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300" : "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"}`}>
                        {r.modelActive ? "3D on menus" : "Approve 3D"}
                      </button>
                    ) : <span className="text-xs text-gray-400">Living photo</span>}
                  </td>
                  <td className={td}>
                    <div className="flex flex-wrap justify-end gap-2">
                      <button type="button" className={btnGhost} disabled={!!busy || !status?.aiReady || !img} onClick={() => void run(`l${r.itemId}`, () => analyze4D(r.itemId), () => `Labelled ${r.itemName}. Check the labels, then publish.`)}>
                        {busy === `l${r.itemId}` ? "Looking…" : "AI label"}
                      </button>
                      <button type="button" className={btnGhost} onClick={() => setEditing(r)}>Edit</button>
                      {!r.hasModel && r.genStatus !== "Queued" && r.genStatus !== "Running" && (
                        <button type="button" className={btnGhost} disabled={!!busy || !status?.make3DReady || !img}
                          onClick={() => { if (window.confirm(`Make a 3D model of ${r.itemName}? About $${cost.toFixed(2)}. It stays hidden until you approve it.`)) void run(`m${r.itemId}`, () => makeModel4D(r.itemId), () => `3D model of ${r.itemName} is being made (a few minutes).`); }}>Make 3D</button>
                      )}
                      <Menu4DButton items={[{ id: r.itemId, name: r.itemName, imageUrl: img, hint: r.category, description: r.description }]} index={0} always label="Preview" className="!py-2" />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {shown.length === 0 && <p className="py-6 text-center text-sm text-gray-500">No dishes found.</p>}
      </div>

      {editing && (
        <PartsEditor row={editing} scan={scans.find((s) => s.itemId === editing.itemId)} onClose={() => setEditing(null)}
          onSaved={(r) => { setEditing(null); setMsg({ kind: "ok", text: `${r.itemName} saved${r.partsPublished ? " and live on menus" : " as a draft"}.` }); void reload(); }} />
      )}
    </Card>
  );
}

/** Staff editor: drag the dots on the photo, rename parts, and (with a 3D model) tap the model to pin each part. */
function PartsEditor({ row, scan, onClose, onSaved }: { row: Item4DRow; scan?: ItemModel3DDto; onClose: () => void; onSaved: (r: Item4DRow) => void }) {
  const img = assetUrl(row.imagePath);
  const [parts, setParts] = useState<Dish4DPart[]>(row.parts.map((p) => ({ ...p })));
  const [published, setPublished] = useState(row.partsPublished || row.parts.length === 0);
  const [size, setSize] = useState<string>(row.realSizeCm != null ? String(row.realSizeCm) : "");
  const [sel, setSel] = useState<number | null>(parts.length ? 0 : null);
  const [tab, setTab] = useState<"photo" | "3d">(img ? "photo" : "3d");
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const photo = useRef<HTMLDivElement>(null);
  const dish = useRef<Dish3DHandle>(null);
  const drag = useRef<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const at = (e: { clientX: number; clientY: number }) => {
    const r = photo.current!.getBoundingClientRect();
    return { x: Math.round(Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)) * 10) / 10, y: Math.round(Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100)) * 10) / 10 };
  };
  const patch = (i: number, p: Partial<Dish4DPart>) => setParts((l) => l.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const add = (x = 50, y = 50) => { if (parts.length >= 8) return; setParts((l) => [...l, { name: `Part ${l.length + 1}`, detail: "", x, y }]); setSel(parts.length); };
  const remove = (i: number) => { setParts((l) => l.filter((_, j) => j !== i)); setSel(null); };

  const save = async () => {
    setSaving(true); setErr(null);
    try {
      const cm = size.trim() ? Number(size) : null;
      if (cm != null && (!Number.isFinite(cm) || cm <= 0 || cm > 200)) throw new Error("Real size must be between 1 and 200 cm.");
      const clean = parts.map((p) => ({ ...p, name: p.name.trim(), detail: p.detail?.trim() || null })).filter((p) => p.name);
      onSaved(await update4D(row.itemId, { parts: clean, published, realSizeCm: cm }));
    } catch (e) { setErr((e as Error).message); } finally { setSaving(false); }
  };

  const model = scan ? { itemId: scan.itemId, glbPath: scan.glbPath, usdzPath: scan.usdzPath, posterPath: scan.posterPath } : null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 p-3" role="dialog" aria-modal="true" aria-label={`Edit parts of ${row.itemName}`} onClick={onClose}>
      <div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{row.itemName}: parts</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Tap the photo to add a part, drag a dot to move it. Guests tap these in 4D to learn the dish.</p>
          </div>
          <button type="button" className={btnGhost} onClick={onClose} aria-label="Close">✕</button>
        </div>
        {err && <Notice kind="error" text={err} onClose={() => setErr(null)} />}
        {model && img && (
          <div className="mb-3 inline-flex rounded-lg border border-gray-200 p-0.5 text-sm dark:border-gray-700">
            {(["photo", "3d"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setTab(t)} className={`rounded-md px-3 py-1.5 ${tab === t ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900" : "text-gray-600 dark:text-gray-300"}`}>
                {t === "photo" ? "On the photo" : "On the 3D model"}
              </button>
            ))}
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div>
            {tab === "photo" ? (
              img ? (
                <div ref={photo} className="relative w-full cursor-crosshair touch-none select-none overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800"
                  onPointerDown={(e) => { if ((e.target as HTMLElement).dataset.dot == null) { const p = at(e); add(p.x, p.y); } }}
                  onPointerMove={(e) => { if (drag.current != null) patch(drag.current, at(e)); }}
                  onPointerUp={() => { drag.current = null; }} onPointerLeave={() => { drag.current = null; }}>
                  <img src={img} alt={row.itemName} className="block w-full" draggable={false} />
                  {parts.map((p, i) => (
                    <button key={i} type="button" data-dot="" style={{ left: `${p.x}%`, top: `${p.y}%` }}
                      className={`absolute -ml-3.5 -mt-3.5 flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold shadow-lg ${sel === i ? "border-amber-300 bg-amber-400 text-gray-900" : "border-white bg-gray-900/80 text-white"}`}
                      onPointerDown={(e) => { e.stopPropagation(); (e.currentTarget.parentElement as HTMLElement).setPointerCapture(e.pointerId); drag.current = i; setSel(i); }}>
                      {i + 1}
                    </button>
                  ))}
                </div>
              ) : <p className="text-sm text-gray-500">This item has no photo.</p>
            ) : model && (
              <div>
                <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-gray-900">
                  <Dish3D ref={dish} model={model} alt={row.itemName} parts={parts} active={sel} onPart={setSel} spin={false} showLabels className="absolute inset-0 h-full w-full"
                    onClick={(e) => {
                      if (sel == null) return;
                      const hit = dish.current?.pointAt(e.clientX, e.clientY);
                      if (hit) patch(sel, { pos3D: hit.pos, normal3D: hit.normal });
                    }} />
                </div>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {sel == null ? "Choose a part on the right, then tap the model where it is." : <>Tap the model where <b>{parts[sel]?.name}</b> is. Drag to turn it.</>}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            {parts.map((p, i) => (
              <div key={i} onClick={() => setSel(i)} className={`rounded-xl border p-2.5 ${sel === i ? "border-amber-400 bg-amber-50/60 dark:bg-amber-500/10" : "border-gray-200 dark:border-gray-700"}`}>
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white dark:bg-white dark:text-gray-900">{i + 1}</span>
                  <input className={inputCls} value={p.name} maxLength={40} onChange={(e) => patch(i, { name: e.target.value })} aria-label={`Part ${i + 1} name`} />
                  <button type="button" className="px-2 text-gray-400 hover:text-red-500" onClick={(e) => { e.stopPropagation(); remove(i); }} aria-label={`Remove ${p.name}`}>✕</button>
                </div>
                <input className={`${inputCls} mt-1.5`} value={p.detail ?? ""} maxLength={160} placeholder="One short line for guests (optional)" onChange={(e) => patch(i, { detail: e.target.value })} aria-label={`Part ${i + 1} detail`} />
                {model && <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{p.pos3D ? "📍 Pinned on the 3D model" : "Not pinned on the 3D model yet"}</div>}
              </div>
            ))}
            {parts.length < 8 && <button type="button" className={`${btnGhost} w-full`} onClick={() => add()}>+ Add a part</button>}
            <label className="block pt-2 text-xs text-gray-600 dark:text-gray-400">Real width in cm (for life-size on the table; empty = automatic)
              <input className={`${inputCls} mt-1`} inputMode="decimal" value={size} onChange={(e) => setSize(e.target.value)} placeholder="e.g. 24" />
            </label>
            <label className="flex items-center gap-2 pt-1 text-sm text-gray-800 dark:text-white/90">
              <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} /> Show these labels to guests
            </label>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">Check names and lines before publishing. Don't add allergens, weights or calories unless the kitchen has confirmed them.</p>
            <div className="flex gap-2 pt-1">
              <button type="button" className={btnPrimary} disabled={saving} onClick={() => void save()}>{saving ? "Saving…" : "Save"}</button>
              <button type="button" className={btnGhost} onClick={onClose}>Cancel</button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
