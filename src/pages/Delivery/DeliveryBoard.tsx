import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import Modal from "../../components/ui/Modal";
import Loader from "../../components/ui/Loader";
import Alert from "../../components/ui/alert/Alert";
import {
  advanceOrder,
  allowedNext,
  assignDriver,
  cancelOrder,
  DELIVERY_STATUSES,
  DeliveryBoardDto,
  DeliveryOrderDto,
  DeliveryStatus,
  DeliveryTodayStatsDto,
  DriverDto,
  getDeliveryBoard,
  getDrivers,
  getTodayStats,
  isTerminal,
} from "../../services/deliveryService";

const POLL_MS = 10_000;

const STATUS_LABEL: Record<DeliveryStatus, string> = {
  Pending: "Pending",
  Preparing: "Preparing",
  Ready: "Ready",
  OutForDelivery: "Out for delivery",
  Delivered: "Delivered",
  Cancelled: "Cancelled",
};

const STATUS_COLOR: Record<DeliveryStatus, string> = {
  Pending: "border-amber-400",
  Preparing: "border-blue-400",
  Ready: "border-violet-400",
  OutForDelivery: "border-cyan-400",
  Delivered: "border-green-500",
  Cancelled: "border-gray-400",
};

const money = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : "0.00");
const clock = (s?: string | null) =>
  s ? new Date(s).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
const errMsg = (e: unknown) => (e as { message?: string })?.message || "Request failed";

