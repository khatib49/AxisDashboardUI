// src/components/Accounting/ChartOfAccounts.tsx

import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Input,
  Select,
  Tag,
  Space,
  Card,
  Row,
  Col,
  Statistic,
  Tabs,
  Tree,
  message,
  Modal,
  Spin
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  DollarOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { DataNode } from 'antd/es/tree';

import {
  getAllAccounts,        // Function
  getAccountTypes,       // Function
  getAccountHierarchy,   // Function
  getAccountSummary,     // Function
  deactivateAccount,     // Type
} from '../../services/accountsApi';

import type { Account, AccountType, AccountHierarchy, AccountSummary } from '../../services/accounting';
import AccountForm from './AccountForm';

const { Search } = Input;
const { Option } = Select;
const { TabPane } = Tabs;

const ChartOfAccounts: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountTypes, setAccountTypes] = useState<AccountType[]>([]);
  const [hierarchy, setHierarchy] = useState<AccountHierarchy[]>([]);
  const [summary, setSummary] = useState<AccountSummary[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTypeId, setFilterTypeId] = useState<number | undefined>();
  const [showInactive, setShowInactive] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [activeTab, setActiveTab] = useState('1');

  useEffect(() => {
    loadData();
  }, [filterTypeId, showInactive]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [accountsData, typesData, hierarchyData, summaryData] = await Promise.all([
        getAllAccounts(filterTypeId, !showInactive ? true : undefined),
        getAccountTypes(),
        getAccountHierarchy(filterTypeId),
        getAccountSummary()
      ]);
      setAccounts(accountsData);
      setAccountTypes(typesData);
      setHierarchy(hierarchyData);
      setSummary(summaryData);
    } catch (error) {
      message.error('Failed to load accounts');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    Modal.confirm({
      title: 'Deactivate Account',
      content: 'Are you sure you want to deactivate this account?',
      onOk: async () => {
        try {
          await deactivateAccount(id);
          message.success('Account deactivated successfully');
          loadData();
        } catch (error: any) {
          message.error(error.response?.data?.message || 'Failed to deactivate account');
        }
      }
    });
  };

  const handleFormSuccess = () => {
    setModalVisible(false);
    setEditingAccount(null);
    loadData();
  };

  const filteredAccounts = accounts.filter(acc =>
    acc.accountNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    acc.accountName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns: ColumnsType<Account> = [
    {
      title: 'Number',
      dataIndex: 'accountNumber',
      key: 'accountNumber',
      width: 120,
      sorter: (a, b) => a.accountNumber.localeCompare(b.accountNumber)
    },
    {
      title: 'Account Name',
      dataIndex: 'accountName',
      key: 'accountName',
      render: (text, record) => (
        <Space>
          {text}
          {record.isSystemAccount && <Tag color="blue">System</Tag>}
          {!record.isActive && <Tag color="red">Inactive</Tag>}
        </Space>
      )
    },
    {
      title: 'Type',
      dataIndex: 'accountTypeName',
      key: 'accountTypeName',
      filters: accountTypes.map(t => ({ text: t.typeName, value: t.id })),
      onFilter: (value, record) => record.accountTypeId === value
    },
    {
      title: 'Parent',
      dataIndex: 'parentAccountName',
      key: 'parentAccountName',
      render: (text) => text || '-'
    },
    {
      title: 'Balance',
      dataIndex: 'currentBalance',
      key: 'currentBalance',
      align: 'right',
      render: (balance) => `$${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => {
              setEditingAccount(record);
              setModalVisible(true);
            }}
          />
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingAccount(record);
              setModalVisible(true);
            }}
          />
          {!record.isSystemAccount && (
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record.id)}
            />
          )}
        </Space>
      )
    }
  ];

  const convertToTreeData = (items: AccountHierarchy[]): DataNode[] => {
    return items.map(item => ({
      title: (
        <span>
          <strong>{item.accountNumber}</strong> - {item.accountName}
          <span style={{ marginLeft: 8, color: '#999' }}>
            ${item.currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
        </span>
      ),
      key: item.id.toString(),
      children: item.children.length > 0 ? convertToTreeData(item.children) : undefined
    }));
  };

  return (
    <div>
      {/* Summary Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Accounts"
              value={accounts.length}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Active Accounts"
              value={accounts.filter(a => a.isActive).length}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Assets"
              value={summary.find(s => s.accountTypeName === 'Asset')?.totalBalance || 0}
              prefix={<DollarOutlined />}
              precision={2}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Revenue"
              value={summary.find(s => s.accountTypeName === 'Revenue')?.totalBalance || 0}
              prefix={<DollarOutlined />}
              precision={2}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Main Content */}
      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* Toolbar */}
          <Row gutter={16} align="middle">
            <Col flex="auto">
              <Search
                placeholder="Search by account number or name"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                prefix={<SearchOutlined />}
                allowClear
              />
            </Col>
            <Col>
              <Select
                placeholder="Filter by type"
                style={{ width: 180 }}
                value={filterTypeId}
                onChange={setFilterTypeId}
                allowClear
              >
                {accountTypes.map(type => (
                  <Option key={type.id} value={type.id}>
                    {type.typeName}
                  </Option>
                ))}
              </Select>
            </Col>
            <Col>
              <Button
                type={showInactive ? 'primary' : 'default'}
                onClick={() => setShowInactive(!showInactive)}
              >
                {showInactive ? 'Show Active Only' : 'Show Inactive'}
              </Button>
            </Col>
            <Col>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setEditingAccount(null);
                  setModalVisible(true);
                }}
              >
                New Account
              </Button>
            </Col>
          </Row>

          {/* Tabs */}
          <Tabs activeKey={activeTab} onChange={setActiveTab}>
            <TabPane tab="List View" key="1">
              <Spin spinning={loading}>
                <Table
                  columns={columns}
                  dataSource={filteredAccounts}
                  rowKey="id"
                  pagination={{
                    pageSize: 20,
                    showSizeChanger: true,
                    showTotal: (total) => `Total ${total} accounts`
                  }}
                />
              </Spin>
            </TabPane>

            <TabPane tab="Hierarchy View" key="2">
              <Spin spinning={loading}>
                <Tree
                  showLine
                  defaultExpandAll
                  treeData={convertToTreeData(hierarchy)}
                />
              </Spin>
            </TabPane>

            <TabPane tab="Summary by Type" key="3">
              <Spin spinning={loading}>
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                  {summary.map(item => (
                    <Card
                      key={item.accountTypeName}
                      title={item.accountTypeName}
                      extra={
                        <Tag color="blue">
                          ${item.totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </Tag>
                      }
                    >
                      <Table
                        columns={columns.filter(c => c.key !== 'accountTypeName')}
                        dataSource={item.accounts}
                        rowKey="id"
                        pagination={false}
                        size="small"
                      />
                    </Card>
                  ))}
                </Space>
              </Spin>
            </TabPane>
          </Tabs>
        </Space>
      </Card>

      {/* Account Form Modal */}
      <Modal
        title={editingAccount ? 'Edit Account' : 'Create Account'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingAccount(null);
        }}
        footer={null}
        width={700}
      >
        <AccountForm
          account={editingAccount}
          accountTypes={accountTypes}
          accounts={accounts}
          onSuccess={handleFormSuccess}
          onCancel={() => {
            setModalVisible(false);
            setEditingAccount(null);
          }}
        />
      </Modal>
    </div>
  );
};

export default ChartOfAccounts;