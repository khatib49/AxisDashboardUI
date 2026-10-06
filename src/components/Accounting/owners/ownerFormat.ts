// Shared helpers (colours, formatting) for the Owners' Drawings page and popup.
//
// Owner colours: one categorical slot per owner, assigned by owner id
// (ascending) so a colour follows the person, never their rank — a filter or
// a re-sort never repaints anyone. Order and steps are a validated
// colour-blind-safe set (light + dark); owners past the 8th fold to grey.
// The light aqua/yellow sit below 3:1 on white, so a colour is never the only
// cue: every swatch has the owner's name and value next to it.

import { useTheme } from "../../../context/ThemeContext";

const SLOTS_LIGHT = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
const SLOTS_DARK = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];
const OTHER = { light: "#a8a7a1", dark: "#6b6a65" };

export type OwnerColorFn = (ownerId: number | null | undefined) => string;

/** Colour per owner id. `ids` = every owner the page knows about. */
export function useOwnerColors(ids: (number | null | undefined)[]): OwnerColorFn {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const slots = dark ? SLOTS_DARK : SLOTS_LIGHT;
  const order = [...new Set(ids.filter((x): x is number => x != null))].sort((a, b) => a - b);
  return (id) => {
    const i = id == null ? -1 : order.indexOf(id);
    return i >= 0 && i < slots.length ? slots[i] : dark ? OTHER.dark : OTHER.light;
  };
}

export const money = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Compact for big standalone figures: $22.2K, $1.3M. */
export const moneyCompact = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `$${(n / 1_000_000).toFixed(a >= 10_000_000 ? 1 : 2)}M`;
  if (a >= 10_000) return `$${(n / 1_000).toFixed(1)}K`;
  return money(n);
};

export const signedMoney = (n: number) => (n < 0 ? `(${money(-n)})` : money(n));
export const pct = (n: number) => `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");

export type DrawStatus = "over" | "under" | "even";

export const statusOf = (variance: number): DrawStatus =>
  variance > 0.004 ? "over" : variance < -0.004 ? "under" : "even";
