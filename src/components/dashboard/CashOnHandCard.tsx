// CashOnHandCard
// ==============
// Rami's spec (2026-09-11):
//   cashOnHand = baseline + TOTAL revenue (all time) − TOTAL expenses (all time)
//                − owner drawings (all time)
// Total expenses = the "Total Expenses (All)" figure on the Expenses page.
// Owner drawings are cash out but not expenses, so they get their own term.
// The date filter does not touch it. Computed by the server
// (AccountingDashboardDto.cashOnHand) so every screen shows the same figure.
//
// The baseline is a one-shot till reading the owner types in once; it lives
// in IntegrationSettings under `Accounting.CashOnHandBaseline` and is
// editable inline via the pencil icon.
//
// Reused on:
//   • Accounting dashboard  → hero card + Owner Summary row 1
//   • Main app dashboard    → compact card in row 1

import { useEffect, useState } from "react";
import { EditOutlined, InfoCircleOutlined } from "@ant-design/icons";
import { Modal, InputNumber, message, Tooltip, Spin } from "antd";
import { getAccountingDashboard, CashOnHandDto } from "../../services/accountingService";
import { integrationSettingsService } from "../../services/integrationSettingsService";

interface Props {
  fromIso: string;
  toIso: string;
  /** compact = main dashboard; full = legacy strip; hero = accounting dashboard headline card. */
  mode?: "compact" | "full" | "hero";
  /** Hero mode: opens the "how it is built" breakdown. */
  onDetails?: () => void;
  /** Pre-fetched breakdown from the parent's dashboard call (skips a round-trip). */
  cashOverride?: CashOnHandDto | null;
  /** Called after the baseline is saved so the parent can refetch. */
  onBaselineSaved?: () => void;
}

const money = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const FORMULA = "Baseline + TOTAL revenue since day one (paid sales + paid event tickets) − TOTAL expenses since day one (the \"Total Expenses (All)\" figure on the Expenses page) − owners' drawings since day one (cash the owners took out; not an expense). Not affected by the date filter.";

