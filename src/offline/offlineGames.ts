/**
 * Offline-aware wrappers around the two game-till write endpoints, in the
 * same shape as offlineOrders.ts. With the flag off they are plain
 * pass-throughs to the live API. With it on, a session started (or closed)
 * while offline, or whose request dies on the network (status 0), is queued
 * locally and a placeholder with a negative id is returned. The placeholder
 * price is an ESTIMATE from the cached snapshot's game settings; the server
 * prices the session when the queue replays.
 */
import { post } from "../services/api";
import { OFFLINE_MODE_ENABLED } from "./flags";
import { enqueue, list as listQueuedOps, QueuedOp, resolveTempInvoice } from "./queue";
import { ApiEnvelope, isNetworkError } from "./offlineOrders";
import { getSnapshot } from "./snapshot";

/**
 * Query parameters of POST /api/transactions/CreateGameSession as an object.
 * This is also the JSON payload of the "CreateGameSession" offline op.
 */
export interface CreateGameSessionPayload {
  gameId: number;
  gameSettingId: number;
  hours: number;
  /** Status id the till sends (1 = enabled); the server decides the stored status. */
  status?: number;
  /** 0 / undefined for open-set rooms. */
  setId?: number;
  discountId?: number;
  userId?: number | null;
  numberOfPersons?: number;
  isDayPass?: boolean;
  comment?: string;
}

/** Query of POST /api/transactions/sessions/{invoiceId}/close?walletAmount=. */
export interface CloseGameSessionPayload {
  walletAmount?: number;
}

export interface QueuedGameSessionPlaceholder {
  /** Negative, unique in this browser. Pass it back to closeGameSessionOfflineAware while offline. */
  id: number;
  opId: string;
  queued: true;
  /** 7 = open session (board games / day pass), 6 = paid at start (PS5) — mirrors the server rule as far as the cache allows. */
  statusId: number;
  /** Estimated from the cached setting (price × hours × persons, minus discount); 0 when nothing is cached. */
  totalPrice: number;
  estimated: boolean;
  gameId: number;
  gameName?: string;
  gameSettingId: number;
  gameSettingName?: string;
  hours: number;
  numberOfPersons: number;
  isDayPass: boolean;
  roomName?: string;
  setId?: number;
  setName?: string;
  discountId?: number;
  discountName?: string;
  comment?: string | null;
  createdOn: string;
  /** True when a CloseGameSession op for this session is also queued. */
  closeQueued?: boolean;
  /** Queue status of the create op (from listQueuedGameSessions). */
  syncStatus?: "pending" | "syncing" | "failed";
  lastError?: string | null;
}

export type GameSessionOfflineAwareResult<T> =
  | { queued: false; response: T }
  | { queued: true; op: QueuedOp; placeholder: QueuedGameSessionPlaceholder };

function isOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

async function runOfflineAware<T>(
  online: () => Promise<T>,
  queueIt: () => Promise<GameSessionOfflineAwareResult<T>>,
): Promise<GameSessionOfflineAwareResult<T>> {
  if (!OFFLINE_MODE_ENABLED) return { queued: false, response: await online() };
  if (!isOnline()) return queueIt();
  try {
    return { queued: false, response: await online() };
  } catch (e) {
    if (isNetworkError(e)) return queueIt();
    throw e;
  }
}

/** Same query-string building as services/gameSession.ts so the live call is byte-identical. */
export function toCreateGameSessionParams(p: CreateGameSessionPayload): Record<string, unknown> {
  const params: Record<string, unknown> = {
    gameId: p.gameId,
    gameSettingId: p.gameSettingId,
    hours: p.hours,
    status: p.status ?? 1,
  };
  if (p.setId !== undefined && p.setId !== null) params.setId = p.setId;
  if (p.discountId !== undefined && p.discountId !== null) params.discountId = p.discountId;
  if (p.userId !== undefined && p.userId !== null) params.userId = p.userId;
  if (p.isDayPass !== undefined) params.isDayPass = p.isDayPass;
  if (p.numberOfPersons !== undefined) params.numberOfPersons = p.numberOfPersons;
  if (p.comment !== undefined && p.comment !== "") params.comment = p.comment;
  return params;
}

/**
 * Price estimate from the cached snapshot. Mirrors the cashier page's own
 * "Total" preview: open hour / day pass = flat price, otherwise price × hours;
 * × persons; minus the discount percentage.
 */
export async function estimateGameSessionPrice(p: CreateGameSessionPayload): Promise<{
  total: number;
  estimated: boolean;
  gameName?: string;
  settingName?: string;
  statusId: number;
  roomName?: string;
  setName?: string;
  discountName?: string;
}> {
  const snap = await getSnapshot();
  const setting = snap?.data.gameSettings?.find((s) => s.id === p.gameSettingId);
  const game = snap?.data.games?.find((g) => g.id === p.gameId);
  const persons = Math.max(1, p.numberOfPersons ?? 1);
  let room: { name: string } | undefined;
  let setName: string | undefined;
  if (p.setId) {
    for (const r of snap?.data.rooms ?? []) {
      const hit = r.sets.find((s) => s.id === p.setId);
      if (hit) {
        room = r;
        setName = hit.name;
        break;
      }
    }
  }
  if (!setting) {
    return { total: 0, estimated: false, gameName: game?.name, statusId: 7, roomName: room?.name, setName };
  }
  const base = setting.isOpenHour || setting.isDayPass || setting.hours === 0
    ? setting.price
    : setting.price * Math.max(0, p.hours);
  let total = base * persons;
  const discount = p.discountId ? snap?.data.discounts.find((d) => d.id === p.discountId) : undefined;
  if (discount && discount.percentage > 0) total = total - (total * discount.percentage) / 100;
  if (total < 0) total = 0;
  total = Math.round(total * 100) / 100;
  // Server rule (TransactionRecordService.CreateGameSession): board-game categories
  // and day passes open as 7, everything else is paid (6) at start. The cache
  // only knows the game's category name, so treat non-PS5 categories as open.
  const openAtStart = (p.isDayPass ?? false) || (game ? !/ps5|playstation/i.test(game.categoryName ?? "") : true);
  return {
    total,
    estimated: true,
    gameName: game?.name ?? setting.gameName,
    settingName: setting.name,
    statusId: openAtStart && !setting.isDayPass ? 7 : 6,
    roomName: room?.name,
    setName,
    discountName: discount?.name,
  };
}

