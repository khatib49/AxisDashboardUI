import { useEffect, useState } from "react";
import { Link } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import ShopLayout from "../../components/shop/ShopLayout";
import ProductCard from "../../components/shop/ProductCard";
import { fmtMoney, getCatalog, getFeaturedItems, getShopCategories, imageUrl, type ShopCategorySummaryDto, type ShopItemDto } from "../../services/shopService";

const errMsg = (e: unknown) => (e as { message?: string })?.message || "Something went wrong";

/** /shop — hero, categories, featured items. */
export default function ShopHome() {
  const [title, setTitle] = useState("AXIS Shop");
  const [enabled, setEnabled] = useState(true);
  const [delivery, setDelivery] = useState(false);
  const [cats, setCats] = useState<ShopCategorySummaryDto[]>([]);
  const [featured, setFeatured] = useState<ShopItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let on = true;
    setLoading(true);
    Promise.all([getCatalog(), getShopCategories(), getFeaturedItems(8)])
      .then(([c, cs, f]) => { if (!on) return; setTitle(c.title || "AXIS Shop"); setEnabled(c.shopEnabled); setDelivery(c.deliveryEnabled); setCats(cs); setFeatured(f); setError(null); })
      .catch((e) => on && setError(errMsg(e)))
      .finally(() => on && setLoading(false));
    return () => { on = false; };
  }, []);

  const first = cats[0];

  return (
    <ShopLayout title={title}>
      <PageMeta title={`${title} — order online for pickup or delivery`} description={`Browse ${title}: food, drinks and retail available for online ordering, pickup at the lounge or delivery.`} />

      <section className="rounded-3xl bg-gradient-to-br from-brand-500 to-brand-700 text-white p-6 sm:p-10 overflow-hidden relative">
        <div className="relative z-10 max-w-xl">
          <p className="text-xs sm:text-sm uppercase tracking-widest text-white/70">Welcome to</p>
          <h1 className="mt-1 text-3xl sm:text-5xl font-black tracking-tight">{title}</h1>
          <p className="mt-3 text-sm sm:text-base text-white/85">Order your favourites online — pick them up at the lounge{delivery ? " or get them delivered to your door" : ""}. Same prices as the counter.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link to={first ? `/shop/c/${first.id}` : "/shop/c/all"} className="h-11 px-5 rounded-xl bg-white text-brand-700 font-semibold flex items-center hover:bg-brand-50">Start shopping</Link>
            <Link to="/shop/orders" className="h-11 px-5 rounded-xl border border-white/40 font-semibold flex items-center hover:bg-white/10">Track an order</Link>
          </div>
        </div>
        <div className="absolute -right-10 -bottom-16 h-56 w-56 rounded-full bg-white/10" aria-hidden />
      </section>

      {!enabled && <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300" role="status">The online shop is closed right now — you can still browse, ordering reopens soon.</div>}
      {error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400" role="alert">{error}</div>}

      <section className="mt-8">
        <div className="flex items-end justify-between">
          <h2 className="text-lg sm:text-xl font-bold">Categories</h2>
          <Link to="/shop/c/all" className="text-sm text-brand-600 dark:text-brand-400 hover:underline">All products</Link>
        </div>
        {loading ? (
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">{[0, 1, 2, 3].map((i) => <div key={i} className="h-28 rounded-2xl bg-gray-200 dark:bg-gray-800 animate-pulse" />)}</div>
        ) : cats.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">We're stocking the shelves — nothing is listed for online sale yet. Check back soon.</p>
        ) : (
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {cats.map((c) => (
              <Link key={c.id} to={`/shop/c/${c.id}`} className="group relative h-28 sm:h-36 rounded-2xl overflow-hidden border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900" data-testid="category-card">
                {c.coverImagePath ? <img src={imageUrl(c.coverImagePath)} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70 group-hover:scale-105 transition-transform" />
                  : <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900" />}
                <div className="absolute inset-0 p-3 flex flex-col justify-end bg-gradient-to-t from-black/60 to-transparent text-white">
                  <div className="font-bold leading-tight">{c.name}</div>
                  <div className="text-xs text-white/80">{c.itemCount} {c.itemCount === 1 ? "item" : "items"}{c.minPrice != null ? ` · from ${fmtMoney(c.minPrice)}` : ""}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg sm:text-xl font-bold">Featured</h2>
        {loading ? (
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">{[0, 1, 2, 3].map((i) => <div key={i} className="aspect-[3/4] rounded-2xl bg-gray-200 dark:bg-gray-800 animate-pulse" />)}</div>
        ) : featured.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">No featured products yet.</p>
        ) : (
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">{featured.map((i) => <ProductCard key={i.id} item={i} />)}</div>
        )}
      </section>
    </ShopLayout>
  );
}
