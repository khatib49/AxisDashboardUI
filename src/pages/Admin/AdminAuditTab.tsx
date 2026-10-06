import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Empty, Input, Modal, Select, Skeleton, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { FileSearchOutlined, SearchOutlined } from '@ant-design/icons';
import {
  AdminAuditLog,
  adminAuditService,
} from '../../services/adminAuditService';
import { Panel } from '../../components/ui/PageKit';
import { ActionPill, AuditPager } from '../../components/admin/people/AuditKit';
import PersonAvatar from '../../components/admin/people/PersonAvatar';

const PAGE_SIZE = 50;

const ACTIONS = ['', 'Created', 'Updated', 'Deleted'];

// Native date inputs keep the exact YYYY-MM-DD the API expects; styled to sit
// next to the antd controls in light and dark.
const DATE_INPUT =
  'h-8 rounded-md border border-gray-300 bg-white px-2.5 text-sm text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-white/15 dark:bg-white/[0.04] dark:text-gray-200 dark:[color-scheme:dark]';

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

type Row = { log: AdminAuditLog; deltas: DeltaRow[] };

export const AdminAuditTab = () => {
  const [logs, setLogs]         = useState<AdminAuditLog[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  // Presentation only: skeleton until the first response lands.
  const [loadedOnce, setLoadedOnce] = useState(false);

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
      .finally(() => { if (alive) { setLoading(false); setLoadedOnce(true); } });
    return () => { alive = false; };
  }, [entityType, action, changedBy, from, to, page]);

  // Any filter change → bounce back to page 1.
  const applyFilter = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtersActive = !!(entityType || action || changedBy || from || to);

  // Expand each row to either:
  //  - a single row showing the action (for Created/Deleted with snapshot)
  //  - one row per field change (for Updated)
  const expanded = useMemo<Row[]>(() => {
    return logs.map(l => ({
      log: l,
      deltas: l.action === 'Updated' ? parseDeltas(l.fieldChanges) : [],
    }));
  }, [logs]);

  const columns: ColumnsType<Row> = [
    {
      title: 'When',
      key: 'when',
      width: 170,
      render: (_, { log }) => (
        <span className="whitespace-nowrap text-gray-600 tabular-nums dark:text-gray-400">
          {new Date(log.changedOn).toLocaleString('en-GB', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
          })}
        </span>
      ),
    },
    {
      title: 'Who',
      key: 'who',
      width: 190,
      render: (_, { log }) => (
        <span className="flex min-w-0 items-center gap-2">
          <PersonAvatar size="sm" name={log.changedBy ?? 'system'} />
          <span className="truncate text-gray-800 dark:text-gray-200">{log.changedBy ?? 'system'}</span>
        </span>
      ),
    },
    {
      title: 'Entity',
      key: 'entity',
      width: 240,
      render: (_, { log }) => (
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{log.entityType}</div>
          {log.entityName ? (
            <div className="truncate font-medium text-gray-900 dark:text-gray-100">
              {log.entityName}
              {log.entityId != null && <span className="ml-1.5 text-xs font-normal text-gray-400 dark:text-gray-500">#{log.entityId}</span>}
            </div>
          ) : log.entityId != null ? (
            <span className="text-blue-600 dark:text-blue-400">#{log.entityId}</span>
          ) : <span className="text-gray-400 dark:text-gray-500">—</span>}
        </div>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      width: 120,
      render: (_, { log }) => <ActionPill action={log.action} />,
    },
    {
      title: 'Changes',
      key: 'changes',
      width: 280,
      render: (_, { log, deltas }) => log.action === 'Updated' ? (
        deltas.length === 0 ? <span className="text-gray-400 dark:text-gray-500">no field changes</span> : (
          <span className="block min-w-0 max-w-[260px] text-xs">
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {deltas.length} field{deltas.length === 1 ? '' : 's'}
            </span>
            <span className="block truncate text-gray-500 dark:text-gray-400" title={deltas.map(d => d.field).join(', ')}>
              {deltas.map(d => d.field).join(', ')}
            </span>
          </span>
        )
      ) : (
        <span className="italic text-gray-400 dark:text-gray-500">
          {log.action === 'Created' ? 'new record' : 'record removed'}
        </span>
      ),
    },
    {
      title: <span className="sr-only">Snapshot</span>,
      key: 'snapshot',
      width: 110,
      align: 'right',
      render: (_, { log }) => log.snapshot ? (
        <Button
          size="small"
          type="link"
          icon={<FileSearchOutlined />}
          onClick={() => setActiveSnapshot(log)}
          aria-label={`Snapshot of ${log.entityType}${log.entityName ? ` ${log.entityName}` : ''}`}
        >
          snapshot
        </Button>
      ) : null,
    },
  ];

  return (
    <>
      <Panel
        title="Admin activity"
        subtitle="Expand an update to see each field's before → after."
        bodyClassName="p-0"
      >
        {/* Filters (server-side) */}
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-5 py-3 dark:border-white/[0.06]">
          <Select
            value={entityType}
            onChange={(v: string) => applyFilter(setEntityType)(v)}
            aria-label="Entity type"
            showSearch
            optionFilterProp="label"
            className="w-full sm:w-48"
            options={[{ value: '', label: 'All entity types' }, ...entityTypes.map(t => ({ value: t, label: t }))]}
          />

          <Select
            value={action}
            onChange={(v: string) => applyFilter(setAction)(v)}
            aria-label="Action"
            className="w-full sm:w-40"
            options={ACTIONS.map(a => ({ value: a, label: a === '' ? 'All actions' : a }))}
          />

          <Input
            allowClear
            prefix={<SearchOutlined className="text-gray-400" />}
            placeholder="Filter by user..."
            aria-label="Filter by user"
            value={changedBy}
            onChange={(e) => applyFilter(setChangedBy)(e.target.value)}
            className="w-full sm:w-48"
          />

          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <input
              type="date"
              value={from}
              onChange={(e) => applyFilter(setFrom)(e.target.value)}
              className={`${DATE_INPUT} min-w-0 flex-1 sm:flex-none`}
              aria-label="From date"
            />
            <span className="text-xs text-gray-400 dark:text-gray-500">to</span>
            <input
              type="date"
              value={to}
              onChange={(e) => applyFilter(setTo)(e.target.value)}
              className={`${DATE_INPUT} min-w-0 flex-1 sm:flex-none`}
              aria-label="To date"
            />
          </div>

          <Button
            type="link"
            size="small"
            disabled={!filtersActive}
            onClick={() => {
              setEntityType(''); setAction(''); setChangedBy('');
              setFrom(''); setTo(''); setPage(1);
            }}
          >
            Clear
          </Button>
        </div>

        {error && <div className="px-5 pt-4"><Alert type="error" showIcon message={error} /></div>}

        {!loadedOnce ? (
          <div className="p-5"><Skeleton active paragraph={{ rows: 8 }} /></div>
        ) : (
          <Table
            rowKey={(r) => r.log.id}
            size="middle"
            loading={loading}
            columns={columns}
            dataSource={expanded}
            pagination={false}
            scroll={{ x: 1110 }}
            expandable={{
              rowExpandable: (r) => r.deltas.length > 0,
              expandedRowRender: ({ deltas }) => (
                <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100 bg-white dark:divide-white/[0.06] dark:border-white/[0.06] dark:bg-white/[0.02]">
                  {deltas.map(d => (
                    <li key={d.field} className="grid gap-1.5 px-3 py-2 text-xs sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center sm:gap-4">
                      <span className="font-semibold text-gray-700 dark:text-gray-300">{d.field}</span>
                      <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <span className="break-all rounded bg-red-50 px-1.5 py-0.5 text-red-700 line-through decoration-red-300 dark:bg-red-500/10 dark:text-red-300">{d.oldValue}</span>
                        <span className="text-gray-400" aria-label="changed to">→</span>
                        <span className="break-all rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">{d.newValue}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ),
            }}
            locale={{ emptyText: <Empty description={filtersActive ? 'No admin activity matches these filters.' : 'No admin activity found.'} /> }}
          />
        )}

        {/* Pagination */}
        <AuditPager
          summary={`Showing ${logs.length} of ${total} entries`}
          page={page}
          totalPages={totalPages}
          onPrev={() => setPage(p => p - 1)}
          onNext={() => setPage(p => p + 1)}
          prevDisabled={page === 1}
          nextDisabled={page >= totalPages}
        />
      </Panel>

      {/* Snapshot modal */}
      <Modal
        open={!!activeSnapshot}
        onCancel={() => setActiveSnapshot(null)}
        footer={null}
        width={720}
        title={activeSnapshot && (
          <div className="min-w-0 pr-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate font-semibold text-gray-900 dark:text-white">
                {activeSnapshot.entityType}
                {activeSnapshot.entityName ? ` — ${activeSnapshot.entityName}` : ''}
                {activeSnapshot.entityId != null ? ` #${activeSnapshot.entityId}` : ''}
              </span>
              <ActionPill action={activeSnapshot.action} />
            </div>
            <div className="mt-0.5 text-xs font-normal text-gray-500 dark:text-gray-400">
              {activeSnapshot.action} by {activeSnapshot.changedBy ?? 'system'} ·
              {' '}{new Date(activeSnapshot.changedOn).toLocaleString()}
            </div>
          </div>
        )}
      >
        {activeSnapshot && (
          <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-gray-50 p-4 font-mono text-xs text-gray-800 dark:bg-white/[0.04] dark:text-gray-200">
            {(() => {
              try {
                return JSON.stringify(JSON.parse(activeSnapshot.snapshot!), null, 2);
              } catch {
                return activeSnapshot.snapshot;
              }
            })()}
          </pre>
        )}
      </Modal>
    </>
  );
};
