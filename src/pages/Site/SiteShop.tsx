// /shop — online retail shop (trading cards, sleeves, accessories) with
// delivery anywhere in Lebanon or pickup at AXIS. Live catalogue from the API.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import { getCatalog } from "../../services/shopService";
import type { ShopCatalog, ShopCatalogCategory, ShopCatalogItem, ShopZone } from "../../services/shopService";
import { IMAGES } from "./siteContent";
import { EYEBROW, ScrollCue, SiteLoader } from "./SiteUi";
import { hideImageOnError, onImageError, resolveImageUrl } from "./siteHelpers";
import ShopItemSheet from "./ShopItemSheet";

const ACTIVE = "bg-gradient-to-r from-[#6a99cb] to-[#87b2dd] text-[#071018] shadow-2xl shadow-[#87b2dd]/45";
const INACTIVE = "bg-white/10 text-white backdrop-blur-sm hover:bg-white/20";
const GRID = "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4";

const money = (n: number) => `$${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)}`;

/** Sold out when there is no base stock and no in-stock variant. */
function isSoldOut(item: ShopCatalogItem): boolean {
  const variants = (item.variants ?? []).filter((v) => v.isActive !== false);
  if (variants.length > 0) return !variants.some((v) => v.quantity > 0);
  return item.quantity <= 0;
}

/** "Delivery: Beirut $3 · Mount Lebanon $4 · free above $100" */
function zoneStrip(zones: ShopZone[]): string | null {
  if (zones.length === 0) return null;
  const parts = zones.map((z) => `${z.name} ${z.fee <= 0 ? "free" : money(z.fee)}`);
  const freeAbove = zones.map((z) => z.freeAbove ?? 0).filter((v) => v > 0);
  if (freeAbove.length > 0) parts.push(`free above ${money(Math.min(...freeAbove))}`);
  return `Delivery: ${parts.join(" · ")}`;
}

