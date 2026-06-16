import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Space,
  Button,
  Spin,
  message,
  Progress,
  DatePicker,
  Divider,
  Tooltip
} from 'antd';
import {
  DollarOutlined,
  RiseOutlined,
  FallOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  PlusOutlined,
  BookOutlined,
  ReloadOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';
import { useNavigate } from 'react-router';

import {
  searchJournalEntries
} from '../../services/journalApi';

import {
  getTrialBalance,
} from '../../services/accountsApi';

import {
  getAccountingDashboard,
  AccountingDashboardDto,
  ExpenseCategoryLineDto
} from '../../services/accountingService';

import type { JournalEntry } from '../../services/accounting';
// Add this import at the top with the other service imports
import { backfillTransactions, backfillExpenses, BackfillResultDto } from '../../services/accountingService';

const { RangePicker } = DatePicker;

const fmt = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const AccountingDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [backfillResult, setBackfillResult] = useState<BackfillResultDto | null>(null);

  const [loading, setLoading] = useState(false);
  const [dashboard, setDashboard] = useState<AccountingDashboardDto | null>(null);
  const [recentEntries, setRecentEntries] = useState<JournalEntry[]>([]);
  const [isBalanced, setIsBalanced] = useState(false);

  // Date range — default to current month
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().startOf('month'),
    dayjs().endOf('day'),
  ]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      // Everything follows the reporting-period filter EXCEPT the trial
      // balance — by Rami's call, trial balance stays all-time so admins
      // can spot whether the books are out of balance overall, regardless
      // of which slice they're looking at.
      const fromIso = dateRange[0].toISOString();
      const toIso = dateRange[1].toISOString();
      const [dashboardData, trialBalance, entriesResult] = await Promise.all([
        getAccountingDashboard(fromIso, toIso),
        getTrialBalance(),
        searchJournalEntries({
          pageNumber: 1,
          pageSize: 5,
          fromDate: fromIso,
          toDate: toIso,
        }),
      ]);

      setDashboard(dashboardData);
      setIsBalanced(trialBalance.isBalanced);
      setRecentEntries(entriesResult.items);
    } catch (error) {
      message.error('Failed to load dashboard data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // ── Derived values ──────────────────────────────────────────
  const revenue = dashboard?.revenue;
  const opEx = dashboard?.operatingExpenses;
  const capEx = dashboard?.capitalExpenses;
  const netIncome = dashboard?.netIncome ?? 0;
  const grossProfit = dashboard?.grossProfit ?? 0;
  const netMargin = dashboard?.netMarginPercent ?? 0;
  const totalRevenue = revenue?.total ?? 0;

  const postedCount = recentEntries.filter(e => e.isPosted).length;
  const draftCount = recentEntries.filter(e => !e.isPosted && !e.isVoided).length;

  // ── Expense breakdown table columns ────────────────────────
  const expenseColumns: ColumnsType<ExpenseCategoryLineDto> = [
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      align: 'right',
      render: (v) => fmt(v),
      sorter: (a, b) => b.amount - a.amount,
      defaultSortOrder: 'ascend',
    },
    {
      title: '% of Total',
      key: 'pct',
      align: 'right',
      render: (_, record) => {
        const total = opEx?.total ?? 0;
        if (total === 0) return '—';
        const pct = (record.amount / total) * 100;
        return (
          <div style={{ minWidth: 120 }}>
            <Progress
              percent={Math.round(pct)}
              size="small"
              strokeColor="#ff4d4f"
              showInfo
            />
          </div>
        );
      }
    }
  ];

  const capExColumns: ColumnsType<ExpenseCategoryLineDto> = [
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      align: 'right',
      render: (v) => fmt(v),
    }
  ];

  // ── Recent entries columns ──────────────────────────────────
  const recentEntriesColumns: ColumnsType<JournalEntry> = [
    {
      title: 'Entry Number',
      dataIndex: 'entryNumber',
      key: 'entryNumber',
      width: 150,
    },
    {
      title: 'Date',
      dataIndex: 'entryDate',
      key: 'entryDate',
      width: 120,
      render: (date) => dayjs(date).format('MMM DD, YYYY'),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'Amount',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      width: 120,
      align: 'right',
      render: (amount) => fmt(amount),
    },
    {
      title: 'Status',
      key: 'status',
      width: 100,
      render: (_, record) => {
        if (record.isVoided) return <Tag color="red">Voided</Tag>;
        if (record.isPosted) return <Tag color="green">Posted</Tag>;
        return <Tag color="orange">Draft</Tag>;
      },
    },
  ];

  // ── Render ──────────────────────────────────────────────────
  return (
    <Spin spinning={loading}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>

        {/* Quick Actions */}
        <Card title="Quick Actions">
          <Space size="middle" wrap>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/accounting/journal/new')}
            >
              New Journal Entry
            </Button>
            <Button
              icon={<FileTextOutlined />}
              onClick={() => navigate('/accounting/accounts/new')}
            >
              New Account
            </Button>
            <Button
              icon={<BookOutlined />}
              onClick={() => navigate('/accounting/trial-balance')}
            >
              View Trial Balance
            </Button>
          </Space>
        </Card>

        {/* Date Range Filter */}
        <Card>
          <Space align="center" wrap>
            <span style={{ fontWeight: 600 }}>Reporting Period:</span>
            <RangePicker
              value={dateRange}
              onChange={(vals) => {
                if (vals && vals[0] && vals[1]) {
                  setDateRange([vals[0], vals[1]]);
                }
              }}
              presets={[
                { label: 'This Month', value: [dayjs().startOf('month'), dayjs().endOf('day')] },
                { label: 'Last Month', value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
                { label: 'Last 30 Days', value: [dayjs().subtract(30, 'day').startOf('day'), dayjs().endOf('day')] },
                { label: 'Last 90 Days', value: [dayjs().subtract(90, 'day').startOf('day'), dayjs().endOf('day')] },
                { label: 'This Year', value: [dayjs().startOf('year'), dayjs().endOf('day')] },
              ]}
              allowClear={false}
              style={{ minWidth: 280 }}
            />
            <Button
              icon={<ReloadOutlined />}
              onClick={loadDashboard}
              loading={loading}
            >
              Refresh
            </Button>
          </Space>
        </Card>

        {/* Revenue Breakdown — Gross / Discounts / Net summary at the top so
            the owner sees how much margin is being given away. The per-source
            cards below stay on NET to match what hits Cash on Hand. */}
        {(revenue?.totalGross ?? 0) > totalRevenue && (
          <Card size="small">
            <Row gutter={16}>
              <Col span={8}>
                <Statistic
                  title={
                    <Space>
                      Gross Revenue
                      <Tooltip title="Sum of menu prices before any discount. Matches the credit side on 4xxx Revenue accounts.">
                        <InfoCircleOutlined style={{ color: '#999' }} />
                      </Tooltip>
                    </Space>
                  }
                  value={revenue?.totalGross ?? totalRevenue}
                  prefix="$"
                  precision={2}
                  valueStyle={{ color: '#1F4E79' }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title={
                    <Space>
                      − Discounts Given
                      <Tooltip title="Sum of all percentage discounts applied at the cashier. Booked to 4900 Sales Discounts (contra-revenue).">
                        <InfoCircleOutlined style={{ color: '#999' }} />
                      </Tooltip>
                    </Space>
                  }
                  value={revenue?.discountsGiven ?? 0}
                  prefix="− $"
                  precision={2}
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title={
                    <Space>
                      = Net Revenue
                      <Tooltip title="What the customer actually paid. Matches the debit side on 1000 Cash on Hand.">
                        <InfoCircleOutlined style={{ color: '#999' }} />
                      </Tooltip>
                    </Space>
                  }
                  value={totalRevenue}
                  prefix="$"
                  precision={2}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Col>
            </Row>
          </Card>
        )}

        {/* Revenue Breakdown — per-source (Gaming / FNB / TCG) at NET */}
        <Card
          title={
            <Space>
              <RiseOutlined style={{ color: '#52c41a' }} />
              <span>Revenue Breakdown</span>
              <Tag color="green">{fmt(totalRevenue)}</Tag>
              {(revenue?.discountsGiven ?? 0) > 0 && (
                <Tag color="orange">
                  {fmt(revenue!.discountsGiven!)} given as discount
                </Tag>
              )}
            </Space>
          }
        >
          <Row gutter={16}>
            <Col span={8}>
              <Card size="small" style={{ background: '#f6ffed', borderColor: '#b7eb8f' }}>
                <Statistic
                  title="🎮 Gaming Revenue"
                  value={revenue?.gaming ?? 0}
                  prefix="$"
                  precision={2}
                  valueStyle={{ color: '#52c41a' }}
                />
                {totalRevenue > 0 && (
                  <Progress
                    percent={Math.round(((revenue?.gaming ?? 0) / totalRevenue) * 100)}
                    size="small"
                    strokeColor="#52c41a"
                    style={{ marginTop: 8 }}
                  />
                )}
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small" style={{ background: '#fff7e6', borderColor: '#ffd591' }}>
                <Statistic
                  title="🍔 F&B Revenue"
                  value={revenue?.fnb ?? 0}
                  prefix="$"
                  precision={2}
                  valueStyle={{ color: '#fa8c16' }}
                />
                {totalRevenue > 0 && (
                  <Progress
                    percent={Math.round(((revenue?.fnb ?? 0) / totalRevenue) * 100)}
                    size="small"
                    strokeColor="#fa8c16"
                    style={{ marginTop: 8 }}
                  />
                )}
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small" style={{ background: '#e6f7ff', borderColor: '#91d5ff' }}>
                <Statistic
                  title="🃏 TCG Retail Revenue"
                  value={revenue?.tcg ?? 0}
                  prefix="$"
                  precision={2}
                  valueStyle={{ color: '#1890ff' }}
                />
                {totalRevenue > 0 && (
                  <Progress
                    percent={Math.round(((revenue?.tcg ?? 0) / totalRevenue) * 100)}
                    size="small"
                    strokeColor="#1890ff"
                    style={{ marginTop: 8 }}
                  />
                )}
              </Card>
            </Col>
          </Row>
        </Card>

        {/* P&L Summary */}
        <Row gutter={16}>
          <Col span={6}>
            <Card>
              <Statistic
                title={
                  <Space>
                    Total Revenue
                    <Tooltip title="Sum of Gaming + F&B + TCG sales (status = paid)">
                      <InfoCircleOutlined style={{ color: '#999' }} />
                    </Tooltip>
                  </Space>
                }
                value={totalRevenue}
                prefix={<RiseOutlined />}
                precision={2}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title={
                  <Space>
                    Gross Profit
                    <Tooltip title="Revenue minus TCG cost of goods sold">
                      <InfoCircleOutlined style={{ color: '#999' }} />
                    </Tooltip>
                  </Space>
                }
                value={grossProfit}
                prefix={<DollarOutlined />}
                precision={2}
                valueStyle={{ color: grossProfit >= 0 ? '#52c41a' : '#ff4d4f' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title={
                  <Space>
                    Operating Expenses
                    <Tooltip title="Recurring expenses (salaries, rent, utilities, etc.) in the selected period">
                      <InfoCircleOutlined style={{ color: '#999' }} />
                    </Tooltip>
                  </Space>
                }
                value={opEx?.total ?? 0}
                prefix={<FallOutlined />}
                precision={2}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title={
                  <Space>
                    Net Income
                    <Tooltip title="Gross Profit minus Operating Expenses">
                      <InfoCircleOutlined style={{ color: '#999' }} />
                    </Tooltip>
                  </Space>
                }
                value={netIncome}
                prefix={<DollarOutlined />}
                precision={2}
                valueStyle={{ color: netIncome >= 0 ? '#52c41a' : '#ff4d4f' }}
              />
              <div style={{ marginTop: 12 }}>
                <Progress
                  percent={Math.min(Math.abs(Math.round(netMargin)), 100)}
                  status={netIncome >= 0 ? 'success' : 'exception'}
                  strokeColor={netIncome >= 0 ? '#52c41a' : '#ff4d4f'}
                />
                <small>
                  {netIncome >= 0 ? 'Profit' : 'Loss'} Margin: {netMargin.toFixed(1)}%
                </small>
              </div>
            </Card>
          </Col>
        </Row>

        {/* Ingredient COGS + Food Cost % — only renders when stock tracking
            has captured any cost in the period. Tied to the recipe + cost
            data from the Stock Management module. */}
        {(dashboard?.cogs?.ingredientCogs ?? 0) > 0 && (
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Card>
                <Statistic
                  title={
                    <Space>
                      🍔 Ingredient COGS
                      <Tooltip title="Sum of ingredient cost across every F&B sale in the period. Computed at sale time from the recipe × the ingredient's latest Buy Price.">
                        <InfoCircleOutlined style={{ color: '#999' }} />
                      </Tooltip>
                    </Space>
                  }
                  value={dashboard!.cogs.ingredientCogs ?? 0}
                  prefix="$"
                  precision={2}
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card>
                <Statistic
                  title={
                    <Space>
                      Food Cost %
                      <Tooltip title="Ingredient COGS / Total Revenue × 100. Industry benchmark is roughly 28–35% for full-service F&B.">
                        <InfoCircleOutlined style={{ color: '#999' }} />
                      </Tooltip>
                    </Space>
                  }
                  value={dashboard!.cogs.foodCostPercent ?? 0}
                  suffix="%"
                  precision={1}
                  valueStyle={{
                    color: (dashboard!.cogs.foodCostPercent ?? 0) > 35
                      ? '#ff4d4f'
                      : (dashboard!.cogs.foodCostPercent ?? 0) > 28
                        ? '#fa8c16'
                        : '#52c41a'
                  }}
                />
              </Card>
            </Col>
          </Row>
        )}

        {/* TCG COGS */}
        {(dashboard?.cogs?.total ?? 0) > 0 && (
          <Card
            title={
              <Space>
                <span>🃏 TCG Cost of Goods Sold</span>
                <Tooltip title="Sum of BuyPrice × Quantity for all TCG items sold in this period">
                  <InfoCircleOutlined style={{ color: '#999' }} />
                </Tooltip>
              </Space>
            }
            size="small"
          >
            <Statistic
              value={dashboard?.cogs?.total ?? 0}
              prefix="$"
              precision={2}
              valueStyle={{ color: '#ff4d4f' }}
            />
            {totalRevenue > 0 && (revenue?.tcg ?? 0) > 0 && (
              <small style={{ color: '#999' }}>
                TCG Gross Margin:{' '}
                {(((revenue!.tcg - dashboard!.cogs.total) / revenue!.tcg) * 100).toFixed(1)}%
              </small>
            )}
          </Card>
        )}

        {/* Operating Expenses Breakdown */}
        <Card
          title={
            <Space>
              <FallOutlined style={{ color: '#ff4d4f' }} />
              <span>Operating Expenses Breakdown</span>
              <Tag color="red">{fmt(opEx?.total ?? 0)}</Tag>
              <Tooltip title="Recurring operational expenses whose period overlaps the reporting range. Each amount is prorated by overlap days — annual rent shows ~1/12 in a monthly filter.">
                <InfoCircleOutlined style={{ color: '#999' }} />
              </Tooltip>
            </Space>
          }
        >
          {(opEx?.lines?.length ?? 0) === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#999' }}>
              No operating expenses in this period
            </div>
          ) : (
            <Table
              columns={expenseColumns}
              dataSource={opEx?.lines ?? []}
              rowKey="category"
              pagination={false}
              size="small"
              summary={() => (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0}>
                    <strong>Total</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">
                    <strong style={{ color: '#ff4d4f' }}>{fmt(opEx?.total ?? 0)}</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2} />
                </Table.Summary.Row>
              )}
            />
          )}
        </Card>

        {/* Capital Expenses */}
        <Card
          title={
            <Space>
              <span>🏗️ Capital Investments</span>
              <Tag color="purple">{fmt(capEx?.total ?? 0)}</Tag>
              <Tooltip title="One-time capital investments (furniture, equipment, civil work, etc.). Shown separately — not included in operating P&L.">
                <InfoCircleOutlined style={{ color: '#999' }} />
              </Tooltip>
            </Space>
          }
        >
          {(capEx?.lines?.length ?? 0) === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#999' }}>
              No capital investments in this period
            </div>
          ) : (
            <Table
              columns={capExColumns}
              dataSource={capEx?.lines ?? []}
              rowKey="category"
              pagination={false}
              size="small"
              summary={() => (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0}>
                    <strong>Total</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">
                    <strong style={{ color: '#722ed1' }}>{fmt(capEx?.total ?? 0)}</strong>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              )}
            />
          )}
        </Card>

        <Divider />

        {/* Books Status */}
        <Row gutter={16}>
          <Col span={12}>
            <Card>
              <Statistic
                title="Books Status (Trial Balance)"
                value={isBalanced ? 'Balanced' : 'Not Balanced'}
                prefix={
                  <CheckCircleOutlined
                    style={{ color: isBalanced ? '#52c41a' : '#ff4d4f' }}
                  />
                }
                valueStyle={{ color: isBalanced ? '#52c41a' : '#ff4d4f' }}
              />
              <div style={{ marginTop: 12 }}>
                <small>
                  {isBalanced
                    ? 'Debits equal credits — books are in balance'
                    : 'Warning: books are not balanced — review journal entries'}
                </small>
              </div>
            </Card>
          </Col>
          <Col span={12}>
            <Card>
              <Statistic
                title="Reporting Period"
                value={`${dateRange[0].format('MMM DD, YYYY')} → ${dateRange[1].format('MMM DD, YYYY')}`}
                valueStyle={{ fontSize: 16 }}
              />
              <div style={{ marginTop: 12 }}>
                <small style={{ color: '#999' }}>
                  Revenue (sales) is filtered by the transaction's payment date.
                  Expenses and capital investments are filtered by the expense's
                  period AND prorated by overlap days — a $90k annual rent
                  shows as $7,500 in a monthly filter, and the full $90k only
                  when the filter spans the whole year. Trial balance is the
                  exception: it stays all-time so you can spot if the books
                  drift out of balance overall.
                </small>
              </div>
            </Card>
          </Col>
        </Row>

        {/* Recent Journal Entries */}
        <Card
          title="Recent Journal Entries"
          extra={
            <Space>
              <Tag color="green">{postedCount} Posted</Tag>
              <Tag color="orange">{draftCount} Draft</Tag>
              <Button type="link" onClick={() => navigate('/accounting/journal')}>
                View All
              </Button>
            </Space>
          }
        >
          <Table
            columns={recentEntriesColumns}
            dataSource={recentEntries}
            rowKey="id"
            pagination={false}
            size="small"
          />
        </Card>

          {/* Backfill Card */}
