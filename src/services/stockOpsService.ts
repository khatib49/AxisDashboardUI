import api from "./api";

// ─── Shared ────────────────────────────────────────────────────────────────
export type BaseResponse<T> = {
  success: boolean;
  error?: string | null;
  message: string;
  data?: T | null;
};

export type Paginated<T> = {
  totalCount: number;
  data: T[];
  pageNumber: number;
  pageSize: number;
};

export type StockOpsStatus = "Draft" | "Posted" | "Cancelled";

// Minimal shapes of the EXISTING ingredient / supplier endpoints we read.
export type IngredientLite = {
  id: number;
  name: string;
  unit: string;
  quantityOnHand: number;
  reorderLevel?: number | null;
  buyPricePerUnit?: number | null;
  isActive: boolean;
};

export type SupplierLite = {
  id: number;
  name: string;
  isActive: boolean;
};

// ─── Locations ────────────────────────────────────────────────────────────
export type StockLocationDto = {
  id: number;
  name: string;
  code: string;
  isDefault: boolean;
  isActive: boolean;
  branchId?: number | null;
};

export type StockLocationUpsertDto = {
  name: string;
  code: string;
  isDefault?: boolean;
  isActive?: boolean;
};

export type LocationStockDto = {
  ingredientId: number;
  ingredientName: string;
  unit: string;
  quantity: number;
};

// ─── Stock counts ─────────────────────────────────────────────────────────
export type StockCountSummaryDto = {
  id: number;
  locationId: number;
  locationName: string;
  reference: string;
  status: StockOpsStatus;
  createdOn: string;
  createdBy?: string | null;
  postedOn?: string | null;
  postedBy?: string | null;
  notes?: string | null;
  lineCount: number;
  countedLines: number;
};

export type StockCountLineDto = {
  id: number;
  ingredientId: number;
  ingredientName: string;
  unit: string;
  expectedQty: number;
  countedQty?: number | null;
  variance: number;
  unitCost?: number | null;
  varianceValue: number;
};

export type StockCountDto = Omit<StockCountSummaryDto, "lineCount" | "countedLines"> & {
  lines: StockCountLineDto[];
};

export type StockCountVarianceReportDto = {
  countId: number;
  reference: string;
  locationName: string;
  postedOn?: string | null;
  linesCounted: number;
  linesWithVariance: number;
  totalShrinkQtyLines: number;
  totalShrinkValue: number;
  totalSurplusValue: number;
  netVarianceValue: number;
  topVariances: StockCountLineDto[];
};

// ─── Transfers ────────────────────────────────────────────────────────────
export type StockTransferLineDto = {
  id: number;
  ingredientId: number;
  ingredientName: string;
  unit: string;
  quantity: number;
};

export type StockTransferLineInputDto = { ingredientId: number; quantity: number };

export type StockTransferDto = {
  id: number;
  fromLocationId: number;
  fromLocationName: string;
  toLocationId: number;
  toLocationName: string;
  reference: string;
  status: StockOpsStatus;
  createdOn: string;
  createdBy?: string | null;
  postedOn?: string | null;
  notes?: string | null;
  lines: StockTransferLineDto[];
};

export type StockTransferCreateDto = {
  fromLocationId: number;
  toLocationId: number;
  notes?: string | null;
  lines: StockTransferLineInputDto[];
};

export type StockTransferUpdateDto = {
  fromLocationId?: number | null;
  toLocationId?: number | null;
  notes?: string | null;
  lines?: StockTransferLineInputDto[] | null;
};

// ─── Reorder ──────────────────────────────────────────────────────────────
export type ReorderRuleDto = {
  id: number;
  ingredientId: number;
  ingredientName: string;
  unit: string;
  minQty: number;
  targetQty: number;
  preferredSupplierId?: number | null;
  preferredSupplierName?: string | null;
  leadTimeDays: number;
  isActive: boolean;
};

export type ReorderRuleUpsertDto = {
  ingredientId: number;
  minQty: number;
  targetQty: number;
  preferredSupplierId?: number | null;
  leadTimeDays?: number;
  isActive?: boolean;
};

