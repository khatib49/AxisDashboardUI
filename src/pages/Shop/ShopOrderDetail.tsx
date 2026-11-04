import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import ShopLayout from "../../components/shop/ShopLayout";
import ShopAuthForm from "../../components/shop/ShopAuthForm";
import ShopWhishPanel from "../../components/shop/ShopWhishPanel";
import OrderTimeline from "../../components/shop/OrderTimeline";
import { statusLabel, statusTone } from "../../components/shop/orderStatus";
import { useShopSession } from "../../components/shop/store";
import { openCollectUrl } from "../../services/whishPayService";
import { cancelMyOrder, fmtMoney, getMyOrder, imageUrl, type OnlineOrderDto } from "../../services/shopService";

const errMsg = (e: unknown) => (e as { message?: string })?.message || "Something went wrong";
const POLL_MS = 15000;
const card = "rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-900";

/** /shop/orders/:code — status timeline, lines, pay link / Whish, cancel while allowed. */
export default function ShopOrderDetail() {
  const { code = "" } = useParams<{ code: string }>();
  const { state } = useLocation() as { state?: { placed?: boolean } };
  const { signedIn } = useShopSession();
  const [order, setOrder] = useState<OnlineOrderDto | null>(null);
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!signedIn) { setLoading(false); return; }
    if (!quiet) setLoading(true);
    try {
      const o = await getMyOrder(code);
      setOrder(o); setMissing(!o); setError(null);
    } catch (e) { if (!quiet) setError(errMsg(e)); } finally { setLoading(false); }
  }, [code, signedIn]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!order || order.status === "Completed" || order.status === "Cancelled" || order.status === "Delivered") return;
    const t = setInterval(() => load(true), POLL_MS);
    return () => clearInterval(t);
  }, [order, load]);

  const cancel = async () => {
    if (!order || cancelling || !window.confirm(`Cancel order ${order.code}?`)) return;
    setCancelling(true); setError(null);
    try { await cancelMyOrder(order.code); await load(true); } catch (e) { setError(errMsg(e)); } finally { setCancelling(false); }
  };

  const canCancel = !!order && (order.status === "New" || order.status === "AwaitingPayment");
  const showWhish = !!order && order.paymentMode !== "Online" && !!order.transactionRecordId && order.status !== "Cancelled" && order.status !== "Completed" && order.status !== "Delivered";

  return (
    <ShopLayout>
      <PageMeta title={`Order ${code} — AXIS Shop`} description={`Status and details of your order ${code}.`} />
      <nav className="text-xs text-gray-500 dark:text-gray-400" aria-label="Breadcrumb"><Link to="/shop/orders" className="hover:underline">My orders</Link> / <span>{code}</span></nav>
      {!signedIn ? (
        <div className="mt-4 max-w-md"><h1 className="mb-2 text-2xl font-bold">Order {code}</h1><p className="mb-3 text-sm text-gray-500 dark:text-gray-400">Sign in to see this order.</p><ShopAuthForm /></div>
      ) : loading ? (
        <div className="mt-4 space-y-3"><div className="h-8 w-48 rounded bg-gray-200 dark:bg-gray-800 animate-pulse" /><div className="h-32 rounded-2xl bg-gray-200 dark:bg-gray-800 animate-pulse" /></div>
      ) : missing ? (
        <div className="mt-6 rounded-2xl border border-dashed border-gray-300 p-10 text-center dark:border-gray-700">
          <h1 className="text-xl font-bold">Order not found</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">We couldn't find order {code} on your account.</p>
          <Link to="/shop/orders" className="mt-4 inline-block text-brand-600 dark:text-brand-400 underline">Back to my orders</Link>
        </div>
      ) : error && !order ? (
        <>
        <h1 className="mt-4 text-2xl font-bold">Order {code}</h1>
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400" role="alert">{error}</div>
        </>
      ) : order && (
        <>
          {state?.placed && <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300" role="status">Thank you! Your order has been placed{order.paymentMode === "PayAtPickup" ? " — pay when you pick it up" : ""}.</div>}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold">Order {order.code}</h1>
            <span className={`rounded-full px-3 py-1 text-sm font-semibold ${statusTone(order.status)}`} data-testid="order-status">{statusLabel(order.status)}</span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Placed {new Date(order.createdOn).toLocaleString()} · {order.fulfilment === "Delivery" ? "Delivery" : "Pickup"} · {order.paymentMode === "COD" ? "Cash on delivery" : order.paymentMode === "Online" ? "Online payment" : "Pay at pickup"}</p>

          <section className={`${card} mt-4`}><OrderTimeline order={order} /></section>

          <div className="mt-4 grid lg:grid-cols-[1fr_340px] gap-4 items-start">
            <section className={card}>
              <h2 className="font-bold">Items</h2>
              <ul className="mt-2 divide-y divide-gray-200 dark:divide-gray-800">
                {order.lines.map((l) => (
                  <li key={l.id} className="py-3 flex gap-3">
                    <Link to={`/shop/p/${l.itemId}`} className="h-14 w-14 shrink-0 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800"><img src={imageUrl(l.imagePath)} alt="" className={`h-full w-full object-cover ${l.imagePath ? "" : "opacity-60 p-3 object-contain"}`} /></Link>
                    <div className="flex-1 min-w-0 text-sm">
                      <div className="flex justify-between gap-2"><span className="font-semibold">{l.quantity} × {l.itemName}{l.variantName ? ` (${l.variantName})` : ""}</span><span className="font-semibold whitespace-nowrap">{fmtMoney(l.lineTotal)}</span></div>
                      {l.addOns.length > 0 && <div className="text-xs text-gray-500 dark:text-gray-400">+ {l.addOns.map((a) => `${a.quantity} × ${a.name}`).join(", ")}</div>}
                    </div>
                  </li>
                ))}
              </ul>
              <dl className="mt-2 space-y-1 text-sm border-t border-gray-200 dark:border-gray-800 pt-2">
                <div className="flex justify-between"><dt>Subtotal</dt><dd>{fmtMoney(order.subtotal)}</dd></div>
                {order.fulfilment === "Delivery" && <div className="flex justify-between"><dt>Delivery</dt><dd>{order.deliveryFee === 0 ? "Free" : fmtMoney(order.deliveryFee)}</dd></div>}
                <div className="flex justify-between text-base"><dt className="font-bold">Total</dt><dd className="font-black" data-testid="order-total">{fmtMoney(order.total)}</dd></div>
              </dl>
              {order.notes && <p className="mt-3 text-sm"><span className="text-gray-500">Notes:</span> {order.notes}</p>}
              {order.pickupTime && <p className="mt-1 text-sm"><span className="text-gray-500">Pickup time:</span> {order.pickupTime}</p>}
              {order.address && (
                <div className="mt-3 text-sm"><div className="text-gray-500">Delivering to</div><div>{order.address.contactName || order.customerName}{order.address.contactPhone ? ` · ${order.address.contactPhone}` : ""}</div><div>{order.address.line1}{order.address.line2 ? `, ${order.address.line2}` : ""}, {order.address.city}{order.address.region ? `, ${order.address.region}` : ""}</div>{order.address.notes && <div className="text-gray-500">{order.address.notes}</div>}</div>
              )}
              {order.shipment && (
                <div className="mt-3 rounded-xl bg-gray-50 p-3 text-sm dark:bg-gray-800"><div className="font-semibold">Shipment · {order.shipment.status}</div>{order.shipment.awbNumber && <div className="text-xs">AWB {order.shipment.awbNumber}{order.shipment.trackingUrl && <> · <a href={order.shipment.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-brand-600 dark:text-brand-400 underline">Track</a></>}</div>}{order.shipment.lastTrackingText && <div className="text-xs text-gray-500 dark:text-gray-400">{order.shipment.lastTrackingText}</div>}</div>
              )}
            </section>

            <aside className="space-y-3">
              {order.status === "AwaitingPayment" && order.payUrl && (
                <section className={`${card} border-amber-300 dark:border-amber-500/40`}>
                  <h2 className="font-bold">Payment pending</h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Complete the card payment to confirm your order.</p>
                  <button type="button" onClick={() => openCollectUrl(order.payUrl!)} className="mt-3 w-full h-11 rounded-xl bg-emerald-600 text-white font-semibold">Pay {fmtMoney(order.total)} now</button>
                </section>
              )}
              {showWhish && <ShopWhishPanel code={order.code} onPaid={() => load(true)} />}
              {order.status === "New" && order.paymentMode !== "Online" && <section className={`${card} text-sm text-gray-600 dark:text-gray-300`}>{order.paymentMode === "COD" ? "You'll pay the courier on delivery." : "You'll pay at pickup."} The shop will confirm your order shortly.</section>}
              {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
              {canCancel && <button type="button" onClick={cancel} disabled={cancelling} data-testid="cancel-order" className="w-full h-11 rounded-xl border border-red-300 text-red-600 font-semibold hover:bg-red-50 disabled:opacity-50 dark:border-red-500/40 dark:hover:bg-red-500/10">{cancelling ? "Cancelling…" : "Cancel order"}</button>}
              <Link to="/shop" className="block text-center text-sm text-brand-600 dark:text-brand-400 hover:underline">Continue shopping</Link>
            </aside>
          </div>
        </>
      )}
    </ShopLayout>
  );
}