export default function DeliveryBoard() {
  const [board, setBoard] = useState<DeliveryBoardDto | null>(null);
  const [stats, setStats] = useState<DeliveryTodayStatsDto | null>(null);
  const [drivers, setDrivers] = useState<DriverDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [selected, setSelected] = useState<DeliveryOrderDto | null>(null);
  const [cancelTarget, setCancelTarget] = useState<DeliveryOrderDto | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [notification, setNotification] = useState<{ variant: "success" | "error" | "warning" | "info"; title: string; message: string } | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    if (!notification) return;
    const t = setTimeout(() => setNotification(null), 4000);
    return () => clearTimeout(t);
  }, [notification]);

  const refresh = useCallback(async (silent = true) => {
    if (!silent) setLoading(true);
    try {
      const [b, s] = await Promise.all([getDeliveryBoard(), getTodayStats().catch(() => null)]);
      if (!mounted.current) return;
      setBoard(b);
      setStats(s);
      setError(null);
    } catch (e) {
      if (!mounted.current) return;
      setError(errMsg(e));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    refresh(false);
    getDrivers().then((d) => mounted.current && setDrivers(d)).catch(() => { /* drivers optional */ });
    const t = setInterval(() => refresh(true), POLL_MS);
    return () => {
      mounted.current = false;
      clearInterval(t);
    };
  }, [refresh]);

  const patchOrder = (o: DeliveryOrderDto) => {
    setBoard((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        columns: prev.columns.map((c) => ({
          ...c,
          orders: c.orders.filter((x) => x.id !== o.id).concat(c.status === o.status ? [o] : []),
        })),
      };
    });
    setSelected((s) => (s && s.id === o.id ? o : s));
  };

  const run = async (id: number, fn: () => Promise<DeliveryOrderDto>, okMsg: string) => {
    setBusyId(id);
    try {
      const o = await fn();
      patchOrder(o);
      setNotification({ variant: "success", title: "Done", message: okMsg });
      getTodayStats().then((s) => mounted.current && setStats(s)).catch(() => undefined);
    } catch (e) {
      setNotification({ variant: "error", title: "Error", message: errMsg(e) });
    } finally {
      setBusyId(null);
    }
  };

  const onAdvance = (o: DeliveryOrderDto, to: DeliveryStatus) =>
    run(o.id, () => advanceOrder(o.id, to), `#${o.id} → ${STATUS_LABEL[to]}`);
  const onAssign = (o: DeliveryOrderDto, driverId: number) =>
    run(o.id, () => assignDriver(o.id, driverId), `Driver assigned to #${o.id}`);
  const onCancelConfirm = async () => {
    if (!cancelTarget) return;
    const t = cancelTarget;
    setCancelTarget(null);
    await run(t.id, () => cancelOrder(t.id, cancelReason), `#${t.id} cancelled`);
    setCancelReason("");
  };

  const columns = useMemo(() => {
    const visible = showDone ? DELIVERY_STATUSES : DELIVERY_STATUSES.filter((s) => !isTerminal(s));
    return visible.map((status) => ({
      status,
      orders: board?.columns.find((c) => c.status === status)?.orders ?? [],
    }));
  }, [board, showDone]);

  const totalActive = columns.filter((c) => !isTerminal(c.status)).reduce((n, c) => n + c.orders.length, 0);

  return (
    <div>
      <PageMeta title="Delivery & Takeaway | Axis" description="Delivery and takeaway order board" />
      <PageBreadcrumb pageTitle="Delivery & Takeaway board" />

      {notification && (
        <div className="mb-4">
          <Alert variant={notification.variant} title={notification.title} message={notification.message} />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap gap-2 text-sm">
          <Stat label="Today" value={stats?.total ?? 0} />
          <Stat label="Active" value={totalActive} />
          <Stat label="Delivered" value={stats?.delivered ?? 0} />
          <Stat label="Cancelled" value={stats?.cancelled ?? 0} />
          <Stat label="Revenue" value={money(stats?.revenue ?? 0)} />
          <Stat label="Fees" value={money(stats?.fees ?? 0)} />
          <Stat label="Avg min" value={stats?.avgMinutesToDelivered ?? "—"} />
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
            Show delivered / cancelled
          </label>
          <button onClick={() => refresh(false)} className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
            Refresh
          </button>
          <Link to="/delivery/new" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
            + New order
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-4">
          <Alert variant="error" title="Could not load the board" message={error} />
        </div>
      )}

      {loading && !board ? (
        <div className="flex items-center gap-2 p-6 text-gray-500"><Loader /> Loading…</div>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
          {columns.map((col) => (
            <div key={col.status} className={`rounded-xl border-t-4 ${STATUS_COLOR[col.status]} bg-gray-50 dark:bg-white/[0.03] p-3 min-h-[200px]`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-800 dark:text-white/90">{STATUS_LABEL[col.status]}</h3>
                <span className="px-2 py-0.5 text-xs rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200">{col.orders.length}</span>
              </div>
              {col.orders.length === 0 && <p className="text-xs text-gray-400 py-4 text-center">No orders</p>}
              <div className="space-y-3">
                {col.orders.map((o) => (
                  <OrderCard
                    key={o.id}
                    order={o}
                    drivers={drivers}
                    busy={busyId === o.id}
                    onOpen={() => setSelected(o)}
                    onAdvance={(to) => onAdvance(o, to)}
                    onAssign={(d) => onAssign(o, d)}
                    onCancel={() => { setCancelReason(""); setCancelTarget(o); }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title={selected ? `Order #${selected.id} — ${selected.customerName}` : ""}>
        {selected && <OrderDetails order={selected} />}
      </Modal>

      <Modal
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        title={cancelTarget ? `Cancel order #${cancelTarget.id}?` : ""}
        className="max-w-md"
        footer={
          <>
            <button onClick={() => setCancelTarget(null)} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700">Keep</button>
            <button onClick={onCancelConfirm} className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700">Cancel order</button>
          </>
        }
      >
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">The open invoice stays on the till; close or void it there as usual.</p>
        <input
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          placeholder="Reason (optional)"
          className="h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 px-4 text-sm dark:bg-gray-900 dark:text-white/90"
        />
      </Modal>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="px-3 py-1.5 rounded-lg bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800">
      <span className="text-gray-500 dark:text-gray-400 mr-1">{label}</span>
      <span className="font-semibold text-gray-800 dark:text-white/90">{value}</span>
    </div>
  );
}

function OrderCard({
  order: o, drivers, busy, onOpen, onAdvance, onAssign, onCancel,
}: {
  order: DeliveryOrderDto;
  drivers: DriverDto[];
  busy: boolean;
  onOpen: () => void;
  onAdvance: (to: DeliveryStatus) => void;
  onAssign: (driverId: number) => void;
  onCancel: () => void;
}) {
  const next = allowedNext(o.type, o.status);
  const terminal = isTerminal(o.status);
  const needsDriver = o.type === "Delivery" && !terminal;
  return (
    <div className="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <button onClick={onOpen} className="text-left">
          <div className="font-semibold text-gray-800 dark:text-white/90">#{o.id} · {o.customerName}</div>
          <div className="text-xs text-gray-500">{clock(o.createdOn)} · {o.items.length} item{o.items.length === 1 ? "" : "s"} · {money(o.total)}</div>
        </button>
        <span className={`px-2 py-0.5 text-[11px] rounded-full ${o.type === "Delivery" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"}`}>
          {o.type}
        </span>
      </div>
      {o.type === "Delivery" && (
        <div className="mt-1 text-xs text-gray-600 dark:text-gray-300 truncate" title={o.address ?? ""}>
          {o.zoneName ? `${o.zoneName} · ` : ""}{o.address || "No address"}
        </div>
      )}
      {o.phone && <div className="text-xs text-gray-500">{o.phone}</div>}
      {(o.externalSource || o.channelName) && (
        <div className="text-[11px] text-gray-500 mt-0.5">
          {o.channelName ?? o.externalSource}{o.externalRef ? ` #${o.externalRef}` : ""}
        </div>
      )}
      {o.invoicePaid && <div className="text-[11px] text-green-600 mt-0.5">Invoice paid</div>}

      {needsDriver && (
        <select
          disabled={busy}
          value={o.driverId ?? ""}
          onChange={(e) => e.target.value && onAssign(Number(e.target.value))}
          className="mt-2 h-9 w-full rounded-lg border border-gray-300 dark:border-gray-700 px-2 text-xs dark:bg-gray-800 dark:text-white/90"
        >
          <option value="">{o.driverName ? `Driver: ${o.driverName}` : "Assign driver…"}</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>{d.name}{d.phone ? ` (${d.phone})` : ""}</option>
          ))}
        </select>
      )}

      {!terminal && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {next.map((to) => (
            <button
              key={to}
              disabled={busy}
              onClick={() => onAdvance(to)}
              className="px-2.5 py-1 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {busy ? "…" : STATUS_LABEL[to]}
            </button>
          ))}
          <button disabled={busy} onClick={onCancel} className="px-2.5 py-1 text-xs rounded-md border border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50">
            Cancel
          </button>
        </div>
      )}
      {o.status === "Cancelled" && o.cancelledReason && <div className="mt-1 text-xs text-gray-500 italic">{o.cancelledReason}</div>}
    </div>
  );
}

function OrderDetails({ order: o }: { order: DeliveryOrderDto }) {
  return (
    <div className="space-y-4 text-sm text-gray-700 dark:text-gray-200">
      <div className="grid grid-cols-2 gap-x-6 gap-y-1">
        <Row k="Type" v={o.type} /><Row k="Status" v={STATUS_LABEL[o.status]} />
        <Row k="Phone" v={o.phone || "—"} /><Row k="Invoice" v={`#${o.transactionId}${o.invoicePaid ? " (paid)" : " (open)"}`} />
        <Row k="Zone" v={o.zoneName || "—"} /><Row k="Driver" v={o.driverName || "—"} />
        <Row k="Channel" v={o.channelName || o.externalSource || "Till"} /><Row k="Created by" v={o.createdBy} />
        <Row k="Scheduled" v={o.scheduledFor ? new Date(o.scheduledFor).toLocaleString() : "ASAP"} /><Row k="Created" v={new Date(o.createdOn).toLocaleString()} />
      </div>
      {o.address && <div><span className="text-gray-500">Address:</span> {o.address}</div>}
      {o.notes && <div><span className="text-gray-500">Notes:</span> {o.notes}</div>}
      <table className="w-full text-sm">
        <thead><tr className="text-left text-gray-500"><th className="py-1">Item</th><th className="py-1 text-right">Qty</th><th className="py-1 text-right">Line</th></tr></thead>
        <tbody>
          {o.items.map((l) => (
            <tr key={l.itemId} className="border-t border-gray-100 dark:border-gray-800">
              <td className="py-1">{l.itemName}</td><td className="py-1 text-right">{l.quantity}</td><td className="py-1 text-right">{money(l.lineTotal)}</td>
            </tr>
          ))}
          <tr className="border-t border-gray-200 dark:border-gray-700"><td className="py-1" colSpan={2}>Invoice subtotal</td><td className="py-1 text-right">{money(o.subtotal)}</td></tr>
          <tr><td className="py-1" colSpan={2}>Delivery fee</td><td className="py-1 text-right">{money(o.deliveryFee)}</td></tr>
          <tr className="font-semibold"><td className="py-1" colSpan={2}>Total to collect</td><td className="py-1 text-right">{money(o.total)}</td></tr>
        </tbody>
      </table>
      <div>
        <div className="text-gray-500 mb-1">History</div>
        <ul className="space-y-0.5 text-xs">
          {o.events.map((e) => (
            <li key={e.id}>{clock(e.on)} · {e.fromStatus ? `${e.fromStatus} → ` : ""}{e.toStatus} · {e.by}{e.note ? ` — ${e.note}` : ""}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div><span className="text-gray-500">{k}:</span> {v}</div>;
}
