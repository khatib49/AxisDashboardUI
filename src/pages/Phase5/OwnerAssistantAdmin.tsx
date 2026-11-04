import { useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { Card, Notice, btnGhost, btnPrimary, inputCls, td, th } from "../../components/phase4/ui";
import SettingsFields from "./SettingsFields";
import { useI18n } from "../../i18n/I18nProvider";
import { allowOwnerChat, getOwnerBotStatus, ownerBotAsk, ownerBotSendSummary, ownerBotSummary, setTelegramWebhook, type OwnerBotStatus } from "../../services/phase5Service";

/** Owner assistant on Telegram / WhatsApp: connect, allow chats, try a question, daily summary. */
export default function OwnerAssistantAdmin() {
  const { t } = useI18n();
  const [st, setSt] = useState<OwnerBotStatus | null>(null);
  const [q, setQ] = useState("How much did we sell today?");
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error" | "info"; text: string } | null>(null);
  const fail = (e: unknown) => setNotice({ kind: "error", text: (e as Error).message });
  const reload = () => getOwnerBotStatus().then(setSt).catch(fail);
  useEffect(() => { void reload(); void ownerBotSummary().then((s) => setAnswer(s.text)).catch(() => undefined); }, []);
  const apiBase = ((import.meta.env.VITE_API_BASE_URL as string) || "").replace(/\/api\/?$/, "") || window.location.origin;
  const dot = (ok?: boolean) => <span className={`inline-block h-2.5 w-2.5 rounded-full ${ok ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"}`} />;

  return (
    <div className="p-4 sm:p-6">
      <PageMeta title="Owner Assistant | Axis" description="Owner assistant on Telegram and WhatsApp" />
      <PageBreadcrumb pageTitle={t("Owner Assistant")} />
      {notice && <Notice kind={notice.kind} text={notice.text} onClose={() => setNotice(null)} />}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Telegram">
          <p className="mb-2 text-sm">{dot(st?.telegramConfigured)} {st?.telegramConfigured ? "Bot token set" : "Not connected"}</p>
          <ol className="mb-3 list-decimal space-y-1 ps-5 text-xs text-gray-600 dark:text-gray-400">
            <li>In Telegram, open @BotFather, send /newbot and copy the token.</li>
            <li>Paste it below and save.</li>
            <li>Press "Connect webhook" (the API must be on a public https address).</li>
            <li>Message your bot: it replies with your chat id. Allow it in the list here.</li>
          </ol>
          <SettingsFields fields={[{ key: "Telegram.BotToken", label: "Bot token", secret: true }]} onSaved={(m) => { setNotice({ kind: "ok", text: m }); void reload(); }} />
          <button type="button" className={`${btnGhost} mt-3`} disabled={!st?.telegramConfigured} onClick={() => void setTelegramWebhook(apiBase).then((u) => setNotice({ kind: "ok", text: `Webhook set: ${u}` })).catch(fail)}>Connect webhook</button>
        </Card>
        <Card title="WhatsApp">
          <p className="mb-2 text-sm">{dot(st?.whatsAppConfigured)} {st?.whatsAppConfigured ? "Cloud API set" : "Not connected"}</p>
          <p className="mb-3 text-xs text-gray-600 dark:text-gray-400">Uses the same Meta WhatsApp Cloud API as reminders. In Meta, set the webhook to <span className="break-all font-mono">{apiBase}{st?.whatsAppWebhookPath}</span> with the verify token below, and subscribe to messages.</p>
          <SettingsFields fields={[
            { key: "WhatsApp.VerifyToken", label: "Webhook verify token", placeholder: "any long random text" },
            { key: "WhatsApp.AppSecret", label: "Meta app secret (signs incoming messages)", secret: true },
            { key: "OwnerBot.AllowedWhatsAppNumbers", label: "Owner numbers", placeholder: "+96170123456, +96171…" },
          ]} onSaved={(m) => { setNotice({ kind: "ok", text: m }); void reload(); }} />
        </Card>
        <Card title="Daily summary">
          <SettingsFields fields={[
            { key: "OwnerBot.DailySummaryHour", label: "Send at hour (0-23, venue time)", placeholder: "23" },
            { key: "OwnerBot.DailySummary", label: "Turn off with false", placeholder: "true" },
            { key: "Venue.TimeZone", label: t("Time zone"), placeholder: "Asia/Beirut" },
          ]} onSaved={(m) => setNotice({ kind: "ok", text: m })} />
          <button type="button" className={`${btnGhost} mt-3`} onClick={() => void ownerBotSendSummary().then((r) => setNotice({ kind: "info", text: `Sent ${r.sent}, failed ${r.failed}. ${r.notes.join("; ")}` })).catch(fail)}>{t("Send today's summary now")}</button>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title={t("Ask a question")}>
          <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">{dot(st?.aiConfigured)} {st?.aiConfigured ? "AI ready: free questions in English or Arabic." : "No AI key: the bot answers /summary only. Add Anthropic.ApiKey in Integrations."}</p>
          <div className="flex gap-2"><input className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} /><button type="button" className={btnPrimary} disabled={busy || !q.trim()} onClick={() => { setBusy(true); void ownerBotAsk(q).then((r) => setAnswer(r.text)).catch(fail).finally(() => setBusy(false)); }}>{busy ? "…" : t("Send")}</button></div>
          {answer && <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-gray-50 p-3 text-sm text-gray-800 dark:bg-white/5 dark:text-white/90" data-testid="bot-answer">{answer}</pre>}
        </Card>
        <Card title={t("Connected chats")} actions={<button type="button" className={btnGhost} onClick={() => void reload()}>{t("Refresh")}</button>}>
          <table className="min-w-full"><thead><tr><th className={th}>Channel</th><th className={th}>Chat</th><th className={th}>{t("Status")}</th><th className={th}></th></tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {(st?.chats ?? []).length === 0 && <tr><td className={td} colSpan={4}>Message the bot once and the chat appears here.</td></tr>}
              {(st?.chats ?? []).map((c) => (
                <tr key={c.id}><td className={td}>{c.channel}</td><td className={td}>{c.displayName ?? ""}<span className="block font-mono text-xs text-gray-500">{c.chatId}</span></td>
                  <td className={td}>{c.isAllowed ? t("Allowed") : t("Not allowed")}</td>
                  <td className={td}><button type="button" className={btnGhost} onClick={() => void allowOwnerChat(c.id, !c.isAllowed).then(reload).catch(fail)}>{c.isAllowed ? t("Block") : t("Allow")}</button></td></tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
