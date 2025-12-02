import { useEffect, useState } from "react";
import { getItemSalesReport, ItemSalesReportDto } from "../../services/transactionService";
import Loader from "../ui/Loader";

type DateFilter = 'today' | 'yesterday' | '7days' | '30days';

export default function BestSellers() {
    const [items, setItems] = useState<ItemSalesReportDto[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<DateFilter>('30days');

    useEffect(() => {
        const fetchBestSellers = async () => {
            try {
                setLoading(true);
                const now = new Date();
                let from: Date;

                switch (filter) {
                    case 'today':
                        from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
                        break;
                    case 'yesterday': {
                        const yesterday = new Date(now);
                        yesterday.setDate(yesterday.getDate() - 1);
                        from = new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate(), 0, 0, 0, 0));
                        break;
                    }
                    case '7days':
                        from = new Date(now);
                        from.setDate(from.getDate() - 7);
                        from = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), 0, 0, 0, 0));
                        break;
                    case '30days':
                    default:
                        from = new Date(now);
                        from.setDate(from.getDate() - 30);
                        from = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), 0, 0, 0, 0));
                        break;
                }

                const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));

                const data = await getItemSalesReport({
                    from: from.toISOString(),
                    to: to.toISOString(),
                    top: 10
                });

                setItems(data);
            } catch (error) {
                console.error("Failed to fetch best sellers:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchBestSellers();
    }, [filter]);

    return (
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-5 md:p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                        Best Sellers
                    </h3>
                    <p className="mt-1 text-gray-500 text-sm dark:text-gray-400">
                        Top selling items by quantity
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setFilter('today')}
                        className={`px-3 py-1 rounded-lg text-sm font-medium transition ${filter === 'today'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
                            }`}
                    >
                        Today
                    </button>
                    <button
                        onClick={() => setFilter('yesterday')}
                        className={`px-3 py-1 rounded-lg text-sm font-medium transition ${filter === 'yesterday'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
                            }`}
                    >
                        Yesterday
                    </button>
                    <button
                        onClick={() => setFilter('7days')}
                        className={`px-3 py-1 rounded-lg text-sm font-medium transition ${filter === '7days'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
                            }`}
                    >
                        7 Days
                    </button>
                    <button
                        onClick={() => setFilter('30days')}
                        className={`px-3 py-1 rounded-lg text-sm font-medium transition ${filter === '30days'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
                            }`}
                    >
                        30 Days
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-10">
                    <Loader />
                </div>
            ) : items.length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                    No data available
                </div>
            ) : (
                <div className="h-[500px] overflow-y-auto space-y-3 pr-2">
                    {items.map((item, index) => (
                        <div
                            key={item.itemId}
                            className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                        >
                            <div className="flex items-center gap-3 flex-1">
                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold text-sm">
                                    {index + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-gray-800 dark:text-white/90 truncate">
                                        {item.itemName}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {item.categoryName}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right ml-3">
                                <p className="font-bold text-gray-800 dark:text-white/90">
                                    ${item.totalAmount.toFixed(2)}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {item.totalQuantity} sold
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
