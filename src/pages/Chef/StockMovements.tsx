// Stock Movements
// ===============
// Full audit trail of every change to ingredient stock: shipments,
// consumption from sales, waste, adjustments. Filterable by ingredient,
// type, and date range. Read-only — to add stock / record waste, use the
// Ingredients page.
//
// The "Waste Log" sidebar entry routes here with ?type=Waste preselected,
// so we don't need a separate page.

import { useEffect, useMemo, useState } from "react";
import {
  Card,
  Table,
  Tag,
  Space,
  Select,
  DatePicker,
  Button,
  Typography,
  message,
} from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs, { Dayjs } from "dayjs";
import { useSearchParams } from "react-router";
import {
  IngredientDto,
  StockMovementDto,
  getIngredients,
  getStockMovements,
} from "../../services/ingredientService";

const { RangePicker } = DatePicker;
const { Text } = Typography;

const TYPE_COLORS: Record<string, string> = {
  Purchase: "green",
  Consumption: "blue",
  Waste: "red",
  Adjustment: "purple",
};

export default function StockMovements() {
  const [params] = useSearchParams();
  const initialType = params.get("type") ?? "";

  const [ingredients, setIngredients] = useState<IngredientDto[]>([]);
  const [rows, setRows] = useState<StockMovementDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const [ingredientId, setIngredientId] = useState<number | "all">("all");
  const [type, setType] = useState<string>(initialType);
  const [range, setRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(30, "day").startOf("day"),
    dayjs().endOf("day"),
  ]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  useEffect(() => {
    // Load active ingredients once for the dropdown.
    getIngredients()
      .then(setIngredients)
      .catch(() => {/* non-fatal */});
  }, []);

  const filterArgs = useMemo(
    () => ({
      ingredientId: ingredientId === "all" ? null : ingredientId,
      type: type || null,
      from: range[0].toISOString(),
      to: range[1].toISOString(),
    }),
    [ingredientId, type, range]
  );

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getStockMovements({ ...filterArgs, page, pageSize })
      .then((r) => {
        if (!mounted) return;
        setRows(r.data || []);
        setTotal(r.totalCount || 0);
      })
      .catch(() => mounted && message.error("Failed to load movements"))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [filterArgs, page, pageSize]);

  const columns: ColumnsType<StockMovementDto> = [
    {
      title: "When",
      dataIndex: "createdOn",
      key: "createdOn",
      width: 160,
      render: (s: string) => dayjs(s).format("YYYY-MM-DD HH:mm"),
    },
    {
      title: "Ingredient",
      key: "ingredient",
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Text strong>{r.ingredientName}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{r.ingredientUnit}</Text>
        </Space>
      ),
    },
    {
      title: "Type",
      dataIndex: "type",
      key: "type",
      width: 120,
      render: (t: string) => <Tag color={TYPE_COLORS[t] ?? "default"}>{t}</Tag>,
    },
    {
      title: "Change",
      dataIndex: "quantity",
      key: "quantity",
      align: "right",
      width: 140,
      render: (n: number, r) => (
        <Text strong style={{ color: n >= 0 ? "#16A34A" : "#DC2626" }}>
          {n >= 0 ? "+" : ""}
          {n.toLocaleString("en-US", { maximumFractionDigits: 3 })} {r.ingredientUnit}
        </Text>
      ),
    },
    {
      title: "Balance After",
      dataIndex: "balanceAfter",
      key: "balanceAfter",
      align: "right",
      width: 140,
      render: (n: number, r) => (
        <Text style={{ color: n < 0 ? "#ff4d4f" : undefined }}>
          {n.toLocaleString("en-US", { maximumFractionDigits: 3 })} {r.ingredientUnit}
        </Text>
      ),
    },
    {
      title: "Reason / Reference",
      key: "ref",
      render: (_, r) => {
        if (r.type === "Waste" && r.wasteReason) {
          return (
            <Space>
              <Tag color="red">{r.wasteReason}</Tag>
              {r.notes && <Text type="secondary">{r.notes}</Text>}
            </Space>
          );
        }
        if (r.referenceType === "Transaction" && r.referenceId) {
          return (
            <Space>
              <Tag color="blue">Tx #{r.referenceId}</Tag>
              {r.notes && <Text type="secondary">{r.notes}</Text>}
            </Space>
          );
        }
        return r.notes ?? <Text type="secondary">—</Text>;
      },
    },
    {
      title: "By",
      dataIndex: "createdBy",
      key: "createdBy",
      width: 160,
      ellipsis: true,
      render: (s: string | null) => s || "—",
    },
  ];

  return (
    <div className="p-6">
      <Card>
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Space wrap align="center" style={{ width: "100%", justifyContent: "space-between" }}>
            <div>
              <Text strong style={{ fontSize: 18 }}>Stock Movements</Text>
              <div style={{ fontSize: 12, color: "#6B7280" }}>
                Audit trail of every change to ingredient stock. Read-only.
              </div>
            </div>
            <Button icon={<ReloadOutlined />} onClick={() => setPage((p) => p)} loading={loading}>
              Reload
            </Button>
          </Space>

          {/* Filters */}
          <Space wrap>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Ingredient"
              value={ingredientId}
              onChange={(v) => { setIngredientId(v); setPage(1); }}
              style={{ minWidth: 220 }}
              options={[
                { value: "all", label: "All ingredients" },
                ...ingredients.map((i) => ({ value: i.id, label: `${i.name} (${i.unit})` })),
              ]}
            />
            <Select
              value={type || "all"}
              onChange={(v) => { setType(v === "all" ? "" : v); setPage(1); }}
              style={{ minWidth: 160 }}
              options={[
                { value: "all", label: "All types" },
                { value: "Purchase", label: "Purchase" },
                { value: "Consumption", label: "Consumption" },
                { value: "Waste", label: "Waste" },
                { value: "Adjustment", label: "Adjustment" },
              ]}
            />
            <RangePicker
              value={range}
              onChange={(v) => v && v[0] && v[1] && setRange([v[0], v[1]])}
              presets={[
                { label: "Today", value: [dayjs().startOf("day"), dayjs().endOf("day")] },
                { label: "Last 7 days", value: [dayjs().subtract(7, "day").startOf("day"), dayjs().endOf("day")] },
                { label: "Last 30 days", value: [dayjs().subtract(30, "day").startOf("day"), dayjs().endOf("day")] },
                { label: "This Month", value: [dayjs().startOf("month"), dayjs().endOf("day")] },
              ]}
              allowClear={false}
            />
          </Space>

          <Table
            size="small"
            loading={loading}
            rowKey="id"
            columns={columns}
            dataSource={rows}
            pagination={{
              current: page,
              pageSize,
              total,
              showSizeChanger: true,
              pageSizeOptions: [25, 50, 100, 200],
              onChange: (p, s) => { setPage(p); setPageSize(s); },
              showTotal: (t) => `${t} movement(s)`,
            }}
            scroll={{ x: 1000 }}
          />
        </Space>
      </Card>
    </div>
  );
}
