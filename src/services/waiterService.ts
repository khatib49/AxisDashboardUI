/**
 * Table-aware ordering shared by the desktop floor (order drawer) and the
 * handheld waiter pages. Thin layer over the existing item / category /
 * transaction endpoints plus the Floor seat endpoints: nothing here is new
 * on the backend except what floorService already exposes.
 */
import api from "./api";
import { addItemsToOpenInvoice } from "./transactionService";
import { setLines, LineAssignmentDto, BillBySeatDto, BaseResponse, errorMessage } from "./floorService";

// ── Catalogue (mirrors Application.DTOs.ItemDto incl. add-ons / variants) ──
export type MenuAddOnDto = { id: number; name: string; price: number; isActive: boolean; sortOrder: number };
export type MenuVariantDto = { id: number; name: string; color?: string | null; sku?: string | null; priceDelta: number; quantity: number; isActive: boolean; sortOrder: number };
export type MenuItemDto = {
  id: number;
  name: string;
  quantity: number;
  price: number;
  type: string;
  categoryId: number;
  statusId?: number | null;
  imagePath?: string | null;
  addOns?: MenuAddOnDto[] | null;
  variants?: MenuVariantDto[] | null;
};
export type MenuCategoryDto = { id: number; name: string; type?: string; itemType?: string };

export async function getMenuCategories(): Promise<MenuCategoryDto[]> {
  const res = await api.get<{ data: MenuCategoryDto[] }>(`/category/type/item?Page=1&PageSize=200`);
  return res.data?.data ?? [];
}

export async function getMenuItems(categoryId?: number | null, search?: string | null, pageSize = 200): Promise<MenuItemDto[]> {
  const params = new URLSearchParams({ Page: "1", PageSize: String(pageSize) });
  if (categoryId) params.append("CategoryId", String(categoryId));
  if (search) params.append("Search", search);
  const res = await api.get<{ data: MenuItemDto[] }>(`/item?${params.toString()}`);
  return res.data?.data ?? [];
}

// ── Cart ─────────────────────────────────────────────────────────────
/** One picker line: an item for one seat (null = table), with optional extras. */
export type CartLine = {
  key: string;
  item: MenuItemDto;
  quantity: number;
  seatNumber: number | null;
  courseNumber: number;
  addOns: Record<number, number>; // addOnId → qty per unit
  variants: Record<number, number>; // variantId → qty (must sum to quantity when used)
};

export function newCartLine(item: MenuItemDto, seatNumber: number | null, courseNumber = 1): CartLine {
  return { key: `${item.id}-${seatNumber ?? "t"}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, item, quantity: 1, seatNumber, courseNumber, addOns: {}, variants: {} };
}

export function lineUnitPrice(l: CartLine): number {
  const addOns = Object.entries(l.addOns).reduce((s, [id, q]) => s + (l.item.addOns?.find((a) => a.id === Number(id))?.price ?? 0) * q, 0);
  return l.item.price + addOns;
}
export function lineTotal(l: CartLine): number {
  const variants = Object.entries(l.variants).reduce((s, [id, q]) => s + (l.item.variants?.find((v) => v.id === Number(id))?.priceDelta ?? 0) * q, 0);
  return lineUnitPrice(l) * l.quantity + variants;
}
export function cartTotal(lines: CartLine[]): number {
  return lines.reduce((s, l) => s + lineTotal(l), 0);
}

/** Variant picks must cover the whole quantity when the item has variants. */
export function lineProblem(l: CartLine): string | null {
  const active = (l.item.variants ?? []).filter((v) => v.isActive);
  if (active.length === 0) return null;
  const picked = Object.values(l.variants).reduce((s, q) => s + q, 0);
  if (picked !== l.quantity) return `Pick ${l.quantity} option${l.quantity === 1 ? "" : "s"} for ${l.item.name} (${picked} chosen)`;
  return null;
}

/** Request shape of the existing AddItemsToOpenInvoice / CreateCoffeeShopOrder endpoints. */
export type TableOrderItemRequest = {
  itemId: number;
  quantity: number;
  addOns?: { addOnId: number; quantity: number }[] | null;
  variants?: { variantId: number; quantity: number }[] | null;
};

/** The till folds lines with the same item into one invoice line, so the request is grouped per item too. */
export function buildOrderRequests(lines: CartLine[]): TableOrderItemRequest[] {
  const byItem = new Map<number, TableOrderItemRequest>();
  for (const l of lines) {
    const cur = byItem.get(l.item.id) ?? { itemId: l.item.id, quantity: 0, addOns: [], variants: [] };
    cur.quantity += l.quantity;
    for (const [id, q] of Object.entries(l.addOns)) {
      if (q <= 0) continue;
      const ex = cur.addOns!.find((a) => a.addOnId === Number(id));
      if (ex) ex.quantity += q * l.quantity; else cur.addOns!.push({ addOnId: Number(id), quantity: q * l.quantity });
    }
    for (const [id, q] of Object.entries(l.variants)) {
      if (q <= 0) continue;
      const ex = cur.variants!.find((v) => v.variantId === Number(id));
      if (ex) ex.quantity += q; else cur.variants!.push({ variantId: Number(id), quantity: q });
    }
    byItem.set(l.item.id, cur);
  }
  return [...byItem.values()].map((r) => ({
    ...r,
    addOns: r.addOns && r.addOns.length ? r.addOns : null,
    variants: r.variants && r.variants.length ? r.variants : null,
  }));
}

export function buildSeatAssignments(lines: CartLine[]): LineAssignmentDto[] {
  return lines.map((l) => ({ itemId: l.item.id, seatNumber: l.seatNumber, quantity: l.quantity, courseNumber: l.courseNumber }));
}

export type SendOrderResult = { success: boolean; message: string; bill?: BillBySeatDto | null; seatWarning?: string | null };

/**
 * "Send": add the lines to the table's open invoice through the existing
 * AddItemsToOpenInvoice, then record seat + course per line. A seat
 * failure after a successful add is reported as a warning (the items are
 * on the invoice either way).
 */
export async function sendTableOrder(transactionId: number, lines: CartLine[]): Promise<SendOrderResult> {
  if (lines.length === 0) return { success: false, message: "Nothing to send." };
  const problem = lines.map(lineProblem).find((p) => p);
  if (problem) return { success: false, message: problem };
  const requests = buildOrderRequests(lines);
  let added: { success: boolean; message?: string; error?: string };
  try {
    added = await addItemsToOpenInvoice(transactionId, requests);
  } catch (err) {
    return { success: false, message: errorMessage(err, "Could not add the items to the invoice") };
  }
  if (!added.success) return { success: false, message: added.message || added.error || "Could not add the items to the invoice" };

  try {
    const seats: BaseResponse<BillBySeatDto> = await setLines(transactionId, buildSeatAssignments(lines), true);
    if (!seats.success) return { success: true, message: "Items sent; seats not recorded", seatWarning: seats.message };
    return { success: true, message: `${lines.reduce((s, l) => s + l.quantity, 0)} item(s) sent to invoice #${transactionId}`, bill: seats.data };
  } catch (err) {
    return { success: true, message: "Items sent; seats not recorded", seatWarning: errorMessage(err) };
  }
}

export default { getMenuCategories, getMenuItems, newCartLine, lineUnitPrice, lineTotal, cartTotal, lineProblem, buildOrderRequests, buildSeatAssignments, sendTableOrder };
