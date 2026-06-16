import { get } from "./api";

export type InventoryValueLine = {
  ingredientId: number;
  ingredientName: string;
  unit: string;
  quantityOnHand: number;
  unitCost: number | null;
  value: number;
};

export type InventoryTopMover = {
  ingredientId: number;
  ingredientName: string;
  unit: string;
  consumedQuantity: number;
  consumedValue: number;
};

export type InventorySlowMover = {
  ingredientId: number;
  ingredientName: string;
  unit: string;
  quantityOnHand: number;
  unitCost: number | null;
  value: number;
  lastConsumptionOn: string | null;
};

export type InventoryValuationDto = {
  from: string | null;
  to: string | null;
  totalValue: number;
  ingredientCount: number;
  byIngredient: InventoryValueLine[];
  topMovers: InventoryTopMover[];
  slowMovers: InventorySlowMover[];
};

export async function getInventoryValuation(from?: string, to?: string): Promise<InventoryValuationDto> {
  const p = new URLSearchParams();
  if (from) p.append("from", from);
  if (to) p.append("to", to);
  const qs = p.toString();
  return await get<InventoryValuationDto>(`/inventory/valuation${qs ? `?${qs}` : ""}`);
}
