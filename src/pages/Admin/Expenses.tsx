// Entries (Expenses)
// ==================
// Every manual entry: rent, salaries, supplies… and the legacy "cash out"
// categories that post to an owner's drawings account. Each entry posts
// DR <category's account> / CR 1000 Cash, one journal entry per month it
// covers. Entries whose category maps to an Equity account are owner
// drawings: listed here, but kept out of the expense total.
//
// Dates are calendar days ("YYYY-MM-DD") end to end — never an instant —
// so a day picked in Beirut is the day saved.

import { useEffect, useMemo, useState } from "react";
import {
  AutoComplete,
  Button,
  DatePicker,
  Dropdown,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Segmented,
  Select,
  Table,
  Tooltip,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  FilterOutlined,
  MoreOutlined,
  PlusOutlined,
  ReloadOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import dayjs, { Dayjs } from "dayjs";
import { Link } from "react-router";
import {
  queryExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getExpenseCategories,
  getPostableAccounts,
  AccountDto,
  ExpenseDto,
  ExpenseCategoryDto,
} from "../../services/expenseService";
import { PageHeader, Panel, Pill, StatTile } from "../../components/ui/PageKit";
import { KIND_META, makeKindLookup, money, moneyCompact, parseDay } from "../../components/Accounting/entries/categoryKind";

const { RangePicker } = DatePicker;

const ymd = (d: Dayjs) => d.format("YYYY-MM-DD");
const dayOf = (iso: string) => dayjs(parseDay(iso));

const PAYMENT_METHODS = ["Cash", "Card", "Bank transfer", "Cheque", "Whish", "OMT"];

const PERIODS: { key: string; label: string; range: () => [Dayjs, Dayjs] | null }[] = [
  { key: "all", label: "All time", range: () => null },
  { key: "month", label: "This month", range: () => [dayjs().startOf("month"), dayjs().endOf("month")] },
  { key: "last", label: "Last month", range: () => [dayjs().subtract(1, "month").startOf("month"), dayjs().subtract(1, "month").endOf("month")] },
  { key: "year", label: "This year", range: () => [dayjs().startOf("year"), dayjs().endOf("year")] },
];

const errMsg = (e: unknown, fallback: string) =>
  e && typeof e === "object" && typeof (e as { message?: unknown }).message === "string" ? (e as { message: string }).message : fallback;

type EntryForm = {
  categoryId: number;
  amount: number;
  paymentMethod?: string;
  comment?: string;
  mode: "day" | "range";
  day?: Dayjs;
  range?: [Dayjs, Dayjs];
};

/** "Oct 4, 2026" or "Jan 1 – Mar 31, 2026" + how many months it spans. */
function periodOf(e: ExpenseDto) {
  const f = dayOf(e.fromDate);
  const t = dayOf(e.toDate);
  if (f.isSame(t, "day")) return { text: f.format("MMM D, YYYY"), months: 1, range: false };
  const sameYear = f.year() === t.year();
  const months = (t.year() - f.year()) * 12 + (t.month() - f.month()) + 1;
  return { text: `${f.format(sameYear ? "MMM D" : "MMM D, YYYY")} – ${t.format("MMM D, YYYY")}`, months, range: true };
}

export default function Expenses() {
  const [expenses, setExpenses] = useState<ExpenseDto[]>([]);
  const [categories, setCategories] = useState<ExpenseCategoryDto[]>([]);
  const [accounts, setAccounts] = useState<AccountDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [totalCount, setTotalCount] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [totalAmountAll, setTotalAmountAll] = useState(0);
  const [totalOwnerDrawingsAll, setTotalOwnerDrawingsAll] = useState(0);
  const [reloadToken, setReloadToken] = useState(0);

  // Filters
  const [period, setPeriod] = useState<string>("all");
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [filterCategoryId, setFilterCategoryId] = useState<number | null>(null);

  // Form
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseDto | null>(null);
  const [formInit, setFormInit] = useState<Partial<EntryForm>>({});
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<EntryForm>();
  const watchMode = Form.useWatch("mode", form);
  const watchCategory = Form.useWatch("categoryId", form);
  const watchRange = Form.useWatch("range", form);

  const kindOf = useMemo(() => makeKindLookup(accounts), [accounts]);
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const kindOfCategory = (categoryId: number | null | undefined) => {
    const c = categoryId != null ? catById.get(categoryId) : undefined;
    return c ? kindOf(c.accountId) : "expense";
  };

  // Load entries
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    queryExpenses({
      page,
      pageSize,
      categoryId: filterCategoryId || undefined,
      from: range ? ymd(range[0]) : undefined,
      to: range ? ymd(range[1]) : undefined,
    })
      .then((r) => {
        if (!alive) return;
        setExpenses(r.items || []);
        setTotalCount(r.totalCount || 0);
        setTotalAmount(r.totalAmount || 0);
        setTotalAmountAll(r.totalAmountAll || 0);
        setTotalOwnerDrawingsAll(r.totalOwnerDrawingsAll || 0);
      })
      .catch((e) => { if (alive) setError(errMsg(e, "Failed to load entries")); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [page, filterCategoryId, range, reloadToken]);

  // Categories + accounts (for each category's kind)
  useEffect(() => {
    getExpenseCategories().then((d) => setCategories(d || [])).catch(() => {});
    getPostableAccounts().then((d) => setAccounts(d || [])).catch(() => {});
  }, []);

  const categoryOptions = useMemo(
    () =>
      [...categories]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((c) => {
          const k = KIND_META[kindOf(c.accountId)];
          return {
            value: c.id,
            search: `${c.name} ${c.accountNumber ?? ""} ${k.label}`.toLowerCase(),
            label: (
              <span className="flex items-center justify-between gap-2">
                <span className="truncate">{c.name}</span>
                {k.label !== "Expense" && <Pill tone={k.tone}>{k.label}</Pill>}
              </span>
            ),
          };
        }),
    [categories, kindOf]
  );

  const filtersActive = !!filterCategoryId || !!range;
  const reload = () => setReloadToken((t) => t + 1);

  // ── Form ────────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditing(null);
    setFormInit({ mode: "day", day: dayjs(), paymentMethod: "Cash" });
    setFormOpen(true);
  };

  const openEdit = (e: ExpenseDto) => {
    const f = dayOf(e.fromDate);
    const t = dayOf(e.toDate);
    const single = f.isSame(t, "day");
    setEditing(e);
    setFormInit({
      categoryId: e.categoryId,
      amount: e.amount,
      paymentMethod: e.paymentMethod ?? undefined,
      comment: e.comment ?? "",
      mode: single ? "day" : "range",
      day: single ? f : undefined,
      range: single ? undefined : [f, t],
    });
    setFormOpen(true);
  };

  const submit = async () => {
    const v = await form.validateFields();
    const [from, to] = v.mode === "day" ? [v.day!, v.day!] : v.range!;
    const dto = {
      categoryId: v.categoryId,
      amount: v.amount,
      paymentMethod: v.paymentMethod?.trim() || null,
      comment: v.comment?.trim() || null,
      fromDate: ymd(from),
      toDate: ymd(to),
    };
    setSubmitting(true);
    try {
      if (editing) {
        await updateExpense(editing.id, dto);
        message.success("Entry updated");
      } else {
        await createExpense(dto);
        message.success("Entry added");
      }
      setFormOpen(false);
      reload();
    } catch (e) {
      message.error(errMsg(e, "Save failed"));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = (e: ExpenseDto) => {
    Modal.confirm({
      title: "Delete this entry?",
      content: (
        <div className="space-y-2">
          <div className="rounded-lg border border-gray-100 p-3 dark:border-white/10">
            <div className="flex justify-between gap-3">
              <span className="font-medium">{e.categoryName}</span>
              <span className="font-semibold tabular-nums">{money(e.amount)}</span>
            </div>
            <div className="text-xs text-gray-500">{periodOf(e).text}{e.comment ? ` · ${e.comment}` : ""}</div>
          </div>
          <p className="text-sm text-gray-500">Its journal entries are removed too. This cannot be undone.</p>
        </div>
      ),
      okText: "Delete",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteExpense(e.id);
          message.success("Entry deleted");
          reload();
        } catch (err) {
          message.error(errMsg(err, "Delete failed"));
        }
      },
    });
  };

  // ── Table ───────────────────────────────────────────────────────────
  const columns: ColumnsType<ExpenseDto> = [
    {
      title: "Date",
      key: "period",
      width: 190,
      render: (_, e) => {
        const p = periodOf(e);
        return (
          <div>
            <div className="whitespace-nowrap font-medium tabular-nums text-gray-900 dark:text-gray-100">{p.text}</div>
            {p.range && <div className="mt-0.5 text-[11px] text-gray-500">spread over {p.months} month{p.months === 1 ? "" : "s"}</div>}
          </div>
        );
      },
    },
    {
      title: "Category",
      dataIndex: "categoryName",
      render: (v: string, e) => {
        const kind = kindOfCategory(e.categoryId);
        const meta = KIND_META[kind];
        return (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-gray-900 dark:text-gray-100">{v}</span>
            {kind !== "expense" && (
              <Tooltip title={meta.hint}>
                <span><Pill tone={meta.tone} dot>{meta.label}</Pill></span>
              </Tooltip>
            )}
          </div>
        );
      },
    },
    {
      title: "Amount",
      dataIndex: "amount",
      align: "right",
      width: 130,
      render: (v: number, e) => {
        const drawing = kindOfCategory(e.categoryId) === "drawing";
        return (
          <Tooltip title={drawing ? "Owner drawing — not counted in Total expenses" : undefined}>
            <span className={`whitespace-nowrap font-semibold tabular-nums ${drawing ? "text-violet-700 dark:text-violet-300" : "text-gray-900 dark:text-gray-100"}`}>{money(v)}</span>
          </Tooltip>
        );
      },
    },
    {
      title: "Paid by",
      dataIndex: "paymentMethod",
      width: 120,
      render: (v: string | null) => (v ? <Pill>{v}</Pill> : <span className="text-gray-400">—</span>),
    },
    {
      title: "Comment",
      dataIndex: "comment",
      ellipsis: { showTitle: false },
      render: (v: string | null) =>
        v ? <Tooltip title={v} placement="topLeft"><span className="text-gray-600 dark:text-gray-300">{v}</span></Tooltip> : <span className="text-gray-400">—</span>,
    },
    {
      title: "Added",
      dataIndex: "createdOn",
      width: 120,
      render: (v: string, e) => (
        <div className="text-xs text-gray-500">
          <div className="tabular-nums">{dayjs(v).format("MMM D, YYYY")}</div>
          <div className="text-gray-400">#{e.id}</div>
        </div>
      ),
    },
    {
      title: "",
      key: "act",
      width: 56,
      align: "right",
      render: (_, e) => (
        <Dropdown
          trigger={["click"]}
          menu={{
            items: [
              { key: "edit", icon: <EditOutlined />, label: "Edit", onClick: () => openEdit(e) },
              { key: "delete", icon: <DeleteOutlined />, label: "Delete", danger: true, onClick: () => confirmDelete(e) },
            ],
          }}
        >
          <Button type="text" size="small" icon={<MoreOutlined />} aria-label="Actions" />
        </Dropdown>
      ),
    },
  ];

  // Form helpers
  const selectedKind = watchCategory ? kindOfCategory(watchCategory) : null;
  const selectedCat = watchCategory ? catById.get(watchCategory) : undefined;
  const rangeMonths = watchMode === "range" && watchRange?.[0] && watchRange?.[1]
    ? (watchRange[1].year() - watchRange[0].year()) * 12 + (watchRange[1].month() - watchRange[0].month()) + 1
    : 0;

  const periodLabel = range ? `${range[0].format("MMM D, YYYY")} – ${range[1].format("MMM D, YYYY")}` : "All time";

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6">
      <PageHeader
        tone="blue"
        icon={<FileTextOutlined />}
        title="Entries"
        description="Every manual entry — rent, salaries, supplies, cash outs. Each one posts to its category's account against 1000 Cash, one journal entry per month it covers."
        actions={
          <>
            <Tooltip title="Refresh">
              <Button icon={<ReloadOutlined />} onClick={reload} loading={loading} aria-label="Refresh" />
            </Tooltip>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Add entry</Button>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="max-w-full overflow-x-auto">
            <Segmented
              value={period}
              onChange={(k) => {
                const p = PERIODS.find((x) => x.key === k);
                setPeriod(String(k));
                if (p) { setRange(p.range()); setPage(1); }
              }}
              options={[...PERIODS.map((p) => ({ label: p.label, value: p.key })), { label: "Custom", value: "custom" }]}
            />
          </div>
          <RangePicker
            value={range}
            onChange={(v) => {
              setRange(v && v[0] && v[1] ? [v[0], v[1]] : null);
              setPeriod(v ? "custom" : "all");
              setPage(1);
            }}
          />
          <Select
            allowClear
            showSearch
            placeholder={<span><FilterOutlined /> All categories</span>}
            style={{ minWidth: 240 }}
            value={filterCategoryId ?? undefined}
            onChange={(v) => { setFilterCategoryId(v ?? null); setPage(1); }}
            options={categoryOptions}
            filterOption={(input, opt) => (opt?.search ?? "").includes(input.toLowerCase())}
          />
          {filtersActive && (
            <Button type="link" onClick={() => { setFilterCategoryId(null); setRange(null); setPeriod("all"); setPage(1); }}>
              Clear filters
            </Button>
          )}
        </div>
      </PageHeader>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Total expenses"
          loading={loading && totalCount === 0}
          value={moneyCompact(totalAmountAll)}
          sub={<>{periodLabel}{filterCategoryId ? <> · {catById.get(filterCategoryId)?.name}</> : null} · owner drawings excluded</>}
          accent={<span className="rounded-lg bg-blue-50 p-1.5 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300"><FileTextOutlined /></span>}
        />
        <StatTile label="Entries" loading={loading && totalCount === 0} value={totalCount.toLocaleString("en-US")} sub="Matching the filters" />
        <StatTile label="On this page" loading={loading && totalCount === 0} value={moneyCompact(totalAmount)} sub={`Page ${page} of ${Math.max(1, Math.ceil(totalCount / pageSize))}`} />
        <StatTile
          label="Owner drawings"
          loading={loading && totalCount === 0}
          value={moneyCompact(totalOwnerDrawingsAll)}
          accent={<span className="rounded-lg bg-violet-50 p-1.5 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300"><WalletOutlined /></span>}
          sub={<>Cash outs in these entries — not an expense · <Link to="/accounting/owners-drawings" className="font-medium text-violet-700 dark:text-violet-300">Owners' Drawings →</Link></>}
        />
      </div>

      {/* Table */}
      <Panel
        title="All entries"
        subtitle={<>{totalCount.toLocaleString("en-US")} entr{totalCount === 1 ? "y" : "ies"} · newest period first</>}
        bodyClassName="p-0"
      >
        {error ? (
          <div className="m-5 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</div>
        ) : (
          <Table
            rowKey="id"
            size="middle"
            loading={loading}
            columns={columns}
            dataSource={expenses}
            scroll={{ x: 1000 }}
            locale={{ emptyText: <Empty description={filtersActive ? "No entries match these filters" : "No entries yet"} /> }}
            pagination={{
              current: page,
              pageSize,
              total: totalCount,
              onChange: setPage,
              showSizeChanger: false,
              showTotal: (t, [a, b]) => `${a}–${b} of ${t.toLocaleString("en-US")}`,
              style: { paddingInline: 20 },
            }}
          />
        )}
      </Panel>

      {/* Add / edit */}
      <Modal
        open={formOpen}
        title={editing ? `Edit entry #${editing.id}` : "Add entry"}
        onCancel={() => setFormOpen(false)}
        onOk={submit}
        okText={editing ? "Save changes" : "Add entry"}
        confirmLoading={submitting}
        destroyOnHidden
        width={560}
      >
        <Form form={form} layout="vertical" preserve={false} initialValues={formInit} requiredMark={false} className="pt-2">
          <Form.Item name="categoryId" label="Category" rules={[{ required: true, message: "Pick a category" }]}>
            <Select
              showSearch
              placeholder="What is it for?"
              options={categoryOptions}
              filterOption={(input, opt) => (opt?.search ?? "").includes(input.toLowerCase())}
            />
          </Form.Item>

          {selectedKind && selectedKind !== "expense" && (
            <div className={`-mt-2 mb-4 rounded-lg px-3 py-2 text-xs ${selectedKind === "unmapped" ? "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200" : "bg-violet-50 text-violet-800 dark:bg-violet-500/10 dark:text-violet-200"}`}>
              {KIND_META[selectedKind].hint}
              {selectedCat?.accountNumber && <> Account: <b>{selectedCat.accountNumber} {selectedCat.accountName}</b>.</>}
              {selectedKind === "drawing" && <> You can also record it on <Link to="/accounting/owners-drawings" className="font-medium underline">Owners' Drawings</Link>.</>}
            </div>
          )}

          <div className="grid gap-x-3 sm:grid-cols-2">
            <Form.Item name="amount" label="Amount" rules={[{ required: true, message: "Amount is required" }, { type: "number", min: 0.01, message: "Must be more than 0" }]}>
              <InputNumber min={0.01} step={10} precision={2} prefix="$" style={{ width: "100%" }} placeholder="0.00" />
            </Form.Item>
            <Form.Item name="paymentMethod" label="Paid by">
              <AutoComplete options={PAYMENT_METHODS.map((m) => ({ value: m }))} placeholder="Cash, Card…" filterOption={(i, o) => (o?.value ?? "").toLowerCase().includes(i.toLowerCase())} />
            </Form.Item>
          </div>

          <Form.Item name="mode" label="When">
            <Segmented
              block
              options={[
                { value: "day", label: "One day" },
                { value: "range", label: "Spread over a period" },
              ]}
            />
          </Form.Item>
          {watchMode === "range" ? (
            <Form.Item
              name="range"
              rules={[{ required: true, message: "Pick the period" }]}
              extra={rangeMonths > 1 ? `Booked as ${rangeMonths} monthly journal entries, split by days in each month.` : "e.g. rent for a year, salaries for a quarter."}
            >
              <RangePicker style={{ width: "100%" }} />
            </Form.Item>
          ) : (
            <Form.Item name="day" rules={[{ required: true, message: "Pick the date" }]}>
              <DatePicker style={{ width: "100%" }} />
            </Form.Item>
          )}

          <Form.Item name="comment" label="Comment">
            <Input.TextArea rows={2} maxLength={500} placeholder="Optional — what was it exactly?" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
