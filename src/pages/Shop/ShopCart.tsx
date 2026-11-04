import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import ShopLayout from "../../components/shop/ShopLayout";
import QtyStepper from "../../components/shop/QtyStepper";
import { buildLine, lineTotal, lineUnit, toRequestLines, useCart } from "../../components/shop/store";
import UpsellStrip from "../../components/upsell/UpsellStrip";
import { fmtMoney, getCatalog, getShopItem, imageUrl, quoteDelivery, type ShopQuoteDto, type ShopZoneDto } from "../../services/shopService";

const errMsg = (e: unknown) => (e as { message?: string })?.message || "Something went wrong";

/** /shop/cart — quantities + delivery estimate (POST shop/quote) by zone city. */
export default function ShopCart() {
  const { lines, subtotal, count, setQty, remove, clear, add } = useCart();
  const navigate = useNavigate();
  /** Simple items go straight in; items with options open their page so the guest can choose. */
  const addSuggested = async (itemId: number) => {
    try {
      const item = await getShopItem(itemId);
      if (!item || item.variants.some((v) => v.isActive)) { navigate(`/shop/p/${itemId}`); return; }
      add(buildLine(item, 1));
    } catch { navigate(`/shop/p/${itemId}`); }
  };
  const [zones, setZones] = useState<ShopZoneDto[]>([]);
  const [deliveryEnabled, setDeliveryEnabled] = useState(false);
  const [city, setCity] = useState(() => { try { return localStorage.getItem("shop_city") ?? ""; } catch { return ""; } });
  const [quote, setQuote] = useState<ShopQuoteDto | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  useEffect(() => {
    getCatalog().then((c) => { setZones(c.zones); setDeliveryEnabled(c.deliveryEnabled); }).catch(() => { /* estimate is optional */ });
  }, []);

  const cities = useMemo(() => Array.from(new Set(zones.flatMap((z) => z.cities))).sort(), [zones]);

  useEffect(() => {
    try { localStorage.setItem("shop_city", city); } catch { /* ignore */ }
    if (!city || lines.length === 0) { setQuote(null); return; }
    let on = true;
    setQuoting(true); setQuoteError(null);
    const t = setTimeout(() => {
      quoteDelivery({ lines: toRequestLines(lines), city })
        .then((q) => on && setQuote(q))
        .catch((e) => on && setQuoteError(errMsg(e)))
        .finally(() => on && setQuoting(false));
    }, 300);
    return () => { on = false; clearTimeout(t); };
  }, [city, lines]);

  return (
    <ShopLayout>
      <PageMeta title={`Cart (${count}) — AXIS Shop`} description="Review your cart, adjust quantities and estimate delivery before checkout." />
      <h1 className="text-2xl sm:text-3xl font-bold">Your cart</h1>
      {lines.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-gray-300 p-10 text-center dark:border-gray-700">
          <div className="text-4xl" aria-hidden>🛒</div>
          <p className="mt-2 font-semibold">Your cart is empty</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Find something you like and add it here.</p>
          <Link to="/shop" className="mt-4 inline-block h-11 px-5 rounded-xl bg-brand-500 text-white font-semibold leading-[44px]">Start shopping</Link>
        </div>
      ) : (
        <div className="mt-4 grid lg:grid-cols-[1fr_340px] gap-6 items-start">
          <ul className="divide-y divide-gray-200 rounded-2xl border border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900" data-testid="cart-lines">
            {lines.map((l) => (
              <li key={l.key} className="p-3 sm:p-4 flex gap-3">
                <Link to={`/shop/p/${l.itemId}`} className="h-20 w-20 shrink-0 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800">
                  <img src={imageUrl(l.imagePath)} alt="" className={`h-full w-full object-cover ${l.imagePath ? "" : "opacity-60 p-4 object-contain"}`} />
                </Link>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between gap-2">
                    <Link to={`/shop/p/${l.itemId}`} className="font-semibold leading-snug hover:underline">{l.name}</Link>
                    <span className="font-bold whitespace-nowrap">{fmtMoney(lineTotal(l))}</span>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {l.variantName && <span>{l.variantName} · </span>}
                    {l.addOns.length > 0 && <span>+ {l.addOns.map((a) => a.name).join(", ")} · </span>}
                    <span>{fmtMoney(lineUnit(l))} each</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <QtyStepper size="sm" value={l.quantity} onChange={(v) => setQty(l.key, v)} max={l.maxQty ?? null} label={`Quantity of ${l.name}`} />
                    <button type="button" onClick={() => remove(l.key)} className="text-xs text-red-600 hover:underline">Remove</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <aside className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 lg:sticky lg:top-20">
            <UpsellStrip channel="Shop" title="Goes well with your order" className="mb-4" itemIds={lines.map((l) => l.itemId)} onAdd={(sug) => void addSuggested(sug.itemId)} />
            <h2 className="font-bold">Summary</h2>
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between"><dt>Subtotal ({count} {count === 1 ? "item" : "items"})</dt><dd className="font-semibold" data-testid="cart-subtotal">{fmtMoney(subtotal)}</dd></div>
              {deliveryEnabled && (
                <div className="pt-2">
                  <label className="block text-xs text-gray-500 dark:text-gray-400">Estimate delivery to
                    <input list="shop-cities" value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" className="mt-1 w-full h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                    <datalist id="shop-cities">{cities.map((c) => <option key={c} value={c} />)}</datalist>
                  </label>
                  {quoting ? <div className="mt-1 text-xs text-gray-500">Calculating…</div>
                    : quoteError ? <div className="mt-1 text-xs text-red-600">{quoteError}</div>
                    : quote ? (quote.deliverable
                      ? <div className="mt-2 flex justify-between"><dt>Delivery{quote.zoneName ? ` (${quote.zoneName})` : ""}{quote.estimatedDays ? <span className="block text-xs text-gray-500">{quote.estimatedDays}</span> : null}</dt><dd className="font-semibold" data-testid="cart-delivery">{quote.deliveryFee === 0 ? "Free" : fmtMoney(quote.deliveryFee)}</dd></div>
                      : <div className="mt-1 text-xs text-amber-600">{quote.error || "We can't deliver to that city — pickup is available."}</div>)
                    : null}
                </div>
              )}
              <div className="flex justify-between border-t border-gray-200 pt-2 text-base dark:border-gray-800"><dt className="font-bold">Total</dt><dd className="font-black">{fmtMoney(quote?.deliverable ? quote.total : subtotal)}</dd></div>
            </dl>
            <Link to="/shop/checkout" className="mt-4 block h-11 rounded-xl bg-brand-500 text-center text-white font-semibold leading-[44px] hover:bg-brand-600" data-testid="go-checkout">Checkout</Link>
            <div className="mt-2 flex justify-between text-xs">
              <Link to="/shop" className="text-brand-600 dark:text-brand-400 hover:underline">Continue shopping</Link>
              <button type="button" onClick={clear} className="text-gray-500 hover:underline">Clear cart</button>
            </div>
          </aside>
        </div>
      )}
    </ShopLayout>
  );
}
