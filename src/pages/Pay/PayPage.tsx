// Public pay page — /pay/:code  and  /pay/:code/result
// ==================================================
// The one link AXIS hands out for anything paid online (event ticket,
// wallet top-up, an open invoice, a custom amount). Anonymous. Shows what
// the payment is for, then sends the customer to the gateway's hosted
// page; the gateway comes back here with ?outcome=success|cancel and we
// poll our own server for the real status. On the result page the poll is
// a "check": if no callback has landed, the server asks the gateway's
// status API itself — the browser's outcome param is never trusted.

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, Link, useNavigate } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import { SiteLogo } from "../Site/SiteUi";
import { checkPublicPayment, getPublicPayment, startPublicPayment } from "../../services/onlinePaymentService";
import type { PublicPayment } from "../../services/onlinePaymentService";

const isRelative = (u: string) => u.startsWith("/") && !u.startsWith("//");

/** Primary / secondary "next step" link; router Link for in-app paths, <a> otherwise. */
function NextLink({ to, className, children }: { to: string; className: string; children: React.ReactNode }) {
  return isRelative(to)
    ? <Link to={to} className={className}>{children}</Link>
    : <a href={to} className={className}>{children}</a>;
}

// 3 s apart → ~2 minutes of checking before "Not confirmed yet".
const MAX_POLLS = 40;

const money = (n: number, c: string) => `${c === "USD" ? "$" : c + " "}${n.toFixed(2)}`;

const PURPOSE_LABEL: Record<string, string> = {
  EventTicket: "Event ticket",
  WalletTopUp: "Wallet top-up",
  Invoice: "Invoice",
  Custom: "Payment",
};

