// Inventory Valuation
// ===================
// What's sitting in the kitchen right now in dollars (Top + total),
// what moved most in the period (top movers, by value), and what's
// sitting still (slow movers).

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Table, DatePicker, Button, Empty, Tooltip, message } from "antd";
import {
  AppstoreOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  FireOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs, { Dayjs } from "dayjs";
import {
  InventoryValuationDto, InventoryValueLine, InventoryTopMover, InventorySlowMover,
  getInventoryValuation,
} from "../../services/inventoryValuationService";
import { PageHeader, Panel, Pill, StatTile } from "../../components/ui/PageKit";
import { IconChip } from "../../components/admin/venue/VenueKit";

const { RangePicker } = DatePicker;

const fmtMoney = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtQty = (n: number, u: string) => `${n.toLocaleString("en-US", { maximumFractionDigits: 3 })} ${u}`;

const num = "whitespace-nowrap tabular-nums";
const muted = "text-gray-400";

/** Ingredient name with the narrow-screen details stacked underneath. */
function NameCell({ name, sub }: { name: string; sub?: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="break-words font-medium text-gray-900 dark:text-gray-100">{name}</div>
      {sub && <div className="mt-0.5 text-[11px] text-gray-500 md:hidden dark:text-gray-400">{sub}</div>}
    </div>
  );
}

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

  const totalValue = data?.totalValue ?? 0;
  const share = (v: number) => (totalValue > 0 ? Math.max(0, Math.min(100, (v / totalValue) * 100)) : 0);

  const byIngredientCols: ColumnsType<InventoryValueLine> = [
    { title: "Ingredient", dataIndex: "ingredientName", key: "name",
      render: (s: string, r) => (
        <NameCell name={s} sub={<span className="tabular-nums">{fmtQty(r.quantityOnHand, r.unit)} · {r.unitCost != null ? `${fmtMoney(r.unitCost)} / ${r.unit}` : "no cost"}</span>} />
      ) },
    { title: "On Hand", key: "qty", align: "right", width: 160, responsive: ["md"],
      render: (_, r) => <span className={`${num} text-gray-700 dark:text-gray-300`}>{fmtQty(r.quantityOnHand, r.unit)}</span> },
    { title: "Unit Cost", dataIndex: "unitCost", key: "uc", align: "right", width: 140, responsive: ["md"],
      render: (n: number | null) => n != null ? <span className={`${num} text-gray-700 dark:text-gray-300`}>{fmtMoney(n)}</span> : <span className={muted}>—</span> },
    { title: "Share", key: "share", width: 160, responsive: ["lg"],
      render: (_, r) => {
        const pct = share(r.value);
        return (
          <div className="flex items-center gap-2" title={`${pct.toFixed(1)}% of total value`}>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
              <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
            </div>
            <span className={`${num} w-11 text-right text-[11px] text-gray-500 dark:text-gray-400`}>{pct.toFixed(1)}%</span>
          </div>
        );
      } },
    { title: "Value", dataIndex: "value", key: "v", align: "right", width: 140,
      render: (n: number) => <span className={`${num} font-semibold text-gray-900 dark:text-white`}>{fmtMoney(n)}</span> },
  ];

  const topMoversCols: ColumnsType<InventoryTopMover> = [
    { title: "Ingredient", dataIndex: "ingredientName", key: "n",
      render: (s: string, r) => <NameCell name={s} sub={<span className="tabular-nums">{fmtQty(r.consumedQuantity, r.unit)} consumed</span>} /> },
    { title: "Consumed Qty", key: "q", align: "right", width: 160, responsive: ["md"],
      render: (_, r) => <span className={`${num} text-gray-700 dark:text-gray-300`}>{fmtQty(r.consumedQuantity, r.unit)}</span> },
    { title: "Value Consumed", dataIndex: "consumedValue", key: "v", align: "right", width: 150,
      render: (n: number) => <span className={`${num} font-semibold text-emerald-600 dark:text-emerald-400`}>{fmtMoney(n)}</span> },
  ];

  const slowMoversCols: ColumnsType<InventorySlowMover> = [
    { title: "Ingredient", dataIndex: "ingredientName", key: "n",
      render: (s: string, r) => (
        <NameCell
          name={s}
          sub={<span className="tabular-nums">{fmtQty(r.quantityOnHand, r.unit)} · {r.lastConsumptionOn ? `last used ${dayjs(r.lastConsumptionOn).format("MMM D, YYYY")}` : "never used"}</span>}
        />
      ) },
    { title: "Sitting", key: "q", align: "right", width: 140, responsive: ["md"],
      render: (_, r) => <span className={`${num} text-gray-700 dark:text-gray-300`}>{fmtQty(r.quantityOnHand, r.unit)}</span> },
    { title: "Value", dataIndex: "value", key: "v", align: "right", width: 130,
      render: (n: number) => <span className={`${num} font-semibold text-gray-900 dark:text-white`}>{fmtMoney(n)}</span> },
    { title: "Last used", dataIndex: "lastConsumptionOn", key: "lu", width: 140, responsive: ["md"],
      render: (s: string | null) => s
        ? <span className={`${num} text-gray-700 dark:text-gray-300`}>{dayjs(s).format("MMM D, YYYY")}</span>
        : <Pill tone="red" dot>Never</Pill> },
  ];

  // ── Presentation (derived from the data already loaded) ─────────────
  const firstLoad = loading && !data;
  const top = data?.topMovers[0];
  const slowValue = data ? data.slowMovers.reduce((s, r) => s + (r.value || 0), 0) : 0;
  const periodLabel = `${range[0].format("MMM D, YYYY")} – ${range[1].format("MMM D, YYYY")}`;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6">
      <PageHeader
        tone="emerald"
        icon={<DollarOutlined />}
        title="Inventory Valuation"
        description="Live $ value in the kitchen. Top / slow movers reflect the selected period."
        actions={
          <Tooltip title="Reload">
            <Button icon={<ReloadOutlined />} onClick={reload} loading={loading} aria-label="Reload" />
          </Tooltip>
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <RangePicker value={range}
            onChange={(v) => v && v[0] && v[1] && setRange([v[0], v[1]])}
            presets={[
              { label: "Last 7 days", value: [dayjs().subtract(7, "day").startOf("day"), dayjs().endOf("day")] },
              { label: "Last 30 days", value: [dayjs().subtract(30, "day").startOf("day"), dayjs().endOf("day")] },
              { label: "This Month", value: [dayjs().startOf("month"), dayjs().endOf("day")] },
              { label: "This Year", value: [dayjs().startOf("year"), dayjs().endOf("day")] },
            ]} allowClear={false}
            className="w-full sm:w-auto" />
          <span className="text-xs text-gray-500 dark:text-gray-400">Period for top and slow movers</span>
        </div>
      </PageHeader>

      {!data && !loading ? (
        <Panel>
          <div className="py-8"><Empty description="Valuation couldn't be loaded. Try Reload." /></div>
        </Panel>
      ) : (
        <>
          {/* KPIs — hero total + derived figures (no extra requests) */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="min-w-0 sm:col-span-2">
              <div className="h-full [&>div]:h-full [&>div]:border-emerald-200 [&>div]:bg-gradient-to-br [&>div]:from-emerald-50 [&>div]:to-white dark:[&>div]:border-emerald-500/20 dark:[&>div]:from-emerald-500/10 dark:[&>div]:to-transparent">
                <StatTile
                  label={
                    <span className="inline-flex items-center gap-1.5 font-medium text-emerald-800 dark:text-emerald-200">
                      Total Value
                      <Tooltip title="Sum of (QuantityOnHand × BuyPricePerUnit) across every active ingredient.">
                        <InfoCircleOutlined className="text-gray-400" aria-label="How it's calculated" />
                      </Tooltip>
                    </span>
                  }
                  loading={firstLoad}
                  value={<span className="text-4xl tabular-nums sm:text-[40px]">{fmtMoney(totalValue)}</span>}
                  sub={data ? <>Across <span className="tabular-nums">{data.ingredientCount.toLocaleString("en-US")}</span> tracked ingredient{data.ingredientCount === 1 ? "" : "s"} · live</> : "Live"}
                  accent={<IconChip tone="emerald"><DollarOutlined /></IconChip>}
                />
              </div>
            </div>
            <div className="min-w-0 [&>div]:h-full">
            <StatTile
              label={
                <span className="inline-flex items-center gap-1.5">
                  Top Mover (period)
                  <Tooltip title="Most-consumed ingredient by $ value in the selected window.">
                    <InfoCircleOutlined className="text-gray-400" aria-label="What this means" />
                  </Tooltip>
                </span>
              }
              loading={firstLoad}
              value={<span className="block truncate text-xl">{top?.ingredientName || "—"}</span>}
              sub={top ? <span className="tabular-nums">{fmtMoney(top.consumedValue)} consumed</span> : periodLabel}
              accent={<IconChip tone="amber"><FireOutlined /></IconChip>}
            />
            </div>
            <StatTile
              label="Slow movers"
              loading={firstLoad}
              value={<span className="tabular-nums">{fmtMoney(slowValue)}</span>}
              sub={data ? <><span className="tabular-nums">{data.slowMovers.length}</span> ingredient{data.slowMovers.length === 1 ? "" : "s"} sitting still</> : "Sitting still"}
              accent={<IconChip tone="gray"><ClockCircleOutlined /></IconChip>}
            />
          </div>

          <Panel
            title="By Ingredient"
            subtitle="Current value, highest first"
            extra={data ? <Pill tone="emerald"><AppstoreOutlined /> {data.byIngredient.length} ingredients</Pill> : undefined}
            bodyClassName="p-0"
          >
            <Table size="middle" loading={loading} rowKey="ingredientId" columns={byIngredientCols}
              dataSource={data?.byIngredient ?? []} pagination={{ pageSize: 20, showSizeChanger: true, showLessItems: true, className: "flex-wrap gap-y-2 px-4 sm:px-5" }}
              locale={{ emptyText: loading ? <div className="h-24" /> : <Empty description="No ingredients with stock" /> }} />
          </Panel>

          <div className="grid gap-6 xl:grid-cols-2">
            <Panel title="Top Movers" subtitle={`Consumed in this period · ${periodLabel}`} bodyClassName="p-0">
              <Table size="middle" loading={loading} rowKey="ingredientId" columns={topMoversCols}
                dataSource={data?.topMovers ?? []} pagination={false}
                locale={{ emptyText: loading ? <div className="h-24" /> : <Empty description="Nothing consumed in this period" /> }} />
            </Panel>

            <Panel title="Slow Movers" subtitle="Value sitting still" bodyClassName="p-0">
              <Table size="middle" loading={loading} rowKey="ingredientId" columns={slowMoversCols}
                dataSource={data?.slowMovers ?? []} pagination={false}
                locale={{ emptyText: loading ? <div className="h-24" /> : <Empty description="No slow movers" /> }} />
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
