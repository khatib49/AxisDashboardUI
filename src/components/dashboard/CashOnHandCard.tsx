// CashOnHandCard
// ==============
// Rami's spec (2026-07):
//   cashOnHand = static baseline + revenue in period − operating expenses in period
// The baseline is a one-shot till reading he types in once; everything after
// that is adjusted automatically as the app records revenue and expenses.
//
// The baseline lives in IntegrationSettings under key
// `Accounting.CashOnHandBaseline` so it's edit-able from /admin/integrations
// AND inline via the pencil icon on this card.
//
// This component is reused on:
//   • Accounting dashboard  → Owner Summary grid, row 1 (full width)
//   • Main app dashboard    → compact card in row 1

import React, { useEffect, useState } from "react";
import { EditOutlined, InfoCircleOutlined } from "@ant-design/icons";
import { Modal, InputNumber, message, Tooltip, Spin } from "antd";
import { getAccountingDashboard } from "../../services/accountingService";
import {
  integrationSettingsService,
} from "../../services/integrationSettingsService";

interface Props {
  fromIso: string;
  toIso: string;
  // Optional visual mode. "compact" = short single-line for the home
  // dashboard; "full" = the big row used on the accounting dashboard.
  mode?: "compact" | "full";
  // Optional pre-fetched revenue + opex so the card doesn't repeat the
  // network call the parent already made (used by the accounting page).
  revenueOverride?: number;
  operatingExpensesOverride?: number;
}

