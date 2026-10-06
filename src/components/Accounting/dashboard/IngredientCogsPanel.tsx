// Where does the Ingredient COGS number come from? Expandable per-ingredient
// table with mismatch flags — the first place to look when F&B net goes red.
// Recipe lines that look wrong are listed first, since they are what inflate
// the cost; each ingredient opens to the recipes that consume it.

import React, { useEffect, useState } from "react";
import { Skeleton } from "antd";
import { DownOutlined, RightOutlined, WarningFilled } from "@ant-design/icons";
import { getIngredientCogsBreakdown, IngredientCogsBreakdownDto } from "../../../services/accountingService";

const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const th = "px-3 py-2 text-left font-semibold";
const thR = "px-3 py-2 text-right font-semibold";
const td = "px-3 py-2";
const tdR = "px-3 py-2 text-right tabular-nums";

export default function IngredientCogsPanel({ fromIso, toIso, forceOpen }: { fromIso: string; toIso: string; forceOpen?: number }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { if (forceOpen) setOpen(true); }, [forceOpen]);
  const [d, setD] = useState<IngredientCogsBreakdownDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [showMoves, setShowMoves] = useState(false);
  const [openIng, setOpenIng] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setBusy(true);
    getIngredientCogsBreakdown(fromIso, toIso).then(setD).catch(() => setD(null)).finally(() => setBusy(false));
  }, [open, fromIso, toIso]);

  const flagged = d?.lines.filter((l) => l.flag) ?? [];
  const bigGap = !!d && Math.abs(d.total - d.expectedAtCurrentPrices) > Math.max(50, d.expectedAtCurrentPrices * 0.2);

  return (
    <div className="rounded-xl border border-rose-100 bg-rose-50/40 dark:border-rose-500/10 dark:bg-rose-500/[0.04]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-rose-800 dark:text-rose-200"
      >
        {open ? <DownOutlined className="text-[10px]" /> : <RightOutlined className="text-[10px]" />}
        Where does the Ingredient COGS come from?
        <span className="font-normal text-rose-700/70 dark:text-rose-300/70">per-ingredient breakdown</span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-rose-100 px-4 pb-4 pt-3 dark:border-rose-500/10">
          {busy && <Skeleton active paragraph={{ rows: 4 }} />}

          {!busy && d && (
            <>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Booked <b>{money(d.total)}</b> over {d.movementCount} consumption movements. At today's ingredient prices the same
                quantities would cost <b>{money(d.expectedAtCurrentPrices)}</b>.
                {bigGap && <span className="text-rose-700 dark:text-rose-400"> Big gap: booked costs don't match current prices (unit / price mismatch or a double rebuild).</span>}
                {flagged.length > 0 && <span className="text-rose-700 dark:text-rose-400"> {flagged.length} ingredient(s) flagged.</span>}
              </p>

              {(d.recipeProblems?.length ?? 0) > 0 && (
                <div className="rounded-xl border border-rose-200 bg-white p-3 dark:border-rose-500/20 dark:bg-white/[0.03]">
                  <div className="flex items-center gap-2 text-sm font-semibold text-rose-800 dark:text-rose-300">
                    <WarningFilled /> {d.recipeProblems!.length} recipe line(s) look wrong — these are what inflate the COGS
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">
                    Fix the recipe (Inventory → Recipes: quantity / unit), then run Tools → COGS Rebuild for this period so history is re-costed.
                  </p>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="text-[10px] uppercase tracking-wider text-gray-500">
                        <tr>
                          <th className={th}>Item (id)</th><th className={th}>Ingredient (id)</th><th className={th}>Recipe line</th>
                          <th className={thR}>Cost / portion</th><th className={thR}>Sold</th><th className={thR}>Cost in period</th><th className={th}>Why</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-rose-50 dark:divide-white/[0.06]">
                        {d.recipeProblems!.slice(0, 40).map((c, i) => (
                          <tr key={i}>
                            <td className={`${td} font-medium`}>{c.itemName} <span className="font-normal text-gray-400">#{c.itemId} · ${c.itemSellPrice.toFixed(2)}</span></td>
                            <td className={td}>{c.ingredientName} <span className="text-gray-400">#{c.ingredientId}</span></td>
                            <td className={td}>{c.recipeQty} {c.recipeUnit ?? "(no unit)"} → {c.qtyPerPortionInIngredientUnit} {c.ingredientUnit} <span className="text-gray-400">(line #{c.recipeLineId})</span></td>
                            <td className={tdR}>{money(c.costPerPortion)}</td>
                            <td className={tdR}>{c.unitsSoldInPeriod}</td>
                            <td className={`${tdR} font-semibold`}>{money(c.costInPeriod)}</td>
                            <td className={`${td} text-rose-700 dark:text-rose-400`}>{c.flag}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="overflow-hidden rounded-xl border border-gray-200/80 bg-white dark:border-white/[0.06] dark:bg-white/[0.02]">
                <div className="max-h-[340px] overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500 dark:bg-gray-900">
                      <tr>
                        <th className={th}>Ingredient</th><th className={thR}>Qty used</th><th className={thR}>Booked cost</th>
                        <th className={thR}>Avg unit cost</th><th className={thR}>Current price</th><th className={thR}>At current price</th><th className={th}>Flag</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/[0.06]">
                      {d.lines.map((l) => (
                        <React.Fragment key={l.ingredientId}>
                          <tr
                            className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.03] ${l.flag ? "bg-rose-50/70 dark:bg-rose-500/[0.06]" : ""}`}
                            onClick={() => setOpenIng(openIng === l.ingredientId ? null : l.ingredientId)}
                            title="Click to see which recipes use it"
                          >
                            <td className={td}>
                              {openIng === l.ingredientId ? <DownOutlined className="text-[9px] text-gray-400" /> : <RightOutlined className="text-[9px] text-gray-400" />}{" "}
                              <span className="font-medium text-gray-800 dark:text-gray-200">{l.ingredientName}</span> <span className="text-gray-400">({l.movementCount})</span>
                            </td>
                            <td className={tdR}>{l.quantityConsumed.toLocaleString()} {l.unit}</td>
                            <td className={`${tdR} font-semibold`}>{money(l.totalCost)}</td>
                            <td className={tdR}>{l.avgUnitCost.toFixed(4)}/{l.unit}</td>
                            <td className={tdR}>{l.currentBuyPrice == null ? "—" : `${l.currentBuyPrice.toFixed(4)}/${l.unit}`}</td>
                            <td className={tdR}>{money(l.expectedAtCurrentPrice)}</td>
                            <td className={`${td} text-rose-700 dark:text-rose-400`}>{l.flag ?? ""}</td>
                          </tr>
                          {openIng === l.ingredientId && (
                            <tr>
                              <td colSpan={7} className="bg-gray-50/80 px-3 py-2 pl-8 dark:bg-white/[0.02]">
                                {(d.consumersByIngredient?.[l.ingredientId] ?? []).length === 0 ? (
                                  <span className="text-gray-400">No recipe uses this ingredient — consumption came from manual movements.</span>
                                ) : (
                                  <table className="w-full text-xs">
                                    <thead className="text-[10px] uppercase tracking-wider text-gray-500">
                                      <tr>
                                        <th className="py-1 text-left">Used by</th><th className="py-1 text-left">Recipe line</th>
                                        <th className="py-1 text-right">Cost / portion</th><th className="py-1 text-right">Sold</th><th className="py-1 text-right">Cost in period</th><th />
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(d.consumersByIngredient?.[l.ingredientId] ?? []).map((c, i) => (
                                        <tr key={i} className={c.flag ? "text-rose-700 dark:text-rose-400" : ""}>
                                          <td className="py-1">{c.itemName} <span className="text-gray-400">#{c.itemId} · ${c.itemSellPrice.toFixed(2)}</span></td>
                                          <td className="py-1">{c.recipeQty} {c.recipeUnit ?? "(no unit)"} → {c.qtyPerPortionInIngredientUnit} {c.ingredientUnit} <span className="text-gray-400">(line #{c.recipeLineId})</span></td>
                                          <td className="py-1 text-right tabular-nums">{money(c.costPerPortion)}</td>
                                          <td className="py-1 text-right tabular-nums">{c.unitsSoldInPeriod}</td>
                                          <td className="py-1 text-right font-semibold tabular-nums">{money(c.costInPeriod)}</td>
                                          <td className="py-1 pl-2">{c.flag ?? ""}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <button type="button" onClick={() => setShowMoves((v) => !v)} className="text-xs font-medium text-violet-700 hover:underline dark:text-violet-300">
                {showMoves ? "Hide" : "Show"} the 25 biggest single movements
              </button>
              {showMoves && (
                <div className="overflow-x-auto rounded-xl border border-gray-200/80 bg-white dark:border-white/[0.06] dark:bg-white/[0.02]">
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-gray-100 dark:divide-white/[0.06]">
                      {d.topMovements.map((m) => (
                        <tr key={m.id}>
                          <td className={td}>{new Date(m.createdOn).toLocaleString()}</td>
                          <td className={td}>{m.ingredientName}</td>
                          <td className={tdR}>{m.quantity} {m.unit}</td>
                          <td className={tdR}>{m.unitCost == null ? "—" : m.unitCost.toFixed(4)}</td>
                          <td className={`${tdR} font-semibold`}>{money(m.totalCost)}</td>
                          <td className={`${td} text-gray-500`}>{m.referenceType} #{m.referenceId}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {!busy && !d && <div className="text-sm text-rose-700">Could not load the breakdown.</div>}
        </div>
      )}
    </div>
  );
}
