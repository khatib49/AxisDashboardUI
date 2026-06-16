// src/api/accountsApi.ts

import api from "./api";

// ============================================
// TYPE DEFINITIONS
// ============================================

export type AccountType = {
  id: number;
  typeName: string;
  normalBalance: 'Debit' | 'Credit';
  displayOrder: number;
  description?: string;
  isActive: boolean;
};

export type Account = {
  id: number;
  accountNumber: string;
  accountName: string;
  accountTypeId: number;
  accountTypeName: string;
  parentAccountId?: number;
  parentAccountName?: string;
  description?: string;
  currentBalance: number;
  isActive: boolean;
  isSystemAccount: boolean;
  allowManualEntry: boolean;
  createdAt: string;
};

export type AccountCreate = {
  accountNumber: string;
  accountName: string;
  accountTypeId: number;
  parentAccountId?: number;
  description?: string;
  allowManualEntry?: boolean;
};

export type AccountUpdate = {
  accountName: string;
  description?: string;
  isActive: boolean;
  allowManualEntry: boolean;
};

export type AccountBalance = {
  accountId: number;
  accountNumber: string;
  accountName: string;
  accountTypeName: string;
  debitTotal: number;
  creditTotal: number;
  balance: number;
  normalBalance: 'Debit' | 'Credit';
  // Rollup balance = this account's balance plus the sum of every descendant
  // account's balance. For header rows on the Chart of Accounts this is the
  // number people actually want (e.g. "Utilities Expense" total including
  // its child leaf accounts).
  rollupBalance?: number;
};

export type AccountHierarchy = {
  id: number;
  accountNumber: string;
  accountName: string;
  accountTypeId: number;
  accountTypeName: string;
  parentAccountId?: number;
  currentBalance: number;
  isActive: boolean;
  children: AccountHierarchy[];
};

export type AccountSummary = {
  accountTypeName: string;
  totalBalance: number;
  accounts: Account[];
};

export type AccountSearch = {
  searchTerm?: string;
  accountTypeId?: number;
  parentAccountId?: number;
  isActive?: boolean;
  pageNumber?: number;
  pageSize?: number;
};

export type PagedResult<T> = {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
};

export type TrialBalance = {
  asOfDate: string;
  lines: TrialBalanceLine[];
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
};

export type TrialBalanceLine = {
  accountNumber: string;
  accountName: string;
  accountTypeName: string;
  debitBalance: number;
  creditBalance: number;
};

export type GeneralLedger = {
  accountId: number;
  accountNumber: string;
  accountName: string;
  fromDate: string;
  toDate: string;
  openingBalance: number;
  transactions: GeneralLedgerLine[];
  closingBalance: number;
};

export type GeneralLedgerLine = {
  date: string;
  entryNumber: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
  isPending?: boolean;
  // Surfaces JournalEntryLine.Id so the Transactions Report modal can
  // checkbox-select lines and POST them to /Accounts/repoint-lines.
  lineId?: number;
  journalEntryId?: number;
  isVoided?: boolean;
};

export type RepointLinesRequest = {
  lineIds: number[];
  newAccountId: number;
  reason?: string;
};

export type RepointLinesResult = {
  processed: number;
  skipped: number;
  failed: number;
  errors: string[];
};

export type AccountValidation = {
  isValid: boolean;
  errors: string[];
  accountNumberUnique: boolean;
  accountNameValid: boolean;
  parentAccountValid: boolean;
};

// ============================================
// ACCOUNT TYPES
// ============================================

export const getAccountTypes = async (): Promise<AccountType[]> => {
  const res = await api.get<{ data: AccountType[] }>('/Accounts/types');
  return res.data.data || [];
};

export const getAccountTypeById = async (id: number): Promise<AccountType> => {
  const res = await api.get<{ data: AccountType }>(`/Accounts/types/${id}`);
  return res.data.data;
};

// ============================================
// ACCOUNTS CRUD
// ============================================

export const createAccount = async (account: AccountCreate): Promise<Account> => {
  const res = await api.post<{ data: Account }>('/Accounts', account);
  return res.data.data;
};

export const updateAccount = async (id: number, account: AccountUpdate): Promise<Account> => {
  const res = await api.put<{ data: Account }>(`/Accounts/${id}`, account);
  return res.data.data;
};

export const deactivateAccount = async (id: number): Promise<void> => {
  await api.delete(`/Accounts/${id}`);
};

export const getAccountById = async (id: number): Promise<Account> => {
  const res = await api.get<{ data: Account }>(`/Accounts/${id}`);
  return res.data.data;
};

export const getAccountByNumber = async (accountNumber: string): Promise<Account> => {
  const res = await api.get<{ data: Account }>(`/Accounts/by-number/${accountNumber}`);
  return res.data.data;
};

