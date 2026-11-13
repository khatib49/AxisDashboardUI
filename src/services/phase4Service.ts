import api from "./api";
import { publicApi, publicError } from "./selfOrderService";
import type { BaseResponse } from "./deliveryService";

function unwrap<T>(r: BaseResponse<T>): T {
  if (!r.success || r.data === undefined || r.data === null) throw new Error(r.message || r.error || "Request failed");
  return r.data;
}

/** Axios error → readable Error (server message when there is one). */
export function apiError(e: unknown): Error {
  const err = e as { response?: { status?: number; data?: { message?: string; error?: string; title?: string } }; message?: string };
  const d = err?.response?.data;
  if (err?.response?.status === 403) return new Error("You do not have permission for this action.");
  return new Error(d?.message || d?.title || d?.error || err?.message || "Request failed");
}

async function call<T>(p: Promise<{ data: T }>): Promise<T> {
  try { return (await p).data; } catch (e) { throw apiError(e); }
}

async function callBase<T>(p: Promise<{ data: BaseResponse<T> }>): Promise<T> {
  try { return unwrap((await p).data); } catch (e) {
    const data = (e as { response?: { data?: BaseResponse<T> } })?.response?.data;
    if (data && typeof data === "object" && "success" in data) throw new Error(data.message || data.error || "Request failed");
    if (e instanceof Error && !(e as { response?: unknown }).response) throw e;
    throw apiError(e);
  }
}

/** Absolute URL for a file stored on the API host (same rule as item images). */
export function assetUrl(path?: string | null): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const base = ((import.meta.env.VITE_API_IMAGE_BASE_URL as string) || "").replace(/\/$/, "");
  return `${base}/${path.replace(/^\//, "")}`;
}

// ── 3D menu ───────────────────────────────────────────────────────────
export type ItemModel3DDto = {
  id: number; itemId: number; itemName: string; glbPath: string; usdzPath?: string | null; posterPath?: string | null;
  glbBytes: number; isActive: boolean; updatedOn?: string | null; updatedBy: string;
};
export type PublicItemModelDto = { itemId: number; glbPath: string; usdzPath?: string | null; posterPath?: string | null };

export const listItemModels = () => call<ItemModel3DDto[]>(api.get("/menu-3d"));
export async function listPublicItemModels(): Promise<PublicItemModelDto[]> {
  try { return (await publicApi.get<PublicItemModelDto[]>("/menu-3d/public")).data; } catch (e) { throw publicError(e); }
}
export function uploadItemModel(itemId: number, files: { glb?: File | null; usdz?: File | null; poster?: File | null }) {
  const fd = new FormData();
  if (files.glb) fd.append("glb", files.glb);
  if (files.usdz) fd.append("usdz", files.usdz);
  if (files.poster) fd.append("poster", files.poster);
  return callBase<ItemModel3DDto>(api.post(`/menu-3d/${itemId}`, fd, { headers: { "Content-Type": "multipart/form-data" }, timeout: 300000 }));
}
export const setItemModelActive = (itemId: number, value: boolean) => callBase<ItemModel3DDto>(api.put(`/menu-3d/${itemId}/active`, null, { params: { value } }));
export const deleteItemModel = (itemId: number) => call(api.delete(`/menu-3d/${itemId}`));

// ── Upsells ───────────────────────────────────────────────────────────
export type UpsellChannel = "Till" | "Waiter" | "Shop" | "SelfOrder" | "Kiosk";
export type UpsellSuggestionDto = {
  itemId: number; name: string; price: number; imagePath?: string | null; categoryName?: string | null;
  reason: string; message?: string | null; source: "Rule" | "Learned";
};
export type UpsellRuleDto = {
  id: number; triggerItemId?: number | null; triggerItemName?: string | null; triggerCategoryId?: number | null; triggerCategoryName?: string | null;
  suggestItemId: number; suggestItemName: string; message?: string | null; priority: number; isActive: boolean;
};
export type UpsellRuleUpsertDto = { triggerItemId?: number | null; triggerCategoryId?: number | null; suggestItemId: number; message?: string | null; priority: number; isActive: boolean };
export type UpsellPairDto = { itemId: number; itemName: string; suggestItemId: number; suggestItemName: string; pairCount: number; confidence: number; lift: number; pitch?: string | null; computedOn: string };
export type UpsellRebuildResultDto = { invoicesScanned: number; pairsKept: number; pitchesWritten: number; computedOn: string; aiNote?: string | null };
export type UpsellStatRow = { shown: number; accepted: number; acceptRate: number; acceptedRevenue: number };
export type UpsellStatsDto = UpsellStatRow & { days: number; byChannel: (UpsellStatRow & { channel: string })[]; byItem: (UpsellStatRow & { suggestItemId: number; name: string })[] };

