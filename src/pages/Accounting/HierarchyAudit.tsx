// Hierarchy Health Audit
// ======================
// Scans the chart of accounts for structural issues that cause confusing
// dashboards or wrong balances:
//   1. Children whose AccountType doesn't match the parent's (e.g. an Asset
//      account parented under an Expense header).
//   2. Header accounts (those with children) that still have
//      AllowManualEntry=true — the bug pattern behind the old 5200 Utilities
//      Expense $4,480 issue.
//   3. Header accounts with non-zero direct balance (postings sitting on the
//      header instead of on a leaf).
//   4. Inactive parents that still have active children.
//
// Each finding links straight to the Chart of Accounts row so the admin can
// edit / re-parent / lock manual entry / repoint lines in one place.

import { useEffect, useState, type ReactNode } from "react";
import { Button, Table, Skeleton, message, Tooltip } from "antd";
import {
  ApartmentOutlined,
  ReloadOutlined,
  CheckCircleFilled,
  InfoCircleOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { useNavigate } from "react-router";
import {
  getHierarchyAudit,
  AccountHierarchyAudit,
  HierarchyTypeMismatch,
  HierarchyHeaderIssue,
  HierarchyAccountRef,
} from "../../services/accountsApi";
import { PageHeader, Panel, Pill, StatTile } from "../../components/ui/PageKit";
import { AccountCode, AccountTypePill } from "../../components/Accounting/reports/AccountTypePill";
import { money } from "../../components/Accounting/reports/money";

/** Account number chip + name + type pill. */
function AccountCell({ account }: { account: HierarchyAccountRef }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <AccountCode>{account.accountNumber}</AccountCode>
      <span className="text-gray-900 dark:text-gray-100">{account.accountName}</span>
      <AccountTypePill type={account.accountTypeName} />
    </span>
  );
}

/** One audit section: title with count pill + info tooltip, a short "why it matters", and the table (or a compact all-clear). */
function IssueSection({ title, count, tone, why, tooltip, children }: {
  title: string;
  count: number;
  tone: "red" | "amber";
  why: string;
  tooltip: string;
  children: ReactNode;
}) {
  return (
    <Panel
      title={
        <span className="flex flex-wrap items-center gap-2">
          <span>{title}</span>
          {count > 0 ? (
            <Pill tone={tone} dot>{count} {count === 1 ? "issue" : "issues"}</Pill>
          ) : (
            <Pill tone="emerald" dot>0 issues</Pill>
          )}
          <Tooltip title={tooltip}>
            <button
              type="button"
              aria-label={`About ${title}`}
              className="inline-flex items-center text-gray-400 transition hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            >
              <InfoCircleOutlined />
            </button>
          </Tooltip>
        </span>
      }
      subtitle={why}
      bodyClassName="p-0"
    >
      {count > 0 ? (
        children
      ) : (
        <div className="flex items-center gap-2 px-5 py-4 text-sm text-emerald-700 dark:text-emerald-300">
          <CheckCircleFilled aria-hidden /> No issues
        </div>
      )}
    </Panel>
  );
}

