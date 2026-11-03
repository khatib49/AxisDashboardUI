import api from "./api";

// ─────────────────────────── shared shapes ───────────────────────────
export type BaseResponse<T> = {
  success: boolean;
  error?: string | null;
  message: string;
  data?: T | null;
};

export type Paginated<T> = {
  totalCount: number;
  data: T[];
  pageNumber: number;
  pageSize: number;
};

/** Pull a human message out of an axios/ApiError rejection or a BaseResponse body. */
export function errorMessage(err: unknown, fallback = "Request failed"): string {
  if (err && typeof err === "object") {
    const e = err as { message?: unknown; details?: unknown; status?: number };
    const details = e.details as { message?: unknown; error?: unknown } | undefined;
    if (details && typeof details.message === "string" && details.message) return details.message;
    if (e.status === 404) return "Not found";
    if (typeof e.message === "string" && e.message) return e.message;
  }
  return fallback;
}

// ─────────────────────────── gift cards ──────────────────────────────
export type GiftCardStatus = "Active" | "Depleted" | "Expired" | "Disabled";

export type GiftCardDto = {
  id: number;
  code: string;
  initialAmount: number;
  balance: number;
  currencyCode: string;
  issuedOn: string;
  expiresOn?: string | null;
  issuedTo?: string | null;
  userId?: number | null;
  status: GiftCardStatus | string;
  notes?: string | null;
  createdBy: string;
  branchId?: number | null;
};

export type GiftCardTransactionDto = {
  id: number;
  giftCardId: number;
  type: "Load" | "Redeem" | "Refund" | "Adjust" | string;
  amount: number;
  transactionId?: number | null;
  balanceAfter: number;
  on: string;
  by: string;
  note?: string | null;
};

export type GiftCardIssueDto = {
  amount: number;
  currencyCode?: string | null;
  expiresOn?: string | null;
  issuedTo?: string | null;
  userId?: number | null;
  notes?: string | null;
};

export type GiftCardLookupDto = {
  code: string;
  balance: number;
  currencyCode: string;
  status: string;
  canRedeem: boolean;
  reason?: string | null;
  expiresOn?: string | null;
  issuedTo?: string | null;
};

export type GiftCardRedeemResultDto = {
  code: string;
  appliedAsPayment: number;
  remainingBalance: number;
  transactionId: number;
  invoiceTotalBefore: number;
  invoiceTotalAfter: number;
  status: string;
};

const gc = "/promotions/giftcards";

export async function issueGiftCard(dto: GiftCardIssueDto) {
  return (await api.post<BaseResponse<GiftCardDto>>(gc, dto)).data;
}
export async function listGiftCards(page = 1, pageSize = 20, search?: string, status?: string) {
  const p = new URLSearchParams({ Page: String(page), PageSize: String(pageSize) });
  if (search) p.append("Search", search);
  if (status) p.append("Status", status);
  return (await api.get<Paginated<GiftCardDto>>(`${gc}?${p.toString()}`)).data;
}
export async function getGiftCard(id: number) {
  return (await api.get<GiftCardDto>(`${gc}/${id}`)).data;
}
export async function getGiftCardTransactions(id: number) {
  return (await api.get<GiftCardTransactionDto[]>(`${gc}/${id}/transactions`)).data;
}
export async function disableGiftCard(id: number, note?: string) {
  return (await api.post<BaseResponse<GiftCardDto>>(`${gc}/${id}/disable`, { delta: 0, note: note ?? null })).data;
}
export async function adjustGiftCard(id: number, delta: number, note?: string) {
  return (await api.post<BaseResponse<GiftCardDto>>(`${gc}/${id}/adjust`, { delta, note: note ?? null })).data;
}
export async function loadGiftCard(id: number, amount: number, note?: string) {
  return (await api.post<BaseResponse<GiftCardDto>>(`${gc}/${id}/load`, { amount, note: note ?? null })).data;
}
export async function refundGiftCard(id: number, amount: number, transactionId?: number | null, note?: string) {
  return (await api.post<BaseResponse<GiftCardDto>>(`${gc}/${id}/refund`, { amount, transactionId: transactionId ?? null, note: note ?? null })).data;
}
export async function lookupGiftCard(code: string) {
  return (await api.get<BaseResponse<GiftCardLookupDto>>(`${gc}/lookup/${encodeURIComponent(code.trim())}`)).data;
}
export async function redeemGiftCard(code: string, transactionId: number, amount: number) {
  return (await api.post<BaseResponse<GiftCardRedeemResultDto>>(`${gc}/redeem`, { code, transactionId, amount })).data;
}

// ─────────────────────────── coupons ─────────────────────────────────
export type CouponType = "Percent" | "Fixed";

export type CouponDto = {
  id: number;
  code: string;
  name: string;
  type: CouponType | string;
  value: number;
  minOrderAmount?: number | null;
  maxDiscountAmount?: number | null;
  maxUses?: number | null;
  maxUsesPerCustomer?: number | null;
  usedCount: number;
  validFrom?: string | null;
  validTo?: string | null;
  categoryIdsCsv?: string | null;
  isActive: boolean;
  createdBy: string;
  createdOn: string;
  branchId?: number | null;
};

