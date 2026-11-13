import { useEffect, useState } from "react";
import { getHappyHourActiveNow, HappyHourRuleDto } from "../../services/promotionsService";

/**
 * Small banner for till pages: polls /promotions/happyhour/active-now every
 * minute and renders nothing when no rule is in effect (or the call fails).
 */
export default function HappyHourBanner({ className = "", intervalMs = 60000 }: { className?: string; intervalMs?: number }) {
  const [rules, setRules] = useState<HappyHourRuleDto[]>([]);
  const [localTime, setLocalTime] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => {
      getHappyHourActiveNow()
        .then((res) => {
          if (!alive) return;
          setRules(res?.rules ?? []);
          setLocalTime(res?.localTime ?? null);
        })
        .catch(() => {
          if (!alive) return;
          setRules([]);
        });
    };
    load();
    const t = setInterval(load, Math.max(15000, intervalMs));
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [intervalMs]);

  if (rules.length === 0) return null;

  const top = rules[0];
  return (
    <div
      role="status"
      className={`flex flex-wrap items-center gap-3 rounded-lg border border-warning-500 bg-warning-50 px-4 py-2 text-sm dark:border-warning-500/30 dark:bg-warning-500/15 ${className}`}
    >
      <span className="font-semibold text-warning-700 dark:text-warning-400">Happy hour</span>
      <span className="text-gray-800 dark:text-white/90">
        {top.name}: <strong>{top.discountPercent}% off</strong> until {top.endTime}
        {rules.length > 1 ? ` (+${rules.length - 1} more rule${rules.length > 2 ? "s" : ""})` : ""}
      </span>
      {localTime && (
        <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
          venue time {new Date(localTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      )}
    </div>
  );
}