/** POST /transactions/CreateGameSession (query string), or queue it. */
export async function createGameSessionOfflineAware<T = ApiEnvelope>(
  payload: CreateGameSessionPayload,
): Promise<GameSessionOfflineAwareResult<T>> {
  return runOfflineAware<T>(
    () => post<T>("/transactions/CreateGameSession", null, { params: toCreateGameSessionParams(payload) }),
    async () => {
      const op = await enqueue({ type: "CreateGameSession", payload });
      const est = await estimateGameSessionPrice(payload);
      return {
        queued: true,
        op,
        placeholder: {
          id: op.tempId!,
          opId: op.opId,
          queued: true,
          statusId: est.statusId,
          totalPrice: est.total,
          estimated: est.estimated,
          gameId: payload.gameId,
          gameName: est.gameName,
          gameSettingId: payload.gameSettingId,
          gameSettingName: est.settingName,
          hours: payload.hours,
          numberOfPersons: Math.max(1, payload.numberOfPersons ?? 1),
          isDayPass: payload.isDayPass ?? false,
          roomName: est.roomName,
          setId: payload.setId,
          setName: est.setName,
          discountId: payload.discountId || undefined,
          discountName: est.discountName,
          comment: payload.comment ?? null,
          createdOn: op.queuedAt,
        },
      };
    },
  );
}

/**
 * POST /transactions/sessions/{invoiceId}/close?walletAmount=, or queue it. A
 * negative invoiceId (placeholder from createGameSessionOfflineAware) is
 * resolved server-side through the creating op's id, so it is always queued
 * until the create op has synced; afterwards the real id is used.
 */
export async function closeGameSessionOfflineAware<T = ApiEnvelope>(
  invoiceId: number,
  payload: CloseGameSessionPayload = {},
): Promise<GameSessionOfflineAwareResult<T>> {
  const walletAmount = payload.walletAmount ?? 0;
  let ref: { realId?: number; opId?: string } = { realId: invoiceId };
  if (invoiceId < 0) {
    if (!OFFLINE_MODE_ENABLED) throw new Error("Negative session ids are only valid in offline mode.");
    const r = await resolveTempInvoice(invoiceId);
    if (!r) throw new Error("The offline session this close belongs to is no longer queued on this device.");
    ref = r;
    if (ref.realId !== undefined) invoiceId = ref.realId;
  }
  const queueIt = async (): Promise<GameSessionOfflineAwareResult<T>> => {
    const op = await enqueue({
      type: "CloseGameSession",
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
        estimated: false,
        gameId: 0,
        gameSettingId: 0,
        hours: 0,
        numberOfPersons: 1,
        isDayPass: false,
        createdOn: op.queuedAt,
      },
    };
  };
  if (OFFLINE_MODE_ENABLED && invoiceId < 0) return queueIt();
  return runOfflineAware<T>(
    () =>
      post<T>(`/transactions/sessions/${invoiceId}/close`, null, {
        params: walletAmount ? { walletAmount } : undefined,
      }),
    queueIt,
  );
}

/**
 * The game sessions still waiting in the local queue, as placeholders the
 * page can list next to the live invoices. Returns [] when the flag is off
 * (the queue is never touched) or when IndexedDB is unavailable.
 */
export async function listQueuedGameSessions(): Promise<QueuedGameSessionPlaceholder[]> {
  if (!OFFLINE_MODE_ENABLED) return [];
  let ops: QueuedOp[];
  try {
    ops = await listQueuedOps();
  } catch {
    return [];
  }
  const closes = ops.filter((o) => o.type === "CloseGameSession");
  const creates = ops.filter((o) => o.type === "CreateGameSession");
  const out: QueuedGameSessionPlaceholder[] = [];
  for (const op of creates) {
    const payload = (op.payload ?? {}) as CreateGameSessionPayload;
    const est = await estimateGameSessionPrice(payload);
    const tempId = op.tempId ?? 0;
    const closeQueued = closes.some((c) => {
      const cp = (c.payload ?? {}) as { invoiceId?: number; invoiceOpId?: string | null };
      return cp.invoiceOpId === op.opId || (tempId < 0 && cp.invoiceId === tempId);
    });
    out.push({
      id: tempId,
      opId: op.opId,
      queued: true,
      statusId: closeQueued ? 6 : est.statusId,
      totalPrice: est.total,
      estimated: est.estimated,
      gameId: payload.gameId,
      gameName: est.gameName,
      gameSettingId: payload.gameSettingId,
      gameSettingName: est.settingName,
      hours: payload.hours,
      numberOfPersons: Math.max(1, payload.numberOfPersons ?? 1),
      isDayPass: payload.isDayPass ?? false,
      roomName: est.roomName,
      setId: payload.setId,
      setName: est.setName,
      discountId: payload.discountId || undefined,
      discountName: est.discountName,
      comment: payload.comment ?? null,
      createdOn: op.queuedAt,
      closeQueued,
      syncStatus: op.status,
      lastError: op.lastError ?? null,
    });
  }
  return out.sort((a, b) => b.createdOn.localeCompare(a.createdOn));
}
