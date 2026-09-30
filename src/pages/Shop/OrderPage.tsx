// /orders/:code — live status of one order (polls while it's in progress).
// Pickup orders show the counter steps; delivery orders show Aramex tracking.
import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import { myOrder, cancelMyOrder, getStoredCustomer, SHIPMENT_STATUS_TEXT } from "../../services/shopService";
import type { OnlineOrder, Shipment } from "../../services/shopService";
import { ShopPage, money, ghostBtn, STATUS_TEXT } from "./ShopUi";

const PICKUP_STEPS = ["Received", "Being prepared", "Ready for pickup", "Completed"];
const DELIVERY_STEPS = ["Received", "Being prepared", "Shipped", "Delivered"];

const DONE = new Set(["Completed", "Cancelled", "Delivered"]);

function stepFor(status: string, delivery: boolean): number {
  if (status === "New" || status === "Paid" || status === "AwaitingPayment") return 0;
  if (status === "Accepted") return 1;
  if (delivery) {
    if (status === "Shipped") return 2;
    if (status === "Delivered" || status === "Completed") return 3;
    return -1;
  }
  if (status === "Ready") return 2;
  if (status === "Completed") return 3;
  return -1;
}

const paymentLabel = (mode: string) =>
  mode === "Online" ? "paid online" : mode === "COD" ? "cash on delivery" : "pay at pickup";

const fmtTime = (iso?: string | null) => (iso ? new Date(iso).toLocaleString() : "");

