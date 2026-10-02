import api from "./api";

// ── Types ─────────────────────────────────────────────────────────────────

export type OnlinePaymentStatus =
  | "Created" | "Redirected" | "Pending" | "Paid" | "Failed" | "Cancelled" | "Expired"
  | "Refunded" | "Voided" | "Chargeback" | string;

export type OnlinePaymentPurpose = "EventTicket" | "WalletTopUp" | "Invoice" | "Custom" | string;

export type OnlinePayment = {
  id: number;
  code: string;
  provider: string;
  environment: "sandbox" | "production" | string;
  purpose: OnlinePaymentPurpose;
  referenceType?: string | null;
  referenceId?: number | null;
  referenceLabel?: string | null;
  amount: number;
  currency: string;
  description: string;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  userId?: number | null;
  status: OnlinePaymentStatus;
  providerOrderNumber?: string | null;
  providerPaymentId?: string | null;
  providerStatus?: string | null;
  paymentMethodUsed?: string | null;
  cardMasked?: string | null;
  failureReason?: string | null;
  isFulfilled: boolean;
  fulfilledOn?: string | null;
  fulfillmentError?: string | null;
  callbackCount: number;
  lastCallbackOn?: string | null;
  createdBy?: string | null;
  createdOn: string;
  paidOn?: string | null;
  expiresOn?: string | null;
  payUrl: string;
};

export type OnlinePaymentEvent = {
  id: number;
  kind: string;
  providerType?: string | null;
  providerStatus?: string | null;
  orderStatus?: string | null;
  resultStatus?: string | null;
  note?: string | null;
  hashValid: boolean;
  createdOn: string;
  raw?: string | null;
};

export type OnlinePaymentDetail = { payment: OnlinePayment; events: OnlinePaymentEvent[] };

export type OnlinePaymentBucket = { key: string; paidAmount: number; paidCount: number };

export type OnlinePaymentSummary = {
  paidAmount: number; paidCount: number;
  pendingAmount: number; pendingCount: number;
  failedAmount: number; failedCount: number;
  refundedAmount: number; refundedCount: number;
  byPurpose: OnlinePaymentBucket[];
  byProvider: OnlinePaymentBucket[];
};

export type OnlinePaymentsPage = {
  summary: OnlinePaymentSummary;
  totalCount: number;
  rows: OnlinePayment[];
  page: number;
  pageSize: number;
};

export type OnlinePaymentCreate = {
  amount: number;
  description: string;
  currency?: string;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  userId?: number | null;
  purpose?: OnlinePaymentPurpose;
  referenceType?: string | null;
  referenceId?: number | null;
  expiresInHours?: number | null;
  provider?: string | null;
};

export type PaymentProviderConfig = {
  provider: string;
  environment: "sandbox" | "production";
  sandboxConfigured: boolean;
  productionConfigured: boolean;
  activeConfigured: boolean;
  callbackUrl: string;
  successUrlSample: string;
  cancelUrlSample: string;
  publicBaseUrl: string;
  hashAlgorithm: string;
};

export type PublicPayment = {
  code: string;
  provider: string;
  purpose: OnlinePaymentPurpose;
  amount: number;
  currency: string;
  description: string;
  customerName?: string | null;
  status: OnlinePaymentStatus;
  canPay: boolean;
  isExpired: boolean;
  paidOn?: string | null;
  referenceLabel?: string | null;
  /** Where to go after paying — relative (e.g. /tickets/TK-XXXX, /orders/AX-XXXX). */
  nextUrl?: string | null;
  nextLabel?: string | null;
};

export type PublicPaymentStartResult = {
  success: boolean;
  redirectUrl?: string | null;
  status: string;
  error?: string | null;
};

// ── Admin ─────────────────────────────────────────────────────────────────

export async function listOnlinePayments(opts: {
  from?: Date; to?: Date; status?: string; purpose?: string; provider?: string;
  environment?: string; search?: string; page?: number; pageSize?: number;
} = {}): Promise<OnlinePaymentsPage> {
  const res = await api.get<OnlinePaymentsPage>("/payments", {
    params: {
      from: opts.from?.toISOString(),
      to: opts.to?.toISOString(),
      status: opts.status || undefined,
      purpose: opts.purpose || undefined,
      provider: opts.provider || undefined,
      environment: opts.environment || undefined,
      search: opts.search || undefined,
      page: opts.page ?? 1,
      pageSize: opts.pageSize ?? 50,
    },
  });
  return res.data;
}

export async function getOnlinePayment(id: number): Promise<OnlinePaymentDetail> {
  const res = await api.get<OnlinePaymentDetail>(`/payments/${id}`);
  return res.data;
}

export async function createPayLink(body: OnlinePaymentCreate): Promise<OnlinePayment> {
  const res = await api.post<OnlinePayment>("/payments/links", body);
  return res.data;
}

export async function reconcileOnlinePayment(id: number): Promise<OnlinePayment> {
  const res = await api.post<OnlinePayment>(`/payments/${id}/reconcile`);
  return res.data;
}

export async function cancelOnlinePayment(id: number, reason?: string): Promise<void> {
  await api.post(`/payments/${id}/cancel`, { reason: reason ?? null });
}

export async function getPaymentProviderConfig(provider = "MontyPay"): Promise<PaymentProviderConfig> {
  const res = await api.get<PaymentProviderConfig>(`/payments/providers/${provider}/config`);
  return res.data;
}

// ── Public (pay page — no auth) ───────────────────────────────────────────

export async function getPublicPayment(code: string): Promise<PublicPayment> {
  const res = await api.get<PublicPayment>(`/payments/public/${encodeURIComponent(code)}`);
  return res.data;
}

/** Result-page poll: the server asks the gateway itself if no callback has landed yet (throttled server-side). */
export async function checkPublicPayment(code: string): Promise<PublicPayment> {
  const res = await api.post<PublicPayment>(`/payments/public/${encodeURIComponent(code)}/check`);
  return res.data;
}

export async function startPublicPayment(code: string): Promise<PublicPaymentStartResult> {
  const res = await api.post<PublicPaymentStartResult>(`/payments/public/${encodeURIComponent(code)}/start`);
  return res.data;
}
