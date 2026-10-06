// Entry Categories
// ================
// Each category maps to the real account its entries post to. The account's
// type decides what the entries ARE — the dashboard classifies by account
// type, not by category name:
//   Expense → running cost · Asset → purchase you keep ·
//   Equity → owner drawing (never an expense) · Revenue → manual income.
// Unmapped categories fall back to 5900 Miscellaneous Expense.
// "Operating" vs "Asset" (IsCapital) splits Operating vs Capital expenses
// on the dashboard.

import { useEffect, useMemo, useState } from "react";
import { Button, Dropdown, Empty, Form, Input, Modal, Select, Skeleton, Tooltip, message } from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  MoreOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SyncOutlined,
  TagsOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { Link } from "react-router";
import {
  getExpenseCategories,
  createExpenseCategory,
  updateExpenseCategory,
  deleteExpenseCategory,
  getPostableAccounts,
  rebuildExpenseCategory,
  ExpenseCategoryDto,
  AccountDto,
} from "../../services/expenseService";
import { PageHeader, Panel, Pill, StatTile } from "../../components/ui/PageKit";
import { KIND_META, makeKindLookup, type CategoryKind } from "../../components/Accounting/entries/categoryKind";

type Filter = "all" | "operating" | "capital" | "drawing" | "unmapped";
type CategoryForm = { name: string; description?: string; isCapital: boolean; accountId?: number | null };

const TYPE_ORDER = ["Expense", "Asset", "Equity", "Revenue", "Liability", "Other"];
const TYPE_LABEL: Record<string, string> = {
  Expense: "Expense accounts",
  Asset: "Asset accounts",
  Equity: "Equity — owner drawings",
  Revenue: "Revenue — manual income",
  Liability: "Liability accounts",
  Other: "Other",
};

const errMsg = (e: unknown, fallback: string) =>
  e && typeof e === "object" && typeof (e as { message?: unknown }).message === "string" ? (e as { message: string }).message : fallback;

/** Operating vs Asset purchase, as two selectable cards (a Form control). */
function TypeCards({ value, onChange }: { value?: boolean; onChange?: (v: boolean) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3" role="radiogroup">
      {[
        { v: false, title: "Operating", text: "Recurring cost — shown in the monthly P&L." },
        { v: true, title: "Asset purchase", text: "One-time purchase you keep — shown separately as capital." },
      ].map((o) => (
        <button
          key={String(o.v)}
          type="button"
          role="radio"
          aria-checked={!!value === o.v}
          onClick={() => onChange?.(o.v)}
          className={`rounded-xl border p-3 text-left transition ${
            !!value === o.v
              ? "border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20 dark:bg-emerald-500/10"
              : "border-gray-200 hover:border-gray-300 dark:border-white/10"
          }`}
        >
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{o.title}</div>
          <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{o.text}</div>
        </button>
      ))}
    </div>
  );
}

