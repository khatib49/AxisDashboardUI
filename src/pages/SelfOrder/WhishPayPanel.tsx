import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  getWhishStatus, isWhishNotConfigured, openCollectUrl, startWhishPaymentPublic, WhishStartResultDto, WhishStatusDto,
} from "../../services/whishPayService";

const POLL_MS = 3000;
const money = (n: number) => n.toFixed(2);
const errMsg = (e: unknown) => (e as { message?: string })?.message || "Something went wrong";

type Props = {
  /** Self-order session token (GUID) or kiosk device token — must own the invoice. */
  token: string;
  transactionId: number;
  /** Amount the guest expects to pay (display only; the server computes the real remaining amount). */
  amount: number;
  /** UI url Whish bounces back to after the hosted checkout. */
  returnUrl?: string;
  /** Called once the server confirms the payment. */
  onPaid?: (s: WhishStatusDto) => void;
  /** Fires true while a payment is in progress (lets the kiosk pause its auto-reset). */
  onActiveChange?: (active: boolean) => void;
  /** Larger type for the kiosk screen. */
  size?: "phone" | "kiosk";
};

/**
 * "Pay now with Whish" for guests. Pay-at-counter stays the default: nothing
 * happens until the guest taps the button. Then: start-public → open the
 * hosted checkout in a new tab + show the same URL as a QR → poll the status
 * every 3 s → receipt state once Paid.
 */
export default function WhishPayPanel({ token, transactionId, amount, returnUrl, onPaid, onActiveChange, size = "phone" }: Props) {
  const [req, setReq] = useState<WhishStartResultDto | null>(null);
  const [status, setStatus] = useState<WhishStatusDto | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const paidNotified = useRef(false);
  const kiosk = size === "kiosk";

  const paid = status?.status === "Paid";
  const active = !!req && !paid && status?.status !== "Failed" && status?.status !== "Expired";

  useEffect(() => { onActiveChange?.(active); }, [active, onActiveChange]);

  // When the hosted checkout bounced us back with ?whish=…&requestId=…, resume polling that request.
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const rid = Number(p.get("requestId"));
      if (p.get("whish") && rid > 0 && !req) {
        setReq({ requestId: rid, collectUrl: "", qrPayload: "", amount, currency: "USD", status: "Pending" });
        const url = new URL(window.location.href);
        url.searchParams.delete("whish"); url.searchParams.delete("requestId");
        window.history.replaceState({}, "", url.toString());
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const poll = useCallback(async (requestId: number) => {
    try {
      const s = await getWhishStatus(requestId);
      setStatus(s);
      if (s.status === "Paid" && !paidNotified.current) { paidNotified.current = true; onPaid?.(s); }
    } catch { /* keep polling; the API may be briefly unavailable */ }
  }, [onPaid]);

  useEffect(() => {
    if (!req || paid || status?.status === "Failed" || status?.status === "Expired") return;
    void poll(req.requestId);
    const t = setInterval(() => poll(req.requestId), POLL_MS);
    return () => clearInterval(t);
  }, [req, paid, status?.status, poll]);

  const start = async () => {
    if (starting) return;
    setStarting(true); setError(null);
    try {
      const r = await startWhishPaymentPublic(token, transactionId, returnUrl ?? window.location.href.split("?")[0]);
      setReq(r);
      setStatus(null);
      paidNotified.current = false;
      openCollectUrl(r.collectUrl);
    } catch (e) {
      if (isWhishNotConfigured(e)) setNotConfigured(true); else setError(errMsg(e));
    } finally { setStarting(false); }
  };

  const box = `rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 ${kiosk ? "p-6" : "p-4"}`;
  const btn = `w-full rounded-xl bg-emerald-600 text-white font-semibold disabled:opacity-50 ${kiosk ? "py-5 text-2xl" : "py-3"}`;

  if (notConfigured) {
    return <div className={`${box} ${kiosk ? "text-xl" : "text-sm"} text-gray-500`}>Online payment (Whish) is not configured. Please pay at the counter.</div>;
  }

  if (paid && status) {
    return (
      <div className={`${box} border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 text-center`}>
        <div className={`mx-auto rounded-full bg-emerald-600 text-white flex items-center justify-center font-black ${kiosk ? "w-20 h-20 text-4xl" : "w-12 h-12 text-2xl"}`}>✓</div>
        <div className={`font-bold mt-3 ${kiosk ? "text-3xl" : "text-lg"}`}>Paid with Whish – thank you!</div>
        <div className={`text-gray-600 dark:text-gray-300 mt-1 ${kiosk ? "text-xl" : "text-sm"}`}>
          Receipt · invoice #{status.transactionId} · {money(status.amount)} {status.currency}
          {status.paidOn ? ` · ${new Date(status.paidOn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
        </div>
        {!status.invoiceClosed && <div className={`text-amber-600 mt-2 ${kiosk ? "text-lg" : "text-xs"}`}>A balance remains on this invoice; please see the counter.</div>}
      </div>
    );
  }

  if (req && active) {
    return (
      <div className={`${box} text-center`}>
        <div className={`font-semibold ${kiosk ? "text-2xl" : "text-base"}`}>Scan with the Whish app</div>
        <div className={`text-gray-500 ${kiosk ? "text-xl" : "text-sm"}`}>{money(req.amount || amount)} {req.currency}</div>
        {req.qrPayload ? (
          <div className="mt-3 inline-block rounded-xl bg-white p-3">
            <QRCodeSVG value={req.qrPayload} size={kiosk ? 260 : 180} level="M" />
          </div>
        ) : null}
        <div className={`mt-3 text-gray-500 ${kiosk ? "text-lg" : "text-xs"}`}>
          Waiting for Whish to confirm{status ? ` · ${status.status}` : ""}… this updates automatically.
        </div>
        {req.collectUrl && (
          <button type="button" onClick={() => openCollectUrl(req.collectUrl)} className={`mt-3 text-blue-600 underline ${kiosk ? "text-lg" : "text-sm"}`}>Open the payment page again</button>
        )}
      </div>
    );
  }

  return (
    <div className={box}>
      {status && (status.status === "Failed" || status.status === "Expired") && (
        <p className={`text-red-600 mb-2 ${kiosk ? "text-lg" : "text-sm"}`}>The previous Whish payment {status.status === "Failed" ? "failed" : "expired"}. You can try again or pay at the counter.</p>
      )}
      {error && <p className={`text-red-600 mb-2 ${kiosk ? "text-lg" : "text-sm"}`}>{error}</p>}
      <button type="button" onClick={start} disabled={starting} className={btn}>
        {starting ? "Starting…" : `Pay now with Whish · ${money(amount)}`}
      </button>
      <p className={`text-gray-500 mt-2 text-center ${kiosk ? "text-base" : "text-xs"}`}>Or pay at the counter (default).</p>
    </div>
  );
}
