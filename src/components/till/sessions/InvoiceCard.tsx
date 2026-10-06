// Game Session till — one of "My Invoices" (yesterday + today). Tapping the
// card opens the invoice; the page owns the handler.

import type { GameTransaction } from "../../../services/transactionService";
import { getStatusName, STATUS_ENABLED, STATUS_PROCESSED_PAID } from "../../../services/statuses";
import { Pill } from "../../ui/PageKit";

export function InvoiceCard({ invoice, onOpen }: { invoice: GameTransaction; onOpen: () => void }) {
  const paid = invoice.statusId === STATUS_ENABLED || invoice.statusId === STATUS_PROCESSED_PAID;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="block w-full rounded-2xl border border-gray-200/80 bg-white p-4 text-left transition hover:border-indigo-300 hover:shadow-md active:scale-[0.995] dark:border-white/[0.06] dark:bg-white/[0.03] dark:hover:border-indigo-400/40"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold text-gray-900 dark:text-white">Invoice #{invoice.transactionId}</span>
            <Pill tone={paid ? "emerald" : "gray"} dot>{getStatusName(invoice.statusId) || "Unknown"}</Pill>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm md:grid-cols-4">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Date</p>
              <p className="font-medium text-gray-800 dark:text-gray-200">{new Date(invoice.createdOn).toLocaleDateString()}</p>
            </div>
            {invoice.roomName && (
              <div className="min-w-0">
                <p className="text-xs text-gray-500 dark:text-gray-400">Room</p>
                <p className="truncate font-medium text-gray-800 dark:text-gray-200">{invoice.roomName}</p>
              </div>
            )}
            {invoice.gameName && (
              <div className="min-w-0">
                <p className="text-xs text-gray-500 dark:text-gray-400">Game</p>
                <p className="truncate font-medium text-gray-800 dark:text-gray-200">{invoice.gameName}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Durations</p>
              <p className="font-medium text-gray-800 dark:text-gray-200">
                {invoice.isDayPass ? "Day Pass" : (invoice.hours === 0 ? "Open Hour" : `${invoice.hours}h`)}
              </p>
            </div>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
          <p className="text-2xl font-bold tabular-nums text-gray-900 dark:text-white">${invoice.totalPrice.toFixed(2)}</p>
        </div>
      </div>
    </button>
  );
}
