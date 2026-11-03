import { useCallback, useEffect, useMemo, useState } from "react";
import Modal from "../../components/ui/Modal";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import Loader from "../../components/ui/Loader";
import Alert from "../../components/ui/alert/Alert";
import { getRates, type CurrencyDto } from "../../services/currencyService";
import {
  addTenders,
  getTenderSummary,
  deleteTender,
  errorMessage,
  TENDER_METHODS,
  type TenderMethod,
  type TenderSummaryDto,
} from "../../services/tillService";
import { formatAmount, formatUsd, roundToStep } from "../../utils/money";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  transactionId: number;
  /** Transaction total in the base currency (USD). Used for the live preview before the server answers. */
  total: number;
  /** Called after tenders are saved, with the fresh summary. */
  onSaved?: (summary: TenderSummaryDto) => void;
};

type Line = { key: number; currencyCode: string; amount: string; method: TenderMethod; reference: string };

/**
 * Reusable multi-currency tender entry. Lets the cashier enter one or more
 * amounts (per currency / method), previews paid vs total and the change in
 * USD and LBP, then posts the tenders and shows the server summary.
 */
export default function TenderDialog({ isOpen, onClose, transactionId, total, onSaved }: Props) {
  const [currencies, setCurrencies] = useState<CurrencyDto[]>([]);
  const [summary, setSummary] = useState<TenderSummaryDto | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const base = currencies.find((c) => c.isBase);
  const baseCode = base?.code ?? "USD";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cur, sum] = await Promise.all([getRates(), getTenderSummary(transactionId)]);
      setCurrencies(cur);
      setSummary(sum.success && sum.data ? sum.data : null);
      if (!sum.success) setError(sum.error || sum.message);
      setLines([{ key: Date.now(), currencyCode: cur.find((c) => c.isBase)?.code ?? "USD", amount: "", method: "Cash", reference: "" }]);
    } catch (err) {
      setError(errorMessage(err, "Failed to load tender info"));
    } finally {
      setLoading(false);
    }
  }, [transactionId]);

  useEffect(() => {
    if (isOpen) void load();
  }, [isOpen, load]);

  const rateOf = useCallback(
    (code: string) => (currencies.find((c) => c.code === code)?.currentRate ?? (code === baseCode ? 1 : 0)) || 0,
    [currencies, baseCode]
  );

  // Live preview: what's already paid on the server + what is typed now.
  const preview = useMemo(() => {
    const alreadyPaid = summary?.paidInBase ?? 0;
    const typed = lines.reduce((acc, l) => {
      const a = parseFloat(l.amount);
      const r = rateOf(l.currencyCode);
      return acc + (Number.isNaN(a) || a <= 0 || r <= 0 ? 0 : a / r);
    }, 0);
    const txTotal = summary?.totalPrice ?? total;
    const paid = Math.round((alreadyPaid + typed) * 100) / 100;
    const remaining = Math.max(0, Math.round((txTotal - paid) * 100) / 100);
    const change = Math.max(0, Math.round((paid - txTotal) * 100) / 100);
    const changeBy = currencies
      .filter((c) => c.isActive)
      .map((c) => ({
        code: c.code,
        symbol: c.symbol,
        decimals: c.decimalPlaces,
        amount: c.isBase ? change : roundToStep(change * (c.currentRate ?? 0), c.roundingStep, c.decimalPlaces),
      }));
    return { txTotal, alreadyPaid, typed, paid, remaining, change, changeBy };
  }, [lines, summary, total, currencies, rateOf]);

  function updateLine(key: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  async function save() {
    const valid = lines.filter((l) => !Number.isNaN(parseFloat(l.amount)) && parseFloat(l.amount) > 0);
    if (valid.length === 0) return setError("Enter at least one amount.");
    setBusy(true);
    setError(null);
    try {
      const r = await addTenders(
        transactionId,
        valid.map((l) => ({ currencyCode: l.currencyCode, amount: parseFloat(l.amount), method: l.method, reference: l.reference || null }))
      );
      if (!r.success || !r.data) return setError(r.error || r.message);
      setSummary(r.data);
      setLines([{ key: Date.now(), currencyCode: baseCode, amount: "", method: "Cash", reference: "" }]);
      onSaved?.(r.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    setBusy(true);
    try {
      const r = await deleteTender(id);
      if (!r.success) return setError(r.error || r.message);
      if (r.data) { setSummary(r.data); onSaved?.(r.data); }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const fmt = (code: string, amount: number) => {
    const c = currencies.find((x) => x.code === code);
    return formatAmount(amount, code, c?.decimalPlaces ?? 2, c?.symbol);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Tender · Transaction #${transactionId}`}
      className="max-w-2xl"
      footer={
        <>
          <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm dark:border-gray-600 dark:text-white">Close</button>
          <button disabled={busy || loading} onClick={save} className="rounded-lg bg-brand-500 px-4 py-2 text-sm text-white hover:bg-brand-600 disabled:opacity-50">{busy ? "Saving…" : "Record payment"}</button>
        </>
      }
    >
      {loading ? (
        <div className="flex justify-center py-10"><Loader /></div>
      ) : (
        <div className="space-y-4">
          {error && <Alert variant="error" title="Error" message={error} />}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tile label="Total" value={formatUsd(preview.txTotal)} />
            <Tile label="Paid (incl. typed)" value={formatUsd(preview.paid)} />
            <Tile label="Remaining" value={formatUsd(preview.remaining)} tone={preview.remaining > 0 ? "text-warning-600" : "text-success-600"} />
            <Tile label="Change" value={formatUsd(preview.change)} tone={preview.change > 0 ? "text-brand-500" : ""} />
          </div>

          {preview.change > 0 && (
            <div className="rounded-lg bg-brand-50 p-3 text-sm dark:bg-brand-500/10 dark:text-gray-100">
              <span className="font-medium">Change due:</span>{" "}
              {preview.changeBy.map((c) => (
                <span key={c.code} className="mr-3 tabular-nums">{formatAmount(c.amount, c.code, c.decimals, c.symbol)}</span>
              ))}
            </div>
          )}

          <div className="space-y-2">
            {lines.map((l) => (
              <div key={l.key} className="grid grid-cols-12 items-end gap-2">
                <div className="col-span-3">
                  <Label>Currency</Label>
                  <select value={l.currencyCode} onChange={(e) => updateLine(l.key, { currencyCode: e.target.value })} className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-2 text-sm dark:border-gray-600 dark:text-white">
                    {currencies.filter((c) => c.isActive).map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                  </select>
                </div>
                <div className="col-span-3">
                  <Label>Amount</Label>
                  <Input type="number" min="0" step={0.01} value={l.amount} onChange={(e) => updateLine(l.key, { amount: e.target.value })} />
                </div>
                <div className="col-span-3">
                  <Label>Method</Label>
                  <select value={l.method} onChange={(e) => updateLine(l.key, { method: e.target.value as TenderMethod })} className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-2 text-sm dark:border-gray-600 dark:text-white">
                    {TENDER_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <Label>Ref.</Label>
                  <Input value={l.reference} onChange={(e) => updateLine(l.key, { reference: e.target.value })} placeholder="slip #" />
                </div>
                <div className="col-span-1 pb-2 text-right">
                  {lines.length > 1 && <button onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} className="text-error-500" title="Remove line">✕</button>}
                </div>
                {l.currencyCode !== baseCode && parseFloat(l.amount) > 0 && rateOf(l.currencyCode) > 0 && (
                  <p className="col-span-12 -mt-1 text-xs text-gray-500">= {formatUsd(parseFloat(l.amount) / rateOf(l.currencyCode))} @ {rateOf(l.currencyCode).toLocaleString()}</p>
                )}
              </div>
            ))}
            <div className="flex gap-2">
              <button onClick={() => setLines((ls) => [...ls, { key: Date.now(), currencyCode: baseCode, amount: "", method: "Cash", reference: "" }])} className="text-sm text-brand-500 hover:underline">+ Add line</button>
              {preview.remaining > 0 && (
                <button onClick={() => setLines((ls) => ls.map((l, i) => (i === ls.length - 1 ? { ...l, amount: l.currencyCode === baseCode ? preview.remaining.toFixed(2) : String(roundToStep(preview.remaining * rateOf(l.currencyCode), currencies.find((c) => c.code === l.currencyCode)?.roundingStep ?? 1, currencies.find((c) => c.code === l.currencyCode)?.decimalPlaces ?? 0)) } : l)))} className="text-sm text-gray-500 hover:underline">Fill remaining</button>
              )}
            </div>
          </div>

          {summary && summary.tenders.length > 0 && (
            <div>
              <h5 className="mb-1 text-xs font-semibold uppercase text-gray-500">Recorded tenders</h5>
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 text-sm dark:divide-gray-700 dark:border-gray-700 dark:text-gray-200">
                {summary.tenders.map((t) => (
                  <li key={t.id} className="flex items-center justify-between px-3 py-2">
                    <span>{t.method} · {fmt(t.currencyCode, t.amountInCurrency)}{t.currencyCode !== baseCode ? ` (= ${formatUsd(t.amountInBase)} @ ${t.rateUsed.toLocaleString()})` : ""}{t.reference ? ` · ${t.reference}` : ""}</span>
                    <button disabled={busy} onClick={() => remove(t.id)} className="text-xs text-error-500 hover:underline">remove</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function Tile({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 p-2 dark:border-gray-700">
      <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`text-base font-semibold tabular-nums dark:text-white ${tone}`}>{value}</p>
    </div>
  );
}
