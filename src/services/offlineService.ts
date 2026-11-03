import api from "./api";
import type { CategoryDto } from "./categoryService";
import type { DiscountDto } from "./discountService";

// ---- Sync (POST /api/offline/sync) ----

export type OfflineOpType =
  | "CreateCoffeeShopOrder"
  | "AddItemsToOpenInvoice"
  | "CloseOpenInvoice";

export type OfflineOpOutcome = "ok" | "replayed" | "failed" | "conflict";

export interface OfflineOpRequest {
  opId: string;
  type: OfflineOpType;
  payload: unknown;
  queuedAt: string;
}

export interface OfflineSyncRequest {
  clientId: string;
  ops: OfflineOpRequest[];
}

export interface OfflineOpResult {
  opId: string;
  status: number;
  outcome: OfflineOpOutcome;
  result?: unknown;
  error?: string | null;
}

export interface OfflineSyncResponse {
  clientId: string;
  batchId: number;
  serverTime: string;
  results: OfflineOpResult[];
}

export async function syncOfflineOps(body: OfflineSyncRequest): Promise<OfflineSyncResponse> {
  const res = await api.post<OfflineSyncResponse>("/offline/sync", body);
  return res.data;
}

// ---- Snapshot (GET /api/offline/snapshot) ----

export interface OfflineChannelDto {
  id: number;
  name: string;
  description?: string | null;
  isActive: boolean;
}

/** Mirrors Application.DTOs.ItemDto (numeric ids, add-ons and variants included). */
export interface OfflineItemAddOnDto {
  id: number;
  name: string;
  price: number;
  isActive: boolean;
  sortOrder: number;
}

export interface OfflineItemVariantDto {
  id: number;
  name: string;
  color?: string | null;
  sku?: string | null;
  priceDelta: number;
  quantity: number;
  isActive: boolean;
  sortOrder: number;
}

export interface OfflineItemDto {
  id: number;
  name: string;
  quantity: number;
  price: number;
  type: string;
  categoryId: number;
  statusId?: number | null;
  imagePath?: string | null;
  buyPrice?: number | null;
  addOns?: OfflineItemAddOnDto[] | null;
  variants?: OfflineItemVariantDto[] | null;
  sellOnline?: boolean;
  weightKg?: number | null;
}

export interface OfflineSnapshotDto {
  version: string;
  serverTime: string;
  categories: CategoryDto[];
  items: OfflineItemDto[];
  discounts: DiscountDto[];
  channels: OfflineChannelDto[];
}

export async function fetchOfflineSnapshot(): Promise<OfflineSnapshotDto> {
  const res = await api.get<OfflineSnapshotDto>("/offline/snapshot");
  return res.data;
}
