import { useEffect, useState } from "react";
import Modal from "../ui/Modal";
import Loader from "../ui/Loader";
import TenderDialog from "../../pages/Till/TenderDialog";
import GiftCardRedeem from "../../pages/Promotions/GiftCardRedeem";
import CouponApplyDialog from "../promotions/CouponApplyDialog";
import { getTenderSummary, type TenderSummaryDto } from "../../services/tillService";

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, invoiceId, total]);

  const paid = summary?.paidInBase ?? 0;
  const remaining = summary ? summary.remainingInBase : total;

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={`Checkout — invoice #${invoiceId}`} className="max-w-lg">
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Invoice total</span>
              <span className="text-xl font-bold text-orange-600">${total.toFixed(2)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-gray-500">Tenders recorded</span>
              <span className="font-medium">{loadingSummary ? <Loader size={12} /> : `$${paid.toFixed(2)}`}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-sm">
              <span className="text-gray-500">Remaining</span>
              <span className={`font-medium ${remaining <= 0 ? "text-green-600" : ""}`}>${Math.max(remaining, 0).toFixed(2)}</span>
            </div>
            {summary && summary.changeInBase > 0 && (
              <div className="mt-1 flex items-center justify-between text-sm">
                <span className="text-gray-500">Change due</span>
                <span className="font-medium text-green-600">
                  {summary.changeByCurrency.map((c) => `${c.currencyCode} ${c.amount.toLocaleString()}`).join(" / ")}
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={() => setCouponOpen(true)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-white/5">
              Coupon
            </button>
            <button type="button" onClick={() => setGiftOpen(true)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-white/5">
              Gift card
            </button>
            <button type="button" onClick={() => setTenderOpen(true)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-white/5">
              Tenders (USD / LBP)
            </button>
          </div>

          <p className="text-xs text-gray-500">
            Coupons and gift cards reduce the invoice total. Tenders record what the customer handed over and the change due. Closing marks the invoice paid, exactly as before.
          </p>

          <div className="flex justify-end gap-2 border-t border-gray-200 pt-3 dark:border-gray-700">
            <button type="button" onClick={onClose} disabled={closing} className="rounded-lg border px-4 py-2 text-sm dark:border-gray-700">Cancel</button>
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
