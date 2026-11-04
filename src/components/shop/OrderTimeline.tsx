import type { OnlineOrderDto } from "../../services/shopService";

import { orderSteps } from "./orderStatus";

const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "");

export default function OrderTimeline({ order }: { order: OnlineOrderDto }) {
  const { steps, current, cancelled } = orderSteps(order);
  if (cancelled) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm dark:border-red-500/30 dark:bg-red-500/10" role="status">
        <div className="font-semibold text-red-700 dark:text-red-400">Cancelled</div>
        {order.cancelReason && <div className="text-red-600/80 dark:text-red-300/80">{order.cancelReason}</div>}
      </div>
    );
  }
  return (
    <ol className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-0" aria-label="Order progress">
      {steps.map((s, i) => {
        const done = i <= current;
        const active = i === current;
        return (
          <li key={s.key} className="flex sm:flex-col sm:flex-1 items-center sm:items-start gap-3 sm:gap-2 relative">
            <div className="flex items-center sm:w-full">
              <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${done ? "bg-brand-500 text-white" : "bg-gray-200 text-gray-500 dark:bg-gray-800 dark:text-gray-400"} ${active ? "ring-4 ring-brand-500/20" : ""}`}>
                {done ? "✓" : i + 1}
              </div>
              {i < steps.length - 1 && <div className={`hidden sm:block h-0.5 flex-1 mx-2 ${i < current ? "bg-brand-500" : "bg-gray-200 dark:bg-gray-800"}`} />}
            </div>
            <div>
              <div className={`text-sm ${done ? "font-semibold" : "text-gray-500 dark:text-gray-400"}`}>{s.label}</div>
              {done && s.at && <div className="text-xs text-gray-500 dark:text-gray-400">{when(s.at)}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
