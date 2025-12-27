// src/components/Accounting/AccountingDashboard.tsx

import React, { useState, useEffect } from 'react';
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
  Progress
} from 'antd';
import {
  DollarOutlined,
  RiseOutlined,
  FallOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  PlusOutlined,
  BookOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router';

import {
    searchJournalEntries
} from '../../services/journalApi';


import {
  getAccountSummary,
  getTrialBalance,
} from '../../services/accountsApi';

import type { AccountSummary, JournalEntry } from '../../services/accounting';



const AccountingDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<AccountSummary[]>([]);
  const [recentEntries, setRecentEntries] = useState<JournalEntry[]>([]);
  const [isBalanced, setIsBalanced] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [summaryData, trialBalance, entriesResult] = await Promise.all([
        getAccountSummary(),
        getTrialBalance(),
        searchJournalEntries({ pageNumber: 1, pageSize: 5 })
      ]);

      setSummary(summaryData);
      setRecentEntries(entriesResult.items);
      setIsBalanced(trialBalance.isBalanced);
    } catch (error) {
      message.error('Failed to load dashboard data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getAccountTypeBalance = (typeName: string): number => {
    return summary.find(s => s.accountTypeName === typeName)?.totalBalance || 0;
  };

  const totalAssets = getAccountTypeBalance('Asset');
  const totalLiabilities = getAccountTypeBalance('Liability');
  const totalEquity = getAccountTypeBalance('Equity');
  const totalRevenue = getAccountTypeBalance('Revenue');
  const totalExpenses = getAccountTypeBalance('Expense');

  // Calculate equity (Assets - Liabilities)
  const calculatedEquity = totalAssets - totalLiabilities;
  const netIncome = totalRevenue - totalExpenses;

  // Quick stats for current month
  const currentMonthEntries = recentEntries.filter(
    entry => dayjs(entry.entryDate).isAfter(dayjs().startOf('month'))
  );
  const postedEntriesCount = recentEntries.filter(e => e.isPosted).length;
  const draftEntriesCount = recentEntries.filter(e => !e.isPosted && !e.isVoided).length;

  const recentEntriesColumns: ColumnsType<JournalEntry> = [
    {
      title: 'Entry Number',
      dataIndex: 'entryNumber',
      key: 'entryNumber',
      width: 150
    },
    {
      title: 'Date',
      dataIndex: 'entryDate',
      key: 'entryDate',
      width: 120,
      render: (date) => dayjs(date).format('MMM DD, YYYY')
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true
    },
    {
      title: 'Amount',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      width: 120,
      align: 'right',
      render: (amount) => `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
    },
    {
      title: 'Status',
      key: 'status',
      width: 100,
      render: (_, record) => {
        if (record.isVoided) return <Tag color="red">Voided</Tag>;
        if (record.isPosted) return <Tag color="green">Posted</Tag>;
        return <Tag color="orange">Draft</Tag>;
      }
    }
  ];

  return (
    <Spin spinning={loading}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Quick Actions */}
        <Card title="Quick Actions">
          <Space size="middle">
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

        {/* Financial Overview Cards */}
        <Row gutter={16}>
          <Col span={8}>
            <Card>
              <Statistic
                title="Total Assets"
                value={totalAssets}
                prefix={<DollarOutlined />}
                precision={2}
                valueStyle={{ color: '#3f8600' }}
              />
              <div style={{ marginTop: 12 }}>
                <small>Total value of company assets</small>
              </div>
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="Total Liabilities"
                value={totalLiabilities}
                prefix={<DollarOutlined />}
                precision={2}
                valueStyle={{ color: '#cf1322' }}
              />
              <div style={{ marginTop: 12 }}>
                <small>Total company obligations</small>
              </div>
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="Owner's Equity"
                value={calculatedEquity}
                prefix={<DollarOutlined />}
                precision={2}
                valueStyle={{ color: '#1890ff' }}
              />
              <div style={{ marginTop: 12 }}>
                <small>Assets minus Liabilities</small>
              </div>
            </Card>
          </Col>
        </Row>

        {/* Revenue & Expenses */}
        <Row gutter={16}>
          <Col span={12}>
            <Card>
              <Statistic
                title="Total Revenue"
                value={totalRevenue}
                prefix={<RiseOutlined />}
                precision={2}
                valueStyle={{ color: '#52c41a' }}
              />
              <div style={{ marginTop: 12 }}>
                <small>Income from all sources</small>
              </div>
            </Card>
          </Col>
          <Col span={12}>
            <Card>
              <Statistic
                title="Total Expenses"
                value={totalExpenses}
                prefix={<FallOutlined />}
                precision={2}
                valueStyle={{ color: '#ff4d4f' }}
              />
              <div style={{ marginTop: 12 }}>
                <small>All business expenses</small>
              </div>
            </Card>
          </Col>
        </Row>

        {/* Net Income & Balance Status */}
        <Row gutter={16}>
          <Col span={12}>
            <Card>
              <Statistic
                title="Net Income"
                value={netIncome}
                prefix={<DollarOutlined />}
                precision={2}
                valueStyle={{ color: netIncome >= 0 ? '#52c41a' : '#ff4d4f' }}
              />
              <div style={{ marginTop: 12 }}>
                <Progress
                  percent={totalRevenue > 0 ? Math.round((netIncome / totalRevenue) * 100) : 0}
                  status={netIncome >= 0 ? 'success' : 'exception'}
                  strokeColor={netIncome >= 0 ? '#52c41a' : '#ff4d4f'}
                />
                <small>
                  {netIncome >= 0 ? 'Profit' : 'Loss'} Margin:{' '}
                  {totalRevenue > 0 ? ((netIncome / totalRevenue) * 100).toFixed(1) : '0'}%
                </small>
              </div>
            </Card>
          </Col>
          <Col span={12}>
            <Card>
              <Statistic
                title="Books Status"
                value={isBalanced ? 'Balanced' : 'Not Balanced'}
                prefix={
                  isBalanced ? (
                    <CheckCircleOutlined style={{ color: '#52c41a' }} />
                  ) : (
                    <CheckCircleOutlined style={{ color: '#ff4d4f' }} />
                  )
                }
                valueStyle={{ color: isBalanced ? '#52c41a' : '#ff4d4f' }}
              />
              <div style={{ marginTop: 12 }}>
                <small>
                  {isBalanced
                    ? 'Debits equal credits - books are in balance'
                    : 'Warning: Books are not balanced - review entries'}
                </small>
              </div>
            </Card>
          </Col>
        </Row>

        {/* Account Type Breakdown */}
        <Card title="Account Type Summary">
          <Row gutter={16}>
            {summary.map(item => (
              <Col span={8} key={item.accountTypeName} style={{ marginBottom: 16 }}>
                <Card size="small">
                  <Statistic
                    title={item.accountTypeName}
                    value={Math.abs(item.totalBalance)}
                    prefix="$"
                    precision={2}
                    suffix={
                      <Tag color="blue" style={{ marginLeft: 8 }}>
                        {item.accounts.length} accounts
                      </Tag>
                    }
                  />
                </Card>
              </Col>
            ))}
          </Row>
        </Card>

        {/* Recent Journal Entries */}
        <Card
          title="Recent Journal Entries"
          extra={
            <Space>
              <Tag color="green">{postedEntriesCount} Posted</Tag>
              <Tag color="orange">{draftEntriesCount} Draft</Tag>
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

        {/* Accounting Equation */}
        <Card title="Fundamental Accounting Equation">
          <Row gutter={16} align="middle" justify="center">
            <Col span={6}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '16px', color: '#666' }}>Assets</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3f8600' }}>
                  ${totalAssets.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </Col>
            <Col span={2}>
              <div style={{ textAlign: 'center', fontSize: '32px', color: '#999' }}>=</div>
            </Col>
            <Col span={6}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '16px', color: '#666' }}>Liabilities</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#cf1322' }}>
                  ${totalLiabilities.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </Col>
            <Col span={2}>
              <div style={{ textAlign: 'center', fontSize: '32px', color: '#999' }}>+</div>
            </Col>
            <Col span={6}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '16px', color: '#666' }}>Equity</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1890ff' }}>
                  ${calculatedEquity.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </Col>
          </Row>
          <div style={{ textAlign: 'center', marginTop: 16, color: '#999' }}>
            <small>
              The fundamental equation must always balance: Assets = Liabilities + Equity
            </small>
          </div>
        </Card>
      </Space>
    </Spin>
  );
};

export default AccountingDashboard;