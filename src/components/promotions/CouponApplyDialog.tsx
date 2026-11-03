import { useEffect, useState } from "react";
import Modal from "../ui/Modal";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import Alert from "../ui/alert/Alert";
import {
  CouponRedeemResultDto,
  CouponValidationResultDto,
  errorMessage,
  redeemCoupon,
  validateCoupon,
} from "../../services/promotionsService";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  /** The OPEN invoice the coupon is applied to. */
  transactionId: number;
  onApplied?: (result: CouponRedeemResultDto) => void;
};

/**
 * Modal flavour of the Apply Coupon page for use inside the till: the invoice
 * is fixed, the cashier types the code, checks it and applies it.
 */
export default function CouponApplyDialog({ isOpen, onClose, transactionId, onApplied }: Props) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [check, setCheck] = useState<CouponValidationResultDto | null>(null);
  const [applied, setApplied] = useState<CouponRedeemResultDto | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setCode("");
    setCheck(null);
    setApplied(null);
    setError(null);
  }, [isOpen, transactionId]);

  async function doValidate() {
    if (!code.trim()) {
      setError("Enter the coupon code.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await validateCoupon({ code: code.trim(), transactionId });
      if (!res.success || !res.data) {
        setCheck(null);
        setError(res.message || "Coupon could not be checked");
        return;
      }
      setCheck(res.data);
    } catch (e) {
      setCheck(null);
      setError(errorMessage(e, "Coupon could not be checked"));
    } finally {
      setBusy(false);
    }
  }

  async function doRedeem() {
    if (!check?.eligible) return;
    setBusy(true);
    setError(null);
    try {
      const res = await redeemCoupon(check.code, transactionId);
      if (!res.success || !res.data) {
        setError(res.message || "Coupon could not be applied");
        return;
      }
      setApplied(res.data);
      onApplied?.(res.data);
    } catch (e) {
      setError(errorMessage(e, "Coupon could not be applied"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Apply coupon — invoice #${transactionId}`} className="max-w-lg">
      {error && <div className="mb-3"><Alert variant="error" title="Coupon" message={error} /></div>}
      {applied ? (
        <div className="space-y-2 rounded-lg border border-success-500 bg-success-50 p-4 text-sm dark:border-success-500/30 dark:bg-success-500/15">
          <div className="font-semibold">Coupon {applied.code} applied</div>
          <div>Discount: <strong>{applied.discountAmount.toFixed(2)}</strong></div>
          <div>Invoice total: {applied.invoiceTotalBefore.toFixed(2)} → <strong>{applied.invoiceTotalAfter.toFixed(2)}</strong></div>
          <div className="pt-2 text-right">
            <button className="rounded bg-brand-500 px-4 py-2 text-white" onClick={onClose}>Done</button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <Label htmlFor="cpd-code">Coupon code</Label>
            <Input
              id="cpd-code"
              value={code}
              onChange={(e) => { setCode(e.target.value.toUpperCase()); setCheck(null); setError(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") void doValidate(); }}
              disabled={busy}
            />
          </div>
          {check && (
            <div className={`rounded-lg border p-3 text-sm ${check.eligible ? "border-success-500" : "border-warning-500"}`}>
              <div className="font-medium">{check.name ?? check.code} — {check.type === "Fixed" ? `${check.value.toFixed(2)} off` : `${check.value}%`}</div>
              {check.eligible ? (
                <div>Discount <strong>{check.discountAmount.toFixed(2)}</strong> → new total {(check.orderAmount - check.discountAmount).toFixed(2)}</div>
              ) : (
                <div className="text-warning-700 dark:text-warning-400">{check.reason || "Not eligible"}</div>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button className="rounded border px-4 py-2 text-sm dark:border-gray-700" onClick={onClose} disabled={busy}>Cancel</button>
            <button className="rounded border px-4 py-2 text-sm dark:border-gray-700" onClick={doValidate} disabled={busy}>{busy && !check ? "Checking…" : "Check"}</button>
            <button className="rounded bg-brand-500 px-4 py-2 text-sm text-white disabled:opacity-50" onClick={doRedeem} disabled={busy || !check?.eligible}>{busy && check ? "Applying…" : "Apply"}</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
