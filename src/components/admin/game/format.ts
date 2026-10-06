// Formatting + class helpers for the Games / Game Settings pages (pure, no JSX).

/** Modal shell classes: never wider than the viewport minus a 16px gutter. */
export const MODAL_SM = "max-w-[calc(100vw-32px)] sm:max-w-md!";
export const MODAL_MD = "max-w-[calc(100vw-32px)] sm:max-w-xl!";
export const MODAL_LG = "max-w-[calc(100vw-32px)] sm:max-w-2xl!";

/** Footer buttons: full width on phones, natural width from sm up. */
export const FOOTER_BTN = "w-full sm:w-auto";

function toDate(iso?: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "Oct 6, 2026" — or "—" when missing/invalid. */
export function fmtDate(iso?: string | null): string {
  const d = toDate(iso);
  return d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
}

/** "Oct 6, 2026, 3:04 PM" — or "—" when missing/invalid. */
export function fmtDateTime(iso?: string | null): string {
  const d = toDate(iso);
  return d
    ? d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
    : "—";
}

/** Pill tone for a setting type ("Day Pass", "Events", …). */
export function typeTone(type?: string | null): "blue" | "purple" | "violet" {
  const t = (type ?? "").toLowerCase();
  if (t.includes("event")) return "purple";
  if (t.includes("day")) return "blue";
  return "violet";
}
