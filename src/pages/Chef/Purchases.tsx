// Purchases
// =========
// Lists past purchases with filter + opens a multi-line "New Purchase"
// form. Each new purchase atomically updates ingredient stock and the
// "Latest cost" (BuyPricePerUnit), and writes a Purchase StockMovement
// row per line.

import { useEffect, useMemo, useState } from "react";
import {
  Card, Table, Tag, Button, Space, Modal, Form, Input, InputNumber, Select,
  DatePicker, message, Typography, Tooltip, Divider, Empty,
} from "antd";
import { PlusOutlined, DeleteOutlined, ReloadOutlined, EyeOutlined, SearchOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs, { Dayjs } from "dayjs";
import {
  PurchaseDto, PurchaseLineInputDto, createPurchase, listPurchases,
} from "../../services/purchaseService";
import { IngredientDto, getIngredients } from "../../services/ingredientService";
import { SupplierDto, getSuppliers } from "../../services/supplierService";

const { RangePicker } = DatePicker;
const { Text } = Typography;

const fmtMoney = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type DraftLine = {
  key: string;
  ingredientId: number | null;
  unit: string;
  quantity: number;
  unitCost: number;
};
let kSeq = 1;
const newKey = () => `pl-${kSeq++}`;

export default function Purchases() {
  const [rows, setRows] = useState<PurchaseDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [supplierFilter, setSupplierFilter] = useState<number | "all">("all");
  const [ingredientFilter, setIngredientFilter] = useState<number | "all">("all");
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(30, "day").startOf("day"),
    dayjs().endOf("day"),
  ]);

  const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);
  const [ingredients, setIngredients] = useState<IngredientDto[]>([]);

  // New purchase modal state
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const [draft, setDraft] = useState<DraftLine[]>([]);
  const [saving, setSaving] = useState(false);

  // Read-only details modal state
  const [detail, setDetail] = useState<PurchaseDto | null>(null);

  useEffect(() => {
    Promise.all([getSuppliers(), getIngredients()])
      .then(([s, i]) => { setSuppliers(s); setIngredients(i); })
      .catch(() => {/* non-fatal */});
  }, []);

  const filterArgs = useMemo(() => ({
    supplierId: supplierFilter === "all" ? null : supplierFilter,
    ingredientId: ingredientFilter === "all" ? null : ingredientFilter,
    from: range[0].toISOString(),
    to: range[1].toISOString(),
  }), [supplierFilter, ingredientFilter, range]);

  async function reload() {
    setLoading(true);
    try {
      const r = await listPurchases({ ...filterArgs, page, pageSize });
      setRows(r.data || []); setTotal(r.totalCount || 0);
    } catch { message.error("Failed to load purchases"); }
    finally { setLoading(false); }
  }

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [filterArgs, page, pageSize]);

  const ingredientById = useMemo(() => new Map(ingredients.map((i) => [i.id, i])), [ingredients]);

  // Text search runs against the currently-loaded page: supplier name,
  // invoice number, notes, and any line ingredient name. The supplier /
  // ingredient / date filters above are still server-side; this is just
  // a quick free-text pass on top.
  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => {
      if ((r.supplierName ?? "").toLowerCase().includes(q)) return true;
      if ((r.invoiceNumber ?? "").toLowerCase().includes(q)) return true;
      if ((r.notes ?? "").toLowerCase().includes(q)) return true;
      if ((r.createdBy ?? "").toLowerCase().includes(q)) return true;
      if (String(r.id).includes(q)) return true;
      return r.lines.some(l => (l.ingredientName ?? "").toLowerCase().includes(q));
    });
  }, [rows, search]);

  function openCreate() {
    form.resetFields();
    form.setFieldsValue({ purchaseDate: dayjs() });
    setDraft([{ key: newKey(), ingredientId: null, unit: "", quantity: 0, unitCost: 0 }]);
    setOpen(true);
  }
  function addDraftRow() { setDraft((d) => [...d, { key: newKey(), ingredientId: null, unit: "", quantity: 0, unitCost: 0 }]); }
  function removeDraftRow(k: string) { setDraft((d) => d.filter((r) => r.key !== k)); }
  function patchDraft(k: string, patch: Partial<DraftLine>) {
    setDraft((d) => d.map((r) => {
      if (r.key !== k) return r;
      const next = { ...r, ...patch };
      if (patch.ingredientId != null) {
        const ing = ingredientById.get(patch.ingredientId);
        next.unit = ing?.unit ?? "";
      }
      return next;
    }));
  }

  const draftTotal = draft.reduce((s, r) => s + (r.quantity || 0) * (r.unitCost || 0), 0);

  async function savePurchase() {
    const v = await form.validateFields();
    if (draft.length === 0) { message.error("Add at least one line"); return; }
    const seen = new Set<number>();
    for (const r of draft) {
      if (r.ingredientId == null) { message.error("Pick an ingredient on every row"); return; }
      if (seen.has(r.ingredientId)) { message.error("Same ingredient twice"); return; }
      seen.add(r.ingredientId);
      if (!(r.quantity > 0)) { message.error("Quantity must be > 0"); return; }
      if (r.unitCost < 0) { message.error("Unit cost can't be negative"); return; }
    }
    const lines: PurchaseLineInputDto[] = draft.map((r) => ({
      ingredientId: r.ingredientId!,
      quantity: r.quantity,
      unitCost: r.unitCost,
      notes: null,
    }));
    setSaving(true);
    try {
      await createPurchase({
        supplierId: v.supplierId ?? null,
        purchaseDate: (v.purchaseDate as Dayjs).toISOString(),
        invoiceNumber: v.invoiceNumber || null,
        notes: v.notes || null,
        lines,
      });
      message.success(`Purchase saved (${draft.length} line(s), ${fmtMoney(draftTotal)})`);
      setOpen(false); reload();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : "Save failed");
    } finally { setSaving(false); }
  }

  const columns: ColumnsType<PurchaseDto> = [
    { title: "Date", dataIndex: "purchaseDate", key: "date", width: 120,
      render: (s: string) => dayjs(s).format("YYYY-MM-DD") },
    { title: "Supplier", dataIndex: "supplierName", key: "supplier",
      render: (s: string | null) => s || <Text type="secondary">—</Text> },
    { title: "Invoice #", dataIndex: "invoiceNumber", key: "invoice", width: 140,
      render: (s: string | null) => s || "—" },
    { title: "Lines", key: "lines", width: 80, align: "right",
      render: (_, r) => r.lines.length },
    { title: "Total", dataIndex: "totalCost", key: "total", width: 140, align: "right",
      render: (n: number) => <Text strong>{fmtMoney(n)}</Text> },
    { title: "By", dataIndex: "createdBy", key: "by", width: 140, ellipsis: true,
      render: (s: string | null) => s || "—" },
    { title: "", key: "view", width: 60,
      render: (_, r) => <Button size="small" icon={<EyeOutlined />} onClick={() => setDetail(r)} /> },
  ];

  return (
    <div className="p-6">
      <Card>
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Space wrap align="center" style={{ width: "100%", justifyContent: "space-between" }}>
            <div>
              <Text strong style={{ fontSize: 18 }}>Purchases</Text>
              <div style={{ fontSize: 12, color: "#6B7280" }}>
                Shipments received. Updates ingredient stock and latest cost.
              </div>
            </div>
            <Button icon={<ReloadOutlined />} onClick={() => setPage((p) => p)} loading={loading}>Reload</Button>
          </Space>

          <Space wrap>
            <Select showSearch optionFilterProp="label" placeholder="Supplier"
              value={supplierFilter}
              onChange={(v) => { setSupplierFilter(v); setPage(1); }}
              style={{ minWidth: 220 }}
              options={[{ value: "all", label: "All suppliers" },
                ...suppliers.map((s) => ({ value: s.id, label: s.name }))]} />
            <Select showSearch optionFilterProp="label" placeholder="Ingredient"
              value={ingredientFilter}
              onChange={(v) => { setIngredientFilter(v); setPage(1); }}
              style={{ minWidth: 220 }}
              options={[{ value: "all", label: "All ingredients" },
                ...ingredients.map((i) => ({ value: i.id, label: `${i.name} (${i.unit})` }))]} />
            <RangePicker value={range}
              onChange={(v) => v && v[0] && v[1] && setRange([v[0], v[1]])}
              presets={[
                { label: "This Month", value: [dayjs().startOf("month"), dayjs().endOf("day")] },
                { label: "Last 30 Days", value: [dayjs().subtract(30, "day").startOf("day"), dayjs().endOf("day")] },
                { label: "This Year", value: [dayjs().startOf("year"), dayjs().endOf("day")] },
              ]} allowClear={false} />
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>New Purchase</Button>
          </Space>

          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Search supplier, invoice #, ingredient, notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 420 }}
          />

          <Table size="small" loading={loading} rowKey="id" columns={columns} dataSource={visibleRows}
            pagination={{
              current: page, pageSize, total, showSizeChanger: true,
              pageSizeOptions: [10, 20, 50],
              onChange: (p, s) => { setPage(p); setPageSize(s); },
              showTotal: (t) => `${t} purchase(s)`,
            }} scroll={{ x: 900 }} />
        </Space>
      </Card>

      {/* New purchase modal */}
      <Modal open={open} title="New Purchase" width={820}
        onCancel={() => setOpen(false)} onOk={savePurchase} confirmLoading={saving}
        okText="Save Purchase" destroyOnHidden>
        <Form form={form} layout="vertical">
          <Space wrap align="start" size="middle" style={{ width: "100%" }}>
            <Form.Item name="purchaseDate" label="Date" rules={[{ required: true }]} style={{ minWidth: 200 }}>
              <DatePicker style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="supplierId" label="Supplier (optional)" style={{ minWidth: 260 }}>
              <Select allowClear showSearch optionFilterProp="label" placeholder="Pick supplier"
                options={suppliers.map((s) => ({ value: s.id, label: s.name }))} />
            </Form.Item>
            <Form.Item name="invoiceNumber" label="Invoice #" style={{ minWidth: 180 }}>
              <Input placeholder="(optional)" />
            </Form.Item>
          </Space>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} placeholder="(optional)" />
          </Form.Item>
        </Form>

        <Divider style={{ margin: "8px 0 16px" }}>Lines</Divider>

        {draft.length === 0 ? (
          <Empty description="No lines yet" />
        ) : (
          <Table size="small" rowKey="key" pagination={false}
            dataSource={draft}
            columns={[
              {
                title: "Ingredient", key: "ing", width: 280,
                render: (_, r) => (
                  <Select showSearch optionFilterProp="label" placeholder="Pick ingredient"
                    value={r.ingredientId ?? undefined}
                    onChange={(v) => patchDraft(r.key, { ingredientId: v as number })}
                    style={{ width: "100%" }}
                    options={ingredients.map((i) => ({ value: i.id, label: `${i.name} (${i.unit})` }))} />
                )
              },
              {
                title: "Quantity", key: "qty", width: 160,
                render: (_, r) => (
                  <Space>
                    <InputNumber min={0} step={0.1} value={r.quantity}
                      onChange={(v) => patchDraft(r.key, { quantity: Number(v ?? 0) })}
                      style={{ width: 100 }} />
                    <Text type="secondary">{r.unit || "—"}</Text>
                  </Space>
                )
              },
              {
                title: "Unit cost", key: "uc", width: 160,
                render: (_, r) => (
                  <InputNumber min={0} step={0.01} prefix="$" value={r.unitCost}
                    onChange={(v) => patchDraft(r.key, { unitCost: Number(v ?? 0) })}
                    style={{ width: 140 }} />
                )
              },
              {
                title: "Line total", key: "lt", width: 120, align: "right",
                render: (_, r) => fmtMoney((r.quantity || 0) * (r.unitCost || 0))
              },
              {
                title: "", key: "rm", width: 50,
                render: (_, r) => (
                  <Tooltip title="Remove">
                    <Button size="small" danger icon={<DeleteOutlined />} onClick={() => removeDraftRow(r.key)} />
                  </Tooltip>
                )
              },
            ]}
          />
        )}

        <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Button icon={<PlusOutlined />} onClick={addDraftRow}>Add Line</Button>
          <Text strong style={{ fontSize: 16 }}>Total: {fmtMoney(draftTotal)}</Text>
        </div>
      </Modal>

      {/* Purchase detail modal */}
      <Modal open={!!detail} title={detail ? `Purchase #${detail.id}` : ""} width={780}
        onCancel={() => setDetail(null)} footer={null}>
        {detail && (
          <Space direction="vertical" style={{ width: "100%" }}>
            <Space wrap><Tag color="blue">{dayjs(detail.purchaseDate).format("YYYY-MM-DD")}</Tag>
              {detail.supplierName && <Tag>{detail.supplierName}</Tag>}
              {detail.invoiceNumber && <Tag>Inv# {detail.invoiceNumber}</Tag>}</Space>
            {detail.notes && <Text type="secondary">{detail.notes}</Text>}
            <Table size="small" rowKey="id" pagination={false} dataSource={detail.lines}
              columns={[
                { title: "Ingredient", key: "i", render: (_, l) => `${l.ingredientName} (${l.unit})` },
                { title: "Quantity", dataIndex: "quantity", key: "q", align: "right",
                  render: (n: number, l) => `${n} ${l.unit}` },
                { title: "Unit cost", dataIndex: "unitCost", key: "uc", align: "right",
                  render: (n: number) => fmtMoney(n) },
                { title: "Line total", dataIndex: "lineTotal", key: "lt", align: "right",
                  render: (n: number) => <strong>{fmtMoney(n)}</strong> },
              ]} />
            <div style={{ textAlign: "right", marginTop: 8 }}>
              <Text strong>Total: {fmtMoney(detail.totalCost)}</Text>
            </div>
          </Space>
        )}
      </Modal>
    </div>
  );
}
