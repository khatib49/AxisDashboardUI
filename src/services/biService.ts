import api from "./api";

export type ReportType = "DailySales" | "WeeklySales" | "LowStock" | "OpenInvoices" | "ShiftSummary";
export type ReportFrequency = "Daily" | "Weekly" | "Monthly";
export type ReportChannel = "Email" | "WhatsApp" | "Both";
export type ReportFormat = "Html" | "Csv";

export type ScheduledReportDto = {
  id: number;
  name: string;
  reportType: ReportType | string;
  frequency: ReportFrequency | string;
  runAtHourUtc: number;
  dayOfWeek?: number | null; // 0 = Sunday .. 6 = Saturday
  recipients: string;
  channel: ReportChannel | string;
  format: ReportFormat | string;
  isActive: boolean;
  lastRunOn?: string | null;
  lastStatus?: string | null;
  createdBy: string;
  createdOn: string;
  branchId?: number | null;
};

export type ScheduledReportCreateDto = {
  name: string;
  reportType: string;
  frequency: string;
  runAtHourUtc: number;
  recipients: string;
  channel: string;
  format: string;
  dayOfWeek?: number | null;
  isActive?: boolean;
  branchId?: number | null;
};

export type ScheduledReportUpdateDto = Partial<ScheduledReportCreateDto>;

export type ReportRunDto = {
  id: number;
  scheduledReportId: number;
  ranOn: string;
  status: string;
  error?: string | null;
  payloadPreview?: string | null;
  isManual: boolean;
};

export type ReportPreviewDto = {
  title: string;
  reportType: string;
  format: string;
  content: string;
  rowCount: number;
};

export type OwnerPeriodDto = { sales: number; orders: number; averageTicket: number };
export type OwnerTopItemDto = { itemId: number; itemName: string; categoryName: string; quantity: number; amount: number };
export type OwnerSeriesPointDto = { date: string; total: number; items: number; games: number; events: number };

export type OwnerSummaryDto = {
  generatedOn: string;
  day: string;
  today: OwnerPeriodDto;
  yesterday: OwnerPeriodDto;
  sameDayLastWeek: OwnerPeriodDto;
  salesDeltaVsYesterdayPct?: number | null;
  salesDeltaVsLastWeekPct?: number | null;
  ordersDeltaVsYesterdayPct?: number | null;
  ordersDeltaVsLastWeekPct?: number | null;
  openInvoicesCount: number;
  openInvoicesValue: number;
  lowStockCount: number;
  topItems: OwnerTopItemDto[];
  last14Days: OwnerSeriesPointDto[];
};

export async function getReportTypes(): Promise<string[]> {
  const res = await api.get<string[]>("/bi/reports/types");
  return res.data;
}

export async function getReports(): Promise<ScheduledReportDto[]> {
  const res = await api.get<ScheduledReportDto[]>("/bi/reports");
  return res.data;
}

export async function createReport(payload: ScheduledReportCreateDto): Promise<ScheduledReportDto> {
  const res = await api.post<ScheduledReportDto>("/bi/reports", payload);
  return res.data;
}

export async function updateReport(id: number, payload: ScheduledReportUpdateDto): Promise<ScheduledReportDto> {
  const res = await api.put<ScheduledReportDto>(`/bi/reports/${id}`, payload);
  return res.data;
}

export async function deleteReport(id: number): Promise<void> {
  await api.delete(`/bi/reports/${id}`);
}

export async function getReportRuns(id: number, take = 50): Promise<ReportRunDto[]> {
  const res = await api.get<ReportRunDto[]>(`/bi/reports/${id}/runs?take=${take}`);
  return res.data;
}

/** day: "yyyy-MM-dd" (default today). */
export async function runReportNow(id: number, day?: string): Promise<ReportRunDto> {
  const res = await api.post<ReportRunDto>(`/bi/reports/${id}/run${day ? `?day=${day}` : ""}`);
  return res.data;
}

export async function previewReport(id: number, day?: string): Promise<ReportPreviewDto> {
  const res = await api.get<ReportPreviewDto>(`/bi/reports/${id}/preview${day ? `?day=${day}` : ""}`);
  return res.data;
}

export async function getOwnerSummary(day?: string): Promise<OwnerSummaryDto> {
  const res = await api.get<OwnerSummaryDto>(`/bi/owner-summary${day ? `?day=${day}` : ""}`);
  return res.data;
}

export default {
  getReportTypes,
  getReports,
  createReport,
  updateReport,
  deleteReport,
  getReportRuns,
  runReportNow,
  previewReport,
  getOwnerSummary,
};
