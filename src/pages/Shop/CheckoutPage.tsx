// /checkout — pickup or delivery, address + live delivery quote, how to pay,
// then place the order.
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import { cartLineTotal, loadCart, clearCart, getStoredCustomer, placeOrder, getCatalog, quoteDelivery } from "../../services/shopService";
import type { CartLine, Fulfilment, PaymentMode, ShopAddress, ShopCatalog, ShopQuote } from "../../services/shopService";
import { ShopPage, money, inputCls, primaryBtn } from "./ShopUi";

const LABEL = "text-xs font-semibold uppercase tracking-[0.2em] text-[#b9d3ee] mb-2";
const CARD_ON = "border-[#87b2dd] bg-[#87b2dd]/15";
const CARD_OFF = "border-white/15 bg-white/5";

export default function CheckoutPage() {
  const navigate = useNavigate();
  const [lines] = useState<CartLine[]>(() => loadCart());
  const customer = getStoredCustomer();

  const [catalog, setCatalog] = useState<ShopCatalog | null>(null);
  const [fulfilment, setFulfilment] = useState<Fulfilment>("Pickup");
  const [mode, setMode] = useState<PaymentMode>("PayAtPickup");
  const [pickup, setPickup] = useState("ASAP");
  const [notes, setNotes] = useState("");

  // Delivery form
  const [contactName, setContactName] = useState(() => `${customer?.firstName ?? ""} ${customer?.lastName ?? ""}`.trim());
  const [contactPhone, setContactPhone] = useState(customer?.phone ?? "");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [courierNotes, setCourierNotes] = useState("");
  const [quote, setQuote] = useState<ShopQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const quoteSeq = useRef(0);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!customer) navigate("/account?next=/checkout", { replace: true });
    else if (lines.length === 0) navigate("/cart", { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let mounted = true;
    getCatalog().then((c) => mounted && setCatalog(c)).catch(() => { /* defaults: pickup + pay at pickup */ });
    return () => { mounted = false; };
  }, []);

  const deliveryEnabled = !!catalog?.deliveryEnabled;
  const codEnabled = !!catalog?.codEnabled;
  const onlineEnabled = catalog ? catalog.onlinePaymentEnabled : true;
  const cities = useMemo(() => {
    const set = new Set<string>();
    (catalog?.zones ?? []).forEach((z) => z.cities.forEach((c) => set.add(c)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [catalog]);

  // Payment options available for the chosen fulfilment.
  const paymentOptions = useMemo<Array<{ mode: PaymentMode; title: string; hint: string }>>(() => {
    if (fulfilment === "Delivery") {
      const opts: Array<{ mode: PaymentMode; title: string; hint: string }> = [];
      if (onlineEnabled) opts.push({ mode: "Online", title: "💳 Pay now by card", hint: "Secure card payment — we pack and ship as soon as it clears." });
      if (codEnabled) opts.push({ mode: "COD", title: "💵 Cash on delivery", hint: "Pay the courier in cash when your parcel arrives." });
      return opts;
    }
    const opts: Array<{ mode: PaymentMode; title: string; hint: string }> = [
      { mode: "PayAtPickup", title: "💵 Pay at pickup", hint: "Cash, card or your AXIS wallet at the counter." },
    ];
    if (onlineEnabled) opts.push({ mode: "Online", title: "💳 Pay now by card", hint: "Secure card payment — your order is ready when you arrive." });
    return opts;
  }, [fulfilment, onlineEnabled, codEnabled]);

  // Keep the payment mode valid when fulfilment / settings change.
  useEffect(() => {
    if (!paymentOptions.some((o) => o.mode === mode) && paymentOptions.length > 0) setMode(paymentOptions[0].mode);
  }, [paymentOptions, mode]);

  // If delivery gets disabled after load, fall back to pickup.
  useEffect(() => { if (catalog && !deliveryEnabled && fulfilment === "Delivery") setFulfilment("Pickup"); }, [catalog, deliveryEnabled, fulfilment]);

  // Live delivery quote — debounced on city.
  useEffect(() => {
    if (fulfilment !== "Delivery") { setQuote(null); setQuoting(false); return; }
    const c = city.trim();
    if (c.length < 2) { setQuote(null); setQuoting(false); return; }
    const seq = ++quoteSeq.current;
    setQuoting(true);
    const t = window.setTimeout(async () => {
      try {
        const q = await quoteDelivery(lines, c, mode);
        if (seq === quoteSeq.current) setQuote(q);
      } catch {
        if (seq === quoteSeq.current) setQuote({ deliverable: false, error: "Could not price delivery right now.", subtotal: 0, deliveryFee: 0, total: 0, weightKg: 0, rateSource: "none" });
      } finally {
        if (seq === quoteSeq.current) setQuoting(false);
      }
    }, 500);
    return () => window.clearTimeout(t);
  }, [fulfilment, city, lines, mode]);

  const subtotal = lines.reduce((s, l) => s + cartLineTotal(l), 0);
  const isDelivery = fulfilment === "Delivery";
  const fee = isDelivery && quote?.deliverable ? quote.deliveryFee : 0;
  const total = subtotal + fee;

  const addressValid = line1.trim().length >= 4 && city.trim().length >= 2 && contactName.trim().length > 0 && contactPhone.trim().length > 0;
  const deliveryReady = !isDelivery || (addressValid && !quoting && !!quote?.deliverable);
  const canSubmit = !busy && lines.length > 0 && deliveryReady && paymentOptions.length > 0;

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const address: ShopAddress | null = isDelivery ? {
        line1: line1.trim(), line2: line2.trim() || null, city: city.trim(), region: quote?.zoneName ?? null,
        notes: courierNotes.trim() || null, contactName: contactName.trim(), contactPhone: contactPhone.trim(),
      } : null;
      const r = await placeOrder(lines, mode, notes, isDelivery ? undefined : pickup, fulfilment, address);
      if (!r.success || !r.order) { setError(r.error ?? "Could not place the order."); return; }
      clearCart();
      if (r.payUrl) { window.location.href = r.payUrl; return; }
      navigate(`/orders/${r.order.code}?placed=1`, { replace: true });
    } catch {
      setError("Could not reach AXIS. Please try again.");
    } finally { setBusy(false); }
  };

  const buttonText = busy ? "Placing order…"
    : mode === "Online" ? `Pay ${money(total)} & place order`
    : mode === "COD" ? `Place order · ${money(total)} — pay on delivery`
    : `Place order · ${money(total)}`;

  const subtitle = isDelivery
    ? `Delivery · ${customer?.firstName ?? ""} ${customer?.phone ?? ""}`
    : `Pickup at AXIS · ${customer?.firstName ?? ""} ${customer?.phone ?? ""}`;

  return (
    <ShopPage title="Checkout" subtitle={subtitle} back={{ to: "/cart", label: "Back to cart" }}>
      <PageMeta title="Checkout — AXIS" description="Place your AXIS order" />

      <div className="rounded-3xl border border-white/10 bg-white/5 divide-y divide-white/10 overflow-hidden">
        {lines.map((l) => (
          <div key={l.key} className="flex items-center justify-between px-4 py-3 text-sm">
            <div className="min-w-0">
              <div className="font-medium truncate">{l.quantity}× {l.name}{l.variantName ? <span className="text-[#b9d3ee]"> · {l.variantName}</span> : null}</div>
              {l.addOns.length > 0 && <div className="text-xs text-gray-400">{l.addOns.map(a => `${a.quantity}× ${a.name}`).join(", ")}</div>}
            </div>
            <div className="font-semibold">{money(cartLineTotal(l))}</div>
          </div>
        ))}
        <div className="px-4 py-3 text-sm space-y-1">
          <div className="flex items-center justify-between text-gray-300"><span>Subtotal</span><span>{money(subtotal)}</span></div>
          {isDelivery && (
            <div className="flex items-center justify-between text-gray-300">
              <span>Delivery</span>
              <span>{quoting ? "…" : quote?.deliverable ? (fee === 0 ? "Free" : money(fee)) : "—"}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-lg font-bold pt-1"><span>Total</span><span>{money(total)}</span></div>
        </div>
      </div>

      {/* Fulfilment */}
      <div className="mt-5">
        <div className={LABEL}>How do you want to get it?</div>
        <div className={`grid gap-2 ${deliveryEnabled ? "grid-cols-2" : "grid-cols-1"}`}>
          <button type="button" onClick={() => setFulfilment("Pickup")}
            className={`rounded-2xl border p-4 text-left ${!isDelivery ? CARD_ON : CARD_OFF}`}>
            <div className="font-bold">🏪 Pickup at AXIS</div>
            <div className="text-xs text-gray-400 mt-1">Grab it at the counter in Beirut.</div>
          </button>
          {deliveryEnabled && (
            <button type="button" onClick={() => setFulfilment("Delivery")}
              className={`rounded-2xl border p-4 text-left ${isDelivery ? CARD_ON : CARD_OFF}`}>
              <div className="font-bold">🚚 Delivery</div>
              <div className="text-xs text-gray-400 mt-1">Aramex to your door, anywhere in Lebanon.</div>
            </button>
          )}
        </div>
      </div>

      {/* Pickup time */}
      {!isDelivery && (
        <div className="mt-5">
          <div className={LABEL}>When will you pick it up?</div>
          <div className="flex flex-wrap gap-2">
            {["ASAP", "in 15 min", "in 30 min", "in 1 hour"].map((p) => (
              <button key={p} type="button" onClick={() => setPickup(p)}
                className={`h-10 px-4 rounded-xl border text-sm ${pickup === p ? "border-[#87b2dd] bg-[#87b2dd]/20" : "border-white/15 bg-white/5 text-gray-300"}`}>{p}</button>
            ))}
          </div>
          <input className={`${inputCls} mt-2`} placeholder="or a time, e.g. 19:30" value={pickup} onChange={(e) => setPickup(e.target.value)} />
        </div>
      )}

      {/* Delivery address */}
      {isDelivery && (
        <div className="mt-5">
          <div className={LABEL}>Where should we send it?</div>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input className={inputCls} placeholder="Contact name" value={contactName} onChange={(e) => setContactName(e.target.value)} autoComplete="name" />
              <input className={inputCls} placeholder="Phone number" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} autoComplete="tel" inputMode="tel" />
            </div>
            <input className={`${inputCls} ${line1.length > 0 && line1.trim().length < 4 ? "border-red-400/60" : ""}`} placeholder="Street address" value={line1} onChange={(e) => setLine1(e.target.value)} autoComplete="address-line1" />
            <input className={inputCls} placeholder="Building, floor, landmark (optional)" value={line2} onChange={(e) => setLine2(e.target.value)} autoComplete="address-line2" />
            <div>
              <input className={inputCls} placeholder="City / area" value={city} onChange={(e) => setCity(e.target.value)} list="axis-cities" autoComplete="address-level2" />
              <datalist id="axis-cities">
                {cities.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <textarea className={`${inputCls} h-20 py-3 resize-none`} placeholder="Notes for the courier (optional) — e.g. call on arrival" value={courierNotes} onChange={(e) => setCourierNotes(e.target.value)} maxLength={300} />
          </div>

          <div className="mt-3 text-sm">
            {city.trim().length < 2 ? (
              <p className="text-gray-500">Enter your city to see the delivery fee.</p>
            ) : quoting ? (
              <p className="text-gray-400">Pricing delivery…</p>
            ) : quote && !quote.deliverable ? (
              <p className="text-red-300">{quote.error || "We can't deliver to that address yet."}</p>
            ) : quote ? (
              <p className="text-green-200">
                {quote.deliveryFee === 0
                  ? `Free delivery${quote.zoneName ? ` to ${quote.zoneName}` : ""}${quote.estimatedDays ? ` · ${quote.estimatedDays}` : ""}`
                  : `Delivery${quote.zoneName ? ` to ${quote.zoneName}` : ""}${quote.estimatedDays ? ` · ${quote.estimatedDays}` : ""}: ${money(quote.deliveryFee)}`}
              </p>
            ) : null}
          </div>
        </div>
      )}

      {/* Payment */}
      <div className="mt-5">
        <div className={LABEL}>How do you want to pay?</div>
        {paymentOptions.length === 0 ? (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-sm text-amber-200">No payment method is available for delivery right now — choose pickup instead.</div>
        ) : (
          <div className={`grid gap-2 ${paymentOptions.length > 1 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
            {paymentOptions.map((o) => (
              <button key={o.mode} type="button" onClick={() => setMode(o.mode)}
                className={`rounded-2xl border p-4 text-left ${mode === o.mode ? CARD_ON : CARD_OFF}`}>
                <div className="font-bold">{o.title}</div>
                <div className="text-xs text-gray-400 mt-1">{o.hint}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-5">
        <div className={LABEL}>{isDelivery ? "Notes for AXIS (optional)" : "Notes for the counter (optional)"}</div>
        <textarea className={`${inputCls} h-24 py-3 resize-none`} placeholder={isDelivery ? "Gift wrap, sleeve colour preference…" : "Anything we should know…"} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
      </div>

      {error && <div className="mt-4 rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-200">{error}</div>}

      <button type="button" disabled={!canSubmit} onClick={submit} className={`${primaryBtn} mt-6`}>
        {buttonText}
      </button>
      <p className="mt-2 text-center text-[11px] text-gray-500">
        {isDelivery
          ? "Delivered by Aramex. Fees are set by city; we'll contact you if anything changes."
          : "By ordering you agree to pick up at AXIS Game Lounge, Beirut."}
      </p>
      <p className="mt-1 text-center text-[11px] text-gray-500">
        By placing this order you agree to our{" "}
        <Link to="/terms" className="text-[#b9d3ee] hover:underline">Terms &amp; Conditions</Link>,{" "}
        <Link to="/refund-policy" className="text-[#b9d3ee] hover:underline">Refund Policy</Link>,{" "}
        <Link to="/shipping-policy" className="text-[#b9d3ee] hover:underline">Shipping Policy</Link> and{" "}
        <Link to="/privacy" className="text-[#b9d3ee] hover:underline">Privacy Policy</Link>.
      </p>
    </ShopPage>
  );
}
