import type { OnlineOrderDto } from "../../services/shopService";

export type OrderStep = { key: string; label: string; at?: string | null };

/** Status steps for a customer order; cancelled orders show a single red terminal state. */
export function orderSteps(o: OnlineOrderDto): { steps: OrderStep[]; current: number; cancelled: boolean } {
  const delivery = o.fulfilment === "Delivery";
  const online = o.paymentMode === "Online";
  const steps: OrderStep[] = [{ key: "placed", label: "Placed", at: o.createdOn }];
  if (online) steps.push({ key: "paid", label: "Paid", at: o.paidOn });
  steps.push({ key: "accepted", label: "Accepted", at: o.acceptedOn });
  if (delivery) {
    steps.push({ key: "shipped", label: "Shipped", at: o.shippedOn });
    steps.push({ key: "delivered", label: "Delivered", at: o.deliveredOn ?? o.completedOn });
  } else {
    steps.push({ key: "ready", label: "Ready for pickup", at: o.readyOn });
    steps.push({ key: "completed", label: "Picked up", at: o.completedOn });
  }
  const idx = (k: string) => steps.findIndex((s) => s.key === k);
  const map: Record<string, number> = {
    New: idx("placed"), AwaitingPayment: idx("placed"), Paid: online ? idx("paid") : idx("placed"),
    Accepted: idx("accepted"), Ready: idx("ready"), Shipped: idx("shipped"),
    Delivered: idx("delivered"), Completed: delivery ? idx("delivered") : idx("completed"),
  };
  return { steps, current: map[o.status] ?? 0, cancelled: o.status === "Cancelled" };
}

export const statusLabel = (s: string) => ({
  New: "Waiting for the shop", AwaitingPayment: "Awaiting payment", Paid: "Paid", Accepted: "Being prepared",
  Ready: "Ready for pickup", Shipped: "On its way", Delivered: "Delivered", Completed: "Completed", Cancelled: "Cancelled",
} as Record<string, string>)[s] ?? s;

export const statusTone = (s: string) =>
  s === "Cancelled" ? "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400"
  : s === "Completed" || s === "Delivered" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
  : s === "AwaitingPayment" ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
  : "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400";
