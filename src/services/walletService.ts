import api from "./api";

// ── Types ─────────────────────────────────────────────────────────────────

export type WalletDto = {
  id: number;
  userId: number;
  userName?: string | null;
  balance: number;
  isActive: boolean;
  createdOn: string;
  modifiedOn?: string | null;
};

export type WalletTransactionDto = {
  id: number;
  type: "TopUp" | "Bonus" | "Spend" | "Refund" | "Adjustment" | string;
  amount: number;
  balanceAfter: number;
  method?: string | null;
  transactionRecordId?: number | null;
  notes?: string | null;
  createdBy: string;
  createdOn: string;
};

export type WalletSummary = {
  wallet: WalletDto;
  recent: WalletTransactionDto[];
};

export type WalletTopUpResult = {
  walletId: number;
  amountPaid: number;
  bonusGiven: number;
  bonusPercent: number;
  newBalance: number;
};

export type WalletBonusTier = {
  id: number;
  minAmount: number;
  bonusPercent: number;
  isActive: boolean;
};

type Envelope<T> = { success: boolean; error?: string; message?: string; data?: T };

// ── Reads ────────────────────────────────────────────────────────────────

export async function getWalletSummary(userId: number, recent = 10): Promise<WalletSummary> {
  const res = await api.get<WalletSummary>(`/wallets/${userId}`, { params: { recent } });
  return res.data;
}

/** Balances for many users in one round-trip (clients table). Returns { [userId]: balance }. */
export async function getWalletBalances(userIds: number[]): Promise<Record<number, number>> {
  if (userIds.length === 0) return {};
  const res = await api.post<Record<number, number>>(`/wallets/balances`, userIds);
  return res.data;
}

export async function getWalletHistory(userId: number, page = 1, pageSize = 50) {
  const res = await api.get<{ totalCount: number; data: WalletTransactionDto[] }>(
    `/wallets/${userId}/transactions`, { params: { page, pageSize } });
  return res.data;
}

// ── Cross-wallet money feed (cash-box view) ──────────────────────────────

export type WalletMovement = {
  id: number;
  createdOn: string;
  type: string;
  amount: number;
  method?: string | null;
  userId: number;
  userName?: string | null;
  createdBy: string;
  notes?: string | null;
  transactionRecordId?: number | null;
  balanceAfter: number;
};

export type WalletMovementsSummary = {
  cashIn: number;
  whishIn: number;
  cardIn: number;
  totalTopUps: number;
  bonusGiven: number;
  spent: number;
  refundedCashOut: number;
  netCashImpact: number;
  topUpCount: number;
};

export type WalletMovementsPage = {
  summary: WalletMovementsSummary;
  totalCount: number;
  rows: WalletMovement[];
  page: number;
  pageSize: number;
};

export async function getWalletMovements(opts: {
  from?: Date; to?: Date; type?: string; method?: string; page?: number; pageSize?: number;
} = {}): Promise<WalletMovementsPage> {
  const res = await api.get<WalletMovementsPage>(`/wallets/movements`, {
    params: {
      from: opts.from?.toISOString(),
      to: opts.to?.toISOString(),
      type: opts.type || undefined,
      method: opts.method || undefined,
      page: opts.page ?? 1,
      pageSize: opts.pageSize ?? 50,
    },
  });
  return res.data;
}

// ── Money movement ───────────────────────────────────────────────────────

export async function topUpWallet(userId: number, amount: number, method: string, notes?: string) {
  const res = await api.post<Envelope<WalletTopUpResult>>(
    `/wallets/${userId}/topup`, { amount, method, notes: notes || null });
  return res.data;
}

/** Admin only. Negative delta removes credit; cashOut=true pays cash out of the drawer. */
export async function adjustWallet(userId: number, delta: number, cashOut: boolean, reason: string) {
  const res = await api.post<Envelope<WalletDto>>(
    `/wallets/${userId}/adjust`, { delta, cashOut, reason });
  return res.data;
}

// ── Bonus tiers ──────────────────────────────────────────────────────────

export async function getBonusTiers(includeInactive = false): Promise<WalletBonusTier[]> {
  const res = await api.get<WalletBonusTier[]>(`/wallets/bonus-tiers`, {
    params: includeInactive ? { includeInactive: true } : {},
  });
  return res.data;
}

export async function createBonusTier(t: { minAmount: number; bonusPercent: number; isActive?: boolean }) {
  const res = await api.post<WalletBonusTier>(`/wallets/bonus-tiers`, t);
  return res.data;
}

export async function updateBonusTier(id: number, t: { minAmount: number; bonusPercent: number; isActive?: boolean }) {
  await api.put(`/wallets/bonus-tiers/${id}`, t);
}

export async function deleteBonusTier(id: number) {
  await api.delete(`/wallets/bonus-tiers/${id}`);
}

/** The bonus the tiers would grant for a given top-up amount. */
export function previewBonus(tiers: WalletBonusTier[], amount: number): { percent: number; bonus: number } {
  const tier = tiers
    .filter((t) => t.isActive && t.minAmount <= amount)
    .sort((a, b) => b.minAmount - a.minAmount)[0];
  const percent = tier?.bonusPercent ?? 0;
  return { percent, bonus: Math.round(amount * percent) / 100 };
}