const PUBLIC_CHANNELS: UpsellChannel[] = ["Shop", "SelfOrder", "Kiosk"];

export async function suggestUpsells(itemIds: number[], channel: UpsellChannel, limit = 3): Promise<UpsellSuggestionDto[]> {
  const body = { itemIds, channel, limit };
  if (PUBLIC_CHANNELS.includes(channel)) {
    try { return (await publicApi.post<UpsellSuggestionDto[]>("/upsell/suggest-public", body)).data; } catch (e) { throw publicError(e); }
  }
  return call<UpsellSuggestionDto[]>(api.post("/upsell/suggest", body));
}
/** Fire-and-forget: tracking must never break ordering. */
export function logUpsell(channel: UpsellChannel, action: "Shown" | "Accepted", s: UpsellSuggestionDto): void {
  const body = { channel, action, suggestItemId: s.itemId, source: s.source };
  const p = PUBLIC_CHANNELS.includes(channel) ? publicApi.post("/upsell/events-public", body) : api.post("/upsell/events", body);
  p.catch(() => undefined);
}
export const listUpsellRules = () => call<UpsellRuleDto[]>(api.get("/upsell/rules"));
export const createUpsellRule = (d: UpsellRuleUpsertDto) => callBase<UpsellRuleDto>(api.post("/upsell/rules", d));
export const updateUpsellRule = (id: number, d: UpsellRuleUpsertDto) => callBase<UpsellRuleDto>(api.put(`/upsell/rules/${id}`, d));
export const deleteUpsellRule = (id: number) => call(api.delete(`/upsell/rules/${id}`));
export const listUpsellPairs = (itemId?: number) => call<UpsellPairDto[]>(api.get("/upsell/pairs", { params: { itemId, take: 200 } }));
export const rebuildUpsells = (days = 90) => call<UpsellRebuildResultDto>(api.post("/upsell/rebuild", null, { params: { days }, timeout: 180000 }));
export const getUpsellStats = (days = 30) => call<UpsellStatsDto>(api.get("/upsell/stats", { params: { days } }));

// ── Delivery apps ─────────────────────────────────────────────────────
export type DeliveryPlatformDto = {
  id: number; source: string; displayName: string; isActive: boolean; statusCallbackUrl?: string | null;
  priceMarkupPercent: number; autoAccept: boolean; mappedItemsOnly: boolean; secretConfigured: boolean;
  webhookPath: string; menuFeedPath: string; mappedItems: number; pendingPushes: number; failedPushes: number;
};
export type DeliveryPlatformUpsertDto = { source: string; displayName: string; isActive: boolean; statusCallbackUrl?: string | null; priceMarkupPercent: number; autoAccept: boolean; mappedItemsOnly: boolean };
export type DeliveryItemMappingDto = { id: number; platformId: number; externalItemId: string; itemId: number; itemName: string; itemPrice: number; priceOverride?: number | null; isAvailable: boolean };
export type DeliveryMenuFeedDto = { source: string; currency: string; generatedOn: string; categories: { id: number; name: string; items: { externalId: string; itemId: number; name: string; price: number; available: boolean; imageUrl?: string | null }[] }[] };
export type DeliveryPlatformPushDto = { id: number; deliveryOrderId: number; externalRef: string; status: string; platformStatus: string; state: "Pending" | "Sent" | "Failed"; attempts: number; lastHttpStatus?: number | null; lastError?: string | null; createdOn: string; sentOn?: string | null; nextAttemptOn?: string | null };

export const listDeliveryPlatforms = () => call<DeliveryPlatformDto[]>(api.get("/delivery/platforms"));
export const createDeliveryPlatform = (d: DeliveryPlatformUpsertDto) => callBase<DeliveryPlatformDto>(api.post("/delivery/platforms", d));
export const updateDeliveryPlatform = (id: number, d: DeliveryPlatformUpsertDto) => callBase<DeliveryPlatformDto>(api.put(`/delivery/platforms/${id}`, d));
export const deleteDeliveryPlatform = (id: number) => call(api.delete(`/delivery/platforms/${id}`));
export const listPlatformMappings = (id: number) => call<DeliveryItemMappingDto[]>(api.get(`/delivery/platforms/${id}/mappings`));
export const upsertPlatformMapping = (id: number, d: { externalItemId: string; itemId: number; priceOverride?: number | null; isAvailable: boolean }) =>
  callBase<DeliveryItemMappingDto>(api.put(`/delivery/platforms/${id}/mappings`, d));
