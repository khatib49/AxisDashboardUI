import { useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import {
  submitPublicReservation,
  getPublicTables,
  PublicTableDto,
  ResourceType,
} from "../../services/reservationService";
import { errorMessage } from "../../services/floorService";

const pad = (n: number) => String(n).padStart(2, "0");
const localInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

const input =
  "h-11 w-full rounded-lg border border-gray-300 px-4 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white";

/** Public, layout-free online reservation request form (no login). */
export default function ReservationRequest() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(19, 0, 0, 0);

  const [tables, setTables] = useState<PublicTableDto[]>([]);
  const [form, setForm] = useState({
    customerName: "",
    phone: "",
    resourceType: "Table" as ResourceType,
    tableId: "" as string,
    start: localInput(tomorrow),
    duration: 2,
    partySize: 2,
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ id: number; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPublicTables().then(setTables).catch(() => setTables([]));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.customerName.trim()) return setError("Please enter your name.");
    if (form.phone.trim().length < 6) return setError("Please enter a valid phone number.");
    if (!form.start) return setError("Please pick a date and time.");
    const start = new Date(form.start);
    if (start.getTime() < Date.now()) return setError("Please pick a time in the future.");
    const end = new Date(start.getTime() + form.duration * 60 * 60 * 1000);

    setSubmitting(true);
    try {
      const r = await submitPublicReservation({
        customerName: form.customerName.trim(),
        phone: form.phone.trim(),
        resourceType: form.resourceType,
        startOn: start.toISOString(),
        endOn: end.toISOString(),
        partySize: form.partySize,
        tableId: form.resourceType === "Table" && form.tableId ? Number(form.tableId) : null,
        notes: form.notes.trim() || null,
      });
      if (!r.success) {
        setError(r.message);
        return;
      }
      setDone({ id: r.data?.id ?? 0, message: r.message });
    } catch (err) {
      setError(errorMessage(err, "Could not send your request. Please call us."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <PageMeta title="Reserve | Axis" description="Request a table, gaming room or console reservation" />
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-800 shadow-lg p-6 md:p-8">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Reserve at Axis</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-6">
          Send us a request and we will confirm it shortly by phone or WhatsApp.
        </p>

        {done ? (
          <div className="rounded-lg bg-green-50 dark:bg-green-500/15 p-4 text-green-800 dark:text-green-200">
            <div className="font-semibold">Request received{done.id ? ` (#${done.id})` : ""}</div>
            <p className="text-sm mt-1">{done.message}</p>
            <button
              className="mt-4 text-sm underline"
              onClick={() => {
                setDone(null);
                setForm({ ...form, notes: "" });
              }}
            >
              Send another request
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {error && <div className="rounded-lg bg-red-50 dark:bg-red-500/15 p-3 text-sm text-red-700 dark:text-red-200">{error}</div>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Your name</label>
                <input className={input} value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} required maxLength={120} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                <input className={input} type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required maxLength={40} placeholder="70 123 456" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">What would you like to reserve?</label>
              <div className="grid grid-cols-3 gap-2">
                {(["Table", "Room", "Console"] as ResourceType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm({ ...form, resourceType: t, tableId: "" })}
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      form.resourceType === t
                        ? "border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200"
                        : "border-gray-300 text-gray-700 dark:border-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {t === "Table" ? "Restaurant table" : t === "Room" ? "Gaming room" : "Console"}
                  </button>
                ))}
              </div>
            </div>

            {form.resourceType === "Table" && tables.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Preferred table (optional)</label>
                <select className={input} value={form.tableId} onChange={(e) => setForm({ ...form, tableId: e.target.value })}>
                  <option value="">Any table</option>
                  {tables.map((t) => (
                    <option key={t.id} value={t.id}>{t.code} — {t.name} · {t.capacity} seats · {t.areaName}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date &amp; time</label>
                <input className={input} type="datetime-local" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Duration</label>
                <select className={input} value={form.duration} onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}>
                  {[1, 1.5, 2, 3, 4].map((h) => <option key={h} value={h}>{h} h</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">People</label>
                <input className={input} type="number" min={1} max={50} value={form.partySize} onChange={(e) => setForm({ ...form, partySize: Math.max(1, Number(e.target.value) || 1) })} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes (optional)</label>
                <input className={input} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={500} placeholder="Birthday, allergies, game you want…" />
              </div>
            </div>

            <button type="submit" disabled={submitting} className="w-full h-11 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50">
              {submitting ? "Sending…" : "Send request"}
            </button>
            <p className="text-xs text-gray-500 text-center">Requests are pending until our team confirms them. Max 3 pending requests per phone number.</p>
          </form>
        )}
      </div>
    </div>
  );
}
