/**
 * Offline-aware wrappers around the three till write endpoints. When the
 * flag is off they are plain pass-throughs to the API. When it is on, an
 * order placed while offline (or whose request dies on the network, status
 * 0) is queued locally and a placeholder with a negative id is returned.
 *
 * Nothing here is wired into the existing Cashier pages; see README.md.
 */
import { post } from "../services/api";
import { OFFLINE_MODE_ENABLED } from "./flags";
import { enqueue, QueuedOp, resolveTempInvoice } from "./queue";
import { getSnapshot } from "./snapshot";

// ---- payloads (identical to the live endpoints' JSON) ----

export interface OrderLineAddOn {
  addOnId: number;
  quantity: number;
}
export interface OrderLineVariant {
  variantId: number;
  quantity: number;
}
export interface OrderLine {
  itemId: number;
  quantity: number;
  addOns?: OrderLineAddOn[] | null;
  variants?: OrderLineVariant[] | null;
}

/** Body of POST /api/transactions/CreateCoffeeShopOrder (CreateCoffeeShopOrderRequest). */
export interface CreateCoffeeShopOrderPayload {
  userId: number | null;
  itemsRequest: OrderLine[];
  discountId: number;
  isOpenInvoice: boolean;
  setId: number | null;
  comment?: string | null;
  channelId?: number | null;
  walletAmount?: number;
}

/** Body of POST /api/transactions/AddItemsToOpenInvoice/{invoiceId} is the bare line array. */
export type AddItemsPayload = OrderLine[];

/** Query of POST /api/transactions/CloseOpenInvoice/{invoiceId}?walletAmount=. */
export interface CloseInvoicePayload {
  walletAmount?: number;
}

export interface ApiEnvelope<T = unknown> {
  success: boolean;
  error?: string | null;
  message?: string;
  data?: T;
}

export interface QueuedPlaceholder {
  /** Negative, unique in this browser. Pass it back to addItems/closeInvoice while offline. */
  id: number;
  opId: string;
  queued: true;
  statusId: number; // 7 open invoice, 6 paid
  totalPrice: number;
  items: Array<{ itemId: number; itemName: string; quantity: number; price: number }>;
  createdOn: string;
  comment?: string | null;
}

export type OfflineAwareResult<T> =
  | { queued: false; response: T }
  | { queued: true; op: QueuedOp; placeholder: QueuedPlaceholder };

function isOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

/** axios errors normalised by api.ts carry status 0 for network / timeout failures. */
export function isNetworkError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const status = (e as { status?: unknown }).status;
  const code = (e as { code?: unknown }).code;
  return status === 0 || code === "TIMEOUT" || code === "ERR_NETWORK";
}

/**
 * A negative id is a placeholder from createOrderOfflineAware. Once its create
 * op has synced we know the real id and can call the live endpoint; while it is
 * still queued, the follow-up op carries the create op's id (invoiceOpId) and
 * the server resolves it.
 */
async function resolveInvoiceRef(invoiceId: number): Promise<{ realId?: number; opId?: string }> {
  if (invoiceId >= 0) return { realId: invoiceId };
  if (!OFFLINE_MODE_ENABLED) throw new Error("Negative invoice ids are only valid in offline mode.");
  const ref = await resolveTempInvoice(invoiceId);
  if (!ref) throw new Error("The offline invoice this order belongs to is no longer queued on this device.");
  return ref;
}

async function runOfflineAware<T>(
  online: () => Promise<T>,
  queueIt: () => Promise<OfflineAwareResult<T>>,
): Promise<OfflineAwareResult<T>> {
  if (!OFFLINE_MODE_ENABLED) return { queued: false, response: await online() };
  if (!isOnline()) return queueIt();
  try {
    return { queued: false, response: await online() };
  } catch (e) {
    if (isNetworkError(e)) return queueIt();
    throw e;
  }
}

