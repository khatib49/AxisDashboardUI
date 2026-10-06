// Shared Tailwind class strings for the till "desk" screens (Orders, Online
// Orders, AXIS PLUS Check, Events). Touch-first: every button is ≥ 44px tall.

export type DeskBtnTone = "primary" | "success" | "sky" | "outline" | "danger" | "purple";

const TONES: Record<DeskBtnTone, string> = {
    primary: "bg-violet-600 text-white shadow-sm shadow-violet-600/20 hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-600",
    success: "bg-emerald-600 text-white shadow-sm shadow-emerald-600/20 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600",
    sky: "bg-sky-600 text-white shadow-sm shadow-sky-600/20 hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-600",
    outline: "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-200 dark:hover:bg-white/[0.06]",
    danger: "border border-red-200 bg-white text-red-600 hover:bg-red-50 dark:border-red-500/30 dark:bg-transparent dark:text-red-400 dark:hover:bg-red-500/10",
    purple: "border border-fuchsia-200 bg-white text-fuchsia-700 hover:bg-fuchsia-50 dark:border-fuchsia-500/30 dark:bg-transparent dark:text-fuchsia-300 dark:hover:bg-fuchsia-500/10",
};

/** Button classes: 44px min height (48px for `lg`), rounded-xl, tone colours. */
export function deskBtn(tone: DeskBtnTone = "outline", size: "md" | "lg" = "md"): string {
    const s = size === "lg" ? "min-h-12 px-5 text-base" : "min-h-11 px-4 text-sm";
    return `inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition select-none disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 ${s} ${TONES[tone]}`;
}

/** Text input classes (44px tall). */
export const deskInput =
    "h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:placeholder:text-gray-500";

/** Card surface used by the desk lists. */
export const deskCard =
    "rounded-2xl border bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:bg-white/[0.03]";

export const money = (n: number) => `$${n.toFixed(2)}`;
