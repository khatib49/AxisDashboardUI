import api, { get } from "./api";

export type Quadrant = "Star" | "Plowhorse" | "Puzzle" | "Dog";
export type CostSource = "recipe" | "buy" | "none";

export type MenuEngineeringItemDto = {
  itemId: number;
  name: string;
  categoryId: number;
  category: string;
  price: number;
  /** Σ recipe qty (in the ingredient's unit) × BuyPricePerUnit; 0 when there is no recipe. */
  recipeCost: number;
  hasRecipe: boolean;
  /** Cost used for the margin: recipeCost, else Item.BuyPrice, else 0. */
  unitCost: number;
  costSource: CostSource | string;
  grossMargin: number;
  marginPct: number;
  unitsSold: number;
  revenue: number;
  totalCost: number;
  contribution: number;
  popularityIndex: number;
  profitabilityIndex: number;
  isPopular: boolean;
  isProfitable: boolean;
  quadrant: Quadrant | string;
  lowMarginFlag: boolean;
};

export type MenuEngineeringTotalsDto = {
  revenue: number;
  cost: number;
  contribution: number;
  avgMarginPct: number;
  itemCount: number;
  unitsSold: number;
  stars: number;
  plowhorses: number;
  puzzles: number;
  dogs: number;
  lowMarginCount: number;
};

export type MenuEngineeringReportDto = {
  from?: string | null;
  to?: string | null;
  generatedAt: string;
  marginThresholdPct: number;
  avgUnitsPerItem: number;
  popularityThresholdUnits: number;
  profitabilityThresholdPct: number;
  items: MenuEngineeringItemDto[];
  totals: MenuEngineeringTotalsDto;
  missingRecipes: string[];
};

export type ItemCostBreakdownLineDto = {
  ingredientId: number;
  ingredient: string;
  quantity: number;
  unit: string;
  convertedQuantity: number;
  ingredientUnit: string;
  unitCost?: number | null;
  lineCost: number;
  converted: boolean;
};

export type ItemCostBreakdownDto = {
  itemId: number;
  name: string;
  category: string;
  price: number;
  hasRecipe: boolean;
  recipeCost: number;
  unitCost: number;
  costSource: CostSource | string;
  grossMargin: number;
  marginPct: number;
  lines: ItemCostBreakdownLineDto[];
  targetMarginPct: number;
  suggestedPrice: number;
  suggestedPriceRounded: number;
  unpricedIngredients: string[];
};

export type MenuEngineeringQuery = {
  /** ISO instant, inclusive. */
  from?: string;
  /** ISO instant, exclusive. */
  to?: string;
  categoryIds?: number[];
  branchId?: number;
  marginThresholdPct?: number;
};

function buildQuery(q: MenuEngineeringQuery): string {
  const p = new URLSearchParams();
  if (q.from) p.append("from", q.from);
  if (q.to) p.append("to", q.to);
  q.categoryIds?.forEach((id) => p.append("categoryIds", String(id)));
  if (q.branchId != null) p.append("branchId", String(q.branchId));
  if (q.marginThresholdPct != null) p.append("marginThresholdPct", String(q.marginThresholdPct));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export async function getMenuEngineeringReport(q: MenuEngineeringQuery): Promise<MenuEngineeringReportDto> {
  return get<MenuEngineeringReportDto>(`/menu-engineering/report${buildQuery(q)}`);
}

export async function getItemCostBreakdown(itemId: number, targetMarginPct = 70): Promise<ItemCostBreakdownDto> {
  return get<ItemCostBreakdownDto>(`/menu-engineering/item/${itemId}/cost?targetMarginPct=${targetMarginPct}`);
}

/** Server-rendered CSV (text/csv) of the same report. */
export async function exportMenuEngineeringCsv(q: MenuEngineeringQuery): Promise<Blob> {
  const res = await api.get(`/menu-engineering/report/export.csv${buildQuery(q)}`, {
    responseType: "blob",
    headers: { Accept: "text/csv" },
  });
  return res.data as Blob;
}

export function errorMessage(err: unknown, fallback = "Request failed"): string {
  if (err && typeof err === "object") {
    const e = err as { message?: unknown; status?: unknown; details?: unknown };
    if (e.status === 404) return "Menu engineering endpoint is not available on this server yet.";
    const details = e.details as { error?: unknown; message?: unknown } | undefined;
    if (details && typeof details.error === "string" && details.error) return details.error;
    if (typeof e.message === "string" && e.message) return e.message;
  }
  return fallback;
}

export default {
  getMenuEngineeringReport,
  getItemCostBreakdown,
  exportMenuEngineeringCsv,
};
