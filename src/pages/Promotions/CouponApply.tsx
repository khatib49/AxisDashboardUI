import { useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import Alert from "../../components/ui/alert/Alert";
import HappyHourBanner from "../../components/promotions/HappyHourBanner";
import {
  CouponRedeemResultDto,
  CouponValidationResultDto,
  errorMessage,
  redeemCoupon,
  validateCoupon,
} from "../../services/promotionsService";

/** Till page: enter a code + open invoice number, check it, then apply it. */
export default function CouponApply() {
  const [code, setCode] = useState("");
  const [txId, setTxId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [check, setCheck] = useState<CouponValidationResultDto | null>(null);
  const [applied, setApplied] = useState<CouponRedeemResultDto | null>(null);

  function reset() {
    setCheck(null);
    setApplied(null);
    setError(null);
  }

  async function doValidate() {
    const tx = Number(txId);
    if (!code.trim() || !tx || tx <= 0) {
      setError("Enter the coupon code and the open invoice number.");
      return;
    }
    setBusy(true);
    setError(null);
    setApplied(null);
    try {
      const res = await validateCoupon({ code: code.trim(), transactionId: tx });
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
      const res = await redeemCoupon(check.code, Number(txId));
      if (!res.success || !res.data) {
        setError(res.message || "Coupon could not be applied");
        return;
      }
      setApplied(res.data);
    } catch (e) {
      setError(errorMessage(e, "Coupon could not be applied"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageMeta title="Apply Coupon | Axis" description="Apply a coupon code to an open invoice" />
      <PageBreadcrumb pageTitle="Apply Coupon" />
      <HappyHourBanner className="mb-4" />

      <div className="mx-auto max-w-xl rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] text-gray-800 dark:text-white/90">
        {error && <div className="mb-4"><Alert variant="error" title="Coupon" message={error} /></div>}

        {applied ? (
          <div className="space-y-2 rounded-lg border border-success-500 bg-success-50 p-4 text-sm dark:border-success-500/30 dark:bg-success-500/15">
            <div className="font-semibold">Coupon {applied.code} applied</div>
            <div>Discount: <strong>{applied.discountAmount.toFixed(2)}</strong></div>
            <div>Invoice #{applied.transactionId}: {applied.invoiceTotalBefore.toFixed(2)} → <strong>{applied.invoiceTotalAfter.toFixed(2)}</strong></div>
            <div className="pt-2 text-right">
              <button className="rounded bg-brand-500 px-4 py-2 text-white" onClick={() => { setCode(""); setTxId(""); reset(); }}>Apply another</button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="cp-code">Coupon code</Label>
                <Input id="cp-code" value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); reset(); }} onKeyDown={(e) => { if (e.key === "Enter") void doValidate(); }} disabled={busy} />
              </div>
              <div>
                <Label htmlFor="cp-tx">Open invoice #</Label>
                <Input id="cp-tx" type="number" value={txId} onChange={(e) => { setTxId(e.target.value); reset(); }} onKeyDown={(e) => { if (e.key === "Enter") void doValidate(); }} disabled={busy} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button className="rounded border px-4 py-2 text-sm dark:border-gray-700 text-gray-700 dark:text-gray-300" onClick={doValidate} disabled={busy}>{busy && !check ? "Checking…" : "Check"}</button>
              <button className="rounded bg-brand-500 px-4 py-2 text-sm text-white disabled:opacity-50" onClick={doRedeem} disabled={busy || !check?.eligible}>{busy && check ? "Applying…" : "Apply"}</button>
            </div>

            {check && (
              <div className={`rounded-lg border p-3 text-sm ${check.eligible ? "border-success-500" : "border-warning-500"}`}>
                <div className="font-medium">{check.name ?? check.code} — {check.type === "Fixed" ? `${check.value.toFixed(2)} off` : `${check.value}%`}</div>
                {check.eligible ? (
                  <>
                    <div>Invoice total: {check.orderAmount.toFixed(2)}{check.eligibleAmount !== check.orderAmount ? ` (eligible ${check.eligibleAmount.toFixed(2)})` : ""}</div>
                    <div>Discount: <strong>{check.discountAmount.toFixed(2)}</strong> → new total {(check.orderAmount - check.discountAmount).toFixed(2)}</div>
                  </>
                ) : (
                  <div className="text-warning-700 dark:text-warning-400">{check.reason || "Not eligible"}</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
