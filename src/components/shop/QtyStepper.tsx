type Props = { value: number; onChange: (v: number) => void; min?: number; max?: number | null; size?: "sm" | "md"; label?: string };

export default function QtyStepper({ value, onChange, min = 1, max = null, size = "md", label = "Quantity" }: Props) {
  const h = size === "sm" ? "h-8" : "h-10";
  const btn = `${h} w-9 flex items-center justify-center text-lg select-none disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-white/5`;
  const atMax = max != null && value >= max;
  return (
    <div className={`inline-flex items-center rounded-lg border border-gray-300 dark:border-gray-700 overflow-hidden ${h}`} role="group" aria-label={label}>
      <button type="button" className={btn} onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="Decrease">−</button>
      <input
        type="number" inputMode="numeric" value={value} min={min} max={max ?? undefined} aria-label={label}
        onChange={(e) => { const n = parseInt(e.target.value, 10); if (!Number.isNaN(n)) onChange(Math.max(min, max != null ? Math.min(max, n) : n)); }}
        className="w-12 text-center bg-transparent outline-none text-sm font-semibold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button type="button" className={btn} onClick={() => onChange(value + 1)} disabled={atMax} aria-label="Increase">+</button>
    </div>
  );
}
