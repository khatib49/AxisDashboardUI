// Ingredients
// ===========
// Chef's central screen: every raw material with current stock, with
// per-row actions: Add Stock (a shipment arrived), Record Waste (with
// reason), Adjust (set absolute count), Edit (rename / change unit / set
// reorder level), Hide. Low-stock rows are flagged red. Hidden rows are
// only shown when "Show hidden" is on.

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  message,
  Tooltip,
  Switch as AntSwitch,
  Empty,
  Pagination,
  Skeleton,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  ArrowUpOutlined,
  WarningOutlined,
  ReloadOutlined,
  ToolOutlined,
  ExclamationCircleOutlined,
  SearchOutlined,
  InboxOutlined,
  StopOutlined,
  DollarOutlined,
  QuestionCircleOutlined,
  CloseOutlined,
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
import { PageHeader, Panel, Pill, StatTile } from "../../components/ui/PageKit";
import { IconChip } from "../../components/admin/venue/VenueKit";
import {
  HealthPill,
  IngredientCard,
  IngredientRowActions,
  ModalFooter,
  ModalTitle,
  OnHand,
  StockPreview,
} from "../../components/stock/IngredientKit";
import { type Health, fmtQty, health, isStockProblem, money, moneyUnit } from "../../components/stock/IngredientHealth";

type ModalKind = "add" | "edit" | "stock-in" | "waste" | "adjust" | null;

type StatusFilter = "all" | "attention" | Health;

const UNIT_OPTIONS = [
  { value: "g", label: "grams (g)" },
  { value: "kg", label: "kilograms (kg)" },
  { value: "ml", label: "millilitres (ml)" },
  { value: "l", label: "litres (l)" },
  { value: "pcs", label: "pieces (pcs)" },
];