export type ReorderSuggestionDto = {
  ingredientId: number;
  ingredientName: string;
  unit: string;
  quantityOnHand: number;
  threshold: number;
  suggestedQty: number;
  unitCost?: number | null;
  estimatedCost: number;
  supplierId?: number | null;
  supplierName?: string | null;
  lastPurchaseOn?: string | null;
  lastPurchaseUnitCost?: number | null;
  leadTimeDays: number;
  hasRule: boolean;
};

// Mirrors the existing PurchaseCreateDto / PurchaseLineInputDto so the
// purchases page can POST it to /purchases as-is.
export type PurchaseLineInputDto = {
  ingredientId: number;
  quantity: number;
  unitCost: number;
  notes?: string | null;
};

export type PurchaseCreateDto = {
  supplierId?: number | null;
  purchaseDate: string;
  invoiceNumber?: string | null;
  notes?: string | null;
  lines: PurchaseLineInputDto[];
};

export const PURCHASE_DRAFT_STORAGE_KEY = "stockops.purchaseDraft";

// ─── Batches ──────────────────────────────────────────────────────────────
export type StockBatchDto = {
  id: number;
  ingredientId: number;
  ingredientName: string;
  unit: string;
  purchaseLineId?: number | null;
  lotNumber?: string | null;
  quantity: number;
  remainingQuantity: number;
  expiresOn?: string | null;
  receivedOn: string;
  notes?: string | null;
  daysToExpiry?: number | null;
  isExpired: boolean;
  writtenOffOn?: string | null;
};

export type StockBatchCreateDto = {
  ingredientId: number;
  quantity: number;
  expiresOn?: string | null;
  purchaseLineId?: number | null;
  lotNumber?: string | null;
  receivedOn?: string | null;
  notes?: string | null;
};

export type StockBatchUpdateDto = {
  lotNumber?: string | null;
  quantity?: number | null;
  remainingQuantity?: number | null;
  expiresOn?: string | null;
  receivedOn?: string | null;
  notes?: string | null;
};

// ─── Branch positions (phase 3) ───────────────────────────────────────────
/** One ingredient at one branch. belowLevel = totalQty <= reorderLevel (rule minQty, else ingredient reorder level). */
export type BranchStockLineDto = {
  ingredientId: number;
  ingredientName: string;
  unit: string;
  defaultQty: number;
  otherQty: number;
  totalQty: number;
  reorderLevel?: number | null;
  belowLevel: boolean;
  unitCost?: number | null;
  value: number;
};

/** branchId null = the shared scope (global "Main" + shared locations). */
export type BranchStockPositionDto = {
  branchId?: number | null;
  branchCode: string;
  branchName: string;
  defaultLocationId: number;
  defaultLocationName: string;
  otherLocations: StockLocationDto[];
  belowLevelCount: number;
  totalValue: number;
  lines: BranchStockLineDto[];
};

export type StockPositionColumnDto = {
  branchId?: number | null;
  code: string;
  name: string;
  defaultLocationId: number;
  defaultLocationName: string;
  totalValue: number;
  belowLevelCount: number;
};

export type StockPositionCellDto = { branchId?: number | null; qty: number; belowLevel: boolean; value: number };

export type StockPositionRowDto = {
  ingredientId: number;
  ingredientName: string;
  unit: string;
  reorderLevel?: number | null;
  unitCost?: number | null;
  cells: StockPositionCellDto[];
  totalQty: number;
  totalValue: number;
};

/** All branches side by side; columns[0] is always the shared scope. */
export type StockPositionsDto = { columns: StockPositionColumnDto[]; rows: StockPositionRowDto[]; totalValue: number };

export type ReceiveToLocationResultDto = {
  purchaseId: number;
  locationId: number;
  locationName: string;
  /** The purchase had already been received; transfer is the existing one. */
  alreadyReceived: boolean;
  transfer: StockTransferDto;
};