export const deletePlatformMapping = (id: number, mappingId: number) => call(api.delete(`/delivery/platforms/${id}/mappings/${mappingId}`));
export const previewPlatformMenu = (id: number) => call<DeliveryMenuFeedDto>(api.get(`/delivery/platforms/${id}/menu-preview`));
export const listPlatformPushes = (id: number) => call<DeliveryPlatformPushDto[]>(api.get(`/delivery/platforms/${id}/pushes`, { params: { take: 50 } }));
export const retryPlatformPush = (id: number, pushId: number) => call(api.post(`/delivery/platforms/${id}/pushes/${pushId}/retry`));
export const testPlatformCallback = (id: number) => call<{ success: boolean; httpStatus?: number | null; message: string }>(api.post(`/delivery/platforms/${id}/test-callback`));
export const runPlatformPushes = () => call<{ enqueued: number; sent: number; failed: number; retrying: number }>(api.post("/delivery/platforms/run-pushes"));

// ── Card terminals ────────────────────────────────────────────────────
export type CardTerminalProvider = "Manual" | "CloudHttp" | "Simulator";
export type CardTerminalDto = { id: number; name: string; provider: CardTerminalProvider; providerTerminalId?: string | null; branchId?: number | null; isActive: boolean; busy: boolean };
export type CardTerminalUpsertDto = { name: string; provider: CardTerminalProvider; providerTerminalId?: string | null; branchId?: number | null; isActive: boolean };
export type TerminalPaymentStatus = "Pending" | "Approved" | "Declined" | "Cancelled" | "Expired" | "Failed";
export type TerminalPaymentDto = {
  id: number; transactionId: number; terminalId: number; terminalName: string; provider: CardTerminalProvider; amount: number; currency: string;
  externalId: string; status: TerminalPaymentStatus; approvalCode?: string | null; cardLast4?: string | null; cardScheme?: string | null; rrn?: string | null;
  message?: string | null; createdOn: string; createdBy: string; completedOn?: string | null; invoiceClosed: boolean;
};
export type TerminalReportDto = {
  from: string; to: string; approved: number; approvedAmount: number; declined: number; cancelled: number;
  byTerminal: { terminalId: number; terminalName: string; approved: number; approvedAmount: number; declined: number }[];
  byScheme: { scheme: string; count: number; amount: number }[];
  payments: TerminalPaymentDto[];
};

export const listCardTerminals = (includeInactive = false) => call<CardTerminalDto[]>(api.get("/payments/terminals", { params: { includeInactive } }));
export const createCardTerminal = (d: CardTerminalUpsertDto) => callBase<CardTerminalDto>(api.post("/payments/terminals", d));
export const updateCardTerminal = (id: number, d: CardTerminalUpsertDto) => callBase<CardTerminalDto>(api.put(`/payments/terminals/${id}`, d));
export async function deleteCardTerminal(id: number): Promise<string> {
  try { return (await api.delete<BaseResponse<boolean>>(`/payments/terminals/${id}`)).data.message; } catch (e) { throw apiError(e); }
}
export const startTerminalPayment = (transactionId: number, terminalId: number, amount?: number) =>
  callBase<TerminalPaymentDto>(api.post("/payments/terminal/start", { transactionId, terminalId, amount }, { timeout: 30000 }));
export const checkTerminalPayment = (id: number) => callBase<TerminalPaymentDto>(api.get(`/payments/terminal/${id}`));
export const confirmManualTerminalPayment = (id: number, approvalCode: string, cardLast4?: string, cardScheme?: string) =>
  callBase<TerminalPaymentDto>(api.post(`/payments/terminal/${id}/confirm-manual`, { approvalCode, cardLast4: cardLast4 || null, cardScheme: cardScheme || null }));
export const cancelTerminalPayment = (id: number) => callBase<TerminalPaymentDto>(api.post(`/payments/terminal/${id}/cancel`));
export const getTerminalReport = (from: string, to: string, terminalId?: number) => call<TerminalReportDto>(api.get("/payments/terminal/report", { params: { from, to, terminalId } }));
