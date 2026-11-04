import type { Tournament } from "../../services/phase5Service";
import { useI18n } from "../../i18n/I18nProvider";

type Props = { tournament: Tournament; onPick?: (matchId: number, winnerId: number) => void; busyMatch?: number | null };

/** Bracket columns by round. With onPick, staff tap the winner of a ready match. */
export default function Bracket({ tournament, onPick, busyMatch }: Props) {
  const { t } = useI18n();
  const rounds = Array.from({ length: tournament.rounds }, (_, i) => i + 1);
  const label = (r: number) => r === tournament.rounds ? t("Final") : r === tournament.rounds - 1 ? t("Semi-final") : t("Round {n}", { n: r });
  return (
    <div className="overflow-x-auto" data-testid="bracket">
      <div className="flex min-w-max gap-4">
        {rounds.map((r) => (
          <div key={r} className="flex w-56 flex-col justify-around gap-3">
            <p className="text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label(r)}</p>
            {tournament.matches.filter((m) => m.round === r).map((m) => {
              const slot = (id?: number | null, name?: string | null) => {
                const won = m.winnerId != null && m.winnerId === id;
                const lost = m.winnerId != null && id != null && m.winnerId !== id;
                const pickable = !!onPick && m.status === "Ready" && id != null && busyMatch !== m.id;
                return (
                  <button type="button" disabled={!pickable} onClick={() => id != null && onPick?.(m.id, id)}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${won ? "font-bold text-green-700 dark:text-green-400" : lost ? "text-gray-400 line-through" : "text-gray-800 dark:text-white/90"} ${pickable ? "hover:bg-brand-50 dark:hover:bg-brand-500/10" : ""}`}>
                    <span className="truncate">{name ?? (m.status === "Done" && m.score === "bye" ? "—" : t("Waiting"))}</span>
                    {won && <span aria-label={t("Winner")}>✓</span>}
                  </button>
                );
              };
              return (
                <div key={m.id} className={`overflow-hidden rounded-xl border ${m.status === "Ready" ? "border-brand-400" : "border-gray-200 dark:border-gray-700"} bg-white dark:bg-gray-900`}>
                  {slot(m.player1Id, m.player1)}
                  <div className="border-t border-gray-100 dark:border-gray-800" />
                  {slot(m.player2Id, m.player2)}
                  {(m.score || m.station) && <p className="border-t border-gray-100 px-3 py-1 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">{m.score === "bye" ? t("bye") : m.score}{m.station && m.status !== "Done" ? ` · ${m.station}` : ""}</p>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