async function pricePlaceholder(lines: OrderLine[], discountId: number) {
  const snap = await getSnapshot();
  const items = snap?.data.items ?? [];
  const discounts = snap?.data.discounts ?? [];
  const priced = lines.map((l) => {
    const item = items.find((i) => i.id === l.itemId);
    const addOnTotal = (l.addOns ?? []).reduce((sum, a) => {
      const def = item?.addOns?.find((x) => x.id === a.addOnId);
      return sum + (def?.price ?? 0) * a.quantity;
    }, 0);
    const variantDelta = (l.variants ?? []).reduce((sum, v) => {
      const def = item?.variants?.find((x) => x.id === v.variantId);
      return sum + (def?.priceDelta ?? 0) * v.quantity;
    }, 0);
    const unit = item?.price ?? 0;
    return {
      itemId: l.itemId,
      itemName: item?.name ?? `Item #${l.itemId}`,
      quantity: l.quantity,
      price: unit * l.quantity + addOnTotal + variantDelta,
    };
  });
  let total = priced.reduce((s, p) => s + p.price, 0);
  const d = discountId > 0 ? discounts.find((x) => x.id === discountId) : undefined;
  if (d && d.percentage > 0) total = Math.round(total * (1 - d.percentage / 100) * 100) / 100;
  return { priced, total };
}

/** POST /transactions/CreateCoffeeShopOrder, or queue it. */
export async function createOrderOfflineAware<T = ApiEnvelope>(
  payload: CreateCoffeeShopOrderPayload,
): Promise<OfflineAwareResult<T>> {
  return runOfflineAware<T>(
    () => post<T>("/transactions/CreateCoffeeShopOrder", payload),
    async () => {
      const op = await enqueue({ type: "CreateCoffeeShopOrder", payload });
      const { priced, total } = await pricePlaceholder(payload.itemsRequest, payload.discountId);
      return {
        queued: true,
        op,
        placeholder: {
          id: op.tempId!,
          opId: op.opId,
          queued: true,
          statusId: payload.isOpenInvoice ? 7 : 6,
          totalPrice: total,
          items: priced,
          createdOn: op.queuedAt,
          comment: payload.comment ?? null,
        },
      };
    },
  );
}

/**
 * POST /transactions/AddItemsToOpenInvoice/{invoiceId}, or queue it. A
 * negative invoiceId (placeholder from createOrderOfflineAware) is resolved
 * server-side through the creating op's id, so it is always queued.
 */
export async function addItemsOfflineAware<T = ApiEnvelope>(
  invoiceId: number,
  payload: AddItemsPayload,
): Promise<OfflineAwareResult<T>> {
  const ref = await resolveInvoiceRef(invoiceId);
  if (ref.realId !== undefined) invoiceId = ref.realId;
  const queueIt = async (): Promise<OfflineAwareResult<T>> => {
    const op = await enqueue({
      type: "AddItemsToOpenInvoice",
      payload: { invoiceId, itemsRequest: payload, invoiceOpId: ref.opId ?? null },
    });
    const { priced, total } = await pricePlaceholder(payload, 0);
    return {
      queued: true,
      op,
      placeholder: {
        id: invoiceId,
        opId: op.opId,
        queued: true,
        statusId: 7,
        totalPrice: total,
        items: priced,
        createdOn: op.queuedAt,
      },
    };
  };
  if (OFFLINE_MODE_ENABLED && invoiceId < 0) return queueIt();
  return runOfflineAware<T>(
    () => post<T>(`/transactions/AddItemsToOpenInvoice/${invoiceId}`, payload),
    queueIt,
  );
}

/** POST /transactions/CloseOpenInvoice/{invoiceId}?walletAmount=, or queue it. */
export async function closeInvoiceOfflineAware<T = ApiEnvelope>(
  invoiceId: number,
  payload: CloseInvoicePayload = {},
): Promise<OfflineAwareResult<T>> {
  const walletAmount = payload.walletAmount ?? 0;
  const ref = await resolveInvoiceRef(invoiceId);
  if (ref.realId !== undefined) invoiceId = ref.realId;
  const queueIt = async (): Promise<OfflineAwareResult<T>> => {
    const op = await enqueue({
      type: "CloseOpenInvoice",
      payload: { invoiceId, walletAmount, invoiceOpId: ref.opId ?? null },
    });
    return {
      queued: true,
      op,
      placeholder: {
        id: invoiceId,
        opId: op.opId,
        queued: true,
        statusId: 6,
        totalPrice: 0,
        items: [],
        createdOn: op.queuedAt,
      },
    };
  };
  if (OFFLINE_MODE_ENABLED && invoiceId < 0) return queueIt();
  return runOfflineAware<T>(
    () =>
      post<T>(`/transactions/CloseOpenInvoice/${invoiceId}`, {}, {
        params: walletAmount ? { walletAmount } : undefined,
      }),
    queueIt,
  );
}
