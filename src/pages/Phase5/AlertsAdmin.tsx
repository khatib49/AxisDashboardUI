import { useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { Card, Notice, btnDanger, btnGhost, btnPrimary, inputCls, td, th } from "../../components/phase4/ui";
import { useI18n } from "../../i18n/I18nProvider";
import { createAlert, deleteAlert, listAlertEvents, listAlertMetrics, listAlerts, testAlert, updateAlert, type AlertEvent, type AlertMetric, type AlertRule, type AlertRuleUpsert } from "../../services/phase5Service";

const CHANNELS = ["Telegram", "WhatsApp", "Email", "InApp"];
const EMPTY: AlertRuleUpsert & { id?: number } = { name: "", metric: "SalesToday", comparator: "Below", threshold: 100, windowMinutes: 30, fromHour: 0, toHour: 0, channels: "Telegram,InApp", recipients: "", cooldownMinutes: 60, isActive: true };

/** Owner alerts: pick a metric, a threshold, hours and where the message goes. */
export default function AlertsAdmin() {
  const { t } = useI18n();
  const [metrics, setMetrics] = useState<AlertMetric[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [notice, setNotice] = useState<{ kind: "ok" | "error" | "info"; text: string } | null>(null);
  const fail = (e: unknown) => setNotice({ kind: "error", text: (e as Error).message });
  const reload = () => Promise.all([listAlerts().then(setRules), listAlertEvents().then(setEvents)]).catch(fail);
  useEffect(() => { void listAlertMetrics().then(setMetrics).catch(fail); void reload(); }, []);
  const label = (m: string) => metrics.find((x) => x.metric === m)?.label ?? m;
  const chans = form.channels.split(",").filter(Boolean);

  async function save() {
    try { const d = { ...form, recipients: form.recipients || null }; if (form.id) await updateAlert(form.id, d); else await createAlert(d); setNotice({ kind: "ok", text: "Alert saved." }); setForm(EMPTY); await reload(); } catch (e) { fail(e); }
  }
  const presets: (AlertRuleUpsert & { title: string })[] = [
    { title: "Sales below $300 after 8 pm", name: "Slow day", metric: "SalesToday", comparator: "Below", threshold: 300, windowMinutes: 30, fromHour: 20, toHour: 23, channels: "Telegram,InApp", recipients: "", cooldownMinutes: 1440, isActive: true },
    { title: "Void requests waiting", name: "Voids waiting", metric: "VoidRequestsPending", comparator: "Above", threshold: 0, windowMinutes: 30, fromHour: 0, toHour: 0, channels: "Telegram,InApp", recipients: "", cooldownMinutes: 30, isActive: true },
    { title: "Cash variance over $10", name: "Cash variance", metric: "CashVariance", comparator: "Above", threshold: 10, windowMinutes: 60, fromHour: 0, toHour: 0, channels: "Telegram,WhatsApp,InApp", recipients: "", cooldownMinutes: 60, isActive: true },
    { title: "Delivery waiting 15 min", name: "Delivery waiting", metric: "DeliveryPendingOlderThan", comparator: "Above", threshold: 0, windowMinutes: 15, fromHour: 0, toHour: 0, channels: "Telegram,InApp", recipients: "", cooldownMinutes: 30, isActive: true },
  ];
  return (
    <div className="p-4 sm:p-6">
      <PageMeta title="Owner Alerts | Axis" description="Owner alerts" />
      <PageBreadcrumb pageTitle={t("Owner Alerts")} />
      {notice && <Notice kind={notice.kind} text={notice.text} onClose={() => setNotice(null)} />}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={form.id ? t("Edit") : t("New alert")}>
          <div className="mb-3 flex flex-wrap gap-1">{presets.map((p) => <button key={p.title} type="button" className="rounded-full border border-gray-300 px-2 py-1 text-xs text-gray-700 dark:border-gray-700 dark:text-gray-300" onClick={() => setForm({ ...p })}>{p.title}</button>)}</div>
          <div className="space-y-2">
            <input className={inputCls} placeholder={t("Name")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <label className="block text-xs text-gray-600 dark:text-gray-400">{t("When")}
              <select className={`${inputCls} mt-1`} value={form.metric} onChange={(e) => setForm({ ...form, metric: e.target.value })}>{metrics.map((m) => <option key={m.metric} value={m.metric}>{m.label}</option>)}</select></label>
            <div className="grid grid-cols-2 gap-2">
              <select className={inputCls} value={form.comparator} onChange={(e) => setForm({ ...form, comparator: e.target.value as "Above" | "Below" })}><option value="Above">{t("is above")}</option><option value="Below">{t("is below")}</option></select>
              <input type="number" className={inputCls} value={form.threshold} onChange={(e) => setForm({ ...form, threshold: Number(e.target.value) || 0 })} aria-label="Threshold" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <label className="text-xs text-gray-600 dark:text-gray-400">{t("Window (minutes)")}<input type="number" className={`${inputCls} mt-1`} value={form.windowMinutes} onChange={(e) => setForm({ ...form, windowMinutes: Number(e.target.value) || 30 })} /></label>
              <label className="text-xs text-gray-600 dark:text-gray-400">{t("Only between")}<input type="number" min={0} max={23} className={`${inputCls} mt-1`} value={form.fromHour} onChange={(e) => setForm({ ...form, fromHour: Number(e.target.value) || 0 })} /></label>
              <label className="text-xs text-gray-600 dark:text-gray-400">&nbsp;<input type="number" min={0} max={24} className={`${inputCls} mt-1`} value={form.toHour} onChange={(e) => setForm({ ...form, toHour: Number(e.target.value) || 0 })} /></label>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">Same start and end hour = all day.</p>
            <div className="flex flex-wrap gap-3 text-sm text-gray-700 dark:text-gray-300">{t("Send to")}: {CHANNELS.map((c) => <label key={c} className="flex items-center gap-1"><input type="checkbox" checked={chans.includes(c)} onChange={(e) => setForm({ ...form, channels: (e.target.checked ? [...chans, c] : chans.filter((x) => x !== c)).join(",") })} />{c}</label>)}</div>
            <input className={inputCls} placeholder={`${t("Extra recipients")}: chat ids, +961…, emails`} value={form.recipients ?? ""} onChange={(e) => setForm({ ...form, recipients: e.target.value })} />
            <label className="block text-xs text-gray-600 dark:text-gray-400">{t("Cooldown (minutes)")}<input type="number" className={`${inputCls} mt-1`} value={form.cooldownMinutes} onChange={(e) => setForm({ ...form, cooldownMinutes: Number(e.target.value) || 60 })} /></label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> {t("Active")}</label>
            <div className="flex gap-2"><button type="button" className={btnPrimary} disabled={!form.name.trim() || chans.length === 0} onClick={() => void save()}>{t("Save")}</button>{form.id && <button type="button" className={btnGhost} onClick={() => setForm(EMPTY)}>{t("Cancel")}</button>}</div>
          </div>
        </Card>
        <div className="space-y-4 lg:col-span-2">
          <Card title={t("Owner Alerts")}>
            <table className="min-w-full"><thead><tr><th className={th}>{t("Name")}</th><th className={th}>{t("When")}</th><th className={th}>{t("Send to")}</th><th className={th}></th></tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {rules.length === 0 && <tr><td className={td} colSpan={4}>—</td></tr>}
                {rules.map((r) => (
                  <tr key={r.id} className={r.isActive ? "" : "opacity-60"}>
                    <td className={td}>{r.name}<span className="block text-xs text-gray-500 dark:text-gray-400">{r.lastFiredOn ? `last ${new Date(r.lastFiredOn).toLocaleString()}` : "never fired"}</span></td>
                    <td className={td}>{label(r.metric)} {r.comparator === "Below" ? "<" : ">"} {r.threshold}{r.fromHour !== r.toHour ? ` · ${r.fromHour}:00–${r.toHour}:00` : ""}</td>
                    <td className={td}>{r.channels.replace(/,/g, ", ")}</td>
                    <td className={td}><div className="flex flex-wrap gap-1">
                      <button type="button" className={btnGhost} onClick={() => void testAlert(r.id, false).then((x) => setNotice({ kind: "info", text: `${x.triggered ? "Would fire" : "Quiet"}: ${x.message}` })).catch(fail)}>{t("Check now")}</button>
                      <button type="button" className={btnGhost} onClick={() => void testAlert(r.id, true).then((x) => setNotice({ kind: "info", text: x.message })).catch(fail)}>{t("Send a test")}</button>
                      <button type="button" className={btnGhost} onClick={() => setForm({ ...r, recipients: r.recipients ?? "" })}>{t("Edit")}</button>
                      <button type="button" className={btnDanger} onClick={() => { if (window.confirm("Delete this alert?")) void deleteAlert(r.id).then(reload).catch(fail); }}>{t("Delete")}</button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card title={t("Recent alerts")}>
            <ul className="max-h-80 divide-y divide-gray-100 overflow-auto dark:divide-gray-800">
              {events.length === 0 && <li className="py-2 text-sm text-gray-500 dark:text-gray-400">—</li>}
              {events.map((e) => <li key={e.id} className="py-2 text-sm text-gray-800 dark:text-white/90"><b>{e.ruleName}</b> · {e.message}<span className="block text-xs text-gray-500 dark:text-gray-400">{new Date(e.firedOn).toLocaleString()} · {e.delivery}</span></li>)}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
