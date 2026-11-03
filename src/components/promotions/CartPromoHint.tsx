import { useEffect, useMemo, useState } from "react";
import { getHappyHourActiveNow, listCombos, type ComboDto, type HappyHourRuleDto } from "../../services/promotionsService";
import { estimateCartPromotions, type CartPromoLine } from "./cartPromotions";

/**
 * Subtle, non-blocking hint under the cart on the till: when a happy hour is
 * live or the cart holds a complete combo, tells the cashier that creating the
 * order as an OPEN invoice will apply it (pay-now orders close immediately, so
 * promotions cannot be booked on them). Silent on any API error.
 */
export default function CartPromoHint({ lines, className = "", refreshMs = 60000 }: { lines: CartPromoLine[]; className?: string; refreshMs?: number }) {
  const [rules, setRules] = useState<HappyHourRuleDto[]>([]);
  const [combos, setCombos] = useState<ComboDto[]>([]);

  useEffect(() => {
    let alive = true;
    const loadRules = () => {
      getHappyHourActiveNow()
        .then((r) => { if (alive) setRules(r?.rules ?? []); })
        .catch(() => { if (alive) setRules([]); });
    };
    loadRules();
    listCombos(false)
      .then((c) => { if (alive) setCombos(Array.isArray(c) ? c : []); })
      .catch(() => { if (alive) setCombos([]); });
    const t = setInterval(loadRules, Math.max(15000, refreshMs));
    return () => { alive = false; clearInterval(t); };
  }, [refreshMs]);

  const estimate = useMemo(() => estimateCartPromotions(lines, rules, combos), [lines, rules, combos]);

  if (lines.length === 0 || estimate.total <= 0) return null;

  const parts: string[] = [];
  if (estimate.happyHour) parts.push(`${estimate.happyHour.ruleName} (−$${estimate.happyHour.amount.toFixed(2)})`);
  for (const c of estimate.combos) parts.push(`${c.name}${c.sets > 1 ? ` ×${c.sets}` : ""} (−$${c.saving.toFixed(2)})`);

  return (
    <p className={`text-xs text-gray-500 dark:text-gray-400 ${className}`} data-testid="cart-promo-hint">
      <span className="font-medium text-success-700 dark:text-success-400">Promotion available:</span>{" "}
      create as an open invoice to apply {parts.join(" and ")}.
    </p>
  );
}