export type CouponUpsertDto = {
  code: string;
  name: string;
  type: CouponType | string;
  value: number;
  minOrderAmount?: number | null;
  maxDiscountAmount?: number | null;
  maxUses?: number | null;
  maxUsesPerCustomer?: number | null;
  validFrom?: string | null;
  validTo?: string | null;
  categoryIdsCsv?: string | null;
  isActive: boolean;
};

export type CouponRedemptionDto = {
  id: number;
  couponId: number;
  couponCode: string;
  transactionId: number;
  userId?: number | null;
  discountAmount: number;
  redeemedOn: string;
  redeemedBy: string;
};

export type CouponValidationResultDto = {
  eligible: boolean;
  reason?: string | null;
  code: string;
  name?: string | null;
  type?: string | null;
  value: number;
  orderAmount: number;
  eligibleAmount: number;
  discountAmount: number;
};

export type CouponRedeemResultDto = {
  code: string;
  transactionId: number;
  discountAmount: number;
  invoiceTotalBefore: number;
  invoiceTotalAfter: number;
  redemptionId: number;
};

const cp = "/promotions/coupons";

export async function listCoupons(page = 1, pageSize = 20, search?: string, isActive?: boolean | null) {
  const p = new URLSearchParams({ Page: String(page), PageSize: String(pageSize) });
  if (search) p.append("Search", search);
  if (isActive !== undefined && isActive !== null) p.append("IsActive", String(isActive));
  return (await api.get<Paginated<CouponDto>>(`${cp}?${p.toString()}`)).data;
}
export async function getCoupon(id: number) {
  return (await api.get<CouponDto>(`${cp}/${id}`)).data;
}
export async function createCoupon(dto: CouponUpsertDto) {
  return (await api.post<BaseResponse<CouponDto>>(cp, dto)).data;
}
export async function updateCoupon(id: number, dto: CouponUpsertDto) {
  return (await api.put<BaseResponse<CouponDto>>(`${cp}/${id}`, dto)).data;
}
export async function deleteCoupon(id: number) {
  await api.delete(`${cp}/${id}`);
}
export async function getCouponRedemptions(id: number) {
  return (await api.get<CouponRedemptionDto[]>(`${cp}/${id}/redemptions`)).data;
}
export async function validateCoupon(body: {
  code: string;
  transactionId?: number | null;
  orderAmount?: number | null;
  categoryIds?: number[] | null;
  userId?: number | null;
}) {
  return (await api.post<BaseResponse<CouponValidationResultDto>>(`${cp}/validate`, body)).data;
}
export async function redeemCoupon(code: string, transactionId: number) {
  return (await api.post<BaseResponse<CouponRedeemResultDto>>(`${cp}/redeem`, { code, transactionId })).data;
}

// ─────────────────────────── happy hour ──────────────────────────────
/** Times are "HH:mm" in venue local time (Asia/Beirut); daysOfWeekCsv uses ISO 1=Mon … 7=Sun. */
export type HappyHourRuleDto = {
  id: number;
  name: string;
  daysOfWeekCsv: string;
  startTime: string;
  endTime: string;
  discountPercent: number;
  categoryIdsCsv?: string | null;
  itemIdsCsv?: string | null;
  isActive: boolean;
  priority: number;
  branchId?: number | null;
  createdOn: string;
};

export type HappyHourRuleUpsertDto = {
  name: string;
  daysOfWeekCsv: string;
  startTime: string;
  endTime: string;
  discountPercent: number;
  categoryIdsCsv?: string | null;
  itemIdsCsv?: string | null;
  isActive: boolean;
  priority: number;
};

export type HappyHourActiveNowDto = {
  serverUtc: string;
  localTime: string;
  timeZoneId: string;
  rules: HappyHourRuleDto[];
};

export type HappyHourPricePreviewDto = {
  itemId: number;
  itemName: string;
  basePrice: number;
  discountPercent: number;
  discountedPrice: number;
  ruleId?: number | null;
  ruleName?: string | null;
  active: boolean;
};

export type HappyHourApplyResultDto = {
  transactionId: number;
  ruleId: number;
  ruleName: string;
  discountAmount: number;
  invoiceTotalBefore: number;
  invoiceTotalAfter: number;
  matchedLines: number;
  alreadyApplied: boolean;
};

const hh = "/promotions/happyhour";

