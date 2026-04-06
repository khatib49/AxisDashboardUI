import api from './api'; // your existing axios instance

export interface TransactionAuditLog {
  id: number;
  transactionId: number;
  changedBy: string;
  changedOn: string; // ISO string
  action: string;
  fieldChanged: string | null;
  oldValue: string | null;
  newValue: string | null;
  notes: string | null;
}

export interface PaginatedAuditLogs {
  totalCount: number;
  data: TransactionAuditLog[];
  page: number;
  pageSize: number;
}

export const transactionAuditLogService = {
  // Get all logs (paginated) — for the main admin page
  getAll: async (page = 1, pageSize = 50): Promise<PaginatedAuditLogs> => {
    const { data } = await api.get('/transaction-audit-logs', {
      params: { page, pageSize },
    });
    return data;
  },

  // Get logs for a specific transaction — for the detail drawer
  getByTransaction: async (transactionId: number): Promise<TransactionAuditLog[]> => {
    const { data } = await api.get(`/transaction-audit-logs/${transactionId}`);
    return data;
  },
};