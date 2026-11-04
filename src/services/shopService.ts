import axios from "axios";
import type { BaseResponse } from "./deliveryService";
import type { WhishStartResultDto } from "./whishPayService";

/**
 * Public storefront client (phase 3). Like `publicApi` in selfOrderService it is
 * deliberately NOT the shared staff `api` instance (that one redirects to the
 * staff /signin on 401). The customer's JWT lives in localStorage "shop_token"
 * and is attached here; a 401 only clears that token.
 *
 * Catalogue / auth / quote / checkout / orders come from the pre-existing
 * `api/shop` endpoints. The phase-3 `api/shop2` endpoints add paging, counts,
 * featured items and the order→invoice bridge; every shop2 call falls back to
 * the one-shot catalogue when the API does not have them (404), so the pages
 * keep working against an older API build.
 */
export const SHOP_TOKEN_KEY = "shop_token";
export const SHOP_CUSTOMER_KEY = "shop_customer";

export const shopApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  timeout: 20000,
  headers: { "Content-Type": "application/json", Accept: "application/json" },
});

shopApi.interceptors.request.use((cfg) => {
  const t = readShopToken();
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});
shopApi.interceptors.response.use(
  (r) => r,
  (e) => {
    if (axios.isAxiosError(e) && e.response?.status === 401 && readShopToken()) clearShopSession();
    return Promise.reject(e);
  },
);

/** Readable Error from an axios failure or a {success:false,error} / {error} / {message} payload. */
export function shopError(e: unknown): Error {
  if (axios.isAxiosError(e)) {
    const data = e.response?.data as { message?: string; error?: string; title?: string } | undefined;
    if (e.response?.status === 429) return new Error("Too many requests, please wait a moment.");
    if (e.response?.status === 401) return new Error("Please sign in to continue.");
    if (data?.error) return new Error(data.error);
    if (data?.message) return new Error(data.message);
    if (!e.response) return new Error("Cannot reach the server. Check your connection.");
    if (e.response.status === 404) return new Error("Not found.");
    return new Error(`Request failed (${e.response.status})`);
  }
  if (e instanceof Error) return e;
  return new Error("Something went wrong");
}
const is404 = (e: unknown) => axios.isAxiosError(e) && e.response?.status === 404;

// ── Types (mirror Application/DTOs/ShopDtos.cs + Shop2Dtos.cs) ───────────
export type ItemVariantDto = { id: number; name: string; color?: string | null; sku?: string | null; priceDelta: number; quantity: number; isActive: boolean; sortOrder: number };
export type ItemAddOnDto = { id: number; name: string; price: number; isActive: boolean; sortOrder: number };

export type ShopCatalogItemDto = { id: number; name: string; price: number; imagePath?: string | null; quantity: number; description?: string | null; variants: ItemVariantDto[]; addOns: ItemAddOnDto[] };
export type ShopCatalogCategoryDto = { id: number; name: string; itemType?: string | null; items: ShopCatalogItemDto[] };
export type ShopZoneDto = { id: number; name: string; cities: string[]; fee: number; freeAbove?: number | null; estimatedDays?: string | null };
export type ShopCatalogDto = {
  shopEnabled: boolean; title: string; deliveryEnabled: boolean; codEnabled: boolean; onlinePaymentEnabled: boolean;
  categories: ShopCatalogCategoryDto[]; zones: ShopZoneDto[];
};

export type ShopCategorySummaryDto = { id: number; name: string; itemType?: string | null; itemCount: number; coverImagePath?: string | null; minPrice?: number | null };
export type ShopItemDto = {
  id: number; name: string; price: number; imagePath?: string | null; quantity: number;
  categoryId: number; categoryName: string; itemType?: string | null; trackStock: boolean;
  variants: ItemVariantDto[]; addOns: ItemAddOnDto[];
};
export type ShopSort = "name" | "priceAsc" | "priceDesc" | "newest";
export type ShopItemListRequest = { categoryId?: number | null; search?: string | null; page?: number; pageSize?: number; sort?: ShopSort | null; inStockOnly?: boolean };
export type PaginatedResponse<T> = { totalCount: number; data: T[]; pageNumber: number; pageSize: number };

export type ShopCartAddOn = { addOnId: number; quantity: number };
export type ShopCartLine = { itemId: number; quantity: number; variantId?: number | null; addOns?: ShopCartAddOn[] | null };
export type ShopAddressDto = { line1: string; line2?: string | null; city: string; region?: string | null; notes?: string | null; contactName?: string | null; contactPhone?: string | null };
export type ShopPaymentMode = "PayAtPickup" | "Online" | "COD";
export type ShopFulfilment = "Pickup" | "Delivery";
export type PlaceOrderRequest = { lines: ShopCartLine[]; paymentMode: ShopPaymentMode; notes?: string | null; pickupTime?: string | null; fulfilment?: ShopFulfilment | null; address?: ShopAddressDto | null };
export type ShopQuoteRequest = { lines: ShopCartLine[]; city: string; paymentMode?: string | null };
export type ShopQuoteDto = { deliverable: boolean; error?: string | null; subtotal: number; deliveryFee: number; total: number; weightKg: number; rateSource: string; zoneName?: string | null; estimatedDays?: string | null; zoneId?: number | null };

