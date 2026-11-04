import { useCallback, useSyncExternalStore } from "react";
import {
  clearShopSession, readShopCustomer, readShopToken, subscribeShopSession,
  type CustomerDto, type ShopCartLine, type ShopItemDto, type ItemVariantDto, type ItemAddOnDto,
} from "../../services/shopService";

// ── Cart (localStorage "shop_cart") ──────────────────────────────────────
export const SHOP_CART_KEY = "shop_cart";

export type CartAddOn = { addOnId: number; name: string; price: number };
export type CartLine = {
  /** itemId:variantId:addOnIds — one row per distinct configuration. */
  key: string;
  itemId: number; name: string; unitPrice: number;
  variantId?: number | null; variantName?: string | null; priceDelta: number;
  /** Selected extras, one of each per unit (ShopService prices add-on × its quantity; we send the line quantity). */
  addOns: CartAddOn[];
  quantity: number;
  imagePath?: string | null;
  /** Upper bound the shop enforces (null = made to order). */
  maxQty?: number | null;
  categoryId?: number;
};

type Listener = () => void;
const cartListeners = new Set<Listener>();
let cartSnapshot: CartLine[] = readCart();

function readCart(): CartLine[] {
  try {
    const raw = localStorage.getItem(SHOP_CART_KEY);
    const rows = raw ? (JSON.parse(raw) as CartLine[]) : [];
    return Array.isArray(rows) ? rows.filter((l) => l && typeof l.itemId === "number" && l.quantity > 0) : [];
  } catch { return []; }
}
function writeCart(lines: CartLine[]) {
  cartSnapshot = lines;
  try { localStorage.setItem(SHOP_CART_KEY, JSON.stringify(lines)); } catch { /* private mode: memory only */ }
  cartListeners.forEach((l) => l());
}
function subscribeCart(l: Listener) {
  cartListeners.add(l);
  const onStorage = (e: StorageEvent) => { if (!e.key || e.key === SHOP_CART_KEY) { cartSnapshot = readCart(); l(); } };
  window.addEventListener("storage", onStorage);
  return () => { cartListeners.delete(l); window.removeEventListener("storage", onStorage); };
}

/** Items the shop will sell right now (made-to-order items are always available). */
export const itemInStock = (i: ShopItemDto) => !i.trackStock || i.quantity > 0 || i.variants.some((v) => v.quantity > 0);

export const lineUnit = (l: CartLine) => l.unitPrice + l.priceDelta + l.addOns.reduce((s, a) => s + a.price, 0);
export const lineTotal = (l: CartLine) => Math.round(lineUnit(l) * l.quantity * 100) / 100;
export const cartSubtotal = (lines: CartLine[]) => Math.round(lines.reduce((s, l) => s + lineTotal(l), 0) * 100) / 100;
export const cartCount = (lines: CartLine[]) => lines.reduce((s, l) => s + l.quantity, 0);

export function makeCartKey(itemId: number, variantId?: number | null, addOnIds: number[] = []) {
  return `${itemId}:${variantId ?? 0}:${[...addOnIds].sort((a, b) => a - b).join("+")}`;
}

export function buildLine(item: ShopItemDto, quantity: number, variant?: ItemVariantDto | null, addOns: ItemAddOnDto[] = []): CartLine {
  const max = variant ? variant.quantity : item.trackStock ? item.quantity : null;
  return {
    key: makeCartKey(item.id, variant?.id, addOns.map((a) => a.id)),
    itemId: item.id, name: item.name, unitPrice: item.price,
    variantId: variant?.id ?? null, variantName: variant?.name ?? null, priceDelta: variant?.priceDelta ?? 0,
    addOns: addOns.map((a) => ({ addOnId: a.id, name: a.name, price: a.price })),
    quantity, imagePath: item.imagePath ?? null, maxQty: max, categoryId: item.categoryId,
  };
}

/** Request lines for POST shop/quote and POST shop/orders (server re-prices everything). */
export const toRequestLines = (lines: CartLine[]): ShopCartLine[] => lines.map((l) => ({
  itemId: l.itemId, quantity: l.quantity, variantId: l.variantId ?? null,
  addOns: l.addOns.length ? l.addOns.map((a) => ({ addOnId: a.addOnId, quantity: l.quantity })) : null,
}));

export function addToCart(line: CartLine) {
  const lines = [...cartSnapshot];
  const i = lines.findIndex((l) => l.key === line.key);
  if (i >= 0) {
    const q = lines[i].quantity + line.quantity;
    lines[i] = { ...lines[i], quantity: line.maxQty != null ? Math.min(q, Math.max(1, line.maxQty)) : q };
  } else lines.push(line);
  writeCart(lines);
}
export function setCartQty(key: string, quantity: number) {
  const lines = cartSnapshot.map((l) => (l.key === key ? { ...l, quantity } : l)).filter((l) => l.quantity > 0);
  writeCart(lines);
}
export function removeCartLine(key: string) { writeCart(cartSnapshot.filter((l) => l.key !== key)); }
export function clearCart() { writeCart([]); }

export function useCart() {
  const lines = useSyncExternalStore(subscribeCart, () => cartSnapshot, () => cartSnapshot);
  return {
    lines, count: cartCount(lines), subtotal: cartSubtotal(lines),
    add: addToCart, setQty: setCartQty, remove: removeCartLine, clear: clearCart,
  };
}

// ── Customer session ─────────────────────────────────────────────────────
type Session = { token: string | null; customer: CustomerDto | null };
let sessionSnapshot: Session = { token: readShopToken(), customer: readShopCustomer() };
function subscribeSession(l: Listener) {
  return subscribeShopSession(() => { sessionSnapshot = { token: readShopToken(), customer: readShopCustomer() }; l(); });
}

export function useShopSession() {
  const s = useSyncExternalStore(subscribeSession, () => sessionSnapshot, () => sessionSnapshot);
  const signOut = useCallback(() => clearShopSession(), []);
  return { token: s.token, customer: s.customer, signedIn: !!s.token, signOut };
}
