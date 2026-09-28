// Website shop API — customer accounts, cart checkout, order tracking.
// Uses ITS OWN axios instance + token key so a customer session never mixes
// with a staff dashboard session in the same browser, and a 401 here never
// bounces the visitor to the staff sign-in page.

import axios from "axios";
import api from "./api";
import type { ItemVariantDto, ItemAddOnDto } from "./itemService";

const CUSTOMER_TOKEN_KEY = "axis_customer_token";
const CUSTOMER_KEY = "axis_customer";

export const shopApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  timeout: 20000,
  headers: { "Content-Type": "application/json", Accept: "application/json" },
});

shopApi.interceptors.request.use((config) => {
  const token = getCustomerToken();
  if (token) config.headers.set("Authorization", `Bearer ${token}`);
  return config;
});

export function getCustomerToken(): string | null {
  try { return localStorage.getItem(CUSTOMER_TOKEN_KEY); } catch { return null; }
}
export function getStoredCustomer(): Customer | null {
  try { const raw = localStorage.getItem(CUSTOMER_KEY); return raw ? (JSON.parse(raw) as Customer) : null; } catch { return null; }
}
export function storeCustomerSession(token: string, customer: Customer) {
  try { localStorage.setItem(CUSTOMER_TOKEN_KEY, token); localStorage.setItem(CUSTOMER_KEY, JSON.stringify(customer)); } catch { /* private mode */ }
  window.dispatchEvent(new Event("axis-customer-changed"));
}
export function clearCustomerSession() {
  try { localStorage.removeItem(CUSTOMER_TOKEN_KEY); localStorage.removeItem(CUSTOMER_KEY); } catch { /* ignore */ }
  window.dispatchEvent(new Event("axis-customer-changed"));
}

// ── Types ─────────────────────────────────────────────────────────────────
export type Customer = { id: number; firstName: string; lastName: string; phone: string; email?: string | null; walletBalance: number };
export type CustomerAuthResponse = { success: boolean; token?: string | null; customer?: Customer | null; error?: string | null };

export type CartAddOn = { addOnId: number; name: string; unitPrice: number; quantity: number };
export type CartLine = {
  key: string;                 // itemId:variantId:addOnSignature
  itemId: number;
  name: string;
  imagePath?: string | null;
  unitPrice: number;
  quantity: number;
  variantId?: number | null;
  variantName?: string | null;
  variantPriceDelta: number;
  addOns: CartAddOn[];
};

export type OrderLine = {
  id: number; itemId: number; itemName: string; unitPrice: number; quantity: number;
  variantId?: number | null; variantName?: string | null; variantPriceDelta: number;
  addOns: Array<{ addOnId: number; name: string; quantity: number; unitPrice: number; lineTotal: number }>;
  lineTotal: number; imagePath?: string | null;
};
export type OnlineOrder = {
  id: number; code: string; userId: number; customerName: string; customerPhone: string; customerEmail?: string | null;
  fulfilment: string; paymentMode: "PayAtPickup" | "Online" | string;
  status: "New" | "AwaitingPayment" | "Paid" | "Accepted" | "Ready" | "Completed" | "Cancelled" | string;
  subtotal: number; total: number; notes?: string | null; pickupTime?: string | null;
  transactionRecordId?: number | null; onlinePaymentId?: number | null; payUrl?: string | null;
  handledBy?: string | null; cancelReason?: string | null;
  createdOn: string; paidOn?: string | null; acceptedOn?: string | null; readyOn?: string | null; completedOn?: string | null;
  lines: OrderLine[]; ageMinutes: number;
};
export type PlaceOrderResult = { success: boolean; order?: OnlineOrder | null; payUrl?: string | null; error?: string | null };
export type OrderInbox = { newCount: number; acceptedCount: number; readyCount: number; orders: OnlineOrder[] };

export const cartLineTotal = (l: CartLine) =>
  (l.unitPrice + l.variantPriceDelta) * l.quantity + l.addOns.reduce((s, a) => s + a.unitPrice * a.quantity, 0);

export const cartKey = (itemId: number, variantId?: number | null, addOns?: CartAddOn[]) =>
  `${itemId}:${variantId ?? 0}:${(addOns ?? []).map(a => `${a.addOnId}x${a.quantity}`).sort().join(",")}`;

