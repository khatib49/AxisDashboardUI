// /account — sign in / create account (phone or email + password), my orders.
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import {
  Customer, OnlineOrder, customerLogin, customerRegister, customerMe, myOrders,
  getStoredCustomer, storeCustomerSession, clearCustomerSession,
} from "../../services/shopService";
import { ShopPage, money, inputCls, primaryBtn, ghostBtn, STATUS_TEXT } from "./ShopUi";

export default function AccountPage() {
  const [customer, setCustomer] = useState<Customer | null>(() => getStoredCustomer());
  const [mode, setMode] = useState<"login" | "register">("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<OnlineOrder[] | null>(null);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = params.get("next");

  // Validate the stored session against the server once; a dead token signs out.
  useEffect(() => {
    if (!customer) return;
    customerMe().then((me) => {
      if (!me) { clearCustomerSession(); setCustomer(null); return; }
      setCustomer(me);
      myOrders().then(setOrders).catch(() => setOrders([]));
    }).catch(() => { /* offline — keep cached */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = (token: string, c: Customer) => {
    storeCustomerSession(token, c);
    setCustomer(c);
    if (next) navigate(next, { replace: true });
    else myOrders().then(setOrders).catch(() => setOrders([]));
  };

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const r = mode === "login"
        ? await customerLogin(identifier.trim(), password)
        : await customerRegister({ firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim(), email: email.trim() || undefined, password });
      if (!r.success || !r.token || !r.customer) { setError(r.error ?? "Something went wrong."); return; }
      finish(r.token, r.customer);
    } catch {
      setError("Could not reach AXIS. Please try again.");
    } finally { setBusy(false); }
  };

  if (customer) {
    return (
      <ShopPage title={`Hi ${customer.firstName || "there"} 👋`} subtitle={`${customer.phone}${customer.email ? " · " + customer.email : ""}`}>
        <PageMeta title="My account — AXIS" description="Your AXIS account and orders" />
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-[11px] uppercase tracking-[0.2em] text-[#b9d3ee]">Wallet</div>
            <div className="text-2xl font-bold mt-1">{money(customer.walletBalance)}</div>
            <div className="text-[11px] text-gray-500">Top up at the counter — spend on games or food.</div>
          </div>
          <Link to="/menu" className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#6a99cb]/30 to-[#87b2dd]/10 p-4 flex flex-col justify-between">
            <div className="text-[11px] uppercase tracking-[0.2em] text-[#b9d3ee]">Order</div>
            <div className="text-lg font-bold">Browse the menu →</div>
          </Link>
        </div>

        <h2 className="mt-8 text-lg font-bold">My orders</h2>
        {orders === null ? (
          <div className="text-gray-400 text-sm mt-2">Loading…</div>
        ) : orders.length === 0 ? (
          <div className="mt-2 rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-gray-400">No orders yet.</div>
        ) : (
          <div className="mt-2 space-y-2">
            {orders.map((o) => {
              const st = STATUS_TEXT[o.status] ?? { label: o.status, tone: "bg-white/10 text-gray-300", hint: "" };
              return (
                <Link key={o.id} to={`/orders/${o.code}`} className="block rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10">
                  <div className="flex items-center justify-between">
                    <div className="font-bold">{o.code} <span className="text-gray-400 font-normal text-xs">· {new Date(o.createdOn).toLocaleString()}</span></div>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${st.tone}`}>{st.label}</span>
                  </div>
                  <div className="mt-1 text-xs text-gray-400 truncate">{o.lines.map(l => `${l.quantity}× ${l.itemName}${l.variantName ? ` (${l.variantName})` : ""}`).join(", ")}</div>
                  <div className="mt-1 text-sm font-semibold">{money(o.total)} <span className="text-gray-500 font-normal text-xs">· {o.paymentMode === "Online" ? "paid online" : "pay at pickup"}</span></div>
                </Link>
              );
            })}
          </div>
        )}

        <button type="button" onClick={() => { clearCustomerSession(); setCustomer(null); setOrders(null); }} className={`${ghostBtn} mt-8`}>Sign out</button>
      </ShopPage>
    );
  }

  return (
    <ShopPage title={mode === "login" ? "Sign in" : "Create your account"} subtitle="Order ahead, track your orders, and use your AXIS wallet." back={{ to: "/menu", label: "Back to menu" }}>
      <PageMeta title="Sign in — AXIS" description="Sign in to order from AXIS" />
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-white/5 p-1 mb-5">
        {(["login", "register"] as const).map((m) => (
          <button key={m} type="button" onClick={() => { setMode(m); setError(null); }}
            className={`h-10 rounded-xl text-sm font-semibold transition ${mode === m ? "bg-white text-[#071018]" : "text-gray-300"}`}>
            {m === "login" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        {mode === "login" ? (
          <>
            <input className={inputCls} placeholder="Phone number or email" value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" />
            <input className={inputCls} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <input className={inputCls} placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
              <input className={inputCls} placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
            </div>
            <input className={inputCls} placeholder="Phone number (e.g. 03 123 456)" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" inputMode="tel" />
            <input className={inputCls} placeholder="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" />
            <input className={inputCls} type="password" placeholder="Password (6+ characters)" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
            <p className="text-[11px] text-gray-500">Already a client at the counter? Use the same phone number — your wallet and history carry over.</p>
          </>
        )}
        {error && <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-200">{error}</div>}
        <button type="submit" disabled={busy} className={primaryBtn}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</button>
      </form>
    </ShopPage>
  );
}
