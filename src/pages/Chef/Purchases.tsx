// Purchases
// =========
// Lists past purchases with filter + opens a multi-line "New Purchase"
// form. Each new purchase atomically updates ingredient stock and the
// "Latest cost" (BuyPricePerUnit), and writes a Purchase StockMovement
// row per line.

import { useEffect, useMemo, useState } from "react";
import {
  Table, Button, Modal, Form, Input, Select,
  DatePicker, message, Tooltip, Empty, Pagination, Skeleton, Spin,
} from "antd";
import {
  PlusOutlined, ReloadOutlined, EyeOutlined, SearchOutlined, ShoppingCartOutlined,
  DollarOutlined, UnorderedListOutlined, ShopOutlined, FileTextOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs, { Dayjs } from "dayjs";
import {
  PurchaseDto, PurchaseLineInputDto, createPurchase, listPurchases,
} from "../../services/purchaseService";
import { IngredientDto, getIngredients } from "../../services/ingredientService";
import { SupplierDto, getSuppliers } from "../../services/supplierService";
import { PageHeader, Panel, Pill, StatTile } from "../../components/ui/PageKit";
import { IconChip } from "../../components/admin/venue/VenueKit";
import { PurchaseCard, PurchaseDetailBody, PurchaseLineEditor } from "../../components/stock/PurchaseKit";

const { RangePicker } = DatePicker;

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
  // What the server searches: the box, settled for 350ms (no request per keystroke).
  const [debouncedSearch, setDebouncedSearch] = useState("");
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

  useEffect(() => {
    const t = setTimeout(() => {
      const next = search.trim();
      if (next === debouncedSearch) return;
      // Same batch → one fetch: new term, back to page 1.
      setDebouncedSearch(next);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search, debouncedSearch]);

  const filterArgs = useMemo(() => ({
    supplierId: supplierFilter === "all" ? null : supplierFilter,
    ingredientId: ingredientFilter === "all" ? null : ingredientFilter,
    from: range[0].toISOString(),
    to: range[1].toISOString(),
    search: debouncedSearch || null,
  }), [supplierFilter, ingredientFilter, range, debouncedSearch]);

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

  // Search runs on the server over every purchase in the filters (see
  // filterArgs.search), so totals and paging include it. This local pass on
  // the same fields narrows the loaded rows instantly while typing, before
  // the debounced request returns; on server results it changes nothing.
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
    { title: "Date", dataIndex: "purchaseDate", key: "date", width: 140,
      render: (s: string, r) => (
        <div className="whitespace-nowrap">
          <div className="font-medium tabular-nums text-gray-900 dark:text-gray-100">{dayjs(s).format("MMM D, YYYY")}</div>
          <div className="text-[11px] tabular-nums text-gray-500 dark:text-gray-400">#{r.id}</div>
        </div>
      ) },
    { title: "Supplier", dataIndex: "supplierName", key: "supplier",
      render: (s: string | null) => s
        ? <span className="font-medium text-gray-900 dark:text-gray-100">{s}</span>
        : <span className="text-gray-400">—</span> },
    { title: "Invoice #", dataIndex: "invoiceNumber", key: "invoice", width: 150,
      render: (s: string | null) => s ? <Pill><FileTextOutlined /> {s}</Pill> : <span className="text-gray-400">—</span> },
    { title: "Lines", key: "lines", width: 90, align: "right",
      render: (_, r) => <span className="tabular-nums text-gray-700 dark:text-gray-300">{r.lines.length}</span> },
    { title: "Total", dataIndex: "totalCost", key: "total", width: 140, align: "right",
      render: (n: number) => <span className="whitespace-nowrap font-semibold tabular-nums text-gray-900 dark:text-white">{fmtMoney(n)}</span> },
    { title: "By", dataIndex: "createdBy", key: "by", width: 150, ellipsis: true,
      render: (s: string | null) => s ? <span className="text-gray-600 dark:text-gray-300">{s}</span> : <span className="text-gray-400">—</span> },
    { title: "", key: "view", width: 96, align: "right",
      render: (_, r) => <Button size="small" icon={<EyeOutlined />} onClick={() => setDetail(r)} aria-label={`View purchase #${r.id}`}>View</Button> },
  ];

  // ── Presentation (derived from the page already loaded) ─────────────
  const firstLoad = loading && total === 0;
  const spendOnPage = rows.reduce((s, r) => s + (r.totalCost || 0), 0);
  const linesOnPage = rows.reduce((s, r) => s + r.lines.length, 0);
  const suppliersOnPage = new Set(rows.map((r) => r.supplierName).filter(Boolean)).size;
  const rangeLabel = `${range[0].format("MMM D, YYYY")} – ${range[1].format("MMM D, YYYY")}`;
  const filtersActive = supplierFilter !== "all" || ingredientFilter !== "all";
  const emptyText = search.trim()
    ? "No purchases match your search"
    : filtersActive ? "No purchases match these filters" : "No purchases in this period";

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6">
      <PageHeader
        tone="emerald"
        icon={<ShoppingCartOutlined />}
        title="Purchases"
        description="Shipments received. Updates ingredient stock and latest cost."
        actions={
          <>
            <Tooltip title="Reload">
              <Button icon={<ReloadOutlined />} onClick={() => reload()} loading={loading} aria-label="Reload" />
            </Tooltip>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>New Purchase</Button>
          </>
        }
      />

      {/* KPIs — derived from the page already loaded (no extra requests) */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Purchases"
          loading={firstLoad}
          value={<span className="tabular-nums">{total.toLocaleString("en-US")}</span>}
          sub={rangeLabel}
          accent={<IconChip tone="emerald"><ShoppingCartOutlined /></IconChip>}
        />
        <StatTile
          label="Spend"
          loading={firstLoad}
          value={<span className="tabular-nums">{fmtMoney(spendOnPage)}</span>}
          sub={<>On this page · <span className="tabular-nums">{rows.length}</span> purchase{rows.length === 1 ? "" : "s"}</>}
          accent={<IconChip tone="blue"><DollarOutlined /></IconChip>}
        />
        <StatTile
          label="Lines received"
          loading={firstLoad}
          value={<span className="tabular-nums">{linesOnPage.toLocaleString("en-US")}</span>}
          sub="On this page"
          accent={<IconChip tone="violet"><UnorderedListOutlined /></IconChip>}
        />
        <StatTile
          label="Suppliers"
          loading={firstLoad}
          value={<span className="tabular-nums">{suppliersOnPage.toLocaleString("en-US")}</span>}
          sub="Delivered on this page"
          accent={<IconChip tone="amber"><ShopOutlined /></IconChip>}
        />
      </div>

      <Panel
        title="All purchases"
        subtitle={loading && rows.length === 0 ? `Loading… · ${rangeLabel}` : `${total.toLocaleString("en-US")} purchase${total === 1 ? "" : "s"} · ${rangeLabel}`}
        bodyClassName="p-0"
      >
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-5 py-4 dark:border-white/[0.06]">
          <Input
            allowClear
            prefix={<SearchOutlined className="text-gray-400" />}
            placeholder="Search supplier, invoice #, ingredient, notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-72"
            aria-label="Search purchases"
          />
          <Select showSearch optionFilterProp="label" placeholder="Supplier"
            value={supplierFilter}
            onChange={(v) => { setSupplierFilter(v); setPage(1); }}
            className="w-full sm:w-56"
            aria-label="Supplier"
            options={[{ value: "all", label: "All suppliers" },
              ...suppliers.map((s) => ({ value: s.id, label: s.name }))]} />
          <Select showSearch optionFilterProp="label" placeholder="Ingredient"
            value={ingredientFilter}
            onChange={(v) => { setIngredientFilter(v); setPage(1); }}
            className="w-full sm:w-56"
            aria-label="Ingredient"
            options={[{ value: "all", label: "All ingredients" },
              ...ingredients.map((i) => ({ value: i.id, label: `${i.name} (${i.unit})` }))]} />
          <RangePicker value={range}
            onChange={(v) => { if (v && v[0] && v[1]) { setRange([v[0], v[1]]); setPage(1); } }}
            presets={[
              { label: "This Month", value: [dayjs().startOf("month"), dayjs().endOf("day")] },
              { label: "Last 30 Days", value: [dayjs().subtract(30, "day").startOf("day"), dayjs().endOf("day")] },
              { label: "This Year", value: [dayjs().startOf("year"), dayjs().endOf("day")] },
            ]} allowClear={false}
            className="w-full sm:w-auto" />
        </div>

        {/* Desktop: table */}
        <div className="hidden md:block">
          <Table size="middle" loading={loading} rowKey="id" columns={columns} dataSource={visibleRows}
            pagination={false} scroll={{ x: 900 }}
            locale={{ emptyText: <Empty description={emptyText} /> }} />
        </div>

        {/* Mobile: stacked cards */}
        <div className="md:hidden">
          {firstLoad ? (
            <div className="p-4"><Skeleton active paragraph={{ rows: 5 }} /></div>
          ) : visibleRows.length === 0 && !loading ? (
            <div className="py-10"><Empty description={emptyText} /></div>
          ) : (
            <Spin spinning={loading}>
              <div className="space-y-3 p-4">
                {visibleRows.map((r) => <PurchaseCard key={r.id} p={r} onView={() => setDetail(r)} />)}
              </div>
            </Spin>
          )}
        </div>

        {/* Pagination (shared by both layouts) */}
        <div className="border-t border-gray-100 px-4 py-3 sm:px-5 dark:border-white/[0.06]">
          <Pagination
            className="flex-wrap justify-center gap-y-2 sm:justify-end"
            showLessItems
            size="small"
            current={page} pageSize={pageSize} total={total} showSizeChanger
            pageSizeOptions={[10, 20, 50]}
            onChange={(p, s) => { setPage(p); setPageSize(s); }}
            showTotal={(t) => `${t} purchase(s)`}
          />
        </div>
      </Panel>

      {/* New purchase modal */}
      <Modal open={open} title="New Purchase" width="min(880px, calc(100vw - 32px))"
        onCancel={() => setOpen(false)} onOk={savePurchase} confirmLoading={saving}
        okText="Save Purchase" destroyOnHidden
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button onClick={() => setOpen(false)} className="w-full sm:w-auto">Cancel</Button>
            <Button type="primary" loading={saving} onClick={savePurchase} className="ms-0! w-full sm:w-auto">Save Purchase</Button>
          </div>
        }>
        <p className="-mt-1 mb-4 text-sm text-gray-500 dark:text-gray-400">
          Receiving a shipment adds each line to stock and sets each ingredient&apos;s latest cost.
        </p>
        <Form form={form} layout="vertical">
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Form.Item name="purchaseDate" label="Date" rules={[{ required: true }]}>
              <DatePicker style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="supplierId" label="Supplier (optional)">
              <Select allowClear showSearch optionFilterProp="label" placeholder="Pick supplier"
                options={suppliers.map((s) => ({ value: s.id, label: s.name }))} />
            </Form.Item>
            <Form.Item name="invoiceNumber" label="Invoice #">
              <Input placeholder="(optional)" />
            </Form.Item>
            <Form.Item name="notes" label="Notes">
              <Input.TextArea rows={2} placeholder="(optional)" />
            </Form.Item>
          </div>
        </Form>

        <div className="border-t border-gray-100 pt-4 dark:border-white/[0.06]">
          <PurchaseLineEditor
            draft={draft}
            ingredients={ingredients}
            total={draftTotal}
            onPatch={patchDraft}
            onRemove={removeDraftRow}
            onAdd={addDraftRow}
          />
        </div>
      </Modal>

      {/* Purchase detail modal */}
      <Modal open={!!detail} title={detail ? `Purchase #${detail.id}` : ""} width="min(780px, calc(100vw - 32px))"
        onCancel={() => setDetail(null)} footer={null}>
        {detail && <PurchaseDetailBody p={detail} />}
      </Modal>
    </div>
  );
}
