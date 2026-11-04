import { useEffect, useState } from "react";
import Modal from "../ui/Modal";
import Loader from "../ui/Loader";
import TenderDialog from "../../pages/Till/TenderDialog";
import GiftCardRedeem from "../../pages/Promotions/GiftCardRedeem";
import CouponApplyDialog from "../promotions/CouponApplyDialog";
import { getTenderSummary, type TenderSummaryDto } from "../../services/tillService";
import { autoApply, getApplied, type AppliedPromotionsDto } from "../../services/promotionsService";
import AppliedPromotionChips from "../promotions/AppliedPromotionChips";
import { describeAutoApply } from "../promotions/cartPromotions";
import { QRCodeSVG } from "qrcode.react";
import { getDisplayRegister, requestDisplayWhish } from "../../services/displayService";
import { getWhishStatus, isWhishNotConfigured, startWhishPayment, type WhishStartResultDto } from "../../services/whishPayService";
import CardTerminalPay from "./CardTerminalPay";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  /** Open invoice being paid. */
  invoiceId: number;
  /** Current invoice total in USD (refreshed by the parent after promotions). */
  total: number;
  /** Ask the parent to reload the invoice (after a coupon / gift card changed the total). */
  onInvoiceChanged?: () => void | Promise<void>;
  /** Confirms payment: the parent calls the existing close-invoice endpoint. */
  onConfirmClose: () => void | Promise<void>;
  closing?: boolean;
};

/**
 * Till checkout step shown before an open invoice is closed. Groups the
 * additive payment tools (coupon, gift card, multi-currency tenders) around the
 * existing "close & pay" action, which stays exactly as it was.
 */
