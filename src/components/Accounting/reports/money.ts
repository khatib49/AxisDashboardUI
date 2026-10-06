// Money formatting shared by the accounting report pages (General Ledger,
// Trial Balance, Hierarchy Audit). Always 2 decimals; negatives get a real
// minus sign in front of the currency symbol ("−$1,234.50").

/** True when the amount is below zero once rounded to cents. */
export const isNegative = (n: number) => n <= -0.005;

/** Signed money: "$1,234.50" / "−$1,234.50". */
export const money = (n: number) =>
  `${isNegative(n) ? "−" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
