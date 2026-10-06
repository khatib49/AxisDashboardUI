// Admin → Wallets
// ================
// Two jobs on one page:
//   1. Bonus tiers — "top up $100 → +10%" rules the till applies automatically.
//   2. Client wallet lookup — find any client by phone and open their wallet
//      (admin gets the refund / correction controls inside the modal).

import { useEffect, useState } from "react";
import { Button, Empty, Skeleton, Tooltip } from "antd";
import {
    DeleteOutlined, GiftOutlined, PauseCircleOutlined, PlayCircleOutlined,
    PlusOutlined, RightOutlined, SearchOutlined, WalletOutlined,
} from "@ant-design/icons";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import WalletModal from "../../components/wallet/WalletModal";
import WalletMovements from "../../components/wallet/WalletMovements";
import { PageHeader, Panel, Pill, StatTile } from "../../components/ui/PageKit";
import {
    WalletBonusTier, getBonusTiers, createBonusTier, updateBonusTier, deleteBonusTier,
} from "../../services/walletService";
import { searchClientsByPhone, ClientUserDto } from "../../services/clientService";

const money = (n: number) => `$${n.toFixed(2)}`;

export default function Wallets() {
    // ── Tiers ────────────────────────────────────────────────────────────
    const [tiers, setTiers] = useState<WalletBonusTier[]>([]);
    // Starts true so the first paint shows skeletons, not "no tiers".
    const [tiersLoading, setTiersLoading] = useState(true);
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

    // KPI figures — derived from the tiers already loaded above.
    const activeTiers = tiers.filter(t => t.isActive);
    const bestBonus = activeTiers.reduce<WalletBonusTier | null>((best, t) => (!best || t.bonusPercent > best.bonusPercent ? t : best), null);
    const entryTier = activeTiers.reduce<WalletBonusTier | null>((low, t) => (!low || t.minAmount < low.minAmount ? t : low), null);
    const firstLoad = tiersLoading && tiers.length === 0;

    return (
        <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6">
            <PageHeader
                tone="emerald"
                icon={<WalletOutlined />}
                title="Customer Wallets"
                description="Prepaid balances clients can spend on games or food. Top-ups happen at any till; refunds and corrections only here."
            />

            {/* ── KPI tiles (from the bonus tiers) ─────────────────────── */}
            <div className="grid gap-4 sm:grid-cols-3">
                <StatTile
                    label="Active bonus tiers"
                    loading={firstLoad}
                    value={<span className="tabular-nums">{activeTiers.length}</span>}
                    sub={<span className="tabular-nums">{tiers.length - activeTiers.length} disabled</span>}
                    accent={<span className="rounded-lg bg-emerald-50 p-1.5 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300"><GiftOutlined /></span>}
                />
                <StatTile
                    label="Best bonus"
                    loading={firstLoad}
                    value={<span className="tabular-nums">{bestBonus ? `+${bestBonus.bonusPercent}%` : "—"}</span>}
                    sub={bestBonus ? <span className="tabular-nums">On top-ups of {money(bestBonus.minAmount)}+</span> : "Top-ups are 1:1"}
                />
                <StatTile
                    label="Bonus starts at"
                    loading={firstLoad}
                    value={<span className="tabular-nums">{entryTier ? money(entryTier.minAmount) : "—"}</span>}
                    sub={entryTier ? <span className="tabular-nums">+{entryTier.bonusPercent}% from this amount</span> : "No active tier"}
                />
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                {/* ── Bonus tiers ─────────────────────────────────────── */}
                <Panel
                    title="Top-up bonus tiers"
                    subtitle="The highest tier a top-up reaches wins — tiers don't stack. Example: with $50 → +5% and $100 → +10%, a $150 top-up gets exactly +10%."
                >
                    {tierMsg && (
                        <div role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                            {tierMsg}
                        </div>
                    )}

                    {tiersLoading ? <Skeleton active paragraph={{ rows: 3 }} title={false} /> : (
                        <div className="space-y-2">
                            {tiers.length === 0 && (
                                <div className="rounded-xl border border-dashed border-gray-200 py-4 dark:border-white/10">
                                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No tiers yet — top-ups are 1:1 until you add one." />
                                </div>
                            )}
                            {tiers.map((t) => (
                                <div
                                    key={t.id}
                                    className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 ${
                                        t.isActive
                                            ? "border-gray-200 dark:border-white/10"
                                            : "border-gray-100 bg-gray-50/60 dark:border-white/[0.05] dark:bg-white/[0.02]"
                                    }`}
                                >
                                    <div className={`flex flex-wrap items-center gap-2 text-sm ${t.isActive ? "" : "opacity-60"}`}>
                                        <span className="font-semibold tabular-nums text-gray-900 dark:text-white">{money(t.minAmount)}+</span>
                                        <span className="text-gray-400 dark:text-gray-500">→</span>
                                        <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">+{t.bonusPercent}% bonus</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        {t.isActive ? <Pill tone="emerald" dot>On</Pill> : <Pill tone="gray" dot>Off</Pill>}
                                        <Button size="small" icon={t.isActive ? <PauseCircleOutlined /> : <PlayCircleOutlined />} onClick={() => toggleTier(t)}>
                                            {t.isActive ? "Disable" : "Enable"}
                                        </Button>
                                        <Tooltip title="Delete tier">
                                            <Button
                                                size="small"
                                                danger
                                                icon={<DeleteOutlined />}
                                                onClick={() => removeTier(t)}
                                                aria-label={`Delete the ${money(t.minAmount)} → +${t.bonusPercent}% tier`}
                                            />
                                        </Tooltip>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-gray-100 pt-4 dark:border-white/[0.06]">
                        <div className="min-w-[120px] flex-1">
                            <Label htmlFor="wallet-tier-min">Min top-up ($)</Label>
                            <Input id="wallet-tier-min" type="number" min="0" step={1} placeholder="100" value={newMin} onChange={(e) => setNewMin(e.target.value)} />
                        </div>
                        <div className="min-w-[120px] flex-1">
                            <Label htmlFor="wallet-tier-pct">Bonus %</Label>
                            <Input id="wallet-tier-pct" type="number" min="0" step={1} placeholder="10" value={newPct} onChange={(e) => setNewPct(e.target.value)} />
                        </div>
                        <Button
                            type="primary"
                            size="large"
                            icon={<PlusOutlined />}
                            onClick={addTier}
                            disabled={savingTier}
                            loading={savingTier}
                            className="h-11!"
                        >
                            Add
                        </Button>
                    </div>
                </Panel>

                {/* ── Client lookup ───────────────────────────────────── */}
                <Panel
                    title="Find a client's wallet"
                    subtitle="Search by phone, then open the wallet to top up, refund, or correct the balance."
                >
                    <div className="flex gap-2">
                        <div className="relative min-w-0 flex-1">
                            <Label htmlFor="wallet-client-phone" className="sr-only">Phone number</Label>
                            <Input
                                id="wallet-client-phone"
                                placeholder="Phone number…"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") search(); }}
                            />
                        </div>
                        <Button
                            size="large"
                            icon={<SearchOutlined />}
                            onClick={search}
                            disabled={searching}
                            loading={searching}
                            className="h-11!"
                        >
                            Search
                        </Button>
                    </div>

                    <div className="mt-3 space-y-1.5">
                        {results.map((c) => (
                            <button
                                key={c.id}
                                type="button"
                                onClick={() => setWalletClient(c)}
                                className="group flex w-full items-center justify-between gap-3 rounded-xl border border-gray-200 px-3.5 py-2.5 text-left transition hover:border-emerald-300 hover:bg-emerald-50/40 dark:border-white/10 dark:hover:border-emerald-500/40 dark:hover:bg-emerald-500/5"
                            >
                                <div className="min-w-0">
                                    <div className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                                        {`${c.firstName || ""} ${c.lastName || ""}`.trim() || `Client #${c.id}`}
                                    </div>
                                    <div className="text-xs tabular-nums text-gray-500 dark:text-gray-400">{c.phoneNumber}</div>
                                </div>
                                <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                                    Open wallet <RightOutlined className="text-[10px] transition-transform group-hover:translate-x-0.5" />
                                </span>
                            </button>
                        ))}
                        {searching && results.length === 0 && <Skeleton active paragraph={{ rows: 2 }} title={false} />}
                        {!searching && results.length === 0 && phone && (
                            <div className="py-3">
                                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No matches yet — press Search." />
                            </div>
                        )}
                    </div>
                </Panel>
            </div>

            {/* ── Money feed — filter by day/type/method, totals on top ── */}
            <Panel
                title="Wallet money movements"
                subtitle={'Every top-up, spend and refund across all wallets. "Cash in box" is what physically entered the drawer in the selected period.'}
            >
                <WalletMovements />
            </Panel>

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
