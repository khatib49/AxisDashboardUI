// Suppliers
// =========
// Admin / chef CRUD for vendors. The supplier dropdown on the New
// Purchase form pulls from this list.

import { useEffect, useMemo, useState } from "react";
import {
  Table, Button, Modal, Form, Input, Switch as AntSwitch,
  message, Tooltip, Empty, Pagination, Skeleton,
} from "antd";
import {
  PlusOutlined, EditOutlined, ReloadOutlined, SearchOutlined, ShopOutlined,
  ContactsOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import {
  SupplierDto, getSuppliers, createSupplier, updateSupplier, deactivateSupplier,
} from "../../services/supplierService";
import { PageHeader, Panel, Pill, StatTile } from "../../components/ui/PageKit";
import { IconChip } from "../../components/admin/venue/VenueKit";
import { ModalFooter, ModalTitle } from "../../components/stock/IngredientKit";
import {
  SupplierAvatar, SupplierCard, SupplierContact, SupplierRowActions, SupplierStatus,
} from "../../components/stock/SupplierKit";

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

  // Client-side paging of the filtered list (20 per page, size changer) —
  // shared by the desktop table and the mobile cards. A page past the end
  // (after filtering) falls back to the last page.
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  // A new search (or showing/hiding hidden suppliers) starts from page 1
  // (React's "adjust state while rendering" pattern — no effect pass).
  const filterKey = `${includeHidden}|${search.trim().toLowerCase()}`;
  const [pagedFor, setPagedFor] = useState(filterKey);
  if (pagedFor !== filterKey) {
    setPagedFor(filterKey);
    setPage(1);
  }
  const maxPage = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, maxPage);
  const pageRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

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
      title: "Supplier", key: "name",
      render: (_, r) => (
        <div className="flex min-w-0 items-center gap-3">
          <SupplierAvatar name={r.name} muted={!r.isActive} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-gray-900 dark:text-gray-100">{r.name}</span>
              {!r.isActive && <Pill tone="gray" dot>Hidden</Pill>}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Contact", dataIndex: "contactInfo", key: "contactInfo",
      render: (s: string | null) => <SupplierContact raw={s} />,
    },
    {
      title: "Notes", dataIndex: "notes", key: "notes", ellipsis: { showTitle: false },
      render: (s: string | null) => s
        ? <Tooltip title={s} placement="topLeft"><span className="text-gray-600 dark:text-gray-400">{s}</span></Tooltip>
        : <span className="text-gray-400 dark:text-gray-500">—</span>,
    },
    {
      title: "Status", key: "status", width: 110,
      render: (_, r) => <SupplierStatus active={r.isActive} />,
    },
    {
      title: "", key: "actions", width: 170, align: "right",
      render: (_, r) => <SupplierRowActions r={r} onEdit={openEdit} onHide={handleHide} />,
    },
  ];

  const firstLoad = loading && rows.length === 0;
  const activeCount = rows.filter(r => r.isActive).length;
  const withContact = rows.filter(r => (r.contactInfo ?? "").trim() !== "").length;
  const filtersActive = search.trim() !== "";
  const closeModal = () => { setModal(null); setActive(null); };
  const emptyText = filtersActive ? "No suppliers match your search" : "No suppliers yet";

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6">
      <PageHeader
        tone="emerald"
        icon={<ShopOutlined />}
        title="Suppliers"
        description="Vendors we buy ingredients from. Active suppliers appear in the supplier picker on the New Purchase form."
        actions={
          <>
            <Tooltip title="Reload">
              <Button icon={<ReloadOutlined />} onClick={reload} loading={loading} aria-label="Reload" />
            </Tooltip>
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>New Supplier</Button>
          </>
        }
      />

      {/* KPIs — derived from the list already loaded (no extra requests). */}
      <div className="grid gap-4 sm:grid-cols-2">
        <StatTile
          label="Suppliers"
          loading={firstLoad}
          value={<span className="tabular-nums">{rows.length}</span>}
          sub={includeHidden ? `${activeCount} active · ${rows.length - activeCount} hidden` : "Active · in the supplier picker"}
          accent={<IconChip tone="emerald"><ShopOutlined /></IconChip>}
        />
        <StatTile
          label="With contact info"
          loading={firstLoad}
          value={<span className="tabular-nums">{withContact}</span>}
          sub={rows.length - withContact > 0 ? `${rows.length - withContact} missing contact info` : "Everyone is reachable"}
          accent={<IconChip tone={rows.length - withContact > 0 ? "amber" : "violet"}><ContactsOutlined /></IconChip>}
        />
      </div>

      <Panel
        title="All suppliers"
        subtitle={firstLoad ? undefined : filtersActive ? `${filteredRows.length} of ${rows.length} supplier(s)` : `${rows.length} supplier(s)`}
        bodyClassName="p-0"
      >
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-5 py-4 dark:border-white/[0.06]">
          <Input
            allowClear
            prefix={<SearchOutlined className="text-gray-400" />}
            placeholder="Search by name, contact, or notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-80"
          />
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600 sm:ml-auto dark:text-gray-400">
            <AntSwitch size="small" checked={includeHidden} onChange={setIncludeHidden} />
            Show hidden
          </label>
        </div>

        {/* Desktop: table */}
        <div className="relative hidden overflow-x-auto md:block">
          <Table
            size="middle"
            loading={loading}
            rowKey="id"
            columns={columns}
            dataSource={pageRows}
            pagination={false}
            scroll={{ x: 860 }}
            locale={{ emptyText: <Empty description={emptyText} /> }}
          />
        </div>

        {/* Mobile: stacked cards, same rows and handlers */}
        <div className="md:hidden">
          {firstLoad ? (
            <div className="p-4"><Skeleton active paragraph={{ rows: 5 }} /></div>
          ) : pageRows.length === 0 ? (
            <div className="py-10"><Empty description={emptyText} /></div>
          ) : (
            <ul className={`space-y-3 p-4 transition-opacity ${loading ? "opacity-60" : ""}`}>
              {pageRows.map(r => <SupplierCard key={r.id} r={r} onEdit={openEdit} onHide={handleHide} />)}
            </ul>
          )}
        </div>

        {filteredRows.length > 0 && (
          <div className="flex min-w-0 justify-center border-t border-gray-100 px-4 py-3 sm:justify-end sm:px-5 dark:border-white/[0.06]">
            <Pagination
              size="small"
              current={currentPage}
              pageSize={pageSize}
              total={filteredRows.length}
              showSizeChanger
              showLessItems
              showTotal={(t) => `${t} supplier(s)`}
              onChange={(p, s) => { setPage(p); setPageSize(s); }}
              className="flex-wrap justify-center gap-y-2"
            />
          </div>
        )}
      </Panel>

      <Modal open={modal !== null}
        title={modal === "add"
          ? <ModalTitle icon={<PlusOutlined />} tone="emerald" title="New Supplier" sub="A vendor you buy ingredients from" />
          : <ModalTitle icon={<EditOutlined />} tone="blue" title={`Edit ${active?.name}`} sub="Name, contact info and notes" />}
        onCancel={closeModal}
        onOk={submit} okText={modal === "add" ? "Create" : "Save"}
        width="min(560px, calc(100vw - 32px))"
        footer={<ModalFooter onCancel={closeModal} onOk={submit} okText={modal === "add" ? "Create" : "Save"} />}
        destroyOnHidden>
        <Form form={form} layout="vertical" className="pt-3">
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Form.Item name="name" label="Name" rules={[{ required: true, message: "Required" }]}>
              <Input placeholder="e.g. Lebanese Meat Co." />
            </Form.Item>
            <Form.Item name="contactInfo" label="Contact info" extra="Separate several with “ / ” or “;”">
              <Input placeholder="phone / email / address" />
            </Form.Item>
            <Form.Item name="notes" label="Notes" className="sm:col-span-2">
              <Input.TextArea rows={2} />
            </Form.Item>
            {modal === "edit" && (
              <Form.Item name="isActive" label="Active" valuePropName="checked">
                <AntSwitch />
              </Form.Item>
            )}
          </div>
        </Form>
      </Modal>
    </div>
  );
}
