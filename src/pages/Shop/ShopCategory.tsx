import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import ShopLayout from "../../components/shop/ShopLayout";
import ProductCard from "../../components/shop/ProductCard";
import { getShopCategories, listShopItems, type ShopCategorySummaryDto, type ShopItemDto, type ShopSort } from "../../services/shopService";

const PAGE_SIZE = 24;
const errMsg = (e: unknown) => (e as { message?: string })?.message || "Something went wrong";
const sel = "h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm dark:border-gray-700 dark:bg-gray-800";

/** /shop/c/:categoryId (or "all") with ?q=&sort=&page=&stock=1 */
export default function ShopCategory() {
  const { categoryId = "all" } = useParams<{ categoryId: string }>();
  const [params, setParams] = useSearchParams();
  const catId = categoryId === "all" ? null : Number(categoryId);
  const q = params.get("q") ?? "";
  const sort = (params.get("sort") as ShopSort) || "name";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const stock = params.get("stock") === "1";

  const [cats, setCats] = useState<ShopCategorySummaryDto[]>([]);
  const [rows, setRows] = useState<ShopItemDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(q);

  useEffect(() => { getShopCategories().then(setCats).catch(() => { /* chips are optional */ }); }, []);
  useEffect(() => { setSearch(q); }, [q]);

  useEffect(() => {
    let on = true;
    setLoading(true);
    listShopItems({ categoryId: catId, search: q, page, pageSize: PAGE_SIZE, sort, inStockOnly: stock })
      .then((r) => { if (!on) return; setRows(r.data); setTotal(r.totalCount); setError(null); })
      .catch((e) => on && setError(errMsg(e)))
      .finally(() => on && setLoading(false));
    return () => { on = false; };
  }, [catId, q, page, sort, stock]);

  const cat = useMemo(() => cats.find((c) => c.id === catId) ?? null, [cats, catId]);
  const name = catId == null ? "All products" : cat?.name ?? "Category";
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const unknownCategory = catId != null && Number.isNaN(catId);

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v == null || v === "" ? next.delete(k) : next.set(k, v)));
    if (!("page" in patch)) next.delete("page");
    setParams(next, { replace: false });
  };

  return (
    <ShopLayout>
      <PageMeta title={`${name}${q ? ` · "${q}"` : ""} — AXIS Shop`} description={`Shop ${name.toLowerCase()} online: ${total} products available for pickup or delivery.`} />
      <nav className="text-xs text-gray-500 dark:text-gray-400" aria-label="Breadcrumb"><Link to="/shop" className="hover:underline">Shop</Link> / <span>{name}</span></nav>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl sm:text-3xl font-bold">{name}</h1>
        {!loading && <span className="text-sm text-gray-500 dark:text-gray-400">{total} {total === 1 ? "product" : "products"}</span>}
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0" role="tablist" aria-label="Categories">
        <Link to="/shop/c/all" className={`shrink-0 rounded-full px-3 py-1.5 text-sm border ${catId == null ? "bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white" : "border-gray-300 dark:border-gray-700"}`}>All</Link>
        {cats.map((c) => (
          <Link key={c.id} to={`/shop/c/${c.id}`} className={`shrink-0 rounded-full px-3 py-1.5 text-sm border ${c.id === catId ? "bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white" : "border-gray-300 dark:border-gray-700"}`}>{c.name} <span className="opacity-60">{c.itemCount}</span></Link>
        ))}
      </div>

      <form className="mt-4 grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2" onSubmit={(e) => { e.preventDefault(); update({ q: search.trim() }); }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search in this category…" aria-label="Search" className={`${sel} w-full`} />
        <select value={sort} onChange={(e) => update({ sort: e.target.value })} aria-label="Sort" className={sel}>
          <option value="name">Name A–Z</option><option value="priceAsc">Price: low to high</option><option value="priceDesc">Price: high to low</option><option value="newest">Newest</option>
        </select>
        <label className="flex items-center gap-2 text-sm h-10 px-1"><input type="checkbox" checked={stock} onChange={(e) => update({ stock: e.target.checked ? "1" : null })} /> In stock</label>
      </form>

      {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400" role="alert">{error}</div>}
      {loading ? (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-[3/4] rounded-2xl bg-gray-200 dark:bg-gray-800 animate-pulse" />)}</div>
      ) : unknownCategory || rows.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          {q ? <>Nothing matches “{q}”. <button type="button" className="text-brand-600 dark:text-brand-400 underline" onClick={() => update({ q: null })}>Clear search</button></> : "No products here yet."}
          <div className="mt-2"><Link to="/shop" className="text-brand-600 dark:text-brand-400 hover:underline">Back to the shop</Link></div>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">{rows.map((i) => <ProductCard key={i.id} item={i} />)}</div>
      )}

      {pages > 1 && (
        <nav className="mt-6 flex items-center justify-center gap-2 text-sm" aria-label="Pagination">
          <button type="button" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })} className="h-9 px-3 rounded-lg border border-gray-300 disabled:opacity-40 dark:border-gray-700">Previous</button>
          <span className="text-gray-500 dark:text-gray-400">Page {page} of {pages}</span>
          <button type="button" disabled={page >= pages} onClick={() => update({ page: String(page + 1) })} className="h-9 px-3 rounded-lg border border-gray-300 disabled:opacity-40 dark:border-gray-700">Next</button>
        </nav>
      )}
    </ShopLayout>
  );
}
