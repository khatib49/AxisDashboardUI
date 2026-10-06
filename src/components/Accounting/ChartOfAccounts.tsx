// src/components/Accounting/ChartOfAccounts.tsx

import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Input,
  Select,
  Tabs,
  Tree,
  message,
  Modal,
  Spin,
  Tooltip,
  Dropdown,
  Empty,
  Skeleton
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  FileSearchOutlined,
  MoreOutlined,
  ReloadOutlined,
  BookOutlined,
  ExclamationCircleFilled,
  UnorderedListOutlined,
  ApartmentOutlined,
  PieChartOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { DataNode } from 'antd/es/tree';

import {
  getAllAccounts,        // Function
  getAccountTypes,       // Function
  getAccountHierarchy,   // Function
  getAccountSummary,     // Function
  getAllAccountBalances, // Function — needed for rollup balances
  deactivateAccount,     // Function
} from '../../services/accountsApi';
import type { AccountBalance } from '../../services/accountsApi';

import type { Account, AccountType, AccountHierarchy, AccountSummary } from '../../services/accounting';
import AccountForm from './AccountForm';
import TransactionsReportModal from './TransactionsReportModal';
import { PageHeader, Panel, Pill, StatTile } from '../ui/PageKit';
import { AccountCode, AccountTypePill } from './reports/AccountTypePill';
import { Amount } from './reports/Amount';
import { isNegative, money } from './reports/money';
import { AccountFlags } from './coa/AccountFlags';

const { Option } = Select;

