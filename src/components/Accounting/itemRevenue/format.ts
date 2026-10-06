// Item Revenue report — formatting helpers, shared types and stream colours.

/** Money with an explicit minus sign for negatives (−$12.00, never $-12.00). */
export const money = (n: number) => {
    const rounded = Math.round(n * 100) / 100;
    return `${rounded < 0 ? "−" : ""}$${Math.abs(rounded).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const pct = (n: number | null | undefined) =>
    n == null ? "—" : `${n.toFixed(1)}%`;

/** Margin thresholds: ≥ 50% healthy, ≥ 20% moderate, below that low. */
export type MarginTone = "emerald" | "amber" | "red" | "gray";
export const marginTone = (v: number | null | undefined): MarginTone => {
    if (v == null) return "gray";
    if (v >= 50) return "emerald";
    if (v >= 20) return "amber";
    return "red";
};
export const marginHint = (v: number | null | undefined) => {
    if (v == null) return "No revenue — margin not defined";
    if (v >= 50) return "Healthy margin (50% or more)";
    if (v >= 20) return "Moderate margin (20–50%)";
    return "Low margin (under 20%)";
};

export const profitCls = (v: number) =>
    v >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";

// Same stream colours as the Accounting dashboard's revenue mix.
export const STREAM_COLOR = { tcg: "#1baf7a", fnb: "#eb6834" } as const;

export type SortKey =
    | "itemName"
    | "sellPrice"
    | "unitsSold"
    | "revenue"
    | "cogs"
    | "grossProfit"
    | "grossMarginPct"
    | "stockOnHand"
    | "stockSellValue"
    | "stockBuyValue";

export type SortDir = "asc" | "desc";
