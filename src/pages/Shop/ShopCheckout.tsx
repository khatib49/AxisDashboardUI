import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import ShopLayout from "../../components/shop/ShopLayout";
import ShopAuthForm from "../../components/shop/ShopAuthForm";
import { lineTotal, toRequestLines, useCart, useShopSession } from "../../components/shop/store";
import { openCollectUrl } from "../../services/whishPayService";
import {
  fmtMoney, getCatalog, placeOrder, quoteDelivery,
  type OnlineOrderDto, type ShopCatalogDto, type ShopFulfilment, type ShopPaymentMode, type ShopQuoteDto,
} from "../../services/shopService";

const errMsg = (e: unknown) => (e as { message?: string })?.message || "Something went wrong";
const field = "w-full h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-brand-400 dark:border-gray-700 dark:bg-gray-800";
const card = "rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-900";

/**
 * /shop/checkout — inline sign-in/register, pickup or delivery (address + zone
 * city), payment mode from the catalogue switches, server quote, then
 * POST shop/orders. Online → hosted checkout link (MontyPay) from PayUrl.
 */
export default function ShopCheckout() {
  const nav = useNavigate();
  const { lines, subtotal, clear } = useCart();
  const { signedIn, customer } = useShopSession();
  const [cat, setCat] = useState<ShopCatalogDto | null>(null);
  const [fulfilment, setFulfilment] = useState<ShopFulfilment>("Pickup");
  const [payment, setPayment] = useState<ShopPaymentMode>("PayAtPickup");
  const [pickupTime, setPickupTime] = useState("");
  const [notes, setNotes] = useState("");
  const [line1, setLine1] = useState(""); const [line2, setLine2] = useState("");
  const [city, setCity] = useState(() => { try { return localStorage.getItem("shop_city") ?? ""; } catch { return ""; } });
  const [region, setRegion] = useState(""); const [addrNotes, setAddrNotes] = useState("");
  const [contactName, setContactName] = useState(""); const [contactPhone, setContactPhone] = useState("");
  const [quote, setQuote] = useState<ShopQuoteDto | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<{ order: OnlineOrderDto; payUrl: string | null } | null>(null);

  useEffect(() => { getCatalog().then(setCat).catch((e) => setError(errMsg(e))); }, []);

  const cities = useMemo(() => Array.from(new Set((cat?.zones ?? []).flatMap((z) => z.cities))).sort(), [cat]);
  const deliveryOk = !!cat?.deliveryEnabled;
  const onlineOk = !!cat?.onlinePaymentEnabled;
  const codOk = !!cat?.codEnabled;

  // Valid payment modes per fulfilment (same rules ShopService enforces).
  const modes: { value: ShopPaymentMode; label: string; hint: string; ok: boolean }[] = fulfilment === "Pickup"
    ? [{ value: "PayAtPickup", label: "Pay at pickup", hint: "Cash, card or Whish at the counter", ok: true },
       { value: "Online", label: "Pay online now", hint: "Card via secure hosted checkout", ok: onlineOk }]
    : [{ value: "Online", label: "Pay online now", hint: "Card via secure hosted checkout", ok: onlineOk },
       { value: "COD", label: "Cash on delivery", hint: "Pay the courier when it arrives", ok: codOk }];
  useEffect(() => {
    const first = modes.find((m) => m.ok && m.value === payment) ?? modes.find((m) => m.ok);
    if (first && first.value !== payment) setPayment(first.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fulfilment, onlineOk, codOk]);

  useEffect(() => {
    if (fulfilment !== "Delivery" || !city.trim() || lines.length === 0) { setQuote(null); return; }
    let on = true; setQuoting(true);
    const t = setTimeout(() => {
      quoteDelivery({ lines: toRequestLines(lines), city: city.trim(), paymentMode: payment })
        .then((q) => on && setQuote(q)).catch(() => on && setQuote(null)).finally(() => on && setQuoting(false));
    }, 300);
    return () => { on = false; clearTimeout(t); };
  }, [fulfilment, city, lines, payment]);

  const deliveryFee = fulfilment === "Delivery" && quote?.deliverable ? quote.deliveryFee : 0;
  const total = Math.round((subtotal + deliveryFee) * 100) / 100;
  const canSubmit = signedIn && lines.length > 0 && !submitting && (fulfilment === "Pickup" || (line1.trim().length >= 4 && city.trim() && quote?.deliverable));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true); setError(null);
    try {
      const r = await placeOrder({
        lines: toRequestLines(lines), paymentMode: payment, fulfilment,
        notes: notes.trim() || null, pickupTime: fulfilment === "Pickup" ? pickupTime.trim() || null : null,
        address: fulfilment === "Delivery" ? { line1: line1.trim(), line2: line2.trim() || null, city: city.trim(), region: region.trim() || null, notes: addrNotes.trim() || null, contactName: contactName.trim() || null, contactPhone: contactPhone.trim() || null } : null,
      });
      clear();
      const order = r.order!;
      if (r.payUrl) setPlaced({ order, payUrl: r.payUrl });
      else nav(`/shop/orders/${order.code}`, { state: { placed: true } });
    } catch (err) { setError(errMsg(err)); } finally { setSubmitting(false); }
  };

  const radio = (on: boolean, disabled = false) => `flex items-start gap-3 rounded-xl border p-3 text-sm cursor-pointer ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${on ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10" : "border-gray-300 dark:border-gray-700"}`;

  if (placed) {
    return (
      <ShopLayout>
        <PageMeta title={`Order ${placed.order.code} — pay now — AXIS Shop`} description="Complete your payment on the secure hosted checkout." />
        <div className={`${card} max-w-lg mx-auto text-center`}>
          <div className="text-4xl" aria-hidden>🎉</div>
          <h1 className="mt-2 text-2xl font-bold">Order {placed.order.code} placed</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Finish the payment to confirm it. The secure checkout opens in a new tab.</p>
          <button type="button" onClick={() => openCollectUrl(placed.payUrl!)} className="mt-4 w-full h-11 rounded-xl bg-emerald-600 text-white font-semibold">Pay {fmtMoney(placed.order.total)} now</button>
          <a href={placed.payUrl!} target="_blank" rel="noopener noreferrer" className="mt-2 block text-xs text-brand-600 dark:text-brand-400 underline break-all">{placed.payUrl}</a>
          <Link to={`/shop/orders/${placed.order.code}`} className="mt-4 inline-block text-sm text-gray-600 dark:text-gray-300 hover:underline">View order status</Link>
        </div>
      </ShopLayout>
    );
  }

  return (
    <ShopLayout>
      <PageMeta title="Checkout — AXIS Shop" description="Sign in, choose pickup or delivery and place your order." />
      <h1 className="text-2xl sm:text-3xl font-bold">Checkout</h1>
      {lines.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-gray-300 p-10 text-center text-sm dark:border-gray-700">Your cart is empty. <Link to="/shop" className="text-brand-600 dark:text-brand-400 underline">Start shopping</Link></div>
      ) : (
        <form onSubmit={submit} className="mt-4 grid lg:grid-cols-[1fr_360px] gap-6 items-start">
          <div className="space-y-5">
            <section className={card}>
              <h2 className="font-bold">1. Your account</h2>
              {signedIn ? (
                <p className="mt-2 text-sm">Signed in as <strong>{customer ? `${customer.firstName} ${customer.lastName}`.trim() : "customer"}</strong>{customer?.phone ? ` · ${customer.phone}` : ""} · <Link to="/shop/account" className="text-brand-600 dark:text-brand-400 underline">change</Link></p>
              ) : (
                <div className="mt-3"><ShopAuthForm compact /></div>
              )}
            </section>

            <section className={card}>
              <h2 className="font-bold">2. Pickup or delivery</h2>
              <div className="mt-3 grid sm:grid-cols-2 gap-2">
                <label className={radio(fulfilment === "Pickup")}><input type="radio" name="fulfilment" checked={fulfilment === "Pickup"} onChange={() => setFulfilment("Pickup")} className="mt-0.5" /><span><strong>Pickup at the lounge</strong><br /><span className="text-gray-500 dark:text-gray-400">Free · ready when you arrive</span></span></label>
                <label className={radio(fulfilment === "Delivery", !deliveryOk)}><input type="radio" name="fulfilment" disabled={!deliveryOk} checked={fulfilment === "Delivery"} onChange={() => setFulfilment("Delivery")} className="mt-0.5" /><span><strong>Delivery</strong><br /><span className="text-gray-500 dark:text-gray-400">{deliveryOk ? "Fee by zone, shown before you pay" : "Not available right now"}</span></span></label>
              </div>
              {fulfilment === "Pickup" ? (
                <label className="mt-3 block text-sm"><span className="text-gray-600 dark:text-gray-300">Pickup time (optional)</span><input className={field} value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} placeholder="e.g. today 7:30 pm" maxLength={60} /></label>
              ) : (
                <div className="mt-3 grid sm:grid-cols-2 gap-3">
                  <label className="block text-sm sm:col-span-2"><span className="text-gray-600 dark:text-gray-300">Street address</span><input className={field} value={line1} onChange={(e) => setLine1(e.target.value)} required minLength={4} autoComplete="address-line1" name="line1" /></label>
                  <label className="block text-sm sm:col-span-2"><span className="text-gray-600 dark:text-gray-300">Building / floor (optional)</span><input className={field} value={line2} onChange={(e) => setLine2(e.target.value)} autoComplete="address-line2" /></label>
                  <label className="block text-sm"><span className="text-gray-600 dark:text-gray-300">City</span>
                    <input list="checkout-cities" className={field} value={city} onChange={(e) => setCity(e.target.value)} required autoComplete="address-level2" name="city" />
                    <datalist id="checkout-cities">{cities.map((c) => <option key={c} value={c} />)}</datalist></label>
                  <label className="block text-sm"><span className="text-gray-600 dark:text-gray-300">Region (optional)</span><input className={field} value={region} onChange={(e) => setRegion(e.target.value)} autoComplete="address-level1" /></label>
                  <label className="block text-sm"><span className="text-gray-600 dark:text-gray-300">Deliver to (name, optional)</span><input className={field} value={contactName} onChange={(e) => setContactName(e.target.value)} /></label>
                  <label className="block text-sm"><span className="text-gray-600 dark:text-gray-300">Contact phone (optional)</span><input className={field} type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} /></label>
                  <label className="block text-sm sm:col-span-2"><span className="text-gray-600 dark:text-gray-300">Delivery notes (optional)</span><input className={field} value={addrNotes} onChange={(e) => setAddrNotes(e.target.value)} maxLength={500} /></label>
                  <div className="sm:col-span-2 text-sm" aria-live="polite">
                    {quoting ? <span className="text-gray-500">Checking delivery…</span>
                      : quote ? (quote.deliverable ? <span className="text-emerald-700 dark:text-emerald-400">Delivery to {city}: {quote.deliveryFee === 0 ? "free" : fmtMoney(quote.deliveryFee)}{quote.zoneName ? ` (${quote.zoneName})` : ""}{quote.estimatedDays ? ` · ${quote.estimatedDays}` : ""}</span>
                        : <span className="text-amber-700 dark:text-amber-400">{quote.error || "We can't deliver to that city."}</span>)
                      : city ? null : <span className="text-gray-500">Enter your city to see the delivery fee.</span>}
                  </div>
                </div>
              )}
            </section>

            <section className={card}>
              <h2 className="font-bold">3. Payment</h2>
              <div className="mt-3 grid sm:grid-cols-2 gap-2">
                {modes.map((m) => (
                  <label key={m.value} className={radio(payment === m.value, !m.ok)}>
                    <input type="radio" name="payment" value={m.value} disabled={!m.ok} checked={payment === m.value} onChange={() => setPayment(m.value)} className="mt-0.5" />
                    <span><strong>{m.label}</strong><br /><span className="text-gray-500 dark:text-gray-400">{m.ok ? m.hint : "Not available right now"}</span></span>
                  </label>
                ))}
              </div>
              {payment === "PayAtPickup" && <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Once the shop accepts your order you can also pay it online with Whish from the order page.</p>}
              <label className="mt-3 block text-sm"><span className="text-gray-600 dark:text-gray-300">Order notes (optional)</span><textarea className={`${field} h-20 py-2`} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} /></label>
            </section>
          </div>

          <aside className={`${card} lg:sticky lg:top-20`}>
            <h2 className="font-bold">Order summary</h2>
            <ul className="mt-3 divide-y divide-gray-200 dark:divide-gray-800 text-sm">
              {lines.map((l) => (
                <li key={l.key} className="py-2 flex justify-between gap-2"><span>{l.quantity} × {l.name}{l.variantName ? ` (${l.variantName})` : ""}{l.addOns.length ? <span className="block text-xs text-gray-500">+ {l.addOns.map((a) => a.name).join(", ")}</span> : null}</span><span className="whitespace-nowrap">{fmtMoney(lineTotal(l))}</span></li>
              ))}
            </ul>
            <dl className="mt-2 space-y-1 text-sm border-t border-gray-200 dark:border-gray-800 pt-2">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{fmtMoney(subtotal)}</dd></div>
              <div className="flex justify-between"><dt>Delivery</dt><dd>{fulfilment === "Pickup" ? "Free (pickup)" : quote?.deliverable ? (deliveryFee === 0 ? "Free" : fmtMoney(deliveryFee)) : "—"}</dd></div>
              <div className="flex justify-between text-base border-t border-gray-200 dark:border-gray-800 pt-2"><dt className="font-bold">Total</dt><dd className="font-black" data-testid="checkout-total">{fmtMoney(total)}</dd></div>
            </dl>
            {error && <p className="mt-3 text-sm text-red-600" role="alert">{error}</p>}
            {!signedIn && <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">Sign in or create an account above to place the order.</p>}
            <button type="submit" disabled={!canSubmit} data-testid="place-order" className="mt-4 w-full h-11 rounded-xl bg-brand-500 text-white font-semibold hover:bg-brand-600 disabled:opacity-50">
              {submitting ? "Placing order…" : payment === "Online" ? `Continue to payment · ${fmtMoney(total)}` : `Place order · ${fmtMoney(total)}`}
            </button>
            <Link to="/shop/cart" className="mt-2 block text-center text-xs text-brand-600 dark:text-brand-400 hover:underline">Edit cart</Link>
          </aside>
        </form>
      )}
    </ShopLayout>
  );
}