export default function CheckoutDialog({ isOpen, onClose, invoiceId, total, onInvoiceChanged, onConfirmClose, closing }: Props) {
  const [couponOpen, setCouponOpen] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [tenderOpen, setTenderOpen] = useState(false);
  const [summary, setSummary] = useState<TenderSummaryDto | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [applied, setApplied] = useState<AppliedPromotionsDto | null>(null);
  const [recheck, setRecheck] = useState<{ busy: boolean; note: string | null }>({ busy: false, note: null });
  const [whish, setWhish] = useState<WhishStartResultDto | null>(null);
  const [whishStatus, setWhishStatus] = useState<string | null>(null);
  const [whishError, setWhishError] = useState<string | null>(null);
  const [whishBusy, setWhishBusy] = useState(false);

  async function payWithWhish() {
    setWhishBusy(true); setWhishError(null);
    try {
      const register = getDisplayRegister();
      // With a display attached the QR also shows on the customer screen; otherwise a plain till request.
      const r = register ? await requestDisplayWhish(register, invoiceId) : await startWhishPayment(invoiceId, "Till");
      setWhish(r); setWhishStatus(r.status);
    } catch (e) {
      setWhishError(isWhishNotConfigured(e) ? "Whish not configured" : ((e as { message?: string })?.message ?? "Could not start Whish"));
    } finally { setWhishBusy(false); }
  }

  async function refreshApplied() {
    try {
      const res = await getApplied(invoiceId);
      setApplied(res.success && res.data ? res.data : null);
    } catch {
      setApplied(null); // endpoint unavailable (404/403) → no chips, nothing else changes
    }
  }

  async function recheckPromotions() {
    setRecheck({ busy: true, note: null });
    try {
      const res = await autoApply(invoiceId);
      if (res.success && res.data) {
        const changed = (res.data.happyHour?.delta ?? 0) !== 0 || res.data.combos.some((c) => c.delta !== 0);
        setRecheck({ busy: false, note: changed ? (describeAutoApply(res.data) ?? "Promotions updated.") : "Promotions are up to date." });
        if (changed) await onInvoiceChanged?.();
      } else {
        setRecheck({ busy: false, note: res.message || "Could not re-check promotions." });
      }
    } catch {
      setRecheck({ busy: false, note: "Promotions are not available right now." });
    }
    void refreshApplied();
  }

  async function refreshSummary() {
    setLoadingSummary(true);
    try {
      const res = await getTenderSummary(invoiceId);
      setSummary(res.success && res.data ? res.data : null);
    } catch {
      setSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  }

  useEffect(() => {
    if (!isOpen) return;
    void refreshSummary();
    void refreshApplied();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, invoiceId, total]);

  useEffect(() => {
    if (!isOpen) { setWhish(null); setWhishStatus(null); setWhishError(null); return; }
    if (!whish || whishStatus === "Paid" || whishStatus === "Failed" || whishStatus === "Expired") return;
    const t = setInterval(async () => {
      try {
        const s = await getWhishStatus(whish.requestId);
        setWhishStatus(s.status);
        if (s.status === "Paid") { void refreshSummary(); if (s.invoiceClosed) void onInvoiceChanged?.(); }
      } catch { /* keep polling */ }
    }, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, whish, whishStatus]);

  const paid = summary?.paidInBase ?? 0;
  const remaining = summary ? summary.remainingInBase : total;

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={`Checkout — invoice #${invoiceId}`} className="max-w-lg">
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Invoice total</span>
              <span className="text-xl font-bold text-orange-600">${total.toFixed(2)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Tenders recorded</span>
              <span className="font-medium">{loadingSummary ? <Loader size={12} /> : `$${paid.toFixed(2)}`}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Remaining</span>
              <span className={`font-medium ${remaining <= 0 ? "text-green-600" : ""}`}>${Math.max(remaining, 0).toFixed(2)}</span>
            </div>
            {summary && summary.changeInBase > 0 && (
              <div className="mt-1 flex items-center justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Change due</span>
                <span className="font-medium text-green-600">
                  {summary.changeByCurrency.map((c) => `${c.currencyCode} ${c.amount.toLocaleString()}`).join(" / ")}
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <button type="button" onClick={() => setCouponOpen(true)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300">
              Coupon
            </button>
            <button type="button" onClick={() => setGiftOpen(true)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300">
              Gift card
            </button>
            <button type="button" onClick={() => setTenderOpen(true)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300">
              Tenders (USD / LBP)
            </button>
            <button type="button" onClick={() => void payWithWhish()} disabled={whishBusy || remaining <= 0} className="rounded-lg border border-emerald-500 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-400 dark:hover:bg-white/5">
              {whishBusy ? "Starting…" : "Pay with Whish (QR)"}
            </button>
          </div>
          {whishError && <p className="text-xs text-red-600">{whishError}</p>}
          {whish && (
            <div className="rounded-xl border border-gray-200 p-3 text-center dark:border-gray-700">
              {whishStatus === "Paid" ? (
                <p className="text-sm font-medium text-green-600">Whish payment received (${whish.amount.toFixed(2)}). Tender recorded{summary && summary.remainingInBase <= 0 ? "; invoice closed." : "."}</p>
              ) : (
                <>
                  <div className="inline-block rounded-lg bg-white p-2"><QRCodeSVG value={whish.qrPayload} size={160} /></div>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Customer scans with Whish · ${whish.amount.toFixed(2)} · {whishStatus ?? "Pending"}{getDisplayRegister() ? " · also on the customer display" : ""}</p>
                </>
              )}
            </div>
          )}

          <CardTerminalPay invoiceId={invoiceId} remaining={remaining} onPaid={(closed) => { void refreshSummary(); if (closed) void onInvoiceChanged?.(); }} />

          <p className="text-xs text-gray-500 dark:text-gray-400">
            Coupons and gift cards reduce the invoice total. Tenders record what the customer handed over and the change due. Closing marks the invoice paid, exactly as before.
          </p>

          {/* Promotions currently booked (happy hour / combos / coupons) */}
          <div className="rounded-lg border border-dashed border-gray-200 px-3 py-2 text-xs dark:border-gray-700" data-testid="checkout-promotions">
            <div className="flex items-center justify-between gap-2">
              <span className="text-gray-500 dark:text-gray-400">
                Promotions
                {applied && applied.totalDiscount > 0 ? (
                  <span className="ml-1 font-medium text-success-700 dark:text-success-400">−${applied.totalDiscount.toFixed(2)}</span>
                ) : (
                  <span className="ml-1 text-gray-400">none applied</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => void recheckPromotions()}
                disabled={recheck.busy}
                className="text-brand-600 underline-offset-2 hover:underline disabled:opacity-50 dark:text-brand-400"
              >
                {recheck.busy ? "Checking…" : "Re-check promotions"}
              </button>
            </div>
            <AppliedPromotionChips applied={applied} className="mt-1" />
            {recheck.note && <p className="mt-1 text-gray-500 dark:text-gray-400">{recheck.note}</p>}
          </div>

          <div className="flex justify-end gap-2 border-t border-gray-200 pt-3 dark:border-gray-700">
            <button type="button" onClick={onClose} disabled={closing} className="rounded-lg border px-4 py-2 text-sm dark:border-gray-700 text-gray-700 dark:text-gray-300">Cancel</button>
            <button type="button" onClick={() => void onConfirmClose()} disabled={closing} className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
              {closing ? <Loader size={14} /> : null}
              Close &amp; mark paid
            </button>
          </div>
        </div>
      </Modal>

      <CouponApplyDialog
        isOpen={couponOpen}
        onClose={() => setCouponOpen(false)}
        transactionId={invoiceId}
        onApplied={() => { void onInvoiceChanged?.(); }}
      />
      <GiftCardRedeem
        isOpen={giftOpen}
        onClose={() => setGiftOpen(false)}
        transactionId={invoiceId}
        invoiceTotal={total}
        onApplied={() => { void onInvoiceChanged?.(); }}
      />
      {tenderOpen && (
        <TenderDialog
          isOpen={tenderOpen}
          onClose={() => { setTenderOpen(false); void refreshSummary(); }}
          transactionId={invoiceId}
          total={total}
          onSaved={(s) => setSummary(s)}
        />
      )}
    </>
  );
}
