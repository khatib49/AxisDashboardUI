import api from "./api";

// ── Shared ────────────────────────────────────────────────────────────────
export type BaseResponse<T> = { success: boolean; error?: string | null; message: string; data?: T | null };
export type Paginated<T> = { totalCount: number; data: T[]; pageNumber: number; pageSize: number };

/** Message from an axios error / BaseResponse body, safe for any shape. */
export function errorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (err && typeof err === "object") {
    const e = err as { response?: { status?: number; data?: unknown }; message?: unknown };
    const data = e.response?.data as { message?: unknown } | undefined;
    if (data && typeof data.message === "string") return data.message;
    if (e.response?.status === 403) return "You do not have access to this";
    if (e.response?.status === 404) return "Not found";
    if (typeof e.message === "string") return e.message;
  }
  return fallback;
}

export function toDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function mondayOf(d: Date): Date {
  const x = new Date(d);
  const diff = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return toDateOnly(d);
}

// ── Employees ─────────────────────────────────────────────────────────────
export type HrEmployee = {
  id: number; userId?: number | null; fullName: string; phone?: string | null; email?: string | null;
  position?: string | null; department?: string | null; hourlyRate?: number | null; monthlySalary?: number | null;
  hiredOn: string; terminatedOn?: string | null; isActive: boolean; notes?: string | null; branchId?: number | null; hasPin: boolean;
};
export type HrEmployeeCreate = {
  fullName: string; phone?: string | null; email?: string | null; position?: string | null; department?: string | null;
  hourlyRate?: number | null; monthlySalary?: number | null; hiredOn?: string | null; notes?: string | null; userId?: number | null; pin?: string | null;
};
export type HrEmployeeUpdate = Partial<Omit<HrEmployeeCreate, "pin" | "userId">> & { terminatedOn?: string | null; isActive?: boolean | null };

export async function getEmployees(search?: string, includeInactive = false, page = 1, pageSize = 50): Promise<Paginated<HrEmployee>> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), includeInactive: String(includeInactive) });
  if (search) params.append("search", search);
  return (await api.get<Paginated<HrEmployee>>(`/hr/employees?${params}`)).data;
}
export async function getMyEmployee(): Promise<HrEmployee> {
  return (await api.get<HrEmployee>(`/hr/employees/me`)).data;
}
export async function createEmployee(payload: HrEmployeeCreate): Promise<BaseResponse<HrEmployee>> {
  return (await api.post<BaseResponse<HrEmployee>>(`/hr/employees`, payload)).data;
}
export async function updateEmployee(id: number, payload: HrEmployeeUpdate): Promise<BaseResponse<HrEmployee>> {
  return (await api.put<BaseResponse<HrEmployee>>(`/hr/employees/${id}`, payload)).data;
}
export async function deleteEmployee(id: number): Promise<void> {
  await api.delete(`/hr/employees/${id}`);
}
export async function setEmployeePin(id: number, pin: string): Promise<BaseResponse<boolean>> {
  return (await api.post<BaseResponse<boolean>>(`/hr/employees/${id}/pin`, { pin })).data;
}
export async function linkEmployeeUser(id: number, userId: number | null): Promise<BaseResponse<HrEmployee>> {
  return (await api.post<BaseResponse<HrEmployee>>(`/hr/employees/${id}/link-user`, { userId })).data;
}

// ── Schedule ──────────────────────────────────────────────────────────────
export type HrShiftTemplate = { id: number; name: string; startTime: string; endTime: string; color?: string | null };
export type HrShiftTemplateUpsert = Omit<HrShiftTemplate, "id">;
export type HrShift = {
  id: number; employeeId: number; employeeName: string; date: string; startOn: string; endOn: string;
  templateId?: number | null; role?: string | null; notes?: string | null; status: string; createdBy: string;
};
export type HrShiftCreate = { employeeId: number; date: string; startOn?: string | null; endOn?: string | null; templateId?: number | null; role?: string | null; notes?: string | null };
export type HrShiftUpdate = Partial<HrShiftCreate> & { status?: string | null };
export type HrWeekRow = { employeeId: number; employeeName: string; position?: string | null; shifts: HrShift[] };
export type HrWeekView = { weekStart: string; days: string[]; rows: HrWeekRow[] };

