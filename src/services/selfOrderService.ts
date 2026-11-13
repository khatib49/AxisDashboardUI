import axios from "axios";
import api from "./api";
import type { BaseResponse, DeliveryOrderLineDto, OrderLine } from "./deliveryService";

/**
 * Anonymous client for the guest-facing pages (QR self-order, kiosk).
 * Deliberately NOT the shared `api` instance: that one attaches the staff
 * bearer token and redirects to /signin on 401/403, which must never happen
 * on a guest's phone.
 */
export const publicApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  timeout: 20000,
  headers: { "Content-Type": "application/json", Accept: "application/json" },
});

/** Turns an axios failure (or a BaseResponse with success=false) into an Error with a readable message. */
export function publicError(e: unknown): Error {
  if (axios.isAxiosError(e)) {
    const data = e.response?.data as { message?: string; error?: string } | undefined;
    if (e.response?.status === 429) return new Error("Too many requests, please wait a moment.");
    if (data?.message) return new Error(data.message);
    if (!e.response) return new Error("Cannot reach the server. Check your connection.");
    return new Error(`Request failed (${e.response.status})`);
  }
  if (e instanceof Error) return e;
  return new Error("Something went wrong");
}

function unwrap<T>(r: BaseResponse<T>): T {
  if (!r.success || r.data === undefined || r.data === null) throw new Error(r.message || r.error || "Request failed");
  return r.data;
}

// ── Types ────────────────────────────────────────────────────────────────
export type SelfOrderTableDto = {
  id: number;
  code: string;
  label: string;
  isActive: boolean;
  branchId?: number | null;
};
export type SelfOrderTableUpsertDto = { code: string; label: string; isActive: boolean };
export type SelfOrderTableQrDto = SelfOrderTableDto & { publicUrl: string; qrPayload: string };

export type MenuItemDto = {
  id: number;
  name: string;
  price: number;
  available: boolean;
  type: string;
  imagePath?: string | null;
};
export type MenuCategoryDto = { id: number; name: string; items: MenuItemDto[] };
export type PublicMenuDto = { tableCode: string; tableLabel: string; categories: MenuCategoryDto[] };

export type SelfOrderSessionStartedDto = {
  token: string;
  tableCode: string;
  tableLabel: string;
  status: string;
  createdOn: string;
};
export type SelfOrderSessionStatusDto = {
  token: string;
  tableCode: string;
  status: "Open" | "Submitted" | "Closed";
  transactionId?: number | null;
  invoicePaid: boolean;
  total: number;
  items: DeliveryOrderLineDto[];
  guestNote?: string | null;
  createdOn: string;
  lastActivityOn: string;
};

// ── Admin (staff token) ──────────────────────────────────────────────────
export async function getSelfOrderTables(): Promise<SelfOrderTableDto[]> {
  const res = await api.get<SelfOrderTableDto[]>(`/selforder/tables`);
  return res.data;
}
export async function getSelfOrderTableQrs(baseUrl?: string): Promise<SelfOrderTableQrDto[]> {
  const q = baseUrl ? `?baseUrl=${encodeURIComponent(baseUrl)}` : "";
  const res = await api.get<SelfOrderTableQrDto[]>(`/selforder/tables/qr${q}`);
  return res.data;
}
export async function createSelfOrderTable(body: SelfOrderTableUpsertDto): Promise<SelfOrderTableDto> {
  const res = await api.post<BaseResponse<SelfOrderTableDto>>(`/selforder/tables`, body);
  return unwrap(res.data);
}
export async function updateSelfOrderTable(id: number, body: SelfOrderTableUpsertDto): Promise<SelfOrderTableDto> {
  const res = await api.put<BaseResponse<SelfOrderTableDto>>(`/selforder/tables/${id}`, body);
  return unwrap(res.data);
}
export async function deleteSelfOrderTable(id: number): Promise<void> {
  await api.delete(`/selforder/tables/${id}`);
}

// ── Public (guest phone) ─────────────────────────────────────────────────
export async function getSelfOrderMenu(tableCode: string): Promise<PublicMenuDto> {
  try {
    const res = await publicApi.get<BaseResponse<PublicMenuDto>>(`/selforder/menu/${encodeURIComponent(tableCode)}`);
    return unwrap(res.data);
  } catch (e) {
    throw publicError(e);
  }
}
export async function startSelfOrderSession(tableCode: string): Promise<SelfOrderSessionStartedDto> {
  try {
    const res = await publicApi.post<BaseResponse<SelfOrderSessionStartedDto>>(`/selforder/session/${encodeURIComponent(tableCode)}`);
    return unwrap(res.data);
  } catch (e) {
    throw publicError(e);
  }
}
export async function submitSelfOrder(token: string, items: OrderLine[], note?: string | null): Promise<SelfOrderSessionStatusDto> {
  try {
    const res = await publicApi.post<BaseResponse<SelfOrderSessionStatusDto>>(`/selforder/session/${token}/submit`, { items, note: note ?? null });
    return unwrap(res.data);
  } catch (e) {
    throw publicError(e);
  }
}
export async function getSelfOrderStatus(token: string): Promise<SelfOrderSessionStatusDto> {
  try {
    const res = await publicApi.get<BaseResponse<SelfOrderSessionStatusDto>>(`/selforder/session/${token}`);
    return unwrap(res.data);
  } catch (e) {
    throw publicError(e);
  }
}

export default {
  getSelfOrderTables, getSelfOrderTableQrs, createSelfOrderTable, updateSelfOrderTable, deleteSelfOrderTable,
  getSelfOrderMenu, startSelfOrderSession, submitSelfOrder, getSelfOrderStatus,
};
