// Drill-down for any Owner Summary tile: "what is this number made of?"
// Rows (and, for F&B / TCG, the items inside each category) with their share
// of the total, search, expand/collapse and CSV export.

import React, { useEffect, useState } from "react";
import { Button, Empty, Input, Modal, Skeleton } from "antd";
import { DownloadOutlined, DownOutlined, RightOutlined, SearchOutlined } from "@ant-design/icons";
import { getMetricBreakdown, MetricBreakdownDto } from "../../../services/accountingService";

const money = (n: number) =>
  `${n < 0 ? "−" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function BreakdownModal({ metric, fromIso, toIso, onClose, onOpenCogs }: {
  metric: string | null;
  fromIso: string;
  toIso: string;
  onClose: () => void;
  onOpenCogs?: () => void;
}) {
  const [d, setD] = useState<MetricBreakdownDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [openRows, setOpenRows] = useState<Set<number>>(new Set());
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!metric) { setD(null); setOpenRows(new Set()); setQ(""); return; }
    setBusy(true);
    getMetricBreakdown(metric, fromIso, toIso).then(setD).catch(() => setD(null)).finally(() => setBusy(false));
  }, [metric, fromIso, toIso]);

  const isPct = metric === "foodcost";
  const denom = d ? d.rows.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0) : 0;
  const hasKids = !!d?.rows.some((r) => r.children && r.children.length);
  const hasCount = !!d?.rows.some((r) => r.count != null);

  const exportCsv = () => {
    if (!d) return;
    const lines: string[][] = [["Category", "Item", "Count", "Amount", "Detail"]];
    d.rows.forEach((r) => {
      lines.push([r.label, "", String(r.count ?? ""), r.amount.toFixed(2), r.detail ?? ""]);
      (r.children ?? []).forEach((c) => lines.push([r.label, c.label, String(c.count ?? ""), c.amount.toFixed(2), c.detail ?? ""]));
    });
    const csv = lines.map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    a.download = `${d.metric}_breakdown.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const toggle = (i: number) =>
    setOpenRows((prev) => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; });

  return (
    <Modal open={!!metric} onCancel={onClose} footer={null} width={880} title={null} destroyOnHidden>
      {busy && <div className="py-4"><Skeleton active paragraph={{ rows: 6 }} /></div>}

      {!busy && d && (
        <div>
          {/* Header */}
          <div className="pr-8">
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Breakdown</div>
            <h3 className="mt-0.5 text-lg font-semibold text-gray-900 dark:text-white">{d.title}</h3>
            <div className="mt-2 flex flex-wrap items-baseline gap-3">
              <span className={`text-3xl font-semibold tracking-tight ${d.total < 0 ? "text-rose-600" : "text-gray-900 dark:text-white"}`}>
                {isPct ? `${d.total.toFixed(1)}%` : money(d.total)}
              </span>
              <span className="text-xs text-gray-500">{d.rows.length} line{d.rows.length === 1 ? "" : "s"}</span>
            </div>
            {d.note && <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-white/5 dark:text-gray-300">{d.note}</p>}
          </div>

          {/* Toolbar */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {hasKids && (
              <>
                <Input allowClear prefix={<SearchOutlined className="text-gray-400" />} placeholder="Search items…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 280 }} />
                <Button size="small" onClick={() => setOpenRows(new Set(d.rows.map((_, i) => i)))}>Expand all</Button>
                <Button size="small" onClick={() => setOpenRows(new Set())}>Collapse</Button>
              </>
            )}
            <Button size="small" icon={<DownloadOutlined />} onClick={exportCsv} className="ml-auto">CSV</Button>
          </div>

          {metric === "fnbnet" && onOpenCogs && (
            <button type="button" onClick={() => { onClose(); onOpenCogs(); }} className="mt-3 text-xs font-medium text-violet-700 hover:underline dark:text-violet-300">
              → Open the per-ingredient COGS breakdown
            </button>
          )}

          {/* Rows */}
          <div className="mt-3 overflow-hidden rounded-xl border border-gray-200/80 dark:border-white/[0.06]">
            <div className="max-h-[440px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-[1] bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-semibold">Line</th>
                    {hasCount && <th className="px-4 py-2.5 text-right font-semibold">{d.countLabel ?? "Count"}</th>}
                    <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
                    {!isPct && <th className="w-44 px-4 py-2.5 text-left font-semibold">Share</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/[0.06]">
                  {d.rows.map((r, i) => {
                    const share = !isPct && denom > 0 && r.amount > 0 ? (r.amount / denom) * 100 : null;
                    const kids = (r.children ?? []).filter((c) => !q || c.label.toLowerCase().includes(q.toLowerCase()));
                    const rowHasKids = (r.children?.length ?? 0) > 0;
                    const isOpen = openRows.has(i) || (!!q && kids.length > 0);
                    if (q && rowHasKids && kids.length === 0) return null;
                    return (
                      <React.Fragment key={i}>
                        <tr
                          className={`${rowHasKids ? "cursor-pointer" : ""} hover:bg-gray-50/70 dark:hover:bg-white/[0.02]`}
                          onClick={() => rowHasKids && toggle(i)}
                        >
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1.5 font-medium text-gray-900 dark:text-gray-100">
                              {rowHasKids && (isOpen ? <DownOutlined className="text-[10px] text-gray-400" /> : <RightOutlined className="text-[10px] text-gray-400" />)}
                              {r.label}
                              {rowHasKids && <span className="font-normal text-gray-400">· {r.children!.length} items</span>}
                            </div>
                            {r.detail && <div className="mt-0.5 text-xs text-gray-500">{r.detail}</div>}
                          </td>
                          {hasCount && <td className="px-4 py-2.5 text-right tabular-nums text-gray-500">{r.count ?? ""}</td>}
                          <td className={`whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums ${r.amount < 0 ? "text-rose-600" : "text-gray-900 dark:text-gray-100"}`}>{money(r.amount)}</td>
                          {!isPct && (
                            <td className="px-4 py-2.5">
                              {share != null && (
                                <div className="flex items-center gap-2">
                                  <div className="h-1.5 flex-1 rounded-full bg-gray-100 dark:bg-white/10">
                                    <div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.min(100, share)}%` }} />
                                  </div>
                                  <span className="w-9 text-right text-xs tabular-nums text-gray-500">{share.toFixed(0)}%</span>
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                        {isOpen && kids.map((c, j) => (
                          <tr key={`${i}-${j}`} className="bg-gray-50/60 dark:bg-white/[0.02]">
                            <td className="py-2 pl-10 pr-4">
                              <div className="text-gray-800 dark:text-gray-200">{c.label}</div>
                              {c.detail && <div className="text-xs text-gray-500">{c.detail}</div>}
                            </td>
                            {hasCount && <td className="px-4 py-2 text-right tabular-nums text-gray-500">{c.count ?? ""}</td>}
                            <td className="whitespace-nowrap px-4 py-2 text-right font-medium tabular-nums">{money(c.amount)}</td>
                            {!isPct && (
                              <td className="px-4 py-2 text-xs text-gray-400">
                                {r.amount > 0 && c.amount > 0 ? `${((c.amount / r.amount) * 100).toFixed(0)}% of ${r.label}` : ""}
                              </td>
                            )}
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                  {d.rows.length === 0 && (
                    <tr><td colSpan={4} className="py-10"><Empty description="Nothing in this period" /></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!busy && !d && metric && <div className="py-6 text-center text-sm text-rose-600">Could not load the breakdown.</div>}
    </Modal>
  );
}
