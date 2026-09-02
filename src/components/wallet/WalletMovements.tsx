// WalletMovements
// ===============
// The money-box view: every wallet top-up / spend / refund as a filterable
// feed, with drawer-reconciliation totals on top. Used by the cashier
// (Clients page, defaults to Today) and the admin (Wallets page, full
// filters).

import { useCallback, useEffect, useState } from "react";
import Loader from "../ui/Loader";
import {
    WalletMovementsPage, getWalletMovements,
} from "../../services/walletService";

type Preset = "today" | "yesterday" | "7d" | "30d";

const money = (n: number) => `$${n.toFixed(2)}`;

const TYPE_STYLES: Record<string, string> = {
    TopUp: "bg-green-50 text-green-700",
    Bonus: "bg-indigo-50 text-indigo-700",
    Spend: "bg-gray-100 text-gray-700",
    Refund: "bg-red-50 text-red-700",
    Adjustment: "bg-amber-50 text-amber-700",
    Deduction: "bg-amber-50 text-amber-700",
};

function presetRange(p: Preset): { from: Date; to: Date } {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    if (p === "yesterday") { start.setDate(start.getDate() - 1); end.setDate(end.getDate() - 1); }
    if (p === "7d") start.setDate(start.getDate() - 6);
    if (p === "30d") start.setDate(start.getDate() - 29);
    return { from: start, to: end };
}

