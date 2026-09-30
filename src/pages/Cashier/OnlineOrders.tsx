// Till → Online Orders
// ====================
// Inbox of website orders. New (pay at pickup / COD) → Accept creates the open
// invoice + kitchen/bar tickets through the normal path. Paid (online) →
// the invoice already exists and is paid; Accept just tells the customer
// it's being prepared. Pickup orders: Ready → customer is told to come.
// Delivery orders: Create Aramex shipment → label → courier pickup →
// tracking → Delivered (COD closes the invoice and books an Aramex receivable).

import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import Loader from "../../components/ui/Loader";
import {
  OnlineOrder, OrderInbox, Shipment, PickupResult,
  getOrderInbox, acceptOnlineOrder, setOnlineOrderStatus,
  shipOnlineOrder, refreshShipment, shipmentLabel, markShipmentDelivered, setShipmentStatus, bookCourierPickup,
  SHIPMENT_STATUS_TEXT,
} from "../../services/shopService";

const money = (n: number) => `$${n.toFixed(2)}`;
const STATUS: Record<string, string> = {
  New: "bg-blue-50 text-blue-700 border-blue-200",
  Paid: "bg-green-50 text-green-700 border-green-200",
  AwaitingPayment: "bg-amber-50 text-amber-700 border-amber-200",
  Accepted: "bg-indigo-50 text-indigo-700 border-indigo-200",
  Ready: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Shipped: "bg-sky-50 text-sky-700 border-sky-200",
  Delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Completed: "bg-gray-100 text-gray-600 border-gray-200",
  Cancelled: "bg-red-50 text-red-600 border-red-200",
};
const SHIP_STYLE: Record<string, string> = {
  Created: "bg-gray-100 text-gray-700",
  PickedUp: "bg-blue-100 text-blue-700",
  InTransit: "bg-indigo-100 text-indigo-700",
  OutForDelivery: "bg-amber-100 text-amber-800",
  Delivered: "bg-emerald-100 text-emerald-800",
  Returned: "bg-purple-100 text-purple-800",
  Failed: "bg-red-100 text-red-700",
  Cancelled: "bg-gray-100 text-gray-500",
};

const errorText = (e: unknown, fallback = "Failed"): string => {
  const data = (e as { response?: { data?: unknown } })?.response?.data;
  if (data && typeof data === "object") {
    const err = (data as { error?: unknown }).error;
    if (typeof err === "string" && err) return err;
  }
  const m = (e as { message?: unknown })?.message;
  return typeof m === "string" && m ? m : fallback;
};

function statusLabel(o: OnlineOrder): string {
  if (o.status === "New") return o.paymentMode === "COD" ? "New · cash on delivery" : "New · pay at pickup";
  if (o.status === "Paid") return "PAID online";
  if (o.status === "Shipped") return "With Aramex";
  return o.status;
}

