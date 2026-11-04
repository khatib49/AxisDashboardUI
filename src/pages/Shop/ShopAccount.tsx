import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import ShopLayout from "../../components/shop/ShopLayout";
import ShopAuthForm from "../../components/shop/ShopAuthForm";
import { useShopSession } from "../../components/shop/store";
import { fmtMoney, getMe } from "../../services/shopService";

const card = "rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-900";

/** /shop/account — profile + wallet, sign in / out. */
export default function ShopAccount() {
  const { signedIn, customer, signOut } = useShopSession();
  const nav = useNavigate();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!signedIn) return;
    let on = true; setRefreshing(true);
    getMe().catch(() => { /* a 401 clears the session via the interceptor */ }).finally(() => on && setRefreshing(false));
    return () => { on = false; };
  }, [signedIn]);

  return (
    <ShopLayout>
      <PageMeta title="My account — AXIS Shop" description="Your shop account: profile, wallet balance and orders." />
      <h1 className="text-2xl sm:text-3xl font-bold">My account</h1>
      {!signedIn ? (
        <div className="mt-4 max-w-md"><ShopAuthForm onDone={() => nav("/shop/account")} /></div>
      ) : (
        <div className="mt-4 grid sm:grid-cols-2 gap-4 max-w-3xl">
          <section className={card} data-testid="account-card">
            <h2 className="font-bold">Profile</h2>
            <dl className="mt-2 text-sm space-y-1">
              <div className="flex justify-between gap-3"><dt className="text-gray-500">Name</dt><dd className="font-semibold text-right">{customer ? `${customer.firstName} ${customer.lastName}`.trim() : "—"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-gray-500">Phone</dt><dd className="text-right">{customer?.phone || "—"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-gray-500">Email</dt><dd className="text-right">{customer?.email || "—"}</dd></div>
            </dl>
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">This is the same account the lounge uses at the counter (wallet, loyalty, history). Ask the staff to update your details.</p>
          </section>
          <section className={card}>
            <h2 className="font-bold">Wallet</h2>
            <div className="mt-2 text-3xl font-black">{refreshing && !customer ? "…" : fmtMoney(customer?.walletBalance ?? 0)}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Top up at the counter; the balance can be used when you pay at pickup.</p>
          </section>
          <section className={`${card} sm:col-span-2 flex flex-wrap gap-2`}>
            <Link to="/shop/orders" className="h-11 px-5 rounded-xl bg-brand-500 text-white font-semibold flex items-center">My orders</Link>
            <Link to="/shop" className="h-11 px-5 rounded-xl border border-gray-300 font-semibold flex items-center dark:border-gray-700">Shop</Link>
            <button type="button" onClick={() => { signOut(); nav("/shop"); }} data-testid="sign-out" className="ml-auto h-11 px-5 rounded-xl border border-red-300 text-red-600 font-semibold dark:border-red-500/40">Sign out</button>
          </section>
        </div>
      )}
    </ShopLayout>
  );
}
