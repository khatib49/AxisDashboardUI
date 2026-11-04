import { useEffect, useRef, useState } from "react";
import {
  cancelTerminalPayment, checkTerminalPayment, confirmManualTerminalPayment, listCardTerminals, startTerminalPayment,
  type CardTerminalDto, type TerminalPaymentDto,
} from "../../services/phase4Service";

type Props = { invoiceId: number; remaining: number; onPaid: (invoiceClosed: boolean) => void };

const FINAL = ["Approved", "Declined", "Cancelled", "Expired", "Failed"];
const TERMINAL_KEY = "axis.cardTerminalId";

/** Card payment on a terminal for the till checkout. Remembers the register's terminal. */
export default function CardTerminalPay({ invoiceId, remaining, onPaid }: Props) {
  const [terminals, setTerminals] = useState<CardTerminalDto[] | null>(null);
  const [terminalId, setTerminalId] = useState<number | null>(() => { try { const v = localStorage.getItem(TERMINAL_KEY); return v ? Number(v) : null; } catch { return null; } });
  const [amount, setAmount] = useState("");
  const [payment, setPayment] = useState<TerminalPaymentDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [last4, setLast4] = useState("");
  const onPaidRef = useRef(onPaid);
  onPaidRef.current = onPaid;

  useEffect(() => {
    listCardTerminals().then((t) => {
      setTerminals(t);
      setTerminalId((cur) => (cur && t.some((x) => x.id === cur) ? cur : t[0]?.id ?? null));
    }).catch(() => setTerminals([]));
  }, []);

  useEffect(() => {
    if (!payment || FINAL.includes(payment.status) || payment.provider === "Manual") return;
    const t = setInterval(async () => {
      try {
        const p = await checkTerminalPayment(payment.id);
        setPayment(p);
        if (p.status === "Approved") onPaidRef.current(p.invoiceClosed);
      } catch { /* keep polling */ }
    }, 2000);
    return () => clearInterval(t);
  }, [payment]);

  if (terminals === null) return null;
  if (terminals.length === 0) return <p className="text-xs text-gray-500 dark:text-gray-400">No card terminal is set up. An admin can add one under Till → Card Terminals.</p>;

  const terminal = terminals.find((t) => t.id === terminalId) ?? terminals[0];
  const pending = payment && payment.status === "Pending";

  async function start() {
    setBusy(true); setError(null);
    try {
      const amt = amount.trim() ? Number(amount) : undefined;
      if (amt !== undefined && (!Number.isFinite(amt) || amt <= 0)) throw new Error("Enter a valid amount.");
      try { localStorage.setItem(TERMINAL_KEY, String(terminal.id)); } catch { /* ignore */ }
      const p = await startTerminalPayment(invoiceId, terminal.id, amt);
      setPayment(p); setCode(""); setLast4("");
      if (p.status === "Approved") onPaid(p.invoiceClosed);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  async function confirm() {
    if (!payment) return;
    setBusy(true); setError(null);
    try {
      const p = await confirmManualTerminalPayment(payment.id, code, last4);
      setPayment(p);
      if (p.status === "Approved") onPaid(p.invoiceClosed);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  async function cancel() {
    if (!payment) return;
    setBusy(true); setError(null);
    try { setPayment(await cancelTerminalPayment(payment.id)); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  const input = "rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90";
  return (
    <div className="rounded-xl border border-sky-200 p-3 dark:border-sky-500/30" data-testid="card-terminal-pay">
      <p className="text-sm font-medium text-gray-800 dark:text-white/90">Card terminal</p>
      {!pending && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="text-xs text-gray-600 dark:text-gray-400">Terminal
            <select className={`${input} mt-1 block`} value={terminal.id} onChange={(e) => setTerminalId(Number(e.target.value))}>
              {terminals.map((t) => <option key={t.id} value={t.id}>{t.name}{t.busy ? " (busy)" : ""}</option>)}
            </select>
          </label>
          <label className="text-xs text-gray-600 dark:text-gray-400">Amount (USD)
            <input className={`${input} mt-1 block w-28`} inputMode="decimal" placeholder={Math.max(remaining, 0).toFixed(2)} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <button type="button" onClick={() => void start()} disabled={busy || remaining <= 0} className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50">
            {busy ? "Sending…" : terminal.provider === "Manual" ? "Charge on terminal" : "Send to terminal"}
          </button>
        </div>
      )}
      {pending && payment!.provider === "Manual" && (
        <div className="mt-2 space-y-2">
          <p className="text-sm text-gray-700 dark:text-gray-300">Key <b>${payment!.amount.toFixed(2)}</b> on {payment!.terminalName}, then type the approval code from the slip.</p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-gray-600 dark:text-gray-400">Approval code
              <input className={`${input} mt-1 block w-32`} value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
            </label>
            <label className="text-xs text-gray-600 dark:text-gray-400">Card last 4
              <input className={`${input} mt-1 block w-20`} inputMode="numeric" maxLength={4} value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, ""))} />
            </label>
            <button type="button" onClick={() => void confirm()} disabled={busy || code.trim().length < 2} className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Record payment</button>
            <button type="button" onClick={() => void cancel()} disabled={busy} className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-300">Cancel</button>
          </div>
        </div>
      )}
      {pending && payment!.provider !== "Manual" && (
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-sm text-gray-700 dark:text-gray-300" role="status">Waiting for the card on {payment!.terminalName} · ${payment!.amount.toFixed(2)}</p>
          <button type="button" onClick={() => void cancel()} disabled={busy} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-300">Cancel</button>
        </div>
      )}
      {payment && payment.status === "Approved" && (
        <p className="mt-2 text-sm font-medium text-green-600" role="status">Card approved ${payment.amount.toFixed(2)}{payment.cardLast4 ? ` · •••• ${payment.cardLast4}` : ""}{payment.approvalCode ? ` · code ${payment.approvalCode}` : ""}{payment.invoiceClosed ? " · invoice closed" : ""}</p>
      )}
      {payment && ["Declined", "Cancelled", "Expired", "Failed"].includes(payment.status) && (
        <p className="mt-2 text-sm text-red-600" role="alert">Card payment {payment.status.toLowerCase()}{payment.message ? `: ${payment.message}` : "."}</p>
      )}
      {error && <p className="mt-2 text-xs text-red-600" role="alert">{error}</p>}
    </div>
  );
}
