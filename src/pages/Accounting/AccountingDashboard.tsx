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
  Tooltip,
  Modal
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
import { backfillTransactions, backfillExpenses, BackfillResultDto, CashOnHandDto, getIngredientCogsBreakdown, IngredientCogsBreakdownDto, getMetricBreakdown, MetricBreakdownDto } from '../../services/accountingService';

// Extra data sources for the owner-summary grid at the top of the page:
//   - Inventory Valuation is the F&B ingredient stock value
//   - Item Revenue Report exposes TCG stock buy / sell value at cost + retail
// Cash on Hand is computed by the server (dashboard.cashOnHand):
//   baseline (IntegrationSettings) + revenue − TOTAL expenses
import { getInventoryValuation } from '../../services/inventoryValuationService';
import { getItemRevenueReport } from '../../services/itemRevenueReportService';
import CashOnHandCard from '../../components/dashboard/CashOnHandCard';

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

  // Owner-summary grid data (Rami's "Axis accounting display" layout).
  // Cash on Hand is now handled by CashOnHandCard which reads the baseline
  // from IntegrationSettings and computes on the fly — no local state needed.
  const [inventoryValue, setInventoryValue] = useState<number>(0);
  const [tcgStockBuy, setTcgStockBuy] = useState<number>(0);
  const [tcgStockSell, setTcgStockSell] = useState<number>(0);
  // TCG COGS from the Item Revenue Report — Rami calls this the source of
  // truth for TCG cost of goods (row 12 of his spec).
  const [tcgCogsFromReport, setTcgCogsFromReport] = useState<number>(0);

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
      // Fire the extra owner-summary queries in parallel with the main
      // dashboard load — they don't block each other, and we swallow their
      // individual failures so a hiccup on one doesn't blank the page.
      const invPromise = getInventoryValuation(fromIso, toIso).catch(() => null);
      // Item report takes [from, to) instants — send the END of the last day
      // so a picker value at 00:00 doesn't drop that day.
      const itemReportPromise = getItemRevenueReport({
        from: dateRange[0].startOf('day').toISOString(),
        to: dateRange[1].endOf('day').toISOString(),
      }).catch(() => null);

      const [dashboardData, trialBalance, entriesResult, inv, itemReport] = await Promise.all([
        getAccountingDashboard(fromIso, toIso),
        getTrialBalance(),
        searchJournalEntries({
          pageNumber: 1,
          pageSize: 5,
          fromDate: fromIso,
          toDate: toIso,
        }),
        invPromise,
        itemReportPromise,
      ]);

      setDashboard(dashboardData);
      setIsBalanced(trialBalance.isBalanced);
      setRecentEntries(entriesResult.items);
      setInventoryValue(inv?.totalValue ?? 0);
      setTcgStockBuy(itemReport?.tcgStockBuyValue ?? 0);
      setTcgStockSell(itemReport?.tcgStockSellValue ?? 0);
      setTcgCogsFromReport(itemReport?.tcgCogs ?? 0);
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
  const eventsRevenue = revenue?.events ?? 0;
  // Four revenue cards across a 24-col row when events are in play, three otherwise.
  const revSpan = eventsRevenue > 0 ? 6 : 8;

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

        {/* ═══════════════════════════════════════════════════════════════
             OWNER SUMMARY GRID
             Fixed layout per Rami's mockup:
               row 1: [Axis Account (Cash on Hand)  full width]
               row 2: [Total Revenue | Operating Expenses | Net Income]
               row 3: [Gaming Revenue]
               row 4: [F&B Rev | Ing COGS | F&B Net | Food Cost % | Inv Val]
               row 5: [TCG Rev | TCG COGS | TCG Net | Stock Buy | Stock Sell]
             Colour palette:
               green  = revenue
               red    = expenses / costs
               cyan   = summaries / nets
               purple = valuations / stock
               amber  = ratios (Food Cost %)
             ═══════════════════════════════════════════════════════════════ */}
        <OwnerSummaryGrid
          fromIso={dateRange[0].toISOString()}
          toIso={dateRange[1].toISOString()}
          cashOnHand={dashboard?.cashOnHand ?? null}
          onBaselineSaved={loadDashboard}
          totalRevenue={totalRevenue}
          operatingExpenses={opEx?.total ?? 0}
          gamingRevenue={revenue?.gaming ?? 0}
          fnbRevenue={revenue?.fnb ?? 0}
          ingredientCogs={dashboard?.cogs?.ingredientCogs ?? 0}
          foodCostPercent={dashboard?.cogs?.foodCostPercent ?? 0}
          inventoryValue={inventoryValue}
          tcgRevenue={revenue?.tcg ?? 0}
          // TCG COGS — sourced from the Item Revenue Report per Rami's spec
          // (row 12), since that report is his single source of truth for TCG.
          tcgCogs={tcgCogsFromReport}
          tcgStockBuy={tcgStockBuy}
          tcgStockSell={tcgStockSell}
        />

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
            <Col span={revSpan}>
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
            <Col span={revSpan}>
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
            <Col span={revSpan}>
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
            {/* Only appears once events have actually sold, so the layout
                doesn't shrink for a lounge that never runs them. */}
            {eventsRevenue > 0 && (
              <Col span={revSpan}>
                <Card size="small" style={{ background: '#f9f0ff', borderColor: '#d3adf7' }}>
                  <Statistic
                    title={
                      <Space>
                        🎟️ Event Revenue
                        <Tooltip title="Paid event registrations from Admin → Events, booked to 4300 Event Revenue. Counted on the date the payment was confirmed.">
                          <InfoCircleOutlined style={{ color: '#999' }} />
                        </Tooltip>
                      </Space>
                    }
                    value={eventsRevenue}
                    prefix="$"
                    precision={2}
                    valueStyle={{ color: '#722ed1' }}
                  />
                  {totalRevenue > 0 && (
                    <Progress
                      percent={Math.round((eventsRevenue / totalRevenue) * 100)}
                      size="small"
                      strokeColor="#722ed1"
                      style={{ marginTop: 8 }}
                    />
                  )}
                </Card>
              </Col>
            )}
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
              <span>🏗️ Assets</span>
              <Tag color="purple">{fmt(capEx?.total ?? 0)}</Tag>
              <Tooltip title="Assets — one-time purchases (furniture, equipment, civil work, etc.). Shown separately — not included in operating P&L.">
                <InfoCircleOutlined style={{ color: '#999' }} />
              </Tooltip>
            </Space>
          }
        >
          {(capEx?.lines?.length ?? 0) === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#999' }}>
              No assets in this period
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
                  Expenses and assets are filtered by the expense's
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

// ══════════════════════════════════════════════════════════════════════
// OwnerSummaryGrid
// -----------------------------------------------------------------------
// Rami's fixed layout — five rows of colour-coded metric tiles.
// Kept in this file (not a separate module) because it's specific to the
// accounting dashboard and has no reuse potential elsewhere.
// ══════════════════════════════════════════════════════════════════════

type Palette = 'green' | 'red' | 'cyan' | 'purple' | 'amber';

interface MetricTileProps {
  label: string;
  value: string;
  palette: Palette;
  tooltip?: string;
  subtitle?: string;
  /** When set, the tile is clickable and opens the breakdown modal. */
  onClick?: () => void;
}

// Colour tokens — pastel bg + saturated fg for readability at a glance.
const TILE_STYLES: Record<Palette, { bg: string; fg: string; border: string }> = {
  green:  { bg: '#DCFCE7', fg: '#166534', border: '#86EFAC' },
  red:    { bg: '#FECACA', fg: '#991B1B', border: '#F87171' },
  cyan:   { bg: '#CFFAFE', fg: '#155E75', border: '#67E8F9' },
  purple: { bg: '#E9D5FF', fg: '#6B21A8', border: '#C4B5FD' },
  amber:  { bg: '#FEF3C7', fg: '#92400E', border: '#FCD34D' },
};

const MetricTile: React.FC<MetricTileProps> = ({ label, value, palette, tooltip, subtitle, onClick }) => {
  const s = TILE_STYLES[palette];
  const inner = (
    <div
      style={{
        background: s.bg,
        border: `1px solid ${s.border}`,
        color: s.fg,
        padding: '10px 14px',
        borderRadius: 8,
        minHeight: 70,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        cursor: onClick ? 'pointer' : tooltip ? 'help' : 'default',
        position: 'relative',
      }}
      onClick={onClick}
      title={onClick ? 'Click for breakdown' : undefined}
    >
      {onClick && <span style={{ position: 'absolute', top: 6, right: 8, fontSize: 10, opacity: 0.55 }}>details ›</span>}
      <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.85, display: 'flex', alignItems: 'center', gap: 4 }}>
        {label}
        {tooltip && <InfoCircleOutlined style={{ fontSize: 11, opacity: 0.6 }} />}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.2 }}>{value}</div>
      {subtitle && (
        <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>{subtitle}</div>
      )}
    </div>
  );
  return tooltip ? <Tooltip title={tooltip}>{inner}</Tooltip> : inner;
};

