import { useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { Card, Notice, btnDanger, btnPrimary, inputCls, td, th } from "../../components/phase4/ui";
import { useI18n } from "../../i18n/I18nProvider";
import api from "../../services/api";
import { applyInvoiceDraft, discardDraft, extractWithAi, type AiDraft } from "../../services/phase5Service";

type Line = { name: string; quantity: number; unit?: string; unitCost: number; ingredientId?: number | null; ingredientName?: string };
type Inv = { supplier?: string; supplierId?: number; supplierName?: string; invoiceNumber?: string; date?: string; currency?: string; lines: Line[] };
type Opt = { id: number; name: string; unit?: string };

/** Supplier invoice scan: AI reads the photo / PDF, lines are matched to ingredients, then booked as a purchase. */
export default function AiInvoiceScan() {
  const { t } = useI18n();
  const [file, setFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<AiDraft | null>(null);
  const [inv, setInv] = useState<Inv | null>(null);
  const [ings, setIngs] = useState<Opt[]>([]);
  const [sups, setSups] = useState<Opt[]>([]);
  const [supplierId, setSupplierId] = useState<number | "new" | "">("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const fail = (e: unknown) => setNotice({ kind: "error", text: (e as Error).message });
  useEffect(() => {
    api.get("/ingredients", { params: { page: 1, pageSize: 500 } }).then((r) => { const d = r.data?.data ?? r.data?.items ?? r.data; setIngs(Array.isArray(d) ? d : []); }).catch(() => undefined);
    api.get("/suppliers", { params: { page: 1, pageSize: 500 } }).then((r) => { const d = r.data?.data ?? r.data?.items ?? r.data; setSups(Array.isArray(d) ? d : []); }).catch(() => undefined);
  }, []);

  async function read() {
    if (!file) return; setBusy(true); setNotice(null);
    try { const d = await extractWithAi("invoice", file); const j = JSON.parse(d.json) as Inv; setDraft(d); setInv({ ...j, lines: j.lines ?? [] }); setSupplierId(j.supplierId ?? (j.supplier ? "new" : "")); } catch (e) { fail(e); } finally { setBusy(false); }
  }
  async function book() {
    if (!draft || !inv) return; setBusy(true);
    try {
      const r = await applyInvoiceDraft(draft.id, {
        supplierId: typeof supplierId === "number" ? supplierId : null, newSupplierName: supplierId === "new" ? inv.supplier ?? null : null,
        purchaseDate: inv.date ? new Date(inv.date).toISOString() : null, invoiceNumber: inv.invoiceNumber ?? null,
        lines: inv.lines.filter((l) => l.ingredientId && l.quantity > 0).map((l) => ({ ingredientId: l.ingredientId!, quantity: l.quantity, unitCost: l.unitCost, notes: l.name })),
      });
      setNotice({ kind: "ok", text: r.message }); setDraft(null); setInv(null); setFile(null);
    } catch (e) { fail(e); } finally { setBusy(false); }
  }
  const setLine = (i: number, p: Partial<Line>) => setInv((v) => v && { ...v, lines: v.lines.map((l, j) => (j === i ? { ...l, ...p } : l)) });
  const unmatched = inv?.lines.filter((l) => !l.ingredientId).length ?? 0;
  return (
    <div className="p-4 sm:p-6">
      <PageMeta title="AI Invoice Scan | Axis" description="Scan supplier invoices" />
      <PageBreadcrumb pageTitle={t("AI Invoice Scan")} />
      {notice && <Notice kind={notice.kind} text={notice.text} onClose={() => setNotice(null)} />}
      <Card title={t("Upload a supplier invoice photo or PDF")} className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <input type="file" accept="image/*,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-2 dark:text-gray-300 dark:file:bg-gray-800 dark:file:text-gray-200" aria-label="Invoice file" />
          <button type="button" className={btnPrimary} disabled={!file || busy} onClick={() => void read()}>{busy && !draft ? t("Loading…") : t("Read the invoice")}</button>
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Needs the AI key in Integrations. Nothing is booked until you press "Book the purchase".</p>
      </Card>
      {inv && (
        <Card title={`${inv.supplier ?? "?"} · #${inv.invoiceNumber ?? "—"} · ${inv.date ?? ""}`} actions={<div className="flex gap-2"><button type="button" className={btnPrimary} disabled={busy || inv.lines.every((l) => !l.ingredientId)} onClick={() => void book()}>{t("Book the purchase")}</button><button type="button" className={btnDanger} onClick={() => { if (draft) void discardDraft(draft.id); setDraft(null); setInv(null); }}>{t("Discard")}</button></div>}>
          <div className="mb-3 grid gap-2 sm:grid-cols-3">
            <select className={inputCls} value={supplierId} onChange={(e) => setSupplierId(e.target.value === "new" ? "new" : e.target.value === "" ? "" : Number(e.target.value))} aria-label="Supplier">
              <option value="">No supplier</option>{inv.supplier && <option value="new">New supplier: {inv.supplier}</option>}{sups.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input className={inputCls} placeholder="Invoice number" value={inv.invoiceNumber ?? ""} onChange={(e) => setInv({ ...inv, invoiceNumber: e.target.value })} />
            <input type="date" className={inputCls} value={inv.date ?? ""} onChange={(e) => setInv({ ...inv, date: e.target.value })} />
          </div>
          {unmatched > 0 && <p className="mb-2 text-sm text-amber-700 dark:text-amber-400">{unmatched} line(s) not matched: pick the ingredient, or leave empty to skip.</p>}
          {inv.currency && inv.currency !== "USD" && <p className="mb-2 text-sm text-amber-700 dark:text-amber-400">The invoice is in {inv.currency}: enter unit costs in USD.</p>}
          <table className="min-w-full"><thead><tr><th className={th}>On the invoice</th><th className={th}>{t("Ingredient")}</th><th className={th}>{t("Quantity")}</th><th className={th}>{t("Unit cost")}</th></tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {inv.lines.map((l, i) => (
                <tr key={i}>
                  <td className={td}>{l.name}{l.unit ? <span className="text-xs text-gray-500"> ({l.unit})</span> : null}</td>
                  <td className={td}><select className={inputCls} value={l.ingredientId ?? ""} onChange={(e) => setLine(i, { ingredientId: e.target.value ? Number(e.target.value) : null })} aria-label={t("Ingredient")}><option value="">—</option>{ings.map((g) => <option key={g.id} value={g.id}>{g.name}{g.unit ? ` (${g.unit})` : ""}</option>)}</select></td>
                  <td className={td}><input className={`${inputCls} w-24`} inputMode="decimal" value={l.quantity} onChange={(e) => setLine(i, { quantity: Number(e.target.value) || 0 })} /></td>
                  <td className={td}><input className={`${inputCls} w-24`} inputMode="decimal" value={l.unitCost} onChange={(e) => setLine(i, { unitCost: Number(e.target.value) || 0 })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
