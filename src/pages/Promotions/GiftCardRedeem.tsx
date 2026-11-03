import { useEffect, useState } from "react";
import Modal from "../../components/ui/Modal";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import Loader from "../../components/ui/Loader";
import Alert from "../../components/ui/alert/Alert";
import {
  errorMessage,
  GiftCardLookupDto,
  GiftCardRedeemResultDto,
  lookupGiftCard,
  redeemGiftCard,
} from "../../services/promotionsService";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  /** Pre-fill the open invoice id (till pages know it). */
  transactionId?: number | null;
  /** Current invoice total, used to suggest the amount. */
  invoiceTotal?: number | null;
  onApplied?: (result: GiftCardRedeemResultDto) => void;
};

/**
 * Till dialog: look a gift card up by code, show the balance, then apply part
 * of it AS PAYMENT on an open invoice.
 */
export default function GiftCardRedeem({ isOpen, onClose, transactionId, invoiceTotal, onApplied }: Props) {
  const [code, setCode] = useState("");
  const [txId, setTxId] = useState<string>(transactionId ? String(transactionId) : "");
  const [amount, setAmount] = useState<string>("");
  const [card, setCard] = useState<GiftCardLookupDto | null>(null);
  const [result, setResult] = useState<GiftCardRedeemResultDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setCode("");
    setTxId(transactionId ? String(transactionId) : "");
    setAmount("");
    setCard(null);
    setResult(null);
    setError(null);
  }, [isOpen, transactionId]);

  async function doLookup() {
    if (!code.trim()) {
      setError("Enter the gift card code.");
      return;
    }
    setBusy(true);
    setError(null);
    setCard(null);
    try {
      const res = await lookupGiftCard(code);
      if (!res.success || !res.data) {
        setError(res.message || "Card not found");
        return;
      }
      setCard(res.data);
      const suggested = Math.min(res.data.balance, invoiceTotal ?? res.data.balance);
      setAmount(suggested > 0 ? suggested.toFixed(2) : "");
    } catch (e) {
      setError(errorMessage(e, "Card not found"));
    } finally {
      setBusy(false);
    }
  }

  async function doRedeem() {
    const tx = Number(txId);
    const amt = Number(amount);
    if (!card) return;
    if (!tx || tx <= 0) {
      setError("Enter the open invoice number.");
      return;
    }
    if (!amt || amt <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await redeemGiftCard(card.code, tx, amt);
      if (!res.success || !res.data) {
        setError(res.message || "Could not apply the gift card");
        return;
      }
      setResult(res.data);
      onApplied?.(res.data);
    } catch (e) {
      setError(errorMessage(e, "Could not apply the gift card"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Apply gift card as payment" className="max-w-lg">
      <div className="space-y-4">
        {error && <Alert variant="error" title="Gift card" message={error} />}

        {result ? (
          <div className="space-y-2 rounded-lg border border-success-500 bg-success-50 p-4 text-sm dark:border-success-500/30 dark:bg-success-500/15">
            <div className="font-semibold">Applied {result.appliedAsPayment.toFixed(2)} as payment</div>
            <div>Invoice #{result.transactionId}: {result.invoiceTotalBefore.toFixed(2)} → <strong>{result.invoiceTotalAfter.toFixed(2)}</strong></div>
            <div>Card {result.code} remaining balance: {result.remainingBalance.toFixed(2)} ({result.status})</div>
            <div className="pt-2 text-right">
              <button className="rounded bg-brand-500 px-4 py-2 text-white" onClick={onClose}>Done</button>
            </div>
          </div>
        ) : (
          <>
            <div>
              <Label htmlFor="gc-code">Gift card code</Label>
              <div className="flex gap-2">
                <Input
                  id="gc-code"
                  value={code}
                  placeholder="16-character code"
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => { if (e.key === "Enter") void doLookup(); }}
                  disabled={busy}
                />
                <button className="rounded border px-4 py-2 text-sm dark:border-gray-700" onClick={doLookup} disabled={busy}>
                  {busy && !card ? <Loader size={16} /> : "Look up"}
                </button>
              </div>
            </div>

            {card && (
              <div className="rounded-lg border p-3 text-sm dark:border-gray-700">
                <div className="flex justify-between"><span>Balance</span><strong>{card.balance.toFixed(2)} {card.currencyCode}</strong></div>
                <div className="flex justify-between"><span>Status</span><span>{card.status}</span></div>
                {card.issuedTo && <div className="flex justify-between"><span>Issued to</span><span>{card.issuedTo}</span></div>}
                {card.expiresOn && <div className="flex justify-between"><span>Expires</span><span>{new Date(card.expiresOn).toLocaleDateString()}</span></div>}
                {!card.canRedeem && <div className="mt-2 text-error-500">{card.reason || "This card cannot be used."}</div>}
              </div>
            )}

            {card?.canRedeem && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="gc-tx">Open invoice #</Label>
                  <Input id="gc-tx" type="number" value={txId} onChange={(e) => setTxId(e.target.value)} disabled={busy || !!transactionId} />
                </div>
                <div>
                  <Label htmlFor="gc-amt">Amount to apply</Label>
                  <Input id="gc-amt" type="number" step={0.01} min="0" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={busy} />
                </div>
                <div className="col-span-2 text-right">
                  <button className="rounded bg-brand-500 px-4 py-2 text-sm text-white disabled:opacity-50" onClick={doRedeem} disabled={busy}>
                    {busy ? "Applying…" : "Apply as payment"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
