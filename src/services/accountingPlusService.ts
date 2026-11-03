import api from "./api";

// ---------- shared ----------
export type BaseResponse<T = unknown> = {
  success: boolean;
  error?: string | null;
  message?: string;
  data?: T | null;
};

export type PaginatedResponse<T> = {
  totalCount: number;
  data: T[];
  pageNumber: number;
  pageSize: number;
};

export type PostableAccount = {
  id: number;
  accountNumber: string;
  accountName: string;
  accountTypeId: number;
  accountTypeName: string;
};

export type SupplierLite = { id: number; name: string; isActive: boolean };

/** Pulls the normalised message out of an axios/ApiError rejection. */
export function errorMessage(err: unknown, fallback = "Request failed"): string {
  if (err && typeof err === "object") {
    const e = err as { message?: unknown; details?: unknown };
    const details = e.details as { error?: unknown; message?: unknown } | undefined;
    if (details && typeof details.error === "string" && details.error) return details.error;
    if (typeof e.message === "string" && e.message) return e.message;
  }
  return fallback;
}

export async function getPostableAccounts(): Promise<PostableAccount[]> {
  const res = await api.get<PostableAccount[]>("/Accounts/postable");
  return res.data ?? [];
}

export async function getSuppliers(): Promise<SupplierLite[]> {
  const res = await api.get<SupplierLite[]>("/Suppliers");
  return res.data ?? [];
}

// ---------- bank reconciliation ----------
export type BankAccountDto = {
  id: number;
  name: string;
  bankName?: string | null;
  accountNumberMasked?: string | null;
  currencyCode: string;
  glAccountId: number;
  glAccountNumber?: string | null;
  glAccountName?: string | null;
  isActive: boolean;
  branchId?: number | null;
  createdOn: string;
};

export type BankAccountUpsertDto = {
  name: string;
  bankName?: string | null;
  accountNumberMasked?: string | null;
  currencyCode?: string | null;
  glAccountId: number;
  isActive?: boolean;
};

export type BankStatementDto = {
  id: number;
  bankAccountId: number;
  bankAccountName?: string | null;
  periodFrom: string;
  periodTo: string;
  openingBalance: number;
  closingBalance: number;
  importedOn: string;
  importedBy?: string | null;
  status: "Open" | "Reconciled" | string;
  reconciledOn?: string | null;
  lineCount: number;
  unmatchedCount: number;
};

export type BankStatementLineDto = {
  id: number;
  statementId: number;
  date: string;
  description?: string | null;
  reference?: string | null;
  amount: number;
  matchedJournalEntryLineId?: number | null;
  matchStatus: "Unmatched" | "Matched" | "Excluded" | string;
  matchedOn?: string | null;
  matchedBy?: string | null;
  note?: string | null;
};

export type BankStatementDetailDto = { statement: BankStatementDto; lines: BankStatementLineDto[] };

export type BankMatchSuggestionDto = {
  journalEntryLineId: number;
  journalEntryId: number;
  entryNumber: string;
  entryDate: string;
  description: string;
  debitAmount: number;
  creditAmount: number;
  signedAmount: number;
  dayDifference: number;
};

export type BankReconciliationSummaryDto = {
  statementId: number;
  periodFrom: string;
  periodTo: string;
  openingBalance: number;
  closingBalance: number;
  ledgerBalanceAsOfPeriodTo: number;
  difference: number;
  totalLines: number;
  matchedCount: number;
  unmatchedCount: number;
  excludedCount: number;
  unmatchedTotal: number;
  matchedTotal: number;
  statementNetMovement: number;
  unmatchedLedgerLinesInPeriod: number;
  unmatchedLedgerTotalInPeriod: number;
  canReconcile: boolean;
  status: string;
};

export type CsvImportResultDto = { statementId: number; imported: number; skipped: number; errors: string[] };

