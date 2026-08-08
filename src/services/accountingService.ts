import api from "./api";

// ============================================
// TYPE DEFINITIONS
// ============================================

export type RevenueBreakdownDto = {
  // Net (after discount) — matches Cash on Hand inflow.
  gaming: number;
  fnb: number;
  tcg: number;
  total: number;
  // Gross (before discount) and the running total of discounts given in
  // the period. Backend may omit these on older builds; treat as optional.
  gamingGross?: number | null;
  fnbGross?: number | null;
  tcgGross?: number | null;
  totalGross?: number | null;
  discountsGiven?: number | null;
  /** Paid event ticket sales (4300 Event Revenue). Included in `total`. */
  events?: number | null;
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
  // Ingredient COGS = sum of cost on F&B sale consumptions in the period.
  // Drives the Food Cost % stat and dish-margin context.
  ingredientCogs?: number | null;
  foodCostPercent?: number | null;
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

// Revenue coverage audit — comparison between the calculator
// (sum of TransactionRecord.TotalPrice) and the chart of accounts revenue
// side, plus a list of paid transactions missing a journal entry.
export type RevenueCoverageAuditDto = {
  from: string | null;
  to: string | null;
  transactionsCount: number;
  transactionsTotalNet: number;
  transactionsTotalGross: number;
  transactionsWithJE: number;
  transactionsWithoutJE: number;
  orphanTransactionIds: number[];
  revenueAccountsCredit: number;
  salesDiscountsDebit: number;
  netRevenueOnBooks: number;
  discrepancy: number;
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

// Read-only audit: see how many paid transactions in the period are missing
// a journal entry, and the live discrepancy between calculator and books.
export const getRevenueCoverageAudit = async (
  from?: string,
  to?: string
): Promise<RevenueCoverageAuditDto> => {
  const params = new URLSearchParams();
  if (from) params.append("from", from);
  if (to) params.append("to", to);
  const res = await api.get<RevenueCoverageAuditDto>(
    `/accounting/audit-revenue-coverage?${params.toString()}`
  );
  return res.data;
};
