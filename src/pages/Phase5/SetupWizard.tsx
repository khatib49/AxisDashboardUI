import { useEffect, useState } from "react";
import { Link } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { Card, Notice, btnPrimary, inputCls } from "../../components/phase4/ui";
import { useI18n } from "../../i18n/I18nProvider";
import AiMenuImport from "./AiMenuImport";
import { getSetupStatus, saveBusiness, type SetupStatus } from "../../services/phase5Service";

/** Setup in minutes: business details, language, menu import, and a live checklist. */
export default function SetupWizard() {
  const { t, lang, setLang } = useI18n();
  const [st, setSt] = useState<SetupStatus | null>(null);
  const [biz, setBiz] = useState({ name: "", phone: "", address: "", timeZone: "Asia/Beirut" });
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const reload = () => getSetupStatus().then((s) => { setSt(s); setBiz((b) => ({ ...b, name: b.name || s.businessName || "" })); }).catch((e) => setNotice({ kind: "error", text: (e as Error).message }));
  useEffect(() => { void reload(); }, []);
  async function save() {
    try { setSt(await saveBusiness({ ...biz, language: lang })); setNotice({ kind: "ok", text: t("Save") + " ✓" }); } catch (e) { setNotice({ kind: "error", text: (e as Error).message }); }
  }
  const pct = st ? Math.round((st.done / st.total) * 100) : 0;
  return (
    <div className="p-4 sm:p-6">
      <PageMeta title="Setup | Axis" description="Set up Axis" />
      <PageBreadcrumb pageTitle={t("Setup")} />
      {notice && <Notice kind={notice.kind} text={notice.text} onClose={() => setNotice(null)} />}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={t("Your setup checklist")} className="lg:col-span-1">
          <div className="mb-3 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={t("Setup progress")}><div className="h-full bg-brand-500" style={{ width: `${pct}%` }} /></div>
          <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">{st?.done ?? 0} / {st?.total ?? 0} {t("Done")}</p>
          <ul className="space-y-2">
            {st?.steps.map((s) => (
              <li key={s.key} className="flex items-start gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${s.done ? "bg-green-500 text-white" : "border border-gray-300 dark:border-gray-600"}`}>{s.done ? "✓" : ""}</span>
                <div className="min-w-0 flex-1"><p className="text-sm font-medium text-gray-800 dark:text-white/90">{t(s.title)}</p><p className="text-xs text-gray-500 dark:text-gray-400">{s.detail}</p></div>
                {s.link && !s.done && <Link to={s.link} className="text-sm text-brand-600 underline dark:text-brand-400">{t("Go")}</Link>}
              </li>
            ))}
          </ul>
        </Card>
        <div className="space-y-4 lg:col-span-2">
          <Card title={t("Business details")}>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-gray-600 dark:text-gray-400">{t("Business name")}<input className={`${inputCls} mt-1`} value={biz.name} onChange={(e) => setBiz({ ...biz, name: e.target.value })} /></label>
              <label className="text-xs text-gray-600 dark:text-gray-400">{t("Phone")}<input className={`${inputCls} mt-1`} value={biz.phone} onChange={(e) => setBiz({ ...biz, phone: e.target.value })} /></label>
              <label className="text-xs text-gray-600 dark:text-gray-400">{t("Address")}<input className={`${inputCls} mt-1`} value={biz.address} onChange={(e) => setBiz({ ...biz, address: e.target.value })} /></label>
              <label className="text-xs text-gray-600 dark:text-gray-400">{t("Time zone")}<input className={`${inputCls} mt-1`} value={biz.timeZone} onChange={(e) => setBiz({ ...biz, timeZone: e.target.value })} /></label>
              <label className="text-xs text-gray-600 dark:text-gray-400">{t("Language")}
                <select className={`${inputCls} mt-1`} value={lang} onChange={(e) => setLang(e.target.value as "en" | "ar")}><option value="en">{t("English")}</option><option value="ar">{t("Arabic")}</option></select></label>
            </div>
            <button type="button" className={`${btnPrimary} mt-3`} disabled={!biz.name.trim()} onClick={() => void save()}>{t("Save")}</button>
          </Card>
          <AiMenuImport embedded />
        </div>
      </div>
    </div>
  );
}