export const bank = {
  listAccounts: async (includeInactive = false) =>
    (await api.get<BankAccountDto[]>(`/accountingplus/bank/accounts?includeInactive=${includeInactive}`)).data ?? [],
  createAccount: async (dto: BankAccountUpsertDto) => (await api.post<BankAccountDto>("/accountingplus/bank/accounts", dto)).data,
  updateAccount: async (id: number, dto: BankAccountUpsertDto) =>
    (await api.put<BankAccountDto>(`/accountingplus/bank/accounts/${id}`, dto)).data,
  deleteAccount: async (id: number) => {
    await api.delete(`/accountingplus/bank/accounts/${id}`);
  },
  listStatements: async (bankAccountId?: number) =>
    (await api.get<BankStatementDto[]>(`/accountingplus/bank/statements${bankAccountId ? `?bankAccountId=${bankAccountId}` : ""}`)).data ?? [],
  createStatement: async (dto: {
    bankAccountId: number;
    periodFrom: string;
    periodTo: string;
    openingBalance: number;
    closingBalance: number;
    lines?: { date: string; description?: string; reference?: string; amount: number }[];
  }) => (await api.post<BankStatementDto>("/accountingplus/bank/statements", dto)).data,
  importCsv: async (file: File, header: { bankAccountId: number; periodFrom: string; periodTo: string; openingBalance: number; closingBalance: number }) => {
    const form = new FormData();
    form.append("file", file);
    form.append("bankAccountId", String(header.bankAccountId));
    form.append("periodFrom", header.periodFrom);
    form.append("periodTo", header.periodTo);
    form.append("openingBalance", String(header.openingBalance));
    form.append("closingBalance", String(header.closingBalance));
    const res = await api.post<CsvImportResultDto>("/accountingplus/bank/statements/import", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },
  getStatement: async (id: number, matchStatus?: string) =>
    (await api.get<BankStatementDetailDto>(`/accountingplus/bank/statements/${id}${matchStatus ? `?matchStatus=${matchStatus}` : ""}`)).data,
  deleteStatement: async (id: number) => {
    await api.delete(`/accountingplus/bank/statements/${id}`);
  },
  suggestions: async (statementId: number, lineId: number) =>
    (await api.get<BankMatchSuggestionDto[]>(`/accountingplus/bank/statements/${statementId}/lines/${lineId}/suggestions`)).data ?? [],
  match: async (statementId: number, lineId: number, journalEntryLineId: number) =>
    (await api.post<BankStatementLineDto>(`/accountingplus/bank/statements/${statementId}/lines/${lineId}/match`, { journalEntryLineId })).data,
  unmatch: async (statementId: number, lineId: number) =>
    (await api.post<BankStatementLineDto>(`/accountingplus/bank/statements/${statementId}/lines/${lineId}/unmatch`)).data,
  exclude: async (statementId: number, lineId: number, note?: string) =>
    (await api.post<BankStatementLineDto>(`/accountingplus/bank/statements/${statementId}/lines/${lineId}/exclude`, { note })).data,
  summary: async (statementId: number) =>
    (await api.get<BankReconciliationSummaryDto>(`/accountingplus/bank/statements/${statementId}/summary`)).data,
  reconcile: async (statementId: number) =>
    (await api.post<BankReconciliationSummaryDto>(`/accountingplus/bank/statements/${statementId}/reconcile`)).data,
};

// ---------- supplier bills ----------
export type SupplierBillPaymentDto = {
  id: number;
  billId: number;
  paidOn: string;
  amount: number;
  method?: string | null;
  reference?: string | null;
  cashGlAccountId: number;
  journalEntryId?: number | null;
  createdBy?: string | null;
  createdOn: string;
};

export type SupplierBillDto = {
  id: number;
  supplierId: number;
  supplierName?: string | null;
  billNumber: string;
  billDate: string;
  dueDate: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  paidAmount: number;
  outstanding: number;
  status: "Draft" | "Open" | "PartiallyPaid" | "Paid" | "Void" | string;
  purchaseId?: number | null;
  expenseGlAccountId: number;
  payableGlAccountId: number;
  journalEntryId?: number | null;
  notes?: string | null;
  createdOn: string;
  createdBy?: string | null;
  branchId?: number | null;
  payments: SupplierBillPaymentDto[];
};

export type SupplierBillCreateDto = {
  supplierId: number;
  billNumber: string;
  billDate: string;
  dueDate: string;
  subtotal: number;
  taxAmount: number;
  expenseGlAccountId: number;
  payableGlAccountId?: number | null;
  purchaseId?: number | null;
  notes?: string | null;
  status: "Draft" | "Open";
};

export type SupplierBillPaymentCreateDto = {
  paidOn: string;
  amount: number;
  method?: string | null;
  reference?: string | null;
  cashGlAccountId: number;
};

export type AgingBucketsDto = {
  current: number;
  days1To30: number;
  days31To60: number;
  days61To90: number;
  over90: number;
  total: number;
};

export type ApAgingRowDto = { supplierId: number; supplierName: string; openBills: number; buckets: AgingBucketsDto };
export type ApAgingReportDto = { asOf: string; rows: ApAgingRowDto[]; totals: AgingBucketsDto };
export type ArAgingRowDto = { userId?: number | null; customerName: string; openInvoices: number; buckets: AgingBucketsDto };
export type ArAgingReportDto = { asOf: string; rows: ArAgingRowDto[]; totals: AgingBucketsDto };
export type DueSoonBillDto = {
  id: number;
  supplierId: number;
  supplierName?: string | null;
  billNumber: string;
  dueDate: string;
  daysUntilDue: number;
  outstanding: number;
  status: string;
};

export const bills = {
  list: async (params: { supplierId?: number; status?: string; from?: string; to?: string; search?: string; page?: number; pageSize?: number }) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") q.append(k, String(v));
    });
    return (await api.get<PaginatedResponse<SupplierBillDto>>(`/accountingplus/bills?${q.toString()}`)).data;
  },
  get: async (id: number) => (await api.get<SupplierBillDto>(`/accountingplus/bills/${id}`)).data,
  create: async (dto: SupplierBillCreateDto) => (await api.post<SupplierBillDto>("/accountingplus/bills", dto)).data,
  open: async (id: number) => (await api.post<SupplierBillDto>(`/accountingplus/bills/${id}/open`)).data,
  addPayment: async (id: number, dto: SupplierBillPaymentCreateDto) =>
    (await api.post<SupplierBillDto>(`/accountingplus/bills/${id}/payments`, dto)).data,
  void: async (id: number, reason?: string) => (await api.post<SupplierBillDto>(`/accountingplus/bills/${id}/void`, { reason })).data,
  deleteDraft: async (id: number) => {
    await api.delete(`/accountingplus/bills/${id}`);
  },
  aging: async (asOf?: string) => (await api.get<ApAgingReportDto>(`/accountingplus/bills/aging${asOf ? `?asOf=${asOf}` : ""}`)).data,
  dueSoon: async (days = 7) => (await api.get<DueSoonBillDto[]>(`/accountingplus/bills/due-soon?days=${days}`)).data ?? [],
};