export async function getTemplates(): Promise<HrShiftTemplate[]> {
  return (await api.get<HrShiftTemplate[]>(`/hr/schedule/templates`)).data;
}
export async function createTemplate(p: HrShiftTemplateUpsert): Promise<HrShiftTemplate> {
  return (await api.post<HrShiftTemplate>(`/hr/schedule/templates`, p)).data;
}
export async function updateTemplate(id: number, p: HrShiftTemplateUpsert): Promise<void> {
  await api.put(`/hr/schedule/templates/${id}`, p);
}
export async function deleteTemplate(id: number): Promise<void> {
  await api.delete(`/hr/schedule/templates/${id}`);
}
export async function getWeek(weekStart?: string): Promise<HrWeekView> {
  return (await api.get<HrWeekView>(`/hr/schedule/week${weekStart ? `?weekStart=${weekStart}` : ""}`)).data;
}
export async function getMyWeek(weekStart?: string): Promise<HrWeekView> {
  return (await api.get<HrWeekView>(`/hr/schedule/my-week${weekStart ? `?weekStart=${weekStart}` : ""}`)).data;
}
export async function createShift(p: HrShiftCreate): Promise<BaseResponse<HrShift>> {
  return (await api.post<BaseResponse<HrShift>>(`/hr/schedule/shifts`, p)).data;
}
export async function updateShift(id: number, p: HrShiftUpdate): Promise<BaseResponse<HrShift>> {
  return (await api.put<BaseResponse<HrShift>>(`/hr/schedule/shifts/${id}`, p)).data;
}
export async function deleteShift(id: number): Promise<void> {
  await api.delete(`/hr/schedule/shifts/${id}`);
}
export async function copyPreviousWeek(weekStart: string): Promise<BaseResponse<number>> {
  return (await api.post<BaseResponse<number>>(`/hr/schedule/copy-previous-week`, { weekStart })).data;
}

// ── Attendance ────────────────────────────────────────────────────────────
export type HrClockResult = {
  success: boolean; message: string; employeeId?: number | null; employeeName?: string | null;
  action?: "ClockIn" | "ClockOut" | null; at?: string | null; workedMinutes?: number | null;
};
export type HrAttendance = {
  id: number; employeeId: number; employeeName: string; clockIn: string; clockOut?: string | null; source: string;
  scheduledShiftId?: number | null; deviceName?: string | null; notes?: string | null; workedMinutes?: number | null; branchId?: number | null;
};
export type HrAttendanceManual = { employeeId: number; clockIn: string; clockOut?: string | null; notes?: string | null; scheduledShiftId?: number | null };
export type HrAttendanceUpdate = { clockIn?: string | null; clockOut?: string | null; notes?: string | null; scheduledShiftId?: number | null };
export type HrDailySummaryRow = {
  employeeId: number; employeeName: string; date: string; scheduledStart?: string | null; scheduledEnd?: string | null;
  firstClockIn?: string | null; lastClockOut?: string | null; workedMinutes: number; lateMinutes: number; status: string;
};
export type HrTimesheetRow = { date: string; clockIn: string; clockOut?: string | null; minutes: number; amount: number };
export type HrTimesheet = {
  employeeId: number; employeeName: string; year: number; month: number; hourlyRate?: number | null;
  totalMinutes: number; totalAmount: number; rows: HrTimesheetRow[];
};

export async function clock(pin: string, deviceName?: string): Promise<HrClockResult> {
  return (await api.post<HrClockResult>(`/hr/attendance/clock`, { pin, deviceName })).data;
}
export async function getAttendance(from: string, to: string, employeeId?: number): Promise<HrAttendance[]> {
  const params = new URLSearchParams({ from, to });
  if (employeeId) params.append("employeeId", String(employeeId));
  return (await api.get<HrAttendance[]>(`/hr/attendance?${params}`)).data;
}
export async function getDailySummary(date: string): Promise<HrDailySummaryRow[]> {
  return (await api.get<HrDailySummaryRow[]>(`/hr/attendance/daily?date=${date}`)).data;
}
export async function getTimesheet(employeeId: number, year: number, month: number): Promise<HrTimesheet> {
  return (await api.get<HrTimesheet>(`/hr/attendance/timesheet?employeeId=${employeeId}&year=${year}&month=${month}`)).data;
}
export async function downloadAttendanceCsv(from: string, to: string, employeeId?: number): Promise<Blob> {
  const params = new URLSearchParams({ from, to });
  if (employeeId) params.append("employeeId", String(employeeId));
  return (await api.get(`/hr/attendance/export?${params}`, { responseType: "blob" })).data as Blob;
}
export async function addManualAttendance(p: HrAttendanceManual): Promise<BaseResponse<HrAttendance>> {
  return (await api.post<BaseResponse<HrAttendance>>(`/hr/attendance/manual`, p)).data;
}
export async function updateAttendance(id: number, p: HrAttendanceUpdate): Promise<BaseResponse<HrAttendance>> {
  return (await api.put<BaseResponse<HrAttendance>>(`/hr/attendance/${id}`, p)).data;
}
export async function deleteAttendance(id: number): Promise<void> {
  await api.delete(`/hr/attendance/${id}`);
}

// ── Leave ─────────────────────────────────────────────────────────────────
export type HrLeaveType = { id: number; name: string; isPaid: boolean; defaultDaysPerYear: number };
export type HrLeaveTypeUpsert = Omit<HrLeaveType, "id">;
export type HrLeaveRequest = {
  id: number; employeeId: number; employeeName: string; leaveTypeId: number; leaveTypeName: string; fromDate: string; toDate: string;
  days: number; reason?: string | null; status: string; requestedOn: string; decidedBy?: string | null; decidedOn?: string | null; decisionNote?: string | null;
};
export type HrLeaveRequestCreate = { leaveTypeId: number; fromDate: string; toDate: string; reason?: string | null; employeeId?: number | null };
export type HrLeaveBalanceItem = { leaveTypeId: number; leaveTypeName: string; isPaid: boolean; defaultDays: number; usedDays: number; pendingDays: number; remaining: number };
export type HrLeaveBalance = { employeeId: number; employeeName: string; year: number; items: HrLeaveBalanceItem[] };

