// src/components/Accounting/GeneralLedger.tsx

import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Card,
  DatePicker,
  Space,
  Select,
  Row,
  Col,
  Statistic,
  message,
  Spin,
  Typography,
  Tag
} from 'antd';
import {
  DownloadOutlined,
  PrinterOutlined,
  ReloadOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';



import {
  getAllAccounts,
  getGeneralLedger,
} from '../../services/accountsApi';

import type { Account, GeneralLedger, GeneralLedgerLine } from '../../services/accounting';

const { RangePicker } = DatePicker;
const { Option } = Select;
const { Title, Text } = Typography;

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

  useEffect(() => {
    if (selectedAccountId) {
      loadLedger();
    }
  }, [selectedAccountId, dateRange]);

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

  const loadLedger = async () => {
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
  };

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
      render: (date) => dayjs(date).format('MMM DD, YYYY')
    },
    {
      title: 'Entry Number',
      dataIndex: 'entryNumber',
      key: 'entryNumber',
      width: 150,
      render: (entryNumber) => (
        <Tag color="blue">{entryNumber}</Tag>
      )
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true
    },
    {
      title: 'Debit',
      dataIndex: 'debit',
      key: 'debit',
      width: 150,
      align: 'right',
      render: (amount) =>
        amount > 0 ? (
          <Text style={{ color: '#1890ff' }}>
            ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </Text>
        ) : (
          '-'
        )
    },
    {
      title: 'Credit',
      dataIndex: 'credit',
      key: 'credit',
      width: 150,
      align: 'right',
      render: (amount) =>
        amount > 0 ? (
          <Text style={{ color: '#1890ff' }}>
            ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </Text>
        ) : (
          '-'
        )
    },
    {
      title: 'Running Balance',
      dataIndex: 'runningBalance',
      key: 'runningBalance',
      width: 150,
      align: 'right',
      render: (balance) => (
        <Text strong style={{ color: balance >= 0 ? '#52c41a' : '#ff4d4f' }}>
          ${Math.abs(balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </Text>
      )
    }
  ];

  const totalDebits = ledger?.transactions.reduce((sum, tx) => sum + tx.debit, 0) || 0;
  const totalCredits = ledger?.transactions.reduce((sum, tx) => sum + tx.credit, 0) || 0;
  const netChange = totalDebits - totalCredits;

  return (
    <div>
      {/* Summary Cards */}
      {ledger && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="Opening Balance"
                value={Math.abs(ledger.openingBalance)}
                prefix={ledger.openingBalance >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                precision={2}
                valueStyle={{ color: ledger.openingBalance >= 0 ? '#52c41a' : '#ff4d4f' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Total Debits"
                value={totalDebits}
                prefix="$"
                precision={2}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Total Credits"
                value={totalCredits}
                prefix="$"
                precision={2}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Closing Balance"
                value={Math.abs(ledger.closingBalance)}
                prefix={ledger.closingBalance >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                precision={2}
                valueStyle={{ color: ledger.closingBalance >= 0 ? '#52c41a' : '#ff4d4f' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Main Card */}
      <Card
        title={
          <Space direction="vertical" size={0}>
            <Title level={4} style={{ margin: 0 }}>
              General Ledger
            </Title>
            {selectedAccount && (
              <Text type="secondary">
                {selectedAccount.accountNumber} - {selectedAccount.accountName}
              </Text>
            )}
          </Space>
        }
        extra={
          <Space>
            <Select
              showSearch
              placeholder="Select account"
              style={{ width: 300 }}
              value={selectedAccountId}
              onChange={setSelectedAccountId}
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.children as unknown as string).toLowerCase().includes(input.toLowerCase())
              }
            >
              {accounts.map(acc => (
                <Option key={acc.id} value={acc.id}>
                  {acc.accountNumber} - {acc.accountName}
                </Option>
              ))}
            </Select>
            <RangePicker
              value={dateRange}
              onChange={(dates) => dates && setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs])}
              format="YYYY-MM-DD"
            />
            <Button icon={<ReloadOutlined />} onClick={loadLedger}>
              Refresh
            </Button>
            <Button icon={<DownloadOutlined />} onClick={handleExportToCSV} disabled={!ledger}>
              Export CSV
            </Button>
            <Button icon={<PrinterOutlined />} onClick={handlePrint} disabled={!ledger}>
              Print
            </Button>
          </Space>
        }
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: '50px 0' }}>
            <Spin size="large" />
          </div>
        ) : ledger ? (
          <>
            {/* Opening Balance Row */}
            <div
              style={{
                padding: '12px',
                background: '#fafafa',
                border: '1px solid #d9d9d9',
                borderRadius: '4px',
                marginBottom: '16px'
              }}
            >
              <Row justify="space-between" align="middle">
                <Col>
                  <Text strong>Opening Balance</Text>
                  <br />
                  <Text type="secondary">
                    as of {dayjs(ledger.fromDate).format('MMMM DD, YYYY')}
                  </Text>
                </Col>
                <Col>
                  <Text
                    strong
                    style={{
                      fontSize: '18px',
                      color: ledger.openingBalance >= 0 ? '#52c41a' : '#ff4d4f'
                    }}
                  >
                    ${Math.abs(ledger.openingBalance).toLocaleString('en-US', {
                      minimumFractionDigits: 2
                    })}
                  </Text>
                </Col>
              </Row>
            </div>

            {/* Transactions Table */}
            <Table
              columns={columns}
              dataSource={ledger.transactions}
              rowKey={(record) => record.entryNumber + record.date}
              pagination={false}
              size="middle"
              locale={{
                emptyText: 'No transactions in this period'
              }}
            />

            {/* Closing Balance Row */}
            <div
              style={{
                padding: '12px',
                background: '#e6f7ff',
                border: '1px solid #91d5ff',
                borderRadius: '4px',
                marginTop: '16px'
              }}
            >
              <Row justify="space-between" align="middle">
                <Col>
                  <Text strong style={{ fontSize: '16px' }}>
                    Closing Balance
                  </Text>
                  <br />
                  <Text type="secondary">
                    as of {dayjs(ledger.toDate).format('MMMM DD, YYYY')}
                  </Text>
                </Col>
                <Col>
                  <Space direction="vertical" align="end" size={0}>
                    <Text
                      strong
                      style={{
                        fontSize: '20px',
                        color: ledger.closingBalance >= 0 ? '#52c41a' : '#ff4d4f'
                      }}
                    >
                      ${Math.abs(ledger.closingBalance).toLocaleString('en-US', {
                        minimumFractionDigits: 2
                      })}
                    </Text>
                    <Text type="secondary">
                      Net Change: $
                      {Math.abs(netChange).toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
                      {netChange >= 0 ? '↑' : '↓'}
                    </Text>
                  </Space>
                </Col>
              </Row>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '50px 0' }}>
            <Text type="secondary">Select an account to view its general ledger</Text>
          </div>
        )}
      </Card>

      <style>{`
        @media print {
          .ant-card-extra,
          .ant-btn,
          .ant-select {
            display: none !important;
          }
          
          .ant-card {
            box-shadow: none !important;
            border: 1px solid #000 !important;
          }
        }
      `}</style>
    </div>
  );
};

export default GeneralLedger;