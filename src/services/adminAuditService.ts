import api from './api';

export interface AdminAuditLog {
  id: number;
  entityType: string;
  entityId: number | null;
  entityName: string | null;
  action: 'Created' | 'Updated' | 'Deleted' | string;
  // Both come back as raw JSON strings from the API — the UI decodes them.
  fieldChanges: string | null;
  snapshot: string | null;
  changedBy: string | null;
  changedOn: string; // ISO
}

export interface PaginatedAdminAuditLogs {
  totalCount: number;
  data: AdminAuditLog[];
  pageNumber: number;
  pageSize: number;
}

export interface AdminAuditFilter {
  entityType?: string;
  action?: string;
  changedBy?: string;
  entityId?: number;
  from?: string; // YYYY-MM-DD
  to?: string;   // YYYY-MM-DD
  page?: number;
  pageSize?: number;
}

export const adminAuditService = {
  list: async (filter: AdminAuditFilter = {}): Promise<PaginatedAdminAuditLogs> => {
    const { data } = await api.get('/admin-audit', {
      params: {
        page: 1,
        pageSize: 50,
        ...filter,
      },
    });
    return data;
  },

  entityTypes: async (): Promise<string[]> => {
    const { data } = await api.get('/admin-audit/entity-types');
    return data;
  },
};
