import { useEffect, useState } from 'react';
import { TransactionAuditLog, transactionAuditLogService } from '../../services/transactionAuditLogService';
import { AuditActionBadge } from '../../components/AuditLog/AuditActionBadge';

interface Props {
  transactionId: number;
  onClose: () => void;
}

export const TransactionAuditDrawer = ({ transactionId, onClose }: Props) => {
  const [logs, setLogs]       = useState<TransactionAuditLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    transactionAuditLogService
      .getByTransaction(transactionId)
      .then(setLogs)
      .finally(() => setLoading(false));
  }, [transactionId]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-2xl bg-white dark:bg-gray-800 shadow-xl flex flex-col h-full overflow-hidden text-gray-800 dark:text-white/90">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-white/[0.03] text-gray-800 dark:text-white/90">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">Audit Trail</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Transaction #{transactionId}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-xl font-bold leading-none"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <p className="text-center text-gray-400 mt-10">Loading...</p>
          ) : logs.length === 0 ? (
            <p className="text-center text-gray-400 mt-10">No audit logs for this transaction.</p>
          ) : (
            <ol className="relative border-l border-gray-200 dark:border-gray-700 space-y-6 ml-3">
              {logs.map((log) => (
                <li key={log.id} className="ml-6">
                  {/* Timeline dot */}
                  <span className="absolute -left-3 w-6 h-6 rounded-full bg-white dark:bg-gray-800 border-2 border-blue-400 flex items-center justify-center text-gray-800 dark:text-white/90">
                    <span className="w-2 h-2 rounded-full bg-blue-400" />
                  </span>

                  <div className="bg-gray-50 dark:bg-white/[0.03] rounded-lg p-4 border border-gray-100 dark:border-gray-800 text-gray-800 dark:text-white/90">
                    <div className="flex items-center justify-between mb-2">
                      <AuditActionBadge action={log.action} />
                      <span className="text-xs text-gray-400">
                        {new Date(log.changedOn).toLocaleString('en-GB', {
                          day: '2-digit', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit', second: '2-digit',
                        })}
                      </span>
                    </div>

                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      By: <span className="text-blue-600 dark:text-blue-400">{log.changedBy}</span>
                    </p>

                    {log.fieldChanged && (
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <span className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded">
                          {log.fieldChanged}
                        </span>
                        {log.oldValue && (
                          <span className="bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400 px-2 py-0.5 rounded">
                            {log.oldValue}
                          </span>
                        )}
                        {log.newValue && (
                          <>
                            <span className="text-gray-400">→</span>
                            <span className="bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400 px-2 py-0.5 rounded">
                              {log.newValue}
                            </span>
                          </>
                        )}
                      </div>
                    )}

                    {log.notes && (
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 italic">{log.notes}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
};