export const getAllAccounts = async (
  accountTypeId?: number,
  isActive?: boolean
): Promise<Account[]> => {
  const params = new URLSearchParams();
  if (accountTypeId) params.append('accountTypeId', accountTypeId.toString());
  if (isActive !== undefined) params.append('isActive', isActive.toString());
  
  const res = await api.get<{ data: Account[] }>(`/Accounts?${params.toString()}`);
  return res.data.data || [];
};

export const searchAccounts = async (search: AccountSearch): Promise<PagedResult<Account>> => {
  const res = await api.post<{ data: PagedResult<Account> }>('/Accounts/search', search);
  return res.data.data;
};

export const getAccountHierarchy = async (accountTypeId?: number): Promise<AccountHierarchy[]> => {
  const params = accountTypeId ? `?accountTypeId=${accountTypeId}` : '';
  const res = await api.get<{ data: AccountHierarchy[] }>(`/Accounts/hierarchy${params}`);
  return res.data.data || [];
};

// ============================================
// BALANCES & REPORTING
// ============================================

export const getAccountBalance = async (id: number): Promise<AccountBalance> => {
  const res = await api.get<{ data: AccountBalance }>(`/Accounts/${id}/balance`);
  return res.data.data;
};

export const getAllAccountBalances = async (): Promise<AccountBalance[]> => {
  const res = await api.get<{ data: AccountBalance[] }>('/Accounts/balances');
  return res.data.data || [];
};

export const getAccountSummary = async (): Promise<AccountSummary[]> => {
  const res = await api.get<{ data: AccountSummary[] }>('/Accounts/summary');
  return res.data.data || [];
};

export const getTrialBalance = async (asOfDate?: string): Promise<TrialBalance> => {
  const params = asOfDate ? `?asOfDate=${asOfDate}` : '';
  const res = await api.get<{ data: TrialBalance }>(`/Accounts/trial-balance${params}`);
  return res.data.data;
};

export const getGeneralLedger = async (
  accountId: number,
  fromDate?: string,
  toDate?: string
): Promise<GeneralLedger> => {
  const params = new URLSearchParams();
  if (fromDate) params.append('fromDate', fromDate);
  if (toDate) params.append('toDate', toDate);

  const res = await api.get<{ data: GeneralLedger }>(`/Accounts/${accountId}/general-ledger?${params.toString()}`);
  return res.data.data;
};

// Bulk-reclassify selected journal-entry lines onto a different account.
// Wired to the Transactions Report modal on the Chart of Accounts.
export const repointJournalEntryLines = async (
  body: RepointLinesRequest
): Promise<RepointLinesResult> => {
  const res = await api.post<{ data: RepointLinesResult }>('/Accounts/repoint-lines', body);
  return res.data.data;
};

// Hierarchy audit — read-only.
export type HierarchyAccountRef = {
  id: number;
  accountNumber: string;
  accountName: string;
  accountTypeId: number;
  accountTypeName: string;
  isActive: boolean;
};

export type HierarchyTypeMismatch = {
  child: HierarchyAccountRef;
  parent: HierarchyAccountRef;
};

export type HierarchyHeaderIssue = {
  account: HierarchyAccountRef;
  childCount: number;
  allowsManualEntry: boolean;
  directBalance: number;
};

export type AccountHierarchyAudit = {
  totalAccounts: number;
  totalActive: number;
  typeMismatches: HierarchyTypeMismatch[];
  headersAllowingManualEntry: HierarchyHeaderIssue[];
  headersWithDirectPostings: HierarchyHeaderIssue[];
  inactiveParentsWithActiveChildren: HierarchyAccountRef[];
};

export const getHierarchyAudit = async (): Promise<AccountHierarchyAudit> => {
  const res = await api.get<{ data: AccountHierarchyAudit }>('/Accounts/hierarchy-audit');
  return res.data.data;
};

// ============================================
// VALIDATION
// ============================================

export const validateAccount = async (account: AccountCreate): Promise<AccountValidation> => {
  const res = await api.post<AccountValidation>('/Accounts/validate', account);
  return res.data;
};

// ============================================
// DEFAULT EXPORT
// ============================================

export default {
  getAccountTypes,
  getAccountTypeById,
  createAccount,
  updateAccount,
  deactivateAccount,
  getAccountById,
  getAccountByNumber,
  getAllAccounts,
  searchAccounts,
  getAccountHierarchy,
  getAccountBalance,
  getAllAccountBalances,
  getAccountSummary,
  getTrialBalance,
  getGeneralLedger,
  repointJournalEntryLines,
  validateAccount,
};