function ShipmentCard({ shipment }: { shipment: Shipment }) {
  const statusText = SHIPMENT_STATUS_TEXT[shipment.status] ?? shipment.status;
  const events = [...(shipment.events ?? [])].sort((a, b) => new Date(b.eventAt).getTime() - new Date(a.eventAt).getTime());
  const done = shipment.status === "Delivered";
  return (
    <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.2em] text-[#b9d3ee]">Aramex shipment</div>
          {shipment.awbNumber ? (
            shipment.trackingUrl ? (
              <a href={shipment.trackingUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block font-mono text-lg font-bold text-white hover:underline">
                {shipment.awbNumber} ↗
              </a>
            ) : (
              <div className="mt-1 font-mono text-lg font-bold text-white">{shipment.awbNumber}</div>
            )
          ) : (
            <div className="mt-1 text-sm text-gray-400">Waybill pending</div>
          )}
        </div>
        <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold ${done ? "bg-green-500/20 text-green-200" : "bg-sky-500/20 text-sky-200"}`}>{statusText}</span>
      </div>

      {(shipment.lastTrackingText || shipment.lastTrackingAt) && (
        <p className="mt-3 text-sm text-gray-300">
          {shipment.lastTrackingText ?? statusText}
          {shipment.lastTrackingAt && <span className="text-gray-500"> · {fmtTime(shipment.lastTrackingAt)}</span>}
        </p>
      )}

      {shipment.trackingUrl && (
        <a href={shipment.trackingUrl} target="_blank" rel="noopener noreferrer" className={`${ghostBtn} mt-3 inline-block leading-10`}>Track on aramex.com →</a>
      )}

      {events.length > 0 && (
        <ol className="mt-5 relative border-l border-white/15 ml-2 space-y-4">
          {events.map((ev, i) => (
            <li key={ev.id} className="pl-4">
              <span className={`absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full ${i === 0 ? "bg-[#87b2dd]" : "bg-white/30"}`} />
              <div className={`text-sm ${i === 0 ? "text-white font-medium" : "text-gray-300"}`}>{ev.description || ev.code || "Update"}</div>
              <div className="text-xs text-gray-500">
                {ev.location && <span>{ev.location} · </span>}
                {fmtTime(ev.eventAt)}
              </div>
              {ev.comments && <div className="text-xs text-gray-400 mt-0.5">{ev.comments}</div>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default function OrderPage() {
  const { code = "" } = useParams();
  const [params] = useSearchParams();
  const [order, setOrder] = useState<OnlineOrder | null | undefined>(undefined);
  const signedIn = !!getStoredCustomer();

  const load = useCallback(async () => { setOrder(await myOrder(code)); }, [code]);
  useEffect(() => { if (signedIn) load(); else setOrder(null); }, [load, signedIn]);

  useEffect(() => {
    if (!order || DONE.has(order.status)) return;
    const id = window.setInterval(() => { if (document.visibilityState === "visible") load(); }, 15000);
    return () => window.clearInterval(id);
  }, [order, load]);

  if (!signedIn) {
    return (
      <ShopPage title="Order" back={{ to: "/account", label: "Sign in" }}>
        <p className="text-gray-300">Sign in to see this order.</p>
      </ShopPage>
    );
  }
  if (order === undefined) return <ShopPage title="Order"><div className="text-gray-400">Loading…</div></ShopPage>;
  if (order === null) return <ShopPage title="Order not found" back={{ to: "/account", label: "My orders" }}><p className="text-gray-300">We couldn't find that order on your account.</p></ShopPage>;

  const isDelivery = order.fulfilment === "Delivery";
  const isCod = order.paymentMode === "COD";
  const st = STATUS_TEXT[order.status] ?? { label: order.status, tone: "bg-white/10 text-gray-300", hint: "" };
  const steps = isDelivery ? DELIVERY_STEPS : PICKUP_STEPS;
  const stepIndex = stepFor(order.status, isDelivery);
  const addr = order.address;
  const deliveryFee = order.deliveryFee ?? 0;
  const showCod = isCod && order.status !== "Cancelled" && order.status !== "Delivered" && order.status !== "Completed";

  return (
    <ShopPage title={`Order ${order.code}`} subtitle={new Date(order.createdOn).toLocaleString()} back={{ to: "/account", label: "My orders" }}>
      <PageMeta title={`Order ${order.code} — AXIS`} description="Your AXIS order status" />
      {params.get("placed") && order.status !== "Cancelled" && (
        <div className="mb-4 rounded-2xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-200">
          {isDelivery
            ? <>✓ Order placed! We'll pack it and hand it to Aramex — track it here. Order code: <b className="text-white">{order.code}</b></>
            : <>✓ Order placed! Show this code at the counter: <b className="text-white">{order.code}</b></>}
        </div>
      )}

      {showCod && (
        <div className="mb-4 rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          💵 Have <b className="text-white">{money(order.total)}</b> ready in cash for the Aramex courier.
        </div>
      )}

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center justify-between">
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${st.tone}`}>{st.label}</span>
          <span className="text-xs text-gray-400">
            {isDelivery ? "delivery" : "pickup"} · {paymentLabel(order.paymentMode)}
            {!isDelivery && order.pickupTime ? ` · pickup ${order.pickupTime}` : ""}
          </span>
        </div>
        <p className="mt-2 text-sm text-gray-300">{st.hint}</p>

        {order.status === "AwaitingPayment" && order.payUrl && (
          <a href={order.payUrl} className="mt-3 block w-full h-11 leading-[44px] text-center rounded-2xl font-bold text-[#071018] bg-gradient-to-r from-[#6a99cb] to-[#87b2dd]">Complete card payment →</a>
        )}

        {stepIndex >= 0 && (
          <div className="mt-5 grid grid-cols-4 gap-1">
            {steps.map((s, i) => (
              <div key={s} className="text-center">
                <div className={`h-1.5 rounded-full ${i <= stepIndex ? "bg-[#87b2dd]" : "bg-white/10"}`} />
                <div className={`mt-1.5 text-[10px] ${i <= stepIndex ? "text-white" : "text-gray-500"}`}>{s}</div>
              </div>
            ))}
          </div>
        )}

        {isDelivery && addr && (
          <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm">
            <div className="text-[11px] uppercase tracking-[0.2em] text-[#b9d3ee] mb-1">Deliver to</div>
            <div className="text-white">{[addr.line1, addr.line2, addr.city].filter((p) => !!(p && p.trim())).join(", ")}</div>
            {(addr.contactName || addr.contactPhone) && (
              <div className="text-xs text-gray-400 mt-0.5">{[addr.contactName, addr.contactPhone].filter(Boolean).join(" · ")}</div>
            )}
            {addr.notes && <div className="text-xs text-gray-400 mt-0.5">Courier note: {addr.notes}</div>}
          </div>
        )}
      </div>

      {isDelivery && order.shipment && <ShipmentCard shipment={order.shipment} />}

      <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 divide-y divide-white/10 overflow-hidden">
        {order.lines.map((l) => (
          <div key={l.id} className="flex items-center justify-between px-4 py-3 text-sm">
            <div className="min-w-0">
              <div className="font-medium truncate">{l.quantity}× {l.itemName}{l.variantName ? <span className="text-[#b9d3ee]"> · {l.variantName}</span> : null}</div>
              {l.addOns.length > 0 && <div className="text-xs text-gray-400">{l.addOns.map(a => `${a.quantity}× ${a.name}`).join(", ")}</div>}
            </div>
            <div className="font-semibold">{money(l.lineTotal)}</div>
          </div>
        ))}
        {isDelivery ? (
          <div className="px-4 py-3 text-sm space-y-1">
            <div className="flex items-center justify-between text-gray-300"><span>Subtotal</span><span>{money(order.subtotal)}</span></div>
            <div className="flex items-center justify-between text-gray-300"><span>Delivery fee</span><span>{deliveryFee === 0 ? "Free" : money(deliveryFee)}</span></div>
            <div className="flex items-center justify-between text-lg font-bold pt-1"><span>Total</span><span>{money(order.total)}</span></div>
          </div>
        ) : (
          <div className="flex items-center justify-between px-4 py-3 text-lg font-bold"><span>Total</span><span>{money(order.total)}</span></div>
        )}
      </div>
      {order.notes && <p className="mt-2 text-xs text-gray-400">Notes: {order.notes}</p>}

      <div className="mt-6 flex items-center justify-between">
        <Link to="/shop" className={ghostBtn + " leading-10"}>Order again</Link>
        {(order.status === "New" || order.status === "AwaitingPayment") && (
          <button type="button" onClick={async () => { if (confirm("Cancel this order?")) { await cancelMyOrder(order.code); load(); } }} className="text-xs text-gray-500 hover:text-red-300">Cancel order</button>
        )}
      </div>
    </ShopPage>
  );
}
