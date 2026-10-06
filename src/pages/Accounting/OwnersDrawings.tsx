// Owners' Drawings
// ================
// Cash the owners take out of the business for personal use. A drawing is
// NOT an expense — it reduces owners' equity and never touches profit.
//
// Chart of accounts (created by the API on first use, fully dynamic):
//   3300 Owners' Drawings            header, sums every owner
//     3310 Drawings – <owner>        one Equity sub-account per owner
// Each drawing posts DR owner's drawings account / CR 1000 Cash on Hand.
//
// The summary is read from the ledger, so a drawing booked any other way
// (an entry category mapped to the owner's account, a manual journal entry)
// also lands on the right owner.
//
// Per owner: what they drew, their share of all drawings, their ownership %,
// the fair share (total drawings × ownership %) and how far over/under it
// they are.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Progress,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  StopOutlined,
  InfoCircleOutlined,
  WalletOutlined,
  TeamOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import dayjs, { Dayjs } from "dayjs";
import { Link } from "react-router";
import {
  getOwners,
  createOwner,
  updateOwner,
  deactivateOwner,
  queryOwnerDrawings,
  createOwnerDrawing,
  updateOwnerDrawing,
  voidOwnerDrawing,
  getOwnerDrawingsSummary,
  OwnerDto,
  OwnerDrawingDto,
  OwnerDrawingsLineDto,
  OwnerDrawingsSummaryDto,
} from "../../services/ownerService";
import { getPostableAccounts, AccountDto } from "../../services/expenseService";
import OwnerDrawingDetailModal from "../../components/Accounting/OwnerDrawingDetailModal";

const { RangePicker } = DatePicker;
const { Text, Paragraph } = Typography;

