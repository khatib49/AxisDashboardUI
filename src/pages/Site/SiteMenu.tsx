// Public café menu — live items from the inventory API, grouped by category.
import { useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import { getItems, ItemDto } from "../../services/itemService";
import { getCategoriesByType, CategoryDto } from "../../services/categoryService";
import { IMAGES } from "./siteContent";
import { useSiteContent } from "./SiteContentContext";
import { ScrollCue } from "./SiteUi";
import { hideImageOnError, resolveSiteImage } from "./siteHelpers";

type ItemType = "Food" | "Retail" | "Drinks" | "Tobacco";

const TYPE_TABS: Array<{ type: ItemType; label: string }> = [
  { type: "Food", label: "🍔 Food" },
  { type: "Drinks", label: "🥤 Drinks" },
  { type: "Tobacco", label: "💨 Tobacco" },
  { type: "Retail", label: "🛒 Retail" },
];

const ACTIVE = "bg-gradient-to-r from-[#6a99cb] to-[#87b2dd] text-[#071018] shadow-2xl shadow-[#87b2dd]/45";
const INACTIVE = "bg-white/10 text-white backdrop-blur-sm hover:bg-white/20";
const GRID = "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4";

function resolveImageUrl(path?: string | null): string {
  if (!path) return IMAGES.placeholder;
  try {
    return new URL(path).toString();
  } catch {
    const base = (import.meta.env.VITE_API_IMAGE_BASE_URL as string) || "";
    return base ? `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}` : path;
  }
}

function matchesType(cat: CategoryDto | undefined, type: ItemType): boolean {
  if (!cat) return false;
  if (type === "Drinks") return cat.itemType === "Bar" || cat.itemType === "Drinks";
  return cat.itemType === type;
}

export default function SiteMenu() {
  const { menu: copy } = useSiteContent();
  const [items, setItems] = useState<ItemDto[]>([]);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedType, setSelectedType] = useState<ItemType>("Food");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getCategoriesByType("item", 1, 100)
      .then((res) => mounted && setCategories(res.data || []))
      .catch(() => {
        /* the menu still renders, just uncategorised */
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getItems(1, 1000, selectedCategory)
      .then((res) => {
        if (!mounted) return;
        setItems((res.data || []).filter((it) => it.statusId === 1));
      })
      .catch(() => {
        /* handled by the empty state */
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [selectedCategory]);

  const typeCategories = categories.filter((c) => matchesType(c, selectedType));
  const visibleItems = items.filter((it) => {
    const cat = categories.find((c) => c.id === it.categoryId);
    return matchesType(cat, selectedType) && (selectedCategory === null || it.categoryId === selectedCategory);
  });

  const sections = typeCategories
    .map((cat) => ({ id: cat.id, name: cat.name, items: visibleItems.filter((it) => it.categoryId === cat.id) }))
    .filter((s) => s.items.length > 0);
  const uncategorized = visibleItems.filter(
    (it) => it.categoryId === null || !typeCategories.some((c) => c.id === it.categoryId)
  );

  const pickType = (type: ItemType) => {
    setSelectedType(type);
    setSelectedCategory(null);
  };

  const renderCard = (item: ItemDto) => {
    const inStock = item.quantity > 0;
    return (
      <div
        key={item.id}
        className="group relative bg-white/10 backdrop-blur-md rounded-xl overflow-hidden hover:bg-white/20 transition-all duration-300 transform hover:scale-105 hover:shadow-xl border border-white/20"
      >
        <div className="absolute top-2 right-2 z-10">
          <span
            className={`px-2 py-1 rounded-full text-xs font-bold backdrop-blur-sm ${
              inStock ? "bg-green-500/90 text-white" : "bg-red-500/90 text-white"
            }`}
          >
            {inStock ? "✓" : "✕"}
          </span>
        </div>
        <div className="relative h-32 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10" />
          <img
            src={resolveImageUrl(item.imagePath)}
            alt={item.name}
            className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500"
            onError={(e) => {
              e.currentTarget.src = IMAGES.placeholder;
            }}
          />
        </div>
        <div className="p-3">
          <div className="mb-2">
            <h3 className="text-base font-bold text-white mb-1 leading-tight line-clamp-2">{item.name}</h3>
            <span className="inline-block px-2 py-0.5 bg-[#87b2dd]/25 text-[#d8e8f8] text-xs font-semibold rounded-full mb-2 capitalize">
              {item.type}
            </span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-white/20">
            <div className="flex items-baseline">
              <span className="text-xl font-bold text-white">${item.price.toFixed(2)}</span>
            </div>
            <div className="w-7 h-7 rounded-full bg-gradient-to-r from-[#6a99cb] to-[#87b2dd] flex items-center justify-center group-hover:rotate-12 transition-transform duration-300">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const nothingToShow = !loading && visibleItems.length === 0;

  return (
    <div
      style={{ fontFamily: "'Cygre', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial" }}
      className="min-h-screen bg-gradient-to-br from-[#050507] via-[#0e1a2a] to-[#050507]"
    >
      <PageMeta title="Café Menu — AXIS" description={copy.description} />

      {/* Hero */}
      <div className="relative overflow-hidden">
        <img
          src={resolveSiteImage(copy.image, IMAGES.home)}
          alt="Great food & drink at AXIS"
          className="absolute inset-0 h-full w-full object-cover opacity-30"
          onError={hideImageOnError}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-gray-900" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#b9d3ee] mb-4">{copy.eyebrow}</p>
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold text-white mb-6 tracking-tight">
              {copy.title}{" "}
              <span className="bg-gradient-to-r from-[#b9d3ee] to-[#87b2dd] bg-clip-text text-transparent">
                {copy.highlight}
              </span>
            </h1>
            <p className="mx-auto max-w-3xl text-lg text-gray-200 mb-6 leading-relaxed">{copy.description}</p>
            {copy.note && <p className="text-base text-gray-300 mb-8">{copy.note}</p>}
            <div className="w-32 h-1.5 mx-auto rounded-full bg-gradient-to-r from-[#6a99cb] via-[#87b2dd] to-[#b9d3ee]" />
          </div>
        </div>
      </div>

      <ScrollCue />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Type tabs */}
        <div className="flex justify-center gap-4 mb-8 flex-wrap">
          {TYPE_TABS.map((tab) => (
            <button
              key={tab.type}
              onClick={() => pickType(tab.type)}
              className={`px-8 sm:px-12 py-4 rounded-2xl font-bold text-base sm:text-lg transition-all duration-300 transform hover:scale-105 ${
                selectedType === tab.type ? ACTIVE : INACTIVE
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Category pills */}
        <div className="flex justify-center gap-2 sm:gap-3 mb-12 flex-wrap">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 sm:px-8 py-3 rounded-full font-semibold text-sm sm:text-base transition-all duration-300 transform hover:scale-105 ${
              selectedCategory === null ? ACTIVE : INACTIVE
            }`}
          >
            All {selectedType}
          </button>
          {typeCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 sm:px-8 py-3 rounded-full font-semibold text-sm sm:text-base transition-all duration-300 transform hover:scale-105 ${
                selectedCategory === cat.id ? ACTIVE : INACTIVE
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <ScrollCue />

        {loading && (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-[#87b2dd]" />
            <p className="text-white mt-4 text-lg">Loading our delicious menu...</p>
          </div>
        )}

        {!loading &&
          (selectedCategory === null ? (
            <div className="space-y-10">
              {sections.map((sec) => (
                <section key={sec.id}>
                  <h2 className="text-2xl font-bold text-white mb-4">{sec.name}</h2>
                  <div className={GRID}>{sec.items.map(renderCard)}</div>
                </section>
              ))}
              {uncategorized.length > 0 && (
                <section>
                  <h2 className="text-2xl font-bold text-white mb-4">Uncategorized</h2>
                  <div className={GRID}>{uncategorized.map(renderCard)}</div>
                </section>
              )}
            </div>
          ) : (
            <div className={GRID}>{visibleItems.map(renderCard)}</div>
          ))}

        {nothingToShow && (
          <div className="text-center py-20">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-20 w-20 mx-auto text-[#87b2dd] mb-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <p className="text-white text-xl font-medium">No items available in this category</p>
            <p className="text-gray-400 mt-2">Check back soon for new additions</p>
          </div>
        )}
      </div>
    </div>
  );
}