export type OrderLineAddOnDto = { addOnId: number; name: string; quantity: number; unitPrice: number; lineTotal: number };
export type OnlineOrderLineDto = { id: number; itemId: number; itemName: string; unitPrice: number; quantity: number; variantId?: number | null; variantName?: string | null; variantPriceDelta: number; addOns: OrderLineAddOnDto[]; lineTotal: number; imagePath?: string | null };
export type ShipmentDto = { id: number; status: string; awbNumber?: string | null; trackingUrl?: string | null; lastTrackingText?: string | null; lastTrackingAt?: string | null; deliveredOn?: string | null };
export type OnlineOrderStatus = "New" | "AwaitingPayment" | "Paid" | "Accepted" | "Ready" | "Shipped" | "Delivered" | "Completed" | "Cancelled";
export type OnlineOrderDto = {
  id: number; code: string; userId: number; customerName: string; customerPhone: string; customerEmail?: string | null;
  fulfilment: ShopFulfilment; paymentMode: ShopPaymentMode; status: OnlineOrderStatus | string;
  subtotal: number; total: number; notes?: string | null; pickupTime?: string | null;
  transactionRecordId?: number | null; onlinePaymentId?: number | null; payUrl?: string | null;
  handledBy?: string | null; cancelReason?: string | null;
  createdOn: string; paidOn?: string | null; acceptedOn?: string | null; readyOn?: string | null; completedOn?: string | null;
  lines: OnlineOrderLineDto[]; ageMinutes: number;
  deliveryFee: number; rateSource?: string | null; address?: ShopAddressDto | null; weightKg?: number | null;
  shippedOn?: string | null; deliveredOn?: string | null; shipment?: ShipmentDto | null;
};
export type PlaceOrderResult = { success: boolean; order?: OnlineOrderDto | null; payUrl?: string | null; error?: string | null };

export type CustomerDto = { id: number; firstName: string; lastName: string; phone: string; email?: string | null; walletBalance: number };
export type CustomerAuthResponse = { success: boolean; token?: string | null; customer?: CustomerDto | null; error?: string | null };
export type CustomerRegisterRequest = { firstName: string; lastName: string; phone: string; email?: string | null; password: string };
export type CustomerLoginRequest = { identifier: string; password: string };

export type ShopOrderInvoiceDto = { code: string; transactionId: number; isOpen: boolean; invoiceTotal: number; orderStatus: string; paymentMode: string };

// ── Helpers ──────────────────────────────────────────────────────────────
export const fmtMoney = (n: number | null | undefined) => `$${(Number(n) || 0).toFixed(2)}`;

