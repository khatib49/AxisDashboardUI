import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import PublicShell, { fmtHour, pbtn, pcard } from "./PublicShell";
import { useI18n } from "../../../i18n/I18nProvider";
import { getStation, orderFromStation, requestExtension, type StationInfo } from "../../../services/phase5Service";
import { assetUrl } from "../../../services/phase4Service";

/** Order food from the PS5 / table QR without leaving the game. */
export default function StationPublic() {
  const { token = "" } = useParams();
  const { t, lang } = useI18n();
  const [info, setInfo] = useState<StationInfo | null>(null);
  const [missing, setMissing] = useState(false);
  const [cart, setCart] = useState<Record<number, number>>({});
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [cat, setCat] = useState<string | null>(null);

  const load = () => getStation(token).then((s) => { setInfo(s); setCat((c) => c ?? s.menu[0]?.category ?? null); }).catch(() => setMissing(true));
  useEffect(() => { void load(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  const cats = useMemo(() => Array.from(new Set((info?.menu ?? []).map((m) => m.category))), [info]);
  const lines = Object.entries(cart).filter(([, q]) => q > 0).map(([id, q]) => ({ item: info!.menu.find((m) => m.id === Number(id))!, q }));
  const total = lines.reduce((s, l) => s + l.item.price * l.q, 0);
  const add = (id: number, d: number) => setCart((c) => ({ ...c, [id]: Math.max(0, (c[id] ?? 0) + d) }));

  async function send() {
    setBusy(true); setMsg(null);
    try { await orderFromStation(token, lines.map((l) => ({ itemId: l.item.id, quantity: l.q })), note); setCart({}); setNote(""); setMsg({ ok: true, text: t("Order sent to the kitchen.") }); void load(); }
    catch (e) { setMsg({ ok: false, text: (e as Error).message }); } finally { setBusy(false); }
  }
  async function extend(m: number) { try { await requestExtension(token, m); setMsg({ ok: true, text: t("The staff got your request.") }); } catch (e) { setMsg({ ok: false, text: (e as Error).message }); } }

  if (missing) return <PublicShell title="Order from your station"><p className={pcard}>{t("This QR code is not active.")}</p></PublicShell>;
  if (!info) return <PublicShell title="Order from your station"><p className="text-gray-500">{t("Loading…")}</p></PublicShell>;
  return (
    <PublicShell title="Order from your station">
      <section className={`${pcard} mb-3`}>
        <p className="font-semibold">{info.room} · {info.station}</p>
        {info.sessionRunning ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">{t("Your game")}: {info.game} · {info.endsOn ? `${t("Ends at")} ${fmtHour(info.endsOn, lang)}` : t("Open time")}</p>
        ) : <p className="text-sm text-amber-700 dark:text-amber-400">{t("No game is running on this station.")}</p>}
        {info.openInvoiceId && <p className="mt-1 text-sm">{t("Your tab")}: ${info.openInvoiceTotal.toFixed(2)}</p>}
        {info.sessionRunning && (
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="self-center text-sm text-gray-600 dark:text-gray-400">{t("Extend my session")}:</span>
            {[15, 30, 60].map((m) => <button key={m} type="button" className="rounded-xl border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700" onClick={() => void extend(m)}>+{m}</button>)}
          </div>
        )}
      </section>
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {cats.map((c) => <button key={c} type="button" onClick={() => setCat(c)} className={`shrink-0 rounded-full px-4 py-1.5 text-sm ${c === cat ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900" : "bg-white text-gray-700 dark:bg-gray-900 dark:text-gray-300"}`}>{c}</button>)}
      </div>
      <ul className="mb-28 space-y-2">
        {info.menu.filter((m) => m.category === cat).map((m) => (
          <li key={m.id} className={`${pcard} flex items-center gap-3`}>
            {m.imagePath ? <img src={assetUrl(m.imagePath) ?? ""} alt="" className="h-14 w-14 rounded-lg object-cover" /> : <div className="h-14 w-14 rounded-lg bg-gray-100 dark:bg-gray-800" />}
            <div className="min-w-0 flex-1"><p className="truncate font-medium">{m.name}</p><p className="text-sm text-gray-500 dark:text-gray-400">${m.price.toFixed(2)}</p></div>
            <div className="flex items-center gap-2">
              {(cart[m.id] ?? 0) > 0 && <><button type="button" aria-label="−" className="h-9 w-9 rounded-lg bg-gray-100 text-lg dark:bg-gray-800" onClick={() => add(m.id, -1)}>−</button><span className="w-5 text-center font-semibold">{cart[m.id]}</span></>}
              <button type="button" aria-label={`${t("Add")} ${m.name}`} className="h-9 w-9 rounded-lg bg-brand-500 text-lg text-white" onClick={() => add(m.id, 1)}>+</button>
            </div>
          </li>
        ))}
      </ul>
      <footer className="fixed inset-x-0 bottom-0 border-t border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto max-w-2xl space-y-2">
          {msg && <p className={`text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`} role="status">{msg.text}</p>}
          {lines.length > 0 && <input className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm dark:border-gray-700 dark:bg-gray-800" placeholder={t("Note (optional)")} value={note} onChange={(e) => setNote(e.target.value)} />}
          <button type="button" className={`${pbtn} flex w-full items-center justify-between`} disabled={busy || lines.length === 0} onClick={() => void send()}>
            <span>{t("Send order")} ({lines.reduce((s, l) => s + l.q, 0)})</span><span>${total.toFixed(2)}</span>
          </button>
        </div>
      </footer>
    </PublicShell>
  );
}
