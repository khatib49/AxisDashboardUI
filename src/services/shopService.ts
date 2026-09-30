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
export type Fulfilment = "Pickup" | "Delivery";
export type PaymentMode = "PayAtPickup" | "Online" | "COD";

export type ShopAddress = {
  line1: string; line2?: string | null; city: string; region?: string | null; notes?: string | null;
  contactName?: string | null; contactPhone?: string | null;
};

export type ShipmentEvent = { id: number; code?: string | null; description?: string | null; location?: string | null; comments?: string | null; eventAt: string };
export type ShipmentStatus = "Created" | "PickedUp" | "InTransit" | "OutForDelivery" | "Delivered" | "Returned" | "Failed" | "Cancelled" | string;
export type Shipment = {
  id: number; onlineOrderId: number; orderCode: string; provider: string; environment: string;
  awbNumber?: string | null; status: ShipmentStatus;
  productGroup?: string | null; productType?: string | null; paymentType?: string | null; services?: string | null;
  codAmount: number; codCurrency?: string | null; weightKg: number; pieces: number;
  labelUrl?: string | null; pickupGuid?: string | null; pickupId?: string | null;
  lastTrackingCode?: string | null; lastTrackingText?: string | null; lastTrackingAt?: string | null; lastPolledAt?: string | null;
  error?: string | null; createdBy?: string | null; createdOn: string; deliveredOn?: string | null; settledOn?: string | null; settlementJournalEntryId?: number | null;
  trackingUrl?: string | null;
  events: ShipmentEvent[];
  customerName?: string | null; customerPhone?: string | null; city?: string | null; paymentMode?: string | null; orderTotal: number; orderStatus?: string | null;
};

export type OnlineOrder = {
  id: number; code: string; userId: number; customerName: string; customerPhone: string; customerEmail?: string | null;
  fulfilment: Fulfilment | string; paymentMode: PaymentMode | string;
  status: "New" | "AwaitingPayment" | "Paid" | "Accepted" | "Ready" | "Shipped" | "Delivered" | "Completed" | "Cancelled" | string;
  subtotal: number; total: number; notes?: string | null; pickupTime?: string | null;
  transactionRecordId?: number | null; onlinePaymentId?: number | null; payUrl?: string | null;
  handledBy?: string | null; cancelReason?: string | null;
  createdOn: string; paidOn?: string | null; acceptedOn?: string | null; readyOn?: string | null; completedOn?: string | null;
  lines: OrderLine[]; ageMinutes: number;
  // delivery (0 / null for pickup)
  deliveryFee: number; rateSource?: string | null; address?: ShopAddress | null; weightKg?: number | null;
  shippedOn?: string | null; deliveredOn?: string | null; shipment?: Shipment | null;
};
export type PlaceOrderResult = { success: boolean; order?: OnlineOrder | null; payUrl?: string | null; error?: string | null };
export type OrderInbox = { newCount: number; acceptedCount: number; readyCount: number; orders: OnlineOrder[]; toShipCount: number; inTransitCount: number };

// ── Public catalogue (shop page) ──────────────────────────────────────────
export type ShopCatalogItem = {
  id: number; name: string; price: number; imagePath?: string | null; quantity: number; description?: string | null;
  variants: ItemVariantDto[]; addOns: ItemAddOnDto[];
};
export type ShopCatalogCategory = { id: number; name: string; itemType?: string | null; items: ShopCatalogItem[] };
export type ShopZone = { id: number; name: string; cities: string[]; fee: number; freeAbove?: number | null; estimatedDays?: string | null };
export type ShopCatalog = {
  shopEnabled: boolean; title: string; deliveryEnabled: boolean; codEnabled: boolean; onlinePaymentEnabled: boolean;
  categories: ShopCatalogCategory[]; zones: ShopZone[];
};
export type ShopQuote = {
  deliverable: boolean; error?: string | null; subtotal: number; deliveryFee: number; total: number; weightKg: number;
  rateSource: "zone" | "aramex" | "free" | "none" | string; zoneName?: string | null; estimatedDays?: string | null; zoneId?: number | null;
};

