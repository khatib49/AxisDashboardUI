// Books Audit
// ===========
// Admin-only reconciliation tool. Shows whether the chart of accounts revenue
// side matches the calculator (sum of TransactionRecord.TotalPrice in period).
// If there's a gap, lists the orphan transaction IDs and exposes a one-click
// backfill that re-issues every transaction journal entry in the new
// 3-line shape (Cash + Sales Discounts + Revenue).

import { useState } from "react";
import {
  Card,
  Button,
  DatePicker,
  Space,
  Statistic,
  Row,
  Col,
  Tag,
  message,
  Typography,
  Tooltip,
} from "antd";
import {
  AuditOutlined,
  SyncOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import dayjs, { Dayjs } from "dayjs";
import {
  getRevenueCoverageAudit,
  backfillTransactions,
  RevenueCoverageAuditDto,
  BackfillResultDto,
} from "../../services/accountingService";

const { RangePicker } = DatePicker;
const { Text } = Typography;

const fmt = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function BooksAudit() {
  const [range, setRange] = useState<[Dayjs, Dayjs]>([
    dayjs().startOf("month"),
    dayjs().endOf("day"),
  ]);
  const [loading, setLoading] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [audit, setAudit] = useState<RevenueCoverageAuditDto | null>(null);
  const [lastBackfill, setLastBackfill] = useState<BackfillResultDto | null>(null);

  async function runAudit() {
    setLoading(true);
    try {
      const result = await getRevenueCoverageAudit(
        range[0].toISOString(),
        range[1].toISOString()
      );
      setAudit(result);
    } catch {
      message.error("Failed to run audit");
    } finally {
      setLoading(false);
    }
  }

  async function runBackfill() {
    setBackfilling(true);
    setLastBackfill(null);
    try {
      const result = await backfillTransactions();
      setLastBackfill(result);
      if (result.failed === 0) {
        message.success(`Backfill complete: ${result.success} transactions re-issued.`);
      } else {
        message.warning(
          `Backfill done with ${result.failed} failure(s). ${result.success} succeeded.`
        );
      }
      // Auto-refresh the audit so the gap closes visually.
      await runAudit();
    } catch {
      message.error("Backfill failed");
    } finally {
      setBackfilling(false);
    }
  }

  const hasGap = audit != null && Math.abs(audit.discrepancy) > 0.01;
  const allCovered = audit != null && audit.transactionsWithoutJE === 0 && !hasGap;

  return (
    <div className="p-6">
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        {/* Header */}
        <Card>
          <Space wrap align="center" size="middle">
            <AuditOutlined style={{ fontSize: 24, color: "#1F4E79" }} />
            <div>
              <Text strong style={{ fontSize: 18 }}>Books Audit — Revenue Coverage</Text>
              <div style={{ fontSize: 12, color: "#6B7280" }}>
                Compares the calculator (sum of paid transactions) with the chart of accounts.
                Lets you re-issue any transaction journal entries that are missing or out-of-date.
              </div>
            </div>
          </Space>
        </Card>

        {/* Toolbar */}
        <Card>
          <Space wrap align="center">
            <Text strong>Reporting Period:</Text>
            <RangePicker
              value={range}
              onChange={(v) => v && v[0] && v[1] && setRange([v[0], v[1]])}
              presets={[
                { label: "This Month", value: [dayjs().startOf("month"), dayjs().endOf("day")] },
                { label: "Last Month", value: [dayjs().subtract(1, "month").startOf("month"), dayjs().subtract(1, "month").endOf("month")] },
                { label: "Last 30 Days", value: [dayjs().subtract(30, "day").startOf("day"), dayjs().endOf("day")] },
                { label: "This Year", value: [dayjs().startOf("year"), dayjs().endOf("day")] },
              ]}
              allowClear={false}
              style={{ minWidth: 280 }}
            />
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              loading={loading}
              onClick={runAudit}
            >
              Run Audit
            </Button>
          </Space>
        </Card>

        {/* Results */}
        {audit && (
          <>
            {/* Headline summary */}
            <Card>
              <Row gutter={16}>
                <Col xs={12} md={6}>
                  <Statistic
                    title={
                      <Space>
                        Calculator Net
                        <Tooltip title="Sum of TransactionRecord.TotalPrice for paid transactions in the period (what the cashier received).">
                          <InfoCircleOutlined style={{ color: "#999" }} />
                        </Tooltip>
                      </Space>
                    }
                    value={audit.transactionsTotalNet}
                    prefix="$"
                    precision={2}
                    valueStyle={{ color: "#1F4E79" }}
                  />
                </Col>
                <Col xs={12} md={6}>
                  <Statistic
                    title={
                      <Space>
                        Books Net Revenue
                        <Tooltip title="Sum of 4xxx Revenue credits minus 4900 Sales Discounts debits, from posted non-voided JEs in the period.">
                          <InfoCircleOutlined style={{ color: "#999" }} />
                        </Tooltip>
                      </Space>
                    }
                    value={audit.netRevenueOnBooks}
                    prefix="$"
                    precision={2}
                    valueStyle={{ color: "#1F4E79" }}
                  />
                </Col>
                <Col xs={12} md={6}>
                  <Statistic
                    title={
                      <Space>
                        Discrepancy
                        <Tooltip title="Calculator Net − Books Net. Anything other than zero means some paid transactions aren't reflected on the chart of accounts.">
                          <InfoCircleOutlined style={{ color: "#999" }} />
                        </Tooltip>
                      </Space>
                    }
                    value={audit.discrepancy}
                    prefix={audit.discrepancy >= 0 ? "$" : "− $"}
                    precision={2}
                    valueStyle={{ color: hasGap ? "#ff4d4f" : "#52c41a" }}
                  />
                </Col>
                <Col xs={12} md={6}>
                  <Statistic
                    title={
                      <Space>
                        Discounts Given
                        <Tooltip title="Sum of debits on the 4900 Sales Discounts account for transactions in the period.">
                          <InfoCircleOutlined style={{ color: "#999" }} />
                        </Tooltip>
                      </Space>
                    }
                    value={audit.salesDiscountsDebit}
                    prefix="$"
                    precision={2}
                    valueStyle={{ color: "#fa8c16" }}
                  />
                </Col>
              </Row>
            </Card>

            {/* Status + action band */}
            <Card>
              {allCovered ? (
                <Space size="middle">
                  <CheckCircleOutlined style={{ color: "#52c41a", fontSize: 28 }} />
                  <div>
                    <Text strong style={{ fontSize: 16 }}>Books are reconciled</Text>
                    <div style={{ color: "#6B7280", fontSize: 12 }}>
                      Every paid transaction in this period has a posted journal entry, and the
                      calculator matches the chart of accounts.
                    </div>
                  </div>
                </Space>
              ) : (
                <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                  <Space size="middle">
                    <ExclamationCircleOutlined style={{ color: "#ff4d4f", fontSize: 28 }} />
                    <div>
                      <Text strong style={{ fontSize: 16 }}>Books need backfill</Text>
                      <div style={{ color: "#6B7280", fontSize: 12 }}>
                        {audit.transactionsWithoutJE > 0 && (
                          <>
                            {audit.transactionsWithoutJE} of {audit.transactionsCount}{" "}
                            paid transactions have no journal entry.{" "}
                          </>
                        )}
                        {hasGap && (
                          <>
                            Calculator and books differ by {fmt(Math.abs(audit.discrepancy))}.
                          </>
                        )}
                      </div>
                    </div>
                  </Space>
                  <Space wrap>
                    <Button
                      type="primary"
                      danger
                      icon={<SyncOutlined spin={backfilling} />}
                      loading={backfilling}
                      onClick={runBackfill}
                    >
                      Backfill / Re-issue Transaction Journal Entries
                    </Button>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Re-issues every transaction JE in the period in the new 3-line shape
                      (Cash + Sales Discounts + Revenue). Safe to run multiple times.
                    </Text>
                  </Space>
                </Space>
              )}
            </Card>

            {/* Orphan list */}
            {audit.orphanTransactionIds.length > 0 && (
              <Card
                title={
                  <Space>
                    <Tag color="red">Orphans</Tag>
                    <span>Paid transactions missing a journal entry</span>
                  </Space>
                }
                extra={<Text type="secondary">{audit.orphanTransactionIds.length} listed (max 500)</Text>}
              >
                <Text code style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>
                  {audit.orphanTransactionIds.join(", ")}
                </Text>
              </Card>
            )}

            {/* Last backfill result */}
            {lastBackfill && (
              <Card title="Last Backfill">
                <Row gutter={16}>
                  <Col span={6}>
                    <Statistic title="Total" value={lastBackfill.total} />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="Succeeded"
                      value={lastBackfill.success}
                      valueStyle={{ color: "#52c41a" }}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="Failed"
                      value={lastBackfill.failed}
                      valueStyle={{ color: lastBackfill.failed > 0 ? "#ff4d4f" : "#52c41a" }}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic title="Errors" value={lastBackfill.errors.length} />
                  </Col>
                </Row>
                {lastBackfill.errors.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <Text strong style={{ color: "#ff4d4f" }}>Errors:</Text>
                    <ul style={{ marginTop: 8 }}>
                      {lastBackfill.errors.slice(0, 20).map((e, i) => (
                        <li key={i} style={{ fontSize: 12, color: "#6B7280" }}>{e}</li>
                      ))}
                      {lastBackfill.errors.length > 20 && (
                        <li style={{ fontSize: 12, color: "#999" }}>
                          ...and {lastBackfill.errors.length - 20} more
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </Card>
            )}
          </>
        )}

        {!audit && !loading && (
          <Card>
            <Text type="secondary">
              Pick a period and click <strong>Run Audit</strong> to see how well the books match.
            </Text>
          </Card>
        )}
      </Space>
    </div>
  );
}
