// Game Session till — one game as a large touch card with its settings
// (pass types) listed underneath, each with a one-tap Start button.
// Presentational only: the page owns every handler.

import { Skeleton } from "antd";
import type { GameDto } from "../../../services/gameService";
import type { GameSettingDto } from "../../../services/gameSettingsService";
import { getStatusName, STATUS_ENABLED, STATUS_PROCESSED_PAID } from "../../../services/statuses";
import { Pill } from "../../ui/PageKit";

// Category → consistent accent colour, so PS5 always looks like PS5 and TCG
// like TCG across visits.
function accentFor(cat?: string | null) {
  const c = (cat || "").toLowerCase();
  if (c.includes("tcg")) return { bar: "from-violet-500 to-purple-400", avatar: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300", tone: "violet" as const };
  if (c.includes("ps5") || c.includes("play")) return { bar: "from-blue-500 to-sky-400", avatar: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300", tone: "blue" as const };
  if (c.includes("board")) return { bar: "from-amber-500 to-orange-400", avatar: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300", tone: "amber" as const };
  return { bar: "from-emerald-500 to-teal-400", avatar: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300", tone: "emerald" as const };
}

// Same wording the till has always shown.
function durationLabel(s: GameSettingDto) {
  if (s.hours === 0) return "Open Hour";
  if (s.hours) return `${s.hours} hrs`;
  return null;
}

export function GameCard({ game, settings, onStart }: {
  game: GameDto;
  settings: GameSettingDto[];
  onStart: (s: GameSettingDto) => void;
}) {
  const accent = accentFor(game.categoryName);
  const statusIdNum = game.statusId === null || game.statusId === undefined ? null : Number(game.statusId);
  const enabled = statusIdNum === STATUS_ENABLED || statusIdNum === STATUS_PROCESSED_PAID;

  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:border-white/[0.06] dark:bg-white/[0.03]">
      {/* Category accent strip */}
      <div className={`h-1.5 shrink-0 bg-gradient-to-r ${accent.bar}`} />

      <header className="flex items-start gap-3 px-4 pb-3 pt-4">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-base font-bold ${accent.avatar}`}>
          {game.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[17px] font-semibold leading-snug text-gray-900 dark:text-white" title={game.name}>{game.name}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Pill tone={accent.tone}>{game.categoryName ?? "—"}</Pill>
            <Pill tone={enabled ? "emerald" : "red"} dot>
              {getStatusName(statusIdNum) ?? (game.statusId ?? "-")}
            </Pill>
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-2 px-3 pb-3">
        {settings.map((s) => {
          const duration = durationLabel(s);
          return (
            <div
              key={s.id}
              className="flex min-h-[64px] items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2.5 dark:border-white/[0.05] dark:bg-white/[0.03]"
            >
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-[15px] font-medium text-gray-900 dark:text-white" title={s.name}>{s.name}</span>
                  {s.isEvent && <span className="shrink-0"><Pill tone="violet">🎟 Event</Pill></span>}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-gray-500 dark:text-gray-400">
                  {duration && <span>⏱ {duration}</span>}
                  {s.isDayPass && <Pill tone="blue">Day pass</Pill>}
                  {s.isOffer && <Pill tone="amber">Offer</Pill>}
                </div>
                {/* Bundle preview — the cashier sees exactly what to hand
                    over. Deducted from stock automatically at start. */}
                {s.isEvent && (s.items?.length ?? 0) > 0 && (
                  <div className="mt-0.5 text-[11px] text-indigo-600 dark:text-indigo-300">
                    Includes {s.items!.map(i => `${i.quantityPerPerson}x ${i.itemName}`).join(", ")} / person
                  </div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {s.price ? <span className="text-lg font-bold tabular-nums text-gray-900 dark:text-white">${s.price}</span> : null}
                <button
                  type="button"
                  className="inline-flex h-11 min-w-[84px] items-center justify-center gap-1 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.97] dark:bg-indigo-500 dark:hover:bg-indigo-400"
                  onClick={() => onStart(s)}
                  aria-label={`Start ${game.name} — ${s.name}`}
                >
                  Start ▸
                </button>
              </div>
            </div>
          );
        })}
        {settings.length === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-gray-200 px-3 py-6 text-center text-sm text-gray-400 dark:border-white/10 dark:text-gray-500">
            No settings available
          </div>
        )}
      </div>
    </section>
  );
}

export function GameCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white p-4 dark:border-white/[0.06] dark:bg-white/[0.03]">
      <div className="flex items-center gap-3">
        <Skeleton.Avatar active shape="square" size={48} />
        <div className="flex-1"><Skeleton active title={{ width: "60%" }} paragraph={{ rows: 1, width: "40%" }} /></div>
      </div>
      <div className="mt-3 space-y-2">
        <Skeleton.Button active block style={{ height: 64 }} />
        <Skeleton.Button active block style={{ height: 64 }} />
      </div>
    </div>
  );
}
