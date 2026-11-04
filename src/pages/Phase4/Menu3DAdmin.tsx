import { useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import Model3DButton from "../../components/menu3d/Model3DButton";
import { Card, ItemPicker, Notice, btnDanger, btnGhost, btnPrimary, td, th } from "../../components/phase4/ui";
import { deleteItemModel, listItemModels, setItemModelActive, uploadItemModel, type ItemModel3DDto } from "../../services/phase4Service";

const mb = (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB`;

/** Admin: attach 3D models (GLB + optional USDZ and poster) to menu items. */
export default function Menu3DAdmin() {
  const [models, setModels] = useState<ItemModel3DDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [item, setItem] = useState<{ id: number; name: string } | null>(null);
  const [glb, setGlb] = useState<File | null>(null);
  const [usdz, setUsdz] = useState<File | null>(null);
  const [poster, setPoster] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const reload = () => listItemModels().then(setModels).catch((e) => setNotice({ kind: "error", text: (e as Error).message })).finally(() => setLoading(false));
  useEffect(() => { void reload(); }, []);

  const existing = item ? models.find((m) => m.itemId === item.id) : undefined;

  async function upload() {
    if (!item) return;
    setBusy(true); setNotice(null);
    try {
      await uploadItemModel(item.id, { glb, usdz, poster });
      setNotice({ kind: "ok", text: `3D model saved for ${item.name}.` });
      setGlb(null); setUsdz(null); setPoster(null); setFormKey((k) => k + 1);
      await reload();
    } catch (e) { setNotice({ kind: "error", text: (e as Error).message }); } finally { setBusy(false); }
  }

  async function toggle(m: ItemModel3DDto) {
    try { await setItemModelActive(m.itemId, !m.isActive); await reload(); } catch (e) { setNotice({ kind: "error", text: (e as Error).message }); }
  }
  async function remove(m: ItemModel3DDto) {
    if (!window.confirm(`Remove the 3D model of ${m.itemName}?`)) return;
    try { await deleteItemModel(m.itemId); await reload(); } catch (e) { setNotice({ kind: "error", text: (e as Error).message }); }
  }

  const file = "block w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm dark:text-gray-300 dark:file:bg-gray-800 dark:file:text-gray-200";
  return (
    <div className="p-4 sm:p-6">
      <PageMeta title="3D Menu | Axis" description="3D models of menu items" />
      <PageBreadcrumb pageTitle="3D Menu" />
      {notice && <Notice kind={notice.kind} text={notice.text} onClose={() => setNotice(null)} />}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Add or replace a model" className="lg:col-span-1">
          <div className="space-y-3" key={formKey}>
            <ItemPicker label="Menu item" value={item} onChange={(v) => setItem(v)} />
            <label className="block text-xs text-gray-600 dark:text-gray-400">GLB file {existing ? "(leave empty to keep)" : "(required)"} · web and Android
              <input type="file" accept=".glb" className={`${file} mt-1`} onChange={(e) => setGlb(e.target.files?.[0] ?? null)} />
            </label>
            <label className="block text-xs text-gray-600 dark:text-gray-400">USDZ file (optional) · iPhone AR
              <input type="file" accept=".usdz" className={`${file} mt-1`} onChange={(e) => setUsdz(e.target.files?.[0] ?? null)} />
            </label>
            <label className="block text-xs text-gray-600 dark:text-gray-400">Poster image (optional) · shown while loading
              <input type="file" accept="image/*" className={`${file} mt-1`} onChange={(e) => setPoster(e.target.files?.[0] ?? null)} />
            </label>
            <button type="button" className={btnPrimary} disabled={busy || !item || (!existing && !glb) || (!glb && !usdz && !poster)} onClick={() => void upload()}>
              {busy ? "Uploading…" : "Save model"}
            </button>
          </div>
          <div className="mt-4 rounded-xl bg-gray-50 p-3 text-xs text-gray-600 dark:bg-white/5 dark:text-gray-400">
            <p className="font-semibold text-gray-700 dark:text-gray-300">How to get a model</p>
            <p className="mt-1">Put the dish on a turntable and take 20 to 40 photos around it. Polycam, KIRI Engine or Apple Object Capture turn them into GLB and USDZ files.</p>
            <p className="mt-1">Keep each file under 5 MB so it loads fast on mobile data. Solid dishes scan best; glass and shiny sauces scan badly.</p>
          </div>
        </Card>

        <Card title={`Items with a 3D model (${models.length})`} className="lg:col-span-2">
          {loading ? <p className="text-sm text-gray-500">Loading…</p> : models.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No 3D models yet. Pick an item on the left and upload its GLB file.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                <thead><tr><th className={th}>Item</th><th className={th}>Files</th><th className={th}>Shown</th><th className={th}>Updated</th><th className={th}></th></tr></thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {models.map((m) => (
                    <tr key={m.id}>
                      <td className={td}><span className="mr-2">{m.itemName}</span><Model3DButton model={m} name={m.itemName} /></td>
                      <td className={td}>GLB {mb(m.glbBytes)}{m.usdzPath ? " · USDZ" : ""}{m.posterPath ? " · poster" : ""}</td>
                      <td className={td}>
                        <button type="button" onClick={() => void toggle(m)} className={`rounded-full px-3 py-1 text-xs font-medium ${m.isActive ? "bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300" : "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300"}`}>
                          {m.isActive ? "On menus" : "Hidden"}
                        </button>
                      </td>
                      <td className={td}>{m.updatedOn ? new Date(m.updatedOn).toLocaleDateString() : ""}<span className="block text-xs text-gray-500 dark:text-gray-400">{m.updatedBy}</span></td>
                      <td className={td}>
                        <div className="flex gap-2">
                          <button type="button" className={btnGhost} onClick={() => setItem({ id: m.itemId, name: m.itemName })}>Replace</button>
                          <button type="button" className={btnDanger} onClick={() => void remove(m)}>Remove</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
