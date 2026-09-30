// /account — sign in / create account (phone or email + password), my orders.
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import {
  Customer, OnlineOrder, customerLogin, customerRegister, customerMe, myOrders,
  getStoredCustomer, storeCustomerSession, clearCustomerSession,
} from "../../services/shopService";
import { ShopPage, money, inputCls, primaryBtn, ghostBtn, STATUS_TEXT } from "./ShopUi";
import { myTickets, formatTicketDate } from "../../services/eventTicketService";
import type { EventTicket } from "../../services/eventTicketService";

const TICKET_STATUS: Record<string, { label: string; tone: string }> = {
  Paid:     { label: "Paid",            tone: "bg-green-500/20 text-green-200" },
  Pending:  { label: "Pending payment", tone: "bg-amber-500/20 text-amber-200" },
  Rejected: { label: "Rejected",        tone: "bg-red-500/20 text-red-200" },
  Refunded: { label: "Refunded",        tone: "bg-white/10 text-gray-300" },
};
const ticketStatus = (t: EventTicket) =>
  t.checkedInOn ? { label: "Checked in ✓", tone: "bg-[#87b2dd]/25 text-[#d8e8f8]" }
  : TICKET_STATUS[t.paymentStatus] ?? { label: t.paymentStatus, tone: "bg-white/10 text-gray-300" };

function PasswordInput({ value, onChange, show, onToggle, placeholder, autoComplete, invalid }: {
  value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void;
  placeholder: string; autoComplete: string; invalid?: boolean;
}) {
  return (
    <div className="relative">
      <input
        className={`${inputCls} pr-12 ${invalid ? "border-red-400/60" : ""}`}
        type={show ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
      />
      <button type="button" onClick={onToggle} aria-label={show ? "Hide password" : "Show password"} tabIndex={-1}
        className="absolute right-0 top-0 h-12 w-12 flex items-center justify-center text-gray-400 hover:text-white">
        {show ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
        )}
      </button>
    </div>
  );
}

export default function AccountPage() {
  const [customer, setCustomer] = useState<Customer | null>(() => getStoredCustomer());
  const [mode, setMode] = useState<"login" | "register">("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<OnlineOrder[] | null>(null);
  const [tickets, setTickets] = useState<EventTicket[] | null>(null);
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
      myTickets().then(setTickets).catch(() => setTickets([]));
    }).catch(() => { /* offline — keep cached */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = (token: string, c: Customer) => {
    storeCustomerSession(token, c);
    setCustomer(c);
    if (next) navigate(next, { replace: true });
    else {
      myOrders().then(setOrders).catch(() => setOrders([]));
      myTickets().then(setTickets).catch(() => setTickets([]));
    }
  };

  const mismatch = mode === "register" && confirm.length > 0 && confirm !== password;

  const submit = async () => {
    setError(null);
    if (mode === "register") {
      if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
      if (password !== confirm) { setError("Passwords do not match."); return; }
    }
    setBusy(true);
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
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#6a99cb]/30 to-[#87b2dd]/10 p-4 flex flex-col justify-between gap-2">
            <div className="text-[11px] uppercase tracking-[0.2em] text-[#b9d3ee]">Order</div>
            <Link to="/shop" className="text-lg font-bold leading-tight hover:underline">Shop cards &amp; accessories →</Link>
            <Link to="/menu" className="text-xs text-[#d8e8f8]/80 hover:text-white hover:underline">See the café menu</Link>
          </div>
        </div>

        <h2 className="mt-8 text-lg font-bold">My tickets</h2>
        {tickets === null ? (
          <div className="text-gray-400 text-sm mt-2">Loading…</div>
        ) : tickets.length === 0 ? (
          <div className="mt-2 rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-gray-400">
            No tickets yet — <Link to="/events" className="text-[#b9d3ee] underline">see upcoming events</Link>
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            {tickets.map((t) => {
              const st = ticketStatus(t);
              return (
                <Link key={t.ticketCode} to={`/tickets/${encodeURIComponent(t.ticketCode)}`}
                  className={`block rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 ${t.isUpcoming ? "" : "opacity-70"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-bold truncate">🎟 {t.eventTitle}</div>
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold ${st.tone}`}>{st.label}</span>
                  </div>
                  <div className="mt-1 text-xs text-gray-400">
                    {formatTicketDate(t.eventDate)}{t.location ? ` · ${t.location}` : ""}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-sm">
                    <span className="font-mono text-gray-300">{t.ticketCode}</span>
                    <span className="text-[#b9d3ee] font-semibold">Open ticket →</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

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
                  <div className="mt-1 text-sm font-semibold">{money(o.total)} <span className="text-gray-500 font-normal text-xs">· {o.paymentMode === "Online" ? "paid online" : o.paymentMode === "COD" ? "cash on delivery" : "pay at pickup"}</span></div>
                </Link>
              );
            })}
          </div>
        )}

        <button type="button" onClick={() => { clearCustomerSession(); setCustomer(null); setOrders(null); setTickets(null); }} className={`${ghostBtn} mt-8`}>Sign out</button>
      </ShopPage>
    );
  }

  return (
    <ShopPage title={mode === "login" ? "Sign in" : "Create your account"} subtitle="Order ahead, track your orders, and use your AXIS wallet." back={{ to: "/shop", label: "Back to shop" }}>
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
            <PasswordInput value={password} onChange={setPassword} show={showPw} onToggle={() => setShowPw(s => !s)} placeholder="Password" autoComplete="current-password" />
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <input className={inputCls} placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
              <input className={inputCls} placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
            </div>
            <input className={inputCls} placeholder="Phone number (e.g. 03 123 456)" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" inputMode="tel" />
            <input className={inputCls} placeholder="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" />
            <PasswordInput value={password} onChange={setPassword} show={showPw} onToggle={() => setShowPw(s => !s)} placeholder="Password (6+ characters)" autoComplete="new-password" />
            <PasswordInput value={confirm} onChange={setConfirm} show={showPw} onToggle={() => setShowPw(s => !s)} placeholder="Confirm password" autoComplete="new-password" invalid={mismatch} />
            {mismatch && <p className="text-[11px] text-red-300 -mt-1">Passwords do not match.</p>}
            <p className="text-[11px] text-gray-500">Already a client at the counter? Use the same phone number — your wallet and history carry over.</p>
          </>
        )}
        {error && <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-200">{error}</div>}
        <button type="submit" disabled={busy} className={primaryBtn}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</button>
      </form>
    </ShopPage>
  );
}
