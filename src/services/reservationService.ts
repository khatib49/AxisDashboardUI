import api from "./api";
import type { BaseResponse } from "./floorService";

export type ReservationStatus = "Pending" | "Confirmed" | "Seated" | "NoShow" | "Cancelled" | "Completed";
export type ResourceType = "Table" | "Room" | "Console";
export type ReservationSource = "Phone" | "WalkIn" | "Online";

export type ReservationDto = {
  id: number;
  customerName: string;
  phone: string;
  userId?: number | null;
  resourceType: ResourceType | string;
  tableId?: number | null;
  tableCode?: string | null;
  roomId?: number | null;
  gameId?: number | null;
  resourceName?: string | null;
  startOn: string;
  endOn: string;
  partySize: number;
  status: ReservationStatus | string;
  notes?: string | null;
  source: ReservationSource | string;
  createdOn: string;
  createdBy: string;
  confirmedOn?: string | null;
  seatedTransactionId?: number | null;
  branchId?: number | null;
};

export type ReservationUpsertDto = {
  customerName: string;
  phone: string;
  resourceType: ResourceType;
  startOn: string;
  endOn: string;
  partySize: number;
  tableId?: number | null;
  roomId?: number | null;
  gameId?: number | null;
  userId?: number | null;
  notes?: string | null;
  source: ReservationSource;
  confirmNow?: boolean;
};

export type PublicReservationRequestDto = {
  customerName: string;
  phone: string;
  resourceType: ResourceType;
  startOn: string;
  endOn: string;
  partySize: number;
  tableId?: number | null;
  roomId?: number | null;
  gameId?: number | null;
  notes?: string | null;
};

export type ReservationListFilter = {
  from?: string;
  to?: string;
  status?: string;
  resourceType?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

export type PaginatedReservations = {
  totalCount: number;
  data: ReservationDto[];
  pageNumber: number;
  pageSize: number;
};

export type AvailabilityResultDto = { available: boolean; conflicts: ReservationDto[] };

export type ReservationBoardDto = {
  day: string;
  pending: number;
  confirmed: number;
  seated: number;
  noShow: number;
  cancelled: number;
  reservations: ReservationDto[];
};

export type PublicTableDto = { id: number; code: string; name: string; capacity: number; areaName: string };

const base = "/floor/reservations";

export async function listReservations(filter: ReservationListFilter = {}): Promise<PaginatedReservations> {
  const params = new URLSearchParams();
  Object.entries(filter).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") params.append(k.charAt(0).toUpperCase() + k.slice(1), String(v));
  });
  const res = await api.get<PaginatedReservations>(`${base}?${params.toString()}`);
  return res.data;
}

export async function getReservationBoard(date?: string): Promise<ReservationBoardDto> {
  const res = await api.get<ReservationBoardDto>(`${base}/today${date ? `?date=${encodeURIComponent(date)}` : ""}`);
  return res.data;
}

export async function getReservation(id: number): Promise<ReservationDto> {
  const res = await api.get<ReservationDto>(`${base}/${id}`);
  return res.data;
}

export async function checkAvailability(q: {
  resourceType: ResourceType;
  startOn: string;
  endOn: string;
  tableId?: number | null;
  roomId?: number | null;
  gameId?: number | null;
  excludeReservationId?: number | null;
}): Promise<AvailabilityResultDto> {
  const params = new URLSearchParams({ ResourceType: q.resourceType, StartOn: q.startOn, EndOn: q.endOn });
  if (q.tableId) params.append("TableId", String(q.tableId));
  if (q.roomId) params.append("RoomId", String(q.roomId));
  if (q.gameId) params.append("GameId", String(q.gameId));
  if (q.excludeReservationId) params.append("ExcludeReservationId", String(q.excludeReservationId));
  const res = await api.get<AvailabilityResultDto>(`${base}/availability?${params.toString()}`);
  return res.data;
}

export async function createReservation(dto: ReservationUpsertDto): Promise<BaseResponse<ReservationDto>> {
  const res = await api.post<BaseResponse<ReservationDto>>(base, dto);
  return res.data;
}
export async function updateReservation(id: number, dto: ReservationUpsertDto): Promise<BaseResponse<ReservationDto>> {
  const res = await api.put<BaseResponse<ReservationDto>>(`${base}/${id}`, dto);
  return res.data;
}
export async function deleteReservation(id: number): Promise<BaseResponse<boolean>> {
  const res = await api.delete<BaseResponse<boolean>>(`${base}/${id}`);
  return res.data;
}
export async function confirmReservation(id: number): Promise<BaseResponse<ReservationDto>> {
  const res = await api.post<BaseResponse<ReservationDto>>(`${base}/${id}/confirm`);
  return res.data;
}
export async function seatReservation(id: number, openTableSession = false, guestCount?: number): Promise<BaseResponse<ReservationDto>> {
  const res = await api.post<BaseResponse<ReservationDto>>(`${base}/${id}/seat`, { openTableSession, guestCount });
  return res.data;
}
export async function noShowReservation(id: number): Promise<BaseResponse<ReservationDto>> {
  const res = await api.post<BaseResponse<ReservationDto>>(`${base}/${id}/no-show`);
  return res.data;
}
export async function cancelReservation(id: number): Promise<BaseResponse<ReservationDto>> {
  const res = await api.post<BaseResponse<ReservationDto>>(`${base}/${id}/cancel`);
  return res.data;
}
export async function completeReservation(id: number): Promise<BaseResponse<ReservationDto>> {
  const res = await api.post<BaseResponse<ReservationDto>>(`${base}/${id}/complete`);
  return res.data;
}

// Public (no auth)
export async function submitPublicReservation(dto: PublicReservationRequestDto): Promise<BaseResponse<ReservationDto>> {
  const res = await api.post<BaseResponse<ReservationDto>>(`${base}/public`, dto);
  return res.data;
}
export async function getPublicTables(): Promise<PublicTableDto[]> {
  const res = await api.get<PublicTableDto[]>(`${base}/public/tables`);
  return res.data;
}

export default {
  listReservations, getReservationBoard, getReservation, checkAvailability,
  createReservation, updateReservation, deleteReservation,
  confirmReservation, seatReservation, noShowReservation, cancelReservation, completeReservation,
  submitPublicReservation, getPublicTables,
};
