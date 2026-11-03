import api from "./api";
import type { BaseResponse } from "./deliveryService";
import { publicApi, publicError } from "./selfOrderService";

/**
 * Whish Collect against an existing open invoice (Payments2 module).
 * Staff start from the till with the bearer-token `api`; guests (self-order
 * phone, kiosk) use `publicApi` with the token that owns their invoice.
 */
export type WhishSource = "Till" | "SelfOrder" | "Kiosk" | "Display";
export type WhishRequestStatus = "Pending" | "Paid" | "Failed" | "Expired" | "Cancelled";

export type WhishStartResultDto = {
  requestId: number;
  collectUrl: string;
  /** Same as collectUrl — what the QR encodes. */
  qrPayload: string;
  amount: number;
  currency: string;
  status: WhishRequestStatus;
};

export type WhishStatusDto = {
  requestId: number;
  transactionId: number;
  status: WhishRequestStatus;
  amount: number;
  currency: string;
  invoiceClosed: boolean;
  paidOn?: string | null;
  collectUrl?: string | null;
};

function unwrap<T>(r: BaseResponse<T>): T {
  if (!r.success || r.data === undefined || r.data === null) throw new Error(r.message || r.error || "Request failed");
  return r.data;
}

/** True when the error means Whish credentials are missing (UI shows "Whish not configured"). */
export function isWhishNotConfigured(e: unknown): boolean {
  const msg = (e as { message?: string })?.message ?? "";
  return /not configured/i.test(msg);
}

// ── Staff (till) ─────────────────────────────────────────────────────────
export async function startWhishPayment(transactionId: number, source: WhishSource = "Till", returnUrl?: string | null): Promise<WhishStartResultDto> {
  const res = await api.post<BaseResponse<WhishStartResultDto>>(`/payments/whish/start`, { transactionId, source, returnUrl: returnUrl ?? null });
  return unwrap(res.data);
}

// ── Guest (self-order session token or kiosk token) ──────────────────────
export async function startWhishPaymentPublic(token: string, transactionId: number, returnUrl?: string | null): Promise<WhishStartResultDto> {
  try {
    const res = await publicApi.post<BaseResponse<WhishStartResultDto>>(`/payments/whish/start-public`, { token, transactionId, returnUrl: returnUrl ?? null });
    return unwrap(res.data);
  } catch (e) {
    throw publicError(e);
  }
}

/** Status only; safe to poll from anywhere (anonymous). */
export async function getWhishStatus(requestId: number): Promise<WhishStatusDto> {
  try {
    const res = await publicApi.get<BaseResponse<WhishStatusDto>>(`/payments/whish/${requestId}/status`);
    return unwrap(res.data);
  } catch (e) {
    throw publicError(e);
  }
}

/** Opens the hosted checkout in a new tab; falls back to a same-tab redirect when the popup is blocked. */
export function openCollectUrl(url: string) {
  const w = window.open(url, "_blank", "noopener");
  if (!w) window.location.assign(url);
}

export default { startWhishPayment, startWhishPaymentPublic, getWhishStatus, openCollectUrl, isWhishNotConfigured };
