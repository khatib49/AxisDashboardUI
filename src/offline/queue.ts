import { dbDelete, dbGet, dbGetAll, dbPut } from "./db";
import { getOfflineClientId, newUuid, OFFLINE_MODE_ENABLED } from "./flags";
import {
  OfflineOpResult,
  OfflineOpType,
  syncOfflineOps,
} from "../services/offlineService";

export type QueuedOpStatus = "pending" | "syncing" | "failed";

export interface QueuedOp {
  opId: string;
  type: OfflineOpType;
  payload: unknown;
  queuedAt: string; // ISO
  /** Negative placeholder id handed to the UI for an order created offline. */
  tempId?: number;
  attempts: number;
  status: QueuedOpStatus;
  lastError?: string | null;
  lastStatus?: number | null;
  lastTriedAt?: string | null;
}

export interface ReplayResult {
  attempted: number;
  succeeded: number;
  failed: number;
  conflicts: number;
  /** Server results for ops that succeeded in this replay (opId -> result). */
  results: OfflineOpResult[];
  skipped?: "offline" | "backoff" | "busy" | "empty" | "disabled";
}

export interface QueueState {
  queueLength: number;
  syncing: boolean;
  lastSync: string | null; // ISO of the last successful contact with /offline/sync
  lastError: string | null;
}

export const SYNC_BATCH_SIZE = 20;
export const SYNC_INTERVAL_MS = 30_000;
const BACKOFF_BASE_MS = 5_000;
const BACKOFF_MAX_MS = 10 * 60_000;
const LAST_SYNC_KEY = "axis_offline_last_sync";

type Listener = (state: QueueState) => void;
const listeners = new Set<Listener>();

let state: QueueState = {
  queueLength: 0,
  syncing: false,
  lastSync: readLastSync(),
  lastError: null,
};
let consecutiveFailures = 0;
let nextAllowedAt = 0;
let workerStarted = false;
let intervalHandle: number | null = null;

function readLastSync(): string | null {
  try {
    return localStorage.getItem(LAST_SYNC_KEY);
  } catch {
    return null;
  }
}

function setState(patch: Partial<QueueState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l(state));
}

export function getQueueState(): QueueState {
  return state;
}

export function subscribeQueue(l: Listener): () => void {
  listeners.add(l);
  l(state);
  return () => listeners.delete(l);
}

let tempCounter = 0;
function nextTempId(): number {
  // Negative and inside int32 (the server's invoiceId is an int), unique per
  // browser session; never collides with a server id.
  tempCounter = (tempCounter + 1) % 1000;
  return -((Date.now() % 1_000_000) * 1000 + tempCounter + 1);
}

// ---- tempId -> real id map (survives the create op leaving the queue) ----

interface TempIdMap {
  key: "idmap";
  map: Record<string, { opId: string; id: number }>;
}

async function readIdMap(): Promise<TempIdMap> {
  try {
    return (await dbGet<TempIdMap>("snapshot", "idmap")) ?? { key: "idmap", map: {} };
  } catch {
    return { key: "idmap", map: {} };
  }
}

async function rememberRealId(tempId: number, opId: string, id: number): Promise<void> {
  try {
    const m = await readIdMap();
    m.map[String(tempId)] = { opId, id };
    // keep the map small: drop the oldest entries past 500
    const keys = Object.keys(m.map);
    if (keys.length > 500) for (const k of keys.slice(0, keys.length - 500)) delete m.map[k];
    await dbPut("snapshot", m);
  } catch {
    /* best effort */
  }
}

/**
 * For a negative placeholder id: the real server id once the create op has
 * synced, or the opId of the still-queued create op. Null when unknown.
 */
export async function resolveTempInvoice(tempId: number): Promise<{ realId?: number; opId?: string } | null> {
  if (tempId >= 0) return { realId: tempId };
  const m = await readIdMap();
  const hit = m.map[String(tempId)];
  if (hit) return { realId: hit.id, opId: hit.opId };
  const create = await findByTempId(tempId);
  return create ? { opId: create.opId } : null;
}

/** Persist a new operation. Returns the stored op (with opId / tempId). */
export async function enqueue(op: {
  type: OfflineOpType;
  payload: unknown;
  tempId?: number;
}): Promise<QueuedOp> {
  const queued: QueuedOp = {
    opId: newUuid(),
    type: op.type,
    payload: op.payload,
    queuedAt: new Date().toISOString(),
    tempId: op.tempId ?? (op.type === "CreateCoffeeShopOrder" ? nextTempId() : undefined),
    attempts: 0,
    status: "pending",
    lastError: null,
    lastStatus: null,
    lastTriedAt: null,
  };
  await dbPut("queue", queued);
  await refreshQueueLength();
  scheduleSoon();
  return queued;
}

export async function list(): Promise<QueuedOp[]> {
  try {
    const all = await dbGetAll<QueuedOp>("queue");
    return all.sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
  } catch {
    return [];
  }
}

export async function remove(opId: string): Promise<void> {
  await dbDelete("queue", opId);
  await refreshQueueLength();
}

