// One rule for "is this a TCG / retail category?" used across the dashboard.
// The single "TCG" category was split into Pokemon, YuGiOh, Sleeves… for the
// website; all of them carry ItemType = "Retail". The name check only keeps
// legacy data working.
export type CategoryLike = { name?: string | null; itemType?: string | null; type?: string | null };

export const isRetailCategory = (c: CategoryLike | null | undefined): boolean =>
  !!c && ((c.itemType ?? "").trim().toLowerCase() === "retail" || (c.name ?? "").toLowerCase().includes("tcg"));

/** F&B = an item category that is not retail (Food, Drinks, Tobacco, unset). */
export const isFnbCategory = (c: CategoryLike | null | undefined): boolean =>
  !!c && (c.type ?? "item") === "item" && !isRetailCategory(c);
