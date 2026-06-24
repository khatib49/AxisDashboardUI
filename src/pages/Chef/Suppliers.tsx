// Suppliers
// =========
// Admin / chef CRUD for vendors. The supplier dropdown on the New
// Purchase form pulls from this list.

import { useEffect, useMemo, useState } from "react";
import {
  Card, Table, Tag, Button, Space, Modal, Form, Input, Switch as AntSwitch,
  message, Typography,
} from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import {
  SupplierDto, getSuppliers, createSupplier, updateSupplier, deactivateSupplier,
} from "../../services/supplierService";

const { Text } = Typography;

export default function Suppliers() {
  const [rows, setRows] = useState<SupplierDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [includeHidden, setIncludeHidden] = useState(false);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [active, setActive] = useState<SupplierDto | null>(null);
  const [form] = Form.useForm();

  // Client-side filter: matches name / contact / notes, case-insensitive.
  // Cheap because the supplier list is small (dozens, not thousands).
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      r.name.toLowerCase().includes(q) ||
      (r.contactInfo ?? "").toLowerCase().includes(q) ||
      (r.notes ?? "").toLowerCase().includes(q)
    );
  }, [rows, search]);

  async function reload() {
    setLoading(true);
    try { setRows(await getSuppliers(includeHidden)); }
    catch { message.error("Failed to load suppliers"); }
    finally { setLoading(false); }
  }

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [includeHidden]);

  function openAdd() { setActive(null); form.resetFields(); setModal("add"); }
  function openEdit(r: SupplierDto) {
    setActive(r);
    form.resetFields();
    form.setFieldsValue({
      name: r.name, contactInfo: r.contactInfo ?? "", notes: r.notes ?? "", isActive: r.isActive,
    });
    setModal("edit");
  }

  async function submit() {
    const v = await form.validateFields();
    try {
      if (modal === "add") {
        await createSupplier({ name: v.name, contactInfo: v.contactInfo || null, notes: v.notes || null });
        message.success("Supplier created");
      } else if (modal === "edit" && active) {
        await updateSupplier(active.id, {
          name: v.name, contactInfo: v.contactInfo || null, notes: v.notes || null, isActive: v.isActive,
        });
        message.success("Supplier updated");
      }
      setModal(null); setActive(null); reload();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function handleHide(r: SupplierDto) {
    Modal.confirm({
      title: `Hide "${r.name}"?`,
      content: "Historical purchases stay intact. Just no longer appears in the supplier picker.",
      okText: "Hide",
      okButtonProps: { danger: true },
      onOk: async () => {
        try { await deactivateSupplier(r.id); message.success("Hidden"); reload(); }
        catch { message.error("Failed to hide"); }
      },
    });
  }

  const columns: ColumnsType<SupplierDto> = [
    {
      title: "Name", key: "name",
      render: (_, r) => <Space><Text strong>{r.name}</Text>{!r.isActive && <Tag>Hidden</Tag>}</Space>,
    },
    { title: "Contact", dataIndex: "contactInfo", key: "contactInfo", render: (s: string | null) => s || "—" },
    { title: "Notes", dataIndex: "notes", key: "notes", ellipsis: true, render: (s: string | null) => s || "—" },
    {
      title: "Status", key: "status", width: 100,
      render: (_, r) => r.isActive ? <Tag color="green">Active</Tag> : <Tag>Hidden</Tag>,
    },
    {
      title: "Actions", key: "actions", width: 130,
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          {r.isActive && <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleHide(r)} />}
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6">
      <Card>
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Space wrap align="center" style={{ width: "100%", justifyContent: "space-between" }}>
            <div>
              <Text strong style={{ fontSize: 18 }}>Suppliers</Text>
              <div style={{ fontSize: 12, color: "#6B7280" }}>Vendors we buy ingredients from.</div>
            </div>
            <Space wrap>
              <Space><Text type="secondary" style={{ fontSize: 12 }}>Show hidden</Text>
                <AntSwitch size="small" checked={includeHidden} onChange={setIncludeHidden} />
              </Space>
              <Button icon={<ReloadOutlined />} onClick={reload} loading={loading}>Reload</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>New Supplier</Button>
            </Space>
          </Space>

          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Search by name, contact, or notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 360 }}
          />

          <Table size="small" loading={loading} rowKey="id" columns={columns} dataSource={filteredRows}
            pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} supplier(s)` }} />
        </Space>
      </Card>

      <Modal open={modal !== null}
        title={modal === "add" ? "New Supplier" : `Edit ${active?.name}`}
        onCancel={() => { setModal(null); setActive(null); }}
        onOk={submit} okText={modal === "add" ? "Create" : "Save"} destroyOnHidden>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Name" rules={[{ required: true, message: "Required" }]}>
            <Input placeholder="e.g. Lebanese Meat Co." />
          </Form.Item>
          <Form.Item name="contactInfo" label="Contact info">
            <Input placeholder="phone / email / address" />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} />
          </Form.Item>
          {modal === "edit" && (
            <Form.Item name="isActive" label="Active" valuePropName="checked">
              <AntSwitch />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
}
