// Event card for the till Events board: title, when/where, type tag, price,
// tickets sold (with a capacity bar when the event has a capacity) and the
// one-tap "Door — check in" button.

import type { EventDto } from "../../../services/eventService";
import { Pill } from "../../ui/PageKit";
import { Meter } from "./DeskKit";
import { deskBtn, deskCard } from "./deskStyles";

const TYPE_STYLES: Record<string, string> = {
    "PS5 Session": "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
    "Board Games": "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    "Billiards": "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300",
    "TCG Event": "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300",
    "Social Event": "bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300",
    "Tournament": "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
    "Other": "bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-300",
};

export function EventCard({ e, big, onDoor }: { e: EventDto; big?: boolean; onDoor: (e: EventDto) => void }) {
    const cap = e.capacity ?? 0;
    const full = cap > 0 && e.paidCount >= cap;
    return (
        <article
            className={`${deskCard} flex flex-col p-4 ${big
                ? "border-violet-300 ring-2 ring-violet-100 dark:border-violet-500/40 dark:ring-violet-500/10"
                : "border-gray-200/80 dark:border-white/[0.06]"}`}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <div className={`truncate font-semibold text-gray-900 dark:text-white ${big ? "text-lg" : "text-base"}`}>{e.title}</div>
                    <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        {e.eventDate ? new Date(e.eventDate).toLocaleString([], { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                        {e.location ? ` · ${e.location}` : ""}
                    </div>
                </div>
                <span className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${TYPE_STYLES[e.type ?? "Other"] ?? TYPE_STYLES.Other}`}>
                    {e.type ?? "Other"}
                </span>
            </div>

            <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-1">
                {e.price > 0 && (
                    <span className={`font-bold tabular-nums text-gray-900 dark:text-white ${big ? "text-2xl" : "text-xl"}`}>${e.price}</span>
                )}
                <span className="text-sm font-semibold tabular-nums text-violet-700 dark:text-violet-300">
                    🎟 {e.paidCount}{e.capacity ? ` / ${e.capacity}` : ""} sold
                </span>
                {!e.isPublished && (
                    <span className="ml-auto" title="Not on the website yet — waiting for admin to publish">
                        <Pill tone="amber" dot>Internal</Pill>
                    </span>
                )}
            </div>

            {e.capacity ? (
                <div className="mt-2">
                    <Meter value={e.paidCount} max={e.capacity} tone={full ? "red" : "violet"} label={`${e.paidCount} of ${e.capacity} tickets sold`} />
                    {full && <div className="mt-1 text-xs font-semibold text-red-600 dark:text-red-400">Sold out</div>}
                </div>
            ) : null}

            <div className="mt-auto pt-3">
                <button
                    type="button"
                    onClick={() => onDoor(e)}
                    className={big
                        ? `${deskBtn("primary", "lg")} w-full`
                        : "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-violet-200 bg-white text-sm font-semibold text-violet-700 transition hover:bg-violet-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 dark:border-violet-500/30 dark:bg-transparent dark:text-violet-300 dark:hover:bg-violet-500/10"}
                >
                    🎟 Door — check in
                </button>
            </div>
        </article>
    );
}
