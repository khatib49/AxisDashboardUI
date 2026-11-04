import { useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { Card, ItemPicker, Notice, btnDanger, btnGhost, btnPrimary, inputCls, money, pct, td, th } from "../../components/phase4/ui";
import { getCategoriesByType, type CategoryDto } from "../../services/categoryService";
import {
  createUpsellRule, deleteUpsellRule, getUpsellStats, listUpsellPairs, listUpsellRules, rebuildUpsells, updateUpsellRule,
  type UpsellPairDto, type UpsellRebuildResultDto, type UpsellRuleDto, type UpsellStatsDto,
} from "../../services/phase4Service";

type Form = { id?: number; trigger: { id: number; name: string } | null; categoryId: number | null; suggest: { id: number; name: string } | null; message: string; priority: number; isActive: boolean };
const EMPTY: Form = { trigger: null, categoryId: null, suggest: null, message: "", priority: 0, isActive: true };

/** Admin: upsell results, manager rules and the pairs learned from sales. */
export default function UpsellsAdmin() {
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState<UpsellStatsDto | null>(null);
  const [rules, setRules] = useState<UpsellRuleDto[]>([]);
  const [pairs, setPairs] = useState<UpsellPairDto[]>([]);
  const [cats, setCats] = useState<CategoryDto[]>([]);
  const [form, setForm] = useState<Form>(EMPTY);
  const [rebuild, setRebuild] = useState<UpsellRebuildResultDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error" | "info"; text: string } | null>(null);
  const fail = (e: unknown) => setNotice({ kind: "error", text: (e as Error).message });

  const reload = () => Promise.all([listUpsellRules().then(setRules), listUpsellPairs().then(setPairs)]).catch(fail);
  useEffect(() => { void reload(); getCategoriesByType("item", 1, 200).then((r) => setCats((r as { data?: CategoryDto[] }).data ?? [])).catch(() => setCats([])); }, []);
  useEffect(() => { getUpsellStats(days).then(setStats).catch(fail); }, [days]);

  async function save() {
    if (!form.suggest) return;
    setBusy(true); setNotice(null);
    const dto = { triggerItemId: form.trigger?.id ?? null, triggerCategoryId: form.trigger ? null : form.categoryId, suggestItemId: form.suggest.id, message: form.message.trim() || null, priority: form.priority, isActive: form.isActive };
    try {
      if (form.id) await updateUpsellRule(form.id, dto); else await createUpsellRule(dto);
      setNotice({ kind: "ok", text: form.id ? "Rule updated." : "Rule created." });
      setForm(EMPTY); await reload();
    } catch (e) { fail(e); } finally { setBusy(false); }
  }

  async function relearn() {
    setBusy(true); setNotice(null);
    try { const r = await rebuildUpsells(90); setRebuild(r); await reload(); } catch (e) { fail(e); } finally { setBusy(false); }
  }

  const edit = (r: UpsellRuleDto) => setForm({
    id: r.id, trigger: r.triggerItemId ? { id: r.triggerItemId, name: r.triggerItemName ?? `#${r.triggerItemId}` } : null,
    categoryId: r.triggerCategoryId ?? null, suggest: { id: r.suggestItemId, name: r.suggestItemName }, message: r.message ?? "", priority: r.priority, isActive: r.isActive,
  });

  return (
    <div className="p-4 sm:p-6">
      <PageMeta title="Upsells | Axis" description="Upsell suggestions at the till, kiosk, QR menu and shop" />
      <PageBreadcrumb pageTitle="Upsells" />
      {notice && <Notice kind={notice.kind} text={notice.text} onClose={() => setNotice(null)} />}

      <Card title="Results" className="mb-4" actions={
        <select className={`${inputCls} w-40`} value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Period">
          <option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option>
        </select>}>
        {stats && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[["Shown", String(stats.shown)], ["Added", String(stats.accepted)], ["Accept rate", pct(stats.acceptRate)], ["Extra sales", money(stats.acceptedRevenue)]].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-gray-50 p-3 dark:bg-white/5"><p className="text-xs text-gray-500 dark:text-gray-400">{k}</p><p className="mt-1 text-xl font-semibold text-gray-900 dark:text-white/90">{v}</p></div>
              ))}
            </div>
            {stats.byChannel.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full"><thead><tr><th className={th}>Channel</th><th className={th}>Shown</th><th className={th}>Added</th><th className={th}>Rate</th><th className={th}>Extra sales</th></tr></thead>
                  <tbody>{stats.byChannel.map((c) => <tr key={c.channel}><td className={td}>{c.channel}</td><td className={td}>{c.shown}</td><td className={td}>{c.accepted}</td><td className={td}>{pct(c.acceptRate)}</td><td className={td}>{money(c.acceptedRevenue)}</td></tr>)}</tbody>
                </table>
              </div>
            )}
          </>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={form.id ? "Edit rule" : "New rule"}>
          <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">Rules always show before learned suggestions. Pick a trigger item, or a whole category.</p>
          <div className="space-y-3">
            <ItemPicker label="When the cart has this item" value={form.trigger} onChange={(v) => setForm((f) => ({ ...f, trigger: v, categoryId: v ? null : f.categoryId }))} />
            <label className="block text-xs text-gray-600 dark:text-gray-400">…or any item of this category
              <select className={`${inputCls} mt-1`} value={form.categoryId ?? ""} disabled={!!form.trigger} onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value ? Number(e.target.value) : null }))}>
                <option value="">No category</option>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            {form.trigger && <button type="button" className="text-xs text-gray-500 underline" onClick={() => setForm((f) => ({ ...f, trigger: null }))}>Use a category instead</button>}
            <ItemPicker label="Suggest this item" value={form.suggest} onChange={(v) => setForm((f) => ({ ...f, suggest: v }))} />
            <label className="block text-xs text-gray-600 dark:text-gray-400">Message (optional)
              <input className={`${inputCls} mt-1`} maxLength={200} placeholder="Add a croissant for $3?" value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} />
            </label>
            <div className="flex items-end gap-3">
              <label className="block text-xs text-gray-600 dark:text-gray-400">Priority
                <input type="number" className={`${inputCls} mt-1 w-24`} value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) || 0 }))} />
              </label>
              <label className="flex items-center gap-2 pb-2 text-sm text-gray-700 dark:text-gray-300"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} /> Active</label>
            </div>
            <div className="flex gap-2">
              <button type="button" className={btnPrimary} disabled={busy || !form.suggest || (!form.trigger && !form.categoryId)} onClick={() => void save()}>{form.id ? "Save rule" : "Add rule"}</button>
              {form.id && <button type="button" className={btnGhost} onClick={() => setForm(EMPTY)}>Cancel</button>}
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full"><thead><tr><th className={th}>When</th><th className={th}>Suggest</th><th className={th}>Priority</th><th className={th}></th></tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {rules.length === 0 && <tr><td className={td} colSpan={4}>No rules yet.</td></tr>}
                {rules.map((r) => (
                  <tr key={r.id} className={r.isActive ? "" : "opacity-60"}>
                    <td className={td}>{r.triggerItemName ?? `Category: ${r.triggerCategoryName}`}</td>
                    <td className={td}>{r.suggestItemName}{r.message && <span className="block text-xs text-gray-500 dark:text-gray-400">{r.message}</span>}</td>
                    <td className={td}>{r.priority}</td>
                    <td className={td}><div className="flex gap-2"><button type="button" className={btnGhost} onClick={() => edit(r)}>Edit</button><button type="button" className={btnDanger} onClick={() => { if (window.confirm("Delete this rule?")) void deleteUpsellRule(r.id).then(reload).catch(fail); }}>Delete</button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title={`Learned from sales (${pairs.length})`} actions={<button type="button" className={btnGhost} disabled={busy} onClick={() => void relearn()}>{busy ? "Learning…" : "Relearn now"}</button>}>
          <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">Axis looks at paid invoices of the last 90 days every night and keeps the items guests really order together. When an AI key is set in Integrations, AI writes the short pitch.</p>
          {rebuild && <Notice kind="info" text={`Scanned ${rebuild.invoicesScanned} invoices, kept ${rebuild.pairsKept} pairs, wrote ${rebuild.pitchesWritten} AI pitches.${rebuild.aiNote ? " " + rebuild.aiNote : ""}`} />}
          <div className="max-h-[32rem] overflow-auto">
            <table className="min-w-full"><thead><tr><th className={th}>In cart</th><th className={th}>Suggest</th><th className={th}>Orders</th><th className={th}>Take it</th><th className={th}>Lift</th></tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {pairs.length === 0 && <tr><td className={td} colSpan={5}>Nothing learned yet. Pairs appear once at least 3 paid invoices share two items.</td></tr>}
                {pairs.map((p) => (
                  <tr key={`${p.itemId}-${p.suggestItemId}`}>
                    <td className={td}>{p.itemName}</td>
                    <td className={td}>{p.suggestItemName}{p.pitch && <span className="block text-xs text-gray-500 dark:text-gray-400">{p.pitch}</span>}</td>
                    <td className={td}>{p.pairCount}</td><td className={td}>{pct(p.confidence)}</td><td className={td}>{p.lift.toFixed(1)}×</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