function ShipmentBlock({ sh, o, busy, run }: { sh: Shipment; o: OnlineOrder; busy: boolean; run: (fn: () => Promise<unknown>) => Promise<void> }) {
  const terminal = sh.status === "Delivered" || sh.status === "Returned" || sh.status === "Cancelled" || sh.status === "Failed";
  const openLabel = async () => {
    if (sh.labelUrl) { window.open(sh.labelUrl, "_blank", "noopener"); return; }
    await run(async () => {
      const updated = await shipmentLabel(sh.id);
      if (updated.labelUrl) window.open(updated.labelUrl, "_blank", "noopener");
      else throw new Error("Aramex did not return a label yet. Try again in a moment.");
    });
  };
  const deliver = () => {
    const cod = o.paymentMode === "COD";
    const msg = cod
      ? `Mark ${o.code} as delivered?\n\nThis closes the invoice and books ${money(sh.codAmount || o.total)} cash as an Aramex receivable until Aramex pays it out (settled on Shipping & Aramex).`
      : `Mark ${o.code} as delivered?`;
    if (confirm(msg)) run(() => markShipmentDelivered(sh.id));
  };
  const returned = () => {
    const r = prompt("Reason for return?");
    if (r !== null) run(() => setShipmentStatus(sh.id, "Returned", r));
  };
  const btn = "h-9 px-3 rounded-lg border text-xs font-medium disabled:opacity-50";
  return (
    <div className="mt-2 rounded-xl border border-sky-100 bg-sky-50/50 px-3 py-2">
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <span className="font-semibold text-sky-900">Aramex</span>
        {sh.awbNumber ? (
          sh.trackingUrl
            ? <a href={sh.trackingUrl} target="_blank" rel="noreferrer" className="font-mono text-indigo-600 underline">{sh.awbNumber}</a>
            : <span className="font-mono">{sh.awbNumber}</span>
        ) : <span className="text-gray-400">no AWB</span>}
        <span className={`px-2 py-0.5 rounded-full font-semibold ${SHIP_STYLE[sh.status] ?? "bg-gray-100 text-gray-600"}`}>{SHIPMENT_STATUS_TEXT[sh.status] ?? sh.status}</span>
        {sh.environment === "sandbox" && <span className="text-[10px] px-1 rounded bg-amber-100 text-amber-700">sandbox</span>}
      </div>
      {(sh.lastTrackingText || sh.error) && (
        <div className="mt-1 text-[11px] text-gray-600">
          {sh.lastTrackingText && <>{sh.lastTrackingText}{sh.lastTrackingAt && <span className="text-gray-400"> · {new Date(sh.lastTrackingAt).toLocaleString()}</span>}</>}
          {sh.error && <div className="text-red-600">{sh.error}</div>}
        </div>
      )}
      <div className="mt-2 flex gap-1.5 flex-wrap">
        <button disabled={busy} onClick={openLabel} className={`${btn} border-gray-200 bg-white text-gray-700 hover:bg-gray-50`}>🏷 Label</button>
        {!terminal && <button disabled={busy} onClick={() => run(() => refreshShipment(sh.id))} className={`${btn} border-gray-200 bg-white text-gray-700 hover:bg-gray-50`}>↻ Refresh tracking</button>}
        {!terminal && <button disabled={busy} onClick={deliver} className={`${btn} border-emerald-300 bg-emerald-600 text-white hover:bg-emerald-700`}>✓ Mark delivered</button>}
        {!terminal && <button disabled={busy} onClick={returned} className={`${btn} border-purple-200 bg-white text-purple-700 hover:bg-purple-50`}>Returned</button>}
      </div>
    </div>
  );
}

