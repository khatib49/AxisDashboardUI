// Admin → Wallets
// ================
// Two jobs on one page:
//   1. Bonus tiers — "top up $100 → +10%" rules the till applies automatically.
//   2. Client wallet lookup — find any client by phone and open their wallet
//      (admin gets the refund / correction controls inside the modal).

import { useEffect, useState } from "react";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import Loader from "../../components/ui/Loader";
import WalletModal from "../../components/wallet/WalletModal";
import WalletMovements from "../../components/wallet/WalletMovements";
import {
    WalletBonusTier, getBonusTiers, createBonusTier, updateBonusTier, deleteBonusTier,
} from "../../services/walletService";
import { searchClientsByPhone, ClientUserDto } from "../../services/clientService";

const money = (n: number) => `$${n.toFixed(2)}`;

export default function Wallets() {
    // ── Tiers ────────────────────────────────────────────────────────────
    const [tiers, setTiers] = useState<WalletBonusTier[]>([]);
    const [tiersLoading, setTiersLoading] = useState(false);
    const [newMin, setNewMin] = useState("");
    const [newPct, setNewPct] = useState("");
    const [savingTier, setSavingTier] = useState(false);
    const [tierMsg, setTierMsg] = useState<string | null>(null);

    // ── Lookup ───────────────────────────────────────────────────────────
    const [phone, setPhone] = useState("");
    const [results, setResults] = useState<ClientUserDto[]>([]);
    const [searching, setSearching] = useState(false);
    const [walletClient, setWalletClient] = useState<ClientUserDto | null>(null);

    const loadTiers = async () => {
        setTiersLoading(true);
        try { setTiers(await getBonusTiers(true)); }
        catch { setTierMsg("Could not load tiers."); }
        finally { setTiersLoading(false); }
    };

    useEffect(() => { loadTiers(); }, []);

    const addTier = async () => {
        const min = Number(newMin), pct = Number(newPct);
        if (!(min >= 0) || !(pct > 0) || pct > 100) {
            setTierMsg("Enter a minimum amount and a bonus percent between 0 and 100.");
            return;
        }
        setSavingTier(true); setTierMsg(null);
        try {
            await createBonusTier({ minAmount: min, bonusPercent: pct });
            setNewMin(""); setNewPct("");
            await loadTiers();
        } catch { setTierMsg("Could not save the tier."); }
        finally { setSavingTier(false); }
    };

    const toggleTier = async (t: WalletBonusTier) => {
        try {
            await updateBonusTier(t.id, { minAmount: t.minAmount, bonusPercent: t.bonusPercent, isActive: !t.isActive });
            await loadTiers();
        } catch { setTierMsg("Could not update the tier."); }
    };

    const removeTier = async (t: WalletBonusTier) => {
        if (!confirm(`Delete the "${money(t.minAmount)} → +${t.bonusPercent}%" tier?`)) return;
        try { await deleteBonusTier(t.id); await loadTiers(); }
        catch { setTierMsg("Could not delete the tier."); }
    };

    const search = async () => {
        if (!phone.trim()) return;
        setSearching(true);
        try { setResults(await searchClientsByPhone(phone.trim())); }
        catch { setResults([]); }
        finally { setSearching(false); }
    };

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">Customer Wallets</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                    Prepaid balances clients can spend on games or food. Top-ups happen at any till;
                    refunds and corrections only here.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* ── Bonus tiers ─────────────────────────────────────── */}
                <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
                    <h2 className="font-semibold text-gray-900">Top-up bonus tiers</h2>
                    <p className="text-xs text-gray-500 mt-0.5 mb-4">
                        The highest tier a top-up reaches wins — tiers don't stack.
                        Example: with $50 → +5% and $100 → +10%, a $150 top-up gets exactly +10%.
                    </p>

                    {tierMsg && <div className="mb-3 rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{tierMsg}</div>}

                    {tiersLoading ? <div className="py-6 flex justify-center"><Loader /></div> : (
                        <div className="space-y-2">
                            {tiers.length === 0 && (
                                <div className="text-sm text-gray-400 border border-dashed rounded-xl text-center py-5">
                                    No tiers yet — top-ups are 1:1 until you add one.
                                </div>
                            )}
                            {tiers.map((t) => (
                                <div key={t.id} className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 ${t.isActive ? "border-gray-200" : "border-gray-100 opacity-55"}`}>
                                    <div className="text-sm">
                                        <span className="font-semibold text-gray-900">{money(t.minAmount)}+</span>
                                        <span className="text-gray-500"> → </span>
                                        <span className="font-semibold text-indigo-700">+{t.bonusPercent}% bonus</span>
                                        {!t.isActive && <span className="ml-2 text-[10px] uppercase text-gray-400">off</span>}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 hover:bg-gray-50" onClick={() => toggleTier(t)}>
                                            {t.isActive ? "Disable" : "Enable"}
                                        </button>
                                        <button className="text-xs px-2.5 py-1 rounded-lg text-red-600 border border-red-200 hover:bg-red-50" onClick={() => removeTier(t)}>
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="mt-4 flex items-end gap-2">
                        <div className="flex-1">
                            <Label>Min top-up ($)</Label>
                            <Input type="number" min="0" step={1} placeholder="100" value={newMin} onChange={(e) => setNewMin(e.target.value)} />
                        </div>
                        <div className="flex-1">
                            <Label>Bonus %</Label>
                            <Input type="number" min="0" step={1} placeholder="10" value={newPct} onChange={(e) => setNewPct(e.target.value)} />
                        </div>
                        <button
                            onClick={addTier}
                            disabled={savingTier}
                            className="h-11 px-4 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"
                        >
                            Add
                        </button>
                    </div>
                </div>

                {/* ── Client lookup ───────────────────────────────────── */}
                <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
                    <h2 className="font-semibold text-gray-900">Find a client's wallet</h2>
                    <p className="text-xs text-gray-500 mt-0.5 mb-4">
                        Search by phone, then open the wallet to top up, refund, or correct the balance.
                    </p>

                    <div className="flex gap-2">
                        <div className="flex-1">
                            <Input
                                placeholder="Phone number…"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") search(); }}
                            />
                        </div>
                        <button
                            onClick={search}
                            disabled={searching}
                            className="h-11 px-4 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 transition"
                        >
                            {searching ? "…" : "Search"}
                        </button>
                    </div>

                    <div className="mt-3 space-y-1.5">
                        {results.map((c) => (
                            <button
                                key={c.id}
                                onClick={() => setWalletClient(c)}
                                className="w-full flex items-center justify-between rounded-xl border border-gray-200 px-3.5 py-2.5 text-left hover:border-indigo-300 hover:bg-indigo-50/40 transition"
                            >
                                <div>
                                    <div className="text-sm font-medium text-gray-900">
                                        {`${c.firstName || ""} ${c.lastName || ""}`.trim() || `Client #${c.id}`}
                                    </div>
                                    <div className="text-xs text-gray-500">{c.phoneNumber}</div>
                                </div>
                                <span className="text-xs text-indigo-600 font-medium">Open wallet →</span>
                            </button>
                        ))}
                        {!searching && results.length === 0 && phone && (
                            <div className="text-sm text-gray-400 text-center py-4">No matches yet — press Search.</div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Money feed — filter by day/type/method, totals on top ── */}
            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
                <h2 className="font-semibold text-gray-900">Wallet money movements</h2>
                <p className="text-xs text-gray-500 mt-0.5 mb-4">
                    Every top-up, spend and refund across all wallets. "Cash in box" is what physically
                    entered the drawer in the selected period.
                </p>
                <WalletMovements />
            </div>

            {walletClient && (
                <WalletModal
                    open
                    userId={walletClient.id}
                    userName={`${walletClient.firstName || ""} ${walletClient.lastName || ""}`.trim() || walletClient.phoneNumber}
                    onClose={() => setWalletClient(null)}
                />
            )}
        </div>
    );
}
