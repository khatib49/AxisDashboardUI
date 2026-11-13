import { useCallback, useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import Loader from "../../components/ui/Loader";
import Alert from "../../components/ui/alert/Alert";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../components/ui/table";
import {
  backfillPromotionPostings,
  errorMessage,
  getGiftCardLiabilityReport,
  getPromotionDiscountsReport,
  getPromotionPostings,
  GiftCardLiabilityReportDto,
  PromotionDiscountsReportDto,
  PromotionPostingDto,
  repostPromotionPostings,
} from "../../services/promotionsService";

type Notice = { variant: "success" | "error" | "warning" | "info"; title: string; message: string };

const money = (n: number | null | undefined) => (n ?? 0).toFixed(2);
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

const kindLabel: Record<string, string> = {
  Coupon: "Coupons",
  HappyHour: "Happy hour",
  Combo: "Combos",
  GiftCardLoad: "Gift card load",
  GiftCardRedeem: "Gift card redeem",
  GiftCardRefund: "Gift card refund",
};

const statusClass: Record<string, string> = {
  Posted: "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400",
  Pending: "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400",
};

const cardClass = "rounded-2xl border border-gray-200 bg-white p-4 text-gray-800 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90";
const headCell = "px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400";
const cell = "px-4 py-3 text-sm";
const btnPrimary = "rounded bg-brand-500 px-4 py-2 text-sm text-white hover:bg-brand-600 disabled:opacity-50";
const btnSecondary = "rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.05]";

function Stat({ title, value, sub, tone }: { title: string; value: string; sub?: string; tone?: "ok" | "bad" | "warn" }) {
  const color =
    tone === "ok" ? "text-success-600 dark:text-success-400"
    : tone === "bad" ? "text-error-600 dark:text-error-400"
    : tone === "warn" ? "text-warning-600 dark:text-warning-400"
    : "text-gray-800 dark:text-white/90";
  return (
    <div className={cardClass}>
      <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</div>
      <div className={`mt-1 text-xl font-semibold ${color}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{sub}</div>}
    </div>
  );
}

/**
 * Admin report: gift card liability (2150) vs outstanding card balances,
 * promotion discounts (4950 contra-revenue) by kind, the posting ledger and
 * the repost / backfill actions for postings deferred by a locked period.
 */
export default function PromotionAccounting() {
  const today = new Date();
  const [from, setFrom] = useState(isoDay(new Date(today.getTime() - 30 * 86400000)));
  const [to, setTo] = useState(isoDay(today));
  const [statusFilter, setStatusFilter] = useState("");

  const [liability, setLiability] = useState<GiftCardLiabilityReportDto | null>(null);
  const [liabilityError, setLiabilityError] = useState<string | null>(null);
  const [discounts, setDiscounts] = useState<PromotionDiscountsReportDto | null>(null);
  const [discountsError, setDiscountsError] = useState<string | null>(null);
  const [postings, setPostings] = useState<PromotionPostingDto[]>([]);
  const [postingsError, setPostingsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<"repost" | "backfill" | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  const reload = useCallback(async () => {
    setLoading(true);
    const fromIso = from ? new Date(from + "T00:00:00").toISOString() : undefined;
    const toIso = to ? new Date(to + "T23:59:59").toISOString() : undefined;
    const [l, d, p] = await Promise.allSettled([
      getGiftCardLiabilityReport(),
      getPromotionDiscountsReport(fromIso, toIso),
      getPromotionPostings(fromIso, toIso, statusFilter || undefined),
    ]);
    if (l.status === "fulfilled" && l.value.success && l.value.data) { setLiability(l.value.data); setLiabilityError(null); }
    else { setLiability(null); setLiabilityError(l.status === "rejected" ? errorMessage(l.reason, "Liability report unavailable") : l.value.message || "Liability report unavailable"); }
    if (d.status === "fulfilled" && d.value.success && d.value.data) { setDiscounts(d.value.data); setDiscountsError(null); }
    else { setDiscounts(null); setDiscountsError(d.status === "rejected" ? errorMessage(d.reason, "Discounts report unavailable") : d.value.message || "Discounts report unavailable"); }
    if (p.status === "fulfilled") { setPostings(Array.isArray(p.value) ? p.value : []); setPostingsError(null); }
    else { setPostings([]); setPostingsError(errorMessage(p.reason, "Postings unavailable")); }
    setLoading(false);
  }, [from, to, statusFilter]);

  useEffect(() => {
    const t = setTimeout(() => void reload(), 200);
    return () => clearTimeout(t);
  }, [reload]);

  async function runRepost() {
    setBusy("repost");
    try {
      const res = await repostPromotionPostings();
      if (!res.success || !res.data) {
        setNotice({ variant: "error", title: "Repost failed", message: res.message || res.error || "Repost failed" });
        return;
      }
      const d = res.data;
      setNotice({
        variant: d.stillPending > 0 ? "warning" : d.attempted === 0 ? "info" : "success",
        title: "Repost",
        message: res.message || `${d.posted} of ${d.attempted} posted`,
      });
      void reload();
    } catch (e) {
      setNotice({ variant: "error", title: "Repost failed", message: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  }

  async function runBackfill() {
    if (!window.confirm("Book every gift card movement and promotion application that has no ledger entry yet? Entries are dated when the action happened; locked months stay pending.")) return;
    setBusy("backfill");
    try {
      const res = await backfillPromotionPostings();
      if (!res.success || !res.data) {
        setNotice({ variant: "error", title: "Backfill failed", message: res.message || res.error || "Backfill failed" });
        return;
      }
      setNotice({ variant: res.data.stillPending > 0 ? "warning" : "success", title: "Backfill", message: res.message || `${res.data.posted} posted` });
      void reload();
    } catch (e) {
      setNotice({ variant: "error", title: "Backfill failed", message: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  }

  const pendingCount = postings.filter((p) => p.status === "Pending").length;
  const differenceTone = liability ? (liability.difference === 0 ? "ok" : liability.pendingPostings > 0 ? "warn" : "bad") : undefined;

  return (
    <>
      <PageMeta title="Promotion Accounting | Axis" description="Gift card liability and promotional discount postings" />
      <PageBreadcrumb pageTitle="Promotion Accounting" />

      {notice && <div className="mb-4"><Alert variant={notice.variant} title={notice.title} message={notice.message} /></div>}

      {/* ── filters + actions ─────────────────────────────────────────── */}
      <div className={`${cardClass} mb-4`}>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="pa-from">From</Label>
            <Input id="pa-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="pa-to">To</Label>
            <Input id="pa-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="pa-status">Postings</Label>
            <select
              id="pa-status"
              className="h-11 rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 focus:border-brand-300 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All</option>
              <option value="Posted">Posted</option>
              <option value="Pending">Pending</option>
            </select>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <button className={btnSecondary} onClick={() => void reload()} disabled={loading || busy !== null}>Refresh</button>
            <button className={btnSecondary} onClick={() => void runBackfill()} disabled={loading || busy !== null} title="Book historic movements that have no ledger entry yet">
              {busy === "backfill" ? "Backfilling…" : "Backfill history"}
            </button>
            <button className={btnPrimary} onClick={() => void runRepost()} disabled={loading || busy !== null}>
              {busy === "repost" ? "Reposting…" : `Repost pending${liability && liability.pendingPostings > 0 ? ` (${liability.pendingPostings})` : pendingCount > 0 ? ` (${pendingCount})` : ""}`}
            </button>
          </div>
        </div>
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          Gift card loads post DR 1000 Cash / CR 2150 Gift Card Liability; redeems DR 2150 / CR 4100 sales; refunds to card reverse the redeem.
          Coupon, happy hour and combo discounts post DR 4950 Promotional Discounts (contra-revenue) / CR 4100. A posting that hits a locked
          accounting period stays <em>Pending</em> (the sale or card movement still stands) until you repost it.
        </p>
      </div>

      {/* ── liability card ───────────────────────────────────────────── */}
      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {liabilityError ? (
          <div className={`${cardClass} md:col-span-2 xl:col-span-4 text-sm text-gray-500 dark:text-gray-400`}>Gift card liability: {liabilityError}</div>
        ) : liability ? (
          <>
            <Stat title="Outstanding on active cards" value={money(liability.activeCardBalance)} sub={`${liability.activeCards} active card(s)`} />
            <Stat title={`Ledger balance ${liability.liabilityAccountNumber}`} value={money(liability.ledgerBalance)} sub="posted, non-voided entries" />
            <Stat title="Difference" value={money(liability.difference)} tone={differenceTone} sub={liability.difference === 0 ? "Cards and ledger agree" : liability.note || "Cards and ledger differ"} />
            <Stat
              title="Pending postings"
              value={String(liability.pendingPostings)}
              tone={liability.pendingPostings > 0 ? "warn" : undefined}
              sub={liability.pendingPostings > 0 ? `${money(liability.pendingAmount)} not yet in the ledger` : `${liability.expiredCards} expired card(s) hold ${money(liability.expiredCardBalance)}`}
            />
          </>
        ) : (
          <div className={`${cardClass} md:col-span-2 xl:col-span-4 flex justify-center py-6`}><Loader /></div>
        )}
      </div>

      {/* ── discounts by kind ────────────────────────────────────────── */}
      <div className={`${cardClass} mb-4`}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold">Promotional discounts by kind</h3>
          {discounts && <span className="text-xs text-gray-500 dark:text-gray-400">Account {discounts.discountAccountNumber} · gift cards redeemed in range {money(discounts.giftCardRedeemed)}</span>}
        </div>
        {discountsError ? (
          <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">{discountsError}</div>
        ) : !discounts ? (
          <div className="flex justify-center py-6"><Loader /></div>
        ) : discounts.kinds.every((k) => k.postings === 0) ? (
          <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">No promotional discounts were booked in this range.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  {["Kind", "Applied", "Refunded", "Discount given", "Refunded amount", "Net discount", "Posted", "Pending"].map((h) => (
                    <TableCell key={h} isHeader className={headCell}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {discounts.kinds.map((k) => (
                  <TableRow key={k.kind} className="border-b border-gray-100 dark:border-white/[0.05]">
                    <TableCell className={`${cell} font-medium`}>{kindLabel[k.kind] ?? k.kind}</TableCell>
                    <TableCell className={cell}>{k.applied}</TableCell>
                    <TableCell className={cell}>{k.refunded}</TableCell>
                    <TableCell className={cell}>{money(k.discountGiven)}</TableCell>
                    <TableCell className={cell}>{money(k.discountRefunded)}</TableCell>
                    <TableCell className={`${cell} font-semibold`}>{money(k.netDiscount)}</TableCell>
                    <TableCell className={cell}>{money(k.postedAmount)}</TableCell>
                    <TableCell className={cell}>
                      {k.pendingPostings > 0 ? <span className={`rounded px-2 py-0.5 text-xs ${statusClass.Pending}`}>{k.pendingPostings} · {money(k.pendingAmount)}</span> : "—"}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-gray-50 dark:bg-white/[0.02]">
                  <TableCell className={`${cell} font-semibold`}>Total</TableCell>
                  <TableCell className={cell}>{discounts.kinds.reduce((a, k) => a + k.applied, 0)}</TableCell>
                  <TableCell className={cell}>{discounts.kinds.reduce((a, k) => a + k.refunded, 0)}</TableCell>
                  <TableCell className={cell}>{money(discounts.kinds.reduce((a, k) => a + k.discountGiven, 0))}</TableCell>
                  <TableCell className={cell}>{money(discounts.kinds.reduce((a, k) => a + k.discountRefunded, 0))}</TableCell>
                  <TableCell className={`${cell} font-semibold`}>{money(discounts.totalNetDiscount)}</TableCell>
                  <TableCell className={cell}>{money(discounts.totalPosted)}</TableCell>
                  <TableCell className={cell}>{discounts.totalPending !== 0 ? money(discounts.totalPending) : "—"}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* ── postings ledger ──────────────────────────────────────────── */}
      <div className={cardClass}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold">Postings</h3>
          <span className="text-xs text-gray-500 dark:text-gray-400">{postings.length} row(s){pendingCount > 0 ? ` · ${pendingCount} pending` : ""}</span>
        </div>
        {loading && postings.length === 0 ? (
          <div className="flex justify-center py-10"><Loader /></div>
        ) : postingsError ? (
          <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">{postingsError}</div>
        ) : postings.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">No postings in this range.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  {["When", "Type", "Reference", "Invoice", "Amount", "Debit", "Credit", "Entry", "Status", "Description"].map((h) => (
                    <TableCell key={h} isHeader className={headCell}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {postings.map((p) => (
                  <TableRow key={p.id} className="border-b border-gray-100 dark:border-white/[0.05]">
                    <TableCell className={`${cell} whitespace-nowrap`}>{new Date(p.on).toLocaleString()}</TableCell>
                    <TableCell className={cell}>{kindLabel[p.referenceType] ?? kindLabel[p.kind] ?? p.referenceType}</TableCell>
                    <TableCell className={`${cell} font-mono text-xs`}>#{p.referenceId}{p.sequence > 1 ? ` v${p.sequence}` : ""}</TableCell>
                    <TableCell className={cell}>{p.invoiceId ? `#${p.invoiceId}` : "—"}</TableCell>
                    <TableCell className={`${cell} font-semibold ${p.amount < 0 ? "text-error-600 dark:text-error-400" : ""}`}>{money(Math.abs(p.amount))}{p.amount < 0 ? " off" : ""}</TableCell>
                    <TableCell className={`${cell} font-mono text-xs`}>{p.debitAccount ?? "—"}</TableCell>
                    <TableCell className={`${cell} font-mono text-xs`}>{p.creditAccount ?? "—"}</TableCell>
                    <TableCell className={`${cell} font-mono text-xs`}>{p.entryNumber ?? "—"}</TableCell>
                    <TableCell className={cell}>
                      <span className={`rounded px-2 py-0.5 text-xs ${statusClass[p.status] ?? ""}`} title={p.error ?? undefined}>{p.status}</span>
                      {p.status === "Pending" && p.error && <div className="mt-1 max-w-xs text-xs text-warning-700 dark:text-warning-400">{p.error}</div>}
                    </TableCell>
                    <TableCell className={`${cell} max-w-md text-gray-600 dark:text-gray-400`}>{p.description ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </>
  );
}