export async function getLeaveTypes(): Promise<HrLeaveType[]> {
  return (await api.get<HrLeaveType[]>(`/hr/leave/types`)).data;
}
export async function createLeaveType(p: HrLeaveTypeUpsert): Promise<HrLeaveType> {
  return (await api.post<HrLeaveType>(`/hr/leave/types`, p)).data;
}
export async function updateLeaveType(id: number, p: HrLeaveTypeUpsert): Promise<void> {
  await api.put(`/hr/leave/types/${id}`, p);
}
export async function deleteLeaveType(id: number): Promise<void> {
  await api.delete(`/hr/leave/types/${id}`);
}
export async function getLeaveRequests(status?: string, employeeId?: number, year?: number): Promise<HrLeaveRequest[]> {
  const params = new URLSearchParams();
  if (status) params.append("status", status);
  if (employeeId) params.append("employeeId", String(employeeId));
  if (year) params.append("year", String(year));
  return (await api.get<HrLeaveRequest[]>(`/hr/leave/requests?${params}`)).data;
}
export async function getMyLeaveRequests(): Promise<HrLeaveRequest[]> {
  return (await api.get<HrLeaveRequest[]>(`/hr/leave/requests/mine`)).data;
}
export async function createLeaveRequest(p: HrLeaveRequestCreate): Promise<BaseResponse<HrLeaveRequest>> {
  return (await api.post<BaseResponse<HrLeaveRequest>>(`/hr/leave/requests`, p)).data;
}
export async function decideLeaveRequest(id: number, approve: boolean, note?: string): Promise<BaseResponse<HrLeaveRequest>> {
  return (await api.post<BaseResponse<HrLeaveRequest>>(`/hr/leave/requests/${id}/${approve ? "approve" : "reject"}`, { note: note ?? null })).data;
}
export async function cancelLeaveRequest(id: number): Promise<BaseResponse<HrLeaveRequest>> {
  return (await api.post<BaseResponse<HrLeaveRequest>>(`/hr/leave/requests/${id}/cancel`)).data;
}
export async function getLeaveBalances(year: number): Promise<HrLeaveBalance[]> {
  return (await api.get<HrLeaveBalance[]>(`/hr/leave/balances?year=${year}`)).data;
}

// ── Tips ──────────────────────────────────────────────────────────────────
export type HrTipParticipant = { employeeId: number; points?: number | null };
export type HrTipAllocation = { id: number; employeeId: number; employeeName: string; points?: number | null; hours?: number | null; amount: number };
export type HrTipPool = {
  id: number; date: string; totalAmount: number; method: "Equal" | "ByHours" | "ByPoints" | string; status: string; notes?: string | null;
  createdBy: string; createdOn: string; distributedOn?: string | null; branchId?: number | null; allocations: HrTipAllocation[];
};
export type HrTipPoolCreate = { date: string; totalAmount: number; method: string; notes?: string | null; participants?: HrTipParticipant[] | null };
export type HrTipPoolUpdate = Partial<HrTipPoolCreate>;
export type HrTipReport = {
  from: string; to: string; total: number;
  byDay: { date: string; poolCount: number; amount: number }[];
  byEmployee: { employeeId: number; employeeName: string; amount: number }[];
};

export async function getTipPools(from: string, to: string): Promise<HrTipPool[]> {
  return (await api.get<HrTipPool[]>(`/hr/tips?from=${from}&to=${to}`)).data;
}
export async function getTipReport(from: string, to: string): Promise<HrTipReport> {
  return (await api.get<HrTipReport>(`/hr/tips/report?from=${from}&to=${to}`)).data;
}
export async function createTipPool(p: HrTipPoolCreate): Promise<BaseResponse<HrTipPool>> {
  return (await api.post<BaseResponse<HrTipPool>>(`/hr/tips`, p)).data;
}
export async function updateTipPool(id: number, p: HrTipPoolUpdate): Promise<BaseResponse<HrTipPool>> {
  return (await api.put<BaseResponse<HrTipPool>>(`/hr/tips/${id}`, p)).data;
}
export async function computeTipPool(id: number): Promise<BaseResponse<HrTipPool>> {
  return (await api.post<BaseResponse<HrTipPool>>(`/hr/tips/${id}/compute`)).data;
}
export async function distributeTipPool(id: number): Promise<BaseResponse<HrTipPool>> {
  return (await api.post<BaseResponse<HrTipPool>>(`/hr/tips/${id}/distribute`)).data;
}
export async function deleteTipPool(id: number): Promise<void> {
  await api.delete(`/hr/tips/${id}`);
}
