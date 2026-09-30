// Shipping & Aramex — admin API (role admin).
// Settings snapshot, connection test, delivery zones CRUD, shipments list
// and actions, courier pickup booking and COD settlement to the ledger.
// Settings *values* are edited through integrationSettingsService.upsert.

import api from "./api";
import type { Shipment } from "./shopService";

export type { Shipment };

export type ShippingEnvironment = "sandbox" | "production";
export type RateMode = "zones" | "aramex" | "free";

export type ShippingSettings = {
  environment: ShippingEnvironment | string;
  sandboxConfigured: boolean;
  productionConfigured: boolean;
  rateMode: RateMode | string;
  deliveryEnabled: boolean;
  codEnabled: boolean;
  shopEnabled: boolean;
  productGroup?: string | null;
  productType?: string | null;
  paymentType?: string | null;
  codCurrency?: string | null;
  shipperCompany?: string | null;
  shipperPerson?: string | null;
  shipperPhone?: string | null;
  shipperCell?: string | null;
  shipperEmail?: string | null;
  shipperLine1?: string | null;
  shipperLine2?: string | null;
  shipperCity?: string | null;
  shipperCountry?: string | null;
  defaultWeightKg: number;
  trackingPollMinutes: number;
  sandboxUrl?: string | null;
  productionUrl?: string | null;
};

export type ShippingTestResult = { ok: boolean; message?: string | null; rateAmount?: number | null; rateCurrency?: string | null };

export type ShippingZone = {
  id: number;
  name: string;
  /** Comma-separated city names. */
  cities: string;
  fee: number;
  freeAbove?: number | null;
  estimatedDays?: string | null;
  sortOrder: number;
  isActive: boolean;
};
export type ShippingZoneInput = {
  name: string; cities: string; fee: number;
  freeAbove?: number | null; estimatedDays?: string | null; sortOrder?: number; isActive?: boolean;
};

export type ShipmentFilterStatus =
  | "" | "open" | "unsettled"
  | "Created" | "PickedUp" | "InTransit" | "OutForDelivery" | "Delivered" | "Returned" | "Failed" | "Cancelled";

export type ShipmentList = {
  openCount: number;
  deliveredUnsettledCount: number;
  codOutstanding: number;
  shipments: Shipment[];
};

export type PickupRequest = {
  pickupDate?: string | null;      // ISO date (yyyy-mm-dd)
  readyTime?: string | null;       // "HH:mm"
  lastPickupTime?: string | null;
  closingTime?: string | null;
  reference?: string | null;
  shipmentIds?: number[] | null;
};
export type PickupResult = {
  success: boolean;
  error?: string | null;
  pickupId?: string | null;
  pickupGuid?: string | null;
  shipmentsAttached: number;
};

export type CodSettlementRequest = {
  shipmentIds: number[];
  netReceived?: number | null;
  fees?: number | null;
  receivedInto: "cash" | "bank";
  reference?: string | null;
};
export type CodSettlementResult = {
  success: boolean;
  error?: string | null;
  journalEntryId?: number | null;
  codTotal: number;
  netReceived: number;
  fees: number;
  shipmentsSettled: number;
};

/** Error shape the API returns with 400 on shipment actions. */
export type ShipmentActionError = { error: string; shipment?: Shipment | null };

/** Pulls the API's `{ error }` text out of an axios rejection, if present. */
export function apiErrorMessage(e: unknown, fallback = "Request failed"): string {
  if (e && typeof e === "object") {
    const r = (e as { response?: { data?: unknown } }).response;
    const data = r?.data;
    if (data && typeof data === "object") {
      const err = (data as { error?: unknown }).error;
      if (typeof err === "string" && err) return err;
      const msg = (data as { message?: unknown }).message;
      if (typeof msg === "string" && msg) return msg;
    }
    if (typeof data === "string" && data) return data;
    const m = (e as { message?: unknown }).message;
    if (typeof m === "string" && m) return m;
  }
  return fallback;
}

