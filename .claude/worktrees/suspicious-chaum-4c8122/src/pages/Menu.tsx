import { useEffect, useState } from "react";
import { getItems, ItemDto } from "../services/itemService";
import { getCategoriesByType, CategoryDto } from "../services/categoryService";

export default function Menu() {
    type ItemType = "Food" | "Retail" | "Drinks" | "Tobacco";

    const [items, setItems] = useState<ItemDto[]>([]);
    const [categories, setCategories] = useState<CategoryDto[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
    const [selectedItemType, setSelectedItemType] = useState<ItemType>("Food");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        // Load categories
        getCategoriesByType("item", 1, 100)
            .then((res) => {
                if (!mounted) return;
                setCategories(res.data || []);
            })
            .catch(() => {
                /* ignore */
            });

        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        let mounted = true;
        setLoading(true);

        // Load all enabled items (large page size to get all)
        getItems(1, 1000, selectedCategory)
            .then((res) => {
                if (!mounted) return;
                // Filter only enabled items (statusId === 1)
                const enabledItems = (res.data || []).filter(
                    (item) => item.statusId === 1
                );
                setItems(enabledItems);
            })
            .catch(() => {
                /* ignore */
            })
            .finally(() => {
                if (mounted) setLoading(false);
            });

        return () => {
            mounted = false;
        };
    }, [selectedCategory]);

    const resolveImageUrl = (path?: string | null) => {
        if (!path) return "/images/image-placeholder.svg";
        try {
            const url = new URL(path);
            return url.toString();
        } catch {
            const base =
                (import.meta.env.VITE_API_IMAGE_BASE_URL as string) || "";
            if (base) {
                return `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
            }
            return path;
        }
    };

    // Filter categories by selected item type
    const filteredCategories = categories.filter(
        cat => {
  if (selectedItemType === "Drinks") {
    return cat.itemType === "Bar" || cat.itemType === "Drinks";
  }
  return cat.itemType === selectedItemType;
}    );

    // Filter items by selected item type and optionally by category
    const filteredItems = items.filter((item) => {
        // Find the category for this item
        const itemCategory = categories.find((cat) => cat.id === item.categoryId);
        // Check if the item's category matches the selected item type
        const matchesItemType = itemCategory?.itemType === selectedItemType;
        // Check if category filter is applied
        const matchesCategory = selectedCategory === null || item.categoryId === selectedCategory;
        return matchesItemType && matchesCategory;
    });

    const renderItemCard = (item: ItemDto) => {
        const inStock = item.quantity > 0;
        return (
            <div
                key={item.id}
                className="group relative bg-white/10 backdrop-blur-md rounded-xl overflow-hidden hover:bg-white/20 transition-all duration-300 transform hover:scale-105 hover:shadow-xl border border-white/20"
            >
                {/* Stock Badge */}
                <div className="absolute top-2 right-2 z-10">
                    <span
                        className={`px-2 py-1 rounded-full text-xs font-bold backdrop-blur-sm ${inStock
                            ? "bg-green-500/90 text-white"
                            : "bg-red-500/90 text-white"
                            }`}
                    >
                        {inStock ? "✓" : "✕"}
                    </span>
                </div>

                {/* Item Image */}
                <div className="relative h-32 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10"></div>
                    <img
                        src={resolveImageUrl(item.imagePath)}
                        alt={item.name}
                        className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500"
                        onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src =
                                "/images/image-placeholder.svg";
                        }}
                    />
                </div>

                {/* Item Info */}
                <div className="p-3">
                    <div className="mb-2">
                         <h3 className="text-base font-bold text-white mb-1 leading-tight line-clamp-2">
                            {item.name}
                        </h3>
                        
                        <span className="inline-block px-2 py-0.5 bg-purple-500/30 text-purple-200 text-xs font-semibold rounded-full mb-2 capitalize">
                            {item.type}
                        </span>
                       
                    </div>

                    {/* Price */}
                    <div className="flex items-center justify-between pt-2 border-t border-white/20">
                        <div className="flex items-baseline">
                            <span className="text-xl font-bold text-white">
                                ${item.price.toFixed(2)}
                            </span>
                        </div>
                        <div className="w-7 h-7 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center group-hover:rotate-12 transition-transform duration-300">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-4 w-4 text-white"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                            >
                                <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
                            </svg>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div style={{ fontFamily: "'Cygre', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial" }} className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
            {/* Hero Section */}
            <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-black opacity-40"></div>
                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
                    <div className="text-center">
                        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-4 tracking-tight font40">
                            Axis Menu   <br />   
                        </h1>
                        <p className="text-xl text-gray-200 mb-6">
                            <br />
                            Fuel up before the next round. <br />
                            No one wins on an empty tank! <br />
                            <br />
                        </p>
                        <div className="w-32 h-1.5 mx-auto rounded-full bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400"></div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {/* Item Type Tabs (Food / Retail) */}
                <div className="flex justify-center gap-4 mb-8">
                    <button
                        onClick={() => {
                            setSelectedItemType("Food");
                            setSelectedCategory(null);
                        }}
                        className={`px-8 sm:px-12 py-4 rounded-2xl font-bold text-base sm:text-lg transition-all duration-300 transform hover:scale-105 ${selectedItemType === "Food"
                            ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-2xl shadow-orange-500/50"
                            : "bg-white/10 text-white backdrop-blur-sm hover:bg-white/20"
                            }`}
                    >
                        🍔 Food
                    </button>
                    
                    <button
                        onClick={() => {
                            setSelectedItemType("Drinks");
                            setSelectedCategory(null);
                        }}
                        className={`px-8 sm:px-12 py-4 rounded-2xl font-bold text-base sm:text-lg transition-all duration-300 transform hover:scale-105 ${selectedItemType === "Drinks"
                            ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-2xl shadow-blue-500/50"
                            : "bg-white/10 text-white backdrop-blur-sm hover:bg-white/20"
                            }`}
                    >
                       🥤 Drinks
                    </button>
                    
                    <button
                        onClick={() => {
                            setSelectedItemType("Tobacco");
                            setSelectedCategory(null);
                        }}
                        className={`px-8 sm:px-12 py-4 rounded-2xl font-bold text-base sm:text-lg transition-all duration-300 transform hover:scale-105 ${selectedItemType === "Tobacco"
                            ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-2xl shadow-blue-500/50"
                            : "bg-white/10 text-white backdrop-blur-sm hover:bg-white/20"
                            }`}
                    >
                       💨 Tobacco
                    </button>

                    <button
                        onClick={() => {
                            setSelectedItemType("Retail");
                            setSelectedCategory(null);
                        }}
                        className={`px-8 sm:px-12 py-4 rounded-2xl font-bold text-base sm:text-lg transition-all duration-300 transform hover:scale-105 ${selectedItemType === "Retail"
                            ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-2xl shadow-blue-500/50"
                            : "bg-white/10 text-white backdrop-blur-sm hover:bg-white/20"
                            }`}
                    >
                        🛒 Retail
                    </button>
                </div>

                {/* Category Tabs */}
                <div className="flex justify-center gap-2 sm:gap-3 mb-12 flex-wrap">
                    <button
                        onClick={() => setSelectedCategory(null)}
                        className={`px-4 sm:px-8 py-3 rounded-full font-semibold text-sm sm:text-base transition-all duration-300 transform hover:scale-105 ${selectedCategory === null
                            ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-2xl shadow-purple-500/50"
                            : "bg-white/10 text-white backdrop-blur-sm hover:bg-white/20"
                            }`}
                    >
                        All {selectedItemType}
                    </button>
                    {filteredCategories.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat.id)}
                            className={`px-4 sm:px-8 py-3 rounded-full font-semibold text-sm sm:text-base transition-all duration-300 transform hover:scale-105 ${selectedCategory === cat.id
                                ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-2xl shadow-purple-500/50"
                                : "bg-white/10 text-white backdrop-blur-sm hover:bg-white/20"
                                }`}
                        >
                            {cat.name}
                        </button>
                    ))}
                </div>

                {/* Loading State */}
                {loading && (
                    <div className="text-center py-20">
                        <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-purple-400"></div>
                        <p className="text-white mt-4 text-lg">Loading our delicious menu...</p>
                    </div>
                )}

                {/* Items Grid */}
                {!loading && (
                    selectedCategory === null ? (
                        <div className="space-y-10">
                            {(() => {
                                // Build category sections with items filtered by item type
                                const categoryMap = new Map<number, ItemDto[]>();
                                for (const cat of filteredCategories) {
                                    categoryMap.set(cat.id, []);
                                }
                                for (const it of filteredItems) {
                                    if (it.categoryId !== null && categoryMap.has(it.categoryId)) {
                                        categoryMap.get(it.categoryId)!.push(it);
                                    }
                                }
                                const sections = filteredCategories
                                    .map((cat) => ({
                                        id: cat.id,
                                        name: cat.name,
                                        items: categoryMap.get(cat.id) || [],
                                    }))
                                    .filter((s) => s.items.length > 0);

                                const uncategorized = filteredItems.filter(
                                    (it) => it.categoryId === null || !filteredCategories.some((c) => c.id === it.categoryId)
                                );

                                return (
                                    <>
                                        {sections.map((sec) => (
                                            <section key={sec.id}>
                                                <h2 className="text-2xl font-bold text-white mb-4">{sec.name}</h2>
                                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                                    {sec.items.map((item) => renderItemCard(item))}
                                                </div>
                                            </section>
                                        ))}
                                        {uncategorized.length > 0 && (
                                            <section>
                                                <h2 className="text-2xl font-bold text-white mb-4">Uncategorized</h2>
                                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                                    {uncategorized.map((item) => renderItemCard(item))}
                                                </div>
                                            </section>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                            {filteredItems.map((item) => renderItemCard(item))}
                        </div>
                    )
                )}

                {/* Empty State */}
                {!loading && ((selectedCategory !== null && filteredItems.length === 0) || (selectedCategory === null && items.length === 0)) && (
                    <div className="text-center py-20">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-20 w-20 mx-auto text-purple-400 mb-6"
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
