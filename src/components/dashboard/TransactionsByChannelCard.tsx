// TransactionsByChannelCard
// =========================
// Home dashboard card with a date range + channel filter, paginated table
// of transactions, and an "Export Excel" button that streams the same
// filtered dataset as a .xlsx via the backend.
//
// Lives on the / dashboard for admin role. Cashier roles don't see this
// because they don't land on /.

import { useEffect, useMemo, useState } from "react";
import {
  DashboardTransactionRow,
  getDashboardTransactions,
  exportDashboardTransactionsXlsx,
} from "../../services/transactionService";
import { getChannels, ChannelDto } from "../../services/channelService";
import dayjs, { Dayjs } from "dayjs";
import { DatePicker, Select, Button, Table, Tag, message, Space, Tooltip } from "antd";
import { DownloadOutlined, ReloadOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";

const { RangePicker } = DatePicker;

const fmtMoney = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function TransactionsByChannelCard() {
  const [range, setRange] = useState<[Dayjs, Dayjs]>([
    dayjs().startOf("month"),
    dayjs().endOf("day"),
  ]);
  const [channels, setChannels] = useState<ChannelDto[]>([]);
  const [channelId, setChannelId] = useState<number | "all">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [rows, setRows] = useState<DashboardTransactionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Load active channels once for the filter dropdown.
  useEffect(() => {
    getChannels()
      .then(setChannels)
      .catch(() => {/* non-fatal */});
  }, []);

  const filterArgs = useMemo(
    () => ({
      from: range[0].toISOString(),
      to: range[1].toISOString(),
      channelId: channelId === "all" ? null : channelId,
    }),
    [range, channelId]
  );

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getDashboardTransactions({ ...filterArgs, page, pageSize })
      .then((r) => {
        if (!mounted) return;
        setRows(r.data || []);
        setTotal(r.totalCount || 0);
      })
      .catch(() => mounted && message.error("Failed to load transactions"))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [filterArgs, page, pageSize]);

  async function handleExport() {
    setExporting(true);
    try {
      const blob = await exportDashboardTransactionsXlsx(filterArgs);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const fromTag = range[0].format("YYYYMMDD");
      const toTag = range[1].format("YYYYMMDD");
      a.href = url;
      a.download = `transactions_${fromTag}_${toTag}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      message.success("Export ready");
    } catch {
      message.error("Export failed");
    } finally {
      setExporting(false);
    }
  }

  const columns: ColumnsType<DashboardTransactionRow> = [
    { title: "ID", dataIndex: "id", key: "id", width: 80 },
    {
      title: "Created",
      dataIndex: "createdOn",
      key: "createdOn",
      width: 160,
      render: (s: string) => dayjs(s).format("YYYY-MM-DD HH:mm"),
    },
    { title: "By", dataIndex: "createdBy", key: "createdBy", width: 140, ellipsis: true },
    {
      title: "Channel",
      dataIndex: "channelName",
      key: "channelName",
      width: 140,
      render: (v: string | null) =>
        v ? <Tag color="blue">{v}</Tag> : <Tag>Direct</Tag>,
    },
    { title: "Items", dataIndex: "itemsCount", key: "itemsCount", width: 80, align: "right" },
    {
      title: "Total",
      dataIndex: "totalPrice",
      key: "totalPrice",
      width: 120,
      align: "right",
      render: (n: number) => <strong>{fmtMoney(n)}</strong>,
    },
    {
      title: "Comment",
      dataIndex: "comment",
      key: "comment",
      ellipsis: true,
      render: (s: string | null) => s || "-",
    },
  ];

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h3 className="text-base font-semibold">Transactions</h3>
        <Space wrap>
          <RangePicker
            value={range}
            onChange={(v) => {
              if (v && v[0] && v[1]) {
                setRange([v[0], v[1]]);
                setPage(1);
              }
            }}
            presets={[
              { label: "Today", value: [dayjs().startOf("day"), dayjs().endOf("day")] },
              { label: "This Month", value: [dayjs().startOf("month"), dayjs().endOf("day")] },
              { label: "Last 30 Days", value: [dayjs().subtract(30, "day").startOf("day"), dayjs().endOf("day")] },
              { label: "This Year", value: [dayjs().startOf("year"), dayjs().endOf("day")] },
            ]}
            allowClear={false}
          />
          <Select
            value={channelId}
            onChange={(v) => {
              setChannelId(v);
              setPage(1);
            }}
            style={{ minWidth: 180 }}
            options={[
              { value: "all", label: "All channels" },
              { value: "direct", label: "Direct only", disabled: true },
              ...channels.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
          <Tooltip title="Reload">
            <Button icon={<ReloadOutlined />} onClick={() => setPage((p) => p)} />
          </Tooltip>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            loading={exporting}
            onClick={handleExport}
          >
            Export Excel
          </Button>
        </Space>
      </div>

      <Table<DashboardTransactionRow>
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
          pageSizeOptions: [10, 20, 50, 100],
          onChange: (p, s) => {
            setPage(p);
            setPageSize(s);
          },
          showTotal: (t) => `${t} transactions`,
        }}
        scroll={{ x: 900 }}
      />
    </div>
  );
}
