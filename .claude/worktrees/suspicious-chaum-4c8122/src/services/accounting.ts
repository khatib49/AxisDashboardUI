// src/types/accounting.ts

// ============================================
// ACCOUNT TYPES
// ============================================

export interface AccountType {
  id: number;
  typeName: string;
  normalBalance: 'Debit' | 'Credit';
  displayOrder: number;
  description?: string;
  isActive: boolean;
}

// ============================================
// ACCOUNT
// ============================================

export interface Account {
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
}

export interface AccountCreate {
  accountNumber: string;
  accountName: string;
  accountTypeId: number;
  parentAccountId?: number;
  description?: string;
  allowManualEntry?: boolean;
}

export interface AccountUpdate {
  accountName: string;
  description?: string;
  isActive: boolean;
  allowManualEntry: boolean;
}

export interface AccountBalance {
  accountId: number;
  accountNumber: string;
  accountName: string;
  accountTypeName: string;
  debitTotal: number;
  creditTotal: number;
  balance: number;
  normalBalance: 'Debit' | 'Credit';
}

export interface AccountHierarchy {
  id: number;
  accountNumber: string;
  accountName: string;
  accountTypeId: number;
  accountTypeName: string;
  parentAccountId?: number;
  currentBalance: number;
  isActive: boolean;
  children: AccountHierarchy[];
}

export interface AccountSummary {
  accountTypeName: string;
  totalBalance: number;
  accounts: Account[];
}

// ============================================
// JOURNAL ENTRY
// ============================================

export interface JournalEntry {
  id: number;
  entryNumber: string;
  entryDate: string;
  description: string;
  referenceType: string;
  referenceId?: number;
  totalAmount: number;
  isPosted: boolean;
  postedAt?: string;
  isVoided: boolean;
  voidedAt?: string;
  voidReason?: string;
  createdAt: string;
  lines: JournalEntryLine[];
}

export interface JournalEntryLine {
  id: number;
  journalEntryId: number;
  accountId: number;
  accountNumber: string;
  accountName: string;
  debitAmount: number;
  creditAmount: number;
  description?: string;
  lineNumber: number;
}

export interface JournalEntryCreate {
  entryDate: string;
  description: string;
  referenceType: string;
  referenceId?: number;
  lines: JournalEntryLineCreate[];
}

export interface JournalEntryLineCreate {
  accountId: number;
  debitAmount: number;
  creditAmount: number;
  description?: string;
}

export interface JournalEntryUpdate {
  entryDate: string;
  description: string;
  lines: JournalEntryLineCreate[];
}

export interface VoidJournalEntry {
  journalEntryId: number;
  voidReason: string;
}

// ============================================
// REPORTS
// ============================================

export interface TrialBalance {
  asOfDate: string;
  lines: TrialBalanceLine[];
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
}

export interface TrialBalanceLine {
  accountNumber: string;
  accountName: string;
  accountTypeName: string;
  debitBalance: number;
  creditBalance: number;
}

export interface GeneralLedger {
  accountId: number;
  accountNumber: string;
  accountName: string;
  fromDate: string;
  toDate: string;
  openingBalance: number;
  transactions: GeneralLedgerLine[];
  closingBalance: number;
}

export interface GeneralLedgerLine {
  date: string;
  entryNumber: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

// ============================================
// SEARCH & FILTERS
// ============================================

export interface AccountSearch {
  searchTerm?: string;
  accountTypeId?: number;
  parentAccountId?: number;
  isActive?: boolean;
  pageNumber?: number;
  pageSize?: number;
}

export interface JournalEntrySearch {
  fromDate?: string;
  toDate?: string;
  referenceType?: string;
  referenceId?: number;
  isPosted?: boolean;
  isVoided?: boolean;
  pageNumber?: number;
  pageSize?: number;
}

// ============================================
// PAGINATION
// ============================================

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
}

// ============================================
// API RESPONSES
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  error?: string;
  message: string;
  data?: T;
}

// ============================================
// VALIDATION
// ============================================

export interface JournalEntryValidation {
  isValid: boolean;
  errors: string[];
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
}

export interface AccountValidation {
  isValid: boolean;
  errors: string[];
  accountNumberUnique: boolean;
  accountNameValid: boolean;
  parentAccountValid: boolean;
}

// ============================================
// MIGRATION
// ============================================

export interface MigrationResult {
  totalRecords: number;
  successCount: number;
  skippedCount: number;
  errorCount: number;
  errors: string[];
  skippedReasons: string[];
  wasDryRun: boolean;
}

export interface MigrationStats {
  totalTransactions: number;
  transactionsWithJournalEntries: number;
  transactionsWithoutJournalEntries: number;
  totalExpenses: number;
  expensesWithJournalEntries: number;
  expensesWithoutJournalEntries: number;
  totalTransactionAmount: number;
  totalExpenseAmount: number;
}