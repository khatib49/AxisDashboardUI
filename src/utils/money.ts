/**
 * Money formatting helpers for dual USD/LBP display.
 * `rate` is the number of LBP per 1 USD (e.g. 89500).
 */

export function roundToStep(amount: number, step: number, decimals = 0): number {
  if (!step || step <= 0) return Number(amount.toFixed(decimals));
  const rounded = Math.round(amount / step) * step;
  return Number(rounded.toFixed(decimals));
}

export function formatUsd(amount: number): string {
  return `$${(Number.isFinite(amount) ? amount : 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatLbp(amount: number): string {
  return `${Math.round(Number.isFinite(amount) ? amount : 0).toLocaleString("en-US")} LL`;
}

/** USD amount → "$12.34 / 1,104,000 LL" (LBP rounded to the nearest `step`, default 1000). */
export function formatDual(amountUsd: number, rate: number, step = 1000): string {
  const usd = formatUsd(amountUsd);
  if (!rate || rate <= 0) return usd;
  const lbp = roundToStep(amountUsd * rate, step, 0);
  return `${usd} / ${formatLbp(lbp)}`;
}

/** Generic formatter driven by a currency's decimal places + symbol. */
export function formatAmount(amount: number, code: string, decimals = 2, symbol?: string): string {
  const v = (Number.isFinite(amount) ? amount : 0).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  if (symbol === "$") return `$${v}`;
  return `${v} ${symbol || code}`;
}

export default { formatDual, formatUsd, formatLbp, formatAmount, roundToStep };