function OrderCard({ o, onChanged }: { o: OnlineOrder; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [weight, setWeight] = useState<string>(o.weightKg != null ? String(o.weightKg) : "");
  const [pieces, setPieces] = useState<string>("1");
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setErr(null);
    try { await fn(); onChanged(); }
    catch (e: unknown) { setErr(errorText(e)); onChanged(); }
    finally { setBusy(false); }
  };
  const isDelivery = o.fulfilment === "Delivery";
  const hot = (o.status === "New" || o.status === "Paid") && o.ageMinutes > 5;
  const canShip = isDelivery && o.status === "Accepted" && !o.shipment;

  const ship = () => run(() => shipOnlineOrder(o.id, {
    weightKg: weight.trim() === "" ? null : Number(weight),
    pieces: pieces.trim() === "" ? null : Math.max(1, Math.floor(Number(pieces)) || 1),
  }));

  return (
    <div className={`rounded-2xl border bg-white p-4 shadow-sm ${hot ? "border-red-300 ring-2 ring-red-100" : "border-gray-100"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-bold text-gray-900">{o.code}</span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${STATUS[o.status] ?? "bg-gray-50"}`}>{statusLabel(o)}</span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${isDelivery ? "bg-sky-100 text-sky-800" : "bg-gray-100 text-gray-700"}`}>
              {isDelivery ? `🚚 Delivery${o.address?.city ? ` · ${o.address.city}` : ""}` : "🏪 Pickup"}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${o.paymentMode === "Online" ? "bg-green-100 text-green-800" : o.paymentMode === "COD" ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-700"}`}>
              {o.paymentMode === "Online" ? "💳 Paid online" : o.paymentMode === "COD" ? `💵 Cash on delivery ${money(o.total)}` : "Pay at pickup"}
            </span>
          </div>
          <div className="text-sm font-semibold text-gray-900 mt-1">{o.customerName} <a className="text-indigo-600 font-normal" href={`tel:${o.customerPhone}`}>{o.customerPhone}</a></div>
          <div className="text-[11px] text-gray-500">
            {o.ageMinutes < 60 ? `${o.ageMinutes} min ago` : `${Math.floor(o.ageMinutes / 60)}h ${o.ageMinutes % 60}m ago`}
            {o.pickupTime && !isDelivery && <> · pickup <b>{o.pickupTime}</b></>}
            {o.transactionRecordId && <> · invoice #{o.transactionRecordId}</>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold text-gray-900">{money(o.total)}</div>
          <div className="text-[10px] text-gray-400">{o.lines.reduce((s, l) => s + l.quantity, 0)} items</div>
        </div>
      </div>

      {isDelivery && o.address && (
        <div className="mt-2 rounded-xl border border-sky-100 bg-sky-50/40 px-3 py-2 text-xs text-gray-700">
          <div className="font-semibold text-sky-900">📍 {o.address.line1}{o.address.line2 ? `, ${o.address.line2}` : ""}</div>
          <div>{[o.address.city, o.address.region].filter(Boolean).join(", ")}</div>
          {(o.address.contactName || o.address.contactPhone) && (
            <div className="text-gray-600">{o.address.contactName}{o.address.contactPhone && <> · <a className="text-indigo-600" href={`tel:${o.address.contactPhone}`}>{o.address.contactPhone}</a></>}</div>
          )}
          {o.address.notes && <div className="text-gray-500 italic">{o.address.notes}</div>}
        </div>
      )}

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
        {isDelivery && (
          <div className="flex items-center justify-between px-3 py-1.5 text-xs text-gray-600">
            <span>🚚 Delivery{o.rateSource ? <span className="text-gray-400"> · {o.rateSource}</span> : null}</span>
            <span>{o.deliveryFee > 0 ? money(o.deliveryFee) : "free"}</span>
          </div>
        )}
      </div>
      {o.notes && <div className="mt-2 rounded-lg bg-amber-50 border border-amber-100 px-3 py-1.5 text-xs text-amber-800">📝 {o.notes}</div>}
      {o.shipment && <ShipmentBlock sh={o.shipment} o={o} busy={busy} run={run} />}
      {err && <div className="mt-2 rounded-lg bg-red-50 border border-red-100 px-3 py-1.5 text-xs text-red-700">{err}</div>}

      {canShip && (
        <div className="mt-3 flex items-end gap-2 flex-wrap">
          <div>
            <label className="text-[11px] text-gray-500">Weight (kg)</label>
            <input type="number" step="0.1" min="0" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="auto" className="block w-24 h-9 px-2 rounded-lg border border-gray-300 text-sm" />
          </div>
          <div>
            <label className="text-[11px] text-gray-500">Pieces</label>
            <input type="number" step="1" min="1" value={pieces} onChange={(e) => setPieces(e.target.value)} className="block w-20 h-9 px-2 rounded-lg border border-gray-300 text-sm" />
          </div>
        </div>
      )}

      <div className="mt-3 flex gap-2 flex-wrap">
        {(o.status === "New" || o.status === "Paid") && (
          <button disabled={busy} onClick={() => run(() => acceptOnlineOrder(o.id))} className="flex-1 h-10 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
            ✓ Accept {o.status === "New" ? "· open invoice + tickets" : "· start preparing"}
          </button>
        )}
        {canShip && (
          <button disabled={busy} onClick={ship} className="flex-1 h-10 rounded-xl bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 disabled:opacity-50">🚚 Create Aramex shipment</button>
        )}
        {o.status === "Accepted" && !isDelivery && (
          <button disabled={busy} onClick={() => run(() => setOnlineOrderStatus(o.id, "Ready"))} className="flex-1 h-10 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50">🔔 Ready for pickup</button>
        )}
        {(o.status === "Accepted" || o.status === "Ready") && !isDelivery && (
          <button disabled={busy} onClick={() => run(() => setOnlineOrderStatus(o.id, "Completed"))} className="h-10 px-4 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">Handed over</button>
        )}
        {(o.status === "New" || o.status === "AwaitingPayment" || (o.status === "Accepted" && isDelivery && !o.shipment)) && (
          <button disabled={busy} onClick={() => { const r = prompt("Reason for cancelling?"); if (r !== null) run(() => setOnlineOrderStatus(o.id, "Cancelled", r)); }} className="h-10 px-4 rounded-xl border border-red-200 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50">Cancel</button>
        )}
        {o.transactionRecordId && o.status !== "Completed" && o.status !== "Delivered" && o.paymentMode !== "Online" && (
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
  const [pickupBusy, setPickupBusy] = useState(false);
  const [pickupMsg, setPickupMsg] = useState<{ ok: boolean; text: string } | null>(null);
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

  const orders = data?.orders ?? [];
  const isDelivery = (o: OnlineOrder) => o.fulfilment === "Delivery";
  const groups = [
    { title: "🆕 New — needs accepting", rows: orders.filter(o => o.status === "New" || o.status === "Paid") },
    { title: "👩‍🍳 Being prepared", rows: orders.filter(o => o.status === "Accepted" && !isDelivery(o)) },
    { title: "📦 To ship — create Aramex shipment", rows: orders.filter(o => o.status === "Accepted" && isDelivery(o)) },
    { title: "🚚 With Aramex", rows: orders.filter(o => o.status === "Shipped") },
    { title: "🔔 Ready for pickup", rows: orders.filter(o => o.status === "Ready") },
    { title: "⏳ Waiting for card payment", rows: orders.filter(o => o.status === "AwaitingPayment") },
    { title: "Done / delivered / cancelled (last 2 days)", rows: orders.filter(o => o.status === "Completed" || o.status === "Delivered" || o.status === "Cancelled") },
  ].filter(g => g.rows.length > 0);

  const toShip = data?.toShipCount ?? 0;
  const inTransit = data?.inTransitCount ?? 0;
  const anyCreated = orders.some(o => o.shipment?.status === "Created");
  const showPickup = toShip + inTransit > 0 || anyCreated;

  const bookPickup = async () => {
    if (!confirm("Ask Aramex to send a courier today for every shipment waiting for pickup? (ready 11:00, last pickup 16:00, closing 20:00)")) return;
    setPickupBusy(true); setPickupMsg(null);
    try {
      const r: PickupResult = await bookCourierPickup({});
      setPickupMsg(r.success
        ? { ok: true, text: `Pickup booked — id ${r.pickupId ?? "—"}, ${r.shipmentsAttached} shipment${r.shipmentsAttached === 1 ? "" : "s"} attached.` }
        : { ok: false, text: r.error ?? "Aramex refused the pickup." });
      await load();
    } catch (e: unknown) { setPickupMsg({ ok: false, text: errorText(e, "Could not book the pickup.") }); }
    finally { setPickupBusy(false); }
  };

  return (
    <div className="p-6 max-w-[1100px] mx-auto space-y-5">
      <audio ref={audio} src="data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU" preload="auto" />
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Online Orders</h1>
          <p className="text-sm text-gray-500 mt-0.5">Orders from axislb.com. Accept → invoice opens and tickets print. Delivery orders go to Aramex. Refreshes every 15 s.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {data && (
            <div className="flex gap-2 text-xs flex-wrap">
              <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-semibold">{data.newCount} new</span>
              <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 font-semibold">{data.acceptedCount} preparing</span>
              <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold">{data.readyCount} ready</span>
              <span className="px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 font-semibold">{toShip} to ship</span>
              <span className="px-2.5 py-1 rounded-full bg-sky-100 text-sky-800 font-semibold">{inTransit} with Aramex</span>
            </div>
          )}
          {showPickup && (
            <button disabled={pickupBusy} onClick={bookPickup} className="h-9 px-3 rounded-lg bg-sky-600 text-white text-xs font-semibold hover:bg-sky-700 disabled:opacity-50">
              {pickupBusy ? "Booking…" : "🚚 Book Aramex pickup"}
            </button>
          )}
          <label className="flex items-center gap-1.5 text-xs text-gray-600"><input type="checkbox" checked={includeDone} onChange={e => setIncludeDone(e.target.checked)} /> show done</label>
          <button onClick={load} className="h-9 px-3 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50">↻</button>
        </div>
      </div>

      {pickupMsg && (
        <div className={`rounded-xl px-4 py-2 text-sm flex items-center justify-between gap-3 ${pickupMsg.ok ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          <span>{pickupMsg.text}</span>
          <button onClick={() => setPickupMsg(null)} className="text-xs opacity-70">dismiss</button>
        </div>
      )}

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