export default function ExpenseCategories() {
  const [categories, setCategories] = useState<ExpenseCategoryDto[]>([]);
  const [accounts, setAccounts] = useState<AccountDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseCategoryDto | null>(null);
  const [formInit, setFormInit] = useState<Partial<CategoryForm>>({});
  const [submitting, setSubmitting] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [form] = Form.useForm<CategoryForm>();
  const watchAccount = Form.useWatch("accountId", form);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    Promise.all([getExpenseCategories(), getPostableAccounts()])
      .then(([c, a]) => {
        if (!alive) return;
        setCategories(c || []);
        setAccounts(a || []);
      })
      .catch((e) => { if (alive) setError(errMsg(e, "Failed to load categories")); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reloadToken]);

  const kindOf = useMemo(() => makeKindLookup(accounts), [accounts]);

  const counts = useMemo(() => ({
    all: categories.length,
    operating: categories.filter((c) => !c.isCapital).length,
    capital: categories.filter((c) => c.isCapital).length,
    drawing: categories.filter((c) => kindOf(c.accountId) === "drawing").length,
    unmapped: categories.filter((c) => kindOf(c.accountId) === "unmapped").length,
  }), [categories, kindOf]);

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    return [...categories]
      .filter((c) => {
        const k = kindOf(c.accountId);
        if (filter === "operating" && c.isCapital) return false;
        if (filter === "capital" && !c.isCapital) return false;
        if (filter === "drawing" && k !== "drawing") return false;
        if (filter === "unmapped" && k !== "unmapped") return false;
        if (!s) return true;
        return [c.name, c.description ?? "", c.accountNumber ?? "", c.accountName ?? "", KIND_META[k].label].join(" ").toLowerCase().includes(s);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [categories, filter, q, kindOf]);

  // Account picker grouped by type, in accounting order.
  const accountOptions = useMemo(() => {
    const groups = new Map<string, AccountDto[]>();
    for (const a of accounts) {
      const t = a.accountTypeName && TYPE_ORDER.includes(a.accountTypeName) ? a.accountTypeName : "Other";
      if (!groups.has(t)) groups.set(t, []);
      groups.get(t)!.push(a);
    }
    return TYPE_ORDER.filter((t) => groups.has(t)).map((t) => ({
      label: TYPE_LABEL[t],
      options: groups.get(t)!.map((a) => ({
        value: a.id,
        search: `${a.accountNumber} ${a.accountName} ${t}`.toLowerCase(),
        label: (
          <span className="flex items-center gap-2">
            <code className="text-xs text-gray-500">{a.accountNumber}</code>
            <span className="truncate">{a.accountName}</span>
          </span>
        ),
      })),
    }));
  }, [accounts]);

  // ── Form ────────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditing(null);
    setFormInit({ name: "", description: "", isCapital: false, accountId: null });
    setFormOpen(true);
  };

  const openEdit = (c: ExpenseCategoryDto) => {
    setEditing(c);
    setFormInit({ name: c.name, description: c.description ?? "", isCapital: c.isCapital ?? false, accountId: c.accountId ?? null });
    setFormOpen(true);
  };

  const submit = async () => {
    const v = await form.validateFields();
    const dto = { name: v.name.trim(), description: v.description?.trim() || null, accountId: v.accountId ?? null, isCapital: !!v.isCapital };
    setSubmitting(true);
    try {
      if (editing) {
        const updated = await updateExpenseCategory(editing.id, dto);
        setCategories((s) => s.map((c) => (c.id === editing.id ? updated : c)));
        message.success(editing.accountId !== dto.accountId ? "Category updated — its entries are being re-posted to the new account" : "Category updated");
      } else {
        const created = await createExpenseCategory(dto);
        setCategories((s) => [...s, created]);
        message.success("Category added");
      }
      setFormOpen(false);
    } catch (e) {
      message.error(errMsg(e, "Save failed"));
    } finally {
      setSubmitting(false);
    }
  };

  // Re-posts this category's entries to its mapped account (and creates any
  // missing journal entries). Synchronous, reports what it did.
  const rebuild = async () => {
    if (!editing) return;
    setRebuilding(true);
    try {
      const r = await rebuildExpenseCategory(editing.id);
      if (r.total === 0) message.info("This category has no entries yet — nothing to post.");
      else if (r.failed > 0) message.warning(`Processed ${r.total} entries, ${r.failed} failed. ${r.errors.slice(0, 2).join("; ")}`);
      else message.success(`Re-posted ${r.total} entries to the account. Refresh the Chart of Accounts to see the balance.`);
    } catch (e) {
      message.error(errMsg(e, "Rebuild failed"));
    } finally {
      setRebuilding(false);
    }
  };

  const confirmDelete = (c: ExpenseCategoryDto) => {
    Modal.confirm({
      title: `Delete “${c.name}”?`,
      content: "Only possible when no entry uses it. This cannot be undone.",
      okText: "Delete",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteExpenseCategory(c.id);
          setCategories((s) => s.filter((x) => x.id !== c.id));
          message.success("Category deleted");
        } catch (e) {
          message.error(errMsg(e, "Delete failed — is it still used by entries?"));
        }
      },
    });
  };

  const formKind: CategoryKind = kindOf(watchAccount ?? null);
  const accountChanged = !!editing && (editing.accountId ?? null) !== (watchAccount ?? null);

  const tiles: { key: Filter; label: string; value: number; sub: string; accent?: React.ReactNode }[] = [
    { key: "all", label: "All categories", value: counts.all, sub: "Click a tile to filter" },
    { key: "operating", label: "Operating", value: counts.operating, sub: "Running costs, in monthly P&L" },
    { key: "capital", label: "Asset purchases", value: counts.capital, sub: "One-time, shown as capital" },
    { key: "drawing", label: "Owner drawings", value: counts.drawing, sub: "Equity — never an expense" },
    {
      key: "unmapped",
      label: "Not mapped",
      value: counts.unmapped,
      sub: counts.unmapped ? "Falls back to 5900 — map them" : "Every category has an account",
      accent: counts.unmapped ? <span className="text-amber-500"><WarningOutlined /></span> : undefined,
    },
  ];

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6">
      <PageHeader
        tone="emerald"
        icon={<TagsOutlined />}
        title="Entry Categories"
        description="Each category posts to a real account. The account's type decides what its entries are — expense, asset, owner drawing or income — on every report."
        actions={
          <>
            <Tooltip title="Refresh">
              <Button icon={<ReloadOutlined />} onClick={() => setReloadToken((t) => t + 1)} loading={loading} aria-label="Refresh" />
            </Tooltip>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Add category</Button>
          </>
        }
      />

      {/* Tiles = filters */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {tiles.map((t) => (
          <StatTile
            key={t.key}
            label={t.label}
            value={t.value}
            sub={t.sub}
            accent={t.accent}
            loading={loading && categories.length === 0}
            active={filter === t.key}
            onClick={() => setFilter(t.key)}
          />
        ))}
      </div>

      <Panel
        title={filter === "all" ? "All categories" : tiles.find((t) => t.key === filter)!.label}
        subtitle={`${visible.length} of ${categories.length}`}
        bodyClassName="p-0"
        extra={
          <Input
            allowClear
            prefix={<SearchOutlined className="text-gray-400" />}
            placeholder="Search name, account…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ width: 260 }}
          />
        }
      >
        {error ? (
          <div className="m-5 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</div>
        ) : loading && categories.length === 0 ? (
          <div className="p-5"><Skeleton active paragraph={{ rows: 6 }} /></div>
        ) : visible.length === 0 ? (
          <div className="py-12"><Empty description={q ? `Nothing matches “${q}”` : "No categories here"} /></div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-white/[0.06]">
            {visible.map((c) => {
              const kind = kindOf(c.accountId);
              const meta = KIND_META[kind];
              return (
                <li key={c.id} className="group flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3.5 transition hover:bg-gray-50/70 dark:hover:bg-white/[0.02]">
                  <div className="min-w-[200px] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => openEdit(c)} className="text-left font-medium text-gray-900 hover:text-emerald-700 dark:text-gray-100 dark:hover:text-emerald-300">
                        {c.name}
                      </button>
                      <Pill tone={c.isCapital ? "purple" : "gray"}>{c.isCapital ? "Asset purchase" : "Operating"}</Pill>
                    </div>
                    <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{c.description || <span className="text-gray-400">#{c.id}</span>}</div>
                  </div>

                  <div className="flex min-w-[260px] items-center gap-2 sm:w-[380px]">
                    {kind === "unmapped" ? (
                      <Tooltip title={meta.hint}>
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-amber-300 bg-amber-50/60 px-2.5 py-1 text-xs text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                          <WarningOutlined /> Not mapped · falls back to 5900
                        </span>
                      </Tooltip>
                    ) : (
                      <>
                        <span className="inline-flex min-w-0 items-center gap-2 rounded-lg bg-gray-50 px-2.5 py-1 text-xs dark:bg-white/5">
                          <code className="text-gray-500">{c.accountNumber}</code>
                          <span className="truncate text-gray-800 dark:text-gray-200">{c.accountName}</span>
                        </span>
                        <Tooltip title={meta.hint}><span><Pill tone={meta.tone} dot>{meta.label}</Pill></span></Tooltip>
                      </>
                    )}
                  </div>

                  <Dropdown
                    trigger={["click"]}
                    menu={{
                      items: [
                        { key: "edit", icon: <EditOutlined />, label: "Edit", onClick: () => openEdit(c) },
                        { key: "delete", icon: <DeleteOutlined />, label: "Delete", danger: true, onClick: () => confirmDelete(c) },
                      ],
                    }}
                  >
                    <Button type="text" size="small" icon={<MoreOutlined />} aria-label="Actions" />
                  </Dropdown>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {/* Add / edit */}
      <Modal
        open={formOpen}
        title={editing ? `Edit category — ${editing.name}` : "Add category"}
        onCancel={() => setFormOpen(false)}
        destroyOnHidden
        width={580}
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              {editing && (
                <Tooltip title={!watchAccount ? "Map an account first" : accountChanged ? "Save first — rebuild uses the saved mapping" : "Re-post every entry of this category to its mapped account"}>
                  <Button icon={<SyncOutlined spin={rebuilding} />} onClick={rebuild} loading={rebuilding} disabled={!watchAccount || accountChanged}>
                    Rebuild balances
                  </Button>
                </Tooltip>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setFormOpen(false)}>Cancel</Button>
              <Button type="primary" onClick={submit} loading={submitting}>{editing ? "Save changes" : "Add category"}</Button>
            </div>
          </div>
        }
      >
        <Form form={form} layout="vertical" preserve={false} initialValues={formInit} requiredMark={false} className="pt-2">
          <Form.Item name="name" label="Name" rules={[{ required: true, whitespace: true, message: "Name is required" }]}>
            <Input placeholder="e.g. Electrical Bill" maxLength={150} />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Optional" maxLength={500} />
          </Form.Item>

          <Form.Item name="isCapital" label="Type">
            <TypeCards />
          </Form.Item>

          <Form.Item name="accountId" label="Posts to account" extra="The account's type decides what the entries are on every report. Changing it re-posts this category's existing entries automatically.">
            <Select
              allowClear
              showSearch
              placeholder="Not mapped (falls back to 5900)"
              options={accountOptions}
              filterOption={(input, opt) => ((opt as { search?: string } | undefined)?.search ?? "").includes(input.toLowerCase())}
            />
          </Form.Item>

          <div
            className={`rounded-lg px-3 py-2 text-xs ${
              formKind === "unmapped"
                ? "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200"
                : formKind === "drawing"
                  ? "bg-violet-50 text-violet-800 dark:bg-violet-500/10 dark:text-violet-200"
                  : "bg-gray-50 text-gray-600 dark:bg-white/5 dark:text-gray-300"
            }`}
          >
            <b>{KIND_META[formKind].label}:</b> {KIND_META[formKind].hint}
            {formKind === "drawing" && <> Each owner has their own account under <Link to="/accounting/owners-drawings" className="font-medium underline">Owners' Drawings</Link>.</>}
          </div>
        </Form>
      </Modal>
    </div>
  );
}