// Minimal shape of the EXISTING /purchases list rows (PurchaseDto).
export type PurchaseLite = {
  id: number;
  supplierId?: number | null;
  supplierName?: string | null;
  purchaseDate: string;
  invoiceNumber?: string | null;
  totalCost: number;
  lines: { id: number; ingredientId: number; ingredientName: string; unit: string; quantity: number; unitCost: number }[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────
/** Pulls a readable message out of an axios error / BaseResponse failure. */
export function errorMessage(err: unknown, fallback = "Something went wrong"): string {
  const e = err as {
    response?: { status?: number; data?: { error?: string; message?: string; title?: string } | string };
    message?: string;
  };
  const status = e?.response?.status;
  if (status === 403) return "You do not have permission to do this.";
  if (status === 404) return "Not found.";
  const data = e?.response?.data;
  if (typeof data === "string" && data) return data;
  if (data && typeof data === "object") return data.error || data.message || data.title || fallback;
  return e?.message || fallback;
}

function unwrap<T>(res: BaseResponse<T>): T {
  if (!res.success || res.data == null) throw new Error(res.error || res.message || "Request failed");
  return res.data;
}

// ─── API: existing endpoints we only read ─────────────────────────────────
export async function getIngredients(): Promise<IngredientLite[]> {
  const res = await api.get<IngredientLite[]>("/ingredients");
  return res.data ?? [];
}

export async function getSuppliers(): Promise<SupplierLite[]> {
  const res = await api.get<SupplierLite[]>("/suppliers");
  return res.data ?? [];
}

// ─── API: locations ───────────────────────────────────────────────────────
export async function getLocations(includeInactive = false): Promise<StockLocationDto[]> {
  const res = await api.get<StockLocationDto[]>(`/stockops/locations?includeInactive=${includeInactive}`);
  return res.data ?? [];
}

export async function getDefaultLocation(): Promise<StockLocationDto> {
  const res = await api.get<StockLocationDto>("/stockops/locations/default");
  return res.data;
}

export async function getLocationStock(locationId: number, search?: string): Promise<LocationStockDto[]> {
  const q = search ? `?search=${encodeURIComponent(search)}` : "";
  const res = await api.get<LocationStockDto[]>(`/stockops/locations/${locationId}/stock${q}`);
  return res.data ?? [];
}

export async function createLocation(dto: StockLocationUpsertDto): Promise<StockLocationDto> {
  const res = await api.post<BaseResponse<StockLocationDto>>("/stockops/locations", dto);
  return unwrap(res.data);
}

export async function updateLocation(id: number, dto: StockLocationUpsertDto): Promise<StockLocationDto> {
  const res = await api.put<BaseResponse<StockLocationDto>>(`/stockops/locations/${id}`, dto);
  return unwrap(res.data);
}

export async function deactivateLocation(id: number): Promise<void> {
  const res = await api.delete<BaseResponse<boolean>>(`/stockops/locations/${id}`);
  unwrap(res.data);
}

// ─── API: counts ──────────────────────────────────────────────────────────
export async function getStockCounts(
  params: { status?: string; locationId?: number; page?: number; pageSize?: number } = {}
): Promise<Paginated<StockCountSummaryDto>> {
  const q = new URLSearchParams();
  if (params.status) q.set("status", params.status);
  if (params.locationId) q.set("locationId", String(params.locationId));
  q.set("page", String(params.page ?? 1));
  q.set("pageSize", String(params.pageSize ?? 25));
  const res = await api.get<Paginated<StockCountSummaryDto>>(`/stockops/counts?${q.toString()}`);
  return res.data;
}

export async function getStockCount(id: number): Promise<StockCountDto> {
  const res = await api.get<StockCountDto>(`/stockops/counts/${id}`);
  return res.data;
}

export async function createStockCount(locationId: number | null, notes?: string): Promise<StockCountDto> {
  const res = await api.post<BaseResponse<StockCountDto>>("/stockops/counts", { locationId, notes: notes || null });
  return unwrap(res.data);
}

export async function updateStockCountLines(
  id: number,
  lines: { lineId: number; countedQty: number | null }[]
): Promise<StockCountDto> {
  const res = await api.put<BaseResponse<StockCountDto>>(`/stockops/counts/${id}/lines`, { lines });
  return unwrap(res.data);
}

export async function postStockCount(id: number): Promise<StockCountDto> {
  const res = await api.post<BaseResponse<StockCountDto>>(`/stockops/counts/${id}/post`);
  return unwrap(res.data);
}

export async function cancelStockCount(id: number): Promise<void> {
  const res = await api.post<BaseResponse<boolean>>(`/stockops/counts/${id}/cancel`);
  unwrap(res.data);
}

export async function getStockCountVariance(id: number, top = 10): Promise<StockCountVarianceReportDto> {
  const res = await api.get<BaseResponse<StockCountVarianceReportDto>>(`/stockops/counts/${id}/variance?top=${top}`);
  return unwrap(res.data);
}

// ─── API: transfers ───────────────────────────────────────────────────────
export async function getTransfers(
  params: { status?: string; locationId?: number; page?: number; pageSize?: number } = {}
): Promise<Paginated<StockTransferDto>> {
  const q = new URLSearchParams();
  if (params.status) q.set("status", params.status);
  if (params.locationId) q.set("locationId", String(params.locationId));
  q.set("page", String(params.page ?? 1));
  q.set("pageSize", String(params.pageSize ?? 25));
  const res = await api.get<Paginated<StockTransferDto>>(`/stockops/transfers?${q.toString()}`);
  return res.data;
}

export async function getTransfer(id: number): Promise<StockTransferDto> {
  const res = await api.get<StockTransferDto>(`/stockops/transfers/${id}`);
  return res.data;
}

export async function createTransfer(dto: StockTransferCreateDto): Promise<StockTransferDto> {
  const res = await api.post<BaseResponse<StockTransferDto>>("/stockops/transfers", dto);
  return unwrap(res.data);
}

export async function updateTransfer(id: number, dto: StockTransferUpdateDto): Promise<StockTransferDto> {
  const res = await api.put<BaseResponse<StockTransferDto>>(`/stockops/transfers/${id}`, dto);
  return unwrap(res.data);
}

export async function postTransfer(id: number): Promise<StockTransferDto> {
  const res = await api.post<BaseResponse<StockTransferDto>>(`/stockops/transfers/${id}/post`);
  return unwrap(res.data);
}

export async function cancelTransfer(id: number): Promise<void> {
  const res = await api.post<BaseResponse<boolean>>(`/stockops/transfers/${id}/cancel`);
  unwrap(res.data);
}

// ─── API: reorder ─────────────────────────────────────────────────────────
export async function getReorderSuggestions(): Promise<ReorderSuggestionDto[]> {
  const res = await api.get<ReorderSuggestionDto[]>("/stockops/reorder/suggestions");
  return res.data ?? [];
}

export async function buildPurchaseDraft(
  request: { ingredientIds?: number[] | null; supplierId?: number | null; notes?: string | null } = {}
): Promise<PurchaseCreateDto> {
  const res = await api.post<BaseResponse<PurchaseCreateDto>>("/stockops/reorder/create-purchase-draft", request);
  return unwrap(res.data);
}

export async function getReorderRules(): Promise<ReorderRuleDto[]> {
  const res = await api.get<ReorderRuleDto[]>("/stockops/reorder/rules");
  return res.data ?? [];
}

export async function createReorderRule(dto: ReorderRuleUpsertDto): Promise<ReorderRuleDto> {
  const res = await api.post<BaseResponse<ReorderRuleDto>>("/stockops/reorder/rules", dto);
  return unwrap(res.data);
}

export async function updateReorderRule(id: number, dto: ReorderRuleUpsertDto): Promise<ReorderRuleDto> {
  const res = await api.put<BaseResponse<ReorderRuleDto>>(`/stockops/reorder/rules/${id}`, dto);
  return unwrap(res.data);
}

export async function deleteReorderRule(id: number): Promise<void> {
  await api.delete(`/stockops/reorder/rules/${id}`);
}

// ─── API: batches ─────────────────────────────────────────────────────────
export async function getBatches(
  params: { ingredientId?: number; onlyWithRemaining?: boolean; page?: number; pageSize?: number } = {}
): Promise<Paginated<StockBatchDto>> {
  const q = new URLSearchParams();
  if (params.ingredientId) q.set("ingredientId", String(params.ingredientId));
  if (params.onlyWithRemaining != null) q.set("onlyWithRemaining", String(params.onlyWithRemaining));
  q.set("page", String(params.page ?? 1));
  q.set("pageSize", String(params.pageSize ?? 25));
  const res = await api.get<Paginated<StockBatchDto>>(`/stockops/batches?${q.toString()}`);
  return res.data;
}

export async function getExpiringBatches(days = 7): Promise<StockBatchDto[]> {
  const res = await api.get<StockBatchDto[]>(`/stockops/batches/expiring?days=${days}`);
  return res.data ?? [];
}

export async function getExpiredBatches(): Promise<StockBatchDto[]> {
  const res = await api.get<StockBatchDto[]>("/stockops/batches/expired");
  return res.data ?? [];
}

export async function receiveBatch(dto: StockBatchCreateDto): Promise<StockBatchDto> {
  const res = await api.post<BaseResponse<StockBatchDto>>("/stockops/batches/receive", dto);
  return unwrap(res.data);
}

export async function updateBatch(id: number, dto: StockBatchUpdateDto): Promise<StockBatchDto> {
  const res = await api.put<BaseResponse<StockBatchDto>>(`/stockops/batches/${id}`, dto);
  return unwrap(res.data);
}

export async function deleteBatch(id: number): Promise<void> {
  await api.delete(`/stockops/batches/${id}`);
}

export async function writeOffBatch(id: number, notes?: string): Promise<StockBatchDto> {
  const res = await api.post<BaseResponse<StockBatchDto>>(`/stockops/batches/${id}/write-off`, { notes: notes || null });
  return unwrap(res.data);
}

// ─── API: branch positions (phase 3) ──────────────────────────────────────
/** ?branchId= wins, else the X-Branch-Id header api.ts attaches, else the shared scope. */
export async function getBranchPosition(branchId?: number | null): Promise<BranchStockPositionDto> {
  const q = branchId && branchId > 0 ? `?branchId=${branchId}` : "";
  const res = await api.get<BranchStockPositionDto>(`/stockops/branch-position${q}`);
  return res.data;
}

/** Admin: every branch side by side. */
export async function getPositions(): Promise<StockPositionsDto> {
  const res = await api.get<StockPositionsDto>("/stockops/positions");
  return res.data;
}

/** Moves a purchase's quantities from Main to a location (posted transfer "PO-{purchaseId}"); idempotent. */
export async function receiveToLocation(purchaseId: number, locationId: number, notes?: string | null): Promise<BaseResponse<ReceiveToLocationResultDto>> {
  const res = await api.post<BaseResponse<ReceiveToLocationResultDto>>("/stockops/receive-to-location", {
    purchaseId,
    locationId,
    notes: notes || null,
  });
  return res.data;
}

/** Existing /purchases list (read only), newest first. */
export async function getPurchases(params: { page?: number; pageSize?: number; search?: string } = {}): Promise<Paginated<PurchaseLite>> {
  const q = new URLSearchParams();
  q.set("page", String(params.page ?? 1));
  q.set("pageSize", String(params.pageSize ?? 50));
  if (params.search) q.set("search", params.search);
  const res = await api.get<Paginated<PurchaseLite>>(`/purchases?${q.toString()}`);
  return res.data;
}

export default {
  getIngredients,
  getSuppliers,
  getLocations,
  getDefaultLocation,
  getLocationStock,
  createLocation,
  updateLocation,
  deactivateLocation,
  getStockCounts,
  getStockCount,
  createStockCount,
  updateStockCountLines,
  postStockCount,
  cancelStockCount,
  getStockCountVariance,
  getTransfers,
  getTransfer,
  createTransfer,
  updateTransfer,
  postTransfer,
  cancelTransfer,
  getReorderSuggestions,
  buildPurchaseDraft,
  getReorderRules,
  createReorderRule,
  updateReorderRule,
  deleteReorderRule,
  getBatches,
  getExpiringBatches,
  getExpiredBatches,
  receiveBatch,
  updateBatch,
  deleteBatch,
  writeOffBatch,
  getBranchPosition,
  getPositions,
  receiveToLocation,
  getPurchases,
};
