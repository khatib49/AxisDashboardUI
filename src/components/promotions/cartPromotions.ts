import type {
  AppliedPromotionsDto,
  AutoApplyResultDto,
  ComboDto,
  HappyHourRuleDto,
} from "../../services/promotionsService";

/** One cart line as the client-side promotion estimate sees it. */
export type CartPromoLine = { itemId: number; categoryId: number | null; qty: number; unit: number };

export type CartPromoEstimate = {
  happyHour: { ruleName: string; amount: number } | null;
  combos: { name: string; sets: number; saving: number }[];
  total: number;
};

const money = (n: number) => `$${Math.abs(n).toFixed(2)}`;

function csvInts(csv?: string | null): Set<number> {
  const out = new Set<number>();
  (csv ?? "")
    .split(",")
    .map((p) => parseInt(p.trim(), 10))
    .filter((n) => !Number.isNaN(n))
    .forEach((n) => out.add(n));
  return out;
}

function ruleMatches(rule: HappyHourRuleDto, itemId: number, categoryId: number | null) {
  const items = csvInts(rule.itemIdsCsv);
  const cats = csvInts(rule.categoryIdsCsv);
  if (items.size === 0 && cats.size === 0) return true;
  return items.has(itemId) || (categoryId != null && cats.has(categoryId));
}

/**
 * Mirrors the backend engines closely enough for a hint: happy hour = each
 * line's best active rule (highest priority, then discount); combos = whole
 * sets, allocated greedily (biggest saving first) so a line is never counted
 * twice. The server remains the source of truth once the invoice exists.
 */
export function estimateCartPromotions(lines: CartPromoLine[], rules: HappyHourRuleDto[], combos: ComboDto[]): CartPromoEstimate {
  const active = [...rules].sort((a, b) => b.priority - a.priority || b.discountPercent - a.discountPercent);
  let hhAmount = 0;
  let topRule: HappyHourRuleDto | null = null;
  for (const l of lines) {
    const rule = active.find((r) => ruleMatches(r, l.itemId, l.categoryId));
    if (!rule) continue;
    hhAmount += (l.unit * l.qty * Math.min(100, Math.max(0, rule.discountPercent))) / 100;
    if (!topRule || rule.priority > topRule.priority) topRule = rule;
  }
  hhAmount = Math.round(hhAmount * 100) / 100;

  const remaining = new Map<number, number>();
  const unit = new Map<number, number>();
  for (const l of lines) {
    remaining.set(l.itemId, (remaining.get(l.itemId) ?? 0) + l.qty);
    if (!unit.has(l.itemId)) unit.set(l.itemId, l.unit);
  }
  const candidates = combos
    .filter((c) => c.isActive && c.items.length > 0 && c.items.every((i) => remaining.has(i.itemId)))
    .map((c) => ({ combo: c, parts: c.items.reduce((s, i) => s + (unit.get(i.itemId) ?? i.unitPrice) * i.quantity, 0) }))
    .filter((x) => x.parts > x.combo.price)
    .sort((a, b) => b.parts - b.combo.price - (a.parts - a.combo.price) || a.combo.id - b.combo.id);

  const found: CartPromoEstimate["combos"] = [];
  for (const { combo, parts } of candidates) {
    let sets = Number.POSITIVE_INFINITY;
    for (const i of combo.items) {
      if (i.quantity <= 0) continue;
      sets = Math.min(sets, Math.floor((remaining.get(i.itemId) ?? 0) / i.quantity));
    }
    if (!Number.isFinite(sets) || sets <= 0) continue;
    combo.items.forEach((i) => remaining.set(i.itemId, (remaining.get(i.itemId) ?? 0) - sets * i.quantity));
    found.push({ name: combo.name, sets, saving: Math.round(sets * (parts - combo.price) * 100) / 100 });
  }

  const total = Math.round((hhAmount + found.reduce((s, c) => s + c.saving, 0)) * 100) / 100;
  return { happyHour: topRule && hhAmount > 0 ? { ruleName: topRule.name, amount: hhAmount } : null, combos: found, total };
}

/** Chip labels for what is currently booked on an invoice, e.g. "Happy hour −$1.20", "Burger Meal ×2 −$4.00". */
export function appliedChipLabels(applied: AppliedPromotionsDto | null | undefined): string[] {
  if (!applied) return [];
  const out: string[] = [];
  if (applied.happyHour && applied.happyHour.amount > 0) out.push(`Happy hour −${money(applied.happyHour.amount)}`);
  for (const c of applied.combos ?? []) {
    if (c.amount > 0) out.push(`${c.comboName}${c.quantity > 1 ? ` ×${c.quantity}` : ""} −${money(c.amount)}`);
  }
  for (const c of applied.coupons ?? []) {
    if (c.amount > 0) out.push(`Coupon ${c.code} −${money(c.amount)}`);
  }
  return out;
}

/** One-line summary of an auto-apply result for a toast; null when nothing is booked. */
export function describeAutoApply(result: AutoApplyResultDto | null | undefined): string | null {
  if (!result) return null;
  const parts: string[] = [];
  if (result.happyHour && result.happyHour.amount > 0) {
    parts.push(`Happy hour "${result.happyHour.ruleName}" −${money(result.happyHour.amount)}`);
  }
  for (const c of result.combos ?? []) {
    if (c.amount > 0) parts.push(`${c.comboName}${c.quantity > 1 ? ` ×${c.quantity}` : ""} −${money(c.amount)}`);
  }
  if (parts.length === 0) return null;
  return `Promotions applied: ${parts.join(", ")}. New total ${money(result.totalAfter)}.`;
}
