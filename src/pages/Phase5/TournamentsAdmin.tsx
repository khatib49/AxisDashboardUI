import { useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { Card, Notice, btnDanger, btnGhost, btnPrimary, inputCls, money, td, th } from "../../components/phase4/ui";
import Bracket from "./Bracket";
import { useI18n } from "../../i18n/I18nProvider";
import { searchClientsByPhone } from "../../services/clientService";
import {
  addTournamentPlayer, createTournament, getTournament, listTournaments, payPrizes, removeTournamentPlayer, reportMatch, setTournamentStatus,
  startTournament, updateTournament, updateTournamentPlayer, type Tournament, type TournamentSummary, type TournamentUpsert,
} from "../../services/phase5Service";

const localInput = (iso?: string) => { const d = iso ? new Date(iso) : new Date(Date.now() + 86400000); d.setSeconds(0, 0); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const EMPTY = (): TournamentUpsert => ({ name: "", gameTitle: "", startsOn: localInput(), maxPlayers: 16, entryFee: 0, prizePool: 0, prizeSplit: "70,30", rules: "", roomIds: "" });

/** Tournaments: create, sign up players, start the bracket, report results, pay prizes. */
export default function TournamentsAdmin() {
  const { t } = useI18n();
  const [list, setList] = useState<TournamentSummary[]>([]);
  const [cur, setCur] = useState<Tournament | null>(null);
  const [form, setForm] = useState<TournamentUpsert & { id?: number }>(EMPTY());
  const [showForm, setShowForm] = useState(false);
  const [player, setPlayer] = useState({ name: "", phone: "", paid: true });
  const [busyMatch, setBusyMatch] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "error" | "info"; text: string } | null>(null);
  const fail = (e: unknown) => setNotice({ kind: "error", text: (e as Error).message });

  const reload = () => listTournaments().then(setList).catch(fail);
  useEffect(() => { void reload(); }, []);
  const open = (id: number) => getTournament(id).then((x) => { setCur(x); setShowForm(false); }).catch(fail);
  const done = (x: Tournament, text?: string) => { setCur(x); if (text) setNotice({ kind: "ok", text }); void reload(); };

  async function save() {
    try {
      const dto = { ...form, startsOn: new Date(form.startsOn).toISOString(), rules: form.rules || null, roomIds: form.roomIds || null };
      const x = form.id ? await updateTournament(form.id, dto) : await createTournament(dto);
      done(x, t("Save")); setShowForm(false);
    } catch (e) { fail(e); }
  }

  async function addPlayer() {
    if (!cur) return;
    try { done(await addTournamentPlayer(cur.id, { displayName: player.name, phone: player.phone || null, paid: player.paid, paidVia: "Counter" })); setPlayer({ name: "", phone: "", paid: true }); } catch (e) { fail(e); }
  }

  async function linkClient(pid: number, phone?: string | null, name?: string) {
    if (!cur) return;
    const q = window.prompt("Client phone to link (for wallet prizes):", phone ?? "");
    if (!q) return;
    try {
      const found = await searchClientsByPhone(q);
      if (found.length === 0) { setNotice({ kind: "error", text: "No client with that phone." }); return; }
      const p = cur.participants.find((x) => x.id === pid)!;
      done(await updateTournamentPlayer(cur.id, pid, { displayName: name ?? p.displayName, phone: q, userId: found[0].id, paid: p.paid, paidVia: p.paidVia }), `Linked to client #${found[0].id}.`);
    } catch (e) { fail(e); }
  }

  async function pick(matchId: number, winnerId: number) {
    if (!cur) return;
    const score = window.prompt("Score (optional), e.g. 3-1:", "") ?? undefined;
    setBusyMatch(matchId);
    try { done(await reportMatch(cur.id, matchId, winnerId, score)); } catch (e) { fail(e); } finally { setBusyMatch(null); }
  }

  const publicUrl = cur ? `${window.location.origin}/t/${cur.publicToken}` : "";
  return (
    <div className="p-4 sm:p-6">
      <PageMeta title="Tournaments | Axis" description="Tournaments" />
      <PageBreadcrumb pageTitle={t("Tournaments")} />
      {notice && <Notice kind={notice.kind} text={notice.text} onClose={() => setNotice(null)} />}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={t("Tournaments")} actions={<button type="button" className={btnPrimary} onClick={() => { setForm(EMPTY()); setShowForm(true); setCur(null); }}>{t("Add")}</button>}>
          <ul className="space-y-2">
            {list.map((x) => (
              <li key={x.id}><button type="button" onClick={() => void open(x.id)} className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${cur?.id === x.id ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10" : "border-gray-200 dark:border-gray-800"} text-gray-800 dark:text-white/90`}>
                <span className="font-medium">{x.name}</span><span className="block text-xs text-gray-500 dark:text-gray-400">{x.gameTitle} · {new Date(x.startsOn).toLocaleString()} · {x.players}/{x.maxPlayers} · {t(x.status)}</span>
              </button></li>
            ))}
            {list.length === 0 && <li className="text-sm text-gray-500 dark:text-gray-400">—</li>}
          </ul>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          {showForm && (
            <Card title={form.id ? t("Edit") : t("Add")}>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs text-gray-600 dark:text-gray-400">{t("Name")}<input className={`${inputCls} mt-1`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
                <label className="text-xs text-gray-600 dark:text-gray-400">Game<input className={`${inputCls} mt-1`} placeholder="EA FC 26" value={form.gameTitle} onChange={(e) => setForm({ ...form, gameTitle: e.target.value })} /></label>
                <label className="text-xs text-gray-600 dark:text-gray-400">{t("Starts")}<input type="datetime-local" className={`${inputCls} mt-1`} value={form.startsOn} onChange={(e) => setForm({ ...form, startsOn: e.target.value })} /></label>
                <label className="text-xs text-gray-600 dark:text-gray-400">Max players<input type="number" className={`${inputCls} mt-1`} value={form.maxPlayers} onChange={(e) => setForm({ ...form, maxPlayers: Number(e.target.value) || 2 })} /></label>
                <label className="text-xs text-gray-600 dark:text-gray-400">{t("Entry fee")} ($)<input type="number" className={`${inputCls} mt-1`} value={form.entryFee} onChange={(e) => setForm({ ...form, entryFee: Number(e.target.value) || 0 })} /></label>
                <label className="text-xs text-gray-600 dark:text-gray-400">{t("Prize pool")} ($)<input type="number" className={`${inputCls} mt-1`} value={form.prizePool} onChange={(e) => setForm({ ...form, prizePool: Number(e.target.value) || 0 })} /></label>
                <label className="text-xs text-gray-600 dark:text-gray-400">Prize split % (1st,2nd,…)<input className={`${inputCls} mt-1`} value={form.prizeSplit} onChange={(e) => setForm({ ...form, prizeSplit: e.target.value })} /></label>
                <label className="text-xs text-gray-600 dark:text-gray-400">Room ids for matches (empty = all)<input className={`${inputCls} mt-1`} placeholder="1,2" value={form.roomIds ?? ""} onChange={(e) => setForm({ ...form, roomIds: e.target.value })} /></label>
                <label className="text-xs text-gray-600 dark:text-gray-400 sm:col-span-2">{t("Rules")}<textarea className={`${inputCls} mt-1 h-20 py-2`} value={form.rules ?? ""} onChange={(e) => setForm({ ...form, rules: e.target.value })} /></label>
              </div>
              <div className="mt-3 flex gap-2"><button type="button" className={btnPrimary} onClick={() => void save()}>{t("Save")}</button><button type="button" className={btnGhost} onClick={() => setShowForm(false)}>{t("Cancel")}</button></div>
            </Card>
          )}

          {cur && (
            <>
              <Card title={`${cur.name} · ${t(cur.status)}`} actions={
                <div className="flex flex-wrap gap-2">
                  {(cur.status === "Draft" || cur.status === "Open") && <button type="button" className={btnGhost} onClick={() => { setForm({ ...cur, startsOn: localInput(cur.startsOn), id: cur.id }); setShowForm(true); }}>{t("Edit")}</button>}
                  {cur.status === "Draft" && <button type="button" className={btnPrimary} onClick={() => void setTournamentStatus(cur.id, "Open").then((x) => done(x, "Sign-up is open.")).catch(fail)}>Open sign-up</button>}
                  {(cur.status === "Open" || cur.status === "Draft") && <button type="button" className={btnPrimary} onClick={() => void startTournament(cur.id).then((x) => done(x, "Bracket started.")).catch(fail)}>Start bracket</button>}
                  {cur.status === "Completed" && !cur.prizesPaid && cur.prizePool > 0 && <button type="button" className={btnPrimary} onClick={() => void payPrizes(cur.id).then((x) => done(x, "Prizes paid to wallets.")).catch(fail)}>Pay prizes to wallets</button>}
                  {cur.status !== "Completed" && cur.status !== "Cancelled" && <button type="button" className={btnDanger} onClick={() => { if (window.confirm("Cancel this tournament?")) void setTournamentStatus(cur.id, "Cancelled").then((x) => done(x)).catch(fail); }}>{t("Cancel")}</button>}
                </div>}>
                <p className="text-sm text-gray-600 dark:text-gray-400">{cur.gameTitle} · {new Date(cur.startsOn).toLocaleString()} · {t("Entry fee")} {money(cur.entryFee)} · {t("Prize pool")} {money(cur.prizePool)} ({cur.prizeSplit}%)</p>
                {cur.status !== "Draft" && <p className="mt-2 text-sm">Public page: <a className="break-all text-brand-600 underline dark:text-brand-400" href={publicUrl} target="_blank" rel="noreferrer">{publicUrl}</a></p>}
                {cur.entryFee > 0 && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Collect the entry fee at the till, then mark the player paid. Only paid players enter the bracket.</p>}
              </Card>

              {cur.matches.length > 0 && <Card title={t("Bracket")}><p className="mb-2 text-xs text-gray-500 dark:text-gray-400">Tap the winner of a ready match (blue border). Free stations are assigned automatically.</p><Bracket tournament={cur} onPick={(m, w) => void pick(m, w)} busyMatch={busyMatch} /></Card>}

              <Card title={`${t("Players")} (${cur.participants.length}/${cur.maxPlayers})`}>
                {(cur.status === "Draft" || cur.status === "Open") && (
                  <div className="mb-3 grid items-end gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
                    <input className={inputCls} placeholder={t("Player name")} value={player.name} onChange={(e) => setPlayer({ ...player, name: e.target.value })} />
                    <input className={inputCls} placeholder={t("Phone")} value={player.phone} onChange={(e) => setPlayer({ ...player, phone: e.target.value })} />
                    <label className="flex items-center gap-2 pb-2 text-sm text-gray-700 dark:text-gray-300"><input type="checkbox" checked={player.paid} onChange={(e) => setPlayer({ ...player, paid: e.target.checked })} /> Paid</label>
                    <button type="button" className={btnPrimary} disabled={player.name.trim().length < 2} onClick={() => void addPlayer()}>{t("Add")}</button>
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="min-w-full"><thead><tr><th className={th}>#</th><th className={th}>{t("Name")}</th><th className={th}>{t("Phone")}</th><th className={th}>Paid</th><th className={th}>Place</th><th className={th}>Prize</th><th className={th}></th></tr></thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {cur.participants.map((p) => (
                        <tr key={p.id}>
                          <td className={td}>{p.seed ?? ""}</td><td className={td}>{p.displayName}{p.userId ? <span className="ml-1 text-xs text-gray-500">· client #{p.userId}</span> : null}</td><td className={td}>{p.phone ?? ""}</td>
                          <td className={td}>{(cur.status === "Draft" || cur.status === "Open") ? <input type="checkbox" checked={p.paid} aria-label={`Paid ${p.displayName}`} onChange={(e) => void updateTournamentPlayer(cur.id, p.id, { displayName: p.displayName, phone: p.phone, userId: p.userId, paid: e.target.checked, paidVia: "Counter" }).then((x) => done(x)).catch(fail)} /> : p.paid ? "✓" : ""}</td>
                          <td className={td}>{p.finalPlace ?? ""}</td><td className={td}>{p.prizeAmount > 0 ? money(p.prizeAmount) : ""}</td>
                          <td className={td}><div className="flex gap-2">
                            <button type="button" className={btnGhost} onClick={() => void linkClient(p.id, p.phone, p.displayName)}>Link client</button>
                            {(cur.status === "Draft" || cur.status === "Open") && <button type="button" className={btnDanger} onClick={() => void removeTournamentPlayer(cur.id, p.id).then((x) => done(x)).catch(fail)}>{t("Delete")}</button>}
                          </div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