export const receivables = {
  aging: async (asOf?: string) => (await api.get<ArAgingReportDto>(`/accountingplus/receivables/aging${asOf ? `?asOf=${asOf}` : ""}`)).data,
};

// ---------- tax ----------
export type TaxRateDto = { id: number; name: string; ratePercent: number; isDefault: boolean; isActive: boolean; appliesTo: string };
export type TaxRateUpsertDto = Omit<TaxRateDto, "id">;
export type VatReportRowDto = {
  year: number;
  month: number;
  salesGross: number;
  salesNet: number;
  outputVat: number;
  purchasesNet: number;
  inputVat: number;
  netPayable: number;
};
export type VatReportDto = {
  from: string;
  to: string;
  salesRatePercent: number;
  inclusive: boolean;
  rows: VatReportRowDto[];
  totalOutputVat: number;
  totalInputVat: number;
  totalNetPayable: number;
};

export const tax = {
  listRates: async (includeInactive = false) => (await api.get<TaxRateDto[]>(`/accountingplus/tax/rates?includeInactive=${includeInactive}`)).data ?? [],
  createRate: async (dto: TaxRateUpsertDto) => (await api.post<TaxRateDto>("/accountingplus/tax/rates", dto)).data,
  updateRate: async (id: number, dto: TaxRateUpsertDto) => (await api.put<TaxRateDto>(`/accountingplus/tax/rates/${id}`, dto)).data,
  deleteRate: async (id: number) => {
    await api.delete(`/accountingplus/tax/rates/${id}`);
  },
  vatReport: async (from: string, to: string, inclusive = true) =>
    (await api.get<VatReportDto>(`/accountingplus/tax/vat-report?from=${from}&to=${to}&inclusive=${inclusive}`)).data,
};

