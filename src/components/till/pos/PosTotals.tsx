// PosTotals — subtotal / discount / tax / total block for the till cart
// and order drawer. Display only: the page computes every figure.

export default function PosTotals({
    subtotal,
    discount,
    discountAmount,
    total,
}: {
    subtotal: number;
    discount?: { name: string; percentage: number } | null;
    discountAmount: number;
    total: number;
}) {
    return (
        <div className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
                <span>Subtotal</span>
                <span className="font-medium tabular-nums text-gray-900 dark:text-white">${subtotal.toFixed(2)}</span>
            </div>
            {discount && (
                <div className="flex items-center justify-between gap-3 text-emerald-700 dark:text-emerald-400">
                    <span className="min-w-0 truncate">Discount ({discount.name} - {discount.percentage}%)</span>
                    <span className="shrink-0 font-medium tabular-nums">-${discountAmount.toFixed(2)}</span>
                </div>
            )}
            <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
                <span>Tax</span>
                <span className="font-medium tabular-nums text-gray-900 dark:text-white">$0.00</span>
            </div>
            <div className="!mt-3 flex items-end justify-between border-t border-gray-200 pt-3 dark:border-white/10">
                <span className="text-base font-semibold text-gray-900 dark:text-white">Total</span>
                <span className="text-3xl font-bold leading-none tracking-tight tabular-nums text-gray-900 dark:text-white">${total.toFixed(2)}</span>
            </div>
        </div>
    );
}
