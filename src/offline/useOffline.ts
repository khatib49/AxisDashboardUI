import { useCallback, useEffect, useState } from "react";
import { OFFLINE_MODE_ENABLED } from "./flags";
import { getQueueState, QueueState, replay, ReplayResult, startQueueWorker, subscribeQueue } from "./queue";
import { ensureFreshSnapshot } from "./snapshot";

export interface OfflineStatus {
  /** Feature flag (VITE_ENABLE_OFFLINE_MODE === "true"). */
  enabled: boolean;
  online: boolean;
  queueLength: number;
  syncing: boolean;
  lastSync: string | null;
  lastError: string | null;
  /** Force a replay now, ignoring backoff. */
  replayNow: () => Promise<ReplayResult>;
}

function readOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

/**
 * Live view of connectivity + the local queue. Mounting it (anywhere) also
 * starts the background replay worker when the flag is on.
 */
export function useOffline(): OfflineStatus {
  const [online, setOnline] = useState<boolean>(readOnline);
  const [queue, setQueue] = useState<QueueState>(getQueueState);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  useEffect(() => {
    if (!OFFLINE_MODE_ENABLED) return;
    startQueueWorker();
    // The hook is mounted inside the signed-in layout, so a token exists:
    // warm the menu snapshot (no-op when fresh or offline).
    void ensureFreshSnapshot();
    return subscribeQueue(setQueue);
  }, []);

  const replayNow = useCallback(() => replay({ force: true }), []);

  return {
    enabled: OFFLINE_MODE_ENABLED,
    online,
    queueLength: queue.queueLength,
    syncing: queue.syncing,
    lastSync: queue.lastSync,
    lastError: queue.lastError,
    replayNow,
  };
}