export default function Ingredients() {
  const [rows, setRows] = useState<IngredientDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [includeHidden, setIncludeHidden] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  // Counts are computed from the FULL list, never from the filtered view, so
  // the numbers on the chips don't shift as you type in the search box.
  const counts = useMemo(() => {
    const c: Record<Health, number> = { negative: 0, out: 0, low: 0, "no-threshold": 0, ok: 0 };
    for (const r of rows) c[health(r)]++;
    return { ...c, attention: rows.length - c.ok, all: rows.length };
  }, [rows]);

  // Client-side filter on the loaded list — status first, then a text match
  // on name / unit / notes.
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (status !== "all") {
        const h = health(r);
        if (status === "attention" ? h === "ok" : h !== status) return false;
      }
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        (r.unit ?? "").toLowerCase().includes(q) ||
        (r.notes ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, status]);

  // Stock value at buy price — only rows with a price and stock on hand count.
  const stockValue = useMemo(() => {
    let value = 0;
    let unpriced = 0;
    for (const r of rows) {
      if (r.buyPricePerUnit == null) { unpriced++; continue; }
      if (r.quantityOnHand > 0) value += r.quantityOnHand * r.buyPricePerUnit;
    }
    return { value, unpriced };
  }, [rows]);

  // Client-side paging of the filtered list (20 per page, size changer) —
  // shared by the desktop table and the mobile cards. A page past the end
  // (after filtering) falls back to the last page.
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  // A new search or status filter starts from page 1 (React's "adjust state
  // while rendering" pattern — no extra render pass through an effect).
  const filterKey = `${status}|${search.trim().toLowerCase()}`;
  const [pagedFor, setPagedFor] = useState(filterKey);
  if (pagedFor !== filterKey) {
    setPagedFor(filterKey);
    setPage(1);
  }
  const maxPage = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, maxPage);
  const pageRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const [modal, setModal] = useState<ModalKind>(null);
  const [active, setActive] = useState<IngredientDto | null>(null);
  const [form] = Form.useForm();
  // Watched only to preview the resulting stock in the stock modals.
  const watchQty = Form.useWatch("quantity", form) as number | null | undefined;
  const watchNewQty = Form.useWatch("newQuantity", form) as number | null | undefined;

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

  // Same handlers for the table rows and the mobile cards.
  const rowActions = {
    onStockIn: (r: IngredientDto) => openAction("stock-in", r),
    onWaste: (r: IngredientDto) => openAction("waste", r),
    onAdjust: (r: IngredientDto) => openAction("adjust", r),
    onEdit: openEdit,
    onHide: handleDeactivate,
    onDelete: handleHardDelete,
  };

  const columns: ColumnsType<IngredientDto> = [
    {
      title: "Ingredient",
      key: "name",
      render: (_, r) => (
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-gray-900 dark:text-gray-100">{r.name}</span>
            {!r.isActive && <Pill tone="gray" dot>Hidden</Pill>}
          </div>
          {r.notes && (
            <Tooltip title={r.notes} placement="topLeft">
              <div className="mt-0.5 max-w-[280px] truncate text-xs text-gray-500 dark:text-gray-400">{r.notes}</div>
            </Tooltip>
          )}
        </div>
      ),
    },
    {
      title: "Unit",
      dataIndex: "unit",
      key: "unit",
      width: 80,
      render: (u: string) => <Pill tone="gray">{u}</Pill>,
    },
    {
      title: "On Hand",
      key: "qty",
      align: "right",
      width: 150,
      render: (_, r) => <OnHand r={r} />,
    },
    {
      title: "Reorder",
      key: "reorder",
      align: "right",
      width: 120,
      render: (_, r) =>
        r.reorderLevel == null
          ? <span className="text-gray-400 dark:text-gray-500">—</span>
          : <span className="whitespace-nowrap tabular-nums text-gray-700 dark:text-gray-300">{fmtQty(r.reorderLevel, r.unit)}</span>,
    },
    {
      title: "Buy price",
      key: "price",
      align: "right",
      width: 120,
      render: (_, r) =>
        r.buyPricePerUnit == null
          ? <span className="text-gray-400 dark:text-gray-500">—</span>
          : (
            <span className="whitespace-nowrap tabular-nums text-gray-700 dark:text-gray-300">
              {moneyUnit(r.buyPricePerUnit)}<span className="text-gray-400">/{r.unit}</span>
            </span>
          ),
    },
    {
      title: "Status",
      key: "status",
      width: 160,
      render: (_, r) => <HealthPill h={health(r)} />,
    },
    {
      title: "",
      key: "actions",
      width: 330,
      align: "right",
      render: (_, r) => <IngredientRowActions r={r} a={rowActions} />,
    },
  ];

  // One clickable chip per problem bucket. Only buckets that actually have
  // rows are rendered, so a healthy kitchen shows a short, quiet row.
  const chips = ([
    { key: "attention",    label: "Needs attention",  count: counts.attention,        icon: <WarningOutlined /> },
    { key: "negative",     label: "Negative",         count: counts.negative,         icon: <ExclamationCircleOutlined /> },
    { key: "out",          label: "Out of stock",     count: counts.out,              icon: <StopOutlined /> },
    { key: "low",          label: "Low",              count: counts.low,              icon: <WarningOutlined /> },
    { key: "no-threshold", label: "No reorder level", count: counts["no-threshold"],  icon: <QuestionCircleOutlined /> },
  ] as { key: StatusFilter; label: string; count: number; icon: ReactNode }[])
    .filter(c => c.count > 0);

  const toggleStatus = (key: StatusFilter) => setStatus(status === key ? "all" : key);
  const firstLoad = loading && rows.length === 0;
  const filtersActive = status !== "all" || search.trim() !== "";
  const closeModal = () => { setModal(null); setActive(null); };

  // Resulting stock, previewed in the stock modals.
  const qtyNum = typeof watchQty === "number" ? watchQty : null;
  const after =
    !active ? null
    : modal === "stock-in" ? (qtyNum != null ? active.quantityOnHand + qtyNum : null)
    : modal === "waste" ? (qtyNum != null ? active.quantityOnHand - qtyNum : null)
    : modal === "adjust" ? (typeof watchNewQty === "number" ? watchNewQty : null)
    : null;

  const modalHead =
    modal === "add" ? <ModalTitle icon={<PlusOutlined />} tone="violet" title="New Ingredient" sub="A raw material the kitchen uses" />
    : modal === "edit" ? <ModalTitle icon={<EditOutlined />} tone="blue" title={`Edit ${active?.name}`} sub="Name, unit, reorder level and price" />
    : modal === "stock-in" ? <ModalTitle icon={<ArrowUpOutlined />} tone="emerald" title={`Add Stock — ${active?.name}`} sub="A shipment arrived" />
    : modal === "waste" ? <ModalTitle icon={<WarningOutlined />} tone="red" title={`Record Waste — ${active?.name}`} sub="Spoilage, spillage, burnt, etc." />
    : modal === "adjust" ? <ModalTitle icon={<ToolOutlined />} tone="blue" title={`Adjust Stock — ${active?.name}`} sub="Set the absolute count after a physical inventory" />
    : "";

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6">
      <PageHeader
        tone="emerald"
        icon={<InboxOutlined />}
        title="Ingredients"
        description="Every raw material the kitchen uses, with live stock levels. Negative, out-of-stock and low items are flagged so you can restock in time."
        actions={
          <>
            <Tooltip title="Reload">
              <Button icon={<ReloadOutlined />} onClick={reload} loading={loading} aria-label="Reload" />
            </Tooltip>
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
              New Ingredient
            </Button>
          </>
        }
      />

      {/* KPIs — derived from the list already loaded (no extra requests). */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Ingredients"
          loading={firstLoad}
          value={<span className="tabular-nums">{counts.all.toLocaleString("en-US")}</span>}
          sub={includeHidden ? "Including hidden" : "Active"}
          accent={<IconChip tone="emerald"><InboxOutlined /></IconChip>}
        />
        <StatTile
          label="Low stock"
          loading={firstLoad}
          value={<span className="tabular-nums">{counts.low}</span>}
          sub="Below reorder level · click to filter"
          accent={<IconChip tone={counts.low ? "amber" : "gray"}><WarningOutlined /></IconChip>}
          onClick={() => toggleStatus("low")}
          active={status === "low"}
        />
        <StatTile
          label="Out of stock"
          loading={firstLoad}
          value={<span className="tabular-nums">{counts.out}</span>}
          sub={counts.negative ? `+ ${counts.negative} negative · click to filter` : "Nothing on hand · click to filter"}
          accent={<IconChip tone={counts.out || counts.negative ? "red" : "gray"}><StopOutlined /></IconChip>}
          onClick={() => toggleStatus("out")}
          active={status === "out"}
        />
        <StatTile
          label="Stock value"
          loading={firstLoad}
          value={<span className="tabular-nums">{money(stockValue.value)}</span>}
          sub={stockValue.unpriced ? `At buy price · ${stockValue.unpriced} without a price` : "At buy price"}
          accent={<IconChip tone="blue"><DollarOutlined /></IconChip>}
        />
      </div>

      <Panel
        title="All ingredients"
        subtitle={
          firstLoad ? undefined
          : filtersActive ? `${filteredRows.length} of ${counts.all} ingredient(s)`
          : `${counts.all} ingredient(s)`
        }
        bodyClassName="p-0"
      >
        {/* Toolbar: search, status filter, show hidden — one wrapping row. */}
        <div className="space-y-3 border-b border-gray-100 px-5 py-4 dark:border-white/[0.06]">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              allowClear
              prefix={<SearchOutlined className="text-gray-400" />}
              placeholder="Search by name, unit, or notes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-80"
            />
            <Select
              value={status}
              onChange={setStatus}
              className="w-full sm:w-60"
              aria-label="Filter by status"
              options={[
                { value: "all",           label: `All ingredients · ${counts.all}` },
                { value: "attention",     label: `Needs attention · ${counts.attention}` },
                { value: "negative",      label: `Negative · ${counts.negative}` },
                { value: "out",           label: `Out of stock · ${counts.out}` },
                { value: "low",           label: `Low · ${counts.low}` },
                { value: "no-threshold",  label: `No reorder level · ${counts["no-threshold"]}` },
                { value: "ok",            label: `OK · ${counts.ok}` },
              ]}
            />
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600 sm:ml-auto dark:text-gray-400">
              <AntSwitch size="small" checked={includeHidden} onChange={setIncludeHidden} />
              Show hidden
            </label>
          </div>

          {/* Click a chip to filter the list down to that bucket; click the
              active one again to clear. */}
          {chips.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">Quick filter:</span>
              {chips.map(c => {
                const on = status === c.key;
                const tone =
                  c.key === "negative" || c.key === "out"
                    ? (on ? "border-red-500 bg-red-50 text-red-700 dark:border-red-400/60 dark:bg-red-500/15 dark:text-red-300" : "text-red-700 dark:text-red-300")
                    : c.key === "no-threshold"
                      ? (on ? "border-gray-500 bg-gray-100 text-gray-800 dark:border-white/30 dark:bg-white/10 dark:text-gray-100" : "text-gray-700 dark:text-gray-300")
                      : (on ? "border-amber-500 bg-amber-50 text-amber-800 dark:border-amber-400/60 dark:bg-amber-500/15 dark:text-amber-300" : "text-amber-700 dark:text-amber-300");
                return (
                  <button
                    key={c.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setStatus(on ? "all" : c.key)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition hover:shadow-sm ${on ? "font-semibold" : "border-gray-200 bg-white dark:border-white/10 dark:bg-white/[0.03]"} ${tone}`}
                  >
                    <span aria-hidden>{c.icon}</span>
                    {c.label}
                    <span className="tabular-nums opacity-80">· {c.count}</span>
                  </button>
                );
              })}
              {status !== "all" && (
                <Button size="small" type="link" icon={<CloseOutlined />} onClick={() => setStatus("all")} style={{ paddingInline: 4 }}>
                  Clear
                </Button>
              )}
            </div>
          )}
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
            scroll={{ x: 1080 }}
            rowClassName={(r) => {
              const h = health(r);
              return h === "low" ? "bg-amber-50/40 dark:bg-amber-500/[0.04]" : isStockProblem(h) ? "bg-red-50/50 dark:bg-red-500/[0.05]" : "";
            }}
            locale={{ emptyText: <Empty description={filtersActive ? "No ingredients match these filters" : "No ingredients yet"} /> }}
          />
        </div>

        {/* Mobile: stacked cards, same rows and handlers */}
        <div className="md:hidden">
          {firstLoad ? (
            <div className="p-4"><Skeleton active paragraph={{ rows: 6 }} /></div>
          ) : pageRows.length === 0 ? (
            <div className="py-10"><Empty description={filtersActive ? "No ingredients match these filters" : "No ingredients yet"} /></div>
          ) : (
            <ul className={`space-y-3 p-4 transition-opacity ${loading ? "opacity-60" : ""}`}>
              {pageRows.map(r => <IngredientCard key={r.id} r={r} a={rowActions} />)}
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
              showTotal={(t) => `${t} ingredient(s)`}
              onChange={(p, s) => { setPage(p); setPageSize(s); }}
              className="flex-wrap justify-center gap-y-2"
            />
          </div>
        )}
      </Panel>

      <Modal
        open={modal !== null}
        title={modalHead}
        onCancel={closeModal}
        onOk={handleSubmit}
        okText={modal === "add" ? "Create" : "Save"}
        width="min(560px, calc(100vw - 32px))"
        footer={
          <ModalFooter
            onCancel={closeModal}
            onOk={handleSubmit}
            okText={modal === "add" ? "Create" : "Save"}
            danger={modal === "waste"}
          />
        }
        destroyOnHidden
      >
        <Form form={form} layout="vertical" className="pt-3">
          {modal === "add" && (
            <div className="grid gap-x-4 sm:grid-cols-2">
              <Form.Item name="name" label="Name" rules={[{ required: true, message: "Required" }]}>
                <Input placeholder="Beef" />
              </Form.Item>
              <Form.Item name="unit" label="Unit" rules={[{ required: true }]}>
                <Select options={UNIT_OPTIONS} />
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
              <Form.Item name="notes" label="Notes (optional)" className="sm:col-span-2">
                <Input.TextArea rows={2} />
              </Form.Item>
            </div>
          )}

          {modal === "edit" && (
            <div className="grid gap-x-4 sm:grid-cols-2">
              <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
              <Form.Item name="unit" label="Unit" rules={[{ required: true }]}>
                <Select options={UNIT_OPTIONS} />
              </Form.Item>
              <Form.Item name="reorderLevel" label="Reorder level">
                <InputNumber min={0} step={0.1} style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name="buyPricePerUnit" label="Buy price per unit">
                <InputNumber min={0} step={0.01} prefix="$" style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name="notes" label="Notes" className="sm:col-span-2">
                <Input.TextArea rows={2} />
              </Form.Item>
              <Form.Item name="isActive" label="Active" valuePropName="checked">
                <AntSwitch />
              </Form.Item>
            </div>
          )}

          {modal === "stock-in" && (
            <>
              <StockPreview r={active} after={after} />
              <Form.Item name="quantity" label={`Quantity to add (${active?.unit ?? ""})`} rules={[{ required: true }]}>
                <InputNumber min={0.001} step={0.1} style={{ width: "100%" }} autoFocus />
              </Form.Item>
              <Form.Item name="notes" label="Notes (supplier, invoice #, etc.)">
                <Input.TextArea rows={2} />
              </Form.Item>
            </>
          )}

          {modal === "waste" && (
            <>
              <StockPreview r={active} after={after} />
              <div className="grid gap-x-4 sm:grid-cols-2">
                <Form.Item name="quantity" label={`Quantity wasted (${active?.unit ?? ""})`} rules={[{ required: true }]}>
                  <InputNumber min={0.001} step={0.1} style={{ width: "100%" }} autoFocus />
                </Form.Item>
                <Form.Item name="wasteReason" label="Reason" rules={[{ required: true }]}>
                  <Select options={WASTE_REASONS.map((r) => ({ value: r, label: r }))} />
                </Form.Item>
              </div>
              <Form.Item name="notes" label="Notes (optional)">
                <Input.TextArea rows={2} />
              </Form.Item>
            </>
          )}

          {modal === "adjust" && (
            <>
              <StockPreview r={active} after={after} />
              <Form.Item name="newQuantity" label={`New on-hand (${active?.unit ?? ""})`} rules={[{ required: true }]}>
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
