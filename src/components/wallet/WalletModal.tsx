// WalletModal
// ===========
// The single wallet panel for one client: balance, top-up (with live bonus
// preview from the admin-configured tiers), recent history, and — for admins
// only — refund / correction controls.
//
// Used from the game-cashier Clients page and the admin wallet screen.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Modal from "../ui/Modal";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import Loader from "../ui/Loader";
import {
    WalletSummary, WalletBonusTier,
    getWalletSummary, topUpWallet, adjustWallet, getBonusTiers, previewBonus,
} from "../../services/walletService";
import { useAuth } from "../../context/AuthContext";

interface Props {
    open: boolean;
    userId: number;
    userName?: string | null;
    onClose: () => void;
    /** Lets the parent refresh a balance chip without refetching the table. */
    onBalanceChange?: (userId: number, newBalance: number) => void;
}

const TYPE_STYLES: Record<string, string> = {
    TopUp: "bg-green-50 text-green-700",
    Bonus: "bg-indigo-50 text-indigo-700",
    Spend: "bg-gray-100 text-gray-700",
    Refund: "bg-red-50 text-red-700",
    Adjustment: "bg-amber-50 text-amber-700",
    Deduction: "bg-amber-50 text-amber-700",
};

/** Which directions reduce the balance — drives the −/+ sign in history. */
const NEGATIVE_TYPES = new Set(["Spend", "Refund", "Deduction"]);

const money = (n: number) => `$${n.toFixed(2)}`;

