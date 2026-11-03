import api from "./api";

// ── Shared ───────────────────────────────────────────────────────────
export type BaseResponse<T> = {
  success: boolean;
  error?: string | null;
  message: string;
  data?: T | null;
};

export type OrderItemRequest = {
  itemId: number;
  quantity: number;
};

// ── Areas & tables ───────────────────────────────────────────────────
export type FloorAreaDto = {
  id: number;
  name: string;
  sortOrder: number;
  isActive: boolean;
  branchId?: number | null;
  tableCount: number;
};
export type FloorAreaUpsertDto = { name: string; sortOrder: number; isActive: boolean };

export type DiningTableDto = {
  id: number;
  areaId: number;
  areaName: string;
  code: string;
  name: string;
  capacity: number;
  shape: "Rect" | "Round" | string;
  posX: number;
  posY: number;
  width: number;
  height: number;
  isActive: boolean;
  branchId?: number | null;
};
export type DiningTableUpsertDto = {
  areaId: number;
  code: string;
  name: string;
  capacity: number;
  shape: "Rect" | "Round";
  posX: number;
  posY: number;
  width: number;
  height: number;
  isActive: boolean;
};
export type TablePositionDto = { id: number; posX: number; posY: number; width: number; height: number };

// ── Layout / sessions ────────────────────────────────────────────────
export type OpenSessionSummaryDto = {
  sessionId: number;
  transactionId: number;
  total: number;
  guestCount: number;
  openedOn: string;
  openedMinutes: number;
  itemsCount: number;
  openedBy: string;
  notes?: string | null;
};
export type LayoutTableDto = {
  id: number;
  areaId: number;
  code: string;
  name: string;
  capacity: number;
  shape: string;
  posX: number;
  posY: number;
  width: number;
  height: number;
  isActive: boolean;
  openSession?: OpenSessionSummaryDto | null;
};
export type LayoutAreaDto = { id: number; name: string; sortOrder: number; tables: LayoutTableDto[] };
export type FloorLayoutDto = { areas: LayoutAreaDto[]; generatedOn: string };

export type TableSessionDto = {
  id: number;
  tableId: number;
  tableCode: string;
  tableName: string;
  transactionId: number;
  guestCount: number;
  openedOn: string;
  closedOn?: string | null;
  openedBy: string;
  status: "Open" | "Closed" | "Transferred" | "Merged" | string;
  notes?: string | null;
};
export type OpenTableRequestDto = {
  tableId: number;
  guestCount: number;
  userId?: number | null;
  notes?: string | null;
  items?: OrderItemRequest[] | null;
};
export type MergeResultDto = { targetTransactionId: number; sourceTransactionId: number; targetTotal: number; movedLines: number };

// ── Courses / splits / tips ──────────────────────────────────────────
export type OrderCourseDto = {
  id: number;
  transactionId: number;
  itemId: number;
  itemName: string;
  quantity: number;
  courseNumber: number;
  firedOn?: string | null;
  firedBy?: string | null;
};
export type BillSplitDto = {
  id: number;
  transactionId: number;
  splitNumber: number;
  amount: number;
  method: string;
  paidOn?: string | null;
  paidBy?: string | null;
  note?: string | null;
};
export type BillSplitListDto = {
  transactionId: number;
  totalPrice: number;
  splitTotal: number;
  paidTotal: number;
  remaining: number;
  splits: BillSplitDto[];
};
export type TipDto = {
  id: number;
  transactionId: number;
  amount: number;
  method: string;
  staffUserId?: number | null;
  staffName?: string | null;
  createdOn: string;
  createdBy: string;
};
export type DailyTipsReportDto = {
  day: string;
  total: number;
  count: number;
  byStaff: { staffUserId?: number | null; staffName: string; count: number; total: number }[];
};

export const PAYMENT_METHODS = ["Cash", "Card", "Wallet", "Other"] as const;

