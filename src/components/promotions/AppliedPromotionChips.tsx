import type { AppliedPromotionsDto } from "../../services/promotionsService";
import { appliedChipLabels } from "./cartPromotions";

/**
 * Small chips for the promotions currently booked on an invoice
 * ("Happy hour −$1.20", "Burger Meal −$2.00"). Renders nothing when there is
 * nothing to show, so callers can drop it in unconditionally.
 */
export default function AppliedPromotionChips({
  applied,
  className = "",
}: {
  applied: AppliedPromotionsDto | null | undefined;
  className?: string;
}) {
  const labels = appliedChipLabels(applied);
  if (labels.length === 0) return null;
  return (
    <div className={`flex flex-wrap gap-1 ${className}`} data-testid="applied-promotions">
      {labels.map((l) => (
        <span
          key={l}
          className="inline-flex items-center rounded-full border border-success-500/40 bg-success-50 px-2 py-0.5 text-[11px] font-medium text-success-700 dark:bg-success-500/15 dark:text-success-400"
        >
          {l}
        </span>
      ))}
    </div>
  );
}
