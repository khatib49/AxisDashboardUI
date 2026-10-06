import { useEffect, useState } from 'react';
import { Alert, Button, Empty, Input, Skeleton, Table, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { SearchOutlined } from '@ant-design/icons';
import { TransactionAuditLog, transactionAuditLogService } from '../../services/transactionAuditLogService';
import { Panel } from '../../components/ui/PageKit';
import { ActionPill, AuditPager } from '../../components/admin/people/AuditKit';
import PersonAvatar from '../../components/admin/people/PersonAvatar';

const PAGE_SIZE = 50;

const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

// Rendered inside the Audit Logs page (Transactions tab), which owns the
// page header — this component is the filter bar, table and pager only.
export const TransactionAuditLogsPage = () => {
  const [logs, setLogs]           = useState<TransactionAuditLog[]>([]);
  const [totalCount, setTotal]    = useState(0);
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  // Presentation only: skeleton until the first response lands.
  const [loadedOnce, setLoadedOnce] = useState(false);

  // Filters
  const [filterTxId, setFilterTxId]     = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterUser, setFilterUser]     = useState('');

  useEffect(() => {
    fetchLogs();
    // Refetch only when the page changes — the filters below are client-side.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

const fetchLogs = async () => {
  setLoading(true);
  setError(null);
  try {
    const result = await transactionAuditLogService.getAll(page, PAGE_SIZE);
    setLogs(result.data ?? []);      // ← was just result
    setTotal(result.totalCount ?? 0);
  } catch {
    setError('Failed to load audit logs.');
    setLogs([]);                      // ← safety fallback
  } finally {
    setLoading(false);
    setLoadedOnce(true);
  }
};

  const filtered = logs.filter((l) => {
    const txMatch     = filterTxId     ? String(l.transactionId).includes(filterTxId) : true;
    const actionMatch = filterAction   ? l.action.toLowerCase().includes(filterAction.toLowerCase()) : true;
    const userMatch   = filterUser     ? l.changedBy.toLowerCase().includes(filterUser.toLowerCase()) : true;
    return txMatch && actionMatch && userMatch;
  });

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const filtersActive = !!(filterTxId || filterAction || filterUser);

  const columns: ColumnsType<TransactionAuditLog> = [
    {
      title: 'When',
      key: 'changedOn',
      width: 190,
      render: (_, log) => <span className="whitespace-nowrap text-gray-600 tabular-nums dark:text-gray-400">{fmtWhen(log.changedOn)}</span>,
    },
    {
      title: 'Who',
      key: 'changedBy',
      width: 200,
      render: (_, log) => (
        <span className="flex min-w-0 items-center gap-2">
          <PersonAvatar size="sm" name={log.changedBy} />
          <span className="truncate text-gray-800 dark:text-gray-200">{log.changedBy}</span>
        </span>
      ),
    },
    {
      title: 'Transaction',
      key: 'transactionId',
      width: 120,
      render: (_, log) => <span className="font-medium text-blue-600 tabular-nums dark:text-blue-400">#{log.transactionId}</span>,
    },
    {
      title: 'Action',
      key: 'action',
      width: 150,
      render: (_, log) => <ActionPill action={log.action} />,
    },
    {
      title: 'Field',
      key: 'fieldChanged',
      width: 150,
      render: (_, log) => log.fieldChanged
        ? <span className="font-medium text-gray-700 dark:text-gray-300">{log.fieldChanged}</span>
        : <span className="text-gray-400 dark:text-gray-500">—</span>,
    },
    {
      title: 'Change',
      key: 'change',
      width: 280,
      render: (_, log) => (log.oldValue == null && log.newValue == null) ? (
        <span className="text-gray-400 dark:text-gray-500">—</span>
      ) : (
        <span className="flex min-w-0 max-w-[260px] items-center gap-1.5 text-xs">
          <span className="truncate text-red-600 line-through decoration-red-300 dark:text-red-400" title={log.oldValue ?? ''}>{log.oldValue ?? '—'}</span>
          <span className="shrink-0 text-gray-400" aria-label="changed to">→</span>
          <span className="truncate text-emerald-700 dark:text-emerald-400" title={log.newValue ?? ''}>{log.newValue ?? '—'}</span>
        </span>
      ),
    },
    {
      title: 'Notes',
      key: 'notes',
      width: 220,
      render: (_, log) => log.notes
        ? <span className="block max-w-xs truncate text-gray-500 dark:text-gray-400" title={log.notes}>{log.notes}</span>
        : <span className="text-gray-400 dark:text-gray-500">—</span>,
    },
    {
      title: 'ID',
      key: 'id',
      width: 80,
      render: (_, log) => <span className="text-xs text-gray-400 tabular-nums dark:text-gray-500">{log.id}</span>,
    },
  ];

  return (
    <Panel
      title="Transaction changes"
      subtitle="Read-only. Every change to any transaction is recorded here. Expand a row for the full before → after."
      bodyClassName="p-0"
    >
      {/* Filters (client-side, on the page already loaded) */}
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-5 py-3 dark:border-white/[0.06]">
        <Input
          allowClear
          prefix={<SearchOutlined className="text-gray-400" />}
          placeholder="Filter by Transaction ID..."
          aria-label="Filter by Transaction ID"
          value={filterTxId}
          onChange={(e) => setFilterTxId(e.target.value)}
          className="w-full sm:w-52"
        />
        <Input
          allowClear
          placeholder="Filter by action..."
          aria-label="Filter by action"
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="w-full sm:w-48"
        />
        <Input
          allowClear
          placeholder="Filter by user..."
          aria-label="Filter by user"
          value={filterUser}
          onChange={(e) => setFilterUser(e.target.value)}
          className="w-full sm:w-48"
        />
        <Tooltip title="Clear all filters">
          <Button
            type="link"
            size="small"
            disabled={!filtersActive}
            onClick={() => { setFilterTxId(''); setFilterAction(''); setFilterUser(''); }}
          >
            Clear
          </Button>
        </Tooltip>
      </div>

      {/* Error */}
      {error && <div className="px-5 pt-4"><Alert type="error" showIcon message={error} /></div>}

      {!loadedOnce ? (
        <div className="p-5"><Skeleton active paragraph={{ rows: 8 }} /></div>
      ) : (
        <Table
          rowKey="id"
          size="middle"
          loading={loading}
          columns={columns}
          dataSource={filtered}
          pagination={false}
          scroll={{ x: 1400 }}
          expandable={{
            rowExpandable: (log) => !!(log.fieldChanged || log.oldValue || log.newValue || log.notes),
            expandedRowRender: (log) => (
              <dl className="grid gap-x-6 gap-y-3 py-1 text-sm sm:grid-cols-[140px_minmax(0,1fr)]">
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Field</dt>
                <dd className="text-gray-800 dark:text-gray-200">{log.fieldChanged ?? '—'}</dd>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Before</dt>
                <dd className="whitespace-pre-wrap break-words rounded-lg bg-red-50 px-3 py-2 font-mono text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300">{log.oldValue ?? '—'}</dd>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">After</dt>
                <dd className="whitespace-pre-wrap break-words rounded-lg bg-emerald-50 px-3 py-2 font-mono text-xs text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">{log.newValue ?? '—'}</dd>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Notes</dt>
                <dd className="whitespace-pre-wrap break-words text-gray-600 dark:text-gray-300">{log.notes ?? '—'}</dd>
              </dl>
            ),
          }}
          locale={{ emptyText: <Empty description={filtersActive ? 'No audit logs match these filters on this page.' : 'No audit logs found.'} /> }}
        />
      )}

      {/* Pagination */}
      <AuditPager
        summary={`Showing ${filtered.length} of ${totalCount} logs`}
        page={page}
        totalPages={totalPages}
        onPrev={() => setPage((p) => p - 1)}
        onNext={() => setPage((p) => p + 1)}
        prevDisabled={page === 1}
        nextDisabled={page >= totalPages}
      />
    </Panel>
  );
};
