import { useCallback, useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import Alert from "../../components/ui/alert/Alert";
import Loader from "../../components/ui/Loader";
import Modal from "../../components/ui/Modal";
import DeleteIconButton from "../../components/ui/DeleteIconButton";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../components/ui/table";
import { useOffline } from "../../offline/useOffline";
import { list, QueuedOp, remove } from "../../offline/queue";
import {
  getSnapshot,
  onSnapshotChange,
  refreshSnapshot,
  snapshotAgeMinutes,
  StoredSnapshot,
} from "../../offline/snapshot";

type Notice = { variant: "success" | "error" | "warning" | "info"; title: string; message: string };

function describe(op: QueuedOp): string {
  const p = (op.payload ?? {}) as Record<string, unknown>;
  const lines = (Array.isArray(p.itemsRequest) ? p.itemsRequest : []) as Array<{ itemId: number; quantity: number }>;
  const qty = lines.reduce((s, l) => s + (Number(l.quantity) || 0), 0);
  switch (op.type) {
    case "CreateCoffeeShopOrder":
      return `${p.isOpenInvoice ? "Open invoice" : "Paid order"} · ${lines.length} line${lines.length === 1 ? "" : "s"} (${qty} items)`;
    case "AddItemsToOpenInvoice":
      return `Add ${qty} item${qty === 1 ? "" : "s"} to invoice ${formatInvoice(p.invoiceId)}`;
    case "CloseOpenInvoice":
      return `Close invoice ${formatInvoice(p.invoiceId)}${Number(p.walletAmount) > 0 ? ` (wallet ${p.walletAmount})` : ""}`;
    default:
      return op.type;
  }
}

function formatInvoice(id: unknown): string {
  const n = Number(id);
  if (Number.isNaN(n)) return "?";
  return n < 0 ? `#offline-${Math.abs(n)}` : `#${n}`;
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

export default function OfflineStatus() {
  const { enabled, online, queueLength, syncing, lastSync, lastError, replayNow } = useOffline();
  const [ops, setOps] = useState<QueuedOp[]>([]);
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<StoredSnapshot | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [discardId, setDiscardId] = useState<string | null>(null);
  const [discarding, setDiscarding] = useState(false);

  const reload = useCallback(async () => {
    try {
      setOps(await list());
      setSnapshot(await getSnapshot());
    } catch (e) {
      setNotice({ variant: "error", title: "Local storage", message: (e as Error).message || "Could not read the offline queue." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload, queueLength, syncing]);

  useEffect(() => onSnapshotChange(setSnapshot), []);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(t);
  }, [notice]);

  const onRetry = async () => {
    const r = await replayNow();
    if (r.skipped === "offline") setNotice({ variant: "warning", title: "Still offline", message: "The orders will be sent as soon as the connection is back." });
    else if (r.skipped === "busy") setNotice({ variant: "info", title: "Syncing", message: "A sync is already running." });
    else if (r.skipped === "empty") setNotice({ variant: "info", title: "Nothing to send", message: "The queue is empty." });
    else if (r.failed > 0 && r.succeeded === 0) setNotice({ variant: "error", title: "Sync failed", message: `${r.failed} order(s) could not be sent.` });
    else if (r.failed > 0) setNotice({ variant: "warning", title: "Partly synced", message: `${r.succeeded} sent, ${r.failed} still failing.` });
    else if (r.succeeded > 0) setNotice({ variant: "success", title: "Synced", message: `${r.succeeded} order(s) sent to the server.` });
    await reload();
  };

  const onDiscard = async () => {
    if (!discardId) return;
    setDiscarding(true);
    try {
      await remove(discardId);
      setNotice({ variant: "success", title: "Discarded", message: "The queued operation was removed from this device." });
      setDiscardId(null);
      await reload();
    } catch (e) {
      setNotice({ variant: "error", title: "Discard failed", message: (e as Error).message || "Could not remove the operation." });
    } finally {
      setDiscarding(false);
    }
  };

  const onRefreshSnapshot = async () => {
    setRefreshing(true);
    try {
      const s = await refreshSnapshot();
      if (!s) setNotice({ variant: "warning", title: "Not signed in", message: "Sign in to download the menu snapshot." });
      else setNotice({ variant: "success", title: "Snapshot refreshed", message: `${s.data.items.length} items, ${s.data.categories.length} categories cached.` });
      setSnapshot(s);
    } catch (e) {
      const status = (e as { status?: number }).status;
      setNotice({
        variant: "error",
        title: "Refresh failed",
        message: status === 0 ? "Server unreachable — the cached copy is kept." : (e as { message?: string }).message || "Could not fetch the snapshot.",
      });
    } finally {
      setRefreshing(false);
    }
  };

  const age = snapshotAgeMinutes(snapshot);
  const failedCount = ops.filter((o) => o.status === "failed").length;

  return (
    <>
      <PageMeta title="Offline status | AXIS Admin" description="Queued orders and cached menu for the till when the internet is down." />
      <PageBreadcrumb pageTitle="Offline status" />

      {notice && (
        <div className="mb-4">
          <Alert variant={notice.variant} title={notice.title} message={notice.message} />
        </div>
      )}

      {!enabled && (
        <div className="mb-4">
          <Alert
            variant="info"
            title="Offline mode is disabled"
            message="Set VITE_ENABLE_OFFLINE_MODE=true at build time to queue orders during an internet cut. Nothing is cached on this device right now."
          />
        </div>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] text-gray-800 dark:text-white/90">
          <p className="text-sm text-gray-500 dark:text-gray-400">Connection</p>
          <p className={`mt-1 text-lg font-semibold ${online ? "text-success-600 dark:text-success-400" : "text-error-600 dark:text-error-400"}`}>
            {online ? "Online" : "Offline"}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Last sync: {formatTime(lastSync)}</p>
          {lastError && <p className="mt-1 text-xs text-error-600 dark:text-error-400">{lastError}</p>}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] text-gray-800 dark:text-white/90">
          <p className="text-sm text-gray-500 dark:text-gray-400">Queued operations</p>
          <p className="mt-1 text-lg font-semibold text-gray-800 dark:text-white/90">
            {queueLength}
            {failedCount > 0 && <span className="ml-2 text-sm font-normal text-error-600 dark:text-error-400">{failedCount} failing</span>}
          </p>
          <button
            type="button"
            onClick={() => void onRetry()}
            disabled={!enabled || syncing || queueLength === 0}
            className="mt-3 rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {syncing ? "Syncing…" : "Retry all now"}
          </button>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] text-gray-800 dark:text-white/90">
          <p className="text-sm text-gray-500 dark:text-gray-400">Menu snapshot</p>
          {snapshot ? (
            <>
              <p className="mt-1 text-lg font-semibold text-gray-800 dark:text-white/90">
                {age === null ? "cached" : age < 1 ? "just now" : `${age} min old`}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                v{snapshot.data.version} · {snapshot.data.items.length} items · {snapshot.data.categories.length} categories · {snapshot.data.discounts.length} discounts
              </p>
            </>
          ) : (
            <p className="mt-1 text-lg font-semibold text-gray-400">Not cached</p>
          )}
          <button
            type="button"
            onClick={() => void onRefreshSnapshot()}
            disabled={refreshing || !online}
            className="mt-3 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/5"
          >
            {refreshing ? "Refreshing…" : "Refresh snapshot"}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] text-gray-800 dark:text-white/90">
        <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Queued orders</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">Sent in order, oldest first. Each is applied exactly once on the server even if it is retried.</p>
        </div>
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader />
          </div>
        ) : ops.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-gray-500 dark:text-gray-400">No queued operations on this device.</p>
        ) : (
          <div className="max-w-full overflow-x-auto">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <TableCell isHeader className="px-5 py-3 text-start text-xs font-medium text-gray-500 dark:text-gray-400">Queued</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start text-xs font-medium text-gray-500 dark:text-gray-400">Operation</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start text-xs font-medium text-gray-500 dark:text-gray-400">Status</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start text-xs font-medium text-gray-500 dark:text-gray-400">Attempts</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-end text-xs font-medium text-gray-500 dark:text-gray-400">Actions</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {ops.map((op) => (
                  <TableRow key={op.opId}>
                    <TableCell className="px-5 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {formatTime(op.queuedAt)}
                      {op.tempId !== undefined && op.type === "CreateCoffeeShopOrder" && (
                        <span className="ml-2 text-xs text-gray-400">{formatInvoice(op.tempId)}</span>
                      )}
                    </TableCell>
                    <TableCell className="px-5 py-3 text-sm text-gray-800 dark:text-white/90">{describe(op)}</TableCell>
                    <TableCell className="px-5 py-3 text-sm">
                      {op.status === "failed" ? (
                        <span className="inline-flex flex-col">
                          <span className="rounded-full bg-error-50 px-2 py-0.5 text-xs font-medium text-error-700 dark:bg-error-500/15 dark:text-error-400">
                            {op.lastStatus === 409 ? "Conflict" : "Failed"}
                          </span>
                          {op.lastError && <span className="mt-1 max-w-xs truncate text-xs text-gray-500 dark:text-gray-400" title={op.lastError}>{op.lastError}</span>}
                        </span>
                      ) : (
                        <span className="rounded-full bg-warning-50 px-2 py-0.5 text-xs font-medium text-warning-700 dark:bg-warning-500/15 dark:text-warning-400">
                          {syncing ? "Syncing" : "Pending"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="px-5 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {op.attempts}
                      {op.lastTriedAt && <span className="ml-1 text-xs text-gray-400">({formatTime(op.lastTriedAt)})</span>}
                    </TableCell>
                    <TableCell className="px-5 py-3 text-end">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => void onRetry()}
                          disabled={!enabled || syncing || !online}
                          className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/5"
                        >
                          Retry
                        </button>
                        <DeleteIconButton title="Discard" onClick={() => setDiscardId(op.opId)} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Modal isOpen={discardId !== null} onClose={() => (discarding ? undefined : setDiscardId(null))} title="Discard queued operation?">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          This removes the operation from this device only. If it was never sent, the order will not exist on the server.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setDiscardId(null)}
            disabled={discarding}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-200"
          >
            Keep
          </button>
          <button
            type="button"
            onClick={() => void onDiscard()}
            disabled={discarding}
            className="rounded-lg bg-error-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-error-600 disabled:opacity-50"
          >
            {discarding ? "Discarding…" : "Discard"}
          </button>
        </div>
      </Modal>
    </>
  );
}
