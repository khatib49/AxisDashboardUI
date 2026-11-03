import api from "./api";

// ── Shared ───────────────────────────────────────────────────────────────
export type BaseResponse<T> = {
  success: boolean;
  error?: string | null;
  message: string;
  data?: T | null;
};

export type OrderLine = { itemId: number; quantity: number };

// ── Zones / drivers ──────────────────────────────────────────────────────
export type DeliveryZoneDto = {
  id: number;
  name: string;
  fee: number;
  minOrder: number;
  etaMinutes: number;
  isActive: boolean;
  branchId?: number | null;
};
export type DeliveryZoneUpsertDto = {
  name: string;
  fee: number;
  minOrder: number;
  etaMinutes: number;
  isActive: boolean;
};

export type DriverDto = {
  id: number;
  name: string;
  phone?: string | null;
  vehicleNote?: string | null;
  userId?: number | null;
  isActive: boolean;
  branchId?: number | null;
};
export type DriverUpsertDto = {
  name: string;
  phone?: string | null;
  vehicleNote?: string | null;
  userId?: number | null;
  isActive: boolean;
};

// ── Orders ───────────────────────────────────────────────────────────────
export type DeliveryOrderType = "Delivery" | "Takeaway";
export type DeliveryStatus =
  | "Pending"
  | "Preparing"
  | "Ready"
  | "OutForDelivery"
  | "Delivered"
  | "Cancelled";

export const DELIVERY_STATUSES: DeliveryStatus[] = [
  "Pending",
  "Preparing",
  "Ready",
  "OutForDelivery",
  "Delivered",
  "Cancelled",
];

