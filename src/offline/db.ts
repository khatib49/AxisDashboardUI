/**
 * Tiny promise wrapper over the native IndexedDB API (no dependency).
 * Database "axis-offline", stores:
 *   - "queue"    keyPath "opId"  : queued operations waiting for replay
 *   - "snapshot" keyPath "key"   : cached menu bundle + small metadata
 * Every call degrades to a rejected promise when IndexedDB is unavailable
 * (private mode, old WebView); callers treat that as "no offline support".
 */

export const OFFLINE_DB_NAME = "axis-offline";
export const OFFLINE_DB_VERSION = 1;
export type OfflineStore = "queue" | "snapshot";

let dbPromise: Promise<IDBDatabase> | null = null;

export function isIndexedDbAvailable(): boolean {
  try {
    return typeof indexedDB !== "undefined" && indexedDB !== null;
  } catch {
    return false;
  }
}

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (!isIndexedDbAvailable()) {
      reject(new Error("IndexedDB is not available in this browser."));
      return;
    }
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)));
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("queue")) {
        const queue = db.createObjectStore("queue", { keyPath: "opId" });
        queue.createIndex("queuedAt", "queuedAt", { unique: false });
      }
      if (!db.objectStoreNames.contains("snapshot")) {
        db.createObjectStore("snapshot", { keyPath: "key" });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      // If another tab upgrades the schema, drop our handle so the next call reopens.
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => reject(req.error ?? new Error("Could not open the offline database."));
    req.onblocked = () => reject(new Error("The offline database is blocked by another tab."));
  });
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

function run<T>(
  store: OfflineStore,
  mode: IDBTransactionMode,
  op: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        let tx: IDBTransaction;
        try {
          tx = db.transaction(store, mode);
        } catch (e) {
          reject(e instanceof Error ? e : new Error(String(e)));
          return;
        }
        const req = op(tx.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error(`IndexedDB ${mode} on "${store}" failed.`));
        tx.onabort = () => reject(tx.error ?? new Error(`IndexedDB transaction on "${store}" aborted.`));
      }),
  );
}

export function dbGet<T>(store: OfflineStore, key: IDBValidKey): Promise<T | undefined> {
  return run<T | undefined>(store, "readonly", (s) => s.get(key) as IDBRequest<T | undefined>);
}

export function dbGetAll<T>(store: OfflineStore): Promise<T[]> {
  return run<T[]>(store, "readonly", (s) => s.getAll() as IDBRequest<T[]>);
}

export function dbPut<T>(store: OfflineStore, value: T): Promise<IDBValidKey> {
  return run<IDBValidKey>(store, "readwrite", (s) => s.put(value));
}

export function dbDelete(store: OfflineStore, key: IDBValidKey): Promise<void> {
  return run<undefined>(store, "readwrite", (s) => s.delete(key)).then(() => undefined);
}

export function dbClear(store: OfflineStore): Promise<void> {
  return run<undefined>(store, "readwrite", (s) => s.clear()).then(() => undefined);
}

export function dbCount(store: OfflineStore): Promise<number> {
  return run<number>(store, "readonly", (s) => s.count());
}