export default function SiteShop() {
  const [catalog, setCatalog] = useState<ShopCatalog | null>(null);
  const [failed, setFailed] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [openItem, setOpenItem] = useState<{ item: ShopCatalogItem; category: ShopCatalogCategory } | null>(null);

  useEffect(() => {
    let mounted = true;
    getCatalog()
      .then((c) => mounted && setCatalog(c))
      .catch(() => mounted && setFailed(true));
    return () => { mounted = false; };
  }, []);

  const categories = useMemo(
    () => (catalog?.categories ?? []).filter((c) => c.items.length > 0),
    [catalog],
  );

  const q = query.trim().toLowerCase();
  const sections = useMemo(
    () =>
      categories
        .filter((c) => selectedCategory === null || c.id === selectedCategory)
        .map((c) => ({ ...c, items: q ? c.items.filter((it) => it.name.toLowerCase().includes(q)) : c.items }))
        .filter((c) => c.items.length > 0),
    [categories, selectedCategory, q],
  );
  const visibleCount = sections.reduce((s, c) => s + c.items.length, 0);

  const shopOpen = !!catalog?.shopEnabled;
  const strip = catalog ? zoneStrip(catalog.zones ?? []) : null;

  const renderCard = (item: ShopCatalogItem, category: ShopCatalogCategory) => {
    const soldOut = isSoldOut(item);
    const optionCount = (item.variants ?? []).filter((v) => v.isActive !== false).length;
    return (
      <button
        type="button"
        key={item.id}
        onClick={() => setOpenItem({ item, category })}
        className="group relative text-left bg-white/10 backdrop-blur-md rounded-2xl overflow-hidden border border-white/15 hover:bg-white/15 hover:border-[#87b2dd]/50 active:scale-[0.98] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#87b2dd]"
      >
        <div className="relative aspect-[4/3] overflow-hidden">
          <img
            src={resolveImageUrl(item.imagePath)}
            alt={item.name}
            loading="lazy"
            className={`w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500 ${soldOut ? "grayscale opacity-70" : ""}`}
            onError={onImageError}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          {soldOut && (
            <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/90 text-white">
              Sold out
            </span>
          )}
          {optionCount > 0 && (
            <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-black/55 text-[#d8e8f8] backdrop-blur-sm">
              {optionCount} option{optionCount > 1 ? "s" : ""}
            </span>
          )}
          <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-lg text-sm font-bold bg-white/95 text-[#071018] shadow">
            ${item.price.toFixed(2)}
          </span>
        </div>
        <div className="px-3 py-2.5 flex items-center justify-between gap-2">
          <h3 className="text-sm sm:text-base font-bold text-white leading-tight line-clamp-2">{item.name}</h3>
          <span className="shrink-0 text-[#b9d3ee] text-lg leading-none">›</span>
        </div>
      </button>
    );
  };

  return (
    <div
      style={{ fontFamily: "'Cygre', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial" }}
      className="min-h-screen bg-gradient-to-br from-[#050507] via-[#0e1a2a] to-[#050507]"
    >
      <PageMeta title="Shop — AXIS" description="Trading cards, sleeves and accessories from AXIS Game Lounge — delivered anywhere in Lebanon or pick up in Beirut." />

      {/* Hero */}
      <div className="relative overflow-hidden">
        <img
          src={IMAGES.home}
          alt="AXIS shop"
          className="absolute inset-0 h-full w-full object-cover opacity-30"
          onError={hideImageOnError}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-gray-900" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
          <div className="text-center">
            <p className={`${EYEBROW} mb-4`}>Online shop</p>
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold text-white mb-6 tracking-tight">
              <span className="bg-gradient-to-r from-[#b9d3ee] to-[#87b2dd] bg-clip-text text-transparent">
                {catalog?.title || "AXIS Shop"}
              </span>
            </h1>
            <p className="mx-auto max-w-3xl text-lg text-gray-200 mb-6 leading-relaxed">
              Trading cards, sleeves, accessories — delivered anywhere in Lebanon or pick up at AXIS.
            </p>
            {strip && (
              <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs sm:text-sm text-[#d8e8f8] mb-8">
                <span>🚚</span>
                <span>{strip}</span>
              </p>
            )}
            <div className="w-32 h-1.5 mx-auto rounded-full bg-gradient-to-r from-[#6a99cb] via-[#87b2dd] to-[#b9d3ee]" />
          </div>
        </div>
      </div>

      {catalog && !shopOpen && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 sm:-mt-10 relative z-10">
          <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 backdrop-blur-md px-5 py-4 text-amber-100 text-sm sm:text-base">
            ⏸ Online ordering is paused right now — browse, and order at the counter.
          </div>
        </div>
      )}

      <ScrollCue label="Browse" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        {!catalog && !failed && <SiteLoader label="Loading the shop" />}

        {failed && (
          <div className="text-center py-20">
            <p className="text-white text-xl font-medium">The shop is taking a break.</p>
            <p className="text-gray-400 mt-2">We couldn't load the catalogue — please try again in a moment.</p>
          </div>
        )}

        {catalog && categories.length === 0 && (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🃏</div>
            <p className="text-white text-xl font-medium">Nothing on the shelves yet</p>
            <p className="text-gray-400 mt-2">New cards and accessories are on the way — check back soon, or <Link to="/contact" className="text-[#b9d3ee] hover:underline">ask us</Link>.</p>
          </div>
        )}

        {catalog && categories.length > 0 && (
          <>
            {/* Search */}
            <div className="mb-4 sm:mb-6 max-w-xl mx-auto">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">⌕</span>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search cards, sleeves, accessories…"
                  className="w-full h-12 rounded-2xl border border-white/15 bg-white/5 pl-11 pr-4 text-white placeholder:text-gray-500 focus:outline-none focus:border-[#87b2dd]"
                />
              </div>
            </div>

            {/* Category pills — sticky so you can jump categories without scrolling back up */}
            <div className="sticky top-[72px] sm:top-20 z-20 -mx-4 px-4 sm:mx-0 sm:px-0 py-2 mb-6 sm:mb-10 bg-[#0a1220]/85 backdrop-blur-md overflow-x-auto no-scrollbar">
              <div className="flex sm:justify-center sm:flex-wrap gap-2 sm:gap-3 w-max sm:w-auto mx-auto">
                <button
                  type="button"
                  onClick={() => setSelectedCategory(null)}
                  className={`shrink-0 px-4 sm:px-8 py-2 sm:py-3 rounded-full font-semibold text-sm sm:text-base transition-all duration-300 sm:hover:scale-105 ${selectedCategory === null ? ACTIVE : INACTIVE}`}
                >
                  All
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`shrink-0 px-4 sm:px-8 py-2 sm:py-3 rounded-full font-semibold text-sm sm:text-base transition-all duration-300 sm:hover:scale-105 ${selectedCategory === cat.id ? ACTIVE : INACTIVE}`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
            <style>{`.no-scrollbar::-webkit-scrollbar{display:none}.no-scrollbar{scrollbar-width:none}`}</style>

            {visibleCount === 0 ? (
              <div className="text-center py-20">
                <p className="text-white text-xl font-medium">No matches for “{query.trim()}”</p>
                <p className="text-gray-400 mt-2">Try a different name, or clear the search.</p>
                <button type="button" onClick={() => setQuery("")} className="mt-5 h-10 px-5 rounded-xl border border-white/15 text-sm text-gray-200 hover:bg-white/5">Clear search</button>
              </div>
            ) : (
              <div className="space-y-8 sm:space-y-10">
                {sections.map((sec) => (
                  <section key={sec.id}>
                    {(selectedCategory === null || q) && (
                      <h2 className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4">{sec.name}</h2>
                    )}
                    <div className={GRID}>{sec.items.map((it) => renderCard(it, sec))}</div>
                  </section>
                ))}
              </div>
            )}
          </>
        )}

        {openItem && (
          <ShopItemSheet
            mode={shopOpen ? "order" : "view"}
            item={openItem.item}
            categoryName={openItem.category.name}
            onClose={() => setOpenItem(null)}
          />
        )}
      </div>
    </div>
  );
}
