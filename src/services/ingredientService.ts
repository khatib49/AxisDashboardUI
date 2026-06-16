import { get, post, put, del } from "./api";

// ─── Types ──────────────────────────────────────────────────────────────────
export type IngredientDto = {
  id: number;
  name: string;
  unit: string;
  quantityOnHand: number;
  reorderLevel: number | null;
  buyPricePerUnit: number | null;
  isActive: boolean;
  notes: string | null;
  createdOn: string;
  modifiedOn: string | null;
  isBelowReorderLevel: boolean;
  isNegative: boolean;
};

export type IngredientCreateDto = {
  name: string;
  unit: string;
  reorderLevel?: number | null;
  buyPricePerUnit?: number | null;
  notes?: string | null;
  openingQuantity?: number | null;
};

export type IngredientUpdateDto = {
  name: string;
  unit: string;
  reorderLevel?: number | null;
  buyPricePerUnit?: number | null;
  notes?: string | null;
  isActive: boolean;
};

export type AddStockRequest = { ingredientId: number; quantity: number; notes?: string | null };
export type RecordWasteRequest = {
  ingredientId: number;
  quantity: number;
  wasteReason: string;
  notes?: string | null;
};
export type AdjustStockRequest = { ingredientId: number; newQuantity: number; notes?: string | null };

export type StockMovementDto = {
  id: number;
  ingredientId: number;
  ingredientName: string;
  ingredientUnit: string;
  quantity: number;
  type: "Purchase" | "Consumption" | "Waste" | "Adjustment";
  referenceType: string | null;
  referenceId: number | null;
  wasteReason: string | null;
  notes: string | null;
  balanceAfter: number;
  createdBy: string | null;
  createdOn: string;
};

export type PagedStockMovements = {
  totalCount: number;
  data: StockMovementDto[];
  pageNumber: number;
  pageSize: number;
};

export const WASTE_REASONS = ["Spoilage", "Spillage", "Burnt", "Expired", "Customer Return", "Other"] as const;
export type WasteReason = (typeof WASTE_REASONS)[number];

// ─── Calls ──────────────────────────────────────────────────────────────────
export async function getIngredients(includeHidden = false): Promise<IngredientDto[]> {
  const q = includeHidden ? "?includeHidden=true" : "";
  return await get<IngredientDto[]>(`/ingredients${q}`);
}

export async function getLowStock(): Promise<IngredientDto[]> {
  return await get<IngredientDto[]>(`/ingredients/low-stock`);
}

export async function getIngredient(id: number): Promise<IngredientDto> {
  return await get<IngredientDto>(`/ingredients/${id}`);
}

export async function createIngredient(dto: IngredientCreateDto): Promise<IngredientDto> {
  return await post<IngredientDto>(`/ingredients`, dto);
}

export async function updateIngredient(id: number, dto: IngredientUpdateDto): Promise<IngredientDto> {
  return await put<IngredientDto>(`/ingredients/${id}`, dto);
}

export async function deactivateIngredient(id: number): Promise<void> {
  return await del<void>(`/ingredients/${id}`);
}

export async function addStock(dto: AddStockRequest): Promise<IngredientDto> {
  return await post<IngredientDto>(`/ingredients/add-stock`, dto);
}

export async function recordWaste(dto: RecordWasteRequest): Promise<IngredientDto> {
  return await post<IngredientDto>(`/ingredients/record-waste`, dto);
}

export async function adjustStock(dto: AdjustStockRequest): Promise<IngredientDto> {
  return await post<IngredientDto>(`/ingredients/adjust-stock`, dto);
}

export async function getStockMovements(opts: {
  ingredientId?: number | null;
  type?: string | null;
  from?: string | null;
  to?: string | null;
  page?: number;
  pageSize?: number;
}): Promise<PagedStockMovements> {
  const p = new URLSearchParams();
  if (opts.ingredientId != null) p.append("ingredientId", String(opts.ingredientId));
  if (opts.type) p.append("type", opts.type);
  if (opts.from) p.append("from", opts.from);
  if (opts.to) p.append("to", opts.to);
  if (opts.page) p.append("page", String(opts.page));
  if (opts.pageSize) p.append("pageSize", String(opts.pageSize));
  const qs = p.toString();
  return await get<PagedStockMovements>(`/ingredients/movements${qs ? `?${qs}` : ""}`);
}
