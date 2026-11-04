import { useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { Card, Notice, btnPrimary, inputCls, td, th } from "../../components/phase4/ui";
import SettingsFields from "./SettingsFields";
import { useI18n } from "../../i18n/I18nProvider";
import { listIntegrationSettings, saveIntegrationSetting, type IntegrationSetting } from "../../services/phase5Service";

const GROUPS: { title: string; fields: { key: string; label: string; secret?: boolean; placeholder?: string }[] }[] = [
  { title: "AI", fields: [{ key: "Anthropic.ApiKey", label: "Anthropic API key", secret: true }, { key: "Anthropic.Model", label: "Model (optional)", placeholder: "default" }] },
  { title: "Payments", fields: [{ key: "Whish.Channel", label: "Whish channel" }, { key: "Whish.Secret", label: "Whish secret", secret: true }, { key: "CardTerminal.Cloud.BaseUrl", label: "Card terminal API URL" }, { key: "CardTerminal.Cloud.ApiKey", label: "Card terminal API key", secret: true }] },
  { title: "Messages", fields: [{ key: "WhatsApp.PhoneNumberId", label: "WhatsApp phone number id" }, { key: "WhatsApp.AccessToken", label: "WhatsApp access token", secret: true }, { key: "Alerts.Emails", label: "Alert emails", placeholder: "owner@…" }, { key: "Alerts.WhatsAppTemplate", label: "WhatsApp alert template (outside 24 h)" }] },
  { title: "Booking", fields: [{ key: "Booking.OpenHour", label: "Opens at hour", placeholder: "12" }, { key: "Booking.CloseHour", label: "Closes at hour (24 = midnight)", placeholder: "24" }, { key: "Booking.RoomIds", label: "Bookable room ids (empty = all)" }, { key: "Booking.RequireApproval", label: "Staff approve web bookings (true/false)" }] },
];

/** All integration keys: the common ones grouped, plus every stored key. */
export default function IntegrationsAdmin() {
  const { t } = useI18n();
  const [all, setAll] = useState<IntegrationSetting[]>([]);
  const [key, setKey] = useState(""); const [val, setVal] = useState("");
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const reload = () => listIntegrationSettings().then(setAll).catch((e) => setNotice({ kind: "error", text: (e as Error).message }));
  useEffect(() => { void reload(); }, []);
  return (
    <div className="p-4 sm:p-6">
      <PageMeta title="Integrations | Axis" description="Integration settings" />
      <PageBreadcrumb pageTitle={t("Integrations")} />
      {notice && <Notice kind={notice.kind} text={notice.text} onClose={() => setNotice(null)} />}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {GROUPS.map((g) => <Card key={g.title} title={g.title}><SettingsFields fields={g.fields} onSaved={(m) => { setNotice({ kind: "ok", text: m }); void reload(); }} /></Card>)}
      </div>
      <Card title="All keys" className="mt-4">
        <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
          <input className={inputCls} placeholder="Key" value={key} onChange={(e) => setKey(e.target.value)} />
          <input className={inputCls} placeholder="Value" value={val} onChange={(e) => setVal(e.target.value)} />
          <button type="button" className={btnPrimary} disabled={!key.trim()} onClick={() => void saveIntegrationSetting(key.trim(), val).then(() => { setKey(""); setVal(""); setNotice({ kind: "ok", text: "Saved." }); return reload(); }).catch((e) => setNotice({ kind: "error", text: (e as Error).message }))}>{t("Save")}</button>
        </div>
        <div className="max-h-96 overflow-auto">
          <table className="min-w-full"><thead><tr><th className={th}>Key</th><th className={th}>Value</th><th className={th}>Updated</th></tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">{all.map((s) => <tr key={s.key}><td className={`${td} font-mono text-xs`}>{s.key}</td><td className={`${td} max-w-xs truncate`}>{s.isSecret ? (s.hasValue ? "••••••" : "") : s.value}</td><td className={td}>{s.updatedOn ? new Date(s.updatedOn).toLocaleString() : ""}</td></tr>)}</tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