/** Absolute URL for an item picture (imagePath is relative to the API host), or the placeholder. */
export function imageUrl(path?: string | null): string {
  if (!path) return "/images/image-placeholder.svg";
  if (/^https?:\/\//i.test(path)) return path;
  const base = (import.meta.env.VITE_API_IMAGE_BASE_URL as string) || "";
  return base ? `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}` : `/${path.replace(/^\//, "")}`;
}

/** Items whose stock the shop enforces (ShopService refuses to oversell retail items and variants). */
export const tracksStock = (itemType?: string | null, variants?: ItemVariantDto[] | null) =>
  (variants?.some((v) => v.isActive) ?? false) || (itemType ?? "").toLowerCase() === "retail";

// ── Customer session (localStorage "shop_token") ─────────────────────────
type SessionListener = () => void;
const sessionListeners = new Set<SessionListener>();
function notifySession() { sessionListeners.forEach((l) => l()); }

export function readShopToken(): string | null {
  try { return localStorage.getItem(SHOP_TOKEN_KEY); } catch { return null; }
}
export function readShopCustomer(): CustomerDto | null {
  try { const raw = localStorage.getItem(SHOP_CUSTOMER_KEY); return raw ? (JSON.parse(raw) as CustomerDto) : null; } catch { return null; }
}
export function setShopSession(token: string, customer: CustomerDto | null) {
  try { localStorage.setItem(SHOP_TOKEN_KEY, token); if (customer) localStorage.setItem(SHOP_CUSTOMER_KEY, JSON.stringify(customer)); } catch { /* private mode: in-memory only */ }
  notifySession();
}
export function clearShopSession() {
  try { localStorage.removeItem(SHOP_TOKEN_KEY); localStorage.removeItem(SHOP_CUSTOMER_KEY); } catch { /* ignore */ }
  notifySession();
}
export function subscribeShopSession(l: SessionListener): () => void {
  sessionListeners.add(l);
  const onStorage = (e: StorageEvent) => { if (!e.key || e.key === SHOP_TOKEN_KEY || e.key === SHOP_CUSTOMER_KEY) l(); };
  window.addEventListener("storage", onStorage);
  return () => { sessionListeners.delete(l); window.removeEventListener("storage", onStorage); };
}

// ── Catalogue (api/shop, pre-existing) ───────────────────────────────────
const CATALOG_TTL_MS = 60_000;
let catalogCache: { at: number; p: Promise<ShopCatalogDto> } | null = null;

export function getCatalog(force = false): Promise<ShopCatalogDto> {
  if (!force && catalogCache && Date.now() - catalogCache.at < CATALOG_TTL_MS) return catalogCache.p;
  const p = shopApi.get<ShopCatalogDto>("/shop/catalog").then((r) => r.data);
  catalogCache = { at: Date.now(), p };
  p.catch(() => { if (catalogCache?.p === p) catalogCache = null; });
  return p.catch((e) => { throw shopError(e); });
}

function catalogItemToShopItem(c: ShopCatalogCategoryDto, i: ShopCatalogItemDto): ShopItemDto {
  return {
    id: i.id, name: i.name, price: i.price, imagePath: i.imagePath ?? null, quantity: i.quantity,
    categoryId: c.id, categoryName: c.name, itemType: c.itemType ?? null,
    trackStock: tracksStock(c.itemType, i.variants),
    variants: (i.variants ?? []).filter((v) => v.isActive), addOns: (i.addOns ?? []).filter((a) => a.isActive),
  };
}
const flattenCatalog = (cat: ShopCatalogDto): ShopItemDto[] => cat.categories.flatMap((c) => c.items.map((i) => catalogItemToShopItem(c, i)));
const inStock = (i: ShopItemDto) => !i.trackStock || i.quantity > 0 || i.variants.some((v) => v.quantity > 0);

// ── Shop2 (phase 3) with catalogue fallback ──────────────────────────────
let shop2Available = true;
async function shop2<T>(call: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
  if (shop2Available) {
    try { return await call(); } catch (e) {
      if (!is404(e)) throw shopError(e);
      shop2Available = false;
    }
  }
  return fallback();
}

export function getShopCategories(): Promise<ShopCategorySummaryDto[]> {
  return shop2(
    async () => (await shopApi.get<ShopCategorySummaryDto[]>("/shop2/categories")).data,
    async () => (await getCatalog()).categories.map((c) => ({
      id: c.id, name: c.name, itemType: c.itemType ?? null, itemCount: c.items.length,
      coverImagePath: c.items.find((i) => i.imagePath)?.imagePath ?? null,
      minPrice: c.items.length ? Math.min(...c.items.map((i) => i.price)) : null,
    })),
  );
}

export function listShopItems(req: ShopItemListRequest): Promise<PaginatedResponse<ShopItemDto>> {
  const page = Math.max(1, req.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, req.pageSize ?? 24));
  return shop2(
    async () => (await shopApi.get<PaginatedResponse<ShopItemDto>>("/shop2/items", {
      params: { categoryId: req.categoryId ?? undefined, search: req.search || undefined, page, pageSize, sort: req.sort ?? undefined, inStockOnly: req.inStockOnly || undefined },
    })).data,
    async () => {
      let rows = flattenCatalog(await getCatalog());
      if (req.categoryId) rows = rows.filter((i) => i.categoryId === req.categoryId);
      if (req.search?.trim()) { const s = req.search.trim().toLowerCase(); rows = rows.filter((i) => i.name.toLowerCase().includes(s) || i.categoryName.toLowerCase().includes(s)); }
      if (req.inStockOnly) rows = rows.filter(inStock);
      const sort = req.sort ?? "name";
      rows.sort((a, b) => sort === "priceAsc" ? a.price - b.price || a.name.localeCompare(b.name)
        : sort === "priceDesc" ? b.price - a.price || a.name.localeCompare(b.name)
        : sort === "newest" ? b.id - a.id : a.name.localeCompare(b.name) || a.id - b.id);
      return { totalCount: rows.length, data: rows.slice((page - 1) * pageSize, page * pageSize), pageNumber: page, pageSize };
    },
  );
}