// ── Auth ──────────────────────────────────────────────────────────────────
export async function customerRegister(body: { firstName: string; lastName: string; phone: string; email?: string; password: string }) {
  const res = await shopApi.post<CustomerAuthResponse>("/shop/auth/register", body, { validateStatus: () => true });
  return res.data;
}
export async function customerLogin(identifier: string, password: string) {
  const res = await shopApi.post<CustomerAuthResponse>("/shop/auth/login", { identifier, password }, { validateStatus: () => true });
  return res.data;
}
export async function customerMe(): Promise<Customer | null> {
  const res = await shopApi.get<Customer>("/shop/me", { validateStatus: () => true });
  return res.status === 200 ? res.data : null;
}

// ── Orders ────────────────────────────────────────────────────────────────
export async function placeOrder(lines: CartLine[], paymentMode: "PayAtPickup" | "Online", notes?: string, pickupTime?: string): Promise<PlaceOrderResult> {
  const body = {
    paymentMode, notes: notes || null, pickupTime: pickupTime || null,
    lines: lines.map(l => ({
      itemId: l.itemId, quantity: l.quantity, variantId: l.variantId ?? null,
      addOns: l.addOns.map(a => ({ addOnId: a.addOnId, quantity: a.quantity })),
    })),
  };
  const res = await shopApi.post<PlaceOrderResult>("/shop/orders", body, { validateStatus: () => true });
  if (res.status === 401) return { success: false, error: "Please sign in to place your order." };
  return res.data;
}
export async function myOrders(): Promise<OnlineOrder[]> {
  const res = await shopApi.get<OnlineOrder[]>("/shop/orders");
  return res.data;
}
export async function myOrder(code: string): Promise<OnlineOrder | null> {
  const res = await shopApi.get<OnlineOrder>(`/shop/orders/${encodeURIComponent(code)}`, { validateStatus: () => true });
  return res.status === 200 ? res.data : null;
}
export async function cancelMyOrder(code: string): Promise<boolean> {
  const res = await shopApi.post(`/shop/orders/${encodeURIComponent(code)}/cancel`, null, { validateStatus: () => true });
  return res.status === 204;
}

// ── Cart (localStorage, per browser) ──────────────────────────────────────
const CART_KEY = "axis_cart";
export function loadCart(): CartLine[] {
  try { const raw = localStorage.getItem(CART_KEY); return raw ? (JSON.parse(raw) as CartLine[]) : []; } catch { return []; }
}
export function saveCart(lines: CartLine[]) {
  try { localStorage.setItem(CART_KEY, JSON.stringify(lines)); } catch { /* ignore */ }
  window.dispatchEvent(new Event("axis-cart-changed"));
}
export function addToCart(line: Omit<CartLine, "key">) {
  const lines = loadCart();
  const key = cartKey(line.itemId, line.variantId, line.addOns);
  const existing = lines.find(l => l.key === key);
  if (existing) existing.quantity += line.quantity;
  else lines.push({ ...line, key });
  saveCart(lines);
}
export function setCartQty(key: string, qty: number) {
  const lines = loadCart().map(l => (l.key === key ? { ...l, quantity: qty } : l)).filter(l => l.quantity > 0);
  saveCart(lines);
}
export function clearCart() { saveCart([]); }
export const cartCount = (lines: CartLine[]) => lines.reduce((s, l) => s + l.quantity, 0);

// Re-exports for the menu's add-to-cart sheet
export type { ItemVariantDto, ItemAddOnDto };

// ── Till inbox (staff — uses the dashboard session) ───────────────────────
export async function getOrderInbox(includeDone = false): Promise<OrderInbox> {
  const res = await api.get<OrderInbox>("/shop/inbox", { params: { includeDone } });
  return res.data;
}
export async function acceptOnlineOrder(id: number): Promise<OnlineOrder> {
  const res = await api.post<OnlineOrder>(`/shop/inbox/${id}/accept`);
  return res.data;
}
export async function setOnlineOrderStatus(id: number, status: "Ready" | "Completed" | "Cancelled", reason?: string): Promise<OnlineOrder> {
  const res = await api.post<OnlineOrder>(`/shop/inbox/${id}/status`, { status, reason: reason ?? null });
  return res.data;
}
