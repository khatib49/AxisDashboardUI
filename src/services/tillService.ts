import api from "./api";
import type { BaseResponse } from "./currencyService";

export type { BaseResponse };

export type PaginatedResponse<T> = {
  totalCount: number;
  data: T[];
  pageNumber: number;
  pageSize: number;
};

// ───────────── Shifts ─────────────
export type CashMovementDto = {
  id: number;
  shiftId: number;
  type: "PayIn" | "PayOut" | string;
  amount: number;
  reason: string;
  createdOn: string;
  createdBy: string;
};

export type CashierShiftDto = {
  id: number;
  registerName: string;
  userId: number;
  userName: string;
  openedOn: string;
  closedOn?: string | null;
  openingFloat: number;
  expectedCash?: number | null;
  countedCash?: number | null;
  variance?: number | null;
  status: "Open" | "Closed" | string;
  notes?: string | null;
  closedBy?: string | null;
  branchId?: number | null;
  movements: CashMovementDto[];
};

export type ShiftMethodTotalDto = { method: string; amountInBase: number; count: number };
export type ShiftCurrencyTotalDto = {
  currencyCode: string;
  amountInCurrency: number;
  amountInBase: number;
  count: number;
};

export type ShiftReportDto = {
  reportType: "X" | "Z" | string;
  shiftId: number;
  registerName: string;
  userName: string;
  openedOn: string;
  closedOn?: string | null;
  generatedOn: string;
  openingFloat: number;
  salesByMethod: ShiftMethodTotalDto[];
  tendersByCurrency: ShiftCurrencyTotalDto[];
  tenderedTotalInBase: number;
  cashTenderedInBase: number;
  transactionCount: number;
  transactionTotal: number;
  payInCount: number;
  payInTotal: number;
  payOutCount: number;
  payOutTotal: number;
  voidsPending: number;
  voidsApproved: number;
  voidsApprovedAmount: number;
  refundsApproved: number;
  refundsApprovedAmount: number;
  expectedCash: number;
  countedCash?: number | null;
  variance?: number | null;
};

export type ShiftFilter = {
  userId?: number;
  registerName?: string;
  status?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
};

export async function openShift(registerName: string, openingFloat: number, notes?: string) {
  const res = await api.post<BaseResponse<CashierShiftDto>>(`/till/shifts/open`, {
    registerName,
    openingFloat,
    notes: notes || null,
  });
  return res.data;
}

/** The caller's open shift, or null (API answers 204 when none). */
export async function getCurrentShift(register?: string): Promise<CashierShiftDto | null> {
  const qs = register ? `?register=${encodeURIComponent(register)}` : "";
  const res = await api.get<CashierShiftDto | "">(`/till/shifts/current${qs}`);
  return res.status === 204 || !res.data ? null : (res.data as CashierShiftDto);
}

export async function payIn(amount: number, reason: string, shiftId?: number) {
  const qs = shiftId ? `?shiftId=${shiftId}` : "";
  const res = await api.post<BaseResponse<CashMovementDto>>(`/till/shifts/pay-in${qs}`, { amount, reason });
  return res.data;
}

export async function payOut(amount: number, reason: string, shiftId?: number) {
  const qs = shiftId ? `?shiftId=${shiftId}` : "";
  const res = await api.post<BaseResponse<CashMovementDto>>(`/till/shifts/pay-out${qs}`, { amount, reason });
  return res.data;
}

export async function getXReport(shiftId?: number) {
  const qs = shiftId ? `?shiftId=${shiftId}` : "";
  const res = await api.get<BaseResponse<ShiftReportDto>>(`/till/shifts/x-report${qs}`);
  return res.data;
}

export async function closeShift(countedCash: number, notes?: string, shiftId?: number) {
  const qs = shiftId ? `?shiftId=${shiftId}` : "";
  const res = await api.post<BaseResponse<ShiftReportDto>>(`/till/shifts/close${qs}`, {
    countedCash,
    notes: notes || null,
  });
  return res.data;
}

export async function listShifts(filter: ShiftFilter = {}): Promise<PaginatedResponse<CashierShiftDto>> {
  const params = new URLSearchParams();
  if (filter.userId) params.append("UserId", String(filter.userId));
  if (filter.registerName) params.append("RegisterName", filter.registerName);
  if (filter.status) params.append("Status", filter.status);
  if (filter.from) params.append("From", filter.from);
  if (filter.to) params.append("To", filter.to);
  params.append("Page", String(filter.page ?? 1));
  params.append("PageSize", String(filter.pageSize ?? 20));
  const res = await api.get<PaginatedResponse<CashierShiftDto>>(`/till/shifts?${params.toString()}`);
  return res.data;
}

export async function getShift(id: number): Promise<CashierShiftDto> {
  const res = await api.get<CashierShiftDto>(`/till/shifts/${id}`);
  return res.data;
}

export async function getZReport(shiftId: number): Promise<ShiftReportDto> {
  const res = await api.get<ShiftReportDto>(`/till/shifts/${shiftId}/z-report`);
  return res.data;
}

// ───────────── Void reasons / requests ─────────────
export type VoidReasonDto = { id: number; name: string; requiresApproval: boolean; isActive: boolean };
export type VoidReasonCreateDto = { name: string; requiresApproval?: boolean; isActive?: boolean };
export type VoidReasonUpdateDto = { name?: string | null; requiresApproval?: boolean | null; isActive?: boolean | null };

