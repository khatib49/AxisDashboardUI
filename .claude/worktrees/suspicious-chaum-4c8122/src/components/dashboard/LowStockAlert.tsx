import { useEffect, useState } from "react";
import { get } from "../../services/api";
import Loader from "../ui/Loader";

type LowStockItem = {
    id: number;
    name: string;
    quantity: number;
    categoryName?: string;
    imagePath?: string;
};

export default function LowStockAlert({ threshold = 5 }: { threshold?: number }) {
    const [items, setItems] = useState<LowStockItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [customThreshold, setCustomThreshold] = useState(threshold);

    useEffect(() => {
        const fetchLowStock = async () => {
            try {
                setLoading(true);
                // Uses existing items endpoint with filtering
                const result = await get<{ data: any[] }>(`/item?pageSize=200&page=1`);
                const allItems = result?.data || [];
                const low = allItems
                    .filter((i: any) => i.quantity !== undefined && i.quantity <= customThreshold && i.quantity >= 0)
                    .sort((a: any, b: any) => a.quantity - b.quantity)
                    .slice(0, 20)
                    .map((i: any) => ({
                        id: i.id,
                        name: i.name,
                        quantity: i.quantity,
                        categoryName: i.categoryName,
                        imagePath: i.imagePath,
                    }));
                setItems(low);
            } catch {
                setItems([]);
            } finally {
                setLoading(false);
            }
        };
        fetchLowStock();
    }, [customThreshold]);

    const stockColor = (qty: number) => {
        if (qty === 0) return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
        if (qty <= 2) return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
    };

    return (
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-5 md:p-6">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90 flex items-center gap-2">
                        ⚠️ Low Stock Alert
                    </h3>
                    <p className="mt-1 text-gray-500 text-sm dark:text-gray-400">
                        Items at or below threshold
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Threshold:</span>
                    <select
                        value={customThreshold}
                        onChange={e => setCustomThreshold(Number(e.target.value))}
                        className="text-sm border border-gray-200 rounded-lg px-2 py-1 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                    >
                        {[3, 5, 10, 15, 20].map(n => (
                            <option key={n} value={n}>{n} units</option>
                        ))}
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-10"><Loader /></div>
            ) : items.length === 0 ? (
                <div className="text-center py-10">
                    <p className="text-4xl mb-2">✅</p>
                    <p className="text-gray-500 text-sm">All items have sufficient stock</p>
                </div>
            ) : (
                <>
                    <div className="mb-3 flex items-center gap-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            {items.filter(i => i.quantity === 0).length} out of stock
                        </span>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                            {items.filter(i => i.quantity > 0 && i.quantity <= 2).length} critical
                        </span>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                            {items.filter(i => i.quantity > 2).length} low
                        </span>
                    </div>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                        {items.map(item => (
                            <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-gray-800 dark:text-white/90 text-sm truncate">{item.name}</p>
                                    {item.categoryName && (
                                        <p className="text-xs text-gray-400 truncate">{item.categoryName}</p>
                                    )}
                                </div>
                                <span className={`ml-3 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${stockColor(item.quantity)}`}>
                                    {item.quantity === 0 ? '🚫 Out' : `${item.quantity} left`}
                                </span>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}