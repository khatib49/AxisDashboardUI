import { useState } from 'react';
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
    <div className="p-6">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
        <p className="text-sm text-gray-500 mt-1">{active.subtitle}</p>
      </div>

      {/* Tab strip */}
      <div className="border-b border-gray-200 mb-4">
        <nav className="-mb-px flex gap-6" aria-label="Tabs">
          {TABS.map(t => {
            const isActive = t.key === tab;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={
                  'whitespace-nowrap py-3 px-1 border-b-2 text-sm font-medium transition-colors ' +
                  (isActive
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300')
                }
              >
                {t.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Body — the existing TransactionAuditLogsPage already owns its own
          padding and h1/intro. We render it as-is for the Transactions tab
          to avoid duplicating its filter/table/pagination logic. The new
          AdminAuditTab is layout-only (no outer padding/title) since we own
          the page chrome here. */}
      {tab === 'transactions' ? (
        <div className="-mx-6 -mt-2">
          <TransactionAuditLogsPage />
        </div>
      ) : (
        <AdminAuditTab />
      )}
    </div>
  );
};

export default AuditLogsPage;