const ChartOfAccounts: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountTypes, setAccountTypes] = useState<AccountType[]>([]);
  const [hierarchy, setHierarchy] = useState<AccountHierarchy[]>([]);
  const [summary, setSummary] = useState<AccountSummary[]>([]);
  // Rollup balances keyed by accountId. Populated from /Accounts/balances.
  // Used to render the "Rollup" column next to "Balance".
  const [rollupByAccountId, setRollupByAccountId] = useState<Record<number, number>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTypeId, setFilterTypeId] = useState<number | undefined>();
  const [showInactive, setShowInactive] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [activeTab, setActiveTab] = useState('1');
  // Transactions Report modal state — opens from the row-level Report button.
  const [reportAccount, setReportAccount] = useState<Account | null>(null);
  // Presentation only: skeletons until the first successful load, and an
  // error state instead of zero figures when loading failed.
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    loadData();
    // Reload whenever the server-side filters change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterTypeId, showInactive]);

  const loadData = async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const [accountsData, typesData, hierarchyData, summaryData, balancesData] = await Promise.all([
        getAllAccounts(filterTypeId, !showInactive ? true : undefined),
        getAccountTypes(),
        getAccountHierarchy(filterTypeId),
        getAccountSummary(),
        getAllAccountBalances(),
      ]);
      setAccounts(accountsData);
      setAccountTypes(typesData);
      setHierarchy(hierarchyData);
      setSummary(summaryData);
      // Build the rollup lookup once per refresh.
      const map: Record<number, number> = {};
      (balancesData as AccountBalance[]).forEach((b) => {
        map[b.accountId] = b.rollupBalance ?? b.balance;
      });
      setRollupByAccountId(map);
      setLoaded(true);
    } catch (error) {
      setLoadFailed(true);
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
        } catch (error: unknown) {
          const apiMessage = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
          message.error(apiMessage || 'Failed to deactivate account');
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

  // Header accounts = accounts that have children in the loaded hierarchy.
  // Display only (Header / manual-entry pills).
  const headerIds = new Set<number>();
  const collectHeaders = (items: AccountHierarchy[]) => {
    items.forEach(item => {
      if (item.children.length > 0) {
        headerIds.add(item.id);
        collectHeaders(item.children);
      }
    });
  };
  collectHeaders(hierarchy);

  const columns: ColumnsType<Account> = [
    {
      title: 'Number',
      dataIndex: 'accountNumber',
      key: 'accountNumber',
      width: 120,
      sorter: (a, b) => a.accountNumber.localeCompare(b.accountNumber),
      render: (accountNumber: string) => <AccountCode>{accountNumber}</AccountCode>
    },
    {
      title: 'Account Name',
      dataIndex: 'accountName',
      key: 'accountName',
      render: (text, record) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <span className={`font-medium ${record.isActive ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}>
            {text}
          </span>
          <AccountFlags
            isSystem={record.isSystemAccount}
            isActive={record.isActive}
            isHeader={headerIds.has(record.id)}
            allowManualEntry={record.allowManualEntry}
          />
        </span>
      )
    },
    {
      title: 'Type',
      dataIndex: 'accountTypeName',
      key: 'accountTypeName',
      width: 130,
      render: (type: string) => <AccountTypePill type={type} />,
      filters: accountTypes.map(t => ({ text: t.typeName, value: t.id })),
      onFilter: (value, record) => record.accountTypeId === value
    },
    {
      title: 'Parent',
      dataIndex: 'parentAccountName',
      key: 'parentAccountName',
      render: (text) =>
        text ? (
          <span className="text-gray-600 dark:text-gray-400">{text}</span>
        ) : (
          <span className="text-gray-300 dark:text-gray-600" aria-label="none">—</span>
        )
    },
    {
      title: 'Direct',
      dataIndex: 'currentBalance',
      key: 'currentBalance',
      align: 'right',
      width: 140,
      render: (balance: number) => <Amount value={balance} />
    },
    {
      // Rollup = this account's balance + every descendant's balance. For
      // header rows (5200 Utilities Expense etc.) this is the "real" total
      // people want. For leaves it equals Direct.
      title: 'Rollup',
      key: 'rollupBalance',
      align: 'right',
      width: 150,
      render: (_, record) => {
        const rollup = rollupByAccountId[record.id];
        const direct = record.currentBalance;
        const value = rollup ?? direct;
        const differs = rollup !== undefined && Math.abs(rollup - direct) > 0.005;
        return (
          <Tooltip title={differs ? `Direct ${money(direct)} + descendants` : 'Same as Direct (no children)'}>
            <span className="inline-flex items-center justify-end gap-1.5">
              {differs && (
                <span className="text-[10px] font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-300">Σ</span>
              )}
              <Amount value={value} strong={differs} />
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 96,
      align: 'right',
      fixed: 'right',
      render: (_, record) => (
        <span className="inline-flex items-center gap-1">
          <Tooltip title="View transactions report and move lines">
            <Button
              type="text"
              size="small"
              icon={<FileSearchOutlined />}
              aria-label={`Transactions report for ${record.accountNumber}`}
              onClick={() => setReportAccount(record)}
            />
          </Tooltip>
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                {
                  key: 'view',
                  icon: <EyeOutlined />,
                  label: 'View',
                  onClick: () => {
                    setEditingAccount(record);
                    setModalVisible(true);
                  }
                },
                {
                  key: 'edit',
                  icon: <EditOutlined />,
                  label: 'Edit',
                  onClick: () => {
                    setEditingAccount(record);
                    setModalVisible(true);
                  }
                },
                ...(!record.isSystemAccount
                  ? [
                      { type: 'divider' as const },
                      {
                        key: 'deactivate',
                        icon: <DeleteOutlined />,
                        label: 'Deactivate',
                        danger: true,
                        onClick: () => handleDelete(record.id)
                      }
                    ]
                  : [])
              ]
            }}
          >
            <Button type="text" size="small" icon={<MoreOutlined />} aria-label={`More actions for ${record.accountNumber}`} />
          </Dropdown>
        </span>
      )
    }
  ];

  const convertToTreeData = (items: AccountHierarchy[], depth = 0): DataNode[] => {
    return items.map(item => {
      const rollup = rollupByAccountId[item.id];
      const direct = item.currentBalance;
      const hasChildren = item.children.length > 0;
      const showRollup = hasChildren && rollup !== undefined && Math.abs(rollup - direct) > 0.005;
      return {
        title: (
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 py-0.5">
            <AccountCode>{item.accountNumber}</AccountCode>
            <span className={`${hasChildren ? 'font-semibold' : ''} ${item.isActive ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}>
              {item.accountName}
            </span>
            {depth === 0 && <AccountTypePill type={item.accountTypeName} />}
            {!item.isActive && <Pill tone="red" dot>Inactive</Pill>}
            <span className={`whitespace-nowrap text-xs tabular-nums ${isNegative(direct) ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
              {money(direct)}
            </span>
            {showRollup && (
              <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-1.5 py-0.5 text-xs text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">
                rollup <Amount value={rollup!} strong />
              </span>
            )}
          </span>
        ),
        key: item.id.toString(),
        children: hasChildren ? convertToTreeData(item.children, depth + 1) : undefined,
      };
    });
  };

  // Tile figures are only shown once a load has succeeded — never fake zeros.
  const tileLoading = !loaded && (loading || !loadFailed);
  const notLoaded = !loaded && loadFailed;
  const firstLoad = !loaded && !loadFailed;
  const totalAssets = summary.find(s => s.accountTypeName === 'Asset')?.totalBalance || 0;
  const totalRevenue = summary.find(s => s.accountTypeName === 'Revenue')?.totalBalance || 0;
  const activeCount = accounts.filter(a => a.isActive).length;

  const notLoadedEmpty = (
    <div className="py-12">
      <Empty description="Accounts not loaded" />
    </div>
  );

  const tabLabel = (icon: React.ReactNode, text: string) => (
    <span className="inline-flex items-center gap-2">{icon}{text}</span>
  );

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6">
      <PageHeader
        tone="violet"
        icon={<BookOutlined />}
        title="Chart of Accounts"
        description="Every account in the books with its direct balance and its rollup (the account plus all of its descendants)."
        actions={
          <>
            <Tooltip title="Refresh">
              <Button icon={<ReloadOutlined />} onClick={() => loadData()} loading={loading} aria-label="Refresh" />
            </Tooltip>
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
          </>
        }
      >
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <Input
            placeholder="Search by account number or name"
            aria-label="Search accounts"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            prefix={<SearchOutlined className="text-gray-400" />}
            allowClear
            className="w-full sm:w-auto sm:min-w-[280px] sm:flex-1"
          />
          <Select
            placeholder="Filter by type"
            aria-label="Filter by type"
            className="w-full sm:w-[180px]"
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
          <Button
            type={showInactive ? 'primary' : 'default'}
            aria-pressed={showInactive}
            onClick={() => setShowInactive(!showInactive)}
          >
            {showInactive ? 'Show Active Only' : 'Show Inactive'}
          </Button>
        </div>
      </PageHeader>

      {/* Summary tiles */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Total Accounts"
          loading={tileLoading}
          value={<span className="tabular-nums">{loaded ? accounts.length : '—'}</span>}
          sub={notLoaded ? 'Not loaded' : `${showInactive ? 'Including inactive' : 'Active only'}${filterTypeId !== undefined ? ' · type filter on' : ''}`}
        />
        <StatTile
          label="Active Accounts"
          loading={tileLoading}
          value={
            <span className="tabular-nums text-emerald-600 dark:text-emerald-400">{loaded ? activeCount : '—'}</span>
          }
          sub={notLoaded ? 'Not loaded' : loaded && showInactive ? `${accounts.length - activeCount} inactive` : undefined}
        />
        <StatTile
          label="Total Assets"
          loading={tileLoading}
          accent={<AccountTypePill type="Asset" />}
          value={loaded ? <Amount value={totalAssets} /> : '—'}
          sub={notLoaded ? 'Not loaded' : undefined}
        />
        <StatTile
          label="Total Revenue"
          loading={tileLoading}
          accent={<AccountTypePill type="Revenue" />}
          value={
            loaded ? <Amount value={totalRevenue} className={totalRevenue >= 0 ? '!text-emerald-600 dark:!text-emerald-400' : ''} /> : '—'
          }
          sub={notLoaded ? 'Not loaded' : undefined}
        />
      </div>

      {/* Load error */}
      {loadFailed && !loading && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-500/20 dark:bg-red-500/10">
          <div className="flex items-start gap-3">
            <ExclamationCircleFilled className="mt-0.5 text-lg text-red-500" aria-hidden />
            <div>
              <div className="font-semibold text-red-800 dark:text-red-300">Failed to load accounts</div>
              <div className="text-sm text-red-700/80 dark:text-red-300/80">
                {loaded ? 'Showing the last loaded figures. Try again.' : 'No figures are shown until the accounts load. Try again.'}
              </div>
            </div>
          </div>
          <Button onClick={() => loadData()}>Retry</Button>
        </div>
      )}

      {/* Views */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: '1',
            label: tabLabel(<UnorderedListOutlined />, 'List View'),
            children: (
              <Panel
                title="All accounts"
                subtitle={
                  loaded
                    ? `${filteredAccounts.length} of ${accounts.length} account${accounts.length === 1 ? '' : 's'}${searchTerm ? ` matching “${searchTerm}”` : ''}`
                    : undefined
                }
                bodyClassName="p-0"
              >
                {notLoaded ? (
                  notLoadedEmpty
                ) : firstLoad ? (
                  <div className="p-5">
                    <Skeleton active paragraph={{ rows: 8 }} />
                  </div>
                ) : (
                  <Table
                    columns={columns}
                    dataSource={filteredAccounts}
                    rowKey="id"
                    loading={loading}
                    size="middle"
                    scroll={{ x: 1000 }}
                    locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No accounts" /> }}
                    pagination={{
                      pageSize: 20,
                      showSizeChanger: true,
                      showTotal: (total) => `Total ${total} accounts`,
                      className: '!px-4'
                    }}
                  />
                )}
              </Panel>
            )
          },
          {
            key: '2',
            label: tabLabel(<ApartmentOutlined />, 'Hierarchy View'),
            children: (
              <Panel
                title="Account hierarchy"
                subtitle="Direct balance on every account; headers whose descendants carry balances also show their rollup."
                extra={
                  <span className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-1.5 py-0.5 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">
                      rollup
                    </span>
                    = account + descendants
                  </span>
                }
              >
                {notLoaded ? (
                  notLoadedEmpty
                ) : firstLoad ? (
                  <Skeleton active paragraph={{ rows: 8 }} />
                ) : (
                  <Spin spinning={loading}>
                    {hierarchy.length === 0 ? (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No accounts" />
                    ) : (
                      <div className="relative overflow-x-auto">
                        <Tree
                          showLine
                          defaultExpandAll
                          treeData={convertToTreeData(hierarchy)}
                          className="bg-transparent"
                        />
                      </div>
                    )}
                  </Spin>
                )}
              </Panel>
            )
          },
          {
            key: '3',
            label: tabLabel(<PieChartOutlined />, 'Summary by Type'),
            children: notLoaded ? (
              <Panel>{notLoadedEmpty}</Panel>
            ) : firstLoad ? (
              <Panel>
                <Skeleton active paragraph={{ rows: 8 }} />
              </Panel>
            ) : (
              <Spin spinning={loading}>
                <div className="space-y-6">
                  {summary.length === 0 && (
                    <Panel>
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No accounts" />
                    </Panel>
                  )}
                  {summary.map(item => (
                    <Panel
                      key={item.accountTypeName}
                      title={
                        <span className="flex flex-wrap items-center gap-2">
                          <AccountTypePill type={item.accountTypeName} />
                          <span>{item.accountTypeName}</span>
                        </span>
                      }
                      subtitle={`${item.accounts.length} account${item.accounts.length === 1 ? '' : 's'}`}
                      extra={
                        <span className="inline-flex items-baseline gap-2 text-sm">
                          <span className="text-xs text-gray-500 dark:text-gray-400">Total</span>
                          <Amount value={item.totalBalance} strong />
                        </span>
                      }
                      bodyClassName="p-0"
                    >
                      <Table
                        columns={columns.filter(c => c.key !== 'accountTypeName')}
                        dataSource={item.accounts}
                        rowKey="id"
                        pagination={false}
                        size="small"
                        scroll={{ x: 880 }}
                        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No accounts" /> }}
                      />
                    </Panel>
                  ))}
                </div>
              </Spin>
            )
          }
        ]}
      />

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

      {/* Transactions Report Modal — opens from the row-level Report button.
          Lets the admin see every journal-entry line on this account, multi-
          select via checkboxes, and bulk-move them to another account.
          After a successful move we reload the whole data set so the Direct/
          Rollup balances reflect the new state immediately. */}
      <TransactionsReportModal
        open={!!reportAccount}
        account={reportAccount}
        onClose={() => setReportAccount(null)}
        onRepointed={loadData}
      />
    </div>
  );
};

export default ChartOfAccounts;
