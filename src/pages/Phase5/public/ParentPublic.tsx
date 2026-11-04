import { useEffect, useState } from "react";
import { useParams } from "react-router";
import PublicShell, { fmtTime, pcard } from "./PublicShell";
import { useI18n } from "../../../i18n/I18nProvider";
import { getParentView, type ParentView } from "../../../services/phase5Service";

/** Parent's read-only view of the child's wallet. */
export default function ParentPublic() {
  const { token = "" } = useParams();
  const { t, lang } = useI18n();
  const [v, setV] = useState<ParentView | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => { getParentView(token).then(setV).catch(() => setMissing(true)); }, [token]);
  if (missing) return <PublicShell title="Wallet"><p className={pcard}>—</p></PublicShell>;
  if (!v) return <PublicShell title="Wallet"><p className="text-gray-500">{t("Loading…")}</p></PublicShell>;
  const tile = (k: string, val: string) => <div className={pcard}><p className="text-xs text-gray-500 dark:text-gray-400">{t(k)}</p><p className="mt-1 text-2xl font-bold">{val}</p></div>;
  return (
    <PublicShell title="Wallet">
      <p className="mb-3 text-lg font-semibold">{v.childName}</p>
      <div className="mb-4 grid grid-cols-2 gap-3">
        {tile("Balance", `$${v.balance.toFixed(2)}`)}
        {tile("Spent today", `$${v.spentToday.toFixed(2)}`)}
        {tile("Daily limit", v.dailyLimit != null ? `$${v.dailyLimit.toFixed(2)}` : t("No limit"))}
        {tile("Left today", v.remainingToday != null ? `$${v.remainingToday.toFixed(2)}` : "—")}
      </div>
      <section className={pcard}>
        <h2 className="mb-2 font-semibold">{t("Recent activity")}</h2>
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {v.recent.map((r, i) => (
            <li key={i} className="flex justify-between py-2 text-sm">
              <span>{t(r.type)}<span className="block text-xs text-gray-500 dark:text-gray-400">{fmtTime(r.on, lang)}</span></span>
              <span className={r.type === "Spend" ? "text-red-600" : "text-green-600"}>{r.type === "Spend" ? "−" : "+"}${r.amount.toFixed(2)}</span>
            </li>
          ))}
          {v.recent.length === 0 && <li className="py-2 text-sm text-gray-500">—</li>}
        </ul>
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">{t("Top up at the counter.")}</p>
      </section>
    </PublicShell>
  );
}