export async function listHappyHourRules(includeInactive = true) {
  return (await api.get<HappyHourRuleDto[]>(`${hh}?includeInactive=${includeInactive}`)).data;
}
export async function createHappyHourRule(dto: HappyHourRuleUpsertDto) {
  return (await api.post<BaseResponse<HappyHourRuleDto>>(hh, dto)).data;
}
export async function updateHappyHourRule(id: number, dto: HappyHourRuleUpsertDto) {
  return (await api.put<BaseResponse<HappyHourRuleDto>>(`${hh}/${id}`, dto)).data;
}
export async function deleteHappyHourRule(id: number) {
  await api.delete(`${hh}/${id}`);
}
export async function getHappyHourActiveNow(at?: string) {
  const q = at ? `?at=${encodeURIComponent(at)}` : "";
  return (await api.get<HappyHourActiveNowDto>(`${hh}/active-now${q}`)).data;
}
export async function getHappyHourPricePreview(itemId: number) {
  return (await api.get<BaseResponse<HappyHourPricePreviewDto>>(`${hh}/price-preview?itemId=${itemId}`)).data;
}
export async function applyHappyHour(transactionId: number) {
  return (await api.post<BaseResponse<HappyHourApplyResultDto>>(`${hh}/apply`, { transactionId })).data;
}

// ─────────────────────────── combos ──────────────────────────────────
export type ComboItemDto = { id: number; itemId: number; itemName: string; quantity: number; unitPrice: number };

export type ComboDto = {
  id: number;
  name: string;
  description?: string | null;
  price: number;
  isActive: boolean;
  imagePath?: string | null;
  branchId?: number | null;
  createdOn: string;
  itemsTotal: number;
  saving: number;
  items: ComboItemDto[];
};

export type ComboUpsertDto = {
  name: string;
  description?: string | null;
  price: number;
  isActive: boolean;
  imagePath?: string | null;
  items: { itemId: number; quantity: number }[];
};

export type ComboSellResultDto = {
  comboId: number;
  comboName: string;
  transactionId: number;
  createdNewInvoice: boolean;
  itemsTotal: number;
  comboPrice: number;
  adjustmentApplied: number;
  invoiceTotalAfter: number;
};

const cb = "/promotions/combos";

export async function listCombos(includeInactive = false) {
  return (await api.get<ComboDto[]>(`${cb}?includeInactive=${includeInactive}`)).data;
}
export async function getCombo(id: number) {
  return (await api.get<ComboDto>(`${cb}/${id}`)).data;
}
export async function createCombo(dto: ComboUpsertDto) {
  return (await api.post<BaseResponse<ComboDto>>(cb, dto)).data;
}
export async function updateCombo(id: number, dto: ComboUpsertDto) {
  return (await api.put<BaseResponse<ComboDto>>(`${cb}/${id}`, dto)).data;
}
export async function deleteCombo(id: number) {
  await api.delete(`${cb}/${id}`);
}
export async function sellCombo(comboId: number, transactionId?: number | null, userId?: number | null) {
  return (await api.post<BaseResponse<ComboSellResultDto>>(`${cb}/sell`, {
    comboId,
    transactionId: transactionId ?? null,
    userId: userId ?? null,
  })).data;
}

// ─────────────────────────── automatic apply (phase 2) ───────────────
/** Happy-hour state on an invoice; delta = signed change booked by THIS call (0 = unchanged). */
export type AutoApplyHappyHourDto = {
  ruleId: number;
  ruleName: string;
  amount: number;
  delta: number;
  matchedLines: number;
};

export type AutoApplyComboDto = {
  comboId: number;
  comboName: string;
  quantity: number;
  amount: number;
  delta: number;
};

export type AutoApplyResultDto = {
  transactionId: number;
  happyHour?: AutoApplyHappyHourDto | null;
  combos: AutoApplyComboDto[];
  totalBefore: number;
  totalAfter: number;
  messages: string[];
};

export type AppliedCouponDto = { couponId: number; code: string; name: string; amount: number };

/** What is currently booked on an invoice (read-only; no evaluation). */
export type AppliedPromotionsDto = {
  transactionId: number;
  isOpen: boolean;
  invoiceTotal: number;
  happyHour?: AutoApplyHappyHourDto | null;
  combos: AutoApplyComboDto[];
  coupons: AppliedCouponDto[];
  totalDiscount: number;
};

/**
 * Re-evaluate happy hour + combos on an OPEN invoice. Idempotent: only the
 * difference with what is already booked is applied, so call it after every
 * order / add-items / remove-item.
 */
export async function autoApply(transactionId: number) {
  return (await api.post<BaseResponse<AutoApplyResultDto>>("/promotions/auto-apply", { transactionId })).data;
}

export async function getApplied(transactionId: number) {
  return (await api.get<BaseResponse<AppliedPromotionsDto>>(`/promotions/applied/${transactionId}`)).data;
}

export default {
  issueGiftCard, listGiftCards, getGiftCard, getGiftCardTransactions, disableGiftCard, adjustGiftCard,
  loadGiftCard, refundGiftCard, lookupGiftCard, redeemGiftCard,
  listCoupons, getCoupon, createCoupon, updateCoupon, deleteCoupon, getCouponRedemptions, validateCoupon, redeemCoupon,
  listHappyHourRules, createHappyHourRule, updateHappyHourRule, deleteHappyHourRule, getHappyHourActiveNow,
  getHappyHourPricePreview, applyHappyHour,
  listCombos, getCombo, createCombo, updateCombo, deleteCombo, sellCombo,
  autoApply, getApplied,
};
