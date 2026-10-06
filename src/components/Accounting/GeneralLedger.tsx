// src/components/Accounting/GeneralLedger.tsx

import React, { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Button,
  DatePicker,
  Select,
  message,
  Skeleton,
  Empty,
  Tooltip
} from 'antd';
import {
  BookOutlined,
  DownloadOutlined,
  PrinterOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

import {
  getAllAccounts,
  getGeneralLedger,
} from '../../services/accountsApi';

import type { Account, GeneralLedger, GeneralLedgerLine } from '../../services/accounting';
import { PageHeader, Panel, StatTile } from '../ui/PageKit';
import { AccountCode } from './reports/AccountTypePill';
import { Amount } from './reports/Amount';
import { money } from './reports/money';

const { RangePicker } = DatePicker;
const { Option } = Select;

// The API computes balances on the account's normal side (debit-normal for
// assets/expenses, credit-normal for liabilities/equity/revenue), so a
// negative balance means the account sits on the opposite side.
const NEGATIVE_HINT =
  "Below zero on this account's normal side (debit for assets/expenses, credit for liabilities, equity and revenue).";

const negativeFlag = (
  <Tooltip title={NEGATIVE_HINT}>
    <span tabIndex={0} className="cursor-help">Negative</span>
  </Tooltip>
);

/** Debit / credit cell: the amount, or an em dash for zero. */
const DrCr = ({ amount }: { amount: number }) =>
  amount > 0 ? (
    <span className="whitespace-nowrap tabular-nums text-gray-900 dark:text-gray-100">{money(amount)}</span>
  ) : (
    <span className="text-gray-300 dark:text-gray-600" aria-label="none">—</span>
  );

const GeneralLedger: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | undefined>();
  const [ledger, setLedger] = useState<GeneralLedger | null>(null);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().startOf('month'),
    dayjs().endOf('month')
  ]);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const data = await getAllAccounts(undefined, true);
      setAccounts(data);
      // Auto-select first account
      if (data.length > 0) {
        setSelectedAccountId(data[0].id);
      }
    } catch (error) {
      message.error('Failed to load accounts');
      console.error(error);
    }
  };

  // Re-created only when the account or the period changes, so the effect
  // below reloads on exactly those changes.
  const loadLedger = useCallback(async () => {
    if (!selectedAccountId) return;

    setLoading(true);
    try {
      const fromDate = dateRange[0].format('YYYY-MM-DD');
      const toDate = dateRange[1].format('YYYY-MM-DD');
      const data = await getGeneralLedger(selectedAccountId, fromDate, toDate);
      setLedger(data);
    } catch (error) {
      message.error('Failed to load general ledger');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [selectedAccountId, dateRange]);

  useEffect(() => {
    if (selectedAccountId) {
      loadLedger();
    }
  }, [selectedAccountId, loadLedger]);

  const handleExportToCSV = () => {
    if (!ledger) return;

    const headers = ['Date', 'Entry Number', 'Description', 'Debit', 'Credit', 'Balance'];

    const rows = [
      ['Opening Balance', '', '', '', '', ledger.openingBalance.toFixed(2)],
      ...ledger.transactions.map(tx => [
        dayjs(tx.date).format('YYYY-MM-DD'),
        tx.entryNumber,
        tx.description,
        tx.debit > 0 ? tx.debit.toFixed(2) : '',
        tx.credit > 0 ? tx.credit.toFixed(2) : '',
        tx.runningBalance.toFixed(2)
      ]),
      ['Closing Balance', '', '', '', '', ledger.closingBalance.toFixed(2)]
    ];

    const csvContent = [
      `General Ledger - ${ledger.accountNumber} - ${ledger.accountName}`,
      `Period: ${dayjs(ledger.fromDate).format('YYYY-MM-DD')} to ${dayjs(ledger.toDate).format('YYYY-MM-DD')}`,
      '',
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `general-ledger-${ledger.accountNumber}-${dateRange[0].format('YYYY-MM-DD')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    message.success('General ledger exported successfully');
  };

  const handlePrint = () => {
    window.print();
  };

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);

  const columns: ColumnsType<GeneralLedgerLine> = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      width: 120,
      render: (date) => (
        <span className="whitespace-nowrap tabular-nums text-gray-700 dark:text-gray-300">
          {dayjs(date).format('MMM DD, YYYY')}
        </span>
      )
    },
    {
      title: 'Entry Number',
      dataIndex: 'entryNumber',
      key: 'entryNumber',
      width: 150,
      render: (entryNumber) => <AccountCode>{entryNumber}</AccountCode>
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (description) => <span className="text-gray-800 dark:text-gray-200">{description}</span>
    },
    {
      title: 'Debit',
      dataIndex: 'debit',
      key: 'debit',
      width: 150,
      align: 'right',
      render: (amount: number) => <DrCr amount={amount} />
    },
    {
      title: 'Credit',
      dataIndex: 'credit',
      key: 'credit',
      width: 150,
      align: 'right',
      render: (amount: number) => <DrCr amount={amount} />
    },
    {
      title: 'Running Balance',
      dataIndex: 'runningBalance',
      key: 'runningBalance',
      width: 170,
      align: 'right',
      render: (balance: number) => <Amount value={balance} strong />
    }
  ];

  const totalDebits = ledger?.transactions.reduce((sum, tx) => sum + tx.debit, 0) || 0;
  const totalCredits = ledger?.transactions.reduce((sum, tx) => sum + tx.credit, 0) || 0;
  const netChange = totalDebits - totalCredits;
  const netChangeText = `${netChange > 0 ? '+' : ''}${money(netChange)}`;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6">
      <PageHeader
        tone="blue"
        icon={<BookOutlined />}
        title="General Ledger"
        badge={selectedAccount ? selectedAccount.accountNumber : undefined}
        description={
          selectedAccount
            ? `${selectedAccount.accountNumber} - ${selectedAccount.accountName} · every posting in the period with its running balance.`
            : 'Every posting to one account for a period, with its running balance.'
        }
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Tooltip title="Refresh">
              <Button icon={<ReloadOutlined />} onClick={loadLedger} loading={loading} aria-label="Refresh" />
            </Tooltip>
            <Button icon={<DownloadOutlined />} onClick={handleExportToCSV} disabled={!ledger}>
              Export CSV
            </Button>
            <Button icon={<PrinterOutlined />} onClick={handlePrint} disabled={!ledger}>
              Print
            </Button>
          </div>
        }
      >
        <div className="flex flex-wrap items-center gap-3 print:hidden">
          <Select
            showSearch
            placeholder="Select account"
            aria-label="Account"
            className="w-full sm:w-[340px]"
            value={selectedAccountId}
            onChange={setSelectedAccountId}
            optionFilterProp="children"
            filterOption={(input, option) =>
              (option?.children as unknown as string).toLowerCase().includes(input.toLowerCase())
            }
          >
            {accounts.map(acc => (
              <Option key={acc.id} value={acc.id}>
                {`${acc.accountNumber} - ${acc.accountName}`}
              </Option>
            ))}
          </Select>
          <RangePicker
            value={dateRange}
            onChange={(dates) => dates && setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs])}
            format="YYYY-MM-DD"
          />
        </div>
      </PageHeader>

      {/* Summary tiles */}
      {(ledger || loading) && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Opening Balance"
            loading={loading || !ledger}
            value={ledger && <Amount value={ledger.openingBalance} flag={negativeFlag} />}
            sub={ledger && `as of ${dayjs(ledger.fromDate).format('MMM DD, YYYY')}`}
          />
          <StatTile
            label="Total Debits"
            loading={loading || !ledger}
            value={<span className="tabular-nums">{money(totalDebits)}</span>}
            sub={ledger && `${ledger.transactions.length} transaction${ledger.transactions.length === 1 ? '' : 's'}`}
          />
          <StatTile
            label="Total Credits"
            loading={loading || !ledger}
            value={<span className="tabular-nums">{money(totalCredits)}</span>}
          />
          <StatTile
            label="Closing Balance"
            loading={loading || !ledger}
            value={ledger && <Amount value={ledger.closingBalance} flag={negativeFlag} />}
            sub={ledger && `Net change ${netChangeText} (debits − credits)`}
          />
        </div>
      )}

      {/* Ledger */}
      <Panel
        title={
          selectedAccount ? (
            <span className="flex flex-wrap items-center gap-2">
              <AccountCode>{selectedAccount.accountNumber}</AccountCode>
              <span>{selectedAccount.accountName}</span>
            </span>
          ) : (
            'General Ledger'
          )
        }
        subtitle={
          ledger && !loading
            ? `${dayjs(ledger.fromDate).format('MMM DD, YYYY')} – ${dayjs(ledger.toDate).format('MMM DD, YYYY')} · ${ledger.transactions.length} transaction${ledger.transactions.length === 1 ? '' : 's'}`
            : undefined
        }
        bodyClassName="p-0"
      >
        {loading ? (
          <div className="p-5">
            <Skeleton active paragraph={{ rows: 8 }} />
          </div>
        ) : ledger ? (
          <>
            {/* Opening Balance Row */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/70 px-5 py-3 dark:border-white/[0.06] dark:bg-white/[0.02]">
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Opening Balance</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  as of {dayjs(ledger.fromDate).format('MMMM DD, YYYY')}
                </div>
              </div>
              <Amount value={ledger.openingBalance} strong flag={negativeFlag} className="text-base" />
            </div>

            {/* Transactions Table */}
            <Table
              columns={columns}
              dataSource={ledger.transactions}
              rowKey={(record) => record.entryNumber + record.date}
              pagination={false}
              size="middle"
              scroll={{ x: 900 }}
              locale={{
                emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No transactions in this period" />
              }}
              summary={() =>
                ledger.transactions.length > 0 ? (
                  <Table.Summary.Row className="bg-gray-50/70 dark:bg-white/[0.02]">
                    <Table.Summary.Cell index={0} colSpan={3}>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">Period totals</span>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={3} align="right">
                      <span className="whitespace-nowrap font-semibold tabular-nums text-gray-900 dark:text-gray-100">{money(totalDebits)}</span>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={4} align="right">
                      <span className="whitespace-nowrap font-semibold tabular-nums text-gray-900 dark:text-gray-100">{money(totalCredits)}</span>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={5} align="right" />
                  </Table.Summary.Row>
                ) : null
              }
            />

            {/* Closing Balance Row */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-b-2xl border-t border-blue-100 bg-blue-50/60 px-5 py-4 dark:border-blue-500/15 dark:bg-blue-500/10">
              <div>
                <div className="text-base font-semibold text-gray-900 dark:text-white">Closing Balance</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  as of {dayjs(ledger.toDate).format('MMMM DD, YYYY')}
                </div>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <Amount value={ledger.closingBalance} strong flag={negativeFlag} className="text-xl" />
                <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
                  Net change: {netChangeText} (debits − credits)
                </span>
              </div>
            </div>
          </>
        ) : (
          <div className="py-12">
            <Empty description="Select an account to view its general ledger" />
          </div>
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

export default GeneralLedger;
