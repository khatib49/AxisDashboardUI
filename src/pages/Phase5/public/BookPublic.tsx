import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { QRCodeSVG } from "qrcode.react";
import PublicShell, { fmtHour, fmtTime, pbtn, pcard, pinput } from "./PublicShell";
import { useI18n } from "../../../i18n/I18nProvider";
import {
  bookPublic, cancelPublicBooking, checkInPublicBooking, getAvailability, getBookingSettings, getPublicBooking, listBookableStations,
  type BookableStation, type BookingPublic, type BookingSettings, type BookingSlot,
} from "../../../services/phase5Service";

const DURATIONS = [30, 60, 120, 180];
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Public booking: station, day, length, free time, name and phone. */
export default function BookPublic() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<BookingSettings | null>(null);
  const [stations, setStations] = useState<BookableStation[]>([]);
  const [setId, setSetId] = useState<number | null>(null);
  const [day, setDay] = useState(isoDay(new Date()));
  const [duration, setDuration] = useState(60);
  const [slots, setSlots] = useState<BookingSlot[] | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [name, setName] = useState(""); const [phone, setPhone] = useState(""); const [players, setPlayers] = useState(2);
  const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);

  useEffect(() => {
    getBookingSettings().then(setSettings).catch(() => undefined);
    listBookableStations().then((s) => { setStations(s); setSetId((c) => c ?? s[0]?.setId ?? null); }).catch((e) => setError((e as Error).message));
  }, []);
  useEffect(() => {
    if (!setId) return; setSlots(null); setSlot(null);
    getAvailability(setId, day, duration).then(setSlots).catch((e) => { setSlots([]); setError((e as Error).message); });
  }, [setId, day, duration]);

  const days = useMemo(() => Array.from({ length: Math.min(settings?.maxDays ?? 14, 14) }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d; }), [settings]);
  const rooms = useMemo(() => Array.from(new Set(stations.map((s) => s.room))), [stations]);
  const free = (slots ?? []).filter((s) => s.free);

  async function book() {
    if (!setId || !slot) return;
    setBusy(true); setError(null);
    try { const r = await bookPublic({ setId, startsOn: slot, durationMinutes: duration, customerName: name.trim(), phone: phone.trim(), players }); navigate(`/book/${r.data.token}`); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  const chip = (on: boolean) => `rounded-xl border px-3 py-2 text-sm ${on ? "border-brand-500 bg-brand-500 text-white" : "border-gray-300 bg-white text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"}`;
  return (
    <PublicShell title="Book a station">
      {error && <p className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300" role="alert">{error}</p>}
      <section className={`${pcard} mb-3`}>
        <h2 className="mb-2 font-semibold">{t("Pick a station")}</h2>
        {rooms.map((room) => (
          <div key={room} className="mb-2">
            <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">{room}</p>
            <div className="flex flex-wrap gap-2">{stations.filter((s) => s.room === room).map((s) => <button key={s.setId} type="button" className={chip(s.setId === setId)} onClick={() => setSetId(s.setId)}>{s.station}</button>)}</div>
          </div>
        ))}
      </section>
      <section className={`${pcard} mb-3`}>
        <h2 className="mb-2 font-semibold">{t("Pick a day")}</h2>
        <div className="flex gap-2 overflow-x-auto pb-1">{days.map((d) => <button key={isoDay(d)} type="button" className={`${chip(isoDay(d) === day)} shrink-0`} onClick={() => setDay(isoDay(d))}>{d.toLocaleDateString(lang === "ar" ? "ar-LB" : "en-GB", { weekday: "short", day: "numeric" })}</button>)}</div>
        <h2 className="mb-2 mt-4 font-semibold">{t("How long?")}</h2>
        <div className="flex flex-wrap gap-2">{DURATIONS.map((m) => <button key={m} type="button" className={chip(m === duration)} onClick={() => setDuration(m)}>{m === 30 ? t("30 minutes") : m === 60 ? t("1 hour") : m === 120 ? t("2 hours") : t("3 hours")}</button>)}</div>
      </section>
      <section className={`${pcard} mb-3`}>
        <h2 className="mb-2 font-semibold">{t("Pick a time")}</h2>
        {slots === null ? <p className="text-gray-500">{t("Loading…")}</p> : free.length === 0 ? <p className="text-gray-500">{t("No free times on this day.")}</p> : (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">{free.map((s) => <button key={s.startsOn} type="button" className={chip(s.startsOn === slot)} onClick={() => setSlot(s.startsOn)}>{fmtHour(s.startsOn, lang)}</button>)}</div>
        )}
      </section>
      <section className={pcard}>
        <div className="grid gap-3 sm:grid-cols-2">
          <input className={pinput} placeholder={t("Your name")} value={name} onChange={(e) => setName(e.target.value)} aria-label={t("Your name")} />
          <input className={pinput} placeholder={t("Phone number")} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} aria-label={t("Phone number")} />
          <label className="text-sm text-gray-600 dark:text-gray-400">{t("Players")}
            <input type="number" min={1} max={20} className={`${pinput} mt-1`} value={players} onChange={(e) => setPlayers(Math.max(1, Number(e.target.value) || 1))} />
          </label>
        </div>
        <button type="button" className={`${pbtn} mt-4 w-full`} disabled={busy || !slot || name.trim().length < 2 || phone.trim().length < 7} onClick={() => void book()}>{t("Book now")}</button>
      </section>
    </PublicShell>
  );
}

/** Booking status page (the link the guest keeps): QR, check-in, cancel. */
export function BookingStatusPublic() {
  const { token = "" } = useParams();
  const { t, lang } = useI18n();
  const [b, setB] = useState<BookingPublic | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => { getPublicBooking(token).then(setB).catch(() => setMissing(true)); }, [token]);
  const act = async (fn: () => Promise<{ data: BookingPublic; message: string }>) => { try { const r = await fn(); setB(r.data); setMsg(r.message); } catch (e) { setMsg((e as Error).message); } };
  if (missing) return <PublicShell title="Your booking"><p className={pcard}>{t("Booking not found.")}</p></PublicShell>;
  if (!b) return <PublicShell title="Your booking"><p className="text-gray-500">{t("Loading…")}</p></PublicShell>;
  return (
    <PublicShell title="Your booking">
      <section className={`${pcard} text-center`}>
        <p className="text-lg font-bold">{b.room} · {b.station}</p>
        <p className="text-gray-600 dark:text-gray-400">{fmtTime(b.startsOn, lang)} – {fmtHour(b.endsOn, lang)}</p>
        <p className="mt-1 text-sm">{b.customerName} · {t("Players")}: {b.players}</p>
        <p className="mt-2 inline-block rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold dark:bg-white/10" data-testid="booking-status">{t(b.status)}</p>
        <div className="mt-4 inline-block rounded-xl bg-white p-3"><QRCodeSVG value={window.location.href} size={160} /></div>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{t("Show this page when you arrive. Check-in opens 30 minutes before.")}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {b.canCheckIn && <button type="button" className={pbtn} onClick={() => void act(() => checkInPublicBooking(token))}>{t("Check in")}</button>}
          {b.canCancel && <button type="button" className="h-11 rounded-xl border border-red-300 px-5 text-red-600 dark:border-red-500/40 dark:text-red-400" onClick={() => { if (window.confirm(t("Cancel booking") + "?")) void act(() => cancelPublicBooking(token)); }}>{t("Cancel booking")}</button>}
        </div>
        {msg && <p className="mt-3 text-sm" role="status">{msg}</p>}
      </section>
    </PublicShell>
  );
}