const money = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function CashOnHandCard({
  fromIso, toIso, mode = "compact",
  revenueOverride, operatingExpensesOverride,
}: Props) {
  const [baseline, setBaseline]         = useState<number | null>(null);
  const [revenue, setRevenue]           = useState<number>(revenueOverride ?? 0);
  const [opEx, setOpEx]                 = useState<number>(operatingExpensesOverride ?? 0);
  const [loading, setLoading]           = useState(false);
  const [editing, setEditing]           = useState(false);
  const [draft, setDraft]               = useState<number | null>(null);
  const [saving, setSaving]             = useState(false);

  const usingOverrides = revenueOverride != null && operatingExpensesOverride != null;

  useEffect(() => {
    // Baseline is fetched from IntegrationSettings — small enough to
    // re-fetch on every mount without a cache concern.
    let alive = true;
    (async () => {
      try {
        const list = await integrationSettingsService.list();
        const row = list.find(x => x.key === "Accounting.CashOnHandBaseline");
        // Value comes back masked only for isSecret rows — this key isn't,
        // so we get the raw number as a string.
        const parsed = Number(row?.value ?? "0");
        if (alive) setBaseline(isFinite(parsed) ? parsed : 0);
      } catch { if (alive) setBaseline(0); }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    // If the parent didn't hand us revenue/opex, fetch them ourselves.
    if (usingOverrides) {
      setRevenue(revenueOverride!);
      setOpEx(operatingExpensesOverride!);
      return;
    }
    let alive = true;
    setLoading(true);
    getAccountingDashboard(fromIso, toIso)
      .then(d => {
        if (!alive) return;
        setRevenue(d.revenue?.total ?? 0);
        setOpEx(d.operatingExpenses?.total ?? 0);
      })
      .catch(() => { /* soft-fail */ })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [fromIso, toIso, usingOverrides, revenueOverride, operatingExpensesOverride]);

  const cashOnHand = (baseline ?? 0) + revenue - opEx;

  const saveBaseline = async () => {
    if (draft == null || isNaN(draft)) return;
    setSaving(true);
    try {
      await integrationSettingsService.upsert(
        "Accounting.CashOnHandBaseline", String(draft));
      setBaseline(draft);
      message.success("Baseline updated");
      setEditing(false);
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "Save failed");
    } finally { setSaving(false); }
  };

  const openEdit = () => {
    setDraft(baseline ?? 0);
    setEditing(true);
  };

  const isReady = baseline != null && !loading;

  // ── Rendering ─────────────────────────────────────────────────────
  if (mode === "compact") {
    return (
      <>
        <div
          className="rounded-lg border shadow-sm p-4 bg-gradient-to-br from-cyan-50 to-teal-50 border-cyan-200 h-full flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-cyan-800 flex items-center gap-1">
              💰 Cash on Hand
              <Tooltip title="Baseline + revenue in period − operating expenses in period. Baseline is a static till reading edited by admin.">
                <InfoCircleOutlined className="text-cyan-600 text-[10px]" />
              </Tooltip>
            </div>
            <button
              onClick={openEdit}
              className="text-cyan-700 hover:text-cyan-900 text-xs"
              title="Edit baseline"
            >
              <EditOutlined />
            </button>
          </div>
          {isReady ? (
            <div>
              <div className="text-2xl font-bold text-cyan-900 leading-tight">{money(cashOnHand)}</div>
              <div className="text-[10px] text-cyan-700 mt-1">
                baseline {money(baseline!)} + rev {money(revenue)} − opex {money(opEx)}
              </div>
            </div>
          ) : (
            <div className="flex justify-center py-2"><Spin size="small" /></div>
          )}
        </div>
        <BaselineModal
          open={editing}
          draft={draft}
          setDraft={setDraft}
          onCancel={() => setEditing(false)}
          onSave={saveBaseline}
          saving={saving}
        />
      </>
    );
  }

  // Full mode — used inside the OwnerSummaryGrid row 1.
  return (
    <>
      <div
        style={{
          background: "#CFFAFE",
          border: "1px solid #67E8F9",
          color: "#155E75",
          padding: "12px 16px",
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          minHeight: 70,
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.85, display: "flex", alignItems: "center", gap: 6 }}>
            1 · Axis Account (Cash on Hand)
            <Tooltip title="Baseline + revenue in period − operating expenses in period. Baseline is a static till reading edited by admin.">
              <InfoCircleOutlined style={{ fontSize: 11, opacity: 0.6 }} />
            </Tooltip>
            <button
              onClick={openEdit}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#155E75", opacity: 0.7, fontSize: 12 }}
              title="Edit baseline"
            >
              <EditOutlined />
            </button>
          </div>
          {isReady ? (
            <>
              <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.2, marginTop: 2 }}>
                {money(cashOnHand)}
              </div>
              <div style={{ fontSize: 10, opacity: 0.75, marginTop: 2 }}>
                baseline {money(baseline!)} + revenue {money(revenue)} − operating expenses {money(opEx)}
              </div>
            </>
          ) : (
            <Spin size="small" />
          )}
        </div>
      </div>
      <BaselineModal
        open={editing}
        draft={draft}
        setDraft={setDraft}
        onCancel={() => setEditing(false)}
        onSave={saveBaseline}
        saving={saving}
      />
    </>
  );
}

// ── Baseline edit modal ───────────────────────────────────────────────
function BaselineModal({
  open, draft, setDraft, onCancel, onSave, saving,
}: {
  open: boolean;
  draft: number | null;
  setDraft: (n: number | null) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <Modal
      open={open}
      title="Set Cash-on-Hand Baseline"
      onCancel={onCancel}
      onOk={onSave}
      confirmLoading={saving}
      okText="Save"
      destroyOnHidden
    >
      <div className="space-y-3">
        <p className="text-sm text-gray-700">
          The baseline is the till reading at the moment you flip the switch. Every
          revenue and expense recorded after this point automatically adjusts Cash
          on Hand. Reset only when you re-baseline the till.
        </p>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Baseline ($)</label>
          <InputNumber
            style={{ width: "100%" }}
            value={draft ?? 0}
            step={0.01}
            prefix="$"
            onChange={(v) => setDraft(v == null ? 0 : Number(v))}
            autoFocus
          />
        </div>
      </div>
    </Modal>
  );
}
