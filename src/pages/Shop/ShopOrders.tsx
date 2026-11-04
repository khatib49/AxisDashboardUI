import { useEffect, useState } from "react";
import { Link } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import ShopLayout from "../../components/shop/ShopLayout";
import ShopAuthForm from "../../components/shop/ShopAuthForm";
import { statusLabel, statusTone } from "../../components/shop/orderStatus";
import { useShopSession } from "../../components/shop/store";
import { fmtMoney, getMyOrders, type OnlineOrderDto } from "../../services/shopService";

const errMsg = (e: unknown) => (e as { message?: string })?.message || "Something went wrong";
const when = (iso: string) => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

/** /shop/orders — the signed-in customer's orders. */
export default function ShopOrders() {
  const { signedIn } = useShopSession();
  const [rows, setRows] = useState<OnlineOrderDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!signedIn) { setRows([]); return; }
    let on = true; setLoading(true);
    getMyOrders().then((r) => { if (on) { setRows(r); setError(null); } }).catch((e) => on && setError(errMsg(e))).finally(() => on && setLoading(false));
    return () => { on = false; };
  }, [signedIn]);

  return (
    <ShopLayout>
      <PageMeta title="My orders — AXIS Shop" description="Track the status of your online orders." />
      <h1 className="text-2xl sm:text-3xl font-bold">My orders</h1>
      {!signedIn ? (
        <div className="mt-4 max-w-md"><p className="mb-3 text-sm text-gray-500 dark:text-gray-400">Sign in to see your orders.</p><ShopAuthForm /></div>
      ) : loading ? (
        <div className="mt-4 space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-2xl bg-gray-200 dark:bg-gray-800 animate-pulse" />)}</div>
      ) : error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400" role="alert">{error}</div>
      ) : rows.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-gray-300 p-10 text-center text-sm dark:border-gray-700">No orders yet. <Link to="/shop" className="text-brand-600 dark:text-brand-400 underline">Start shopping</Link></div>
      ) : (
        <ul className="mt-4 space-y-2" data-testid="orders-list">
          {rows.map((o) => (
            <li key={o.id}>
              <Link to={`/shop/orders/${o.code}`} className="block rounded-2xl border border-gray-200 bg-white p-4 hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><span className="font-bold">{o.code}</span><span className="ml-2 text-xs text-gray-500 dark:text-gray-400">{when(o.createdOn)}</span></div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusTone(o.status)}`}>{statusLabel(o.status)}</span>
                </div>
                <div className="mt-1 flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-300 truncate">{o.lines.map((l) => `${l.quantity} × ${l.itemName}`).join(", ")}</span>
                  <span className="font-semibold whitespace-nowrap">{fmtMoney(o.total)}</span>
                </div>
                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{o.fulfilment === "Delivery" ? `Delivery to ${o.address?.city ?? ""}` : "Pickup"} · {o.paymentMode === "COD" ? "Cash on delivery" : o.paymentMode === "Online" ? "Paid online" : "Pay at pickup"}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </ShopLayout>
  );
}