const money = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n: number) => `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
const ymd = (d: Dayjs) => d.format("YYYY-MM-DD");

const PAYMENT_METHODS = ["Cash", "Bank transfer", "Cheque", "Whish", "OMT", "Other"];

const errMsg = (e: unknown, fallback: string) =>
  e && typeof e === "object" && typeof (e as { message?: unknown }).message === "string"
    ? (e as { message: string }).message
    : fallback;

type OwnerForm = { name: string; ownershipPercent: number; notes?: string; isActive: boolean; existingAccountId?: number | null };
type DrawingForm = { ownerId: number; amount: number; drawingDate: Dayjs; paymentMethod?: string; comment?: string };

export default function OwnersDrawings() {
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf("year"), dayjs().endOf("day")]);
  const [summary, setSummary] = useState<OwnerDrawingsSummaryDto | null>(null);
  const [owners, setOwners] = useState<OwnerDto[]>([]);
  const [showHiddenOwners, setShowHiddenOwners] = useState(false);
  const [loading, setLoading] = useState(false);

  // Drawings register
  const [drawings, setDrawings] = useState<OwnerDrawingDto[]>([]);
  const [drawingsTotal, setDrawingsTotal] = useState(0);
  const [drawingsCount, setDrawingsCount] = useState(0);
  const [drawingsPage, setDrawingsPage] = useState(1);
  const [ownerFilter, setOwnerFilter] = useState<number | null>(null);
  const [showVoided, setShowVoided] = useState(false);
  const [drawingsLoading, setDrawingsLoading] = useState(false);
  const pageSize = 20;

  // Modals
  const [ownerModal, setOwnerModal] = useState<{ open: boolean; editing: OwnerDto | null; init?: Partial<OwnerForm> }>({ open: false, editing: null });
  const [drawingModal, setDrawingModal] = useState<{ open: boolean; editing: OwnerDrawingDto | null; init?: Partial<DrawingForm> }>({ open: false, editing: null });
  const [voidTarget, setVoidTarget] = useState<OwnerDrawingDto | null>(null);
  // Row of "Drawings by owner" whose detail popup is open.
  const [detailRow, setDetailRow] = useState<OwnerDrawingsLineDto | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [equityAccounts, setEquityAccounts] = useState<AccountDto[]>([]);
  const [ownerForm] = Form.useForm<OwnerForm>();
  const [drawingForm] = Form.useForm<DrawingForm>();

  const fromStr = ymd(range[0]);
  const toStr = ymd(range[1]);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      const [s, o] = await Promise.all([getOwnerDrawingsSummary(fromStr, toStr), getOwners(showHiddenOwners)]);
      setSummary(s);
      setOwners(o);
    } catch (e) {
      message.error(errMsg(e, "Failed to load owners' drawings"));
    } finally {
      setLoading(false);
    }
  }, [fromStr, toStr, showHiddenOwners]);

  const loadDrawings = useCallback(async () => {
    setDrawingsLoading(true);
    try {
      const r = await queryOwnerDrawings({
        from: fromStr, to: toStr, ownerId: ownerFilter, includeVoided: showVoided, page: drawingsPage, pageSize,
      });
      setDrawings(r.items);
      setDrawingsTotal(r.totalAmountAll);
      setDrawingsCount(r.totalCount);
    } catch (e) {
      message.error(errMsg(e, "Failed to load drawings"));
    } finally {
      setDrawingsLoading(false);
    }
  }, [fromStr, toStr, ownerFilter, showVoided, drawingsPage]);

  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { loadDrawings(); }, [loadDrawings]);
  useEffect(() => { setDrawingsPage(1); }, [fromStr, toStr, ownerFilter, showVoided]);

  const reloadAll = () => { loadSummary(); loadDrawings(); };
  const activeOwners = useMemo(() => owners.filter((o) => o.isActive), [owners]);
  const totalPct = summary?.totalOwnershipPercent ?? 0;

  // ── Owner modal ─────────────────────────────────────────────────────
  const openOwnerModal = async (editing: OwnerDto | null) => {
    setOwnerModal({
      open: true,
      editing,
      init: editing
        ? { name: editing.name, ownershipPercent: editing.ownershipPercent, notes: editing.notes ?? "", isActive: editing.isActive }
        : { name: "", notes: "", isActive: true, existingAccountId: null },
    });
    if (!editing) {
      try {
        const all = await getPostableAccounts();
        const linked = new Set(owners.map((o) => o.drawingsAccountId));
        setEquityAccounts(all.filter((a) => a.accountTypeName === "Equity" && !linked.has(a.id)));
      } catch {
        setEquityAccounts([]);
      }
    }
  };

  const saveOwner = async () => {
    const v = await ownerForm.validateFields();
    setSaving(true);
    try {
      if (ownerModal.editing) {
        await updateOwner(ownerModal.editing.id, {
          name: v.name, ownershipPercent: v.ownershipPercent, notes: v.notes || null, isActive: v.isActive,
        });
        message.success("Owner updated");
      } else {
        const created = await createOwner({
          name: v.name, ownershipPercent: v.ownershipPercent, notes: v.notes || null, existingAccountId: v.existingAccountId ?? null,
        });
        message.success(`Owner added — drawings account ${created.drawingsAccountNumber}`);
      }
      setOwnerModal({ open: false, editing: null });
      reloadAll();
    } catch (e) {
      message.error(errMsg(e, "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  const hideOwner = (o: OwnerDto) => {
    Modal.confirm({
      title: `Hide ${o.name}?`,
      content: "The owner stops counting toward the 100% and can no longer take new drawings. Their drawings account and history stay intact; you can restore them from \"Show hidden\".",
      okText: "Hide",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deactivateOwner(o.id);
          message.success(`${o.name} hidden`);
          reloadAll();
        } catch (e) {
          message.error(errMsg(e, "Hide failed"));
        }
      },
    });
  };

  // ── Drawing modal ───────────────────────────────────────────────────
  const openDrawingModal = (editing: OwnerDrawingDto | null, ownerId?: number) => {
    setDrawingModal({
      open: true,
      editing,
      init: editing
        ? {
            ownerId: editing.ownerId, amount: editing.amount, drawingDate: dayjs(editing.drawingDate),
            paymentMethod: editing.paymentMethod ?? undefined, comment: editing.comment ?? "",
          }
        : { ownerId: ownerId ?? (activeOwners.length === 1 ? activeOwners[0].id : undefined), drawingDate: dayjs(), paymentMethod: "Cash", comment: "" },
    });
  };

  const saveDrawing = async () => {
    const v = await drawingForm.validateFields();
    const dto = {
      ownerId: v.ownerId, amount: v.amount, drawingDate: ymd(v.drawingDate),
      paymentMethod: v.paymentMethod || null, comment: v.comment || null,
    };
    setSaving(true);
    try {
      if (drawingModal.editing) {
        await updateOwnerDrawing(drawingModal.editing.id, dto);
        message.success("Drawing updated — the old journal entry was voided and a new one posted");
      } else {
        const d = await createOwnerDrawing(dto);
        message.success(`Drawing recorded (${d.journalEntryNumber ?? "posted"})`);
      }
      setDrawingModal({ open: false, editing: null });
      reloadAll();
    } catch (e) {
      message.error(errMsg(e, "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  const confirmVoid = async () => {
    if (!voidTarget) return;
    setSaving(true);
    try {
      await voidOwnerDrawing(voidTarget.id, voidReason || null);
      message.success("Drawing cancelled — its journal entry was voided");
      setVoidTarget(null);
      setVoidReason("");
      reloadAll();
    } catch (e) {
      message.error(errMsg(e, "Cancel failed"));
    } finally {
      setSaving(false);
    }
  };

  // ── Summary table ───────────────────────────────────────────────────
  const summaryRows: (OwnerDrawingsLineDto & { key: string; other?: boolean })[] = useMemo(() => [
    ...(summary?.owners ?? []).map((o) => ({ ...o, key: `o-${o.accountId}` })),
    ...(summary?.otherAccounts ?? []).map((o) => ({ ...o, key: `x-${o.accountId}`, other: true })),
  ], [summary]);

  const summaryColumns: ColumnsType<OwnerDrawingsLineDto & { key: string; other?: boolean }> = [
    {
      title: "Owner",
      key: "name",
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Space size={6}>
            <Typography.Link strong onClick={() => setDetailRow(r)}>{r.name}</Typography.Link>
            {r.other && <Tag color="orange">no owner linked</Tag>}
            {r.ownerId && !r.isActive && <Tag>hidden</Tag>}
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>{r.accountNumber} · {r.accountName}</Text>
        </Space>
      ),
    },
    {
      title: "Ownership",
      dataIndex: "ownershipPercent",
      align: "right",
      width: 100,
      render: (v: number, r) => (r.ownerId ? pct(v) : "—"),
    },
    {
      title: "Drawn (period)",
      dataIndex: "drawn",
      align: "right",
      width: 140,
      render: (v: number) => <Text strong>{money(v)}</Text>,
    },
    {
      title: (
        <Tooltip title="This owner's drawings ÷ total drawings of all owners in the period. The grey marker is their ownership %.">
          Share of drawings <InfoCircleOutlined />
        </Tooltip>
      ),
      key: "share",
      width: 220,
      render: (_, r) => (
        <div style={{ position: "relative" }}>
          <Progress
            percent={Math.max(0, Math.min(100, r.shareOfDrawingsPercent))}
            showInfo={false}
            size="small"
            strokeColor={r.ownerId && r.shareOfDrawingsPercent > r.ownershipPercent + 0.005 ? "#dc2626" : "#7c3aed"}
          />
          {r.ownerId ? (
            <div
              title={`Ownership ${pct(r.ownershipPercent)}`}
              style={{ position: "absolute", top: 2, left: `${Math.min(100, r.ownershipPercent)}%`, width: 2, height: 12, background: "#475569" }}
            />
          ) : null}
          <Text style={{ fontSize: 12 }}>
            {pct(r.shareOfDrawingsPercent)}
            {r.ownerId ? <Text type="secondary" style={{ fontSize: 12 }}> · owns {pct(r.ownershipPercent)}</Text> : null}
          </Text>
        </div>
      ),
    },
    {
      title: (
        <Tooltip title="Fair share = total drawings in the period × ownership %. What this owner would have drawn if drawings followed ownership.">
          Fair share <InfoCircleOutlined />
        </Tooltip>
      ),
      dataIndex: "entitledAmount",
      align: "right",
      width: 130,
      render: (v: number, r) => (r.ownerId ? money(v) : "—"),
    },
    {
      title: (
        <Tooltip title="Drawn − fair share. Positive = drew more than their ownership share; negative = drew less.">
          Over / (under) <InfoCircleOutlined />
        </Tooltip>
      ),
      dataIndex: "variance",
      align: "right",
      width: 130,
      render: (v: number, r) =>
        r.ownerId ? (
          <Text type={v > 0.004 ? "danger" : v < -0.004 ? "success" : undefined}>
            {v < 0 ? `(${money(-v)})` : money(v)}
          </Text>
        ) : "—",
    },
    { title: "Entries", dataIndex: "entryCount", align: "right", width: 80 },
    {
      title: "Lifetime",
      dataIndex: "lifetimeDrawn",
      align: "right",
      width: 130,
      render: (v: number) => <Text type="secondary">{money(v)}</Text>,
    },
    {
      title: "",
      key: "act",
      width: 190,
      render: (_, r) => (
        <Space size={6}>
          <Button size="small" icon={<EyeOutlined />} onClick={() => setDetailRow(r)}>
            Details
          </Button>
          {r.ownerId && r.isActive ? (
            <Button size="small" icon={<PlusOutlined />} onClick={() => openDrawingModal(null, r.ownerId!)}>
              Drawing
            </Button>
          ) : null}
        </Space>
      ),
    },
  ];

  // ── Owners table ────────────────────────────────────────────────────
  const ownerColumns: ColumnsType<OwnerDto> = [
    {
      title: "Owner",
      dataIndex: "name",
      render: (v: string, r) => (
        <Space>
          <Text strong>{v}</Text>
          {!r.isActive && <Tag>hidden</Tag>}
        </Space>
      ),
    },
    { title: "Ownership", dataIndex: "ownershipPercent", align: "right", width: 110, render: (v: number) => pct(v) },
    {
      title: "Drawings account",
      key: "acc",
      render: (_, r) => <Text>{r.drawingsAccountNumber} · {r.drawingsAccountName}</Text>,
    },
    { title: "Notes", dataIndex: "notes", render: (v: string | null) => v || <Text type="secondary">—</Text> },
    {
      title: "",
      key: "act",
      width: 150,
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openOwnerModal(r)}>Edit</Button>
          {r.isActive && <Button size="small" danger onClick={() => hideOwner(r)}>Hide</Button>}
        </Space>
      ),
    },
  ];

  // ── Drawings table ──────────────────────────────────────────────────
  const drawingColumns: ColumnsType<OwnerDrawingDto> = [
    {
      title: "Date",
      dataIndex: "drawingDate",
      width: 120,
      render: (v: string) => dayjs(v).format("MMM DD, YYYY"),
    },
    { title: "Owner", dataIndex: "ownerName" },
    {
      title: "Amount",
      dataIndex: "amount",
      align: "right",
      width: 130,
      render: (v: number, r) => (r.isVoided ? <Text delete type="secondary">{money(v)}</Text> : <Text strong>{money(v)}</Text>),
    },
    { title: "Method", dataIndex: "paymentMethod", width: 120, render: (v: string | null) => v || "—" },
    { title: "Comment", dataIndex: "comment", render: (v: string | null) => v || <Text type="secondary">—</Text> },
    {
      title: "Journal entry",
      dataIndex: "journalEntryNumber",
      width: 140,
      render: (v: string | null) => (v ? <Tag>{v}</Tag> : <Text type="secondary">—</Text>),
    },
    {
      title: "Status",
      key: "status",
      width: 110,
      render: (_, r) =>
        r.isVoided ? (
          <Tooltip title={r.voidReason ?? undefined}><Tag color="red">Cancelled</Tag></Tooltip>
        ) : (
          <Tag color="green">Posted</Tag>
        ),
    },
    {
      title: "",
      key: "act",
      width: 170,
      render: (_, r) =>
        r.isVoided ? null : (
          <Space>
            <Button size="small" icon={<EditOutlined />} onClick={() => openDrawingModal(r)}>Edit</Button>
            <Button size="small" danger icon={<StopOutlined />} onClick={() => { setVoidTarget(r); setVoidReason(""); }}>
              Cancel
            </Button>
          </Space>
        ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        {/* Header */}
        <Card>
          <Space style={{ width: "100%", justifyContent: "space-between" }} wrap>
            <Space direction="vertical" size={0}>
              <Space>
                <WalletOutlined style={{ fontSize: 22, color: "#7c3aed" }} />
                <span style={{ fontSize: 22, fontWeight: 700 }}>Owners' Drawings</span>
                <Tag color="purple">Equity · not an expense</Tag>
              </Space>
              <Text type="secondary">
                Cash the owners take out for personal use. Each drawing posts DR the owner's drawings account / CR 1000 Cash.
                It reduces equity and Cash on Hand, never Net Income.
              </Text>
            </Space>
            <Space wrap>
              <RangePicker
                value={range}
                allowClear={false}
                onChange={(v) => { if (v && v[0] && v[1]) setRange([v[0], v[1]]); }}
                presets={[
                  { label: "This Month", value: [dayjs().startOf("month"), dayjs().endOf("day")] },
                  { label: "Last Month", value: [dayjs().subtract(1, "month").startOf("month"), dayjs().subtract(1, "month").endOf("month")] },
                  { label: "This Quarter", value: [dayjs().startOf("month").subtract(dayjs().month() % 3, "month"), dayjs().endOf("day")] },
                  { label: "This Year", value: [dayjs().startOf("year"), dayjs().endOf("day")] },
                  { label: "Last Year", value: [dayjs().subtract(1, "year").startOf("year"), dayjs().subtract(1, "year").endOf("year")] },
                ]}
              />
              <Button icon={<ReloadOutlined />} onClick={reloadAll} loading={loading}>Refresh</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => openDrawingModal(null)} disabled={activeOwners.length === 0}>
                Record drawing
              </Button>
            </Space>
          </Space>
        </Card>

        {/* Setup / data-quality notices */}
        {summary && activeOwners.length === 0 && (
          <Alert
            type="info"
            showIcon
            message="No owners yet"
            description={'Add each owner with their ownership %. The first one creates the "Owners\' Drawings" header account, and every owner gets their own drawings sub-account under it.'}
            action={<Button type="primary" icon={<PlusOutlined />} onClick={() => openOwnerModal(null)}>Add owner</Button>}
          />
        )}
        {summary && activeOwners.length > 0 && Math.abs(totalPct - 100) > 0.004 && (
          <Alert
            type="warning"
            showIcon
            message={`Active owners add up to ${pct(totalPct)}, not 100%`}
            description="Fair shares are calculated from each owner's %. Edit the owners so the total is exactly 100%."
          />
        )}
        {summary && summary.unlinkedEquityCategories.length > 0 && (
          <Alert
            type="warning"
            showIcon
            message="Some entry categories post to Equity outside Owners' Drawings"
            description={
              <div>
                <Paragraph style={{ marginBottom: 6 }}>
                  These look like the old "cash out" workaround. Their entries are already kept out of expenses, but they
                  are not counted under any owner here. Open{" "}
                  <Link to="/admin/expense-categories">Entries Management → Categories</Link> and map each one to the
                  matching owner's drawings account; its history is re-posted there automatically.
                </Paragraph>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {summary.unlinkedEquityCategories.map((c) => (
                    <li key={c.categoryId}>
                      <Text strong>{c.categoryName}</Text> → {c.accountNumber} {c.accountName} · {c.entryCount} entries · {money(c.totalAmount)}
                    </li>
                  ))}
                </ul>
              </div>
            }
          />
        )}

        {/* Stats */}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title={`Total drawings · ${summary?.headerAccountNumber || "—"} ${summary?.headerAccountName ?? ""}`}
                value={summary?.totalDrawings ?? 0}
                precision={2}
                prefix="$"
                loading={loading}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>{range[0].format("MMM D, YYYY")} – {range[1].format("MMM D, YYYY")}</Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic title="Lifetime drawings" value={summary?.lifetimeTotalDrawings ?? 0} precision={2} prefix="$" loading={loading} />
              <Text type="secondary" style={{ fontSize: 12 }}>all time, all owners</Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Total ownership"
                value={totalPct}
                precision={2}
                suffix="%"
                loading={loading}
                valueStyle={{ color: Math.abs(totalPct - 100) > 0.004 ? "#d97706" : "#16a34a" }}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>active owners</Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic title="Owners" value={activeOwners.length} prefix={<TeamOutlined />} loading={loading} />
              <Text type="secondary" style={{ fontSize: 12 }}>each with their own drawings account</Text>
            </Card>
          </Col>
        </Row>

        {/* Per-owner summary */}
        <Card title="Drawings by owner" extra={<Text type="secondary">from the general ledger</Text>}>
          <Table
            rowKey="key"
            size="middle"
            loading={loading}
            columns={summaryColumns}
            dataSource={summaryRows}
            pagination={false}
            scroll={{ x: 1180 }}
            locale={{ emptyText: <Empty description="No owners yet" /> }}
            summary={() =>
              summary && summaryRows.length > 0 ? (
                <Table.Summary.Row style={{ background: "#faf5ff" }}>
                  <Table.Summary.Cell index={0}>
                    <Text strong>{summary.headerAccountNumber} · {summary.headerAccountName}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right"><Text strong>{pct(totalPct)}</Text></Table.Summary.Cell>
                  <Table.Summary.Cell index={2} align="right"><Text strong>{money(summary.totalDrawings)}</Text></Table.Summary.Cell>
                  <Table.Summary.Cell index={3}><Text strong>{summary.totalDrawings !== 0 ? "100%" : "—"}</Text></Table.Summary.Cell>
                  <Table.Summary.Cell index={4} align="right">
                    <Text strong>{money(summaryRows.filter((r) => r.ownerId).reduce((a, r) => a + r.entitledAmount, 0))}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={5} />
                  <Table.Summary.Cell index={6} align="right">
                    <Text strong>{summaryRows.reduce((a, r) => a + r.entryCount, 0)}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={7} align="right"><Text strong>{money(summary.lifetimeTotalDrawings)}</Text></Table.Summary.Cell>
                  <Table.Summary.Cell index={8} />
                </Table.Summary.Row>
              ) : null
            }
          />
        </Card>

        {/* Owners */}
        <Card
          title="Owners & ownership"
          extra={
            <Space>
              <Space size={6}>
                <Switch size="small" checked={showHiddenOwners} onChange={setShowHiddenOwners} />
                <Text type="secondary">Show hidden</Text>
              </Space>
              <Button icon={<PlusOutlined />} onClick={() => openOwnerModal(null)}>Add owner</Button>
            </Space>
          }
        >
          <Table rowKey="id" size="small" loading={loading} columns={ownerColumns} dataSource={owners} pagination={false} scroll={{ x: 800 }} />
        </Card>

        {/* Drawings register */}
        <Card
          title="Drawings register"
          extra={
            <Space wrap>
              <Select
                allowClear
                placeholder="All owners"
                style={{ minWidth: 180 }}
                value={ownerFilter ?? undefined}
                onChange={(v) => setOwnerFilter(v ?? null)}
                options={owners.map((o) => ({ value: o.id, label: o.name }))}
              />
              <Space size={6}>
                <Switch size="small" checked={showVoided} onChange={setShowVoided} />
                <Text type="secondary">Show cancelled</Text>
              </Space>
            </Space>
          }
        >
          <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
            {drawingsCount} entr{drawingsCount === 1 ? "y" : "ies"} · total {money(drawingsTotal)} recorded on this page in the period
          </Text>
          <Table
            rowKey="id"
            size="small"
            loading={drawingsLoading}
            columns={drawingColumns}
            dataSource={drawings}
            scroll={{ x: 1000 }}
            pagination={{
              current: drawingsPage,
              pageSize,
              total: drawingsCount,
              onChange: setDrawingsPage,
              showSizeChanger: false,
            }}
          />
        </Card>
      </Space>

      {/* Drawings behind one row + how its numbers are calculated */}
      <OwnerDrawingDetailModal
        row={detailRow}
        totalDrawings={summary?.totalDrawings ?? 0}
        headerLabel={summary ? `${summary.headerAccountNumber} ${summary.headerAccountName}` : "Owners' Drawings"}
        from={fromStr}
        to={toStr}
        onClose={() => setDetailRow(null)}
      />

      {/* Owner modal */}
      <Modal
        open={ownerModal.open}
        title={ownerModal.editing ? `Edit owner — ${ownerModal.editing.name}` : "Add owner"}
        onCancel={() => setOwnerModal({ open: false, editing: null })}
        onOk={saveOwner}
        okText={ownerModal.editing ? "Save" : "Add owner"}
        confirmLoading={saving}
        destroyOnHidden
      >
        <Form form={ownerForm} layout="vertical" preserve={false} initialValues={ownerModal.init}>
          <Form.Item name="name" label="Name" rules={[{ required: true, message: "Name is required" }]}>
            <Input placeholder="Ahmad Houhou" maxLength={150} />
          </Form.Item>
          <Form.Item
            name="ownershipPercent"
            label="Ownership %"
            extra={`Other active owners hold ${pct(
              owners.filter((o) => o.isActive && o.id !== ownerModal.editing?.id).reduce((a, o) => a + o.ownershipPercent, 0)
            )}. The total cannot exceed 100%.`}
            rules={[{ required: true, message: "Ownership % is required" }]}
          >
            <InputNumber min={0.01} max={100} step={0.5} precision={2} addonAfter="%" style={{ width: "100%" }} />
          </Form.Item>
          {!ownerModal.editing && (
            <Form.Item
              name="existingAccountId"
              label="Drawings account"
              extra="Leave on “Create new” to open a fresh sub-account under Owners' Drawings. Pick an existing Equity account only if this owner already has one; it will be moved under the header."
            >
              <Select
                allowClear
                placeholder="Create new (recommended)"
                options={equityAccounts.map((a) => ({ value: a.id, label: `${a.accountNumber} · ${a.accountName}` }))}
              />
            </Form.Item>
          )}
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} maxLength={500} />
          </Form.Item>
          {ownerModal.editing && (
            <Form.Item name="isActive" label="Active" valuePropName="checked">
              <Switch />
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* Drawing modal */}
      <Modal
        open={drawingModal.open}
        title={drawingModal.editing ? "Edit drawing" : "Record owner drawing"}
        onCancel={() => setDrawingModal({ open: false, editing: null })}
        onOk={saveDrawing}
        okText={drawingModal.editing ? "Save" : "Record"}
        confirmLoading={saving}
        destroyOnHidden
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Posts DR the owner's drawings account / CR 1000 Cash on Hand. Not an expense."
        />
        <Form form={drawingForm} layout="vertical" preserve={false} initialValues={drawingModal.init}>
          <Form.Item name="ownerId" label="Owner" rules={[{ required: true, message: "Pick the owner" }]}>
            <Select
              placeholder="Who took the cash?"
              options={(drawingModal.editing ? owners : activeOwners).map((o) => ({
                value: o.id,
                label: `${o.name} (${pct(o.ownershipPercent)}) · ${o.drawingsAccountNumber}`,
              }))}
            />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="amount" label="Amount" rules={[{ required: true, message: "Amount is required" }]}>
                <InputNumber min={0.01} step={10} precision={2} prefix="$" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="drawingDate" label="Date" rules={[{ required: true, message: "Date is required" }]}>
                <DatePicker style={{ width: "100%" }} disabledDate={(d) => d.isAfter(dayjs().endOf("day"))} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="paymentMethod" label="Paid by">
            <Select options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))} allowClear />
          </Form.Item>
          <Form.Item name="comment" label="Comment">
            <Input.TextArea rows={2} maxLength={500} placeholder="Optional" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Cancel (void) modal */}
      <Modal
        open={!!voidTarget}
        title="Cancel drawing"
        onCancel={() => setVoidTarget(null)}
        onOk={confirmVoid}
        okText="Cancel drawing"
        okButtonProps={{ danger: true }}
        cancelText="Keep"
        confirmLoading={saving}
        destroyOnHidden
      >
        {voidTarget && (
          <Space direction="vertical" style={{ width: "100%" }}>
            <Text>
              {voidTarget.ownerName} · {money(voidTarget.amount)} on {dayjs(voidTarget.drawingDate).format("MMM DD, YYYY")}
            </Text>
            <Text type="secondary">
              The row stays on file as cancelled and its journal entry {voidTarget.journalEntryNumber ?? ""} is voided, so it no
              longer counts in the ledger or Cash on Hand.
            </Text>
            <Input.TextArea rows={2} maxLength={500} placeholder="Reason (optional)" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} />
          </Space>
        )}
      </Modal>
    </div>
  );
}
