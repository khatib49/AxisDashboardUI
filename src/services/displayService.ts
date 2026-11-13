import api from "./api";
import type { BaseResponse } from "./deliveryService";
import { publicApi, publicError } from "./selfOrderService";
import type { WhishStartResultDto } from "./whishPayService";

/**
 * Customer-facing display (TillControls). The till pushes its cart to the
 * register's display; the screen (/display?token=…) polls the public view.
 */
export const DISPLAY_REGISTER_KEY = "axis.display.register";

export type DisplayStatus = "Idle" | "Cart" | "Awaiting" | "Paid" | "Thanks";
export type DisplayCartLine = { name: string; qty: number; price: number };

export type DisplayStateDto = {
  id: number;
  registerName: string;
  token: string;
  transactionId?: number | null;
  status: DisplayStatus;
  totalUsd: number;
  rateLbp: number;
  totalLbp: number;
  whishRequestId?: number | null;
  updatedOn: string;
};

export type DisplayViewDto = {
  registerName: string;
  status: DisplayStatus;
  transactionId?: number | null;
  cart: DisplayCartLine[];
  totalUsd: number;
  rateLbp: number;
  totalLbp: number;
  /** Whish collect URL to render as QR while Awaiting. */
  qrPayload?: string | null;
  whishAmount?: number | null;
  updatedOn: string;
};

function unwrap<T>(r: BaseResponse<T>): T {
  if (!r.success || r.data === undefined || r.data === null) throw new Error(r.message || r.error || "Request failed");
  return r.data;
}

/** Register name this till pushes to (set from the cashier screen / admin page); null = no display attached. */
export function getDisplayRegister(): string | null {
  try {
    const v = localStorage.getItem(DISPLAY_REGISTER_KEY);
    return v && v.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}
export function setDisplayRegister(register: string | null) {
  try {
    if (register && register.trim()) localStorage.setItem(DISPLAY_REGISTER_KEY, register.trim());
    else localStorage.removeItem(DISPLAY_REGISTER_KEY);
  } catch { /* storage unavailable */ }
}
export const displayUrl = (token: string) => `${window.location.origin}/display?token=${encodeURIComponent(token)}`;

// ── Admin ────────────────────────────────────────────────────────────────
export async function getDisplays(): Promise<DisplayStateDto[]> {
  const res = await api.get<DisplayStateDto[]>(`/till/displays`);
  return res.data;
}
export async function createDisplay(registerName: string): Promise<DisplayStateDto> {
  const res = await api.post<BaseResponse<DisplayStateDto>>(`/till/displays`, { registerName });
  return unwrap(res.data);
}
export async function rotateDisplayToken(id: number): Promise<DisplayStateDto> {
  const res = await api.post<BaseResponse<DisplayStateDto>>(`/till/displays/${id}/rotate-token`);
  return unwrap(res.data);
}
export async function deleteDisplay(id: number): Promise<void> {
  await api.delete(`/till/displays/${id}`);
}

// ── Till ─────────────────────────────────────────────────────────────────
export async function pushDisplayStateNow(register: string, cart: DisplayCartLine[], status?: DisplayStatus | null, transactionId?: number | null): Promise<DisplayStateDto> {
  const res = await api.post<BaseResponse<DisplayStateDto>>(`/till/displays/${encodeURIComponent(register)}/state`, {
    transactionId: transactionId ?? null,
    cart,
    status: status ?? null,
  });
  return unwrap(res.data);
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pending: { register: string; cart: DisplayCartLine[]; status?: DisplayStatus | null; transactionId?: number | null } | null = null;

/**
 * Debounced push (350 ms) so a cashier tapping "+" repeatedly sends one request.
 * Fire-and-forget: failures (display not configured, API down) are swallowed
 * so the till is never blocked by the screen. Pass status undefined to let the
 * server pick Cart / Idle from the cart contents.
 */
export function pushDisplayState(register: string, cart: DisplayCartLine[], status?: DisplayStatus | null, transactionId?: number | null, delayMs = 350) {
  pending = { register, cart, status, transactionId };
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    const p = pending;
    pending = null;
    if (!p) return;
    pushDisplayStateNow(p.register, p.cart, p.status, p.transactionId).catch(() => { /* screen is optional */ });
  }, delayMs);
}

/** Start a Whish request for the register's invoice and show its QR on the screen (source Display). */
export async function requestDisplayWhish(register: string, transactionId?: number | null, returnUrl?: string | null): Promise<WhishStartResultDto> {
  const res = await api.post<BaseResponse<WhishStartResultDto>>(`/till/displays/${encodeURIComponent(register)}/request-whish`, {
    transactionId: transactionId ?? null,
    returnUrl: returnUrl ?? null,
  });
  return unwrap(res.data);
}

// ── Screen (anonymous, polled) ───────────────────────────────────────────
export async function getDisplayView(token: string): Promise<DisplayViewDto> {
  try {
    const res = await publicApi.get<BaseResponse<DisplayViewDto>>(`/till/displays/view/${encodeURIComponent(token)}`);
    return unwrap(res.data);
  } catch (e) {
    throw publicError(e);
  }
}

export default {
  getDisplays, createDisplay, rotateDisplayToken, deleteDisplay,
  pushDisplayState, pushDisplayStateNow, requestDisplayWhish, getDisplayView,
  getDisplayRegister, setDisplayRegister, displayUrl,
};
