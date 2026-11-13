import { useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { Card, Notice, btnDanger, btnGhost, btnPrimary, inputCls } from "../../components/phase4/ui";
import { useI18n } from "../../i18n/I18nProvider";
import { applyMenuDraft, discardDraft, extractWithAi, updateDraft, type AiDraft } from "../../services/phase5Service";

type MenuJson = { currency?: string; categories: { name: string; kind: string; items: { name: string; price: number; description?: string }[] }[] };
const KINDS = ["Food", "Drinks", "Retail", "Tobacco"];

/** Menu import: photo / PDF read by AI, or CSV; review and edit, then create the items. */
export default function AiMenuImport({ embedded = false }: { embedded?: boolean }) {
  const { t } = useI18n();
  const [file, setFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<AiDraft | null>(null);
  const [menu, setMenu] = useState<MenuJson | null>(null);
  const [qty, setQty] = useState(100);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error" | "info"; text: string } | null>(null);
  const fail = (e: unknown) => setNotice({ kind: "error", text: (e as Error).message });

  async function read() {
    if (!file) return; setBusy(true); setNotice(null);
    try { const d = await extractWithAi("menu", file); setDraft(d); setMenu(JSON.parse(d.json)); } catch (e) { fail(e); } finally { setBusy(false); }
  }
  async function apply() {
    if (!draft || !menu) return; setBusy(true);
    try { await updateDraft(draft.id, JSON.stringify(menu)); const r = await applyMenuDraft(draft.id, qty); setNotice({ kind: "ok", text: r.message }); setDraft(null); setMenu(null); setFile(null); } catch (e) { fail(e); } finally { setBusy(false); }
  }
  const setCat = (ci: number, patch: Partial<MenuJson["categories"][number]>) => setMenu((m) => m && { ...m, categories: m.categories.map((c, i) => (i === ci ? { ...c, ...patch } : c)) });
  const setItem = (ci: number, ii: number, patch: Partial<MenuJson["categories"][number]["items"][number]>) => setMenu((m) => m && { ...m, categories: m.categories.map((c, i) => (i === ci ? { ...c, items: c.items.map((it, j) => (j === ii ? { ...it, ...patch } : it)) } : c)) });
  const count = menu?.categories.reduce((s, c) => s + c.items.length, 0) ?? 0;

  const body = (
    <>
      {notice && <Notice kind={notice.kind} text={notice.text} onClose={() => setNotice(null)} />}
      <Card title={t("Upload a menu photo, PDF or CSV")} className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <input type="file" accept="image/*,.pdf,.csv,.txt" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-2 dark:text-gray-300 dark:file:bg-gray-800 dark:file:text-gray-200" aria-label="Menu file" />
          <button type="button" className={btnPrimary} disabled={!file || busy} onClick={() => void read()}>{busy && !draft ? t("Loading…") : t("Read the menu")}</button>
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Photos and PDFs need the AI key (Integrations). A CSV with columns name, category, price, kind works without it.</p>
      </Card>
      {menu && (
        <Card title={`${draft?.fileName} · ${menu.categories.length} categories · ${count} ${t("items")}`} actions={
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-gray-600 dark:text-gray-400">{t("Starting stock per item")} <input type="number" className={`${inputCls} ms-1 inline-block w-24`} value={qty} onChange={(e) => setQty(Number(e.target.value) || 0)} /></label>
            <button type="button" className={btnPrimary} disabled={busy || count === 0} onClick={() => void apply()}>{t("Create items")}</button>
            <button type="button" className={btnDanger} onClick={() => { if (draft) void discardDraft(draft.id); setDraft(null); setMenu(null); }}>{t("Discard")}</button>
          </div>}>
          <div className="space-y-4">
            {menu.categories.map((c, ci) => (
              <div key={ci} className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                <div className="mb-2 flex flex-wrap gap-2">
                  <input className={`${inputCls} w-56`} value={c.name} onChange={(e) => setCat(ci, { name: e.target.value })} aria-label="Category" />
                  <select className={`${inputCls} w-36`} value={KINDS.includes(c.kind) ? c.kind : "Food"} onChange={(e) => setCat(ci, { kind: e.target.value })}>{KINDS.map((k) => <option key={k}>{k}</option>)}</select>
                  <button type="button" className={btnGhost} onClick={() => setMenu((m) => m && { ...m, categories: m.categories.filter((_, i) => i !== ci) })}>{t("Delete")}</button>
                </div>
                {c.items.map((it, ii) => (
                  <div key={ii} className="mb-1 grid grid-cols-[1fr_7rem_auto] gap-2">
                    <input className={inputCls} value={it.name} onChange={(e) => setItem(ci, ii, { name: e.target.value })} aria-label="Item" />
                    <input className={inputCls} inputMode="decimal" value={it.price} onChange={(e) => setItem(ci, ii, { price: Number(e.target.value) || 0 })} aria-label={t("Price")} />
                    <button type="button" className={btnGhost} aria-label={t("Delete")} onClick={() => setCat(ci, { items: c.items.filter((_, j) => j !== ii) })}>×</button>
                  </div>
                ))}
              </div>
            ))}
          </div>
          {menu.currency && menu.currency !== "USD" && <p className="mt-3 text-sm text-amber-700 dark:text-amber-400">Prices on the menu are in {menu.currency}: convert them to USD before creating the items.</p>}
        </Card>
      )}
    </>
  );
  if (embedded) return body;
  return (
    <div className="p-4 sm:p-6">
      <PageMeta title="AI Menu Import | Axis" description="Import the menu from a photo, PDF or CSV" />
      <PageBreadcrumb pageTitle={t("AI Menu Import")} />
      {body}
    </div>
  );
}