// ── Settings & connection ─────────────────────────────────────────────────
export async function getShippingSettings(): Promise<ShippingSettings> {
  const res = await api.get<ShippingSettings>("/shipping/settings");
  return res.data;
}
export async function testAramex(): Promise<ShippingTestResult> {
  const res = await api.post<ShippingTestResult>("/shipping/test", null, { validateStatus: () => true });
  if (res.status >= 200 && res.status < 300) return res.data;
  const data = res.data as Partial<ShippingTestResult> | undefined;
  return { ok: false, message: data?.message ?? `HTTP ${res.status}` };
}

// ── Zones ─────────────────────────────────────────────────────────────────
export async function listZones(includeInactive = true): Promise<ShippingZone[]> {
  const res = await api.get<ShippingZone[]>("/shipping/zones", { params: { includeInactive } });
  return res.data;
}
export async function createZone(body: ShippingZoneInput): Promise<ShippingZone> {
  const res = await api.post<ShippingZone>("/shipping/zones", body);
  return res.data;
}
export async function updateZone(id: number, body: ShippingZoneInput): Promise<ShippingZone> {
  const res = await api.put<ShippingZone>(`/shipping/zones/${id}`, body);
  return res.data;
}
export async function deleteZone(id: number): Promise<void> {
  await api.delete(`/shipping/zones/${id}`);
}

// ── Shipments ─────────────────────────────────────────────────────────────
export async function listShipments(params?: { status?: ShipmentFilterStatus; from?: string; to?: string; search?: string }): Promise<ShipmentList> {
  const res = await api.get<ShipmentList>("/shipping/shipments", {
    params: {
      status: params?.status || undefined,
      from: params?.from || undefined,
      to: params?.to || undefined,
      search: params?.search || undefined,
    },
  });
  return res.data;
}
export async function refreshShipmentAdmin(id: number): Promise<Shipment> {
  const res = await api.post<Shipment>(`/shipping/shipments/${id}/refresh`);
  return res.data;
}
export async function markDeliveredAdmin(id: number): Promise<Shipment> {
  const res = await api.post<Shipment>(`/shipping/shipments/${id}/delivered`);
  return res.data;
}
export async function setShipmentStatusAdmin(id: number, status: "Returned" | "Cancelled" | "Failed", reason?: string): Promise<Shipment> {
  const res = await api.post<Shipment>(`/shipping/shipments/${id}/status`, { status, reason: reason ?? null });
  return res.data;
}
export async function pollShipments(): Promise<{ changed: number }> {
  const res = await api.post<{ changed: number }>("/shipping/shipments/poll");
  return res.data;
}
export async function bookPickup(body: PickupRequest): Promise<PickupResult> {
  const res = await api.post<PickupResult>("/shipping/shipments/pickup", body, { validateStatus: () => true });
  if (res.data && typeof res.data === "object") return res.data;
  return { success: false, error: `HTTP ${res.status}`, shipmentsAttached: 0 };
}
export async function settleCod(body: CodSettlementRequest): Promise<CodSettlementResult> {
  const res = await api.post<CodSettlementResult>("/shipping/cod/settle", body, { validateStatus: () => true });
  if (res.data && typeof res.data === "object") return res.data;
  return { success: false, error: `HTTP ${res.status}`, codTotal: 0, netReceived: 0, fees: 0, shipmentsSettled: 0 };
}

/** Badge colours per shipment status (Tailwind classes). */
export const SHIPMENT_STATUS_STYLE: Record<string, string> = {
  Created: "bg-gray-50 text-gray-600 border-gray-200",
  PickedUp: "bg-blue-50 text-blue-700 border-blue-200",
  InTransit: "bg-indigo-50 text-indigo-700 border-indigo-200",
  OutForDelivery: "bg-amber-50 text-amber-700 border-amber-200",
  Delivered: "bg-green-50 text-green-700 border-green-200",
  Returned: "bg-purple-50 text-purple-700 border-purple-200",
  Failed: "bg-red-50 text-red-700 border-red-200",
  Cancelled: "bg-gray-100 text-gray-500 border-gray-200",
};
export const SHIPMENT_STATUS_LABEL: Record<string, string> = {
  Created: "Created", PickedUp: "Picked up", InTransit: "In transit", OutForDelivery: "Out for delivery",
  Delivered: "Delivered", Returned: "Returned", Failed: "Failed", Cancelled: "Cancelled",
};
