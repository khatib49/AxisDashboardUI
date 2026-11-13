import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import PublicShell, { fmtTime, pbtn, pcard, pinput } from "./PublicShell";
import { useI18n } from "../../../i18n/I18nProvider";
import { getPublicTournament, listPublicTournaments, registerTournament, type Tournament, type TournamentSummary } from "../../../services/phase5Service";
import Bracket from "../Bracket";

/** Public tournament page: details, live bracket (auto refresh) and sign-up while open. */
export default function TournamentPublic() {
  const { token = "" } = useParams();
  const { t, lang } = useI18n();
  const [tour, setTour] = useState<Tournament | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(""); const [phone, setPhone] = useState("");
  const [msg, setMsg] = useState<string | null>(null); const [busy, setBusy] = useState(false);

  const load = useCallback(() => getPublicTournament(token).then((x) => { setTour(x); setError(null); }).catch(() => setError(t("Tournament not found."))), [token, t]);
  useEffect(() => { void load(); const i = setInterval(load, 15000); return () => clearInterval(i); }, [load]);

  async function signUp() {
    setBusy(true); setMsg(null);
    try { const r = await registerTournament(token, name.trim(), phone.trim()); setTour(r.data); setMsg(r.message); setName(""); }
    catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  }

  if (error) return <PublicShell title="Tournament"><p className={pcard}>{error}</p></PublicShell>;
  if (!tour) return <PublicShell title="Tournament"><p className="text-gray-500">{t("Loading…")}</p></PublicShell>;
  const left = tour.maxPlayers - tour.participants.length;
  const champion = tour.participants.find((p) => p.finalPlace === 1);
  return (
    <PublicShell title="Tournament" wide>
      <section className={`${pcard} mb-4`}>
        <h2 className="text-xl font-bold">{tour.name}</h2>
        <p className="text-gray-600 dark:text-gray-400">{tour.gameTitle} · {t("Starts")} {fmtTime(tour.startsOn, lang)}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-gray-100 px-3 py-1 dark:bg-white/10">{t("Entry fee")}: {tour.entryFee > 0 ? `$${tour.entryFee.toFixed(2)}` : t("Free")}</span>
          {tour.prizePool > 0 && <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300">{t("Prize pool")}: ${tour.prizePool.toFixed(2)}</span>}
          <span className="rounded-full bg-gray-100 px-3 py-1 dark:bg-white/10">{t("Players")}: {tour.participants.length}/{tour.maxPlayers}</span>
          <span className="rounded-full bg-gray-100 px-3 py-1 dark:bg-white/10">{t(tour.status)}</span>
        </div>
        {tour.rules && <p className="mt-3 whitespace-pre-line text-sm text-gray-600 dark:text-gray-400"><b>{t("Rules")}:</b> {tour.rules}</p>}
        {champion && <p className="mt-3 text-lg font-bold text-amber-600 dark:text-amber-400">🏆 {t("Champion")}: {champion.displayName}</p>}
      </section>

      {tour.status === "Open" && (
        <section className={`${pcard} mb-4`}>
          <h2 className="mb-3 font-semibold">{t("Join the tournament")} {left > 0 && <span className="text-sm font-normal text-gray-500">· {left} {t("spots left")}</span>}</h2>
          {left > 0 ? (
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <input className={pinput} placeholder={t("Player name")} value={name} onChange={(e) => setName(e.target.value)} aria-label={t("Player name")} />
              <input className={pinput} placeholder={t("Phone number")} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} aria-label={t("Phone number")} />
              <button type="button" className={pbtn} disabled={busy || name.trim().length < 2 || phone.trim().length < 7} onClick={() => void signUp()}>{t("Sign up")}</button>
            </div>
          ) : <p className="text-gray-500">{t("Sign-up is closed.")}</p>}
          {msg && <p className="mt-3 text-sm" role="status">{msg}</p>}
        </section>
      )}

      {tour.matches.length > 0 ? (
        <section className={pcard}><h2 className="mb-3 font-semibold">{t("Bracket")}</h2><Bracket tournament={tour} /></section>
      ) : (
        <section className={pcard}>
          <h2 className="mb-2 font-semibold">{t("Players")}</h2>
          <ul className="grid gap-1 sm:grid-cols-2">{tour.participants.map((p) => <li key={p.id}>{p.displayName}</li>)}</ul>
        </section>
      )}
    </PublicShell>
  );
}

export function TournamentListPublic() {
  const { t, lang } = useI18n();
  const [list, setList] = useState<TournamentSummary[] | null>(null);
  useEffect(() => { listPublicTournaments().then(setList).catch(() => setList([])); }, []);
  return (
    <PublicShell title="Upcoming tournaments">
      {list === null ? <p className="text-gray-500">{t("Loading…")}</p> : list.length === 0 ? <p className={pcard}>—</p> : (
        <ul className="space-y-3">
          {list.map((x) => (
            <li key={x.id}><Link to={`/t/${x.publicToken}`} className={`${pcard} block hover:border-brand-400`}>
              <p className="font-semibold">{x.name}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{x.gameTitle} · {fmtTime(x.startsOn, lang)} · {x.players}/{x.maxPlayers} · {t(x.status)}</p>
            </Link></li>
          ))}
        </ul>
      )}
    </PublicShell>
  );
}
