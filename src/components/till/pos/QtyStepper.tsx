// QtyStepper — touch-sized −/qty/+ control for the till. Purely
// presentational: the caller owns the quantity and the handlers.

export default function QtyStepper({
    value,
    label,
    onDec,
    onInc,
    decDisabled,
    fluid = false,
}: {
    value: number;
    /** Item name, used for the buttons' accessible labels. */
    label: string;
    onDec: () => void;
    onInc: () => void;
    decDisabled?: boolean;
    /** Stretch to the parent's width (item cards) instead of a compact pill (cart). */
    fluid?: boolean;
}) {
    return (
        <div
            role="group"
            aria-label={`Quantity of ${label}`}
            className={`flex h-11 items-stretch overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/10 dark:bg-white/[0.03] ${fluid ? "w-full" : "w-[140px] shrink-0"}`}
        >
            <button
                type="button"
                aria-label={`Remove one ${label}`}
                disabled={decDisabled}
                onClick={onDec}
                className="flex min-w-11 flex-1 items-center justify-center bg-gray-50 text-xl font-semibold text-gray-700 transition hover:bg-gray-100 active:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10 dark:active:bg-white/15"
            >
                −
            </button>
            <div
                className={`flex w-12 shrink-0 items-center justify-center border-x border-gray-200 text-base font-bold tabular-nums dark:border-white/10 ${
                    value > 0
                        ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
                        : "text-gray-500 dark:text-gray-400"
                }`}
            >
                {value}
            </div>
            <button
                type="button"
                aria-label={`Add one ${label}`}
                onClick={onInc}
                className="flex min-w-11 flex-1 items-center justify-center bg-indigo-600 text-xl font-semibold text-white transition hover:bg-indigo-700 active:bg-indigo-800"
            >
                +
            </button>
        </div>
    );
}
