import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { getWhishStatus, isWhishNotConfigured, openCollectUrl, type WhishStartResultDto, type WhishStatusDto } from "../../services/whishPayService";
import { fmtMoney, getOrderInvoice, startOrderWhish, type ShopOrderInvoiceDto } from "../../services/shopService";

const POLL_MS = 3000;
const errMsg = (e: unknown) => (e as { message?: string })?.message || "Something went wrong";

type Props = { code: string; onPaid?: (s: WhishStatusDto) => void };

/**
 * "Pay with Whish" for a customer's accepted order. Renders nothing until
 * GET shop2/orders/{code}/invoice confirms the shop has created an OPEN
 * invoice for the order (never created here). Flow mirrors the self-order
 * panel: start → hosted checkout in a new tab + QR → poll status → receipt.
 */
export default function ShopWhishPanel({ code, onPaid }: Props) {
  const [invoice, setInvoice] = useState<ShopOrderInvoiceDto | null>(null);
  const [req, setReq] = useState<WhishStartResultDto | null>(null);
  const [status, setStatus] = useState<WhishStatusDto | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const paidNotified = useRef(false);

  useEffect(() => {
    let on = true;
    getOrderInvoice(code).then((inv) => { if (on) setInvoice(inv); }).catch(() => { /* panel stays hidden */ });
    return () => { on = false; };
  }, [code]);

  // Resume polling when Whish bounced us back with ?whish=…&requestId=…
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const rid = Number(p.get("requestId"));
      if (p.get("whish") && rid > 0) {
        setReq({ requestId: rid, collectUrl: "", qrPayload: "", amount: 0, currency: "USD", status: "Pending" });
        const url = new URL(window.location.href);
        url.searchParams.delete("whish"); url.searchParams.delete("requestId");
        window.history.replaceState({}, "", url.toString());
      }
    } catch { /* ignore */ }
  }, []);

  const paid = status?.status === "Paid";
  const active = !!req && !paid && status?.status !== "Failed" && status?.status !== "Expired";

  const poll = useCallback(async (requestId: number) => {
    try {
      const s = await getWhishStatus(requestId);
      setStatus(s);
      if (s.status === "Paid" && !paidNotified.current) { paidNotified.current = true; onPaid?.(s); }
    } catch { /* keep polling */ }
  }, [onPaid]);

  useEffect(() => {
    if (!req || !active) return;
    void poll(req.requestId);
    const t = setInterval(() => poll(req.requestId), POLL_MS);
    return () => clearInterval(t);
  }, [req, active, poll]);

  if (!invoice || (!invoice.isOpen && !req)) return null;

  const start = async () => {
    if (starting) return;
    setStarting(true); setError(null);
    try {
      const r = await startOrderWhish(code, window.location.href.split("?")[0]);
      setReq(r); setStatus(null); paidNotified.current = false;
      openCollectUrl(r.collectUrl);
    } catch (e) {
      if (isWhishNotConfigured(e)) setNotConfigured(true); else setError(errMsg(e));
    } finally { setStarting(false); }
  };

  const box = "rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900";

  if (notConfigured) return <div className={`${box} text-sm text-gray-500 dark:text-gray-400`}>Whish payment is not available right now — you can pay at pickup.</div>;

  if (paid && status) {
    return (
      <div className={`${box} border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 text-center`} role="status">
        <div className="mx-auto h-12 w-12 rounded-full bg-emerald-600 text-white flex items-center justify-center text-2xl font-black">✓</div>
        <div className="mt-3 text-lg font-bold">Paid with Whish — thank you!</div>
        <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">Invoice #{status.transactionId} · {fmtMoney(status.amount)} {status.currency}</div>
      </div>
    );
  }

  if (req && active) {
    return (
      <div className={`${box} text-center`}>
        <div className="font-semibold">Scan with the Whish app</div>
        <div className="text-sm text-gray-500 dark:text-gray-400">{fmtMoney(req.amount || invoice.invoiceTotal)} {req.currency}</div>
        {req.qrPayload && <div className="mt-3 inline-block rounded-xl bg-white p-3"><QRCodeSVG value={req.qrPayload} size={180} level="M" /></div>}
        <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">Waiting for Whish to confirm{status ? ` · ${status.status}` : ""}… this updates automatically.</div>
        {req.collectUrl && <button type="button" onClick={() => openCollectUrl(req.collectUrl)} className="mt-3 text-sm text-brand-600 dark:text-brand-400 underline">Open the payment page again</button>}
      </div>
    );
  }

  return (
    <div className={box} data-testid="whish-panel">
      <div className="font-semibold">Pay now with Whish</div>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Your order is confirmed. Pay {fmtMoney(invoice.invoiceTotal)} online now, or pay when you pick it up.</p>
      {status && (status.status === "Failed" || status.status === "Expired") && <p className="mt-2 text-sm text-red-600">The previous Whish payment {status.status === "Failed" ? "failed" : "expired"}. You can try again.</p>}
      {error && <p className="mt-2 text-sm text-red-600" role="alert">{error}</p>}
      <button type="button" onClick={start} disabled={starting} className="mt-3 w-full h-11 rounded-xl bg-emerald-600 text-white font-semibold disabled:opacity-50">
        {starting ? "Starting…" : `Pay ${fmtMoney(invoice.invoiceTotal)} with Whish`}
      </button>
    </div>
  );
}