export type VoidRequestDto = {
  id: number;
  transactionId: number;
  type: "Void" | "Refund" | string;
  amount?: number | null;
  reasonId: number;
  reasonName: string;
  reasonRequiresApproval: boolean;
  reasonText?: string | null;
  requestedBy: string;
  requestedOn: string;
  status: "Pending" | "Approved" | "Rejected" | string;
  decidedBy?: string | null;
  decidedOn?: string | null;
  decisionNote?: string | null;
  branchId?: number | null;
};

export type VoidRequestCreateDto = {
  transactionId: number;
  type: "Void" | "Refund";
  amount?: number | null;
  reasonId: number;
  reasonText?: string | null;
};

export async function getVoidReasons(includeInactive = false): Promise<VoidReasonDto[]> {
  const res = await api.get<VoidReasonDto[]>(`/till/void-reasons?includeInactive=${includeInactive}`);
  return res.data;
}

export async function createVoidReason(payload: VoidReasonCreateDto) {
  const res = await api.post<BaseResponse<VoidReasonDto>>(`/till/void-reasons`, payload);
  return res.data;
}

export async function updateVoidReason(id: number, payload: VoidReasonUpdateDto) {
  const res = await api.put<BaseResponse<VoidReasonDto>>(`/till/void-reasons/${id}`, payload);
  return res.data;
}

export async function deleteVoidReason(id: number): Promise<void> {
  await api.delete(`/till/void-reasons/${id}`);
}

export async function createVoidRequest(payload: VoidRequestCreateDto) {
  const res = await api.post<BaseResponse<VoidRequestDto>>(`/till/void-requests`, payload);
  return res.data;
}

export async function listVoidRequests(
  status?: string,
  transactionId?: number,
  page = 1,
  pageSize = 20
): Promise<PaginatedResponse<VoidRequestDto>> {
  const params = new URLSearchParams({ Page: String(page), PageSize: String(pageSize) });
  if (status) params.append("Status", status);
  if (transactionId) params.append("TransactionId", String(transactionId));
  const res = await api.get<PaginatedResponse<VoidRequestDto>>(`/till/void-requests?${params.toString()}`);
  return res.data;
}

export async function getPendingVoidRequests(): Promise<VoidRequestDto[]> {
  const res = await api.get<VoidRequestDto[]>(`/till/void-requests/pending`);
  return res.data;
}

export async function approveVoidRequest(id: number, note?: string) {
  const res = await api.post<BaseResponse<VoidRequestDto>>(`/till/void-requests/${id}/approve`, { note: note || null });
  return res.data;
}

export async function rejectVoidRequest(id: number, note?: string) {
  const res = await api.post<BaseResponse<VoidRequestDto>>(`/till/void-requests/${id}/reject`, { note: note || null });
  return res.data;
}

// ───────────── Tenders ─────────────
export type TenderMethod = "Cash" | "Card" | "Wallet" | "Whish" | "Transfer" | "GiftCard" | "Other";
export const TENDER_METHODS: TenderMethod[] = ["Cash", "Card", "Wallet", "Whish", "Transfer", "GiftCard", "Other"];

export type TenderLineDto = { currencyCode: string; amount: number; method?: TenderMethod; reference?: string | null };

export type PaymentTenderDto = {
  id: number;
  transactionId: number;
  shiftId?: number | null;
  currencyCode: string;
  amountInCurrency: number;
  rateUsed: number;
  amountInBase: number;
  method: string;
  reference?: string | null;
  createdOn: string;
  createdBy: string;
};

export type ChangeDueDto = { currencyCode: string; amount: number };

export type TenderSummaryDto = {
  transactionId: number;
  baseCurrency: string;
  totalPrice: number;
  paidInBase: number;
  remainingInBase: number;
  changeInBase: number;
  changeByCurrency: ChangeDueDto[];
  tenders: PaymentTenderDto[];
};

export async function addTenders(transactionId: number, tenders: TenderLineDto[]) {
  const res = await api.post<BaseResponse<TenderSummaryDto>>(`/till/tenders`, { transactionId, tenders });
  return res.data;
}

export async function getTenderSummary(transactionId: number) {
  const res = await api.get<BaseResponse<TenderSummaryDto>>(`/till/tenders/transaction/${transactionId}`);
  return res.data;
}

export async function getTendersByShift(shiftId: number): Promise<PaymentTenderDto[]> {
  const res = await api.get<PaymentTenderDto[]>(`/till/tenders/shift/${shiftId}`);
  return res.data;
}

export async function deleteTender(id: number) {
  const res = await api.delete<BaseResponse<TenderSummaryDto>>(`/till/tenders/${id}`);
  return res.data;
}

/** Pull a readable message out of whatever the API/axios interceptor rejected with. */
export function errorMessage(err: unknown, fallback = "Request failed"): string {
  if (err && typeof err === "object") {
    const e = err as { message?: unknown; details?: unknown };
    if (e.details && typeof e.details === "object") {
      const d = e.details as { error?: unknown; message?: unknown };
      if (typeof d.error === "string" && d.error) return d.error;
      if (typeof d.message === "string" && d.message) return d.message;
    }
    if (typeof e.message === "string" && e.message) return e.message;
  }
  return fallback;
}

export default {
  openShift,
  getCurrentShift,
  payIn,
  payOut,
  getXReport,
  closeShift,
  listShifts,
  getShift,
  getZReport,
  getVoidReasons,
  createVoidReason,
  updateVoidReason,
  deleteVoidReason,
  createVoidRequest,
  listVoidRequests,
  getPendingVoidRequests,
  approveVoidRequest,
  rejectVoidRequest,
  addTenders,
  getTenderSummary,
  getTendersByShift,
  deleteTender,
  errorMessage,
};
