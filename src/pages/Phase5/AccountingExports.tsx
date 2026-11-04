import { useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { Card, Notice, btnGhost, btnPrimary, inputCls } from "../../components/phase4/ui";
import { useI18n } from "../../i18n/I18nProvider";
import { downloadExport } from "../../services/phase5Service";

const FORMATS = [
  { v: "xero", l: "Xero (manual journal import)" },
  { v: "quickbooks", l: "QuickBooks Online (journal entry import)" },
  { v: "odoo", l: "Odoo (journal entries import)" },
  { v: "csv", l: "Plain CSV (Excel)" },
];
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Posted journal entries for the accountant's software, plus the chart of accounts. */
export default function AccountingExports() {
  const { t } = useI18n();
  const now = new Date();
  const [from, setFrom] = useState(iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)));
  const [to, setTo] = useState(iso(new Date(now.getFullYear(), now.getMonth(), 0)));
  const [format, setFormat] = useState("xero");
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  async function go() {
    try {
      const end = new Date(to + "T00:00:00Z"); end.setUTCDate(end.getUTCDate() + 1);
      const name = await downloadExport(`/accounting/exports/journals/${format}`, { from: new Date(from + "T00:00:00Z").toISOString(), to: end.toISOString() });
      setNotice({ kind: "ok", text: `Downloaded ${name}` });
    } catch (e) { setNotice({ kind: "error", text: (e as Error).message }); }
  }
  return (
    <div className="p-4 sm:p-6">
      <PageMeta title="Accounting Exports | Axis" description="Export journals" />
      <PageBreadcrumb pageTitle={t("Accounting Exports")} />
      {notice && <Notice kind={notice.kind} text={notice.text} onClose={() => setNotice(null)} />}
      <Card title={t("Export journals")}>
        <div className="grid items-end gap-3 sm:grid-cols-4">
          <label className="text-xs text-gray-600 dark:text-gray-400">{t("From")}<input type="date" className={`${inputCls} mt-1`} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="text-xs text-gray-600 dark:text-gray-400">{t("To")}<input type="date" className={`${inputCls} mt-1`} value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <label className="text-xs text-gray-600 dark:text-gray-400">{t("Format")}<select className={`${inputCls} mt-1`} value={format} onChange={(e) => setFormat(e.target.value)}>{FORMATS.map((f) => <option key={f.v} value={f.v}>{f.l}</option>)}</select></label>
          <button type="button" className={btnPrimary} onClick={() => void go()}>{t("Download")}</button>
        </div>
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">Only posted entries that are not voided. Account codes are the Axis numbers: map them once in the accountant's software, or import the chart of accounts first.</p>
        <button type="button" className={`${btnGhost} mt-3`} onClick={() => void downloadExport("/accounting/exports/accounts", {}).then((n) => setNotice({ kind: "ok", text: `Downloaded ${n}` })).catch((e) => setNotice({ kind: "error", text: (e as Error).message }))}>{t("Chart of accounts")} (CSV)</button>
      </Card>
    </div>
  );
}
