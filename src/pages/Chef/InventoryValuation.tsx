// Inventory Valuation
// ===================
// What's sitting in the kitchen right now in dollars (Top + total),
// what moved most in the period (top movers, by value), and what's
// sitting still (slow movers).

import { useEffect, useState } from "react";
import {
  Card, Statistic, Row, Col, Table, Tag, Space, DatePicker, Button, Typography, message, Tooltip,
} from "antd";
import { ReloadOutlined, InfoCircleOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs, { Dayjs } from "dayjs";
import {
  InventoryValuationDto, InventoryValueLine, InventoryTopMover, InventorySlowMover,
  getInventoryValuation,
} from "../../services/inventoryValuationService";

const { RangePicker } = DatePicker;
const { Text } = Typography;

const fmtMoney = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtQty = (n: number, u: string) => `${n.toLocaleString("en-US", { maximumFractionDigits: 3 })} ${u}`;

export default function InventoryValuation() {
  const [range, setRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(30, "day").startOf("day"),
    dayjs().endOf("day"),
  ]);
  const [data, setData] = useState<InventoryValuationDto | null>(null);
  const [loading, setLoading] = useState(false);

  async function reload() {
    setLoading(true);
    try { setData(await getInventoryValuation(range[0].toISOString(), range[1].toISOString())); }
    catch { message.error("Failed to load valuation"); }
    finally { setLoading(false); }
  }
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [range]);

  const byIngredientCols: ColumnsType<InventoryValueLine> = [
    { title: "Ingredient", dataIndex: "ingredientName", key: "name" },
    { title: "On Hand", key: "qty", align: "right", width: 160,
      render: (_, r) => fmtQty(r.quantityOnHand, r.unit) },
    { title: "Unit Cost", dataIndex: "unitCost", key: "uc", align: "right", width: 140,
      render: (n: number | null) => n != null ? fmtMoney(n) : <Text type="secondary">—</Text> },
    { title: "Value", dataIndex: "value", key: "v", align: "right", width: 160,
      render: (n: number) => <Text strong>{fmtMoney(n)}</Text> },
  ];

  const topMoversCols: ColumnsType<InventoryTopMover> = [
    { title: "Ingredient", dataIndex: "ingredientName", key: "n" },
    { title: "Consumed Qty", key: "q", align: "right", width: 160,
      render: (_, r) => fmtQty(r.consumedQuantity, r.unit) },
    { title: "Value Consumed", dataIndex: "consumedValue", key: "v", align: "right", width: 160,
      render: (n: number) => <Text strong style={{ color: "#16A34A" }}>{fmtMoney(n)}</Text> },
  ];

  const slowMoversCols: ColumnsType<InventorySlowMover> = [
    { title: "Ingredient", dataIndex: "ingredientName", key: "n" },
    { title: "Sitting", key: "q", align: "right", width: 140,
      render: (_, r) => fmtQty(r.quantityOnHand, r.unit) },
    { title: "Value", dataIndex: "value", key: "v", align: "right", width: 140,
      render: (n: number) => <Text strong>{fmtMoney(n)}</Text> },
    { title: "Last used", dataIndex: "lastConsumptionOn", key: "lu", width: 160,
      render: (s: string | null) => s ? dayjs(s).format("YYYY-MM-DD") : <Tag color="red">Never</Tag> },
  ];

  return (
    <div className="p-6">
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        <Card>
          <Space wrap align="center" style={{ width: "100%", justifyContent: "space-between" }}>
            <div>
              <Text strong style={{ fontSize: 18 }}>Inventory Valuation</Text>
              <div style={{ fontSize: 12, color: "#6B7280" }}>
                Live $ value in the kitchen. Top / slow movers reflect the selected period.
              </div>
            </div>
            <Space wrap>
              <RangePicker value={range}
                onChange={(v) => v && v[0] && v[1] && setRange([v[0], v[1]])}
                presets={[
                  { label: "Last 7 days", value: [dayjs().subtract(7, "day").startOf("day"), dayjs().endOf("day")] },
                  { label: "Last 30 days", value: [dayjs().subtract(30, "day").startOf("day"), dayjs().endOf("day")] },
                  { label: "This Month", value: [dayjs().startOf("month"), dayjs().endOf("day")] },
                  { label: "This Year", value: [dayjs().startOf("year"), dayjs().endOf("day")] },
                ]} allowClear={false} />
              <Button icon={<ReloadOutlined />} onClick={reload} loading={loading}>Reload</Button>
            </Space>
          </Space>
        </Card>

        {data && (
          <>
            <Row gutter={16}>
              <Col xs={12} md={8}>
                <Card><Statistic title={<Space>Total Value
                  <Tooltip title="Sum of (QuantityOnHand × BuyPricePerUnit) across every active ingredient."><InfoCircleOutlined style={{ color: "#999" }} /></Tooltip></Space>}
                  value={data.totalValue} prefix="$" precision={2} valueStyle={{ color: "#1F4E79" }} /></Card>
              </Col>
              <Col xs={12} md={8}>
                <Card><Statistic title="Ingredients Tracked" value={data.ingredientCount} /></Card>
              </Col>
              <Col xs={24} md={8}>
                <Card><Statistic title={<Space>Top Mover (period)
                  <Tooltip title="Most-consumed ingredient by $ value in the selected window."><InfoCircleOutlined style={{ color: "#999" }} /></Tooltip></Space>}
                  value={data.topMovers[0]?.ingredientName || "—"}
                  valueStyle={{ fontSize: 16 }} /></Card>
              </Col>
            </Row>

            <Card title="By Ingredient (current value, highest first)">
              <Table size="small" loading={loading} rowKey="ingredientId" columns={byIngredientCols}
                dataSource={data.byIngredient} pagination={{ pageSize: 20, showSizeChanger: true }} />
            </Card>

            <Card title="Top Movers — consumed in this period">
              <Table size="small" rowKey="ingredientId" columns={topMoversCols}
                dataSource={data.topMovers} pagination={false} />
            </Card>

            <Card title="Slow Movers — value sitting still">
              <Table size="small" rowKey="ingredientId" columns={slowMoversCols}
                dataSource={data.slowMovers} pagination={false} />
            </Card>
          </>
        )}
      </Space>
    </div>
  );
}
