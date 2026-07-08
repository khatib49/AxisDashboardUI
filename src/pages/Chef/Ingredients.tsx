// Ingredients
// ===========
// Chef's central screen: every raw material with current stock, with
// per-row actions: Add Stock (a shipment arrived), Record Waste (with
// reason), Adjust (set absolute count), Edit (rename / change unit / set
// reorder level), Hide. Low-stock rows are flagged red. Hidden rows are
// only shown when "Show hidden" is on.

import { useEffect, useMemo, useState } from "react";
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  message,
  Tooltip,
  Switch as AntSwitch,
  Typography,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ArrowUpOutlined,
  WarningOutlined,
  ReloadOutlined,
  ToolOutlined,
  ExclamationCircleOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import {
  IngredientDto,
  getIngredients,
  createIngredient,
  updateIngredient,
  deactivateIngredient,
  hardDeleteIngredient,
  addStock,
  recordWaste,
  adjustStock,
  WASTE_REASONS,
} from "../../services/ingredientService";

const { Text } = Typography;

type ModalKind = "add" | "edit" | "stock-in" | "waste" | "adjust" | null;

const fmtQty = (n: number, unit: string) => `${n.toLocaleString("en-US", { maximumFractionDigits: 3 })} ${unit}`;

export default function Ingredients() {
  const [rows, setRows] = useState<IngredientDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [includeHidden, setIncludeHidden] = useState(false);
  const [search, setSearch] = useState("");

  // Client-side filter on the loaded list — matches name / unit / notes.
  // Filtering after low-stock count keeps the badge accurate to the
  // underlying inventory, not to whatever the user is currently searching.
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      r.name.toLowerCase().includes(q) ||
      (r.unit ?? "").toLowerCase().includes(q) ||
      (r.notes ?? "").toLowerCase().includes(q)
    );
  }, [rows, search]);

  const [modal, setModal] = useState<ModalKind>(null);
  const [active, setActive] = useState<IngredientDto | null>(null);
  const [form] = Form.useForm();

  async function reload() {
    setLoading(true);
    try {
      const data = await getIngredients(includeHidden);
      setRows(data);
    } catch {
      message.error("Failed to load ingredients");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeHidden]);

  function openAdd() {
    setActive(null);
    form.resetFields();
    form.setFieldsValue({ unit: "g", openingQuantity: 0 });
    setModal("add");
  }

  function openEdit(r: IngredientDto) {
    setActive(r);
    form.resetFields();
    form.setFieldsValue({
      name: r.name,
      unit: r.unit,
      reorderLevel: r.reorderLevel ?? undefined,
      buyPricePerUnit: r.buyPricePerUnit ?? undefined,
      notes: r.notes ?? undefined,
      isActive: r.isActive,
    });
    setModal("edit");
  }

  function openAction(kind: Exclude<ModalKind, null | "add" | "edit">, r: IngredientDto) {
    setActive(r);
    form.resetFields();
    if (kind === "adjust") form.setFieldsValue({ newQuantity: r.quantityOnHand });
    if (kind === "waste") form.setFieldsValue({ wasteReason: "Spoilage" });
    setModal(kind);
  }

  async function handleSubmit() {
    const values = await form.validateFields();
    try {
      if (modal === "add") {
        await createIngredient({
          name: values.name,
          unit: values.unit,
          reorderLevel: values.reorderLevel ?? null,
          buyPricePerUnit: values.buyPricePerUnit ?? null,
          notes: values.notes ?? null,
          openingQuantity: values.openingQuantity ?? 0,
        });
        message.success("Ingredient created");
      } else if (modal === "edit" && active) {
        await updateIngredient(active.id, {
          name: values.name,
          unit: values.unit,
          reorderLevel: values.reorderLevel ?? null,
          buyPricePerUnit: values.buyPricePerUnit ?? null,
          notes: values.notes ?? null,
          isActive: values.isActive,
        });
        message.success("Ingredient updated");
      } else if (modal === "stock-in" && active) {
        await addStock({ ingredientId: active.id, quantity: values.quantity, notes: values.notes ?? null });
        message.success(`+${values.quantity} ${active.unit} added`);
      } else if (modal === "waste" && active) {
        await recordWaste({
          ingredientId: active.id,
          quantity: values.quantity,
          wasteReason: values.wasteReason,
          notes: values.notes ?? null,
        });
        message.success(`Waste recorded: ${values.quantity} ${active.unit}`);
      } else if (modal === "adjust" && active) {
        await adjustStock({
          ingredientId: active.id,
          newQuantity: values.newQuantity,
          notes: values.notes ?? null,
        });
        message.success(`Stock set to ${values.newQuantity} ${active.unit}`);
      }
      setModal(null);
      setActive(null);
      reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Save failed";
      message.error(msg);
    }
  }

  async function handleDeactivate(r: IngredientDto) {
    Modal.confirm({
      title: `Hide "${r.name}"?`,
      content: "Historical recipes and stock movements stay intact. The ingredient just no longer appears in pickers and the active list.",
      okText: "Hide",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deactivateIngredient(r.id);
          message.success("Hidden");
          reload();
        } catch {
          message.error("Failed to hide");
        }
      },
    });
  }

  async function handleHardDelete(r: IngredientDto) {
    Modal.confirm({
      title: `Delete "${r.name}" permanently?`,
      content: (
        <div>
          <p>This <b>permanently removes</b> the ingredient row from the database. It only succeeds if the ingredient has no history — no recipes, no stock movements, no purchases.</p>
          <p style={{ color: "#a16207", marginTop: 8 }}>
            If it has any history, the server will refuse and tell you why. In that case use <b>Hide</b> instead to preserve the audit trail.
          </p>
        </div>
      ),
      okText: "Delete permanently",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await hardDeleteIngredient(r.id);
          message.success(`"${r.name}" deleted`);
          reload();
        } catch (err: unknown) {
          // The server sends a Conflict with { message: "..." } when the
          // ingredient has references. Surface that as-is.
          const raw = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
          message.error(raw ?? "Failed to delete");
        }
      },
    });
  }

  const columns: ColumnsType<IngredientDto> = useMemo(() => [
    {
      title: "Name",
      key: "name",
      render: (_, r) => (
        <Space>
          <Text strong>{r.name}</Text>
          {!r.isActive && <Tag color="default">Hidden</Tag>}
        </Space>
      ),
    },
    { title: "Unit", dataIndex: "unit", key: "unit", width: 80 },
    {
      title: "On Hand",
      key: "qty",
      align: "right",
      width: 140,
      render: (_, r) => {
        const color = r.isNegative ? "#ff4d4f" : r.isBelowReorderLevel ? "#fa8c16" : undefined;
        return <Text strong style={{ color }}>{fmtQty(r.quantityOnHand, r.unit)}</Text>;
      },
    },
    {
      title: "Reorder",
      key: "reorder",
      align: "right",
      width: 130,
      render: (_, r) =>
        r.reorderLevel == null ? <Text type="secondary">—</Text> : fmtQty(r.reorderLevel, r.unit),
    },
    {
      title: "Status",
      key: "status",
      width: 160,
      render: (_, r) => {
        if (r.isNegative) return <Tag color="red" icon={<ExclamationCircleOutlined />}>Negative</Tag>;
        if (r.isBelowReorderLevel) return <Tag color="orange" icon={<WarningOutlined />}>Low</Tag>;
        return <Tag color="green">OK</Tag>;
      },
    },
    {
      title: "Actions",
      key: "actions",
      width: 320,
      render: (_, r) => (
        <Space wrap>
          <Tooltip title="Shipment arrived">
            <Button size="small" type="primary" icon={<ArrowUpOutlined />} onClick={() => openAction("stock-in", r)}>
              Add Stock
            </Button>
          </Tooltip>
          <Tooltip title="Spoilage, spillage, burnt, etc.">
            <Button size="small" danger icon={<WarningOutlined />} onClick={() => openAction("waste", r)}>
              Waste
            </Button>
          </Tooltip>
          <Tooltip title="Set absolute count (after a physical inventory)">
            <Button size="small" icon={<ToolOutlined />} onClick={() => openAction("adjust", r)}>
              Adjust
            </Button>
          </Tooltip>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          {r.isActive && (
            <Tooltip title="Hide (soft delete — keeps history)">
              <Button size="small" icon={<DeleteOutlined />} onClick={() => handleDeactivate(r)} />
            </Tooltip>
          )}
          {/* Hard delete is available for both active and hidden rows —
              the server enforces the FK-safety check anyway. */}
          <Tooltip title="Delete permanently (only if unused)">
            <Button
              size="small"
              danger
              onClick={() => handleHardDelete(r)}
              style={{ fontSize: 11 }}
            >
              Delete
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ], []);

  const lowStockCount = rows.filter(r => r.isBelowReorderLevel || r.isNegative).length;

  return (
    <div className="p-6">
      <Card>
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Space wrap align="center" style={{ width: "100%", justifyContent: "space-between" }}>
            <div>
              <Text strong style={{ fontSize: 18 }}>Ingredients</Text>
              <div style={{ fontSize: 12, color: "#6B7280" }}>
                Every raw material the kitchen uses. Red = went negative, Orange = under reorder level.
              </div>
            </div>
            <Space wrap>
              <Space>
                <Text type="secondary" style={{ fontSize: 12 }}>Show hidden</Text>
                <AntSwitch size="small" checked={includeHidden} onChange={setIncludeHidden} />
              </Space>
              <Button icon={<ReloadOutlined />} onClick={reload} loading={loading}>Reload</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
                New Ingredient
              </Button>
            </Space>
          </Space>

          {lowStockCount > 0 && (
            <Tag color="orange" icon={<WarningOutlined />}>
              {lowStockCount} ingredient(s) need attention
            </Tag>
          )}

          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Search by name, unit, or notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 360 }}
          />

          <Table
            size="small"
            loading={loading}
            rowKey="id"
            columns={columns}
            dataSource={filteredRows}
            pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} ingredient(s)` }}
            scroll={{ x: 900 }}
          />
        </Space>
      </Card>

      <Modal
        open={modal !== null}
        title={
          modal === "add" ? "New Ingredient" :
          modal === "edit" ? `Edit ${active?.name}` :
          modal === "stock-in" ? `Add Stock — ${active?.name}` :
          modal === "waste" ? `Record Waste — ${active?.name}` :
          modal === "adjust" ? `Adjust Stock — ${active?.name}` : ""
        }
        onCancel={() => { setModal(null); setActive(null); }}
        onOk={handleSubmit}
        okText={modal === "add" ? "Create" : "Save"}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          {modal === "add" && (
            <>
              <Form.Item name="name" label="Name" rules={[{ required: true, message: "Required" }]}>
                <Input placeholder="Beef" />
              </Form.Item>
              <Form.Item name="unit" label="Unit" rules={[{ required: true }]}>
                <Select
                  options={[
                    { value: "g", label: "grams (g)" },
                    { value: "kg", label: "kilograms (kg)" },
                    { value: "ml", label: "millilitres (ml)" },
                    { value: "l", label: "litres (l)" },
                    { value: "pcs", label: "pieces (pcs)" },
                  ]}
                />
              </Form.Item>
              <Form.Item name="openingQuantity" label="Opening quantity (optional)">
                <InputNumber min={0} step={0.1} style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name="reorderLevel" label="Reorder level (optional)">
                <InputNumber min={0} step={0.1} style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name="buyPricePerUnit" label="Buy price per unit (optional)">
                <InputNumber min={0} step={0.01} prefix="$" style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name="notes" label="Notes (optional)">
                <Input.TextArea rows={2} />
              </Form.Item>
            </>
          )}

          {modal === "edit" && (
            <>
              <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
              <Form.Item name="unit" label="Unit" rules={[{ required: true }]}>
                <Select
                  options={[
                    { value: "g", label: "grams (g)" },
                    { value: "kg", label: "kilograms (kg)" },
                    { value: "ml", label: "millilitres (ml)" },
                    { value: "l", label: "litres (l)" },
                    { value: "pcs", label: "pieces (pcs)" },
                  ]}
                />
              </Form.Item>
              <Form.Item name="reorderLevel" label="Reorder level">
                <InputNumber min={0} step={0.1} style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name="buyPricePerUnit" label="Buy price per unit">
                <InputNumber min={0} step={0.01} prefix="$" style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name="notes" label="Notes">
                <Input.TextArea rows={2} />
              </Form.Item>
              <Form.Item name="isActive" label="Active" valuePropName="checked">
                <AntSwitch />
              </Form.Item>
            </>
          )}

          {modal === "stock-in" && (
            <>
              <Text type="secondary">Current on hand: <strong>{active ? fmtQty(active.quantityOnHand, active.unit) : "—"}</strong></Text>
              <Form.Item name="quantity" label={`Quantity to add (${active?.unit ?? ""})`} rules={[{ required: true }]} style={{ marginTop: 12 }}>
                <InputNumber min={0.001} step={0.1} style={{ width: "100%" }} autoFocus />
              </Form.Item>
              <Form.Item name="notes" label="Notes (supplier, invoice #, etc.)">
                <Input.TextArea rows={2} />
              </Form.Item>
            </>
          )}

          {modal === "waste" && (
            <>
              <Text type="secondary">Current on hand: <strong>{active ? fmtQty(active.quantityOnHand, active.unit) : "—"}</strong></Text>
              <Form.Item name="quantity" label={`Quantity wasted (${active?.unit ?? ""})`} rules={[{ required: true }]} style={{ marginTop: 12 }}>
                <InputNumber min={0.001} step={0.1} style={{ width: "100%" }} autoFocus />
              </Form.Item>
              <Form.Item name="wasteReason" label="Reason" rules={[{ required: true }]}>
                <Select options={WASTE_REASONS.map((r) => ({ value: r, label: r }))} />
              </Form.Item>
              <Form.Item name="notes" label="Notes (optional)">
                <Input.TextArea rows={2} />
              </Form.Item>
            </>
          )}

          {modal === "adjust" && (
            <>
              <Text type="secondary">Current on hand: <strong>{active ? fmtQty(active.quantityOnHand, active.unit) : "—"}</strong></Text>
              <Form.Item name="newQuantity" label={`New on-hand (${active?.unit ?? ""})`} rules={[{ required: true }]} style={{ marginTop: 12 }}>
                <InputNumber min={0} step={0.1} style={{ width: "100%" }} autoFocus />
              </Form.Item>
              <Form.Item name="notes" label="Why are you adjusting?">
                <Input.TextArea rows={2} placeholder="e.g. Physical count: weighed 4.2 kg not 5 kg" />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </div>
  );
}
