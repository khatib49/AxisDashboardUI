import React, { useEffect, useState } from 'react';
import { TransactionAuditLog, transactionAuditLogService } from '../../services/transactionAuditLogService';
import { AuditActionBadge } from '../../components/AuditLog/AuditActionBadge';

const PAGE_SIZE = 50;

export const TransactionAuditLogsPage = () => {
  const [logs, setLogs]           = useState<TransactionAuditLog[]>([]);
  const [totalCount, setTotal]    = useState(0);
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  // Filters
  const [filterTxId, setFilterTxId]     = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterUser, setFilterUser]     = useState('');

  useEffect(() => {
    fetchLogs();
  }, [page]);

const fetchLogs = async () => {
  setLoading(true);
  setError(null);
  try {
    const result = await transactionAuditLogService.getAll(page, PAGE_SIZE);
    setLogs(result.items ?? []);      // ← was just result
    setTotal(result.totalCount ?? 0);
  } catch {
    setError('Failed to load audit logs.');
    setLogs([]);                      // ← safety fallback
  } finally {
    setLoading(false);
  }
};

  const filtered = logs.filter((l) => {
    const txMatch     = filterTxId     ? String(l.transactionId).includes(filterTxId) : true;
    const actionMatch = filterAction   ? l.action.toLowerCase().includes(filterAction.toLowerCase()) : true;
    const userMatch   = filterUser     ? l.changedBy.toLowerCase().includes(filterUser.toLowerCase()) : true;
    return txMatch && actionMatch && userMatch;
  });

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Transaction Audit Logs</h1>
        <p className="text-sm text-gray-500 mt-1">
          Read-only. Every change to any transaction is recorded here.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Filter by Transaction ID..."
          value={filterTxId}
          onChange={(e) => setFilterTxId(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="text"
          placeholder="Filter by action..."
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="text"
          placeholder="Filter by user..."
          value={filterUser}
          onChange={(e) => setFilterUser(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={() => { setFilterTxId(''); setFilterAction(''); setFilterUser(''); }}
          className="text-sm text-gray-500 hover:text-gray-800 underline"
        >
          Clear
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['ID', 'Transaction', 'Changed By', 'Changed On', 'Action', 'Field', 'Old Value', 'New Value', 'Notes'].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={9} className="text-center py-10 text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-10 text-gray-400">
                  No audit logs found.
                </td>
              </tr>
            ) : (
              filtered.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-500">{log.id}</td>
                  <td className="px-4 py-3 font-medium text-blue-600">#{log.transactionId}</td>
                  <td className="px-4 py-3 text-gray-700">{log.changedBy}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {new Date(log.changedOn).toLocaleString('en-GB', {
                      day: '2-digit', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit', second: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <AuditActionBadge action={log.action} />
                  </td>
                  <td className="px-4 py-3 text-gray-600">{log.fieldChanged ?? '—'}</td>
                  <td className="px-4 py-3 text-red-500">{log.oldValue ?? '—'}</td>
                  <td className="px-4 py-3 text-green-600">{log.newValue ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-xs truncate" title={log.notes ?? ''}>
                    {log.notes ?? '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
        <span>
          Showing {filtered.length} of {totalCount} logs
        </span>
        <div className="flex gap-2">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100"
          >
            Previous
          </button>
          <span className="px-3 py-1">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};