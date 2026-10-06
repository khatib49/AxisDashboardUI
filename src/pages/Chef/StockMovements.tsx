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
  Table,
  Select,
  DatePicker,
  Button,
  Empty,
  Pagination,
  Skeleton,
  Spin,
  Tooltip,
  message,
} from "antd";
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  ReloadOutlined,
  SwapOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs, { Dayjs } from "dayjs";
import { useSearchParams } from "react-router";
import {
  IngredientDto,
  StockMovementDto,
  getIngredients,
  getStockMovements,
} from "../../services/ingredientService";
import { PageHeader, Panel, StatTile } from "../../components/ui/PageKit";
import { IconChip } from "../../components/admin/venue/VenueKit";
import {
  BalanceQty,
  MovementCard,
  MovementReference,
  MovementTypePill,
  MovementWhen,
  SignedQty,
} from "../../components/stock/MovementKit";

const { RangePicker } = DatePicker;

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
      width: 150,
      render: (s: string) => <MovementWhen iso={s} />,
    },
    {
      title: "Ingredient",
      key: "ingredient",
      render: (_, r) => (
        <div className="min-w-0">
          <div className="font-medium text-gray-900 dark:text-gray-100">{r.ingredientName}</div>
          <div className="text-[11px] text-gray-500 dark:text-gray-400">{r.ingredientUnit}</div>
        </div>
      ),
    },
    {
      title: "Type",
      dataIndex: "type",
      key: "type",
      width: 140,
      render: (t: string) => <MovementTypePill type={t} />,
    },
    {
      title: "Change",
      dataIndex: "quantity",
      key: "quantity",
      align: "right",
      width: 150,
      render: (n: number, r) => <SignedQty n={n} unit={r.ingredientUnit} />,
    },
    {
      title: "Balance After",
      dataIndex: "balanceAfter",
      key: "balanceAfter",
      align: "right",
      width: 140,
      render: (n: number, r) => <BalanceQty n={n} unit={r.ingredientUnit} />,
    },
    {
      title: "Reason / Reference",
      key: "ref",
      render: (_, r) => <MovementReference r={r} />,
    },
    {
      title: "By",
      dataIndex: "createdBy",
      key: "createdBy",
      width: 160,
      ellipsis: true,
      render: (s: string | null) => s ? <span className="text-gray-600 dark:text-gray-300">{s}</span> : <span className="text-gray-400">—</span>,
    },
  ];

  // ── Presentation (derived from the page already loaded) ─────────────
  const isWasteLog = type === "Waste";
  const firstLoad = loading && total === 0;
  const inOnPage = rows.filter((r) => r.quantity >= 0).length;
  const outOnPage = rows.filter((r) => r.quantity < 0).length;
  const wasteOnPage = rows.filter((r) => r.type === "Waste").length;
  const rangeLabel = `${range[0].format("MMM D, YYYY")} – ${range[1].format("MMM D, YYYY")}`;
  const filtersActive = ingredientId !== "all" || !!type;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6">
      <PageHeader
        tone="blue"
        icon={isWasteLog ? <DeleteOutlined /> : <SwapOutlined />}
        title={isWasteLog ? "Waste Log" : "Stock Movements"}
        badge="Read-only"
        description={
          isWasteLog
            ? "Every ingredient thrown away — spoilage, spillage, burnt, expired — with its reason. To record waste, use the Ingredients page."
            : "Audit trail of every change to ingredient stock: shipments, consumption from sales, waste and adjustments."
        }
        actions={
          <Tooltip title="Reload">
            <Button icon={<ReloadOutlined />} onClick={() => setPage((p) => p)} loading={loading} aria-label="Reload" />
          </Tooltip>
        }
      />

      {/* KPIs — derived from the page already loaded (no extra requests) */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Movements"
          loading={firstLoad}
          value={<span className="tabular-nums">{total.toLocaleString("en-US")}</span>}
          sub={rangeLabel}
          accent={<IconChip tone="blue"><SwapOutlined /></IconChip>}
        />
        <StatTile
          label="Stock in"
          loading={firstLoad}
          value={<span className="tabular-nums">{inOnPage.toLocaleString("en-US")}</span>}
          sub="Movements adding stock · this page"
          accent={<IconChip tone="emerald"><ArrowUpOutlined /></IconChip>}
        />
        <StatTile
          label="Stock out"
          loading={firstLoad}
          value={<span className="tabular-nums">{outOnPage.toLocaleString("en-US")}</span>}
          sub="Movements removing stock · this page"
          accent={<IconChip tone="red"><ArrowDownOutlined /></IconChip>}
        />
        <StatTile
          label="Waste"
          loading={firstLoad}
          value={<span className="tabular-nums">{wasteOnPage.toLocaleString("en-US")}</span>}
          sub="Waste entries · this page"
          accent={<IconChip tone="red"><DeleteOutlined /></IconChip>}
        />
      </div>

      <Panel
        title={isWasteLog ? "Waste entries" : "All movements"}
        subtitle={loading && rows.length === 0 ? "Loading…" : `${total.toLocaleString("en-US")} movement${total === 1 ? "" : "s"} · newest first`}
        bodyClassName="p-0"
      >
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-5 py-4 dark:border-white/[0.06]">
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="Ingredient"
            value={ingredientId}
            onChange={(v) => { setIngredientId(v); setPage(1); }}
            className="w-full sm:w-60"
            aria-label="Ingredient"
            options={[
              { value: "all", label: "All ingredients" },
              ...ingredients.map((i) => ({ value: i.id, label: `${i.name} (${i.unit})` })),
            ]}
          />
          <Select
            value={type || "all"}
            onChange={(v) => { setType(v === "all" ? "" : v); setPage(1); }}
            className="w-full sm:w-44"
            aria-label="Movement type"
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
            className="w-full sm:w-auto"
          />
        </div>

        {/* Desktop: table */}
        <div className="hidden md:block">
          <Table
            size="middle"
            loading={loading}
            rowKey="id"
            columns={columns}
            dataSource={rows}
            pagination={false}
            scroll={{ x: 1000 }}
            locale={{ emptyText: <Empty description={filtersActive ? "No movements match these filters" : "No movements in this period"} /> }}
          />
        </div>

        {/* Mobile: stacked cards */}
        <div className="md:hidden">
          {firstLoad ? (
            <div className="p-4"><Skeleton active paragraph={{ rows: 5 }} /></div>
          ) : rows.length === 0 && !loading ? (
            <div className="py-10"><Empty description={filtersActive ? "No movements match these filters" : "No movements in this period"} /></div>
          ) : (
            <Spin spinning={loading}>
              <div className="space-y-3 p-4">
                {rows.map((r) => <MovementCard key={r.id} r={r} />)}
              </div>
            </Spin>
          )}
        </div>

        {/* Pagination (shared by both layouts) */}
        <div className="border-t border-gray-100 px-4 py-3 sm:px-5 dark:border-white/[0.06]">
          <Pagination
            className="flex-wrap justify-center gap-y-2 sm:justify-end"
            showLessItems
            current={page}
            pageSize={pageSize}
            total={total}
            showSizeChanger
            pageSizeOptions={[25, 50, 100, 200]}
            onChange={(p, s) => { setPage(p); setPageSize(s); }}
            showTotal={(t) => `${t} movement(s)`}
            size="small"
          />
        </div>
      </Panel>
    </div>
  );
}
