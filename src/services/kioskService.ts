import api from "./api";
import type { BaseResponse, OrderLine } from "./deliveryService";
import { publicApi, publicError, type PublicMenuDto } from "./selfOrderService";

export type KioskDeviceDto = {
  id: number;
  name: string;
  token: string;
  isActive: boolean;
  lastSeenOn?: string | null;
  branchId?: number | null;
};
export type KioskDeviceUpsertDto = { name: string; isActive: boolean };

export type KioskOrderResultDto = {
  orderNumber: number;
  transactionId: number;
  total: number;
  deviceName: string;
  createdOn: string;
};

function unwrap<T>(r: BaseResponse<T>): T {
  if (!r.success || r.data === undefined || r.data === null) throw new Error(r.message || r.error || "Request failed");
  return r.data;
}

// ── Admin ────────────────────────────────────────────────────────────────
export async function getKioskDevices(): Promise<KioskDeviceDto[]> {
  const res = await api.get<KioskDeviceDto[]>(`/kiosk/devices`);
  return res.data;
}
export async function createKioskDevice(body: KioskDeviceUpsertDto): Promise<KioskDeviceDto> {
  const res = await api.post<BaseResponse<KioskDeviceDto>>(`/kiosk/devices`, body);
  return unwrap(res.data);
}
export async function updateKioskDevice(id: number, body: KioskDeviceUpsertDto): Promise<KioskDeviceDto> {
  const res = await api.put<BaseResponse<KioskDeviceDto>>(`/kiosk/devices/${id}`, body);
  return unwrap(res.data);
}
export async function rotateKioskToken(id: number): Promise<KioskDeviceDto> {
  const res = await api.post<BaseResponse<KioskDeviceDto>>(`/kiosk/devices/${id}/rotate-token`);
  return unwrap(res.data);
}
export async function deleteKioskDevice(id: number): Promise<void> {
  await api.delete(`/kiosk/devices/${id}`);
}

// ── Public (kiosk screen, X-Kiosk-Token) ─────────────────────────────────
const TOKEN_HEADER = "X-Kiosk-Token";

export async function getKioskMenu(token: string): Promise<PublicMenuDto> {
  try {
    const res = await publicApi.get<BaseResponse<PublicMenuDto>>(`/kiosk/menu`, { headers: { [TOKEN_HEADER]: token } });
    return unwrap(res.data);
  } catch (e) {
    throw publicError(e);
  }
}
export async function placeKioskOrder(token: string, items: OrderLine[], customerName?: string | null, note?: string | null): Promise<KioskOrderResultDto> {
  try {
    const res = await publicApi.post<BaseResponse<KioskOrderResultDto>>(
      `/kiosk/order`,
      { items, customerName: customerName ?? null, note: note ?? null },
      { headers: { [TOKEN_HEADER]: token } }
    );
    return unwrap(res.data);
  } catch (e) {
    throw publicError(e);
  }
}

export default { getKioskDevices, createKioskDevice, updateKioskDevice, rotateKioskToken, deleteKioskDevice, getKioskMenu, placeKioskOrder };