/** Find the queued CREATE op that produced a given negative placeholder id. */
export async function findByTempId(tempId: number): Promise<QueuedOp | undefined> {
  const all = await list();
  return all.find((o) => o.type === "CreateCoffeeShopOrder" && o.tempId === tempId);
}

export async function refreshQueueLength(): Promise<number> {
  const n = (await list()).length;
  setState({ queueLength: n });
  return n;
}

function isOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

function isNetworkFailure(e: unknown): boolean {
  const status = (e as { status?: number } | null)?.status;
  return status === 0 || status === undefined;
}

/**
 * POST the queue to /api/offline/sync in batches of SYNC_BATCH_SIZE.
 * Succeeded / replayed ops are removed; failed ops stay with their error;
 * conflicts (409) stay marked "failed" so the cashier can discard them.
 * `force` ignores the exponential backoff (used by the "Retry now" button).
 */
export async function replay(opts: { force?: boolean } = {}): Promise<ReplayResult> {
  const empty: ReplayResult = { attempted: 0, succeeded: 0, failed: 0, conflicts: 0, results: [] };
  if (!OFFLINE_MODE_ENABLED) return { ...empty, skipped: "disabled" };
  if (state.syncing) return { ...empty, skipped: "busy" };
  if (!isOnline()) return { ...empty, skipped: "offline" };
  if (!opts.force && Date.now() < nextAllowedAt) return { ...empty, skipped: "backoff" };

  const pending = await list();
  if (pending.length === 0) return { ...empty, skipped: "empty" };

  setState({ syncing: true, lastError: null });
  const summary: ReplayResult = { attempted: 0, succeeded: 0, failed: 0, conflicts: 0, results: [] };
  const clientId = getOfflineClientId();

  try {
    for (let i = 0; i < pending.length; i += SYNC_BATCH_SIZE) {
      const batch = pending.slice(i, i + SYNC_BATCH_SIZE);
      summary.attempted += batch.length;

      let response;
      try {
        response = await syncOfflineOps({
          clientId,
          ops: batch.map((o) => ({ opId: o.opId, type: o.type, payload: o.payload, queuedAt: o.queuedAt })),
        });
      } catch (e) {
        // Whole-batch transport failure: nothing was acknowledged, keep everything.
        consecutiveFailures += 1;
        nextAllowedAt = Date.now() + Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** (consecutiveFailures - 1));
        const msg = isNetworkFailure(e)
          ? "Server unreachable"
          : (e as { message?: string })?.message || "Sync failed";
        setState({ lastError: msg });
        summary.failed += batch.length;
        return summary;
      }

      const byId = new Map(response.results.map((r) => [r.opId, r]));
      const now = new Date().toISOString();
      for (const op of batch) {
        const r = byId.get(op.opId);
        if (!r) {
          // Not acknowledged (should not happen): keep as pending.
          continue;
        }
        if (r.outcome === "ok" || r.outcome === "replayed") {
          summary.succeeded += 1;
          summary.results.push(r);
          if (op.type === "CreateCoffeeShopOrder" && op.tempId !== undefined) {
            const id = (r.result as { data?: { id?: unknown } } | undefined)?.data?.id;
            if (typeof id === "number" && id > 0) await rememberRealId(op.tempId, op.opId, id);
          }
          await dbDelete("queue", op.opId);
        } else {
          if (r.outcome === "conflict") summary.conflicts += 1;
          summary.failed += 1;
          await dbPut("queue", {
            ...op,
            attempts: op.attempts + 1,
            status: "failed",
            lastError: r.error ?? `Failed (${r.status})`,
            lastStatus: r.status,
            lastTriedAt: now,
          } satisfies QueuedOp);
        }
      }
      consecutiveFailures = 0;
      nextAllowedAt = 0;
      const stamp = new Date().toISOString();
      try {
        localStorage.setItem(LAST_SYNC_KEY, stamp);
      } catch {
        /* ignore */
      }
      setState({ lastSync: stamp });
    }
    return summary;
  } finally {
    setState({ syncing: false });
    await refreshQueueLength();
  }
}

function scheduleSoon() {
  if (!OFFLINE_MODE_ENABLED || !workerStarted) return;
  window.setTimeout(() => {
    void replay();
  }, 500);
}

/**
 * Starts the background worker (idempotent): replays on window "online" and
 * every 30 s while online and the queue is non-empty. Safe to call from any
 * component; does nothing when the flag is off.
 */
export function startQueueWorker(): () => void {
  if (!OFFLINE_MODE_ENABLED || typeof window === "undefined") return () => undefined;
  if (workerStarted) return () => undefined;
  workerStarted = true;

  const onOnline = () => {
    consecutiveFailures = 0;
    nextAllowedAt = 0;
    void replay({ force: true });
  };
  window.addEventListener("online", onOnline);

  intervalHandle = window.setInterval(() => {
    if (isOnline() && state.queueLength > 0) void replay();
  }, SYNC_INTERVAL_MS);

  void refreshQueueLength().then((n) => {
    if (n > 0 && isOnline()) void replay();
  });

  return () => {
    window.removeEventListener("online", onOnline);
    if (intervalHandle !== null) window.clearInterval(intervalHandle);
    intervalHandle = null;
    workerStarted = false;
  };
}