// ---------- fixed assets ----------
export type FixedAssetDto = {
  id: number;
  name: string;
  category?: string | null;
  acquiredOn: string;
  cost: number;
  salvageValue: number;
  usefulLifeMonths: number;
  method: "StraightLine" | "DecliningBalance" | string;
  assetGlAccountId: number;
  accumulatedDepGlAccountId: number;
  depExpenseGlAccountId: number;
  status: "Active" | "Disposed" | string;
  disposedOn?: string | null;
  disposalProceeds?: number | null;
  notes?: string | null;
  branchId?: number | null;
  accumulatedDepreciation: number;
  netBookValue: number;
  depreciationEntriesCount: number;
};

export type FixedAssetUpsertDto = {
  name: string;
  category?: string | null;
  acquiredOn: string;
  cost: number;
  salvageValue: number;
  usefulLifeMonths: number;
  method: string;
  assetGlAccountId: number;
  accumulatedDepGlAccountId: number;
  depExpenseGlAccountId: number;
  notes?: string | null;
};

export type DepreciationScheduleRowDto = {
  year: number;
  month: number;
  amount: number;
  accumulatedAfter: number;
  netBookValueAfter: number;
  posted: boolean;
};

export type DepreciationRunResultDto = {
  year: number;
  month: number;
  assetsProcessed: number;
  posted: number;
  skipped: number;
  totalAmount: number;
  messages: string[];
};

export type AssetDisposeDto = { disposedOn: string; proceeds: number; cashGlAccountId: number; gainLossGlAccountId: number; notes?: string | null };

export type AssetRegisterSummaryDto = {
  activeAssets: number;
  disposedAssets: number;
  totalCost: number;
  totalAccumulatedDepreciation: number;
  totalNetBookValue: number;
  assets: FixedAssetDto[];
};

export const assets = {
  list: async (status?: string) => (await api.get<FixedAssetDto[]>(`/accountingplus/assets${status ? `?status=${status}` : ""}`)).data ?? [],
  summary: async () => (await api.get<AssetRegisterSummaryDto>("/accountingplus/assets/summary")).data,
  create: async (dto: FixedAssetUpsertDto) => (await api.post<FixedAssetDto>("/accountingplus/assets", dto)).data,
  update: async (id: number, dto: FixedAssetUpsertDto) => (await api.put<FixedAssetDto>(`/accountingplus/assets/${id}`, dto)).data,
  delete: async (id: number) => {
    await api.delete(`/accountingplus/assets/${id}`);
  },
  schedule: async (id: number) => (await api.get<DepreciationScheduleRowDto[]>(`/accountingplus/assets/${id}/schedule`)).data ?? [],
  runDepreciation: async (year: number, month: number, assetId?: number) =>
    (await api.post<DepreciationRunResultDto>(`/accountingplus/assets/run-depreciation?year=${year}&month=${month}${assetId ? `&assetId=${assetId}` : ""}`)).data,
  dispose: async (id: number, dto: AssetDisposeDto) => (await api.post<FixedAssetDto>(`/accountingplus/assets/${id}/dispose`, dto)).data,
};

// ---------- periods ----------
export type AccountingPeriodDto = { year: number; month: number; isLocked: boolean; lockedOn?: string | null; lockedBy?: string | null; note?: string | null };

export const periods = {
  list: async (year: number) => (await api.get<AccountingPeriodDto[]>(`/accountingplus/periods?year=${year}`)).data ?? [],
  lock: async (year: number, month: number, note?: string) => (await api.post<AccountingPeriodDto>("/accountingplus/periods/lock", { year, month, note })).data,
  unlock: async (year: number, month: number) => (await api.post<AccountingPeriodDto>("/accountingplus/periods/unlock", { year, month })).data,
};

export const money = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString() : "");

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default { bank, bills, receivables, tax, assets, periods, getPostableAccounts, getSuppliers };