// ── Areas ────────────────────────────────────────────────────────────
export async function getAreas(includeInactive = false): Promise<FloorAreaDto[]> {
  const res = await api.get<FloorAreaDto[]>(`/floor/areas?includeInactive=${includeInactive}`);
  return res.data;
}
export async function createArea(dto: FloorAreaUpsertDto): Promise<FloorAreaDto> {
  const res = await api.post<FloorAreaDto>(`/floor/areas`, dto);
  return res.data;
}
export async function updateArea(id: number, dto: FloorAreaUpsertDto): Promise<BaseResponse<FloorAreaDto>> {
  const res = await api.put<BaseResponse<FloorAreaDto>>(`/floor/areas/${id}`, dto);
  return res.data;
}
export async function deleteArea(id: number): Promise<BaseResponse<boolean>> {
  const res = await api.delete<BaseResponse<boolean>>(`/floor/areas/${id}`);
  return res.data;
}

// ── Tables ───────────────────────────────────────────────────────────
export async function getTables(areaId?: number, includeInactive = false): Promise<DiningTableDto[]> {
  const params = new URLSearchParams({ includeInactive: String(includeInactive) });
  if (areaId) params.append("areaId", String(areaId));
  const res = await api.get<DiningTableDto[]>(`/floor/tables?${params.toString()}`);
  return res.data;
}
export async function createTable(dto: DiningTableUpsertDto): Promise<BaseResponse<DiningTableDto>> {
  const res = await api.post<BaseResponse<DiningTableDto>>(`/floor/tables`, dto);
  return res.data;
}
export async function updateTable(id: number, dto: DiningTableUpsertDto): Promise<BaseResponse<DiningTableDto>> {
  const res = await api.put<BaseResponse<DiningTableDto>>(`/floor/tables/${id}`, dto);
  return res.data;
}
export async function deleteTable(id: number): Promise<BaseResponse<boolean>> {
  const res = await api.delete<BaseResponse<boolean>>(`/floor/tables/${id}`);
  return res.data;
}
export async function saveLayout(positions: TablePositionDto[]): Promise<BaseResponse<number>> {
  const res = await api.post<BaseResponse<number>>(`/floor/tables/layout`, { positions });
  return res.data;
}
export async function getLayout(): Promise<FloorLayoutDto> {
  const res = await api.get<FloorLayoutDto>(`/floor/layout`);
  return res.data;
}

// ── Sessions ─────────────────────────────────────────────────────────
export async function getOpenSessions(): Promise<TableSessionDto[]> {
  const res = await api.get<TableSessionDto[]>(`/floor/sessions/open`);
  return res.data;
}
export async function openTable(dto: OpenTableRequestDto): Promise<BaseResponse<TableSessionDto>> {
  const res = await api.post<BaseResponse<TableSessionDto>>(`/floor/sessions/open`, dto);
  return res.data;
}
export async function seatInvoice(tableId: number, transactionId: number, guestCount = 1, notes?: string): Promise<BaseResponse<TableSessionDto>> {
  const res = await api.post<BaseResponse<TableSessionDto>>(`/floor/sessions/seat`, { tableId, transactionId, guestCount, notes });
  return res.data;
}
export async function transferSession(sessionId: number, targetTableId: number): Promise<BaseResponse<TableSessionDto>> {
  const res = await api.post<BaseResponse<TableSessionDto>>(`/floor/sessions/${sessionId}/transfer`, { targetTableId });
  return res.data;
}
export async function mergeInvoices(sourceTransactionId: number, targetTransactionId: number): Promise<BaseResponse<MergeResultDto>> {
  const res = await api.post<BaseResponse<MergeResultDto>>(`/floor/sessions/merge`, { sourceTransactionId, targetTransactionId });
  return res.data;
}
export async function closeSessionByTransaction(transactionId: number): Promise<BaseResponse<TableSessionDto>> {
  const res = await api.post<BaseResponse<TableSessionDto>>(`/floor/sessions/close/${transactionId}`);
  return res.data;
}

