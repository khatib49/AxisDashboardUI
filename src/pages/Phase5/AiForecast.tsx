import { useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { Card, Notice, inputCls, td, th } from "../../components/phase4/ui";
import { useI18n } from "../../i18n/I18nProvider";
import { getForecast, type Forecast } from "../../services/phase5Service";

/** Sales forecast per item and the ingredients to buy for it. */
export default function AiForecast() {
  const { t, lang } = useI18n();
  const [days, setDays] = useState(7);
  const [f, setF] = useState<Forecast | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setF(null); getForecast(days).then(setF).catch((e) => setErr((e as Error).message)); }, [days]);
  const dayLabel = (iso: string) => new Date(iso).toLocaleDateString(lang === "ar" ? "ar-LB" : "en-GB", { weekday: "short", day: "numeric" });
  return (
    <div className="p-4 sm:p-6">
      <PageMeta title="AI Forecast | Axis" description="Sales forecast" />
      <PageBreadcrumb pageTitle={t("AI Forecast")} />
      {err && <Notice kind="error" text={err} onClose={() => setErr(null)} />}
      <Card title={t("Forecast")} className="mb-4" actions={<select className={`${inputCls} w-40`} value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Days">{[3, 7, 14].map((d) => <option key={d} value={d}>{t("Next {n} days", { n: d })}</option>)}</select>}>
        <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">Each day uses the same weekday of the last {f?.weeksOfHistory ?? 8} weeks of paid sales; recent weeks count more.</p>
        {!f ? <p className="text-sm text-gray-500">{t("Loading…")}</p> : f.items.length === 0 ? <p className="text-sm text-gray-500 dark:text-gray-400">Not enough sales history yet.</p> : (
          <div className="max-h-[28rem] overflow-auto">
            <table className="min-w-full"><thead><tr><th className={th}>Item</th>{f.items[0].days.map((d) => <th key={d.date} className={th}>{dayLabel(d.date)}</th>)}<th className={th}>{t("Total")}</th></tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">{f.items.slice(0, 60).map((i) => <tr key={i.itemId}><td className={td}>{i.name}</td>{i.days.map((d) => <td key={d.date} className={td}>{d.quantity}</td>)}<td className={`${td} font-semibold`}>{i.total.toFixed(1)}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </Card>
      <Card title={t("Ingredients to buy")}>
        {!f ? null : f.ingredients.length === 0 ? <p className="text-sm text-gray-500 dark:text-gray-400">No recipes linked to the forecast items.</p> : (
          <table className="min-w-full"><thead><tr><th className={th}>{t("Ingredient")}</th><th className={th}>{t("Needed")}</th><th className={th}>{t("On hand")}</th><th className={th}>Reorder level</th><th className={th}>{t("Buy")}</th></tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">{f.ingredients.map((i) => <tr key={i.ingredientId}><td className={td}>{i.name}</td><td className={td}>{i.needed} {i.unit}</td><td className={td}>{i.onHand} {i.unit}</td><td className={td}>{i.reorderLevel ?? ""}</td><td className={`${td} font-semibold ${i.suggestedPurchase > 0 ? "text-amber-600" : ""}`}>{i.suggestedPurchase > 0 ? `${i.suggestedPurchase} ${i.unit}` : "—"}</td></tr>)}</tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