interface OwnerSummaryGridProps {
  // Used by the CashOnHandCard to fetch revenue + opex if not overridden.
  fromIso: string;
  toIso: string;
  cashOnHand: CashOnHandDto | null;
  onBaselineSaved: () => void;
  totalRevenue: number;
  operatingExpenses: number;
  gamingRevenue: number;
  fnbRevenue: number;
  ingredientCogs: number;
  foodCostPercent: number;
  inventoryValue: number;
  tcgRevenue: number;
  tcgCogs: number;
  tcgStockBuy: number;
  tcgStockSell: number;
}

// Generic drill-down modal for any Owner Summary tile.
const BreakdownModal: React.FC<{ metric: string | null; fromIso: string; toIso: string; onClose: () => void; onOpenCogs?: () => void }> = ({ metric, fromIso, toIso, onClose, onOpenCogs }) => {
  const [d, setD] = useState<MetricBreakdownDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [openRows, setOpenRows] = useState<Set<number>>(new Set());
  const [q, setQ] = useState('');
  useEffect(() => {
    if (!metric) { setD(null); setOpenRows(new Set()); setQ(''); return; }
    setBusy(true);
    getMetricBreakdown(metric, fromIso, toIso).then(setD).catch(() => setD(null)).finally(() => setBusy(false));
  }, [metric, fromIso, toIso]);
  const money = (n: number) => `${n < 0 ? '−' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const isPct = metric === 'foodcost';
  const denom = d ? d.rows.filter(r => r.amount > 0).reduce((s, r) => s + r.amount, 0) : 0;
  return (
    <Modal open={!!metric} onCancel={onClose} footer={null} width={860} title={d?.title ?? 'Breakdown'} destroyOnHidden>
      {busy && <div style={{ padding: 24, textAlign: 'center' }}><Spin /></div>}
      {!busy && d && (
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 26, fontWeight: 800 }}>{isPct ? `${d.total.toFixed(1)}%` : money(d.total)}</span>
            <span style={{ fontSize: 12, color: '#6b7280' }}>{d.rows.length} line{d.rows.length === 1 ? '' : 's'}</span>
          </div>
          {d.note && <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>{d.note}</div>}
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            {d.rows.some(r => r.children && r.children.length) && (
              <>
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search items…" style={{ flex: 1, height: 30, border: '1px solid #e5e7eb', borderRadius: 6, padding: '0 8px', fontSize: 12 }} />
                <button onClick={() => setOpenRows(new Set(d.rows.map((_, i) => i)))} style={{ fontSize: 11, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', padding: '0 8px', cursor: 'pointer' }}>Expand all</button>
                <button onClick={() => setOpenRows(new Set())} style={{ fontSize: 11, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', padding: '0 8px', cursor: 'pointer' }}>Collapse</button>
              </>
            )}
            <button
              onClick={() => {
                const lines: string[][] = [['Category', 'Item', 'Count', 'Amount', 'Detail']];
                d.rows.forEach(r => {
                  lines.push([r.label, '', String(r.count ?? ''), r.amount.toFixed(2), r.detail ?? '']);
                  (r.children ?? []).forEach(c => lines.push([r.label, c.label, String(c.count ?? ''), c.amount.toFixed(2), c.detail ?? '']));
                });
                const csv = lines.map(l => l.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
                const a = document.createElement('a');
                a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
                a.download = `${d.metric}_breakdown.csv`; a.click(); URL.revokeObjectURL(a.href);
              }}
              style={{ fontSize: 11, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', padding: '0 8px', cursor: 'pointer' }}>⬇ CSV</button>
          </div>
          {metric === 'fnbnet' && onOpenCogs && (
            <button onClick={() => { onClose(); onOpenCogs(); }} style={{ marginBottom: 10, fontSize: 12, color: '#4f46e5', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              → open the per-ingredient COGS breakdown
            </button>
          )}
          <div style={{ maxHeight: 420, overflow: 'auto' }}>
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ color: '#6b7280', textAlign: 'left' }}>
                  <th style={{ padding: '4px 6px' }}>Line</th>
                  {d.rows.some(r => r.count != null) && <th style={{ padding: '4px 6px', textAlign: 'right' }}>{d.countLabel ?? 'count'}</th>}
                  <th style={{ padding: '4px 6px', textAlign: 'right' }}>Amount</th>
                  {!isPct && <th style={{ padding: '4px 6px', width: 140 }}>Share</th>}
                </tr>
              </thead>
              <tbody>
                {d.rows.map((r, i) => {
                  const share = !isPct && denom > 0 && r.amount > 0 ? (r.amount / denom) * 100 : null;
                  const kids = (r.children ?? []).filter(c => !q || c.label.toLowerCase().includes(q.toLowerCase()));
                  const hasKids = (r.children?.length ?? 0) > 0;
                  const isOpen = openRows.has(i) || (!!q && kids.length > 0);
                  if (q && hasKids && kids.length === 0) return null;
                  return (
                    <React.Fragment key={i}>
                    <tr style={{ borderTop: '1px solid #f3f4f6', cursor: hasKids ? 'pointer' : undefined }}
                        onClick={() => { if (!hasKids) return; setOpenRows(prev => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; }); }}>
                      <td style={{ padding: '6px' }}>
                        <div style={{ fontWeight: 500 }}>{hasKids ? (isOpen ? '▾ ' : '▸ ') : ''}{r.label}{hasKids && <span style={{ color: '#9ca3af', fontWeight: 400 }}> · {r.children!.length} items</span>}</div>
                        {r.detail && <div style={{ fontSize: 11, color: '#9ca3af' }}>{r.detail}</div>}
                      </td>
                      {d.rows.some(x => x.count != null) && <td style={{ padding: '6px', textAlign: 'right', color: '#6b7280' }}>{r.count ?? ''}</td>}
                      <td style={{ padding: '6px', textAlign: 'right', fontWeight: 600, color: r.amount < 0 ? '#b91c1c' : undefined }}>{isPct ? money(r.amount) : money(r.amount)}</td>
                      {!isPct && (
                        <td style={{ padding: '6px' }}>
                          {share != null && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ flex: 1, height: 6, background: '#f3f4f6', borderRadius: 3 }}>
                                <div style={{ width: `${Math.min(100, share)}%`, height: 6, background: '#6366f1', borderRadius: 3 }} />
                              </div>
                              <span style={{ fontSize: 11, color: '#6b7280', width: 38, textAlign: 'right' }}>{share.toFixed(0)}%</span>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                    {isOpen && kids.map((c, j) => (
                      <tr key={`${i}-${j}`} style={{ background: '#fafafa' }}>
                        <td style={{ padding: '4px 6px 4px 22px' }}>
                          <div style={{ fontSize: 12 }}>{c.label}</div>
                          {c.detail && <div style={{ fontSize: 11, color: '#9ca3af' }}>{c.detail}</div>}
                        </td>
                        {d.rows.some(x => x.count != null) && <td style={{ padding: '4px 6px', textAlign: 'right', color: '#6b7280' }}>{c.count ?? ''}</td>}
                        <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 500 }}>{money(c.amount)}</td>
                        {!isPct && <td style={{ padding: '4px 6px', fontSize: 11, color: '#9ca3af' }}>{r.amount > 0 && c.amount > 0 ? `${((c.amount / r.amount) * 100).toFixed(0)}% of ${r.label}` : ''}</td>}
                      </tr>
                    ))}
                    </React.Fragment>
                  );
                })}
                {d.rows.length === 0 && <tr><td colSpan={4} style={{ padding: 16, textAlign: 'center', color: '#9ca3af' }}>Nothing in this period.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {!busy && !d && metric && <div style={{ color: '#b91c1c', fontSize: 12 }}>Could not load the breakdown.</div>}
    </Modal>
  );
};

// Where does the Ingredient COGS number come from? Expandable per-ingredient
// table with mismatch flags — the first place to look when F&B net goes red.
const IngredientCogsPanel: React.FC<{ fromIso: string; toIso: string; forceOpen?: number }> = ({ fromIso, toIso, forceOpen }) => {
  const [open, setOpen] = useState(false);
  useEffect(() => { if (forceOpen) setOpen(true); }, [forceOpen]);
  const [d, setD] = useState<IngredientCogsBreakdownDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [showMoves, setShowMoves] = useState(false);
  const [openIng, setOpenIng] = useState<number | null>(null);
  useEffect(() => {
    if (!open) return;
    setBusy(true);
    getIngredientCogsBreakdown(fromIso, toIso).then(setD).catch(() => setD(null)).finally(() => setBusy(false));
  }, [open, fromIso, toIso]);
  const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const flagged = d?.lines.filter(l => l.flag) ?? [];
  return (
    <div style={{ border: '1px solid #fecaca', background: '#fff7f7', borderRadius: 8, padding: '8px 12px' }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#991b1b', padding: 0 }}>
        {open ? '▾' : '▸'} Where does the Ingredient COGS come from? (per-ingredient breakdown)
      </button>
      {open && (
        <div style={{ marginTop: 8 }}>
          {busy && <Spin size="small" />}
          {!busy && d && (
            <>
              <div style={{ fontSize: 12, color: '#374151', marginBottom: 6 }}>
                Booked <b>{money(d.total)}</b> over {d.movementCount} consumption movements.
                At today's ingredient prices the same quantities would cost <b>{money(d.expectedAtCurrentPrices)}</b>.
                {Math.abs(d.total - d.expectedAtCurrentPrices) > Math.max(50, d.expectedAtCurrentPrices * 0.2) && (
                  <span style={{ color: '#b91c1c' }}> — big gap: booked costs don't match current prices (unit / price mismatch or a double rebuild).</span>
                )}
                {flagged.length > 0 && <span style={{ color: '#b91c1c' }}> {flagged.length} ingredient(s) flagged.</span>}
              </div>
              {(d.recipeProblems?.length ?? 0) > 0 && (
                <div style={{ marginBottom: 10, border: '1px solid #fca5a5', background: '#fff', borderRadius: 8, padding: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#991b1b' }}>
                    ⚠ {d.recipeProblems!.length} recipe line(s) look wrong — these are what inflate the COGS
                  </div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>
                    Fix the recipe (Inventory → Recipes: quantity / unit), then run Tools → COGS Rebuild for this period so history is re-costed.
                  </div>
                  <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                    <thead><tr style={{ textAlign: 'left', color: '#6b7280' }}>
                      <th style={{ padding: 3 }}>Item (id)</th><th style={{ padding: 3 }}>Ingredient (id)</th><th style={{ padding: 3 }}>Recipe line (line id)</th><th style={{ padding: 3, textAlign: 'right' }}>Cost / portion</th>
                      <th style={{ padding: 3, textAlign: 'right' }}>Sold</th><th style={{ padding: 3, textAlign: 'right' }}>Cost in period</th><th style={{ padding: 3 }}>Why</th>
                    </tr></thead>
                    <tbody>
                      {d.recipeProblems!.slice(0, 40).map((c, i) => (
                        <tr key={i} style={{ borderTop: '1px solid #fee2e2' }}>
                          <td style={{ padding: 3, fontWeight: 600 }}>{c.itemName} <span style={{ color: '#9ca3af', fontWeight: 400 }}>#{c.itemId} · ${c.itemSellPrice.toFixed(2)}</span></td>
                          <td style={{ padding: 3 }}>{c.ingredientName} <span style={{ color: '#9ca3af' }}>#{c.ingredientId}</span></td>
                          <td style={{ padding: 3 }}>{c.recipeQty} {c.recipeUnit ?? '(no unit)'} → {c.qtyPerPortionInIngredientUnit} {c.ingredientUnit} <span style={{ color: '#9ca3af' }}>(line #{c.recipeLineId})</span></td>
                          <td style={{ padding: 3, textAlign: 'right' }}>{money(c.costPerPortion)}</td>
                          <td style={{ padding: 3, textAlign: 'right' }}>{c.unitsSoldInPeriod}</td>
                          <td style={{ padding: 3, textAlign: 'right', fontWeight: 600 }}>{money(c.costInPeriod)}</td>
                          <td style={{ padding: 3, color: '#b91c1c' }}>{c.flag}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div style={{ maxHeight: 320, overflow: 'auto' }}>
                <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: '#6b7280' }}>
                      <th style={{ padding: 4 }}>Ingredient</th><th style={{ padding: 4, textAlign: 'right' }}>Qty used</th>
                      <th style={{ padding: 4, textAlign: 'right' }}>Booked cost</th><th style={{ padding: 4, textAlign: 'right' }}>Avg unit cost</th>
                      <th style={{ padding: 4, textAlign: 'right' }}>Current price</th><th style={{ padding: 4, textAlign: 'right' }}>At current price</th>
                      <th style={{ padding: 4 }}>Flag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.lines.map(l => (
                      <React.Fragment key={l.ingredientId}>
                      <tr style={{ borderTop: '1px solid #f3f4f6', background: l.flag ? '#fef2f2' : undefined, cursor: 'pointer' }}
                          onClick={() => setOpenIng(openIng === l.ingredientId ? null : l.ingredientId)} title="Click to see which recipes use it">
                        <td style={{ padding: 4 }}>{openIng === l.ingredientId ? '▾' : '▸'} {l.ingredientName} <span style={{ color: '#9ca3af' }}>({l.movementCount})</span></td>
                        <td style={{ padding: 4, textAlign: 'right' }}>{l.quantityConsumed.toLocaleString()} {l.unit}</td>
                        <td style={{ padding: 4, textAlign: 'right', fontWeight: 600 }}>{money(l.totalCost)}</td>
                        <td style={{ padding: 4, textAlign: 'right' }}>{l.avgUnitCost.toFixed(4)}/{l.unit}</td>
                        <td style={{ padding: 4, textAlign: 'right' }}>{l.currentBuyPrice == null ? '—' : `${l.currentBuyPrice.toFixed(4)}/${l.unit}`}</td>
                        <td style={{ padding: 4, textAlign: 'right' }}>{money(l.expectedAtCurrentPrice)}</td>
                        <td style={{ padding: 4, color: '#b91c1c' }}>{l.flag ?? ''}</td>
                      </tr>
                      {openIng === l.ingredientId && (
                        <tr><td colSpan={7} style={{ padding: '4px 4px 8px 18px', background: '#fafafa' }}>
                          {(d.consumersByIngredient?.[l.ingredientId] ?? []).length === 0 ? (
                            <span style={{ color: '#9ca3af' }}>No recipe uses this ingredient — consumption came from manual movements.</span>
                          ) : (
                            <table style={{ width: '100%', fontSize: 11 }}>
                              <thead><tr style={{ color: '#6b7280', textAlign: 'left' }}>
                                <th>Used by</th><th>Recipe line</th><th style={{ textAlign: 'right' }}>Cost / portion</th><th style={{ textAlign: 'right' }}>Sold</th><th style={{ textAlign: 'right' }}>Cost in period</th><th></th>
                              </tr></thead>
                              <tbody>
                                {(d.consumersByIngredient?.[l.ingredientId] ?? []).map((c, i) => (
                                  <tr key={i} style={{ color: c.flag ? '#b91c1c' : undefined }}>
                                    <td>{c.itemName} <span style={{ color: '#9ca3af' }}>#{c.itemId} · ${c.itemSellPrice.toFixed(2)}</span></td>
                                    <td>{c.recipeQty} {c.recipeUnit ?? '(no unit)'} → {c.qtyPerPortionInIngredientUnit} {c.ingredientUnit} <span style={{ color: '#9ca3af' }}>(line #{c.recipeLineId})</span></td>
                                    <td style={{ textAlign: 'right' }}>{money(c.costPerPortion)}</td>
                                    <td style={{ textAlign: 'right' }}>{c.unitsSoldInPeriod}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{money(c.costInPeriod)}</td>
                                    <td>{c.flag ?? ''}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td></tr>
                      )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="button" onClick={() => setShowMoves(v => !v)} style={{ marginTop: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#4f46e5', padding: 0 }}>
                {showMoves ? 'hide' : 'show'} the 25 biggest single movements
              </button>
              {showMoves && (
                <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse', marginTop: 4 }}>
                  <tbody>
                    {d.topMovements.map(m => (
                      <tr key={m.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                        <td style={{ padding: 3 }}>{new Date(m.createdOn).toLocaleString()}</td>
                        <td style={{ padding: 3 }}>{m.ingredientName}</td>
                        <td style={{ padding: 3, textAlign: 'right' }}>{m.quantity} {m.unit}</td>
                        <td style={{ padding: 3, textAlign: 'right' }}>{m.unitCost == null ? '—' : m.unitCost.toFixed(4)}</td>
                        <td style={{ padding: 3, textAlign: 'right', fontWeight: 600 }}>{money(m.totalCost)}</td>
                        <td style={{ padding: 3, color: '#6b7280' }}>{m.referenceType} #{m.referenceId}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
          {!busy && !d && <div style={{ fontSize: 12, color: '#b91c1c' }}>Could not load the breakdown.</div>}
        </div>
      )}
    </div>
  );
};

const OwnerSummaryGrid: React.FC<OwnerSummaryGridProps> = (p) => {
  const [bd, setBd] = useState<string | null>(null);
  const [cogsOpen, setCogsOpen] = useState(0);
  // Derived nets — kept here (not on the API) because they're pure
  // subtractions of numbers we already fetched. Cheaper than a second round-trip.
  const fnbNet = p.fnbRevenue - p.ingredientCogs;
  const tcgNet = p.tcgRevenue - p.tcgCogs;

  // Net Income per Rami's spec (row 4): Total Revenue − Operating Expenses.
  // Note: this is NOT the same as dashboard.netIncome which also subtracts
  // COGS. Rami wants the plain rev − opex figure here.
  const netIncome = p.totalRevenue - p.operatingExpenses;

  // Small helpers so the JSX stays scannable.
  const money = (n: number) =>
    `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const pct = (n: number) => `${n.toLocaleString('en-US', { maximumFractionDigits: 1 })}%`;

  // Grid template: 5 columns on desktop, collapses gracefully.
  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
    gap: 8,
  };

  return (
    <Card size="small" title={<span style={{ fontSize: 13 }}>📊 Owner Summary</span>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Row 1 — Cash on Hand full width. Uses the shared CashOnHandCard
            component so the main app dashboard reads the same source. */}
        <div style={{ position: 'relative' }}>
          <CashOnHandCard
            fromIso={p.fromIso}
            toIso={p.toIso}
            mode="full"
            cashOverride={p.cashOnHand}
            onBaselineSaved={p.onBaselineSaved}
          />
          <button onClick={() => setBd('cash')} style={{ position: 'absolute', top: 8, right: 12, fontSize: 11, color: '#155E75', background: 'rgba(255,255,255,0.6)', border: '1px solid #67E8F9', borderRadius: 6, padding: '2px 8px', cursor: 'pointer' }}>
            details ›
          </button>
        </div>

        {/* Row 2 — Total Revenue | Operating Expenses | Net Income */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
          <MetricTile palette="green" onClick={() => setBd('revenue')} label="2 · Total Revenue"       value={money(p.totalRevenue)} />
          <MetricTile palette="red"   onClick={() => setBd('opex')} label="3 · Operating Expenses" value={money(p.operatingExpenses)} />
          <MetricTile palette="cyan"  onClick={() => setBd('net')} label="4 · Net Income"         value={money(netIncome)}
            tooltip="Total Revenue − Operating Expenses (does not include COGS — see F&B Net and TCG Net for those)."
            subtitle={p.totalRevenue > 0 ? `${((netIncome / p.totalRevenue) * 100).toFixed(1)}% margin` : undefined} />
        </div>

        {/* Row 3 — Gaming Revenue standalone (matches the mockup) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 8 }}>
          <MetricTile palette="green" onClick={() => setBd('gaming')} label="5 · Gaming Revenue" value={money(p.gamingRevenue)} />
        </div>

        {/* Row 4 — F&B strip: Rev | Ing COGS | Net | Food Cost % | Inventory Val */}
        <div style={gridStyle}>
          <MetricTile palette="green"  onClick={() => setBd('fnb')} label="6 · F&B Revenue"        value={money(p.fnbRevenue)} />
          <MetricTile palette="red"    onClick={() => setCogsOpen(n => n + 1)} label="7 · Ingredients COGS"    value={money(p.ingredientCogs)} />
          <MetricTile palette="cyan"   onClick={() => setBd('fnbnet')} label="8 · F&B Net"             value={money(fnbNet)}
            tooltip="F&B Revenue − Ingredient COGS" />
          <MetricTile palette="amber"  onClick={() => setBd('foodcost')} label="9 · Food Cost %"         value={pct(p.foodCostPercent)}
            tooltip="Ingredient COGS ÷ Total Revenue × 100. Target: 28–35% for full-service F&B." />
          <MetricTile palette="purple" onClick={() => setBd('inventory')} label="10 · Inventory Valuation" value={money(p.inventoryValue)}
            tooltip="Current ingredient stock value at latest buy cost. Represents money sitting on shelves." />
        </div>

        <IngredientCogsPanel fromIso={p.fromIso} toIso={p.toIso} forceOpen={cogsOpen} />
        <BreakdownModal metric={bd} fromIso={p.fromIso} toIso={p.toIso} onClose={() => setBd(null)} onOpenCogs={() => setCogsOpen(n => n + 1)} />

        {/* Row 5 — TCG strip: Rev | COGS | Net | Stock Buy | Stock Sell */}
        <div style={gridStyle}>
          <MetricTile palette="green"  onClick={() => setBd('tcg')} label="11 · TCG Retail Revenue" value={money(p.tcgRevenue)} />
          <MetricTile palette="red"    onClick={() => setBd('tcgcogs')} label="12 · TCG Cost of Goods Sold" value={money(p.tcgCogs)} />
          <MetricTile palette="cyan"   onClick={() => setBd('tcgnet')} label="13 · TCG Net"             value={money(tcgNet)}
            tooltip="TCG Retail Revenue − TCG COGS" />
          <MetricTile palette="purple" onClick={() => setBd('tcgstockbuy')} label="14 · TCG Stock Buy"       value={money(p.tcgStockBuy)}
            tooltip="What we paid for TCG stock currently on hand (cost basis)." />
          <MetricTile palette="purple" onClick={() => setBd('tcgstocksell')} label="15 · TCG Stock Sell"      value={money(p.tcgStockSell)}
            tooltip="What TCG stock on hand would generate at retail price if fully sold." />
        </div>
      </div>
    </Card>
  );
};