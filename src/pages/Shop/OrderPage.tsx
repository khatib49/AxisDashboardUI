// /orders/:code — live status of one order (polls while it's in progress).
import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import { OnlineOrder, myOrder, cancelMyOrder, getStoredCustomer } from "../../services/shopService";
import { ShopPage, money, ghostBtn, STATUS_TEXT } from "./ShopUi";

const STEPS = ["Received", "Being prepared", "Ready for pickup", "Completed"];

export default function OrderPage() {
  const { code = "" } = useParams();
  const [params] = useSearchParams();
  const [order, setOrder] = useState<OnlineOrder | null | undefined>(undefined);
  const signedIn = !!getStoredCustomer();

  const load = useCallback(async () => { setOrder(await myOrder(code)); }, [code]);
  useEffect(() => { if (signedIn) load(); else setOrder(null); }, [load, signedIn]);

  useEffect(() => {
    if (!order || order.status === "Completed" || order.status === "Cancelled") return;
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

  const st = STATUS_TEXT[order.status] ?? { label: order.status, tone: "bg-white/10 text-gray-300", hint: "" };
  const stepIndex = order.status === "New" || order.status === "Paid" || order.status === "AwaitingPayment" ? 0
    : order.status === "Accepted" ? 1 : order.status === "Ready" ? 2 : order.status === "Completed" ? 3 : -1;

  return (
    <ShopPage title={`Order ${order.code}`} subtitle={new Date(order.createdOn).toLocaleString()} back={{ to: "/account", label: "My orders" }}>
      <PageMeta title={`Order ${order.code} — AXIS`} description="Your AXIS order status" />
      {params.get("placed") && order.status !== "Cancelled" && (
        <div className="mb-4 rounded-2xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-200">
          ✓ Order placed! Show this code at the counter: <b className="text-white">{order.code}</b>
        </div>
      )}

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center justify-between">
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${st.tone}`}>{st.label}</span>
          <span className="text-xs text-gray-400">{order.paymentMode === "Online" ? "paid online" : "pay at pickup"}{order.pickupTime ? ` · pickup ${order.pickupTime}` : ""}</span>
        </div>
        <p className="mt-2 text-sm text-gray-300">{st.hint}</p>

        {order.status === "AwaitingPayment" && order.payUrl && (
          <a href={order.payUrl} className="mt-3 block w-full h-11 leading-[44px] text-center rounded-2xl font-bold text-[#071018] bg-gradient-to-r from-[#6a99cb] to-[#87b2dd]">Complete card payment →</a>
        )}

        {stepIndex >= 0 && (
          <div className="mt-5 grid grid-cols-4 gap-1">
            {STEPS.map((s, i) => (
              <div key={s} className="text-center">
                <div className={`h-1.5 rounded-full ${i <= stepIndex ? "bg-[#87b2dd]" : "bg-white/10"}`} />
                <div className={`mt-1.5 text-[10px] ${i <= stepIndex ? "text-white" : "text-gray-500"}`}>{s}</div>
              </div>
            ))}
          </div>
        )}
      </div>

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
        <div className="flex items-center justify-between px-4 py-3 text-lg font-bold"><span>Total</span><span>{money(order.total)}</span></div>
      </div>
      {order.notes && <p className="mt-2 text-xs text-gray-400">Notes: {order.notes}</p>}

      <div className="mt-6 flex items-center justify-between">
        <Link to="/menu" className={ghostBtn + " leading-10"}>Order again</Link>
        {(order.status === "New" || order.status === "AwaitingPayment") && (
          <button type="button" onClick={async () => { if (confirm("Cancel this order?")) { await cancelMyOrder(order.code); load(); } }} className="text-xs text-gray-500 hover:text-red-300">Cancel order</button>
        )}
      </div>
    </ShopPage>
  );
}
