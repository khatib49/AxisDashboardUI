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

export type CashOnHandDto = {
  baseline: number;
  revenue: number;
  operatingExpenses: number;
  capitalExpenses: number;
  otherCashOut: number;
  stockPurchases: number;
  totalExpenses: number;
  amount: number;
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
  // Baseline + revenue − TOTAL expenses, computed server-side.
  cashOnHand?: CashOnHandDto | null;
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

// ── Ingredient COGS diagnostic ──────────────────────────────────────────
export type IngredientCogsLineDto = {
  ingredientId: number; ingredientName: string; unit: string;
  quantityConsumed: number; totalCost: number; avgUnitCost: number;
  currentBuyPrice?: number | null; expectedAtCurrentPrice: number;
  movementCount: number; flag?: string | null;
};
export type IngredientCogsMovementDto = {
  id: number; createdOn: string; ingredientName: string; unit: string;
  quantity: number; unitCost?: number | null; totalCost: number;
  referenceType?: string | null; referenceId?: number | null;
};
export type RecipeConsumerDto = {
  recipeLineId: number; ingredientId: number; ingredientName: string;
  itemId: number; itemName: string; itemSellPrice: number;
  recipeQty: number; recipeUnit?: string | null; ingredientUnit: string;
  unitConverted: boolean; qtyPerPortionInIngredientUnit: number; costPerPortion: number;
  unitsSoldInPeriod: number; costInPeriod: number; flag?: string | null;
};
export type IngredientCogsBreakdownDto = {
  from?: string | null; to?: string | null; total: number; movementCount: number;
  expectedAtCurrentPrices: number;
  lines: IngredientCogsLineDto[]; topMovements: IngredientCogsMovementDto[];
  recipeProblems?: RecipeConsumerDto[] | null;
  consumersByIngredient?: Record<number, RecipeConsumerDto[]> | null;
};
export const getIngredientCogsBreakdown = async (from?: string, to?: string): Promise<IngredientCogsBreakdownDto> => {
  const params = new URLSearchParams();
  if (from) params.append("from", from);
  if (to) params.append("to", to);
  const res = await api.get<IngredientCogsBreakdownDto>(`/accounting/ingredient-cogs-breakdown?${params.toString()}`);
  return res.data;
};

// ── Owner-summary tile drill-down ───────────────────────────────────────
export type BreakdownRowDto = { label: string; amount: number; count?: number | null; detail?: string | null; secondary?: number | null };
export type MetricBreakdownDto = {
  metric: string; title: string; total: number; rows: BreakdownRowDto[];
  note?: string | null; secondaryLabel?: string | null; countLabel?: string | null;
};
export const getMetricBreakdown = async (metric: string, from?: string, to?: string): Promise<MetricBreakdownDto> => {
  const params = new URLSearchParams({ metric });
  if (from) params.append("from", from);
  if (to) params.append("to", to);
  const res = await api.get<MetricBreakdownDto>(`/accounting/metric-breakdown?${params.toString()}`);
  return res.data;
};
