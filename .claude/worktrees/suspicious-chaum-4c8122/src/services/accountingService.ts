import api from "./api";

// ============================================
// TYPE DEFINITIONS
// ============================================

export type RevenueBreakdownDto = {
  gaming: number;
  fnb: number;
  tcg: number;
  total: number;
};

export type ExpenseCategoryLineDto = {
  category: string;
  amount: number;
};

export type ExpenseSummaryDto = {
  total: number;
  lines: ExpenseCategoryLineDto[];
};

export type CogsSummaryDto = {
  tcgCogs: number;
  total: number;
};

export type AccountingDashboardDto = {
  from: string | null;
  to: string | null;
  revenue: RevenueBreakdownDto;
  operatingExpenses: ExpenseSummaryDto;
  capitalExpenses: ExpenseSummaryDto;
  cogs: CogsSummaryDto;
  grossProfit: number;
  netIncome: number;
  netMarginPercent: number;
};

export type BackfillResultDto = {
  total: number;
  success: number;
  failed: number;
  errors: string[];
};

// ============================================
// API CALLS
// ============================================

export const getAccountingDashboard = async (
  from?: string,
  to?: string
): Promise<AccountingDashboardDto> => {
  const params = new URLSearchParams();
  if (from) params.append("from", from);
  if (to) params.append("to", to);
  const res = await api.get<AccountingDashboardDto>(
    `/accounting/dashboard?${params.toString()}`
  );
  return res.data;
};

export const getOperatingExpensesBreakdown = async (
  from?: string,
  to?: string
): Promise<ExpenseCategoryLineDto[]> => {
  const params = new URLSearchParams();
  if (from) params.append("from", from);
  if (to) params.append("to", to);
  params.append("capitalOnly", "false");
  const res = await api.get<ExpenseCategoryLineDto[]>(
    `/accounting/expenses-breakdown?${params.toString()}`
  );
  return res.data;
};

export const getCapitalExpensesBreakdown = async (
  from?: string,
  to?: string
): Promise<ExpenseCategoryLineDto[]> => {
  const params = new URLSearchParams();
  if (from) params.append("from", from);
  if (to) params.append("to", to);
  params.append("capitalOnly", "true");
  const res = await api.get<ExpenseCategoryLineDto[]>(
    `/accounting/expenses-breakdown?${params.toString()}`
  );
  return res.data;
};

export const backfillTransactions = async (): Promise<BackfillResultDto> => {
  const res = await api.post<BackfillResultDto>("/accounting/backfill/transactions");
  return res.data;
};

export const backfillExpenses = async (): Promise<BackfillResultDto> => {
  const res = await api.post<BackfillResultDto>("/accounting/backfill/expenses");
  return res.data;
};