export default function WalletModal({ open, userId, userName, onClose, onBalanceChange }: Props) {
    const { hasRole } = useAuth();
    const isAdmin = hasRole("admin");

    const [summary, setSummary] = useState<WalletSummary | null>(null);
    const [tiers, setTiers] = useState<WalletBonusTier[]>([]);
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

    // Top-up form
    const [amount, setAmount] = useState<string>("");
    const [method, setMethod] = useState<"Cash" | "Whish" | "Card">("Cash");

    // Admin adjust form
    const [showAdjust, setShowAdjust] = useState(false);
    const [delta, setDelta] = useState<string>("");
    const [cashOut, setCashOut] = useState(true);
    const [reason, setReason] = useState("");

    // onBalanceChange lives in a ref, NOT in reload's deps. Parents pass
    // inline arrows, so putting it in the deps would give reload a new
    // identity on every parent render → the open-effect refires → reload →
    // setBalances in the parent → render → … an infinite fetch loop that
    // also wipes whatever the cashier is typing.
    const onBalanceChangeRef = useRef(onBalanceChange);
    onBalanceChangeRef.current = onBalanceChange;

    const reload = useCallback(async () => {
        setLoading(true);
        try {
            const [s, t] = await Promise.all([getWalletSummary(userId, 12), getBonusTiers()]);
            setSummary(s);
            setTiers(t);
            onBalanceChangeRef.current?.(userId, s.wallet.balance);
        } catch {
            setMsg({ ok: false, text: "Could not load the wallet." });
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        if (!open) return;
        setMsg(null); setAmount(""); setShowAdjust(false); setDelta(""); setReason("");
        reload();
    }, [open, reload]);

    const amt = Number(amount) || 0;
    const bonus = useMemo(() => previewBonus(tiers, amt), [tiers, amt]);

    const doTopUp = async () => {
        if (amt <= 0) { setMsg({ ok: false, text: "Enter a top-up amount." }); return; }
        setBusy(true); setMsg(null);
        try {
            const res = await topUpWallet(userId, amt, method);
            if (res.success && res.data) {
                setMsg({
                    ok: true,
                    text: res.data.bonusGiven > 0
                        ? `Loaded ${money(res.data.amountPaid)} + ${money(res.data.bonusGiven)} bonus. New balance ${money(res.data.newBalance)}.`
                        : `Loaded ${money(res.data.amountPaid)}. New balance ${money(res.data.newBalance)}.`,
                });
                setAmount("");
                await reload();
            } else {
                setMsg({ ok: false, text: res.message || res.error || "Top-up failed." });
            }
        } catch (e: unknown) {
            const err = e as { response?: { data?: { message?: string; error?: string } } };
            setMsg({ ok: false, text: err?.response?.data?.message || err?.response?.data?.error || "Top-up failed." });
        } finally { setBusy(false); }
    };

    const doAdjust = async () => {
        const d = Number(delta) || 0;
        if (d === 0) { setMsg({ ok: false, text: "Enter a non-zero amount." }); return; }
        if (!reason.trim()) { setMsg({ ok: false, text: "A reason is required for the audit trail." }); return; }
        setBusy(true); setMsg(null);
        try {
            const res = await adjustWallet(userId, d, d < 0 && cashOut, reason.trim());
            if (res.success) {
                setMsg({ ok: true, text: "Wallet updated." });
                setDelta(""); setReason("");
                await reload();
            } else {
                setMsg({ ok: false, text: res.message || res.error || "Adjustment failed." });
            }
        } catch (e: unknown) {
            const err = e as { response?: { data?: { message?: string; error?: string } } };
            setMsg({ ok: false, text: err?.response?.data?.message || err?.response?.data?.error || "Adjustment failed." });
        } finally { setBusy(false); }
    };

    return (
        <Modal isOpen={open} onClose={onClose} title={`Wallet — ${userName || `Client #${userId}`}`}>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                {loading && <div className="flex justify-center py-8"><Loader /></div>}

                {!loading && summary && (
                    <>
                        {/* Balance hero */}
                        <div className="rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-500 p-4 text-white">
                            <div className="text-xs uppercase tracking-wide text-indigo-100">Balance</div>
                            <div className="text-3xl font-bold mt-0.5">{money(summary.wallet.balance)}</div>
                            {!summary.wallet.isActive && (
                                <div className="mt-1 text-xs bg-white/20 rounded px-2 py-0.5 inline-block">Wallet disabled</div>
                            )}
                        </div>

                        {msg && (
                            <div className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                                {msg.text}
                            </div>
                        )}

                        {/* Top-up */}
                        <div className="rounded-xl border border-gray-200 p-3">
                            <div className="font-semibold text-sm mb-2">Top up</div>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <Input
                                        type="number"
                                        min="0"
                                        step={1}
                                        placeholder="Amount"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                    />
                                </div>
                                {/* Method segmented control */}
                                <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                                    {(["Cash", "Whish", "Card"] as const).map((m) => (
                                        <button
                                            key={m}
                                            type="button"
                                            onClick={() => setMethod(m)}
                                            className={`px-3 text-sm transition ${method === m ? "bg-indigo-600 text-white font-medium" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                                        >
                                            {m}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Bonus preview — sells the bigger top-up by itself */}
                            {amt > 0 && bonus.bonus > 0 && (
                                <div className="mt-2 text-xs rounded-lg bg-indigo-50 text-indigo-700 px-2.5 py-1.5">
                                    +{bonus.percent}% tier bonus → customer receives <b>{money(amt + bonus.bonus)}</b> ({money(bonus.bonus)} free)
                                </div>
                            )}
                            {amt > 0 && bonus.bonus === 0 && tiers.length > 0 && (() => {
                                const next = tiers.filter(t => t.isActive && t.minAmount > amt).sort((a, b) => a.minAmount - b.minAmount)[0];
                                return next ? (
                                    <div className="mt-2 text-xs text-gray-500">
                                        Tip: top up {money(next.minAmount)} to unlock +{next.bonusPercent}% bonus.
                                    </div>
                                ) : null;
                            })()}

                            <button
                                type="button"
                                disabled={busy || amt <= 0}
                                onClick={doTopUp}
                                className="mt-3 w-full h-10 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition"
                            >
                                {busy ? "Saving…" : amt > 0 ? `Load ${money(amt + bonus.bonus)}` : "Load"}
                            </button>
                        </div>

                        {/* Admin refund / correction */}
                        {isAdmin && (
                            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
                                <button
                                    type="button"
                                    className="text-sm font-semibold text-amber-800"
                                    onClick={() => setShowAdjust(v => !v)}
                                >
                                    {showAdjust ? "▾" : "▸"} Admin: refund / correction
                                </button>
                                {showAdjust && (
                                    <div className="mt-2 space-y-2">
                                        <div className="flex gap-2">
                                            <div className="flex-1">
                                                <Label>Amount (− removes)</Label>
                                                <Input type="number" step={1} placeholder="-20" value={delta} onChange={(e) => setDelta(e.target.value)} />
                                            </div>
                                            <div className="flex items-end pb-2">
                                                <label className="flex items-center gap-1.5 text-xs text-gray-700">
                                                    <input type="checkbox" checked={cashOut} onChange={(e) => setCashOut(e.target.checked)} />
                                                    Cash paid out
                                                </label>
                                            </div>
                                        </div>
                                        <div>
                                            <Label>Reason (required)</Label>
                                            <Input placeholder="Why?" value={reason} onChange={(e) => setReason(e.target.value)} />
                                        </div>
                                        <button
                                            type="button"
                                            disabled={busy}
                                            onClick={doAdjust}
                                            className="w-full h-9 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition"
                                        >
                                            Apply
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* History */}
                        <div>
                            <div className="font-semibold text-sm mb-1.5">Recent activity</div>
                            {summary.recent.length === 0 ? (
                                <div className="text-sm text-gray-400 text-center py-4 border border-dashed rounded-xl">
                                    No movements yet.
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-100 rounded-xl border border-gray-100">
                                    {summary.recent.map((t) => (
                                        <div key={t.id} className="flex items-center justify-between px-3 py-2 text-sm">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold ${TYPE_STYLES[t.type] ?? "bg-gray-100 text-gray-600"}`}>
                                                    {t.type}
                                                </span>
                                                <span className="text-gray-500 text-xs truncate">
                                                    {new Date(t.createdOn).toLocaleString()}
                                                    {t.transactionRecordId ? ` · #${t.transactionRecordId}` : ""}
                                                    {t.method ? ` · ${t.method}` : ""}
                                                </span>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <div className={`font-semibold ${NEGATIVE_TYPES.has(t.type) ? "text-gray-800" : "text-green-600"}`}>
                                                    {NEGATIVE_TYPES.has(t.type) ? "−" : "+"}{money(t.amount)}
                                                </div>
                                                <div className="text-[10px] text-gray-400">bal {money(t.balanceAfter)}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </Modal>
    );
}