export default function HierarchyAudit() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AccountHierarchyAudit | null>(null);

  async function run() {
    setLoading(true);
    try {
      const result = await getHierarchyAudit();
      setData(result);
    } catch {
      message.error("Failed to load hierarchy audit");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    run();
  }, []);

  const totalIssues =
    (data?.typeMismatches.length ?? 0) +
    (data?.headersAllowingManualEntry.length ?? 0) +
    (data?.headersWithDirectPostings.length ?? 0) +
    (data?.inactiveParentsWithActiveChildren.length ?? 0);

  const allClean = data != null && totalIssues === 0;

  // ─── Column defs ──────────────────────────────────────────────────────────
  const mismatchCols: ColumnsType<HierarchyTypeMismatch> = [
    {
      title: "Child Account",
      key: "child",
      render: (_, r) => <AccountCell account={r.child} />,
    },
    {
      title: "Parent Account",
      key: "parent",
      render: (_, r) => <AccountCell account={r.parent} />,
    },
    {
      title: "Fix",
      key: "fix",
      width: 200,
      align: "right",
      render: (_, r) => (
        <Button size="small" onClick={() => navigate(`/accounting/accounts`)}>
          Edit child {r.child.accountNumber}
        </Button>
      ),
    },
  ];

  const headerCols: ColumnsType<HierarchyHeaderIssue> = [
    {
      title: "Header Account",
      key: "account",
      render: (_, r) => <AccountCell account={r.account} />,
    },
    {
      title: "Children",
      dataIndex: "childCount",
      key: "childCount",
      width: 100,
      align: "right",
      render: (n: number) => <span className="tabular-nums">{n}</span>,
    },
    {
      title: "Direct Balance",
      dataIndex: "directBalance",
      key: "directBalance",
      width: 160,
      align: "right",
      render: (n: number) => (
        <span
          className={`whitespace-nowrap font-semibold tabular-nums ${
            Math.abs(n) > 0.005 ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-gray-100"
          }`}
        >
          {money(n)}
        </span>
      ),
    },
    {
      title: "Manual Entry",
      dataIndex: "allowsManualEntry",
      key: "allowsManualEntry",
      width: 130,
      render: (b: boolean) =>
        b ? <Pill tone="red" dot>Allowed</Pill> : <Pill tone="emerald" dot>Locked</Pill>,
    },
    {
      title: "Fix",
      key: "fix",
      width: 200,
      align: "right",
      render: (_, r) => (
        <Button size="small" onClick={() => navigate(`/accounting/accounts`)}>
          Open {r.account.accountNumber}
        </Button>
      ),
    },
  ];

  const inactiveCols: ColumnsType<HierarchyAccountRef> = [
    {
      title: "Inactive Parent",
      key: "account",
      render: (_, r) => <AccountCell account={r} />,
    },
    {
      title: "Fix",
      key: "fix",
      width: 220,
      align: "right",
      render: () => (
        <Button size="small" onClick={() => navigate(`/accounting/accounts`)}>
          Reactivate or re-parent
        </Button>
      ),
    },
  ];

  const pagination = { pageSize: 10, className: "!px-4" };
  const firstLoad = loading && !data;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6">
      {/* Header */}
      <PageHeader
        tone="blue"
        icon={<ApartmentOutlined />}
        title="Hierarchy Health Audit"
        description="Finds structural issues in the chart of accounts: type mismatches between children and parents, header accounts that still accept manual entry, postings sitting on headers, and inactive parents with active children."
        actions={
          <Button type="primary" icon={<ReloadOutlined />} loading={loading} onClick={run}>
            Re-run Audit
          </Button>
        }
      />

      {/* Summary */}
      {(data || firstLoad) && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Total Accounts" loading={firstLoad} value={<span className="tabular-nums">{data?.totalAccounts}</span>} />
          <StatTile label="Active" loading={firstLoad} value={<span className="tabular-nums">{data?.totalActive}</span>} />
          <StatTile
            label="Issues Found"
            loading={firstLoad}
            value={
              <span className={`tabular-nums ${totalIssues > 0 ? "text-red-600 dark:text-red-400" : ""}`}>{totalIssues}</span>
            }
            sub={totalIssues > 0 ? "Across the four checks below" : "All four checks passed"}
          />
          <StatTile
            label="Status"
            loading={firstLoad}
            value={
              // Pill scaled up to tile size; dot + words, never colour alone.
              <span className="inline-flex [&>span]:px-3 [&>span]:py-1 [&>span]:text-base">
                {allClean ? <Pill tone="emerald" dot>Healthy</Pill> : <Pill tone="red" dot>Needs review</Pill>}
              </span>
            }
            sub={allClean ? "No structural issues" : "Fix the findings below"}
          />
        </div>
      )}

      {firstLoad && (
        <Panel>
          <Skeleton active paragraph={{ rows: 6 }} />
        </Panel>
      )}

      {allClean && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 dark:border-emerald-500/20 dark:bg-emerald-500/10">
          <CheckCircleFilled className="mt-0.5 text-2xl text-emerald-500" aria-hidden />
          <div>
            <div className="font-semibold text-emerald-800 dark:text-emerald-300">No structural issues found</div>
            <div className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
              Every parent-child relationship has matching account types, no header
              accepts manual entry, no header is carrying direct postings, and no
              inactive parent has active children.
            </div>
          </div>
        </div>
      )}

      {data && (
        <>
          <IssueSection
            title="Type Mismatches"
            count={data.typeMismatches.length}
            tone="red"
            why="A child rolls up into a parent of another type, so its balance lands in the wrong section of the reports."
            tooltip="A child has a different AccountType than its parent. Either re-parent the child to a same-type parent, or change one of their types to match."
          >
            <Table
              size="small"
              rowKey={(r) => `${r.child.id}-${r.parent.id}`}
              columns={mismatchCols}
              dataSource={data.typeMismatches}
              pagination={pagination}
              scroll={{ x: 760 }}
            />
          </IssueSection>

          <IssueSection
            title="Headers Allowing Manual Entry"
            count={data.headersAllowingManualEntry.length}
            tone="amber"
            why="New entries can still be posted to a grouping account instead of one of its leaf accounts."
            tooltip="These accounts have children (so they're headers) but still accept direct postings. Turn off AllowManualEntry on each so future entries must go to a leaf account."
          >
            <Table
              size="small"
              rowKey={(r) => r.account.id}
              columns={headerCols}
              dataSource={data.headersAllowingManualEntry}
              pagination={pagination}
              scroll={{ x: 860 }}
            />
          </IssueSection>

          <IssueSection
            title="Headers With Direct Postings"
            count={data.headersWithDirectPostings.length}
            tone="red"
            why="Postings sit on a grouping account rather than a leaf, so the leaf-level detail doesn't add up to the header."
            tooltip="These header accounts carry a non-zero direct balance — someone posted to a grouping account instead of a leaf. Open the Transactions Report on each and move the lines onto a proper leaf account."
          >
            <Table
              size="small"
              rowKey={(r) => r.account.id}
              columns={headerCols}
              dataSource={data.headersWithDirectPostings}
              pagination={pagination}
              scroll={{ x: 860 }}
            />
          </IssueSection>

          <IssueSection
            title="Inactive Parents With Active Children"
            count={data.inactiveParentsWithActiveChildren.length}
            tone="amber"
            why="Active children under a deactivated parent leave the hierarchy inconsistent."
            tooltip="A parent was deactivated but its children are still active. Either reactivate the parent, or re-parent the children to a different account."
          >
            <Table
              size="small"
              rowKey={(r) => r.id}
              columns={inactiveCols}
              dataSource={data.inactiveParentsWithActiveChildren}
              pagination={pagination}
              scroll={{ x: 560 }}
            />
          </IssueSection>
        </>
      )}
    </div>
  );
}