// ── Courses ──────────────────────────────────────────────────────────
export async function getCourses(transactionId: number): Promise<OrderCourseDto[]> {
  const res = await api.get<OrderCourseDto[]>(`/floor/sessions/courses/${transactionId}`);
  return res.data;
}
export async function setCourses(transactionId: number, assignments: { itemId: number; courseNumber: number }[]): Promise<BaseResponse<OrderCourseDto[]>> {
  const res = await api.post<BaseResponse<OrderCourseDto[]>>(`/floor/sessions/courses/${transactionId}`, { assignments });
  return res.data;
}
export async function fireCourse(transactionId: number, courseNumber: number): Promise<BaseResponse<OrderCourseDto[]>> {
  const res = await api.post<BaseResponse<OrderCourseDto[]>>(`/floor/sessions/courses/${transactionId}/fire/${courseNumber}`);
  return res.data;
}

// ── Splits ───────────────────────────────────────────────────────────
export async function getSplits(transactionId: number): Promise<BaseResponse<BillSplitListDto>> {
  const res = await api.get<BaseResponse<BillSplitListDto>>(`/floor/sessions/splits/${transactionId}`);
  return res.data;
}
export async function splitEqual(transactionId: number, ways: number): Promise<BaseResponse<BillSplitListDto>> {
  const res = await api.post<BaseResponse<BillSplitListDto>>(`/floor/sessions/splits/${transactionId}/equal`, { ways });
  return res.data;
}
export async function splitCustom(transactionId: number, splits: { amount: number; method?: string; note?: string }[]): Promise<BaseResponse<BillSplitListDto>> {
  const res = await api.post<BaseResponse<BillSplitListDto>>(`/floor/sessions/splits/${transactionId}/custom`, { splits });
  return res.data;
}
export async function paySplit(splitId: number, method: string, note?: string): Promise<BaseResponse<BillSplitListDto>> {
  const res = await api.post<BaseResponse<BillSplitListDto>>(`/floor/sessions/splits/pay/${splitId}`, { method, note });
  return res.data;
}
export async function deleteSplit(splitId: number): Promise<BaseResponse<BillSplitListDto>> {
  const res = await api.delete<BaseResponse<BillSplitListDto>>(`/floor/sessions/splits/item/${splitId}`);
  return res.data;
}

// ── Tips ─────────────────────────────────────────────────────────────
export async function getTips(transactionId: number): Promise<TipDto[]> {
  const res = await api.get<TipDto[]>(`/floor/sessions/tips/${transactionId}`);
  return res.data;
}
export async function addTip(transactionId: number, dto: { amount: number; method: string; staffUserId?: number | null; staffName?: string | null }): Promise<BaseResponse<TipDto>> {
  const res = await api.post<BaseResponse<TipDto>>(`/floor/sessions/tips/${transactionId}`, dto);
  return res.data;
}
export async function deleteTip(tipId: number): Promise<BaseResponse<boolean>> {
  const res = await api.delete<BaseResponse<boolean>>(`/floor/sessions/tips/item/${tipId}`);
  return res.data;
}
export async function getDailyTipsReport(date?: string): Promise<DailyTipsReportDto> {
  const res = await api.get<DailyTipsReportDto>(`/floor/sessions/tips/report${date ? `?date=${encodeURIComponent(date)}` : ""}`);
  return res.data;
}

/** Pulls a readable message out of an axios error / BaseResponse failure. */
export function errorMessage(err: unknown, fallback = "Request failed"): string {
  if (err && typeof err === "object") {
    const e = err as { response?: { data?: { message?: string; title?: string } }; message?: string };
    const m = e.response?.data?.message || e.response?.data?.title || e.message;
    if (typeof m === "string" && m) return m;
  }
  return fallback;
}

export default {
  getAreas, createArea, updateArea, deleteArea,
  getTables, createTable, updateTable, deleteTable, saveLayout, getLayout,
  getOpenSessions, openTable, seatInvoice, transferSession, mergeInvoices, closeSessionByTransaction,
  getCourses, setCourses, fireCourse,
  getSplits, splitEqual, splitCustom, paySplit, deleteSplit,
  getTips, addTip, deleteTip, getDailyTipsReport,
};
