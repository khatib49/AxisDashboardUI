import { useOffline } from "../../offline/useOffline";

/**
 * Thin status strip for the layout. Renders nothing when offline mode is
 * disabled, or when online with an empty queue and nothing syncing.
 */
export default function OfflineBanner() {
  const { enabled, online, queueLength, syncing, lastError, replayNow } = useOffline();

  if (!enabled) return null;
  if (online && queueLength === 0 && !syncing) return null;

  const orders = `${queueLength} ${queueLength === 1 ? "order" : "orders"}`;

  let tone = "bg-warning-50 text-warning-700 border-warning-500 dark:bg-warning-500/15 dark:text-warning-400";
  let text: string;
  if (!online) {
    tone = "bg-error-50 text-error-700 border-error-500 dark:bg-error-500/15 dark:text-error-400";
    text = queueLength > 0 ? `Offline — ${orders} queued` : "Offline — orders will be queued";
  } else if (syncing) {
    tone = "bg-blue-light-50 text-blue-light-700 border-blue-light-500 dark:bg-blue-light-500/15 dark:text-blue-light-400";
    text = `Syncing… ${orders} queued`;
  } else {
    text = lastError ? `${orders} waiting to sync — ${lastError}` : `${orders} waiting to sync`;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center justify-between gap-3 border-b px-4 py-2 text-sm ${tone}`}
    >
      <span className="flex items-center gap-2">
        <span
          className={`inline-block h-2 w-2 rounded-full ${online ? (syncing ? "animate-pulse bg-blue-light-500" : "bg-warning-500") : "bg-error-500"}`}
        />
        {text}
      </span>
      {online && !syncing && queueLength > 0 && (
        <button
          type="button"
          onClick={() => void replayNow()}
          className="rounded-md border border-current px-2 py-0.5 text-xs font-medium hover:opacity-80"
        >
          Sync now
        </button>
      )}
    </div>
  );
}
