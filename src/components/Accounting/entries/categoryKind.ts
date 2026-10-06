// What an entry category really is, read from the account it posts to — the
// same rule the accounting dashboard uses. A category mapped to an Equity
// account is an owner drawing (never an expense), to a Revenue account is
// manual income, and so on. Unmapped categories post to 5900 Misc Expense.

import type { AccountDto } from "../../../services/expenseService";

export type CategoryKind = "expense" | "asset" | "drawing" | "income" | "liability" | "unmapped";

export const KIND_META: Record<CategoryKind, { label: string; tone: "blue" | "purple" | "violet" | "emerald" | "amber" | "gray"; hint: string }> = {
  expense: { label: "Expense", tone: "blue", hint: "Posts to an Expense account — counted in expenses and Net Income." },
  asset: { label: "Asset", tone: "purple", hint: "Posts to an Asset account — a purchase you keep (equipment, furniture), not a running cost." },
  drawing: { label: "Owner drawing", tone: "violet", hint: "Posts to an Equity account — cash an owner took out. Not an expense." },
  income: { label: "Income", tone: "emerald", hint: "Posts to a Revenue account — manual income, not an expense." },
  liability: { label: "Liability", tone: "amber", hint: "Posts to a Liability account." },
  unmapped: { label: "Not mapped", tone: "amber", hint: "No account chosen — falls back to 5900 Miscellaneous Expense. Map it to the real account." },
};

export function kindOfAccountType(typeName: string | null | undefined): CategoryKind {
  switch ((typeName ?? "").toLowerCase()) {
    case "expense": return "expense";
    case "asset": return "asset";
    case "equity": return "drawing";
    case "revenue": return "income";
    case "liability": return "liability";
    default: return "unmapped";
  }
}

/** accountId → kind, from the postable-accounts list. */
export function makeKindLookup(accounts: AccountDto[]) {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  return (accountId: number | null | undefined): CategoryKind => {
    if (accountId == null) return "unmapped";
    const a = byId.get(accountId);
    // Mapped to an account that isn't postable any more (inactive/header):
    // still mapped, type unknown — treat as a plain expense.
    return a ? kindOfAccountType(a.accountTypeName) : "expense";
  };
}

/** Calendar-day string → local Date, ignoring the browser timezone. */
export const parseDay = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso);
};

export const money = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const moneyCompact = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (a >= 10_000) return `$${(n / 1_000).toFixed(1)}K`;
  return money(n);
};
