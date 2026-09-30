// /cart — what's in the basket, edit quantities, go to checkout.
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import { cartLineTotal, loadCart, setCartQty, clearCart, getStoredCustomer } from "../../services/shopService";
import type { CartLine } from "../../services/shopService";
import { ShopPage, money, primaryBtn, ghostBtn } from "./ShopUi";

export default function CartPage() {
  const [lines, setLines] = useState<CartLine[]>(() => loadCart());
  const navigate = useNavigate();
  useEffect(() => {
    const refresh = () => setLines(loadCart());
    window.addEventListener("axis-cart-changed", refresh);
    return () => window.removeEventListener("axis-cart-changed", refresh);
  }, []);

  const total = lines.reduce((s, l) => s + cartLineTotal(l), 0);
  const signedIn = !!getStoredCustomer();

  return (
    <ShopPage title="Your cart" subtitle={lines.length ? `${lines.reduce((s, l) => s + l.quantity, 0)} item(s) · delivery or pickup at AXIS` : undefined} back={{ to: "/shop", label: "Continue shopping" }}>
      <PageMeta title="Cart — AXIS" description="Your AXIS order" />
      {lines.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center">
          <div className="text-4xl">🛒</div>
          <p className="mt-3 text-gray-300">Your cart is empty.</p>
          <Link to="/shop" className="inline-block mt-5 h-11 leading-[44px] px-6 rounded-2xl font-bold text-[#071018] bg-gradient-to-r from-[#6a99cb] to-[#87b2dd]">Browse the shop</Link>
        </div>
      ) : (
        <>
          <div className="rounded-3xl border border-white/10 bg-white/5 divide-y divide-white/10 overflow-hidden">
            {lines.map((l) => (
              <div key={l.key} className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{l.name}{l.variantName ? <span className="text-[#b9d3ee]"> · {l.variantName}</span> : null}</div>
                  <div className="text-xs text-gray-400">
                    {money(l.unitPrice + l.variantPriceDelta)} each
                    {l.addOns.length > 0 && <> · {l.addOns.map(a => `${a.quantity}× ${a.name}`).join(", ")}</>}
                  </div>
                </div>
                <div className="flex items-center rounded-lg border border-white/15 overflow-hidden">
                  <button type="button" onClick={() => setCartQty(l.key, l.quantity - 1)} className="h-9 w-9 text-gray-300">−</button>
                  <div className="h-9 w-9 flex items-center justify-center text-sm font-bold">{l.quantity}</div>
                  <button type="button" onClick={() => setCartQty(l.key, l.quantity + 1)} className="h-9 w-9 bg-[#87b2dd] text-[#071018] font-bold">+</button>
                </div>
                <div className="w-20 text-right font-bold">{money(cartLineTotal(l))}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between text-lg">
              <span className="text-gray-300">Total</span>
              <span className="text-2xl font-bold">{money(total)}</span>
            </div>
            <p className="mt-1 text-[11px] text-gray-500">Delivery or pickup, pay by card, cash on delivery or at the counter — you choose at checkout.</p>
            <button type="button" onClick={() => navigate(signedIn ? "/checkout" : "/account?next=/checkout")} className={`${primaryBtn} mt-4`}>
              {signedIn ? "Checkout →" : "Sign in to checkout →"}
            </button>
            <div className="mt-3 flex justify-between">
              <Link to="/shop" className={ghostBtn + " leading-10"}>+ Continue shopping</Link>
              <button type="button" onClick={() => { if (confirm("Empty the cart?")) clearCart(); }} className="text-xs text-gray-500 hover:text-red-300">Empty cart</button>
            </div>
          </div>
        </>
      )}
    </ShopPage>
  );
}
