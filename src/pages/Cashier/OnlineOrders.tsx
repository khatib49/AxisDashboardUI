// Till → Online Orders
// ====================
// Inbox of website orders. New (pay at pickup) → Accept creates the open
// invoice + kitchen/bar tickets through the normal path. Paid (online) →
// the invoice already exists and is paid; Accept just tells the customer
// it's being prepared. Ready → customer is told to come. Completed happens
// automatically when the invoice is closed at the till (or by hand here).

import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import Loader from "../../components/ui/Loader";
import { OnlineOrder, OrderInbox, getOrderInbox, acceptOnlineOrder, setOnlineOrderStatus } from "../../services/shopService";

const money = (n: number) => `$${n.toFixed(2)}`;
const STATUS: Record<string, string> = {
  New: "bg-blue-50 text-blue-700 border-blue-200",
  Paid: "bg-green-50 text-green-700 border-green-200",
  AwaitingPayment: "bg-amber-50 text-amber-700 border-amber-200",
  Accepted: "bg-indigo-50 text-indigo-700 border-indigo-200",
  Ready: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Completed: "bg-gray-100 text-gray-600 border-gray-200",
  Cancelled: "bg-red-50 text-red-600 border-red-200",
};

function OrderCard({ o, onChanged }: { o: OnlineOrder; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setErr(null);
    try { await fn(); onChanged(); }
    catch (e: unknown) { setErr((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed"); }
    finally { setBusy(false); }
  };
  const hot = (o.status === "New" || o.status === "Paid") && o.ageMinutes > 5;
  return (
    <div className={`rounded-2xl border bg-white p-4 shadow-sm ${hot ? "border-red-300 ring-2 ring-red-100" : "border-gray-100"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-gray-900">{o.code}</span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${STATUS[o.status] ?? "bg-gray-50"}`}>{o.status === "New" ? "New · pay at pickup" : o.status === "Paid" ? "PAID online" : o.status}</span>
            {o.paymentMode === "Online" && o.status !== "Paid" && <span className="text-[10px] text-gray-400">online</span>}
          </div>
          <div className="text-sm font-semibold text-gray-900 mt-1">{o.customerName} <a className="text-indigo-600 font-normal" href={`tel:${o.customerPhone}`}>{o.customerPhone}</a></div>
          <div className="text-[11px] text-gray-500">
            {o.ageMinutes < 60 ? `${o.ageMinutes} min ago` : `${Math.floor(o.ageMinutes / 60)}h ${o.ageMinutes % 60}m ago`}
            {o.pickupTime && <> · pickup <b>{o.pickupTime}</b></>}
            {o.transactionRecordId && <> · invoice #{o.transactionRecordId}</>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold text-gray-900">{money(o.total)}</div>
          <div className="text-[10px] text-gray-400">{o.lines.reduce((s, l) => s + l.quantity, 0)} items</div>
        </div>
      </div>

      <div className="mt-3 divide-y divide-gray-100 rounded-xl border border-gray-100">
        {o.lines.map((l) => (
          <div key={l.id} className="flex items-center justify-between px-3 py-1.5 text-sm">
            <div>
              <span className="font-semibold">{l.quantity}×</span> {l.itemName}
              {l.variantName && <span className="text-indigo-600"> · {l.variantName}</span>}
              {l.addOns.length > 0 && <div className="text-[11px] text-gray-500 pl-5">+ {l.addOns.map(a => `${a.quantity}× ${a.name}`).join(", ")}</div>}
            </div>
            <span className="text-gray-600">{money(l.lineTotal)}</span>
          </div>
        ))}
      </div>
      {o.notes && <div className="mt-2 rounded-lg bg-amber-50 border border-amber-100 px-3 py-1.5 text-xs text-amber-800">📝 {o.notes}</div>}
      {err && <div className="mt-2 text-xs text-red-600">{err}</div>}

      <div className="mt-3 flex gap-2 flex-wrap">
        {(o.status === "New" || o.status === "Paid") && (
          <button disabled={busy} onClick={() => run(() => acceptOnlineOrder(o.id))} className="flex-1 h-10 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
            ✓ Accept {o.status === "New" ? "· open invoice + tickets" : "· start preparing"}
          </button>
        )}
        {o.status === "Accepted" && (
          <button disabled={busy} onClick={() => run(() => setOnlineOrderStatus(o.id, "Ready"))} className="flex-1 h-10 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50">🔔 Ready for pickup</button>
        )}
        {(o.status === "Accepted" || o.status === "Ready") && (
          <button disabled={busy} onClick={() => run(() => setOnlineOrderStatus(o.id, "Completed"))} className="h-10 px-4 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">Handed over</button>
        )}
        {(o.status === "New" || o.status === "AwaitingPayment") && (
          <button disabled={busy} onClick={() => { const r = prompt("Reason for cancelling?") ?? ""; if (r !== null) run(() => setOnlineOrderStatus(o.id, "Cancelled", r)); }} className="h-10 px-4 rounded-xl border border-red-200 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50">Cancel</button>
        )}
        {o.transactionRecordId && o.status !== "Completed" && o.paymentMode !== "Online" && (
          <Link to="/cashier/open-invoices" className="h-10 px-4 leading-10 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50">Open invoice →</Link>
        )}
      </div>
    </div>
  );
}

export default function OnlineOrders() {
  const [data, setData] = useState<OrderInbox | null>(null);
  const [includeDone, setIncludeDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const lastNew = useRef<number>(0);
  const audio = useRef<HTMLAudioElement | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await getOrderInbox(includeDone);
      setData(d);
      // Beep when a new order arrives.
      if (d.newCount > lastNew.current && lastNew.current >= 0) {
        try { audio.current?.play().catch(() => { /* autoplay blocked */ }); } catch { /* ignore */ }
      }
      lastNew.current = d.newCount;
    } catch { /* keep last */ }
    finally { setLoading(false); }
  }, [includeDone]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = window.setInterval(() => { if (document.visibilityState === "visible") load(); }, 15000);
    return () => window.clearInterval(id);
  }, [load]);

  const groups = [
    { title: "🆕 New — needs accepting", rows: (data?.orders ?? []).filter(o => o.status === "New" || o.status === "Paid") },
    { title: "👩‍🍳 Being prepared", rows: (data?.orders ?? []).filter(o => o.status === "Accepted") },
    { title: "🔔 Ready for pickup", rows: (data?.orders ?? []).filter(o => o.status === "Ready") },
    { title: "⏳ Waiting for card payment", rows: (data?.orders ?? []).filter(o => o.status === "AwaitingPayment") },
    { title: "Done / cancelled (last 2 days)", rows: (data?.orders ?? []).filter(o => o.status === "Completed" || o.status === "Cancelled") },
  ].filter(g => g.rows.length > 0);

  return (
    <div className="p-6 max-w-[1100px] mx-auto space-y-5">
      <audio ref={audio} src="data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU" preload="auto" />
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Online Orders</h1>
          <p className="text-sm text-gray-500 mt-0.5">Orders from axislb.com. Accept → invoice opens and tickets print. Refreshes every 15 s.</p>
        </div>
        <div className="flex items-center gap-3">
          {data && (
            <div className="flex gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-semibold">{data.newCount} new</span>
              <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 font-semibold">{data.acceptedCount} preparing</span>
              <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold">{data.readyCount} ready</span>
            </div>
          )}
          <label className="flex items-center gap-1.5 text-xs text-gray-600"><input type="checkbox" checked={includeDone} onChange={e => setIncludeDone(e.target.checked)} /> show done</label>
          <button onClick={load} className="h-9 px-3 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50">↻</button>
        </div>
      </div>

      {loading && !data ? <div className="py-12 flex justify-center"><Loader /></div> : groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 py-16 text-center text-gray-400">No online orders right now.</div>
      ) : groups.map(g => (
        <section key={g.title}>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">{g.title} <span className="text-gray-400 font-normal">({g.rows.length})</span></h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {g.rows.map(o => <OrderCard key={o.id} o={o} onChanged={load} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
