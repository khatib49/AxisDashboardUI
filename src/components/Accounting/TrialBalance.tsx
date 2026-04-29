// src/components/Accounting/TrialBalance.tsx

import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Card,
  DatePicker,
  Space,
  Tag,
  Alert,
  Row,
  Col,
  Statistic,
  message,
  Select
} from 'antd';
import {
  DownloadOutlined,
  PrinterOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

import {
  getTrialBalance,
getAccountTypes
} from '../../services/accountsApi';

import type { TrialBalance , TrialBalanceLine, AccountType } from '../../services/accounting';



const TrialBalance: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [trialBalance, setTrialBalance] = useState<TrialBalance | null>(null);
  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs>(dayjs());
  const [accountTypes, setAccountTypes] = useState<AccountType[]>([]);
  const [filterType, setFilterType] = useState<string | undefined>();

  useEffect(() => {
    loadAccountTypes();
    loadTrialBalance();
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
    try {
      const dateStr = (date || selectedDate).format('YYYY-MM-DD');
      const data = await getTrialBalance(dateStr);
      setTrialBalance(data);
    } catch (error) {
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

  const columns: ColumnsType<TrialBalanceLine> = [
    {
      title: 'Account Number',
      dataIndex: 'accountNumber',
      key: 'accountNumber',
      width: 150,
      sorter: (a, b) => a.accountNumber.localeCompare(b.accountNumber)
    },
    {
      title: 'Account Name',
      dataIndex: 'accountName',
      key: 'accountName'
    },
    {
      title: 'Type',
      dataIndex: 'accountTypeName',
      key: 'accountTypeName',
      width: 120,
      render: (type) => {
        const colorMap: Record<string, string> = {
          Asset: 'blue',
          Liability: 'red',
          Equity: 'purple',
          Revenue: 'green',
          Expense: 'orange'
        };
        const color = colorMap[type as string] || 'default';
        return <Tag color={color}>{type}</Tag>;
      },
      filters: accountTypes.map(t => ({ text: t.typeName, value: t.typeName })),
      onFilter: (value, record) => record.accountTypeName === value
    },
    {
      title: 'Debit',
      dataIndex: 'debitBalance',
      key: 'debitBalance',
      width: 150,
      align: 'right',
      render: (amount) =>
        amount > 0 ? `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '-'
    },
    {
      title: 'Credit',
      dataIndex: 'creditBalance',
      key: 'creditBalance',
      width: 150,
      align: 'right',
      render: (amount) =>
        amount > 0 ? `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '-'
    }
  ];

  return (
    <div>
      {/* Summary Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="Total Debits"
              value={trialBalance?.totalDebits || 0}
              prefix="$"
              precision={2}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Total Credits"
              value={trialBalance?.totalCredits || 0}
              prefix="$"
              precision={2}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Balance Status"
              value={trialBalance?.isBalanced ? 'Balanced' : 'Unbalanced'}
              valueStyle={{ color: trialBalance?.isBalanced ? '#52c41a' : '#ff4d4f' }}
              prefix={trialBalance?.isBalanced ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Balance Alert */}
      {trialBalance && !trialBalance.isBalanced && (
        <Alert
          message="Trial Balance is Not Balanced"
          description={`There is a difference of $${Math.abs(
            trialBalance.totalDebits - trialBalance.totalCredits
          ).toFixed(2)}. Please review your journal entries.`}
          type="error"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      {/* Main Card */}
      <Card
        title={`Trial Balance - As of ${selectedDate.format('MMMM DD, YYYY')}`}
        extra={
          <Space>
            <DatePicker
              value={selectedDate}
              onChange={handleDateChange}
              format="YYYY-MM-DD"
              allowClear={false}
            />
            <Select
              placeholder="Filter by type"
              style={{ width: 150 }}
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
            <Button icon={<ReloadOutlined />} onClick={() => loadTrialBalance()}>
              Refresh
            </Button>
            <Button icon={<DownloadOutlined />} onClick={handleExportToCSV}>
              Export CSV
            </Button>
            <Button icon={<PrinterOutlined />} onClick={handlePrint}>
              Print
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={filteredLines || []}
          rowKey={(record) => record.accountNumber}
          loading={loading}
          pagination={false}
          size="middle"
          summary={(pageData) => {
            if (!trialBalance) return null;

            const displayedDebits = pageData.reduce((sum, record) => sum + record.debitBalance, 0);
            const displayedCredits = pageData.reduce((sum, record) => sum + record.creditBalance, 0);

            return (
              <>
                <Table.Summary.Row style={{ backgroundColor: '#fafafa' }}>
                  <Table.Summary.Cell index={0} colSpan={3}>
                    <strong>Total (Displayed)</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={3} align="right">
                    <strong>
                      ${displayedDebits.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={4} align="right">
                    <strong>
                      ${displayedCredits.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </strong>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
                {filterType && (
                  <Table.Summary.Row style={{ backgroundColor: '#e6f7ff' }}>
                    <Table.Summary.Cell index={0} colSpan={3}>
                      <strong>Grand Total (All Accounts)</strong>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={3} align="right">
                      <strong>
                        ${trialBalance.totalDebits.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </strong>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={4} align="right">
                      <strong>
                        ${trialBalance.totalCredits.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </strong>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                )}
              </>
            );
          }}
        />
      </Card>

      <style>{`
        @media print {
          .ant-card-extra,
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