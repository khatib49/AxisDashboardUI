import { useState } from 'react';
import { Segmented } from 'antd';
import { HistoryOutlined } from '@ant-design/icons';
import { PageHeader } from '../../components/ui/PageKit';
import { TransactionAuditLogsPage } from './TransactionAuditLogsPage';
import { AdminAuditTab } from './AdminAuditTab';

type TabKey = 'transactions' | 'admin';

const TABS: { key: TabKey; label: string; subtitle: string }[] = [
  { key: 'transactions', label: 'Transactions',    subtitle: 'Every change to any transaction is recorded here.' },
  { key: 'admin',        label: 'Admin Activity',  subtitle: 'Create, update and delete actions across Items, Categories, Channels, Suppliers, Purchases, Expenses, Accounts, Discounts, Settings and more.' },
];

export const AuditLogsPage = () => {
  const [tab, setTab] = useState<TabKey>('transactions');
  const active = TABS.find(t => t.key === tab)!;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6">
      <PageHeader
        tone="blue"
        icon={<HistoryOutlined />}
        title="Audit Logs"
        badge="Read-only"
        description={active.subtitle}
      >
        {/* Tab strip */}
        <div className="max-w-full overflow-x-auto">
          <Segmented
            value={tab}
            onChange={(v) => setTab(v as TabKey)}
            options={TABS.map(t => ({ value: t.key, label: t.label }))}
          />
        </div>
      </PageHeader>

      {/* Body — each tab owns its own filters, table and pagination; this
          page only owns the chrome (header + tab strip). */}
      {tab === 'transactions' ? <TransactionAuditLogsPage /> : <AdminAuditTab />}
    </div>
  );
};

export default AuditLogsPage;
