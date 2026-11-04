import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import ShopLayout from "../../components/shop/ShopLayout";
import QtyStepper from "../../components/shop/QtyStepper";
import ProductCard from "../../components/shop/ProductCard";
import { buildLine, itemInStock, useCart } from "../../components/shop/store";
import Model3DViewer from "../../components/menu3d/Model3DViewer";
import { useItemModels } from "../../components/menu3d/useItemModels";
import { fmtMoney, getShopItem, imageUrl, listShopItems, type ItemAddOnDto, type ItemVariantDto, type ShopItemDto } from "../../services/shopService";

const errMsg = (e: unknown) => (e as { message?: string })?.message || "Something went wrong";

/** /shop/p/:itemId — gallery, variants, add-ons, add to cart. */
export default function ShopProduct() {
  const { itemId = "" } = useParams<{ itemId: string }>();
  const id = Number(itemId);
  const nav = useNavigate();
  const { add } = useCart();
  const models = useItemModels();
  const [view3d, setView3d] = useState(false);
  const [item, setItem] = useState<ShopItemDto | null>(null);
  const [related, setRelated] = useState<ShopItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [variant, setVariant] = useState<ItemVariantDto | null>(null);
  const [addOns, setAddOns] = useState<ItemAddOnDto[]>([]);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    let on = true;
    setLoading(true); setItem(null); setVariant(null); setAddOns([]); setQty(1); setAdded(false);
    if (!Number.isFinite(id) || id <= 0) { setLoading(false); return; }
    getShopItem(id)
      .then((i) => {
        if (!on) return;
        setItem(i); setError(null);
        if (i) {
          const firstInStock = i.variants.find((v) => v.quantity > 0) ?? i.variants[0] ?? null;
          setVariant(firstInStock);
          listShopItems({ categoryId: i.categoryId, pageSize: 5 }).then((r) => on && setRelated(r.data.filter((x) => x.id !== i.id).slice(0, 4))).catch(() => { /* optional */ });
        }
      })
      .catch((e) => on && setError(errMsg(e)))
      .finally(() => on && setLoading(false));
    return () => { on = false; };
  }, [id]);

  const max = useMemo(() => (item ? (variant ? variant.quantity : item.trackStock ? item.quantity : null) : null), [item, variant]);
  const soldOut = !!item && (variant ? variant.quantity <= 0 : !itemInStock(item));
  const unit = item ? item.price + (variant?.priceDelta ?? 0) + addOns.reduce((s, a) => s + a.price, 0) : 0;

  useEffect(() => { if (max != null && max > 0 && qty > max) setQty(max); }, [max, qty]);

  const toggleAddOn = (a: ItemAddOnDto) => setAddOns((cur) => (cur.some((x) => x.id === a.id) ? cur.filter((x) => x.id !== a.id) : [...cur, a]));

  const addNow = () => {
    if (!item || soldOut) return;
    if (item.variants.length > 0 && !variant) return;
    add(buildLine(item, qty, variant, addOns));
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  };

  return (
    <ShopLayout>
      <PageMeta title={item ? `${item.name} — ${fmtMoney(item.price)} — AXIS Shop` : "Product — AXIS Shop"} description={item ? `Buy ${item.name} (${item.categoryName}) online for ${fmtMoney(item.price)}; pickup at the lounge or delivery.` : "Product details."} />
      {loading ? (
        <div className="grid md:grid-cols-2 gap-6"><div className="aspect-square rounded-3xl bg-gray-200 dark:bg-gray-800 animate-pulse" /><div className="space-y-3"><div className="h-8 w-2/3 rounded bg-gray-200 dark:bg-gray-800 animate-pulse" /><div className="h-6 w-1/3 rounded bg-gray-200 dark:bg-gray-800 animate-pulse" /></div></div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400" role="alert">{error}</div>
      ) : !item ? (
        <div className="rounded-2xl border border-dashed border-gray-300 p-10 text-center dark:border-gray-700">
          <h1 className="text-xl font-bold">This product isn't sold online</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">It may have been removed from the shop or never listed.</p>
          <Link to="/shop" className="mt-4 inline-block h-11 px-5 rounded-xl bg-brand-500 text-white font-semibold leading-[44px]">Back to the shop</Link>
        </div>
      ) : (
        <>
          <nav className="text-xs text-gray-500 dark:text-gray-400" aria-label="Breadcrumb"><Link to="/shop" className="hover:underline">Shop</Link> / <Link to={`/shop/c/${item.categoryId}`} className="hover:underline">{item.categoryName}</Link> / <span>{item.name}</span></nav>
          <div className="mt-3 grid md:grid-cols-2 gap-6 lg:gap-10">
            <div>
              <div className="relative rounded-3xl overflow-hidden border border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-gray-800 aspect-square">
                {view3d && models.get(item.id) ? (
                  <Model3DViewer model={models.get(item.id)!} alt={`3D model of ${item.name}`} className="h-full w-full" />
                ) : (
                  <img src={imageUrl(item.imagePath)} alt={item.name} className={`h-full w-full object-cover ${item.imagePath ? "" : "opacity-60 p-12 object-contain"}`} />
                )}
              </div>
              {models.get(item.id) && (
                <div className="mt-2 flex justify-center gap-2" role="group" aria-label="Picture or 3D">
                  <button type="button" onClick={() => setView3d(false)} aria-pressed={!view3d} className={`rounded-full px-4 py-1.5 text-sm font-medium ${!view3d ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900" : "border border-gray-300 text-gray-700 dark:border-gray-700 dark:text-gray-300"}`}>Photo</button>
                  <button type="button" onClick={() => setView3d(true)} aria-pressed={view3d} className={`rounded-full px-4 py-1.5 text-sm font-medium ${view3d ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900" : "border border-gray-300 text-gray-700 dark:border-gray-700 dark:text-gray-300"}`}>View in 3D</button>
                </div>
              )}
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">{item.name}</h1>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="text-2xl font-black" data-testid="unit-price">{fmtMoney(unit)}</span>
                {(variant?.priceDelta || addOns.length > 0) ? <span className="text-sm text-gray-500 dark:text-gray-400">base {fmtMoney(item.price)}</span> : null}
                {soldOut ? <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">Sold out</span>
                  : item.trackStock && max != null && max <= 5 ? <span className="text-xs text-amber-600">Only {max} left</span> : null}
              </div>

              {item.variants.length > 0 && (
                <fieldset className="mt-5">
                  <legend className="text-sm font-semibold">Choose an option</legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {item.variants.map((v) => {
                      const on = variant?.id === v.id;
                      return (
                        <button key={v.id} type="button" onClick={() => setVariant(v)} disabled={v.quantity <= 0} aria-pressed={on}
                          className={`rounded-xl border px-3 py-2 text-sm flex items-center gap-2 disabled:opacity-40 ${on ? "border-brand-500 bg-brand-50 dark:bg-brand-500/15" : "border-gray-300 dark:border-gray-700"}`}>
                          {v.color && <span className="h-3.5 w-3.5 rounded-full border border-black/10" style={{ background: v.color }} aria-hidden />}
                          {v.name}{v.priceDelta ? <span className="text-xs text-gray-500">{v.priceDelta > 0 ? "+" : ""}{fmtMoney(v.priceDelta)}</span> : null}
                          {v.quantity <= 0 && <span className="text-xs">(sold out)</span>}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              )}

              {item.addOns.length > 0 && (
                <fieldset className="mt-5">
                  <legend className="text-sm font-semibold">Extras</legend>
                  <div className="mt-2 space-y-2">
                    {item.addOns.map((a) => (
                      <label key={a.id} className="flex items-center justify-between rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-gray-800 cursor-pointer">
                        <span className="flex items-center gap-2"><input type="checkbox" checked={addOns.some((x) => x.id === a.id)} onChange={() => toggleAddOn(a)} /> {a.name}</span>
                        <span className="text-gray-500 dark:text-gray-400">+{fmtMoney(a.price)}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <QtyStepper value={qty} onChange={setQty} max={max != null && max > 0 ? max : null} />
                <button type="button" onClick={addNow} disabled={soldOut} data-testid="add-to-cart"
                  className="h-11 flex-1 min-w-[160px] rounded-xl bg-brand-500 text-white font-semibold hover:bg-brand-600 disabled:opacity-50">
                  {soldOut ? "Sold out" : added ? "Added ✓" : `Add to cart · ${fmtMoney(unit * qty)}`}
                </button>
              </div>
              {added && (
                <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300" role="status">
                  Added to your cart. <button type="button" className="underline font-semibold" onClick={() => nav("/shop/cart")}>View cart</button>
                </div>
              )}
              <ul className="mt-6 text-sm text-gray-600 dark:text-gray-300 space-y-1">
                <li>Pickup at the lounge — pay at pickup or online.</li>
                <li>Prices are confirmed by the shop when you check out.</li>
              </ul>
            </div>
          </div>

          {related.length > 0 && (
            <section className="mt-10">
              <h2 className="text-lg font-bold">More from {item.categoryName}</h2>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">{related.map((r) => <ProductCard key={r.id} item={r} />)}</div>
            </section>
          )}
        </>
      )}
    </ShopLayout>
  );
}
