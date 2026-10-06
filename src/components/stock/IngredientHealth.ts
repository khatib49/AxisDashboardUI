// IngredientHealth — formatting and stock-health helpers for the
// Ingredients page (/chef/ingredients). No components here, so the
// component files stay fast-refresh friendly.

import type { IngredientDto } from "../../services/ingredientService";

export const fmtQty = (n: number, unit: string) => `${n.toLocaleString("en-US", { maximumFractionDigits: 3 })} ${unit}`;

/** Unit prices can be tiny (per gram), so allow up to 4 decimals. */
export const moneyUnit = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;

export const money = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * How healthy one ingredient's stock is. Evaluated in severity order — an
 * ingredient that is both negative and below its reorder level reports the
 * worse of the two.
 *
 * "no-threshold" isn't a stock problem, it's a setup gap: with no reorder
 * level the ingredient can never trigger a low-stock warning, so it would
 * quietly run out. Worth surfacing, but ranked last.
 */
export type Health = "negative" | "out" | "low" | "no-threshold" | "ok";

export const health = (r: IngredientDto): Health => {
  if (r.isNegative || r.quantityOnHand < 0) return "negative";
  if (r.quantityOnHand === 0) return "out";
  if (r.isBelowReorderLevel) return "low";
  if (r.reorderLevel == null) return "no-threshold";
  return "ok";
};

/** Needs the chef's attention right now (stock problem, not a setup gap). */
export const isStockProblem = (h: Health) => h === "negative" || h === "out" || h === "low";
