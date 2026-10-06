// PosCategoryBar — horizontally scrollable category chips for the till.
// `null` is "All categories".

export default function PosCategoryBar({
    categories,
    selected,
    onSelect,
}: {
    categories: Array<{ id: number; name: string }>;
    selected: number | null;
    onSelect: (id: number | null) => void;
}) {
    const chips: Array<{ id: number | null; name: string }> = [{ id: null, name: "All categories" }, ...categories];
    return (
        <div className="min-w-0">
            <div
                role="group"
                aria-label="Filter by category"
                className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]"
            >
                {chips.map((c) => {
                    const active = c.id === selected;
                    return (
                        <button
                            key={c.id ?? "all"}
                            type="button"
                            aria-pressed={active}
                            onClick={() => onSelect(c.id)}
                            className={`h-11 shrink-0 whitespace-nowrap rounded-full border px-4 text-sm font-semibold transition ${
                                active
                                    ? "border-indigo-600 bg-indigo-600 text-white shadow-sm shadow-indigo-600/25"
                                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-200 dark:hover:bg-white/[0.06]"
                            }`}
                        >
                            {c.name}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
