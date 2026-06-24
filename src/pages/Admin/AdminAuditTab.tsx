import { useEffect, useMemo, useState } from 'react';
import {
  AdminAuditLog,
  adminAuditService,
} from '../../services/adminAuditService';

const PAGE_SIZE = 50;

const ACTIONS = ['', 'Created', 'Updated', 'Deleted'];

const actionColor = (a: string) => {
  switch (a) {
    case 'Created': return 'bg-green-100 text-green-700';
    case 'Updated': return 'bg-blue-100 text-blue-700';
    case 'Deleted': return 'bg-red-100 text-red-700';
    default:        return 'bg-gray-100 text-gray-600';
  }
};

// Pretty-print a value coming out of the JSON delta. Strings are returned
// as-is, primitives are stringified, nulls render as em-dash. Long values
// get truncated so the row doesn't blow up.
const fmt = (v: unknown): string => {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    const s = JSON.stringify(v);
    return s.length > 80 ? s.slice(0, 80) + '…' : s;
  } catch {
    return String(v);
  }
};

interface DeltaRow {
  field: string;
  oldValue: string;
  newValue: string;
}

const parseDeltas = (json: string | null): DeltaRow[] => {
  if (!json) return [];
  try {
    const obj = JSON.parse(json) as Record<string, { old: unknown; new: unknown }>;
    return Object.entries(obj).map(([field, change]) => ({
      field,
      oldValue: fmt(change?.old),
      newValue: fmt(change?.new),
    }));
  } catch {
    return [];
  }
};

export const AdminAuditTab = () => {
  const [logs, setLogs]         = useState<AdminAuditLog[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const [entityTypes, setEntityTypes] = useState<string[]>([]);

  // Filters (server-side)
  const [entityType, setEntityType] = useState('');
  const [action, setAction]         = useState('');
  const [changedBy, setChangedBy]   = useState('');
  const [from, setFrom]             = useState('');
  const [to, setTo]                 = useState('');

  // Snapshot drawer
  const [activeSnapshot, setActiveSnapshot] = useState<AdminAuditLog | null>(null);

  // Load dropdown once.
  useEffect(() => {
    (async () => {
      try {
        const types = await adminAuditService.entityTypes();
        setEntityTypes(types);
      } catch { /* non-fatal */ }
    })();
  }, []);

  // Fetch on filter/page change. Filters reset to page 1 below.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    adminAuditService.list({
      entityType: entityType || undefined,
      action: action || undefined,
      changedBy: changedBy || undefined,
      from: from || undefined,
      to: to || undefined,
      page,
      pageSize: PAGE_SIZE,
    })
      .then(r => { if (!alive) return; setLogs(r.data ?? []); setTotal(r.totalCount ?? 0); })
      .catch(() => { if (!alive) return; setError('Failed to load admin activity.'); setLogs([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [entityType, action, changedBy, from, to, page]);

  // Any filter change → bounce back to page 1.
  const applyFilter = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Expand each row to either:
  //  - a single row showing the action (for Created/Deleted with snapshot)
  //  - one row per field change (for Updated)
  const expanded = useMemo(() => {
    return logs.map(l => ({
      log: l,
      deltas: l.action === 'Updated' ? parseDeltas(l.fieldChanges) : [],
    }));
  }, [logs]);

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={entityType}
          onChange={(e) => applyFilter(setEntityType)(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">All entity types</option>
          {entityTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <select
          value={action}
          onChange={(e) => applyFilter(setAction)(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          {ACTIONS.map(a => (
            <option key={a} value={a}>{a === '' ? 'All actions' : a}</option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Filter by user..."
          value={changedBy}
          onChange={(e) => applyFilter(setChangedBy)(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <input
          type="date"
          value={from}
          onChange={(e) => applyFilter(setFrom)(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="From date"
        />
        <input
          type="date"
          value={to}
          onChange={(e) => applyFilter(setTo)(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="To date"
        />

        <button
          onClick={() => {
            setEntityType(''); setAction(''); setChangedBy('');
            setFrom(''); setTo(''); setPage(1);
          }}
          className="text-sm text-gray-500 hover:text-gray-800 underline"
        >
          Clear
        </button>
      </div>

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
              {['When', 'Who', 'Entity', 'Name / ID', 'Action', 'Changes', ''].map(h => (
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
              <tr><td colSpan={7} className="text-center py-10 text-gray-400">Loading...</td></tr>
            ) : expanded.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400">No admin activity found.</td></tr>
            ) : (
              expanded.map(({ log, deltas }) => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors align-top">
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {new Date(log.changedOn).toLocaleString('en-GB', {
                      day: '2-digit', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{log.changedBy ?? 'system'}</td>
                  <td className="px-4 py-3 text-gray-700 font-medium">{log.entityType}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {log.entityName ? (
                      <>
                        <div className="font-medium text-gray-800">{log.entityName}</div>
                        {log.entityId != null && (
                          <div className="text-xs text-gray-400">#{log.entityId}</div>
                        )}
                      </>
                    ) : log.entityId != null ? (
                      <span className="text-blue-600">#{log.entityId}</span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${actionColor(log.action)}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {log.action === 'Updated' ? (
                      deltas.length === 0 ? <span className="text-gray-400">no field changes</span> : (
                        <ul className="space-y-1">
                          {deltas.map(d => (
                            <li key={d.field} className="text-xs">
                              <span className="font-semibold text-gray-700">{d.field}: </span>
                              <span className="text-red-500 line-through">{d.oldValue}</span>
                              <span className="mx-1 text-gray-400">→</span>
                              <span className="text-green-700">{d.newValue}</span>
                            </li>
                          ))}
                        </ul>
                      )
                    ) : (
                      <span className="text-gray-400 italic">
                        {log.action === 'Created' ? 'new record' : 'record removed'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {log.snapshot && (
                      <button
                        onClick={() => setActiveSnapshot(log)}
                        className="text-xs text-blue-600 hover:text-blue-800 underline"
                      >
                        snapshot
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
        <span>Showing {logs.length} of {total} entries</span>
        <div className="flex gap-2">
          <button
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100"
          >Previous</button>
          <span className="px-3 py-1">Page {page} of {totalPages}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100"
          >Next</button>
        </div>
      </div>

      {/* Snapshot modal */}
      {activeSnapshot && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setActiveSnapshot(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
              <div>
                <div className="font-semibold text-gray-800">
                  {activeSnapshot.entityType}
                  {activeSnapshot.entityName ? ` — ${activeSnapshot.entityName}` : ''}
                  {activeSnapshot.entityId != null ? ` #${activeSnapshot.entityId}` : ''}
                </div>
                <div className="text-xs text-gray-500">
                  {activeSnapshot.action} by {activeSnapshot.changedBy ?? 'system'} ·
                  {' '}{new Date(activeSnapshot.changedOn).toLocaleString()}
                </div>
              </div>
              <button
                onClick={() => setActiveSnapshot(null)}
                className="text-gray-400 hover:text-gray-700 text-xl leading-none"
                aria-label="Close"
              >×</button>
            </div>
            <div className="p-4 overflow-auto text-xs bg-gray-50 font-mono whitespace-pre-wrap">
              {(() => {
                try {
                  return JSON.stringify(JSON.parse(activeSnapshot.snapshot!), null, 2);
                } catch {
                  return activeSnapshot.snapshot;
                }
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