export type DeliveryOrderLineDto = {
  itemId: number;
  itemName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type DeliveryStatusEventDto = {
  id: number;
  fromStatus?: string | null;
  toStatus: string;
  on: string;
  by: string;
  note?: string | null;
};

export type DeliveryOrderDto = {
  id: number;
  transactionId: number;
  type: DeliveryOrderType;
  zoneId?: number | null;
  zoneName?: string | null;
  driverId?: number | null;
  driverName?: string | null;
  customerName: string;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  deliveryFee: number;
  subtotal: number;
  total: number;
  status: DeliveryStatus;
  scheduledFor?: string | null;
  createdOn: string;
  createdBy: string;
  assignedOn?: string | null;
  pickedUpOn?: string | null;
  deliveredOn?: string | null;
  cancelledReason?: string | null;
  externalSource?: string | null;
  externalRef?: string | null;
  channelId?: number | null;
  channelName?: string | null;
  invoicePaid: boolean;
  items: DeliveryOrderLineDto[];
  events: DeliveryStatusEventDto[];
};

export type DeliveryOrderCreateDto = {
  type: DeliveryOrderType;
  customerName: string;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  items: OrderLine[];
  zoneId?: number | null;
  channelId?: number | null;
  discountId?: number;
  scheduledFor?: string | null;
  userId?: number | null;
};

export type DeliveryBoardDto = {
  columns: { status: DeliveryStatus; orders: DeliveryOrderDto[] }[];
  generatedOn: string;
};

export type DeliveryTodayStatsDto = {
  day: string;
  total: number;
  pending: number;
  preparing: number;
  ready: number;
  outForDelivery: number;
  delivered: number;
  cancelled: number;
  deliveryCount: number;
  takeawayCount: number;
  revenue: number;
  fees: number;
  avgMinutesToDelivered?: number | null;
};

export type ChannelDto = {
  id: number;
  name: string;
  description?: string | null;
  isActive: boolean;
};

/** Allowed next statuses, mirrored from the backend DeliveryStatusRules. */
export function allowedNext(type: DeliveryOrderType, from: DeliveryStatus): DeliveryStatus[] {
  switch (from) {
    case "Pending":
      return ["Preparing", "Ready"];
    case "Preparing":
      return ["Ready"];
    case "Ready":
      return type === "Takeaway" ? ["Delivered"] : ["OutForDelivery"];
    case "OutForDelivery":
      return type === "Takeaway" ? [] : ["Delivered"];
    default:
      return [];
  }
}

export function isTerminal(status: DeliveryStatus): boolean {
  return status === "Delivered" || status === "Cancelled";
}

function unwrap<T>(r: BaseResponse<T>): T {
  if (!r.success || r.data === undefined || r.data === null) {
    throw new Error(r.message || r.error || "Request failed");
  }
  return r.data;
}

// ── Zones ────────────────────────────────────────────────────────────────
export async function getZones(includeInactive = false): Promise<DeliveryZoneDto[]> {
  const res = await api.get<DeliveryZoneDto[]>(`/delivery/zones?includeInactive=${includeInactive}`);
  return res.data;
}
export async function createZone(body: DeliveryZoneUpsertDto): Promise<DeliveryZoneDto> {
  const res = await api.post<BaseResponse<DeliveryZoneDto>>(`/delivery/zones`, body);
  return unwrap(res.data);
}
export async function updateZone(id: number, body: DeliveryZoneUpsertDto): Promise<DeliveryZoneDto> {
  const res = await api.put<BaseResponse<DeliveryZoneDto>>(`/delivery/zones/${id}`, body);
  return unwrap(res.data);
}
export async function deleteZone(id: number): Promise<void> {
  await api.delete(`/delivery/zones/${id}`);
}

// ── Drivers ──────────────────────────────────────────────────────────────
export async function getDrivers(includeInactive = false): Promise<DriverDto[]> {
  const res = await api.get<DriverDto[]>(`/delivery/drivers?includeInactive=${includeInactive}`);
  return res.data;
}
export async function createDriver(body: DriverUpsertDto): Promise<DriverDto> {
  const res = await api.post<BaseResponse<DriverDto>>(`/delivery/drivers`, body);
  return unwrap(res.data);
}
export async function updateDriver(id: number, body: DriverUpsertDto): Promise<DriverDto> {
  const res = await api.put<BaseResponse<DriverDto>>(`/delivery/drivers/${id}`, body);
  return unwrap(res.data);
}
export async function deleteDriver(id: number): Promise<void> {
  await api.delete(`/delivery/drivers/${id}`);
}

// ── Orders ───────────────────────────────────────────────────────────────
export async function createDeliveryOrder(body: DeliveryOrderCreateDto): Promise<DeliveryOrderDto> {
  const res = await api.post<BaseResponse<DeliveryOrderDto>>(`/delivery/orders`, body);
  return unwrap(res.data);
}
export async function getDeliveryBoard(): Promise<DeliveryBoardDto> {
  const res = await api.get<DeliveryBoardDto>(`/delivery/orders/board`);
  return res.data;
}
export async function getDeliveryOrder(id: number): Promise<DeliveryOrderDto> {
  const res = await api.get<DeliveryOrderDto>(`/delivery/orders/${id}`);
  return res.data;
}
export async function assignDriver(id: number, driverId: number): Promise<DeliveryOrderDto> {
  const res = await api.post<BaseResponse<DeliveryOrderDto>>(`/delivery/orders/${id}/assign`, { driverId });
  return unwrap(res.data);
}
export async function advanceOrder(id: number, toStatus?: DeliveryStatus | null, note?: string | null): Promise<DeliveryOrderDto> {
  const res = await api.post<BaseResponse<DeliveryOrderDto>>(`/delivery/orders/${id}/advance`, {
    toStatus: toStatus ?? null,
    note: note ?? null,
  });
  return unwrap(res.data);
}
export async function cancelOrder(id: number, reason?: string | null): Promise<DeliveryOrderDto> {
  const res = await api.post<BaseResponse<DeliveryOrderDto>>(`/delivery/orders/${id}/cancel`, { reason: reason ?? null });
  return unwrap(res.data);
}
export async function getMyDeliveries(): Promise<DeliveryOrderDto[]> {
  const res = await api.get<DeliveryOrderDto[]>(`/delivery/orders/mine`);
  return res.data;
}
export async function getTodayStats(): Promise<DeliveryTodayStatsDto> {
  const res = await api.get<DeliveryTodayStatsDto>(`/delivery/orders/stats/today`);
  return res.data;
}

/** Existing sales channels (Toters, Phone...) for the order form. */
export async function getChannels(): Promise<ChannelDto[]> {
  const res = await api.get<ChannelDto[]>(`/channel`);
  return Array.isArray(res.data) ? res.data : [];
}

export default {
  getZones, createZone, updateZone, deleteZone,
  getDrivers, createDriver, updateDriver, deleteDriver,
  createDeliveryOrder, getDeliveryBoard, getDeliveryOrder, assignDriver, advanceOrder, cancelOrder,
  getMyDeliveries, getTodayStats, getChannels,
};
