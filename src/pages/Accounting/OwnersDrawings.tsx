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
// they are. Clicking an owner opens the detail popup.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
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
  Skeleton,
  Switch,
  Table,
  Tooltip,
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
  AppstoreOutlined,
  UnorderedListOutlined,
  MoreOutlined,
  ArrowRightOutlined,
  WarningOutlined,
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
import DrawingsComposition from "../../components/Accounting/owners/DrawingsComposition";
import { Eyebrow, OwnerAvatar, ShareMeter, StatusBadge } from "../../components/Accounting/owners/ownerVisuals";
import { PageHeader, Panel, StatTile } from "../../components/ui/PageKit";
import { money, moneyCompact, pct, useOwnerColors } from "../../components/Accounting/owners/ownerFormat";

const { RangePicker } = DatePicker;

const ymd = (d: Dayjs) => d.format("YYYY-MM-DD");

const PAYMENT_METHODS = ["Cash", "Bank transfer", "Cheque", "Whish", "OMT", "Other"];

// Quick period chips. "custom" = whatever the range picker holds.
const PRESETS: { key: string; label: string; range: () => [Dayjs, Dayjs] }[] = [
  { key: "month", label: "This month", range: () => [dayjs().startOf("month"), dayjs().endOf("day")] },
  { key: "last", label: "Last month", range: () => [dayjs().subtract(1, "month").startOf("month"), dayjs().subtract(1, "month").endOf("month")] },
  { key: "quarter", label: "This quarter", range: () => [dayjs().startOf("month").subtract(dayjs().month() % 3, "month"), dayjs().endOf("day")] },
  { key: "year", label: "This year", range: () => [dayjs().startOf("year"), dayjs().endOf("day")] },
  { key: "lastyear", label: "Last year", range: () => [dayjs().subtract(1, "year").startOf("year"), dayjs().subtract(1, "year").endOf("year")] },
];

const errMsg = (e: unknown, fallback: string) =>
  e && typeof e === "object" && typeof (e as { message?: unknown }).message === "string"
    ? (e as { message: string }).message
    : fallback;

type OwnerForm = { name: string; ownershipPercent: number; notes?: string; isActive: boolean; existingAccountId?: number | null };
type DrawingForm = { ownerId: number; amount: number; drawingDate: Dayjs; paymentMethod?: string; comment?: string };

