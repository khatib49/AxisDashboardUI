// /checkout — pickup details + how to pay, then place the order.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import { CartLine, cartLineTotal, loadCart, clearCart, getStoredCustomer, placeOrder } from "../../services/shopService";
import { ShopPage, money, inputCls, primaryBtn } from "./ShopUi";

export default function CheckoutPage() {
  const navigate = useNavigate();
  const [lines] = useState<CartLine[]>(() => loadCart());
  const [mode, setMode] = useState<"PayAtPickup" | "Online">("PayAtPickup");
  const [pickup, setPickup] = useState("ASAP");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const customer = getStoredCustomer();

  useEffect(() => {
    if (!customer) navigate("/account?next=/checkout", { replace: true });
    else if (lines.length === 0) navigate("/cart", { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = lines.reduce((s, l) => s + cartLineTotal(l), 0);

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const r = await placeOrder(lines, mode, notes, pickup);
      if (!r.success || !r.order) { setError(r.error ?? "Could not place the order."); return; }
      clearCart();
      if (r.payUrl) { window.location.href = r.payUrl; return; }
      navigate(`/orders/${r.order.code}?placed=1`, { replace: true });
    } catch {
      setError("Could not reach AXIS. Please try again.");
    } finally { setBusy(false); }
  };

  return (
    <ShopPage title="Checkout" subtitle={`Pickup at AXIS · ${customer?.firstName ?? ""} ${customer?.phone ?? ""}`} back={{ to: "/cart", label: "Back to cart" }}>
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
        <div className="flex items-center justify-between px-4 py-3 text-lg font-bold"><span>Total</span><span>{money(total)}</span></div>
      </div>

      <div className="mt-5">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#b9d3ee] mb-2">When will you pick it up?</div>
        <div className="flex flex-wrap gap-2">
          {["ASAP", "in 15 min", "in 30 min", "in 1 hour"].map((p) => (
            <button key={p} type="button" onClick={() => setPickup(p)}
              className={`h-10 px-4 rounded-xl border text-sm ${pickup === p ? "border-[#87b2dd] bg-[#87b2dd]/20" : "border-white/15 bg-white/5 text-gray-300"}`}>{p}</button>
          ))}
        </div>
        <input className={`${inputCls} mt-2`} placeholder="or a time, e.g. 19:30" value={pickup} onChange={(e) => setPickup(e.target.value)} />
      </div>

      <div className="mt-5">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#b9d3ee] mb-2">How do you want to pay?</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button type="button" onClick={() => setMode("PayAtPickup")}
            className={`rounded-2xl border p-4 text-left ${mode === "PayAtPickup" ? "border-[#87b2dd] bg-[#87b2dd]/15" : "border-white/15 bg-white/5"}`}>
            <div className="font-bold">💵 Pay at pickup</div>
            <div className="text-xs text-gray-400 mt-1">Cash, card or your AXIS wallet at the counter.</div>
          </button>
          <button type="button" onClick={() => setMode("Online")}
            className={`rounded-2xl border p-4 text-left ${mode === "Online" ? "border-[#87b2dd] bg-[#87b2dd]/15" : "border-white/15 bg-white/5"}`}>
            <div className="font-bold">💳 Pay now by card</div>
            <div className="text-xs text-gray-400 mt-1">Secure card payment — your order goes straight to the kitchen.</div>
          </button>
        </div>
      </div>

      <div className="mt-5">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#b9d3ee] mb-2">Notes for the kitchen (optional)</div>
        <textarea className={`${inputCls} h-24 py-3 resize-none`} placeholder="No onions, extra ice…" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
      </div>

      {error && <div className="mt-4 rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-200">{error}</div>}

      <button type="button" disabled={busy || lines.length === 0} onClick={submit} className={`${primaryBtn} mt-6`}>
        {busy ? "Placing order…" : mode === "Online" ? `Pay ${money(total)} & place order` : `Place order · ${money(total)}`}
      </button>
      <p className="mt-2 text-center text-[11px] text-gray-500">By ordering you agree to pick up at AXIS Game Lounge, Beirut.</p>
    </ShopPage>
  );
}