export default function CashOnHandCard({ fromIso, toIso, mode = "compact", cashOverride, onBaselineSaved, onDetails }: Props) {
  const [data, setData] = useState<CashOnHandDto | null>(cashOverride ?? null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (cashOverride !== undefined) { setData(cashOverride ?? null); return; }
    let alive = true;
    setLoading(true);
    getAccountingDashboard(fromIso, toIso)
      .then((d) => { if (alive) setData(d.cashOnHand ?? null); })
      .catch(() => { /* soft-fail: card shows a spinner until the next try */ })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [fromIso, toIso, cashOverride, reloadKey]);

  const saveBaseline = async () => {
    if (draft == null || isNaN(draft)) return;
    setSaving(true);
    try {
      await integrationSettingsService.upsert("Accounting.CashOnHandBaseline", String(draft));
      message.success("Baseline updated");
      setEditing(false);
      if (cashOverride !== undefined) onBaselineSaved?.();
      else setReloadKey((k) => k + 1);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      message.error(msg ?? "Save failed");
    } finally { setSaving(false); }
  };

  const openEdit = () => { setDraft(data?.baseline ?? 0); setEditing(true); };
  const isReady = !!data && !loading;

  const breakdown = data
    ? `baseline ${money(data.baseline)} + total revenue ${money(data.revenue)} − total expenses ${money(data.totalExpenses)}` +
      (data.otherCashOut ? ` − owners' drawings ${money(data.otherCashOut)}` : "")
    : "";
  const expenseDetail = "all time · not affected by the date filter";

  if (mode === "hero") {
    const negative = !!data && data.amount < 0;
    const parts = data
      ? [
          { label: "Baseline", value: data.baseline, sign: "" },
          { label: "Revenue", value: data.revenue, sign: "+" },
          { label: "Expenses", value: data.totalExpenses, sign: "−" },
          ...(data.otherCashOut ? [{ label: "Owners' drawings", value: data.otherCashOut, sign: "−" }] : []),
        ]
      : [];
    return (
      <>
        <div className="relative h-full overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-600 via-cyan-700 to-teal-800 p-5 text-white shadow-lg shadow-cyan-900/20">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-cyan-50">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/15 text-[10px] font-bold">1</span>
              Cash on Hand
              <Tooltip title={FORMULA}><InfoCircleOutlined className="text-cyan-100/80" /></Tooltip>
            </div>
            <div className="flex items-center gap-1">
              {onDetails && (
                <button type="button" onClick={onDetails} className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-white/20">
                  Details ›
                </button>
              )}
              <Tooltip title="Edit baseline">
                <button type="button" onClick={openEdit} className="rounded-lg bg-white/10 px-2 py-1 text-xs text-white transition hover:bg-white/20" aria-label="Edit baseline">
                  <EditOutlined />
                </button>
              </Tooltip>
            </div>
          </div>
          {isReady ? (
            <>
              <div className={`relative mt-3 text-4xl font-semibold tracking-tight ${negative ? "text-red-200" : ""}`}>{money(data!.amount)}</div>
              <div className="relative mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-cyan-50/90">
                {parts.map((p) => (
                  <span key={p.label} className="whitespace-nowrap">
                    <span className="text-cyan-100/70">{p.sign} {p.label}</span>{" "}
                    <span className="font-semibold tabular-nums text-white">{money(p.value)}</span>
                  </span>
                ))}
              </div>
              <div className="relative mt-2 text-[11px] text-cyan-100/70">{expenseDetail}</div>
            </>
          ) : (
            <div className="relative flex justify-center py-6"><Spin size="small" /></div>
          )}
        </div>
        <BaselineModal open={editing} draft={draft} setDraft={setDraft} onCancel={() => setEditing(false)} onSave={saveBaseline} saving={saving} />
      </>
    );
  }

  if (mode === "compact") {
    return (
      <>
        <div className="rounded-lg border shadow-sm p-4 bg-gradient-to-br from-cyan-50 to-teal-50 border-cyan-200 h-full flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-cyan-800 flex items-center gap-1">
              💰 Cash on Hand
              <Tooltip title={FORMULA}><InfoCircleOutlined className="text-cyan-600 text-[10px]" /></Tooltip>
            </div>
            <button onClick={openEdit} className="text-cyan-700 hover:text-cyan-900 text-xs" title="Edit baseline">
              <EditOutlined />
            </button>
          </div>
          {isReady ? (
            <div>
              <div className={`text-2xl font-bold leading-tight ${data!.amount < 0 ? "text-red-700" : "text-cyan-900"}`}>{money(data!.amount)}</div>
              <div className="text-[10px] text-cyan-700 mt-1">{breakdown}</div>
              {expenseDetail && <div className="text-[10px] text-cyan-600/80">{expenseDetail}</div>}
            </div>
          ) : (
            <div className="flex justify-center py-2"><Spin size="small" /></div>
          )}
        </div>
        <BaselineModal open={editing} draft={draft} setDraft={setDraft} onCancel={() => setEditing(false)} onSave={saveBaseline} saving={saving} />
      </>
    );
  }

  return (
    <>
      <div
        style={{
          background: "#CFFAFE", border: "1px solid #67E8F9", color: "#155E75",
          padding: "12px 16px", borderRadius: 8, display: "flex", alignItems: "center",
          justifyContent: "space-between", gap: 12, minHeight: 70,
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.85, display: "flex", alignItems: "center", gap: 6 }}>
            1 · Axis Account (Cash on Hand)
            <Tooltip title={FORMULA}><InfoCircleOutlined style={{ fontSize: 11, opacity: 0.6 }} /></Tooltip>
            <button onClick={openEdit} style={{ background: "none", border: "none", cursor: "pointer", color: "#155E75", opacity: 0.7, fontSize: 12 }} title="Edit baseline">
              <EditOutlined />
            </button>
          </div>
          {isReady ? (
            <>
              <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.2, marginTop: 2, color: data!.amount < 0 ? "#B91C1C" : undefined }}>
                {money(data!.amount)}
              </div>
              <div style={{ fontSize: 10, opacity: 0.75, marginTop: 2 }}>{breakdown}</div>
              {expenseDetail && <div style={{ fontSize: 10, opacity: 0.6 }}>{expenseDetail}</div>}
            </>
          ) : (
            <Spin size="small" />
          )}
        </div>
      </div>
      <BaselineModal open={editing} draft={draft} setDraft={setDraft} onCancel={() => setEditing(false)} onSave={saveBaseline} saving={saving} />
    </>
  );
}

function BaselineModal({
  open, draft, setDraft, onCancel, onSave, saving,
}: {
  open: boolean; draft: number | null; setDraft: (n: number | null) => void;
  onCancel: () => void; onSave: () => void; saving: boolean;
}) {
  return (
    <Modal open={open} title="Set Cash-on-Hand Baseline" onCancel={onCancel} onOk={onSave} confirmLoading={saving} okText="Save" destroyOnHidden>
      <div className="space-y-3">
        <p className="text-sm text-gray-700">
          The baseline is the till reading at the moment you flip the switch. Every revenue,
          expense and stock purchase recorded after this point automatically adjusts Cash on Hand.
          Reset only when you re-baseline the till.
        </p>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Baseline ($)</label>
          <InputNumber style={{ width: "100%" }} value={draft ?? 0} step={0.01} prefix="$" onChange={(v) => setDraft(v == null ? 0 : Number(v))} autoFocus />
        </div>
      </div>
    </Modal>
  );
}