export default function WalletMovements({ compact = false }: { compact?: boolean }) {
    const [preset, setPreset] = useState<Preset>("today");
    const [type, setType] = useState("");
    const [method, setMethod] = useState("");
    const [page, setPage] = useState(1);
    const [data, setData] = useState<WalletMovementsPage | null>(null);
    const [loading, setLoading] = useState(false);

    const load = useCallback(() => {
        const { from, to } = presetRange(preset);
        setLoading(true);
        getWalletMovements({ from, to, type: type || undefined, method: method || undefined, page, pageSize: compact ? 15 : 50 })
            .then(setData)
            .catch(() => setData(null))
            .finally(() => setLoading(false));
    }, [preset, type, method, page, compact]);

    useEffect(load, [load]);

    const s = data?.summary;

    return (
        <div>
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
                <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                    {(["today", "yesterday", "7d", "30d"] as Preset[]).map(p => (
                        <button
                            key={p}
                            onClick={() => { setPreset(p); setPage(1); }}
                            className={`px-3 h-9 text-xs font-medium transition ${preset === p ? "bg-indigo-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                        >
                            {p === "today" ? "Today" : p === "yesterday" ? "Yesterday" : p === "7d" ? "7 days" : "30 days"}
                        </button>
                    ))}
                </div>
                <select
                    value={type}
                    onChange={(e) => { setType(e.target.value); setPage(1); }}
                    className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-700"
                >
                    <option value="">All types</option>
                    <option value="TopUp">Top-ups</option>
                    <option value="Bonus">Bonuses</option>
                    <option value="Spend">Spends</option>
                    <option value="Refund">Refunds</option>
                    <option value="Adjustment">Adjustments</option>
                    <option value="Deduction">Deductions</option>
                </select>
                <select
                    value={method}
                    onChange={(e) => { setMethod(e.target.value); setPage(1); }}
                    className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-700"
                >
                    <option value="">All methods</option>
                    <option value="Cash">Cash</option>
                    <option value="Whish">Whish</option>
                    <option value="Card">Card</option>
                </select>
                <button onClick={load} className="h-9 px-3 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50">
                    ↻ Refresh
                </button>
            </div>

            {/* Cash-box totals — the numbers to reconcile the drawer against */}
            {s && (
                <div className={`grid gap-2 mb-3 ${compact ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6"}`}>
                    <div className="rounded-xl bg-green-50 border border-green-100 px-3 py-2">
                        <div className="text-[11px] font-semibold text-green-700 uppercase">💵 Cash in box</div>
                        <div className="text-lg font-bold text-green-800">{money(s.cashIn)}</div>
                        <div className="text-[10px] text-green-600">{s.topUpCount} top-up(s)</div>
                    </div>
                    <div className="rounded-xl bg-purple-50 border border-purple-100 px-3 py-2">
                        <div className="text-[11px] font-semibold text-purple-700 uppercase">📲 Whish in</div>
                        <div className="text-lg font-bold text-purple-800">{money(s.whishIn)}</div>
                    </div>
                    <div className="rounded-xl bg-blue-50 border border-blue-100 px-3 py-2">
                        <div className="text-[11px] font-semibold text-blue-700 uppercase">💳 Card in</div>
                        <div className="text-lg font-bold text-blue-800">{money(s.cardIn)}</div>
                    </div>
                    {!compact && (
                        <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-3 py-2">
                            <div className="text-[11px] font-semibold text-indigo-700 uppercase">🎁 Bonus given</div>
                            <div className="text-lg font-bold text-indigo-800">{money(s.bonusGiven)}</div>
                        </div>
                    )}
                    {!compact && (
                        <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2">
                            <div className="text-[11px] font-semibold text-gray-600 uppercase">Spent from wallets</div>
                            <div className="text-lg font-bold text-gray-800">{money(s.spent)}</div>
                        </div>
                    )}
                    <div className="rounded-xl bg-gray-900 px-3 py-2">
                        <div className="text-[11px] font-semibold text-gray-300 uppercase">Net cash impact</div>
                        <div className="text-lg font-bold text-white">{money(s.netCashImpact)}</div>
                        {s.refundedCashOut > 0 && <div className="text-[10px] text-gray-400">−{money(s.refundedCashOut)} refunded</div>}
                    </div>
                </div>
            )}

            {/* Feed */}
            {loading ? (
                <div className="flex justify-center py-8"><Loader /></div>
            ) : !data || data.rows.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 py-8 text-center text-sm text-gray-400">
                    No wallet movements in this period.
                </div>
            ) : (
                <>
                    <div className="divide-y divide-gray-100 rounded-xl border border-gray-100 bg-white">
                        {data.rows.map((m) => (
                            <div key={m.id} className="flex items-center justify-between px-3 py-2 text-sm gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold ${TYPE_STYLES[m.type] ?? "bg-gray-100 text-gray-600"}`}>
                                        {m.type}
                                    </span>
                                    <div className="min-w-0">
                                        <div className="font-medium text-gray-900 truncate">
                                            {m.userName || `Client #${m.userId}`}
                                            {m.method ? <span className="text-gray-400 font-normal"> · {m.method}</span> : null}
                                            {m.transactionRecordId ? <span className="text-gray-400 font-normal"> · #{m.transactionRecordId}</span> : null}
                                        </div>
                                        <div className="text-[11px] text-gray-400 truncate">
                                            {new Date(m.createdOn).toLocaleString()} · by {m.createdBy}
                                            {m.notes ? ` · ${m.notes}` : ""}
                                        </div>
                                    </div>
                                </div>
                                <div className={`shrink-0 font-bold ${m.type === "TopUp" || m.type === "Bonus" || m.type === "Adjustment" ? "text-green-600" : "text-gray-800"}`}>
                                    {m.type === "TopUp" || m.type === "Bonus" || m.type === "Adjustment" ? "+" : "−"}{money(m.amount)}
                                </div>
                            </div>
                        ))}
                    </div>
                    {data.totalCount > data.pageSize && (
                        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                            <span>{data.totalCount} movement(s)</span>
                            <div className="flex gap-1">
                                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                                    className="px-3 h-8 rounded-lg border border-gray-200 bg-white disabled:opacity-40">← Prev</button>
                                <button disabled={page * data.pageSize >= data.totalCount} onClick={() => setPage(p => p + 1)}
                                    className="px-3 h-8 rounded-lg border border-gray-200 bg-white disabled:opacity-40">Next →</button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