export function getShopItem(id: number): Promise<ShopItemDto | null> {
  return shop2(
    async () => {
      try { return (await shopApi.get<ShopItemDto>(`/shop2/items/${id}`)).data; } catch (e) {
        // Distinguish "endpoint missing" from "item not sold online": the endpoint answers 404 with {error}.
        if (is404(e) && (e as { response?: { data?: { error?: string } } }).response?.data?.error) return null;
        throw e;
      }
    },
    async () => flattenCatalog(await getCatalog()).find((i) => i.id === id) ?? null,
  );
}

export function getFeaturedItems(take = 8): Promise<ShopItemDto[]> {
  return shop2(
    async () => (await shopApi.get<ShopItemDto[]>("/shop2/featured", { params: { take } })).data,
    async () => flattenCatalog(await getCatalog())
      .sort((a, b) => Number(!!b.imagePath) - Number(!!a.imagePath) || Number(inStock(b)) - Number(inStock(a)) || b.id - a.id)
      .slice(0, take),
  );
}

// ── Quote / checkout / orders (api/shop, pre-existing) ───────────────────
export async function quoteDelivery(body: ShopQuoteRequest): Promise<ShopQuoteDto> {
  try { return (await shopApi.post<ShopQuoteDto>("/shop/quote", body)).data; } catch (e) { throw shopError(e); }
}

export async function registerCustomer(body: CustomerRegisterRequest): Promise<CustomerDto> {
  try {
    const r = (await shopApi.post<CustomerAuthResponse>("/shop/auth/register", body)).data;
    if (!r.success || !r.token) throw new Error(r.error || "Could not create the account.");
    setShopSession(r.token, r.customer ?? null);
    return r.customer!;
  } catch (e) { throw shopError(e); }
}

export async function loginCustomer(body: CustomerLoginRequest): Promise<CustomerDto> {
  try {
    const r = (await shopApi.post<CustomerAuthResponse>("/shop/auth/login", body)).data;
    if (!r.success || !r.token) throw new Error(r.error || "Invalid credentials.");
    setShopSession(r.token, r.customer ?? null);
    return r.customer!;
  } catch (e) { throw shopError(e); }
}

export async function getMe(): Promise<CustomerDto> {
  try {
    const me = (await shopApi.get<CustomerDto>("/shop/me")).data;
    try { localStorage.setItem(SHOP_CUSTOMER_KEY, JSON.stringify(me)); } catch { /* ignore */ }
    notifySession();
    return me;
  } catch (e) { throw shopError(e); }
}

export async function placeOrder(body: PlaceOrderRequest): Promise<PlaceOrderResult> {
  try {
    const r = (await shopApi.post<PlaceOrderResult>("/shop/orders", body)).data;
    if (!r.success) throw new Error(r.error || "Could not place the order.");
    return r;
  } catch (e) { throw shopError(e); }
}

export async function getMyOrders(): Promise<OnlineOrderDto[]> {
  try { return (await shopApi.get<OnlineOrderDto[]>("/shop/orders")).data; } catch (e) { throw shopError(e); }
}

export async function getMyOrder(code: string): Promise<OnlineOrderDto | null> {
  try { return (await shopApi.get<OnlineOrderDto>(`/shop/orders/${encodeURIComponent(code)}`)).data; } catch (e) {
    if (is404(e)) return null;
    throw shopError(e);
  }
}

export async function cancelMyOrder(code: string): Promise<void> {
  try { await shopApi.post(`/shop/orders/${encodeURIComponent(code)}/cancel`); } catch (e) { throw shopError(e); }
}

// ── Order → invoice → Whish (api/shop2, phase 3) ─────────────────────────
/** Null when the API has no shop2 yet, the order is not mine, or no invoice exists for it yet. */
export async function getOrderInvoice(code: string): Promise<ShopOrderInvoiceDto | null> {
  try { return (await shopApi.get<ShopOrderInvoiceDto>(`/shop2/orders/${encodeURIComponent(code)}/invoice`)).data; } catch (e) {
    if (is404(e)) return null;
    throw shopError(e);
  }
}

export async function startOrderWhish(code: string, returnUrl?: string | null): Promise<WhishStartResultDto> {
  try {
    const r = (await shopApi.post<BaseResponse<WhishStartResultDto>>(`/shop2/orders/${encodeURIComponent(code)}/whish`, { returnUrl: returnUrl ?? null })).data;
    if (!r.success || !r.data) throw new Error(r.message || r.error || "Could not start the payment.");
    return r.data;
  } catch (e) { throw shopError(e); }
}

export default {
  getCatalog, getShopCategories, listShopItems, getShopItem, getFeaturedItems, quoteDelivery,
  registerCustomer, loginCustomer, getMe, placeOrder, getMyOrders, getMyOrder, cancelMyOrder, getOrderInvoice, startOrderWhish,
  readShopToken, readShopCustomer, setShopSession, clearShopSession, subscribeShopSession, imageUrl, fmtMoney,
};
