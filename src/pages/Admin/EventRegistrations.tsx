// Admin panel for public event sign-ups.
// Route: /admin/event-registrations  (admin only)
//
// Stripe and Whish auto-confirm via callback, so most rows land here
// already Paid. Cash rows arrive Pending and the admin confirms them
// once the player pays at the store.

import { useCallback, useEffect, useState } from "react";
import {
  Card, Table, Tag, Button, Space, Input, Select, Statistic,
  message, Modal, Typography, Row, Col,
} from "antd";
import {
  CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined,
  SearchOutlined, DownloadOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import {
  listRegistrations, getRegistrationStats,
  confirmRegistrationPayment, rejectRegistrationPayment,
  EventRegistration, EventRegistrationStats,
} from "../../services/eventService";

const { Text, Title } = Typography;
const EVENT_KEY = "squid-game-x-axis";

const money = (n: number, c = "USD") =>
  `${c === "USD" ? "$" : ""}${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const statusColor = (s: string) =>
  s === "Paid" ? "green" : s === "Pending" ? "orange" : s === "Rejected" ? "red" : "default";

const methodIcon = (m: string) =>
  m === "Visa" ? "💳" : m === "Whish" ? "📲" : "💵";

export default function EventRegistrations() {
  const [rows, setRows] = useState<EventRegistration[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<EventRegistrationStats | null>(null);
  const [loading, setLoading] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [status, setStatus] = useState<string | undefined>();
  const [method, setMethod] = useState<string | undefined>();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, s] = await Promise.all([
        listRegistrations({
          eventKey: EVENT_KEY, paymentStatus: status, paymentMethod: method,
          search: debounced || undefined, page, pageSize,
        }),
        getRegistrationStats(EVENT_KEY),
      ]);
      setRows(list.data ?? []);
      setTotal(list.totalCount ?? 0);
      setStats(s);
    } catch {
      message.error("Failed to load registrations");
    } finally { setLoading(false); }
  }, [status, method, debounced, page, pageSize]);

  useEffect(() => { load(); }, [load]);

  const confirm = (r: EventRegistration) => {
    Modal.confirm({
      title: `Confirm payment for ${r.firstName} ${r.lastName}?`,
      content: (
        <div>
          <p>Marks this registration as <b>Paid</b> ({money(r.amount, r.currency)} via {r.paymentMethod}).</p>
          <p style={{ color: "#6B7280", fontSize: 12 }}>
            Only do this once you've actually received the money.
          </p>
        </div>
      ),
      okText: "Confirm Paid",
      onOk: async () => {
        try { await confirmRegistrationPayment(r.id); message.success("Marked as paid"); load(); }
        catch { message.error("Failed to confirm"); }
      },
    });
  };

  const reject = (r: EventRegistration) => {
    Modal.confirm({
      title: `Reject payment for ${r.firstName} ${r.lastName}?`,
      content: "Use this when the payment never arrived or was invalid. The spot is released.",
      okText: "Reject", okButtonProps: { danger: true },
      onOk: async () => {
        try { await rejectRegistrationPayment(r.id); message.success("Marked as rejected"); load(); }
        catch { message.error("Failed to reject"); }
      },
    });
  };

  const exportCsv = () => {
    const head = ["Id","First Name","Last Name","Phone","Email","Method","Status","Amount","Currency","Registered","Confirmed By","Confirmed On"];
    const body = rows.map(r => [
      r.id, r.firstName, r.lastName, r.phone, r.email ?? "",
      r.paymentMethod, r.paymentStatus, r.amount, r.currency,
      new Date(r.createdOn).toLocaleString(),
      r.confirmedBy ?? "", r.confirmedOn ? new Date(r.confirmedOn).toLocaleString() : "",
    ]);
    const csv = [head, ...body]
      .map(line => line.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url; a.download = `squid-game-registrations-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const columns: ColumnsType<EventRegistration> = [
    { title: "#", dataIndex: "id", width: 70, render: (v) => <Text code>{v}</Text> },
    {
      title: "Player", key: "player",
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.firstName} {r.lastName}</div>
          <div style={{ fontSize: 12, color: "#6B7280" }}>{r.phone}</div>
          {r.email && <div style={{ fontSize: 11, color: "#9CA3AF" }}>{r.email}</div>}
        </div>
      ),
    },
    {
      title: "Method", dataIndex: "paymentMethod", width: 130,
      render: (m: string) => <span>{methodIcon(m)} {m}</span>,
    },
    {
      title: "Amount", key: "amount", width: 110, align: "right",
      render: (_, r) => <Text strong>{money(r.amount, r.currency)}</Text>,
    },
    {
      title: "Status", dataIndex: "paymentStatus", width: 120,
      render: (s: string) => <Tag color={statusColor(s)}>{s}</Tag>,
    },
    {
      title: "Registered", dataIndex: "createdOn", width: 160,
      render: (v: string) => (
        <span style={{ fontSize: 12 }}>
          {new Date(v).toLocaleString("en-GB", {
            day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
          })}
        </span>
      ),
    },
    {
      title: "Confirmed", key: "confirmed", width: 150,
      render: (_, r) => r.confirmedBy ? (
        <div style={{ fontSize: 11, color: "#6B7280" }}>
          <div>{r.confirmedBy === "gateway" ? "🤖 auto" : r.confirmedBy}</div>
          {r.confirmedOn && <div>{new Date(r.confirmedOn).toLocaleDateString()}</div>}
        </div>
      ) : <Text type="secondary">—</Text>,
    },
    {
      title: "Actions", key: "actions", width: 190, fixed: "right",
      render: (_, r) => (
        <Space>
          {r.paymentStatus !== "Paid" && (
            <Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={() => confirm(r)}>
              Paid
            </Button>
          )}
          {r.paymentStatus !== "Rejected" && (
            <Button size="small" danger icon={<CloseCircleOutlined />} onClick={() => reject(r)} />
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6">
      <Title level={3} style={{ marginBottom: 4 }}>🦑 Squid Game X AXIS — Registrations</Title>
      <Text type="secondary">
        Card and Whish payments confirm automatically. Cash registrations need manual confirmation once the player pays at the store.
      </Text>

      {/* Stats */}
      <Row gutter={12} style={{ marginTop: 20, marginBottom: 16 }}>
        <Col xs={12} md={4}><Card size="small"><Statistic title="Total" value={stats?.total ?? 0} /></Card></Col>
        <Col xs={12} md={4}><Card size="small"><Statistic title="Paid" value={stats?.paid ?? 0} valueStyle={{ color: "#16A34A" }} /></Card></Col>
        <Col xs={12} md={4}><Card size="small"><Statistic title="Pending" value={stats?.pending ?? 0} valueStyle={{ color: "#D97706" }} /></Card></Col>
        <Col xs={12} md={4}><Card size="small"><Statistic title="Rejected" value={stats?.rejected ?? 0} valueStyle={{ color: "#DC2626" }} /></Card></Col>
        <Col xs={12} md={4}><Card size="small"><Statistic title="Collected" value={stats?.collectedAmount ?? 0} prefix="$" precision={2} valueStyle={{ color: "#16A34A" }} /></Card></Col>
        <Col xs={12} md={4}><Card size="small"><Statistic title="Outstanding" value={stats?.pendingAmount ?? 0} prefix="$" precision={2} valueStyle={{ color: "#D97706" }} /></Card></Col>
      </Row>

      <Card size="small">
        <Space wrap style={{ marginBottom: 14, width: "100%", justifyContent: "space-between" }}>
          <Space wrap>
            <Input
              placeholder="Search name, phone, email…"
              prefix={<SearchOutlined />}
              value={search} onChange={(e) => setSearch(e.target.value)}
              allowClear style={{ width: 260 }}
            />
            <Select
              placeholder="All statuses" allowClear style={{ width: 150 }}
              value={status} onChange={(v) => { setStatus(v); setPage(1); }}
              options={[
                { value: "Pending", label: "Pending" },
                { value: "Paid", label: "Paid" },
                { value: "Rejected", label: "Rejected" },
              ]}
            />
            <Select
              placeholder="All methods" allowClear style={{ width: 150 }}
              value={method} onChange={(v) => { setMethod(v); setPage(1); }}
              options={[
                { value: "Visa", label: "💳 Visa" },
                { value: "Whish", label: "📲 Whish" },
                { value: "Cash", label: "💵 Cash" },
              ]}
            />
          </Space>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Refresh</Button>
            <Button icon={<DownloadOutlined />} onClick={exportCsv} disabled={rows.length === 0}>Export CSV</Button>
          </Space>
        </Space>

        <Table
          size="small" rowKey="id" loading={loading}
          columns={columns} dataSource={rows}
          scroll={{ x: 1000 }}
          pagination={{
            current: page, pageSize, total,
            showSizeChanger: true, pageSizeOptions: [25, 50, 100],
            onChange: (p, s) => { setPage(p); setPageSize(s); },
            showTotal: (t) => `${t} registration(s)`,
          }}
        />
      </Card>
    </div>
  );
}