export default function PayPage({ result = false }: { result?: boolean }) {
  const { code = "" } = useParams();
  const [params] = useSearchParams();
  const outcome = params.get("outcome");

  const [payment, setPayment] = useState<PublicPayment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [polls, setPolls] = useState(0);
  const pollTimer = useRef<number | null>(null);
  const navigate = useNavigate();
  const [redirectIn, setRedirectIn] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const p = result ? await checkPublicPayment(code) : await getPublicPayment(code);
      setPayment(p);
      setError(null);
      return p;
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? "This payment link does not exist.");
      return null;
    }
  }, [code, result]);

  useEffect(() => { load(); }, [load]);

  // After the gateway sends the customer back, the callback may land a
  // second or two later — poll for up to ~1 minute until the status is final.
  // Each poll is a server-side check, so a missing callback no longer strands
  // the customer here (the server throttles gateway calls to one per 8 s).
  useEffect(() => {
    if (!result) return;
    const final = (s?: string) => s === "Paid" || s === "Failed" || s === "Cancelled" || s === "Expired" || s === "Refunded";
    if (final(payment?.status) || polls >= MAX_POLLS) return;
    pollTimer.current = window.setTimeout(async () => {
      await load();
      setPolls((n) => n + 1);
    }, 3000);
    return () => { if (pollTimer.current) window.clearTimeout(pollTimer.current); };
  }, [result, payment?.status, polls, load]);

  const pay = async () => {
    setStarting(true);
    setStartError(null);
    try {
      const r = await startPublicPayment(code);
      if (r.success && r.redirectUrl) {
        window.location.href = r.redirectUrl;
        return;
      }
      setStartError(r.error ?? "Could not start the payment.");
      await load();
    } catch {
      setStartError("Could not reach the payment service. Please try again.");
    } finally {
      setStarting(false);
    }
  };

  const status = payment?.status;
  const waiting = result && !!payment && (status === "Redirected" || status === "Pending" || status === "Created") && polls < MAX_POLLS;
  const nextUrl = payment?.nextUrl || null;
  const nextLabel = payment?.nextLabel || (payment?.purpose === "EventTicket" ? "View your ticket" : "Continue");

  // Event tickets: once paid, hand the customer straight to their ticket
  // (3-second countdown so the "Payment received" screen still registers).
  const autoRedirect = status === "Paid" && payment?.purpose === "EventTicket" && !!nextUrl && isRelative(nextUrl);
  useEffect(() => {
    if (!autoRedirect || !nextUrl) { setRedirectIn(null); return; }
    setRedirectIn(3);
    const tick = window.setInterval(() => {
      setRedirectIn((n) => {
        if (n === null) return null;
        if (n <= 1) { window.clearInterval(tick); navigate(nextUrl, { replace: true }); return 0; }
        return n - 1;
      });
    }, 1000);
    return () => window.clearInterval(tick);
  }, [autoRedirect, nextUrl, navigate]);

  return (
    <div
      style={{ fontFamily: "'Cygre', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial" }}
      className="min-h-screen bg-gradient-to-br from-[#050507] via-[#0e1a2a] to-[#050507] text-white flex flex-col"
    >
      <PageMeta title="Pay — AXIS" description="Secure online payment for AXIS Game Lounge" />

      <header className="px-5 py-4 flex items-center justify-between border-b border-white/10">
        <SiteLogo to="/" imageClassName="h-9" />
        <span className="text-[11px] uppercase tracking-[0.25em] text-[#b9d3ee]">Secure payment</span>
      </header>

      <main className="flex-1 flex items-start sm:items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          {error && (
            <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-6 text-center">
              <div className="text-4xl mb-2">🔗</div>
              <div className="font-bold text-lg">Link not found</div>
              <p className="text-sm text-gray-300 mt-1">{error}</p>
              <Link to="/" className="inline-block mt-5 text-sm text-[#b9d3ee] underline">Back to AXIS</Link>
            </div>
          )}

          {!error && !payment && (
            <div className="text-center py-16 text-gray-400">Loading…</div>
          )}

          {payment && (
            <div className="rounded-3xl border border-white/15 bg-white/5 backdrop-blur-md overflow-hidden shadow-2xl">
              {/* Amount hero */}
              <div className="px-6 pt-7 pb-5 text-center border-b border-white/10">
                <div className="text-[11px] uppercase tracking-[0.25em] text-[#b9d3ee]">
                  {PURPOSE_LABEL[payment.purpose] ?? "Payment"}
                </div>
                <div className="mt-2 text-5xl font-bold tracking-tight">{money(payment.amount, payment.currency)}</div>
                <div className="mt-2 text-sm text-gray-300">{payment.description}</div>
                {payment.customerName && <div className="mt-1 text-xs text-gray-400">for {payment.customerName}</div>}
                {payment.referenceLabel && <div className="mt-1 text-[11px] text-gray-500">{payment.referenceLabel}</div>}
              </div>

              <div className="px-6 py-6">
                {/* ── Result states ── */}
                {status === "Paid" && (
                  <div className="text-center">
                    <div className="mx-auto h-16 w-16 rounded-full bg-green-500/15 border border-green-400/40 flex items-center justify-center text-3xl">✓</div>
                    <div className="mt-3 text-xl font-bold text-green-300">Payment received</div>
                    <p className="text-sm text-gray-300 mt-1">
                      Thank you! {payment.purpose === "EventTicket" ? "Your spot is confirmed." : payment.purpose === "WalletTopUp" ? "Your wallet has been credited." : "We've recorded your payment."}
                    </p>
                    {payment.paidOn && <p className="text-[11px] text-gray-500 mt-2">{new Date(payment.paidOn).toLocaleString()}</p>}
                    {nextUrl && (
                      <NextLink to={nextUrl}
                        className="mt-5 w-full h-14 rounded-2xl font-bold text-lg text-[#071018] bg-gradient-to-r from-[#6a99cb] to-[#87b2dd] active:scale-[0.98] transition flex items-center justify-center">
                        {nextLabel} →
                      </NextLink>
                    )}
                    {redirectIn !== null && redirectIn > 0 && (
                      <p className="text-[11px] text-gray-400 mt-2">Taking you there in {redirectIn}…</p>
                    )}
                    <p className="text-[11px] text-gray-500 mt-4">Reference: {payment.code}</p>
                  </div>
                )}

                {waiting && (
                  <div className="text-center">
                    <div className="mx-auto h-12 w-12 rounded-full border-4 border-[#87b2dd]/30 border-t-[#87b2dd] animate-spin" />
                    <div className="mt-4 font-semibold">
                      {outcome === "cancel" ? "Checking your payment…" : "Confirming with the bank…"}
                    </div>
                    <p className="text-sm text-gray-400 mt-1">This usually takes a few seconds. Please don't close this page.</p>
                    {nextUrl && payment.purpose === "EventTicket" && (
                      <NextLink to={nextUrl} className="inline-block mt-4 text-xs text-[#b9d3ee] underline">Your ticket (pending)</NextLink>
                    )}
                  </div>
                )}

                {result && !waiting && status !== "Paid" && (
                  <div className="text-center">
                    <div className="mx-auto h-16 w-16 rounded-full bg-amber-500/15 border border-amber-400/40 flex items-center justify-center text-3xl">
                      {status === "Failed" ? "✕" : "⏳"}
                    </div>
                    <div className="mt-3 text-xl font-bold">
                      {status === "Failed" ? "Payment not completed" : status === "Expired" ? "Link expired" : status === "Cancelled" ? "Payment cancelled" : "Not confirmed yet"}
                    </div>
                    <p className="text-sm text-gray-300 mt-1">
                      {status === "Failed" ? "Your bank declined or the payment was cancelled. No money was taken." :
                       status === "Expired" ? "Ask AXIS for a new link." :
                       status === "Cancelled" ? "This link was cancelled by AXIS." :
                       "We haven't received the bank's confirmation yet. If you completed the payment, it will show up shortly — you can refresh this page."}
                    </p>
                    {payment.canPay && (
                      <button onClick={pay} disabled={starting}
                        className="mt-5 w-full h-12 rounded-2xl font-bold text-[#071018] bg-gradient-to-r from-[#6a99cb] to-[#87b2dd] disabled:opacity-60">
                        {starting ? "Opening secure payment…" : "Try again"}
                      </button>
                    )}
                    <button onClick={() => load()} className="mt-3 text-xs text-[#b9d3ee] underline">Refresh status</button>
                    {nextUrl && payment.purpose === "EventTicket" && status !== "Failed" && status !== "Cancelled" && status !== "Expired" && (
                      <div className="mt-3">
                        <NextLink to={nextUrl} className="inline-block h-10 px-4 rounded-xl border border-white/15 text-sm text-gray-200 hover:bg-white/5 leading-10">
                          Your ticket (pending)
                        </NextLink>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Pay state ── */}
                {!result && status !== "Paid" && (
                  <>
                    {payment.canPay ? (
                      <>
                        <button onClick={pay} disabled={starting}
                          className="w-full h-14 rounded-2xl font-bold text-lg text-[#071018] bg-gradient-to-r from-[#6a99cb] to-[#87b2dd] active:scale-[0.98] transition disabled:opacity-60">
                          {starting ? "Opening secure payment…" : `Pay ${money(payment.amount, payment.currency)}`}
                        </button>
                        <p className="mt-3 text-center text-[11px] text-gray-400">
                          You'll be taken to {payment.provider}'s secure page. Visa · Mastercard accepted. AXIS never sees your card details.
                        </p>
                        {startError && <div className="mt-3 rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-200">{startError}</div>}
                      </>
                    ) : (
                      <div className="text-center text-sm text-gray-300">
                        {payment.isExpired ? "This link has expired — ask AXIS for a new one." : `This link is ${status?.toLowerCase()} and can't be paid.`}
                      </div>
                    )}
                  </>
                )}

                {!result && status === "Paid" && null}
              </div>

              <div className="px-6 py-3 border-t border-white/10 flex items-center justify-between text-[11px] text-gray-500">
                <span>🔒 Secured by {payment.provider}</span>
                <span>AXIS Game Lounge · Beirut</span>
              </div>
              <div className="px-6 pb-3 text-center text-[11px] text-gray-500">
                <a href="/terms" target="_blank" rel="noreferrer" className="hover:text-white underline">Terms</a> ·{" "}
                <a href="/privacy" target="_blank" rel="noreferrer" className="hover:text-white underline">Privacy</a> ·{" "}
                <a href="/refund-policy" target="_blank" rel="noreferrer" className="hover:text-white underline">Refunds</a> ·{" "}
                <a href="/shipping-policy" target="_blank" rel="noreferrer" className="hover:text-white underline">Shipping</a>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
