import { post } from "./api";

// Mirrors Backend/DTOs/StockDtos.cs → RebuildConsumptionCostsResultDto.
export type RebuildLineDto = {
  movementId: number;
  transactionId: number;
  ingredientId: number;
  ingredientName: string;
  oldQuantity: number;
  newQuantity: number;
  oldUnitCost: number | null;
  newUnitCost: number | null;
  oldTotalCost: number | null;
  newTotalCost: number | null;
  reason: string;
};

export type RebuildConsumptionCostsResultDto = {
  dryRun: boolean;
  from: string | null;
  to: string | null;
  movementsScanned: number;
  movementsChanged: number;
  transactionsAffected: number;
  oldTotalCogs: number;
  newTotalCogs: number;
  delta: number;
  // "Beef (kg)" → +154.2
  qoHAdjustments: Record<string, number>;
  details: RebuildLineDto[];
};

// dryRun=true (default) previews without writing. Flip to false to commit.
export async function rebuildConsumptionCosts(
  dryRun: boolean,
  from?: string,
  to?: string,
  detailLimit = 200,
): Promise<RebuildConsumptionCostsResultDto> {
  const params = new URLSearchParams();
  params.set("dryRun", String(dryRun));
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  params.set("detailLimit", String(detailLimit));
  // The controller expects the payload via query; body is empty.
  return await post<RebuildConsumptionCostsResultDto>(
    `/stock/rebuild-consumption-costs?${params.toString()}`,
    {},
  );
}