export async function getCatalog(): Promise<ShopCatalog> {
  const res = await shopApi.get<ShopCatalog>("/shop/catalog");
  return res.data;
}
/** paymentMode "COD" makes a live Aramex quote include the COD surcharge (same as the final order). */
export async function quoteDelivery(lines: CartLine[], city: string, paymentMode?: PaymentMode | string): Promise<ShopQuote> {
  const res = await shopApi.post<ShopQuote>("/shop/quote", { city, paymentMode: paymentMode ?? null, lines: toCartPayload(lines) }, { validateStatus: () => true });
  if (res.status !== 200) return { deliverable: false, error: "Could not price delivery right now.", subtotal: 0, deliveryFee: 0, total: 0, weightKg: 0, rateSource: "none" };
  return res.data;
}
const toCartPayload = (lines: CartLine[]) => lines.map(l => ({
  itemId: l.itemId, quantity: l.quantity, variantId: l.variantId ?? null,
  addOns: l.addOns.map(a => ({ addOnId: a.addOnId, quantity: a.quantity })),
}));

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
export async function placeOrder(
  lines: CartLine[], paymentMode: PaymentMode, notes?: string, pickupTime?: string,
  fulfilment: Fulfilment = "Pickup", address?: ShopAddress | null,
): Promise<PlaceOrderResult> {
  const body = {
    paymentMode, notes: notes || null, pickupTime: pickupTime || null,
    fulfilment, address: fulfilment === "Delivery" ? address ?? null : null,
    lines: toCartPayload(lines),
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

// ── Till: delivery / Aramex actions ───────────────────────────────────────
export type ShipError = { error: string; shipment?: Shipment | null };
/** Create the Aramex shipment for an accepted delivery order. Throws ShipError-shaped `response.data` on 400. */
export async function shipOnlineOrder(id: number, body?: { weightKg?: number | null; pieces?: number | null; comments?: string | null }): Promise<OnlineOrder> {
  const res = await api.post<OnlineOrder>(`/shop/inbox/${id}/ship`, body ?? {});
  return res.data;
}
export async function refreshShipment(shipmentId: number): Promise<Shipment> {
  const res = await api.post<Shipment>(`/shop/shipments/${shipmentId}/refresh`);
  return res.data;
}
export async function shipmentLabel(shipmentId: number): Promise<Shipment> {
  const res = await api.post<Shipment>(`/shop/shipments/${shipmentId}/label`);
  return res.data;
}
export async function markShipmentDelivered(shipmentId: number): Promise<Shipment> {
  const res = await api.post<Shipment>(`/shop/shipments/${shipmentId}/delivered`);
  return res.data;
}
export async function setShipmentStatus(shipmentId: number, status: "Returned" | "Cancelled" | "Failed", reason?: string): Promise<Shipment> {
  const res = await api.post<Shipment>(`/shop/shipments/${shipmentId}/status`, { status, reason: reason ?? null });
  return res.data;
}
export type PickupResult = { success: boolean; error?: string | null; pickupId?: string | null; pickupGuid?: string | null; shipmentsAttached: number };
export async function bookCourierPickup(body?: { pickupDate?: string | null; readyTime?: string | null; lastPickupTime?: string | null; closingTime?: string | null; reference?: string | null; shipmentIds?: number[] | null }): Promise<PickupResult> {
  const res = await api.post<PickupResult>(`/shop/shipments/pickup`, body ?? {}, { validateStatus: () => true });
  return res.data;
}

/** Customer-facing wording for order statuses (pickup vs delivery). */
export const SHIPMENT_STATUS_TEXT: Record<string, string> = {
  Created: "Label created — waiting for courier pickup",
  PickedUp: "Picked up by Aramex",
  InTransit: "On its way",
  OutForDelivery: "Out for delivery today",
  Delivered: "Delivered",
  Returned: "Returned to AXIS",
  Failed: "Shipment failed",
  Cancelled: "Shipment cancelled",
};
