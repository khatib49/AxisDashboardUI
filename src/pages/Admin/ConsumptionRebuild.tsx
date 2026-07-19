// ConsumptionRebuild
// ==================
// Admin utility page for Bug#10. Recomputes every historical Consumption
// StockMovement using today's recipes + unit conversion + latest ingredient
// buy prices, and adjusts Ingredient.QuantityOnHand by the delta.
//
// Guardrails baked in:
//   1. Preview button first (dryRun=true). Nothing hits the DB.
//   2. Apply button ONLY enables after a successful preview.
//   3. Confirmation modal restates what's about to happen and shows the
//      delta so nobody misclicks the "commit" path.
//
// Route: /admin/consumption-rebuild (admin role required).

import { useState } from "react";
import {
  Alert, Button, Card, DatePicker, Space, Statistic, Table, Tag,
  Typography, Modal, message,
} from "antd";
import {
  ExperimentOutlined, ReloadOutlined, WarningOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import type { Dayjs } from "dayjs";
import {
  rebuildConsumptionCosts,
  RebuildConsumptionCostsResultDto,
  RebuildLineDto,
} from "../../services/stockRebuildService";

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

const money = (n: number | null | undefined) =>
  n == null ? "—"
    : `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const qty = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("en-US", { maximumFractionDigits: 3 });

export default function ConsumptionRebuild() {
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null]>([null, null]);
  const [preview, setPreview] = useState<RebuildConsumptionCostsResultDto | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Convert the picker range into ISO date strings the backend expects.
  const fromIso = () => range[0]?.startOf("day").toISOString();
  const toIso   = () => range[1]?.endOf("day").toISOString();

  async function runPreview() {
    setPreviewing(true);
    setPreview(null);
    try {
      const res = await rebuildConsumptionCosts(true, fromIso(), toIso());
      setPreview(res);
      if (res.movementsChanged === 0) {
        message.info("Nothing to rebuild — historical Consumption already matches current recipes.");
      } else {
        message.success(`Preview complete: ${res.movementsChanged} movement(s) would change.`);
      }
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "Preview failed");
    } finally { setPreviewing(false); }
  }

  async function runApply() {
    setApplying(true);
    try {
      const res = await rebuildConsumptionCosts(false, fromIso(), toIso());
      setPreview(res);
      setConfirmOpen(false);
      message.success(
        `Committed: ${res.movementsChanged} movement(s) rebuilt, COGS delta ${money(res.delta)}`,
      );
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "Apply failed");
    } finally { setApplying(false); }
  }

  const detailColumns: ColumnsType<RebuildLineDto> = [
    { title: "Mvt#",   dataIndex: "movementId",     width: 90, render: (v) => <code>{v}</code> },
    { title: "Tx#",    dataIndex: "transactionId", width: 90, render: (v) => <code>{v}</code> },
    { title: "Ingredient", dataIndex: "ingredientName" },
    {
      title: "Qty",
      align: "right",
      render: (_, r) => (
        <span>
          <Text delete type="danger">{qty(r.oldQuantity)}</Text>
          <br />
          <Text strong type="success">{qty(r.newQuantity)}</Text>
        </span>
      ),
    },
    {
      title: "Unit cost",
      align: "right",
      render: (_, r) => (
        <span>
          <Text delete type="danger">{money(r.oldUnitCost)}</Text>
          <br />
          <Text strong type="success">{money(r.newUnitCost)}</Text>
        </span>
      ),
    },
    {
      title: "Total cost",
      align: "right",
      render: (_, r) => (
        <span>
          <Text delete type="danger">{money(r.oldTotalCost)}</Text>
          <br />
          <Text strong type="success">{money(r.newTotalCost)}</Text>
        </span>
      ),
    },
    { title: "Why", dataIndex: "reason" },
  ];

  const qohRows = preview
    ? Object.entries(preview.qoHAdjustments).map(([name, delta]) => ({ name, delta }))
    : [];

  const qohColumns: ColumnsType<{ name: string; delta: number }> = [
    { title: "Ingredient", dataIndex: "name" },
    {
      title: "Stock adjustment",
      dataIndex: "delta",
      align: "right",
      render: (v: number) => (
        <Text type={v > 0 ? "success" : "danger"} strong>
          {v > 0 ? "+" : ""}{qty(v)}
        </Text>
      ),
    },
  ];

  return (
    <div className="p-6">
      <Title level={3}>Ingredient COGS · Historical Rebuild</Title>
      <Paragraph type="secondary">
        Recomputes every historical <b>Consumption</b> stock movement using today's recipes,
        unit conversions and buy prices — fixing the inflated Ingredient COGS on the accounting
        dashboard. This is a one-shot repair after the recipe-unit fix (Bug#9).
      </Paragraph>

      <Card style={{ marginBottom: 16 }} size="small">
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <div>
            <Text strong>Optional period</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Leave blank to rebuild ALL historical Consumption movements.
            </Text>
            <div style={{ marginTop: 6 }}>
              <RangePicker
                value={range}
                onChange={(v) => setRange([v?.[0] ?? null, v?.[1] ?? null])}
                allowEmpty={[true, true]}
              />
            </div>
          </div>

          <Space>
            <Button
              type="primary"
              icon={<ExperimentOutlined />}
              onClick={runPreview}
              loading={previewing}
            >
              Preview (dry run)
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => setConfirmOpen(true)}
              disabled={!preview || preview.movementsChanged === 0 || preview.dryRun === false}
              danger
            >
              Apply rebuild
            </Button>
          </Space>
        </Space>
      </Card>

      {preview && (
        <>
          <Alert
            type={preview.dryRun ? "info" : "success"}
            showIcon
            style={{ marginBottom: 16 }}
            message={
              preview.dryRun
                ? "This is a dry-run preview. Nothing has been written yet."
                : "Rebuild committed. Historical COGS is now aligned with today's recipes."
            }
            description={
              preview.dryRun && preview.movementsChanged > 0
                ? "Review the numbers below carefully. When you're happy, click Apply rebuild."
                : undefined
            }
          />

          <Card size="small" style={{ marginBottom: 16 }}>
            <Space size="large" wrap>
              <Statistic title="Movements scanned"  value={preview.movementsScanned} />
              <Statistic title="Would change" value={preview.movementsChanged} valueStyle={{ color: preview.movementsChanged > 0 ? "#d97706" : undefined }} />
              <Statistic title="Transactions affected" value={preview.transactionsAffected} />
              <Statistic title="Old COGS" value={preview.oldTotalCogs} prefix="$" precision={2} valueStyle={{ color: "#b91c1c" }} />
              <Statistic title="New COGS" value={preview.newTotalCogs} prefix="$" precision={2} valueStyle={{ color: "#166534" }} />
              <Statistic
                title="Delta"
                value={preview.delta}
                prefix={preview.delta >= 0 ? "+$" : "-$"}
                precision={2}
                valueStyle={{ color: preview.delta < 0 ? "#166534" : "#b91c1c", fontWeight: 700 }}
              />
            </Space>
          </Card>

          {qohRows.length > 0 && (
            <Card
              size="small"
              title={<span><CheckCircleOutlined /> Ingredient stock adjustments</span>}
              style={{ marginBottom: 16 }}
            >
              <Paragraph type="secondary" style={{ fontSize: 12 }}>
                Positive numbers mean stock was over-consumed historically and will be restored;
                negative means the opposite. Verify these look sensible against physical inventory
                before applying.
              </Paragraph>
              <Table
                size="small"
                rowKey="name"
                dataSource={qohRows}
                columns={qohColumns}
                pagination={{ pageSize: 10 }}
              />
            </Card>
          )}

          {preview.details.length > 0 && (
            <Card
              size="small"
              title={<span>Per-movement detail (first {preview.details.length})</span>}
            >
              <Table
                size="small"
                rowKey="movementId"
                dataSource={preview.details}
                columns={detailColumns}
                pagination={{ pageSize: 25 }}
                scroll={{ x: 900 }}
              />
            </Card>
          )}
        </>
      )}

      {/* Confirmation modal — spell out exactly what's about to happen. */}
      <Modal
        open={confirmOpen}
        title={<span><WarningOutlined style={{ color: "#f59e0b" }} /> Apply rebuild</span>}
        okText="Yes, rebuild historical COGS"
        okButtonProps={{ danger: true, loading: applying }}
        cancelButtonProps={{ disabled: applying }}
        onCancel={() => setConfirmOpen(false)}
        onOk={runApply}
      >
        {preview && (
          <div>
            <Paragraph>
              This will overwrite <b>{preview.movementsChanged}</b> historical Consumption
              movement(s) across <b>{preview.transactionsAffected}</b> transaction(s).
            </Paragraph>
            <Paragraph>
              COGS will change from <Text type="danger">{money(preview.oldTotalCogs)}</Text>
              &nbsp;to <Text type="success">{money(preview.newTotalCogs)}</Text>
              &nbsp;(delta <b>{money(preview.delta)}</b>).
            </Paragraph>
            <Paragraph type="secondary" style={{ fontSize: 12 }}>
              Each rewritten row is tagged <Tag>[rebuilt {new Date().toISOString().slice(0, 10)}]</Tag>
              in its Notes so it's traceable later. Ingredient stock levels
              will also be adjusted per the QoH table above.
            </Paragraph>
            <Alert
              type="warning"
              message="This action cannot be undone from the UI."
              showIcon
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
