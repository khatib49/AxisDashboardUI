import { useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { Card, Notice, btnGhost, btnPrimary, inputCls, td, th } from "../../components/phase4/ui";
import { useI18n } from "../../i18n/I18nProvider";
import { createStaffBooking, listBookableStations, listBookings, setBookingStatus, type BookableStation, type Booking } from "../../services/phase5Service";

const day = (d: Date) => d.toISOString().slice(0, 10);
const badge: Record<string, string> = { Confirmed: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300", Pending: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300", CheckedIn: "bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300" };

/** Staff view of station bookings: today and upcoming, arrive / no-show / cancel, phone bookings. */
export default function BookingsAdmin() {
  const { t } = useI18n();
  const [date, setDate] = useState(day(new Date()));
  const [list, setList] = useState<Booking[]>([]);
  const [stations, setStations] = useState<BookableStation[]>([]);
  const [form, setForm] = useState({ setId: 0, time: "18:00", duration: 60, name: "", phone: "", players: 2 });
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const fail = (e: unknown) => setNotice({ kind: "error", text: (e as Error).message });

  const reload = () => { const f = new Date(date + "T00:00:00"); const to = new Date(f); to.setDate(to.getDate() + 1); return listBookings(f.toISOString(), to.toISOString()).then(setList).catch(fail); };
  useEffect(() => { void reload(); }, [date]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { listBookableStations().then((s) => { setStations(s); setForm((f) => ({ ...f, setId: f.setId || s[0]?.setId || 0 })); }).catch(() => undefined); }, []);

  async function add() {
    try { await createStaffBooking({ setId: form.setId, startsOn: new Date(`${date}T${form.time}:00`).toISOString(), durationMinutes: form.duration, customerName: form.name, phone: form.phone, players: form.players }); setNotice({ kind: "ok", text: t("Booking confirmed.") }); setForm({ ...form, name: "", phone: "" }); await reload(); } catch (e) { fail(e); }
  }
  const act = (id: number, s: string) => void setBookingStatus(id, s).then(reload).catch(fail);

  return (
    <div className="p-4 sm:p-6">
      <PageMeta title="Station Bookings | Axis" description="Bookings" />
      <PageBreadcrumb pageTitle={t("Station Bookings")} />
      {notice && <Notice kind={notice.kind} text={notice.text} onClose={() => setNotice(null)} />}
      <Card title={t("Station Bookings")} className="mb-4" actions={<div className="flex items-center gap-2"><input type="date" className={`${inputCls} w-44`} value={date} onChange={(e) => setDate(e.target.value)} aria-label={t("Date")} /><a className={btnGhost} href="/book" target="_blank" rel="noreferrer">{t("Book a station (public)")}</a></div>}>
        <div className="overflow-x-auto">
          <table className="min-w-full"><thead><tr><th className={th}>{t("Time")}</th><th className={th}>{t("Station")}</th><th className={th}>{t("Name")}</th><th className={th}>{t("Players")}</th><th className={th}>{t("Status")}</th><th className={th}></th></tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {list.length === 0 && <tr><td className={td} colSpan={6}>—</td></tr>}
              {list.map((b) => (
                <tr key={b.id}>
                  <td className={td}>{new Date(b.startsOn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}–{new Date(b.endsOn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                  <td className={td}>{b.room} · {b.station}</td>
                  <td className={td}>{b.customerName}<span className="block text-xs text-gray-500 dark:text-gray-400">{b.phone} · {b.source}</span></td>
                  <td className={td}>{b.players}</td>
                  <td className={td}><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge[b.status] ?? "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300"}`}>{t(b.status)}</span></td>
                  <td className={td}><div className="flex flex-wrap gap-1">
                    {b.status === "Pending" && <button type="button" className={btnGhost} onClick={() => act(b.id, "Confirmed")}>{t("Confirmed")}</button>}
                    {(b.status === "Confirmed" || b.status === "Pending") && <button type="button" className={btnGhost} onClick={() => act(b.id, "CheckedIn")}>{t("Check in")}</button>}
                    {b.status === "CheckedIn" && <button type="button" className={btnGhost} onClick={() => act(b.id, "Completed")}>{t("Completed")}</button>}
                    {(b.status === "Confirmed" || b.status === "Pending") && <button type="button" className={btnGhost} onClick={() => act(b.id, "NoShow")}>{t("NoShow")}</button>}
                    {(b.status === "Confirmed" || b.status === "Pending" || b.status === "CheckedIn") && <button type="button" className={btnGhost} onClick={() => act(b.id, "Cancelled")}>{t("Cancel")}</button>}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="Phone booking">
        <div className="grid items-end gap-2 sm:grid-cols-7">
          <select className={inputCls} value={form.setId} onChange={(e) => setForm({ ...form, setId: Number(e.target.value) })} aria-label={t("Station")}>{stations.map((s) => <option key={s.setId} value={s.setId}>{s.room} · {s.station}</option>)}</select>
          <input type="time" className={inputCls} value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} aria-label={t("Time")} />
          <select className={inputCls} value={form.duration} onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })} aria-label={t("Minutes")}>{[30, 60, 90, 120, 180, 240].map((m) => <option key={m} value={m}>{m} min</option>)}</select>
          <input className={inputCls} placeholder={t("Name")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className={inputCls} placeholder={t("Phone")} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input type="number" min={1} className={inputCls} value={form.players} onChange={(e) => setForm({ ...form, players: Number(e.target.value) || 1 })} aria-label={t("Players")} />
          <button type="button" className={btnPrimary} disabled={!form.setId || form.name.trim().length < 2 || form.phone.trim().length < 7} onClick={() => void add()}>{t("Add")}</button>
        </div>
      </Card>
    </div>
  );
}
