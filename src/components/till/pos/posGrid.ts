// Shared grid template for the till item grid and its loading skeleton,
// so both lay out identically (no shift when items arrive). items-start:
// a tall card (many options) must not stretch the rest of its row.
export const POS_GRID_CLASS = "grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] items-start gap-3 sm:gap-4";
