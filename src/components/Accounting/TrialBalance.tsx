// src/components/Accounting/TrialBalance.tsx

import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  DatePicker,
  Empty,
  Skeleton,
  Tooltip,
  message,
  Select
} from 'antd';
import {
  CalculatorOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  DownloadOutlined,
  ExclamationCircleFilled,
  PrinterOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

import {
  getTrialBalance,
getAccountTypes
} from '../../services/accountsApi';

import type { TrialBalance , TrialBalanceLine, AccountType } from '../../services/accounting';
import { PageHeader, Panel, Pill, StatTile } from '../ui/PageKit';
import { AccountCode, AccountTypePill } from './reports/AccountTypePill';
import { money } from './reports/money';

/** Debit / credit cell: the amount, or an em dash for zero. */
const DrCr = ({ amount }: { amount: number }) =>
  amount > 0 ? (
    <span className="whitespace-nowrap tabular-nums text-gray-900 dark:text-gray-100">{money(amount)}</span>
  ) : (
    <span className="text-gray-300 dark:text-gray-600" aria-label="none">—</span>
  );

const TrialBalance: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [trialBalance, setTrialBalance] = useState<TrialBalance | null>(null);
  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs>(dayjs());
  const [accountTypes, setAccountTypes] = useState<AccountType[]>([]);
  const [filterType, setFilterType] = useState<string | undefined>();
  // Presentation only: lets the page show an error state instead of
  // stale / zero figures when the last load failed.
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    loadAccountTypes();
    loadTrialBalance();
    // Load once on mount; later loads are triggered by the date picker and Refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAccountTypes = async () => {
    try {
      const types = await getAccountTypes();
      setAccountTypes(types);
    } catch (error) {
      console.error('Failed to load account types', error);
    }
  };

  const loadTrialBalance = async (date?: dayjs.Dayjs) => {
    setLoading(true);
    setLoadError(false);
    try {
      const dateStr = (date || selectedDate).format('YYYY-MM-DD');
      const data = await getTrialBalance(dateStr);
      setTrialBalance(data);
    } catch (error) {
      setLoadError(true);
      message.error('Failed to load trial balance');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (date: dayjs.Dayjs | null) => {
    if (date) {
      setSelectedDate(date);
      loadTrialBalance(date);
    }
  };

  const handleExportToCSV = () => {
    if (!trialBalance) return;

    const headers = ['Account Number', 'Account Name', 'Type', 'Debit', 'Credit'];
    const rows = trialBalance.lines.map(line => [
      line.accountNumber,
      line.accountName,
      line.accountTypeName,
      line.debitBalance.toFixed(2),
      line.creditBalance.toFixed(2)
    ]);

    rows.push([
      '',
      '',
      'TOTAL',
      trialBalance.totalDebits.toFixed(2),
      trialBalance.totalCredits.toFixed(2)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trial-balance-${selectedDate.format('YYYY-MM-DD')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    message.success('Trial balance exported successfully');
  };

  const handlePrint = () => {
    window.print();
  };

  const filteredLines = filterType
    ? trialBalance?.lines.filter(line => line.accountTypeName === filterType)
    : trialBalance?.lines;

  // Figures (and the Balanced / Unbalanced verdict) are only shown once a
  // load has actually succeeded — never while loading or after a failure.
  const ready = !loading && !loadError && trialBalance != null;
  const difference = trialBalance ? Math.abs(trialBalance.totalDebits - trialBalance.totalCredits) : 0;
  const tileLoading = loading || (!trialBalance && !loadError);

  const columns: ColumnsType<TrialBalanceLine> = [
    {
      title: 'Account Number',
      dataIndex: 'accountNumber',
      key: 'accountNumber',
      width: 150,
      sorter: (a, b) => a.accountNumber.localeCompare(b.accountNumber),
      render: (accountNumber) => <AccountCode>{accountNumber}</AccountCode>
    },
    {
      title: 'Account Name',
      dataIndex: 'accountName',
      key: 'accountName',
      render: (accountName) => <span className="text-gray-900 dark:text-gray-100">{accountName}</span>
    },
    {
      title: 'Type',
      dataIndex: 'accountTypeName',
      key: 'accountTypeName',
      width: 130,
      render: (type) => <AccountTypePill type={type as string} />,
      filters: accountTypes.map(t => ({ text: t.typeName, value: t.typeName })),
      onFilter: (value, record) => record.accountTypeName === value
    },
    {
      title: 'Debit',
      dataIndex: 'debitBalance',
      key: 'debitBalance',
      width: 160,
      align: 'right',
      render: (amount: number) => <DrCr amount={amount} />
    },
    {
      title: 'Credit',
      dataIndex: 'creditBalance',
      key: 'creditBalance',
      width: 160,
      align: 'right',
      render: (amount: number) => <DrCr amount={amount} />
    }
  ];

  const statusValue = loadError ? (
    <span className="inline-flex items-center gap-2 text-red-600 dark:text-red-400">
      <ExclamationCircleFilled aria-hidden /> Not loaded
    </span>
  ) : trialBalance?.isBalanced ? (
    <span className="inline-flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
      <CheckCircleFilled aria-hidden /> Balanced
    </span>
  ) : (
    <span className="inline-flex items-center gap-2 text-red-600 dark:text-red-400">
      <CloseCircleFilled aria-hidden /> Unbalanced
    </span>
  );

  const statusPill = ready ? (
    trialBalance.isBalanced ? <Pill tone="emerald" dot>Balanced</Pill> : <Pill tone="red" dot>Unbalanced</Pill>
  ) : loadError ? (
    <Pill tone="red" dot>Not loaded</Pill>
  ) : (
    <Pill tone="gray" dot>Loading…</Pill>
  );

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6">
      <PageHeader
        tone="violet"
        icon={<CalculatorOutlined />}
        title="Trial Balance"
        badge={`As of ${selectedDate.format('MMM DD, YYYY')}`}
        description="Every account's debit or credit balance as of a date. Total debits must equal total credits."
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Tooltip title="Refresh">
              <Button icon={<ReloadOutlined />} onClick={() => loadTrialBalance()} loading={loading} aria-label="Refresh" />
            </Tooltip>
            <Button icon={<DownloadOutlined />} onClick={handleExportToCSV}>
              Export CSV
            </Button>
            <Button icon={<PrinterOutlined />} onClick={handlePrint}>
              Print
            </Button>
          </div>
        }
      >
        <div className="flex flex-wrap items-center gap-3 print:hidden">
          <DatePicker
            value={selectedDate}
            onChange={handleDateChange}
            format="YYYY-MM-DD"
            allowClear={false}
            aria-label="As of date"
          />
          <Select
            placeholder="Filter by type"
            aria-label="Filter by type"
            className="w-full sm:w-[180px]"
            value={filterType}
            onChange={setFilterType}
            allowClear
          >
            {accountTypes.map(type => (
              <Select.Option key={type.id} value={type.typeName}>
                {type.typeName}
              </Select.Option>
            ))}
          </Select>
        </div>
      </PageHeader>

      {/* Summary tiles */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Total Debits"
          loading={tileLoading}
          value={<span className="tabular-nums">{ready ? money(trialBalance.totalDebits) : '—'}</span>}
          sub={loadError ? 'Not loaded' : undefined}
        />
        <StatTile
          label="Total Credits"
          loading={tileLoading}
          value={<span className="tabular-nums">{ready ? money(trialBalance.totalCredits) : '—'}</span>}
          sub={loadError ? 'Not loaded' : undefined}
        />
        <StatTile
          label="Difference"
          loading={tileLoading}
          value={
            <span className={`tabular-nums ${ready && difference >= 0.005 ? 'text-red-600 dark:text-red-400' : ''}`}>
              {ready ? money(difference) : '—'}
            </span>
          }
          sub={loadError ? 'Not loaded' : 'Total debits − total credits'}
        />
        <StatTile
          label="Balance Status"
          loading={tileLoading}
          value={statusValue}
          sub={
            loadError
              ? 'The trial balance could not be loaded'
              : ready
                ? trialBalance.isBalanced
                  ? 'Debits equal credits'
                  : 'Debits ≠ credits — review entries'
                : undefined
          }
        />
      </div>

      {/* Load error */}
      {loadError && !loading && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-500/20 dark:bg-red-500/10">
          <div className="flex items-start gap-3">
            <ExclamationCircleFilled className="mt-0.5 text-lg text-red-500" aria-hidden />
            <div>
              <div className="font-semibold text-red-800 dark:text-red-300">Failed to load trial balance</div>
              <div className="text-sm text-red-700/80 dark:text-red-300/80">
                No figures are shown until the trial balance loads. Try again.
              </div>
            </div>
          </div>
          <Button onClick={() => loadTrialBalance()} className="print:hidden">Retry</Button>
        </div>
      )}

      {/* Balance Alert */}
      {ready && !trialBalance.isBalanced && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-500/20 dark:bg-red-500/10">
          <CloseCircleFilled className="mt-0.5 text-lg text-red-500" aria-hidden />
          <div>
            <div className="font-semibold text-red-800 dark:text-red-300">Trial Balance is Not Balanced</div>
            <div className="text-sm text-red-700/80 dark:text-red-300/80">
              {`There is a difference of $${Math.abs(
                trialBalance.totalDebits - trialBalance.totalCredits
              ).toFixed(2)}. Please review your journal entries.`}
            </div>
          </div>
        </div>
      )}

      {/* Main panel */}
      <Panel
        title={`Trial Balance - As of ${selectedDate.format('MMMM DD, YYYY')}`}
        subtitle={
          ready
            ? `${filteredLines?.length ?? 0} account${filteredLines?.length === 1 ? '' : 's'}${filterType ? ` · ${filterType} only` : ''}`
            : undefined
        }
        extra={statusPill}
        bodyClassName="p-0"
      >
        {loadError && !loading ? (
          <div className="py-12">
            <Empty description="Trial balance not loaded" />
          </div>
        ) : loading && !trialBalance ? (
          <div className="p-5">
            <Skeleton active paragraph={{ rows: 8 }} />
          </div>
        ) : (
          <Table
            columns={columns}
            dataSource={filteredLines || []}
            rowKey={(record) => record.accountNumber}
            loading={loading}
            pagination={false}
            size="middle"
            scroll={{ x: 720 }}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No accounts" /> }}
            summary={(pageData) => {
              if (!trialBalance) return null;

              const displayedDebits = pageData.reduce((sum, record) => sum + record.debitBalance, 0);
              const displayedCredits = pageData.reduce((sum, record) => sum + record.creditBalance, 0);

              return (
                <>
                  <Table.Summary.Row className="bg-gray-50/80 dark:bg-white/[0.03]">
                    <Table.Summary.Cell index={0} colSpan={3}>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">Total (Displayed)</span>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={3} align="right">
                      <span className="whitespace-nowrap font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                        {money(displayedDebits)}
                      </span>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={4} align="right">
                      <span className="whitespace-nowrap font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                        {money(displayedCredits)}
                      </span>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                  {filterType && (
                    <Table.Summary.Row className="bg-violet-50/70 dark:bg-violet-500/10">
                      <Table.Summary.Cell index={0} colSpan={3}>
                        <span className="font-semibold text-gray-900 dark:text-gray-100">Grand Total (All Accounts)</span>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={3} align="right">
                        <span className="whitespace-nowrap font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                          {money(trialBalance.totalDebits)}
                        </span>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={4} align="right">
                        <span className="whitespace-nowrap font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                          {money(trialBalance.totalCredits)}
                        </span>
                      </Table.Summary.Cell>
                    </Table.Summary.Row>
                  )}
                </>
              );
            }}
          />
        )}
      </Panel>

      <style>{`
        @media print {
          .ant-btn,
          .ant-select {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default TrialBalance;
