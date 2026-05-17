// src/api/journalApi.ts

import api from "./api";

// ============================================
// TYPE DEFINITIONS
// ============================================

export type JournalEntry = {
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
};

export type JournalEntryLine = {
  id: number;
  journalEntryId: number;
  accountId: number;
  accountNumber: string;
  accountName: string;
  debitAmount: number;
  creditAmount: number;
  description?: string;
  lineNumber: number;
};

export type JournalEntryCreate = {
  entryDate: string;
  description: string;
  referenceType: string;
  referenceId?: number;
  lines: JournalEntryLineCreate[];
};

export type JournalEntryLineCreate = {
  accountId: number;
  debitAmount: number;
  creditAmount: number;
  description?: string;
};

export type JournalEntryUpdate = {
  entryDate: string;
  description: string;
  lines: JournalEntryLineCreate[];
};

export type VoidJournalEntry = {
  journalEntryId: number;
  voidReason: string;
};

export type JournalEntrySearch = {
  fromDate?: string;
  toDate?: string;
  referenceType?: string;
  referenceId?: number;
  isPosted?: boolean;
  isVoided?: boolean;
  pageNumber?: number;
  pageSize?: number;
};

export type JournalEntryValidation = {
  isValid: boolean;
  errors: string[];
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
};

export type PagedResult<T> = {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
};

// ============================================
// JOURNAL ENTRY CRUD
// ============================================

export const createJournalEntry = async (entry: JournalEntryCreate): Promise<JournalEntry> => {
  const res = await api.post<{ data: JournalEntry }>('/Journal', entry);
  return res.data.data;
};

export const updateJournalEntry = async (
  id: number,
  entry: JournalEntryUpdate
): Promise<JournalEntry> => {
  const res = await api.put<{ data: JournalEntry }>(`/Journal/${id}`, entry);
  return res.data.data;
};

export const postJournalEntry = async (id: number): Promise<JournalEntry> => {
  const res = await api.post<{ data: JournalEntry }>(`/Journal/${id}/post`);
  return res.data.data;
};

export const voidJournalEntry = async (id: number, voidReason: string): Promise<JournalEntry> => {
  const payload: VoidJournalEntry = { journalEntryId: id, voidReason };
  const res = await api.post<{ data: JournalEntry }>(`/Journal/${id}/void`, payload);
  return res.data.data;
};

export const deleteJournalEntry = async (id: number): Promise<void> => {
  await api.delete(`/Journal/${id}`);
};

// ============================================
// QUERY
// ============================================

export const getJournalEntryById = async (id: number): Promise<JournalEntry> => {
  const res = await api.get<{ data: JournalEntry }>(`/Journal/${id}`);
  return res.data.data;
};

export const getJournalEntryByNumber = async (entryNumber: string): Promise<JournalEntry> => {
  const res = await api.get<{ data: JournalEntry }>(`/Journal/by-number/${entryNumber}`);
  return res.data.data;
};

export const searchJournalEntries = async (
  search: JournalEntrySearch
): Promise<PagedResult<JournalEntry>> => {
  const res = await api.post<{ data: PagedResult<JournalEntry> }>('/Journal/search', search);
  return res.data.data;
};

export const getJournalEntriesByReference = async (
  referenceType: string,
  referenceId: number
): Promise<JournalEntry[]> => {
  const res = await api.get<{ data: JournalEntry[] }>(
    `/Journal/by-reference/${referenceType}/${referenceId}`
  );
  return res.data.data || [];
};

// ============================================
// AUTOMATED ENTRIES
// ============================================

export const createJournalEntryFromTransaction = async (
  transactionId: number
): Promise<JournalEntry> => {
  const res = await api.post<{ data: JournalEntry }>(`/Journal/from-transaction/${transactionId}`);
  return res.data.data;
};

export const createJournalEntryFromExpense = async (expenseId: number): Promise<JournalEntry> => {
  const res = await api.post<{ data: JournalEntry }>(`/Journal/from-expense/${expenseId}`);
  return res.data.data;
};

// ============================================
// VALIDATION
// ============================================

export const validateJournalEntry = async (
  entry: JournalEntryCreate
): Promise<JournalEntryValidation> => {
  const res = await api.post<JournalEntryValidation>('/Journal/validate', entry);
  return res.data;
};

export const canPostJournalEntry = async (id: number): Promise<boolean> => {
  const res = await api.get<{ data: boolean }>(`/Journal/${id}/can-post`);
  return res.data.data || false;
};

export const canVoidJournalEntry = async (id: number): Promise<boolean> => {
  const res = await api.get<{ data: boolean }>(`/Journal/${id}/can-void`);
  return res.data.data || false;
};

// ============================================
// UTILITIES
// ============================================

export const generateEntryNumber = async (): Promise<string> => {
  const res = await api.get<{ entryNumber: string }>('/Journal/next-entry-number');
  return res.data.entryNumber;
};

export const recalculateAccountBalances = async (): Promise<void> => {
  await api.post('/Journal/recalculate-balances');
};

// ============================================
// DEFAULT EXPORT
// ============================================

export default {
  createJournalEntry,
  updateJournalEntry,
  postJournalEntry,
  voidJournalEntry,
  deleteJournalEntry,
  getJournalEntryById,
  getJournalEntryByNumber,
  searchJournalEntries,
  getJournalEntriesByReference,
  createJournalEntryFromTransaction,
  createJournalEntryFromExpense,
  validateJournalEntry,
  canPostJournalEntry,
  canVoidJournalEntry,
  generateEntryNumber,
  recalculateAccountBalances,
};