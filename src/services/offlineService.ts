import api from "./api";
import type { CategoryDto } from "./categoryService";
import type { DiscountDto } from "./discountService";

// ---- Sync (POST /api/offline/sync) ----

export type OfflineOpType =
  | "CreateCoffeeShopOrder"
  | "AddItemsToOpenInvoice"
  | "CloseOpenInvoice"
  | "CreateGameSession"
  | "CloseGameSession";

/** Op types that create an invoice; their queued op carries a negative tempId. */
export const OFFLINE_CREATE_OP_TYPES: readonly OfflineOpType[] = ["CreateCoffeeShopOrder", "CreateGameSession"];

export function isOfflineCreateOp(type: OfflineOpType | string): boolean {
  return (OFFLINE_CREATE_OP_TYPES as readonly string[]).includes(type);
}

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

// ---- game till members (phase 3) ----

/** Mirrors Application.DTOs.GameDto. */
export interface OfflineGameDto {
  id: number;
  name: string;
  categoryId: number;
  categoryName?: string | null;
  statusId?: number | null;
  status: string;
}

/** A room set with its status (10 = occupied by an ongoing session, 9 = free). */
export interface OfflineRoomSetDto {
  id: number;
  name: string;
  statusId?: number | null;
  status?: string | null;
}

export interface OfflineRoomDto {
  id: number;
  name: string;
  categoryId?: number | null;
  categoryName?: string | null;
  isOpenSet: boolean;
  sets: OfflineRoomSetDto[];
}

/** Mirrors Application.DTOs.SettingDto (active settings only). */
export interface OfflineGameSettingDto {
  id: number;
  name: string;
  type: string;
  gameId: number;
  gameName: string;
  hours: number;
  price: number;
  isOffer: boolean;
  isOpenHour: boolean;
  isDayPass: boolean;
  isActive: boolean;
  isEvent?: boolean;
}

export interface OfflinePassTypeDto {
  id: number;
  name: string;
  durationInMinutes: number;
  price: number;
  gameId: number;
}

export interface OfflineSnapshotDto {
  version: string;
  serverTime: string;
  categories: CategoryDto[];
  items: OfflineItemDto[];
  discounts: DiscountDto[];
  channels: OfflineChannelDto[];
  /** Present since phase 3; optional so a snapshot cached by an older build still parses. */
  games?: OfflineGameDto[] | null;
  rooms?: OfflineRoomDto[] | null;
  gameSettings?: OfflineGameSettingDto[] | null;
  passTypes?: OfflinePassTypeDto[] | null;
}

export async function fetchOfflineSnapshot(): Promise<OfflineSnapshotDto> {
  const res = await api.get<OfflineSnapshotDto>("/offline/snapshot");
  return res.data;
}
