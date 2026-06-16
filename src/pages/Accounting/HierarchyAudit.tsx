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

import { useEffect, useState } from "react";
import {
  Card,
  Button,
  Table,
  Tag,
  Space,
  Typography,
  Row,
  Col,
  Statistic,
  Empty,
  message,
  Tooltip,
} from "antd";
import {
  ApartmentOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
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

const { Text } = Typography;

const fmt = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function typeColor(name: string) {
  switch (name) {
    case "Asset": return "blue";
    case "Liability": return "magenta";
    case "Equity": return "purple";
    case "Revenue": return "green";
    case "Expense": return "orange";
    default: return "default";
  }
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
      render: (_, r) => (
        <Space>
          <Text code>{r.child.accountNumber}</Text>
          <Text>{r.child.accountName}</Text>
          <Tag color={typeColor(r.child.accountTypeName)}>{r.child.accountTypeName}</Tag>
        </Space>
      ),
    },
    {
      title: "Parent Account",
      key: "parent",
      render: (_, r) => (
        <Space>
          <Text code>{r.parent.accountNumber}</Text>
          <Text>{r.parent.accountName}</Text>
          <Tag color={typeColor(r.parent.accountTypeName)}>{r.parent.accountTypeName}</Tag>
        </Space>
      ),
    },
    {
      title: "Fix",
      key: "fix",
      width: 200,
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
      render: (_, r) => (
        <Space>
          <Text code>{r.account.accountNumber}</Text>
          <Text>{r.account.accountName}</Text>
          <Tag color={typeColor(r.account.accountTypeName)}>{r.account.accountTypeName}</Tag>
        </Space>
      ),
    },
    {
      title: "Children",
      dataIndex: "childCount",
      key: "childCount",
      width: 100,
      align: "right",
    },
    {
      title: "Direct Balance",
      dataIndex: "directBalance",
      key: "directBalance",
      width: 160,
      align: "right",
      render: (n: number) => (
        <span style={{ color: Math.abs(n) > 0.005 ? "#ff4d4f" : "inherit", fontWeight: 600 }}>
          {fmt(n)}
        </span>
      ),
    },
    {
      title: "Manual Entry",
      dataIndex: "allowsManualEntry",
      key: "allowsManualEntry",
      width: 130,
      render: (b: boolean) =>
        b ? <Tag color="red">Allowed</Tag> : <Tag color="green">Locked</Tag>,
    },
    {
      title: "Fix",
      key: "fix",
      width: 200,
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
      render: (_, r) => (
        <Space>
          <Text code>{r.accountNumber}</Text>
          <Text>{r.accountName}</Text>
          <Tag color={typeColor(r.accountTypeName)}>{r.accountTypeName}</Tag>
        </Space>
      ),
    },
    {
      title: "Fix",
      key: "fix",
      width: 220,
      render: (_, r) => (
        <Button size="small" onClick={() => navigate(`/accounting/accounts`)}>
          Reactivate or re-parent
        </Button>
      ),
    },
  ];

  return (
    <div className="p-6">
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        {/* Header */}
        <Card>
          <Space wrap align="center" size="middle">
            <ApartmentOutlined style={{ fontSize: 24, color: "#1F4E79" }} />
            <div>
              <Text strong style={{ fontSize: 18 }}>Hierarchy Health Audit</Text>
              <div style={{ fontSize: 12, color: "#6B7280" }}>
                Finds structural issues in the chart of accounts: type mismatches between
                children and parents, header accounts that still accept manual entry, postings
                sitting on headers, and inactive parents with active children.
              </div>
            </div>
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              loading={loading}
              onClick={run}
              style={{ marginLeft: "auto" }}
            >
              Re-run Audit
            </Button>
          </Space>
        </Card>

        {/* Summary */}
        {data && (
          <Card>
            <Row gutter={16}>
              <Col xs={12} md={6}>
                <Statistic title="Total Accounts" value={data.totalAccounts} />
              </Col>
              <Col xs={12} md={6}>
                <Statistic
                  title="Active"
                  value={data.totalActive}
                  valueStyle={{ color: "#52c41a" }}
                />
              </Col>
              <Col xs={12} md={6}>
                <Statistic
                  title="Issues Found"
                  value={totalIssues}
                  valueStyle={{ color: totalIssues > 0 ? "#ff4d4f" : "#52c41a" }}
                />
              </Col>
              <Col xs={12} md={6}>
                <Statistic
                  title="Status"
                  valueRender={() =>
                    allClean ? (
                      <Space>
                        <CheckCircleOutlined style={{ color: "#52c41a" }} />
                        <span style={{ color: "#52c41a" }}>Healthy</span>
                      </Space>
                    ) : (
                      <Space>
                        <ExclamationCircleOutlined style={{ color: "#ff4d4f" }} />
                        <span style={{ color: "#ff4d4f" }}>Needs review</span>
                      </Space>
                    )
                  }
                  value={0}
                />
              </Col>
            </Row>
          </Card>
        )}

        {allClean && (
          <Card>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <Space direction="vertical" align="center">
                  <CheckCircleOutlined style={{ color: "#52c41a", fontSize: 32 }} />
                  <Text strong>No structural issues found</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Every parent-child relationship has matching account types, no header
                    accepts manual entry, no header is carrying direct postings, and no
                    inactive parent has active children.
                  </Text>
                </Space>
              }
            />
          </Card>
        )}

        {data && data.typeMismatches.length > 0 && (
          <Card
            title={
              <Space>
                <WarningOutlined style={{ color: "#ff4d4f" }} />
                <span>Type Mismatches</span>
                <Tag color="red">{data.typeMismatches.length}</Tag>
                <Tooltip title="A child has a different AccountType than its parent. Either re-parent the child to a same-type parent, or change one of their types to match.">
                  <InfoCircleOutlined style={{ color: "#999" }} />
                </Tooltip>
              </Space>
            }
          >
            <Table
              size="small"
              rowKey={(r) => `${r.child.id}-${r.parent.id}`}
              columns={mismatchCols}
              dataSource={data.typeMismatches}
              pagination={{ pageSize: 10 }}
            />
          </Card>
        )}

        {data && data.headersAllowingManualEntry.length > 0 && (
          <Card
            title={
              <Space>
                <WarningOutlined style={{ color: "#fa8c16" }} />
                <span>Headers Allowing Manual Entry</span>
                <Tag color="orange">{data.headersAllowingManualEntry.length}</Tag>
                <Tooltip title="These accounts have children (so they're headers) but still accept direct postings. Turn off AllowManualEntry on each so future entries must go to a leaf account.">
                  <InfoCircleOutlined style={{ color: "#999" }} />
                </Tooltip>
              </Space>
            }
          >
            <Table
              size="small"
              rowKey={(r) => r.account.id}
              columns={headerCols}
              dataSource={data.headersAllowingManualEntry}
              pagination={{ pageSize: 10 }}
            />
          </Card>
        )}

        {data && data.headersWithDirectPostings.length > 0 && (
          <Card
            title={
              <Space>
                <WarningOutlined style={{ color: "#ff4d4f" }} />
                <span>Headers With Direct Postings</span>
                <Tag color="red">{data.headersWithDirectPostings.length}</Tag>
                <Tooltip title="These header accounts carry a non-zero direct balance — someone posted to a grouping account instead of a leaf. Open the Transactions Report on each and move the lines onto a proper leaf account.">
                  <InfoCircleOutlined style={{ color: "#999" }} />
                </Tooltip>
              </Space>
            }
          >
            <Table
              size="small"
              rowKey={(r) => r.account.id}
              columns={headerCols}
              dataSource={data.headersWithDirectPostings}
              pagination={{ pageSize: 10 }}
            />
          </Card>
        )}

        {data && data.inactiveParentsWithActiveChildren.length > 0 && (
          <Card
            title={
              <Space>
                <WarningOutlined style={{ color: "#faad14" }} />
                <span>Inactive Parents With Active Children</span>
                <Tag color="gold">{data.inactiveParentsWithActiveChildren.length}</Tag>
                <Tooltip title="A parent was deactivated but its children are still active. Either reactivate the parent, or re-parent the children to a different account.">
                  <InfoCircleOutlined style={{ color: "#999" }} />
                </Tooltip>
              </Space>
            }
          >
            <Table
              size="small"
              rowKey={(r) => r.id}
              columns={inactiveCols}
              dataSource={data.inactiveParentsWithActiveChildren}
              pagination={{ pageSize: 10 }}
            />
          </Card>
        )}
      </Space>
    </div>
  );
}
