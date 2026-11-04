import { useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { Card, Notice, btnDanger, btnGhost, btnPrimary, inputCls, money, td, th } from "../../components/phase4/ui";
import { useI18n } from "../../i18n/I18nProvider";
import { searchClientsByPhone, type ClientUserDto } from "../../services/clientService";
import { deleteParentLink, listParentLinks, saveParentLink, type ParentLink, type ParentLinkUpsert } from "../../services/phase5Service";

const EMPTY: ParentLinkUpsert & { childName?: string } = { childUserId: 0, parentName: "", parentPhone: "", parentTelegramChatId: "", parentEmail: "", dailyLimit: null, lowBalanceThreshold: null, notifyOnSpend: true, notifyOnSessionEnd: true, isActive: true };

/** Parent controls on a child's wallet: daily limit and alerts to the parent's phone. */
export default function ParentWalletAdmin() {
  const { t } = useI18n();
  const [list, setList] = useState<ParentLink[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [search, setSearch] = useState("");
  const [found, setFound] = useState<ClientUserDto[]>([]);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const fail = (e: unknown) => setNotice({ kind: "error", text: (e as Error).message });
  const reload = () => listParentLinks().then(setList).catch(fail);
  useEffect(() => { void reload(); }, []);

  async function find() { try { setFound(await searchClientsByPhone(search)); } catch (e) { fail(e); } }
  async function save() {
    try {
      await saveParentLink({ ...form, parentPhone: form.parentPhone || null, parentTelegramChatId: form.parentTelegramChatId || null, parentEmail: form.parentEmail || null });
      setNotice({ kind: "ok", text: "Parent controls saved." }); setForm(EMPTY); setFound([]); setSearch(""); await reload();
    } catch (e) { fail(e); }
  }
  const num = (v: string) => (v.trim() === "" ? null : Number(v));
  return (
    <div className="p-4 sm:p-6">
      <PageMeta title="Parent Wallet | Axis" description="Parent wallet controls" />
      <PageBreadcrumb pageTitle={t("Parent Wallet")} />
      {notice && <Notice kind={notice.kind} text={notice.text} onClose={() => setNotice(null)} />}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={form.childUserId ? `${t("Edit")}: ${form.childName ?? "#" + form.childUserId}` : "Set up a child's wallet"}>
          {!form.childUserId ? (
            <>
              <div className="flex gap-2"><input className={inputCls} placeholder="Child's phone" value={search} onChange={(e) => setSearch(e.target.value)} /><button type="button" className={btnGhost} onClick={() => void find()}>{t("Search")}</button></div>
              <ul className="mt-2 space-y-1">{found.map((c) => <li key={c.id}><button type="button" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50 dark:border-gray-700 dark:text-white/90 dark:hover:bg-white/5" onClick={() => setForm({ ...EMPTY, childUserId: c.id, childName: [c.firstName, c.lastName].filter(Boolean).join(" ") || c.phoneNumber || `#${c.id}` })}>{[c.firstName, c.lastName].filter(Boolean).join(" ") || "—"} · {c.phoneNumber}</button></li>)}</ul>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">The child needs a client account with a wallet.</p>
            </>
          ) : (
            <div className="space-y-2">
              <input className={inputCls} placeholder="Parent name" value={form.parentName} onChange={(e) => setForm({ ...form, parentName: e.target.value })} />
              <input className={inputCls} placeholder="Parent WhatsApp (+961…)" value={form.parentPhone ?? ""} onChange={(e) => setForm({ ...form, parentPhone: e.target.value })} />
              <input className={inputCls} placeholder="Parent Telegram chat id (optional)" value={form.parentTelegramChatId ?? ""} onChange={(e) => setForm({ ...form, parentTelegramChatId: e.target.value })} />
              <input className={inputCls} placeholder="Parent email (optional)" value={form.parentEmail ?? ""} onChange={(e) => setForm({ ...form, parentEmail: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-gray-600 dark:text-gray-400">{t("Daily limit")} ($)<input className={`${inputCls} mt-1`} inputMode="decimal" value={form.dailyLimit ?? ""} onChange={(e) => setForm({ ...form, dailyLimit: num(e.target.value) })} /></label>
                <label className="text-xs text-gray-600 dark:text-gray-400">Low balance alert ($)<input className={`${inputCls} mt-1`} inputMode="decimal" value={form.lowBalanceThreshold ?? ""} onChange={(e) => setForm({ ...form, lowBalanceThreshold: num(e.target.value) })} /></label>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"><input type="checkbox" checked={form.notifyOnSpend} onChange={(e) => setForm({ ...form, notifyOnSpend: e.target.checked })} /> Message on every spend</label>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"><input type="checkbox" checked={form.notifyOnSessionEnd} onChange={(e) => setForm({ ...form, notifyOnSessionEnd: e.target.checked })} /> Message when a game session ends</label>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> {t("Active")}</label>
              <div className="flex gap-2"><button type="button" className={btnPrimary} disabled={!form.parentName.trim()} onClick={() => void save()}>{t("Save")}</button><button type="button" className={btnGhost} onClick={() => setForm(EMPTY)}>{t("Cancel")}</button></div>
            </div>
          )}
        </Card>
        <Card title={t("Parent Wallet")} className="lg:col-span-2">
          <div className="overflow-x-auto">
            <table className="min-w-full"><thead><tr><th className={th}>Child</th><th className={th}>Parent</th><th className={th}>{t("Balance")}</th><th className={th}>{t("Spent today")}</th><th className={th}>{t("Daily limit")}</th><th className={th}></th></tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {list.length === 0 && <tr><td className={td} colSpan={6}>—</td></tr>}
                {list.map((l) => (
                  <tr key={l.id} className={l.isActive ? "" : "opacity-60"}>
                    <td className={td}>{l.childName}</td><td className={td}>{l.parentName}<span className="block text-xs text-gray-500 dark:text-gray-400">{[l.parentPhone, l.parentTelegramChatId && `TG ${l.parentTelegramChatId}`, l.parentEmail].filter(Boolean).join(" · ")}</span></td>
                    <td className={td}>{money(l.balance)}</td><td className={td}>{money(l.spentToday)}</td><td className={td}>{l.dailyLimit != null ? money(l.dailyLimit) : t("No limit")}</td>
                    <td className={td}><div className="flex flex-wrap gap-1">
                      <button type="button" className={btnGhost} onClick={() => setForm({ ...l, childName: l.childName })}>{t("Edit")}</button>
                      <button type="button" className={btnGhost} onClick={() => { void navigator.clipboard?.writeText(`${window.location.origin}/parent/${l.token}`); setNotice({ kind: "ok", text: "Parent link copied." }); }}>{t("Copy link")}</button>
                      <button type="button" className={btnDanger} onClick={() => { if (window.confirm("Remove parent controls?")) void deleteParentLink(l.id).then(reload).catch(fail); }}>{t("Delete")}</button>
                    </div></td>
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
