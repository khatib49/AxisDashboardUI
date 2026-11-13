import { dbGet, dbPut } from "./db";
import { fetchOfflineSnapshot, OfflineSnapshotDto } from "../services/offlineService";
import { OFFLINE_MODE_ENABLED } from "./flags";

export interface StoredSnapshot {
  key: "current";
  fetchedAt: string; // ISO
  data: OfflineSnapshotDto;
}

const SNAPSHOT_KEY = "current";
type Listener = (snap: StoredSnapshot | null) => void;
const listeners = new Set<Listener>();

function hasToken(): boolean {
  try {
    return !!localStorage.getItem("access_token");
  } catch {
    return false;
  }
}

/** GET /api/offline/snapshot and persist it. No-op (returns null) without a token. */
export async function refreshSnapshot(): Promise<StoredSnapshot | null> {
  if (!hasToken()) return null;
  const data = await fetchOfflineSnapshot();
  const stored: StoredSnapshot = { key: SNAPSHOT_KEY, fetchedAt: new Date().toISOString(), data };
  try {
    await dbPut("snapshot", stored);
  } catch {
    /* no IndexedDB: the SW runtime cache still covers the GET */
  }
  listeners.forEach((l) => l(stored));
  return stored;
}

export async function getSnapshot(): Promise<StoredSnapshot | null> {
  try {
    return (await dbGet<StoredSnapshot>("snapshot", SNAPSHOT_KEY)) ?? null;
  } catch {
    return null;
  }
}

export function onSnapshotChange(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Age in minutes, or null when nothing is cached. */
export function snapshotAgeMinutes(snap: StoredSnapshot | null): number | null {
  if (!snap) return null;
  const t = Date.parse(snap.fetchedAt);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.round((Date.now() - t) / 60000));
}

/** Refresh when the cached copy is older than `maxAgeMinutes` (default 30). */
export async function ensureFreshSnapshot(maxAgeMinutes = 30): Promise<StoredSnapshot | null> {
  if (!OFFLINE_MODE_ENABLED) return null;
  const current = await getSnapshot();
  const age = snapshotAgeMinutes(current);
  if (current && age !== null && age < maxAgeMinutes) return current;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return current;
  try {
    return await refreshSnapshot();
  } catch {
    return current;
  }
}
