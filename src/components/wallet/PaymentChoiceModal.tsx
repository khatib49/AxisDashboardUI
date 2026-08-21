// PaymentChoiceModal
// ==================
// One payment picker for every checkout: Cash, Wallet, or a mix.
// Shows the client's live balance so the cashier never guesses.
//
// `total` may be null for game sessions — their price is computed from
// elapsed time AT close, so "Wallet" there means "take as much as the wallet
// covers, rest in cash" (the server clamps the charge to the final bill).

import { useEffect, useMemo, useState } from "react";
import Modal from "../ui/Modal";
import Input from "../form/input/InputField";
import Loader from "../ui/Loader";
import { getWalletSummary } from "../../services/walletService";

type Mode = "cash" | "wallet" | "mix";

interface Props {
    open: boolean;
    /** Final bill when known; null for time-billed sessions. */
    total: number | null;
    userId?: number | null;
    userName?: string | null;
    busy?: boolean;
    onCancel: () => void;
    /** walletAmount = 0 means all cash. */
    onConfirm: (walletAmount: number) => void;
}

const money = (n: number) => `$${n.toFixed(2)}`;

export default function PaymentChoiceModal({ open, total, userId, userName, busy, onCancel, onConfirm }: Props) {
    const [mode, setMode] = useState<Mode>("cash");
    const [balance, setBalance] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [mixAmount, setMixAmount] = useState("");

    useEffect(() => {
        if (!open) return;
        setMode("cash"); setMixAmount(""); setBalance(null);
        if (userId && userId > 0) {
            setLoading(true);
            getWalletSummary(userId, 1)
                .then((s) => setBalance(s.wallet.isActive ? s.wallet.balance : 0))
                .catch(() => setBalance(null))
                .finally(() => setLoading(false));
        }
    }, [open, userId]);

    const hasClient = !!userId && userId > 0;
    const bal = balance ?? 0;

    // Wallet can cover at most min(balance, total); with unknown total the
    // cap is just the balance and the server clamps the rest.
    const walletMax = total == null ? bal : Math.min(bal, total);
    const walletCoversAll = total != null && bal >= total;

    const mix = Math.max(0, Math.min(Number(mixAmount) || 0, walletMax));

    const chosenWalletAmount = useMemo(() => {
        if (mode === "cash") return 0;
        if (mode === "wallet") return walletMax;
        return mix;
    }, [mode, walletMax, mix]);

    const cashPart = total == null ? null : Math.max(0, total - chosenWalletAmount);

    const options: { key: Mode; label: string; hint: string; disabled?: boolean }[] = [
        { key: "cash", label: "💵 Cash", hint: total == null ? "Full amount in cash" : `Collect ${money(total)} in cash` },
        {
            key: "wallet",
            label: "💰 Wallet",
            hint: !hasClient ? "Attach a client first"
                : bal <= 0 ? "Wallet is empty"
                : total == null ? `Uses up to ${money(bal)}; any remainder in cash`
                : walletCoversAll ? `Fully covered — balance after: ${money(bal - total)}`
                : `Covers ${money(walletMax)}, collect ${money((total ?? 0) - walletMax)} cash`,
            disabled: !hasClient || bal <= 0,
        },
        {
            key: "mix",
            label: "⚖️ Custom split",
            hint: "Choose how much comes from the wallet",
            disabled: !hasClient || bal <= 0,
        },
    ];

    return (
        <Modal isOpen={open} onClose={onCancel} title="How is this paid?">
            <div className="space-y-3">
                {total != null && (
                    <div className="rounded-xl bg-gray-900 text-white px-4 py-3 flex items-baseline justify-between">
                        <span className="text-sm text-gray-300">Total due</span>
                        <span className="text-2xl font-bold">{money(total)}</span>
                    </div>
                )}

                {hasClient ? (
                    <div className="flex items-center justify-between text-sm px-1">
                        <span className="text-gray-600">{userName || "Client"} — wallet:</span>
                        {loading ? <Loader /> : (
                            <span className={`font-semibold ${bal > 0 ? "text-indigo-700" : "text-gray-400"}`}>
                                {balance == null ? "unavailable" : money(bal)}
                            </span>
                        )}
                    </div>
                ) : (
                    <div className="text-xs text-gray-500 px-1">
                        No client attached — wallet payment needs an attached client.
                    </div>
                )}

                <div className="space-y-2">
                    {options.map((o) => (
                        <button
                            key={o.key}
                            type="button"
                            disabled={o.disabled}
                            onClick={() => setMode(o.key)}
                            className={`w-full text-left rounded-xl border-2 px-3.5 py-2.5 transition ${
                                o.disabled ? "opacity-45 cursor-not-allowed border-gray-100"
                                : mode === o.key ? "border-indigo-500 bg-indigo-50/60 ring-2 ring-indigo-500/15"
                                : "border-gray-150 border-gray-200 hover:border-gray-300"
                            }`}
                        >
                            <div className="text-sm font-semibold text-gray-900">{o.label}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{o.hint}</div>
                        </button>
                    ))}
                </div>

                {mode === "mix" && (
                    <div className="rounded-xl border border-gray-200 p-3">
                        <div className="text-xs text-gray-600 mb-1.5">
                            From wallet (max {money(walletMax)}):
                        </div>
                        <Input
                            type="number"
                            min="0"
                            step={1}
                            placeholder="0"
                            value={mixAmount}
                            onChange={(e) => setMixAmount(e.target.value)}
                        />
                        {total != null && (
                            <div className="text-xs text-gray-500 mt-1.5">
                                Wallet {money(mix)} + cash {money(Math.max(0, total - mix))}
                            </div>
                        )}
                    </div>
                )}

                <div className="flex gap-2 pt-1">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 h-11 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        disabled={busy || (mode === "mix" && mix <= 0)}
                        onClick={() => onConfirm(Math.round(chosenWalletAmount * 100) / 100)}
                        className="flex-1 h-11 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"
                    >
                        {busy ? "Processing…"
                            : chosenWalletAmount > 0
                                ? cashPart != null && cashPart > 0
                                    ? `Wallet ${money(chosenWalletAmount)} + cash`
                                    : `Pay from wallet`
                                : "Confirm cash"}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