export default function OwnersDrawings() {
  const [range, setRange] = useState<[Dayjs, Dayjs]>(PRESETS[3].range());
  const [preset, setPreset] = useState<string>("year");
  const [summary, setSummary] = useState<OwnerDrawingsSummaryDto | null>(null);
  const [owners, setOwners] = useState<OwnerDto[]>([]);
  const [showHiddenOwners, setShowHiddenOwners] = useState(false);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"cards" | "table">("cards");

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
  const pctOff = Math.abs(totalPct - 100) > 0.004;

  // Colour follows the owner (by id), so every chart, card and row agrees.
  const color = useOwnerColors([...(summary?.owners ?? []).map((o) => o.ownerId), ...owners.map((o) => o.id)]);

  const summaryRows: (OwnerDrawingsLineDto & { key: string; other?: boolean })[] = useMemo(() => [
    ...(summary?.owners ?? []).map((o) => ({ ...o, key: `o-${o.accountId}` })),
    ...(summary?.otherAccounts ?? []).map((o) => ({ ...o, key: `x-${o.accountId}`, other: true })),
  ], [summary]);

  const periodLabel = `${range[0].format("MMM D, YYYY")} – ${range[1].format("MMM D, YYYY")}`;
  const topOver = useMemo(() => {
    const over = (summary?.owners ?? []).filter((o) => o.variance > 0.004).sort((a, b) => b.variance - a.variance);
    return over[0] ?? null;
  }, [summary]);

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

  // ── Table view of the summary (also the accessible view of the cards) ──
  const summaryColumns: ColumnsType<OwnerDrawingsLineDto & { key: string; other?: boolean }> = [
    {
      title: "Owner",
      key: "name",
      render: (_, r) => (
        <button type="button" onClick={() => setDetailRow(r)} className="flex items-center gap-3 text-left">
          <OwnerAvatar name={r.name} color={color(r.ownerId)} size={32} />
          <span>
            <span className="block font-medium text-gray-900 hover:text-violet-700 dark:text-gray-100">{r.name}</span>
            <span className="block text-xs text-gray-500">{r.accountNumber} · {r.accountName}{r.other ? " · no owner linked" : ""}</span>
          </span>
        </button>
      ),
    },
    { title: "Ownership", dataIndex: "ownershipPercent", align: "right", width: 100, render: (v: number, r) => (r.ownerId ? pct(v) : "—") },
    { title: "Drawn", dataIndex: "drawn", align: "right", width: 130, render: (v: number) => <span className="font-semibold tabular-nums">{money(v)}</span> },
    {
      title: <Tooltip title="Drawn ÷ total drawings of all owners. The dark tick is the ownership %.">Share of drawings <InfoCircleOutlined /></Tooltip>,
      key: "share",
      width: 210,
      render: (_, r) => (
        <div className="space-y-1">
          <ShareMeter share={r.shareOfDrawingsPercent} owned={r.ownershipPercent} color={color(r.ownerId)} showOwned={r.ownerId != null} />
          <div className="text-xs tabular-nums text-gray-600 dark:text-gray-300">{pct(r.shareOfDrawingsPercent)}</div>
        </div>
      ),
    },
    { title: <Tooltip title="Total drawings × ownership %">Fair share <InfoCircleOutlined /></Tooltip>, dataIndex: "entitledAmount", align: "right", width: 120, render: (v: number, r) => (r.ownerId ? <span className="tabular-nums">{money(v)}</span> : "—") },
    { title: "Over / (under)", dataIndex: "variance", align: "right", width: 170, render: (v: number, r) => (r.ownerId ? <StatusBadge variance={v} /> : "—") },
    { title: "Entries", dataIndex: "entryCount", align: "right", width: 80 },
    { title: "Lifetime", dataIndex: "lifetimeDrawn", align: "right", width: 120, render: (v: number) => <span className="tabular-nums text-gray-500">{money(v)}</span> },
  ];

  // ── Drawings register ───────────────────────────────────────────────
  const drawingColumns: ColumnsType<OwnerDrawingDto> = [
    {
      title: "Date",
      dataIndex: "drawingDate",
      width: 120,
      render: (v: string) => <span className="tabular-nums">{dayjs(v.slice(0, 10)).format("MMM D, YYYY")}</span>,
    },
    {
      title: "Owner",
      dataIndex: "ownerName",
      render: (v: string, r) => (
        <span className="flex items-center gap-2">
          <OwnerAvatar name={v} color={color(r.ownerId)} size={26} />
          <span className="font-medium text-gray-900 dark:text-gray-100">{v}</span>
        </span>
      ),
    },
    {
      title: "Amount",
      dataIndex: "amount",
      align: "right",
      width: 130,
      render: (v: number, r) => (
        <span className={`tabular-nums ${r.isVoided ? "text-gray-400 line-through" : "font-semibold text-gray-900 dark:text-gray-100"}`}>{money(v)}</span>
      ),
    },
    {
      title: "Method",
      dataIndex: "paymentMethod",
      width: 130,
      render: (v: string | null) =>
        v ? <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-white/5 dark:text-gray-300">{v}</span> : <span className="text-gray-400">—</span>,
    },
    { title: "Comment", dataIndex: "comment", render: (v: string | null) => v || <span className="text-gray-400">—</span> },
    {
      title: "Journal entry",
      dataIndex: "journalEntryNumber",
      width: 140,
      render: (v: string | null) => (v ? <code className="rounded bg-gray-50 px-1.5 py-0.5 text-[11px] text-gray-600 dark:bg-white/5 dark:text-gray-300">{v}</code> : "—"),
    },
    {
      title: "Status",
      key: "status",
      width: 120,
      render: (_, r) =>
        r.isVoided ? (
          <Tooltip title={r.voidReason ?? undefined}>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-500/10 dark:text-red-300">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Cancelled
            </span>
          </Tooltip>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Posted
          </span>
        ),
    },
    {
      title: "",
      key: "act",
      width: 56,
      render: (_, r) =>
        r.isVoided ? null : (
          <Dropdown
            trigger={["click"]}
            menu={{
              items: [
                { key: "edit", icon: <EditOutlined />, label: "Edit", onClick: () => openDrawingModal(r) },
                { key: "void", icon: <StopOutlined />, label: "Cancel drawing", danger: true, onClick: () => { setVoidTarget(r); setVoidReason(""); } },
              ],
            }}
          >
            <Button type="text" size="small" icon={<MoreOutlined />} aria-label="Actions" />
          </Dropdown>
        ),
    },
  ];

  const otherHeld = owners.filter((o) => o.isActive && o.id !== ownerModal.editing?.id).reduce((a, o) => a + o.ownershipPercent, 0);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <PageHeader
        icon={<WalletOutlined />}
        title="Owners' Drawings"
        badge="Equity · not an expense"
        description={<>Cash the owners take out for personal use. Each drawing posts <b>DR</b> the owner's drawings account / <b>CR</b> 1000 Cash — it reduces equity and Cash on Hand, never Net Income.</>}
        actions={
          <>
            <Tooltip title="Refresh">
              <Button icon={<ReloadOutlined />} onClick={reloadAll} loading={loading} aria-label="Refresh" />
            </Tooltip>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openDrawingModal(null)} disabled={activeOwners.length === 0}>
              Record drawing
            </Button>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          {/* Chips scroll sideways on a phone instead of overflowing. */}
          <div className="max-w-full overflow-x-auto">
            <Segmented
              value={preset}
              onChange={(k) => {
                const p = PRESETS.find((x) => x.key === k);
                setPreset(String(k));
                if (p) setRange(p.range());
              }}
              options={[...PRESETS.map((p) => ({ label: p.label, value: p.key })), { label: "Custom", value: "custom" }]}
            />
          </div>
          <RangePicker
            value={range}
            allowClear={false}
            onChange={(v) => {
              if (v && v[0] && v[1]) { setRange([v[0], v[1]]); setPreset("custom"); }
            }}
          />
        </div>
      </PageHeader>

      {/* ── Notices ────────────────────────────────────────────────── */}
      {summary && activeOwners.length === 0 && (
        <Alert
          type="info"
          showIcon
          message="No owners yet"
          description={'Add each owner with their ownership %. The first one creates the "Owners\' Drawings" header account, and every owner gets their own drawings sub-account under it.'}
          action={<Button type="primary" icon={<PlusOutlined />} onClick={() => openOwnerModal(null)}>Add owner</Button>}
        />
      )}
      {summary && activeOwners.length > 0 && pctOff && (
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
              <p className="mb-1.5">
                Their entries are already kept out of expenses, but they are not counted under any owner here. Open{" "}
                <Link to="/admin/expense-categories">Entries Management → Categories</Link> and map each one to the matching
                owner's drawings account; its history is re-posted there automatically.
              </p>
              <ul className="m-0 list-disc pl-5">
                {summary.unlinkedEquityCategories.map((c) => (
                  <li key={c.categoryId}>
                    <b>{c.categoryName}</b> → {c.accountNumber} {c.accountName} · {c.entryCount} entries · {money(c.totalAmount)}
                  </li>
                ))}
              </ul>
            </div>
          }
        />
      )}

      {/* ── KPIs ───────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Total drawings"
          loading={loading && !summary}
          value={moneyCompact(summary?.totalDrawings ?? 0)}
          sub={<>{periodLabel}{summary?.headerAccountNumber ? <> · {summary.headerAccountNumber} {summary.headerAccountName}</> : null}</>}
          accent={<span className="rounded-lg bg-violet-50 p-1.5 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300"><WalletOutlined /></span>}
        />
        <StatTile
          label="Lifetime drawings"
          loading={loading && !summary}
          value={moneyCompact(summary?.lifetimeTotalDrawings ?? 0)}
          sub="All time, all owners"
        />
        <StatTile
          label="Ownership allocated"
          loading={loading && !summary}
          value={pct(totalPct)}
          accent={
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${pctOff ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"}`}>
              {pctOff ? <><WarningOutlined /> Check</> : <>✓ Complete</>}
            </span>
          }
          sub={
            <div className="mt-1 flex h-1.5 w-full gap-[2px] overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
              {activeOwners.map((o) => (
                <div key={o.id} title={`${o.name} ${pct(o.ownershipPercent)}`} style={{ width: `${o.ownershipPercent}%`, background: color(o.id) }} />
              ))}
            </div>
          }
        />
        <StatTile
          label="Most over-drawn"
          loading={loading && !summary}
          value={topOver ? <span className="flex items-center gap-2.5"><OwnerAvatar name={topOver.name} color={color(topOver.ownerId)} size={30} />{topOver.name}</span> : "Nobody"}
          sub={topOver ? <>{money(topOver.variance)} above their {pct(topOver.ownershipPercent)} fair share</> : "Every owner is at or under their fair share"}
        />
      </div>

      {/* ── Composition + per-owner ─────────────────────────────────── */}
      <div className="grid gap-6 xl:grid-cols-5">
        <Panel
          className="xl:col-span-2"
          title="Who drew what"
          subtitle="Each owner's slice of the drawings, against the slice they own"
        >
          {loading && !summary ? (
            <Skeleton active />
          ) : summaryRows.length === 0 ? (
            <Empty description="No owners yet" />
          ) : (summary?.totalDrawings ?? 0) === 0 ? (
            <Empty description="No drawings in this period" />
          ) : (
            <DrawingsComposition rows={summaryRows} totalDrawings={summary!.totalDrawings} color={color} onOpen={setDetailRow} />
          )}
        </Panel>

        <Panel
          className="xl:col-span-3"
          title="Drawings by owner"
          subtitle="From the general ledger · click an owner for the entries and the calculation"
          extra={
            <Segmented
              size="small"
              value={view}
              onChange={(v) => setView(v as "cards" | "table")}
              options={[
                { value: "cards", icon: <AppstoreOutlined />, label: "Cards" },
                { value: "table", icon: <UnorderedListOutlined />, label: "Table" },
              ]}
            />
          }
        >
          {loading && !summary ? (
            <Skeleton active />
          ) : summaryRows.length === 0 ? (
            <Empty description="No owners yet" />
          ) : view === "cards" ? (
            <div className="grid gap-4 md:grid-cols-2">
              {summaryRows.map((r) => (
                <article
                  key={r.key}
                  onClick={() => setDetailRow(r)}
                  className="group relative cursor-pointer rounded-xl border border-gray-200/80 bg-white p-4 transition hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md dark:border-white/[0.06] dark:bg-white/[0.02] dark:hover:border-white/15"
                >
                  <span className="absolute inset-x-0 top-0 h-1 rounded-t-xl" style={{ background: color(r.ownerId) }} />
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <OwnerAvatar name={r.name} color={color(r.ownerId)} size={40} />
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-gray-900 dark:text-white">{r.name}</div>
                        <div className="truncate text-xs text-gray-500 dark:text-gray-400">{r.accountNumber} · {r.accountName}</div>
                      </div>
                    </div>
                    {r.ownerId != null ? (
                      <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700 dark:bg-white/5 dark:text-gray-200">
                        {pct(r.ownershipPercent)}
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">No owner</span>
                    )}
                  </div>

                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div>
                      <Eyebrow>Drawn</Eyebrow>
                      <div className="mt-0.5 text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">{money(r.drawn)}</div>
                    </div>
                    <div className="text-right text-xs text-gray-500 dark:text-gray-400">
                      <div className="tabular-nums">{r.entryCount} entr{r.entryCount === 1 ? "y" : "ies"}</div>
                      <div className="tabular-nums">Lifetime {money(r.lifetimeDrawn)}</div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-1.5">
                    <ShareMeter share={r.shareOfDrawingsPercent} owned={r.ownershipPercent} color={color(r.ownerId)} showOwned={r.ownerId != null} />
                    <div className="flex justify-between text-xs tabular-nums text-gray-500 dark:text-gray-400">
                      <span><b className="font-semibold text-gray-800 dark:text-gray-200">{pct(r.shareOfDrawingsPercent)}</b> of drawings</span>
                      {r.ownerId != null && <span>owns {pct(r.ownershipPercent)}</span>}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-gray-100 pt-3 dark:border-white/[0.06]">
                    {r.ownerId != null ? (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Fair share <span className="font-semibold tabular-nums text-gray-800 dark:text-gray-200">{money(r.entitledAmount)}</span>
                      </div>
                    ) : <span />}
                    {r.ownerId != null && <StatusBadge variance={r.variance} />}
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-violet-700 opacity-80 group-hover:opacity-100 dark:text-violet-300">
                      Details <ArrowRightOutlined className="transition group-hover:translate-x-0.5" />
                    </span>
                    {r.ownerId != null && r.isActive && (
                      <Button
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={(e) => { e.stopPropagation(); openDrawingModal(null, r.ownerId!); }}
                      >
                        Drawing
                      </Button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <Table
              rowKey="key"
              size="middle"
              columns={summaryColumns}
              dataSource={summaryRows}
              pagination={false}
              scroll={{ x: 1000 }}
              summary={() =>
                summary ? (
                  <Table.Summary.Row className="bg-violet-50/60 dark:bg-violet-500/5">
                    <Table.Summary.Cell index={0}><b>{summary.headerAccountNumber} · {summary.headerAccountName}</b></Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right"><b>{pct(totalPct)}</b></Table.Summary.Cell>
                    <Table.Summary.Cell index={2} align="right"><b className="tabular-nums">{money(summary.totalDrawings)}</b></Table.Summary.Cell>
                    <Table.Summary.Cell index={3}><b>{summary.totalDrawings !== 0 ? "100%" : "—"}</b></Table.Summary.Cell>
                    <Table.Summary.Cell index={4} align="right">
                      <b className="tabular-nums">{money(summaryRows.filter((r) => r.ownerId).reduce((a, r) => a + r.entitledAmount, 0))}</b>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={5} />
                    <Table.Summary.Cell index={6} align="right"><b>{summaryRows.reduce((a, r) => a + r.entryCount, 0)}</b></Table.Summary.Cell>
                    <Table.Summary.Cell index={7} align="right"><b className="tabular-nums">{money(summary.lifetimeTotalDrawings)}</b></Table.Summary.Cell>
                  </Table.Summary.Row>
                ) : null
              }
            />
          )}
        </Panel>
      </div>

      {/* ── Owners & ownership ─────────────────────────────────────── */}
      <Panel
        title="Owners & ownership"
        subtitle="Each owner has their own drawings account under the Owners' Drawings header"
        extra={
          <div className="flex items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <Switch size="small" checked={showHiddenOwners} onChange={setShowHiddenOwners} /> Show hidden
            </label>
            <Button icon={<PlusOutlined />} onClick={() => openOwnerModal(null)}>Add owner</Button>
          </div>
        }
      >
        {owners.length === 0 ? (
          <Empty description="No owners yet" />
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-white/[0.06]">
            {owners.map((o) => (
              <li key={o.id} className={`flex flex-wrap items-center gap-4 py-3 first:pt-0 last:pb-0 ${o.isActive ? "" : "opacity-60"}`}>
                <OwnerAvatar name={o.name} color={color(o.id)} size={36} />
                <div className="min-w-[160px] flex-1">
                  <div className="flex items-center gap-2 font-medium text-gray-900 dark:text-gray-100">
                    {o.name}
                    {!o.isActive && <span className="rounded bg-gray-100 px-1.5 text-[10px] uppercase text-gray-500 dark:bg-white/5">hidden</span>}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {o.drawingsAccountNumber} · {o.drawingsAccountName}{o.notes ? <> · {o.notes}</> : null}
                  </div>
                </div>
                <div className="flex w-full items-center gap-3 sm:w-64">
                  <div className="h-1.5 flex-1 rounded-full bg-gray-100 dark:bg-white/10">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, o.ownershipPercent)}%`, background: color(o.id) }} />
                  </div>
                  <span className="w-14 text-right text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">{pct(o.ownershipPercent)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openOwnerModal(o)}>Edit</Button>
                  {o.isActive && <Button type="text" size="small" danger onClick={() => hideOwner(o)}>Hide</Button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* ── Drawings register ──────────────────────────────────────── */}
      <Panel
        title="Drawings register"
        subtitle={<>{drawingsCount} entr{drawingsCount === 1 ? "y" : "ies"} · {money(drawingsTotal)} recorded on this page in the period</>}
        extra={
          <div className="flex flex-wrap items-center gap-3">
            <Select
              allowClear
              placeholder="All owners"
              style={{ minWidth: 180 }}
              value={ownerFilter ?? undefined}
              onChange={(v) => setOwnerFilter(v ?? null)}
              options={owners.map((o) => ({
                value: o.id,
                label: <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: color(o.id) }} />{o.name}</span>,
              }))}
            />
            <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <Switch size="small" checked={showVoided} onChange={setShowVoided} /> Show cancelled
            </label>
          </div>
        }
      >
        <Table
          rowKey="id"
          size="middle"
          loading={drawingsLoading}
          columns={drawingColumns}
          dataSource={drawings}
          scroll={{ x: 1000 }}
          locale={{ emptyText: <Empty description="No drawings recorded on this page in the period" /> }}
          pagination={{ current: drawingsPage, pageSize, total: drawingsCount, onChange: setDrawingsPage, showSizeChanger: false, hideOnSinglePage: true }}
        />
      </Panel>

      {/* Drawings behind one row + how its numbers are calculated */}
      <OwnerDrawingDetailModal
        row={detailRow}
        totalDrawings={summary?.totalDrawings ?? 0}
        headerLabel={summary ? `${summary.headerAccountNumber} ${summary.headerAccountName}` : "Owners' Drawings"}
        from={fromStr}
        to={toStr}
        color={color(detailRow?.ownerId)}
        onClose={() => setDetailRow(null)}
        onRecordDrawing={detailRow?.ownerId != null && detailRow.isActive ? () => { const id = detailRow.ownerId!; setDetailRow(null); openDrawingModal(null, id); } : undefined}
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
        <Form form={ownerForm} layout="vertical" preserve={false} initialValues={ownerModal.init} requiredMark={false}>
          <Form.Item name="name" label="Name" rules={[{ required: true, message: "Name is required" }]}>
            <Input placeholder="Ahmad Houhou" maxLength={150} />
          </Form.Item>
          <Form.Item
            name="ownershipPercent"
            label="Ownership %"
            extra={`Other active owners hold ${pct(otherHeld)}. The total cannot exceed 100% (max ${pct(Math.max(0, 100 - otherHeld))} here).`}
            rules={[{ required: true, message: "Ownership % is required" }]}
          >
            <InputNumber min={0.01} max={100} step={0.5} precision={2} suffix="%" style={{ width: "100%" }} />
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
        okText={drawingModal.editing ? "Save" : "Record drawing"}
        confirmLoading={saving}
        destroyOnHidden
      >
        <div className="mb-4 rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-800 dark:bg-violet-500/10 dark:text-violet-200">
          Posts <b>DR</b> the owner's drawings account / <b>CR</b> 1000 Cash on Hand. Not an expense.
        </div>
        <Form form={drawingForm} layout="vertical" preserve={false} initialValues={drawingModal.init} requiredMark={false}>
          <Form.Item name="ownerId" label="Owner" rules={[{ required: true, message: "Pick the owner" }]}>
            <Select
              placeholder="Who took the cash?"
              options={(drawingModal.editing ? owners : activeOwners).map((o) => ({
                value: o.id,
                label: (
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: color(o.id) }} />
                    {o.name} <span className="text-gray-400">· {pct(o.ownershipPercent)} · {o.drawingsAccountNumber}</span>
                  </span>
                ),
              }))}
            />
          </Form.Item>
          <div className="grid grid-cols-2 gap-3">
            <Form.Item name="amount" label="Amount" rules={[{ required: true, message: "Amount is required" }]}>
              <InputNumber min={0.01} step={10} precision={2} prefix="$" style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="drawingDate" label="Date" rules={[{ required: true, message: "Date is required" }]}>
              <DatePicker style={{ width: "100%" }} disabledDate={(d) => d.isAfter(dayjs().endOf("day"))} />
            </Form.Item>
          </div>
          <Form.Item name="paymentMethod" label="Paid by">
            <Select allowClear options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))} />
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
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-lg border border-gray-100 p-3 dark:border-white/10">
              <OwnerAvatar name={voidTarget.ownerName} color={color(voidTarget.ownerId)} size={32} />
              <div className="flex-1">
                <div className="font-medium">{voidTarget.ownerName}</div>
                <div className="text-xs text-gray-500">{dayjs(voidTarget.drawingDate.slice(0, 10)).format("MMM D, YYYY")} · {voidTarget.journalEntryNumber ?? "no journal entry"}</div>
              </div>
              <div className="font-semibold tabular-nums">{money(voidTarget.amount)}</div>
            </div>
            <p className="text-sm text-gray-500">
              The row stays on file as cancelled and its journal entry is voided, so it no longer counts in the ledger or Cash on Hand.
            </p>
            <Input.TextArea rows={2} maxLength={500} placeholder="Reason (optional)" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} />
          </div>
        )}
      </Modal>
    </div>
  );
}