<Card
  title={
    <Space>
      <span>🔧 Journal Entry Backfill</span>
      <Tag color="orange">Admin Tool</Tag>
    </Space>
  }
>
  <Space direction="vertical" style={{ width: '100%' }}>
    <div style={{ color: '#666', fontSize: 13 }}>
      Use these buttons to create missing journal entries for historical
      transactions and expenses. Safe to run multiple times — already-posted
      entries are skipped automatically.
    </div>

    <Space wrap>
      <Button
        type="primary"
        danger
        loading={backfillLoading}
        onClick={async () => {
          setBackfillLoading(true);
          setBackfillResult(null);
          try {
            const result = await backfillTransactions();
            setBackfillResult(result);
            message.success(`Transactions backfill done: ${result.success} created, ${result.failed} failed`);
            loadDashboard(); // refresh numbers
          } catch {
            message.error('Backfill failed');
          } finally {
            setBackfillLoading(false);
          }
        }}
      >
        Backfill Transactions
      </Button>

      <Button
        loading={backfillLoading}
        onClick={async () => {
          setBackfillLoading(true);
          setBackfillResult(null);
          try {
            const result = await backfillExpenses();
            setBackfillResult(result);
            message.success(`Expenses backfill done: ${result.success} created, ${result.failed} failed`);
            loadDashboard();
          } catch {
            message.error('Backfill failed');
          } finally {
            setBackfillLoading(false);
          }
        }}
      >
        Backfill Expenses
      </Button>
    </Space>

    {/* Result summary */}
    {backfillResult && (
      <div style={{
        background: '#f5f5f5',
        borderRadius: 8,
        padding: 16,
        marginTop: 8
      }}>
        <Row gutter={16}>
          <Col span={6}>
            <Statistic title="Total Found" value={backfillResult.total} />
          </Col>
          <Col span={6}>
            <Statistic
              title="Created"
              value={backfillResult.success}
              valueStyle={{ color: '#52c41a' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Failed"
              value={backfillResult.failed}
              valueStyle={{ color: backfillResult.failed > 0 ? '#ff4d4f' : '#52c41a' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Already Existed"
              value={backfillResult.total - backfillResult.success - backfillResult.failed}
              valueStyle={{ color: '#1890ff' }}
            />
          </Col>
        </Row>

        {backfillResult.failed > 0 && backfillResult.errors.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <details>
              <summary style={{ cursor: 'pointer', color: '#ff4d4f', fontSize: 13 }}>
                Show {backfillResult.errors.length} error(s)
              </summary>
              <div style={{
                maxHeight: 200,
                overflowY: 'auto',
                marginTop: 8,
                padding: 8,
                background: '#fff2f0',
                borderRadius: 4,
                fontSize: 12,
                fontFamily: 'monospace'
              }}>
                {backfillResult.errors.map((e, i) => (
                  <div key={i} style={{ color: '#cf1322', marginBottom: 2 }}>{e}</div>
                ))}
              </div>
            </details>
          </div>
        )}
      </div>
    )}
  </Space>
</Card>

      </Space>
    </Spin>
  );
};

export default AccountingDashboard;