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
import { GlobalOutlined, ReloadOutlined } from "@ant-design/icons";
import { Pill } from "../../components/ui/PageKit";
import { CardSkeletons, CountTile, DeskEmpty, DeskHeader, DeskSection } from "../../components/till/desk/DeskKit";
import { deskBtn, deskCard, deskInput } from "../../components/till/desk/deskStyles";
import {
  OnlineOrder, OrderInbox, Shipment, PickupResult,
  getOrderInbox, acceptOnlineOrder, setOnlineOrderStatus,
  shipOnlineOrder, refreshShipment, shipmentLabel, markShipmentDelivered, setShipmentStatus, bookCourierPickup,
  SHIPMENT_STATUS_TEXT,
} from "../../services/shopService";

type Tone = "gray" | "violet" | "blue" | "emerald" | "amber" | "red" | "purple";

const money = (n: number) => `$${n.toFixed(2)}`;
const STATUS: Record<string, Tone> = {
  New: "blue",
  Paid: "emerald",
  AwaitingPayment: "amber",
  Accepted: "violet",
  Ready: "emerald",
  Shipped: "blue",
  Delivered: "emerald",
  Completed: "gray",
  Cancelled: "red",
};
const SHIP_STYLE: Record<string, Tone> = {
  Created: "gray",
  PickedUp: "blue",
  InTransit: "violet",
  OutForDelivery: "amber",
  Delivered: "emerald",
  Returned: "purple",
  Failed: "red",
  Cancelled: "gray",
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
  return (
    <div className="mt-3 rounded-xl border border-sky-100 bg-sky-50/60 px-3 py-2.5 dark:border-sky-500/20 dark:bg-sky-500/[0.06]">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-sky-900 dark:text-sky-200">Aramex</span>
        {sh.awbNumber ? (
          sh.trackingUrl
            ? <a href={sh.trackingUrl} target="_blank" rel="noreferrer" className="font-mono text-violet-600 underline dark:text-violet-300">{sh.awbNumber}</a>
            : <span className="font-mono text-gray-800 dark:text-gray-200">{sh.awbNumber}</span>
        ) : <span className="text-gray-400 dark:text-gray-500">no AWB</span>}
        <Pill tone={SHIP_STYLE[sh.status] ?? "gray"} dot>{SHIPMENT_STATUS_TEXT[sh.status] ?? sh.status}</Pill>
        {sh.environment === "sandbox" && <Pill tone="amber">sandbox</Pill>}
      </div>
      {(sh.lastTrackingText || sh.error) && (
        <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">
          {sh.lastTrackingText && <>{sh.lastTrackingText}{sh.lastTrackingAt && <span className="text-gray-400 dark:text-gray-500"> · {new Date(sh.lastTrackingAt).toLocaleString()}</span>}</>}
          {sh.error && <div className="text-red-600 dark:text-red-400">{sh.error}</div>}
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <button disabled={busy} onClick={openLabel} className={deskBtn("outline")}>🏷 Label</button>
        {!terminal && <button disabled={busy} onClick={() => run(() => refreshShipment(sh.id))} className={deskBtn("outline")}>↻ Refresh tracking</button>}
        {!terminal && <button disabled={busy} onClick={deliver} className={deskBtn("success")}>✓ Mark delivered</button>}
        {!terminal && <button disabled={busy} onClick={returned} className={deskBtn("purple")}>Returned</button>}
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
  // Same test as the "New — needs accepting" group and the Accept button.
  const isNew = o.status === "New" || o.status === "Paid";
  const hot = (o.status === "New" || o.status === "Paid") && o.ageMinutes > 5;
  const canShip = isDelivery && o.status === "Accepted" && !o.shipment;
  const age = o.ageMinutes < 60 ? `${o.ageMinutes} min ago` : `${Math.floor(o.ageMinutes / 60)}h ${o.ageMinutes % 60}m ago`;

  const ship = () => run(() => shipOnlineOrder(o.id, {
    weightKg: weight.trim() === "" ? null : Number(weight),
    pieces: pieces.trim() === "" ? null : Math.max(1, Math.floor(Number(pieces)) || 1),
  }));

  const frame = hot
    ? "border-red-300 ring-2 ring-red-100 dark:border-red-500/50 dark:ring-red-500/15"
    : isNew
      ? "border-blue-300 ring-2 ring-blue-100 dark:border-blue-500/40 dark:ring-blue-500/10"
      : "border-gray-200/80 dark:border-white/[0.06]";

  return (
    <article className={`${deskCard} relative overflow-hidden p-4 ${frame}`}>
      {/* Accent strip: red = waiting > 5 min, blue = new */}
      {(isNew || hot) && <span aria-hidden className={`absolute inset-y-0 left-0 w-1.5 ${hot ? "bg-red-500" : "bg-blue-500"}`} />}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {isNew && <Pill tone="blue" dot>New</Pill>}
            <span className="font-mono text-base font-bold text-gray-900 dark:text-white">{o.code}</span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Pill tone={STATUS[o.status] ?? "gray"} dot>{statusLabel(o)}</Pill>
            <Pill tone={isDelivery ? "blue" : "gray"}>
              {isDelivery ? `🚚 Delivery${o.address?.city ? ` · ${o.address.city}` : ""}` : "🏪 Pickup"}
            </Pill>
            <Pill tone={o.paymentMode === "Online" ? "emerald" : o.paymentMode === "COD" ? "amber" : "gray"}>
              {o.paymentMode === "Online" ? "💳 Paid online" : o.paymentMode === "COD" ? `💵 Cash on delivery ${money(o.total)}` : "Pay at pickup"}
            </Pill>
          </div>
          <div className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
            {o.customerName}{" "}
            <a className="font-normal text-violet-600 dark:text-violet-300" href={`tel:${o.customerPhone}`}>{o.customerPhone}</a>
          </div>
          <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            <span className={hot ? "font-semibold text-red-600 dark:text-red-400" : ""}>{hot && "⚠ "}{age}</span>
            {o.pickupTime && !isDelivery && <> · pickup <b className="text-gray-800 dark:text-gray-200">{o.pickupTime}</b></>}
            {o.transactionRecordId && <> · invoice #{o.transactionRecordId}</>}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-2xl font-bold leading-none tabular-nums text-gray-900 dark:text-white">{money(o.total)}</div>
          <div className="mt-1 text-xs tabular-nums text-gray-500 dark:text-gray-400">{o.lines.reduce((s, l) => s + l.quantity, 0)} items</div>
        </div>
      </div>

      {isDelivery && o.address && (
        <div className="mt-3 rounded-xl border border-sky-100 bg-sky-50/50 px-3 py-2 text-xs text-gray-700 dark:border-sky-500/20 dark:bg-sky-500/[0.06] dark:text-gray-300">
          <div className="font-semibold text-sky-900 dark:text-sky-200">📍 {o.address.line1}{o.address.line2 ? `, ${o.address.line2}` : ""}</div>
          <div>{[o.address.city, o.address.region].filter(Boolean).join(", ")}</div>
          {(o.address.contactName || o.address.contactPhone) && (
            <div className="text-gray-600 dark:text-gray-400">{o.address.contactName}{o.address.contactPhone && <> · <a className="text-violet-600 dark:text-violet-300" href={`tel:${o.address.contactPhone}`}>{o.address.contactPhone}</a></>}</div>
          )}
          {o.address.notes && <div className="italic text-gray-500 dark:text-gray-400">{o.address.notes}</div>}
        </div>
      )}

      <div className="mt-3 divide-y divide-gray-100 rounded-xl border border-gray-100 dark:divide-white/[0.06] dark:border-white/[0.06]">
        {o.lines.map((l) => (
          <div key={l.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
            <div className="min-w-0 text-gray-800 dark:text-gray-100">
              <span className="font-bold tabular-nums text-gray-900 dark:text-white">{l.quantity}×</span> {l.itemName}
              {l.variantName && <span className="text-violet-600 dark:text-violet-300"> · {l.variantName}</span>}
              {l.addOns.length > 0 && <div className="pl-5 text-xs text-gray-500 dark:text-gray-400">+ {l.addOns.map(a => `${a.quantity}× ${a.name}`).join(", ")}</div>}
            </div>
            <span className="shrink-0 tabular-nums text-gray-600 dark:text-gray-300">{money(l.lineTotal)}</span>
          </div>
        ))}
        {isDelivery && (
          <div className="flex items-center justify-between px-3 py-2 text-xs text-gray-600 dark:text-gray-400">
            <span>🚚 Delivery{o.rateSource ? <span className="text-gray-400 dark:text-gray-500"> · {o.rateSource}</span> : null}</span>
            <span className="tabular-nums">{o.deliveryFee > 0 ? money(o.deliveryFee) : "free"}</span>
          </div>
        )}
      </div>
      {o.notes && <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">📝 {o.notes}</div>}
      {o.shipment && <ShipmentBlock sh={o.shipment} o={o} busy={busy} run={run} />}
      {err && <div role="alert" className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">{err}</div>}

      {canShip && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor={`w-${o.id}`} className="text-xs text-gray-500 dark:text-gray-400">Weight (kg)</label>
            <input id={`w-${o.id}`} type="number" step="0.1" min="0" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="auto" className={`${deskInput} block w-28`} />
          </div>
          <div>
            <label htmlFor={`p-${o.id}`} className="text-xs text-gray-500 dark:text-gray-400">Pieces</label>
            <input id={`p-${o.id}`} type="number" step="1" min="1" value={pieces} onChange={(e) => setPieces(e.target.value)} className={`${deskInput} block w-24`} />
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {(o.status === "New" || o.status === "Paid") && (
          <button disabled={busy} onClick={() => run(() => acceptOnlineOrder(o.id))} className={`${deskBtn("primary", "lg")} flex-1`}>
            ✓ Accept {o.status === "New" ? "· open invoice + tickets" : "· start preparing"}
          </button>
        )}
        {canShip && (
          <button disabled={busy} onClick={ship} className={`${deskBtn("sky", "lg")} flex-1`}>🚚 Create Aramex shipment</button>
        )}
        {o.status === "Accepted" && !isDelivery && (
          <button disabled={busy} onClick={() => run(() => setOnlineOrderStatus(o.id, "Ready"))} className={`${deskBtn("success", "lg")} flex-1`}>🔔 Ready for pickup</button>
        )}
        {(o.status === "Accepted" || o.status === "Ready") && !isDelivery && (
          <button disabled={busy} onClick={() => run(() => setOnlineOrderStatus(o.id, "Completed"))} className={deskBtn("outline", "lg")}>Handed over</button>
        )}
        {(o.status === "New" || o.status === "AwaitingPayment" || (o.status === "Accepted" && isDelivery && !o.shipment)) && (
          <button disabled={busy} onClick={() => { const r = prompt("Reason for cancelling?"); if (r !== null) run(() => setOnlineOrderStatus(o.id, "Cancelled", r)); }} className={deskBtn("danger", "lg")}>Cancel</button>
        )}
        {o.transactionRecordId && o.status !== "Completed" && o.status !== "Delivered" && o.paymentMode !== "Online" && (
          <Link to="/cashier/open-invoices" className={deskBtn("outline", "lg")}>Open invoice →</Link>
        )}
      </div>
    </article>
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
    <div className="mx-auto max-w-[1100px] space-y-5 p-3 sm:p-6">
      <audio ref={audio} src="data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU" preload="auto" />
      <DeskHeader
        icon={<GlobalOutlined />}
        tone="blue"
        title="Online Orders"
        badge={data && data.newCount > 0 ? <Pill tone="blue" dot>{data.newCount} new</Pill> : undefined}
        description="Orders from axislb.com. Accept → invoice opens and tickets print. Delivery orders go to Aramex. Refreshes every 15 s."
        actions={
          <>
            {showPickup && (
              <button disabled={pickupBusy} onClick={bookPickup} className={deskBtn("sky")}>
                {pickupBusy ? "Booking…" : "🚚 Book Aramex pickup"}
              </button>
            )}
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 select-none dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-200">
              <input type="checkbox" className="h-4 w-4 accent-violet-600" checked={includeDone} onChange={e => setIncludeDone(e.target.checked)} /> show done
            </label>
            <button onClick={load} aria-label="Refresh orders" title="Refresh" className={`${deskBtn("outline")} w-11 px-0!`}>
              <ReloadOutlined />
            </button>
          </>
        }
      >
        {data && (
          <div className="flex flex-wrap gap-2">
            <CountTile className="min-w-[88px]" label="new" value={data.newCount} tone="blue" highlight={data.newCount > 0} />
            <CountTile className="min-w-[88px]" label="preparing" value={data.acceptedCount} tone="violet" />
            <CountTile className="min-w-[88px]" label="ready" value={data.readyCount} tone="emerald" />
            <CountTile className="min-w-[88px]" label="to ship" value={toShip} tone="sky" />
            <CountTile className="min-w-[88px]" label="with Aramex" value={inTransit} tone="sky" />
          </div>
        )}
      </DeskHeader>

      {pickupMsg && (
        <div
          role="status"
          className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-2 text-sm ${pickupMsg.ok
            ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200"
            : "border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"}`}
        >
          <span>{pickupMsg.text}</span>
          <button onClick={() => setPickupMsg(null)} className="min-h-11 shrink-0 px-2 text-xs font-medium opacity-80 hover:opacity-100">dismiss</button>
        </div>
      )}

      {loading && !data ? <CardSkeletons count={4} height={220} /> : groups.length === 0 ? (
        <DeskEmpty icon={<GlobalOutlined />} title="No online orders right now." hint="New website orders appear here automatically." />
      ) : groups.map(g => (
        <DeskSection key={g.title} title={g.title} count={g.rows.length} tone={g.title.startsWith("🆕") ? "blue" : "gray"}>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {g.rows.map(o => <OrderCard key={o.id} o={o} onChanged={load} />)}
          </div>
        </DeskSection>
      ))}
    </div>
  );
}
