// Game Session till — set picker inside the Start dialog. Large touch tiles:
// Free (tap to select), Selected, Occupied (not selectable). Presentational:
// the page owns the availability data and the selected id.

import type { SetAvailabilityDto } from "../../../services/setService";
import { Pill } from "../../ui/PageKit";

export function SetPicker({ availability, selectedSetId, onSelect }: {
  availability: SetAvailabilityDto;
  selectedSetId: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Select Set</span>
        <div className="flex flex-wrap items-center gap-1.5">
          <Pill tone="emerald" dot>Available ({availability.availableCount})</Pill>
          <Pill tone="red" dot>Occupied ({availability.unavailableCount})</Pill>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {availability.available.map((set) => {
          const selected = selectedSetId === set.id;
          return (
            <button
              key={set.id}
              type="button"
              onClick={() => onSelect(set.id)}
              aria-pressed={selected}
              className={`flex min-h-[60px] flex-col items-center justify-center rounded-xl border-2 px-2 py-1.5 text-center transition active:scale-[0.97] ${selected
                ? "border-indigo-600 bg-indigo-600 text-white shadow-md shadow-indigo-600/20 dark:border-indigo-400 dark:bg-indigo-500"
                : "border-emerald-400 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:bg-emerald-500/20"
                }`}
            >
              <span className="max-w-full truncate text-base font-semibold">{set.name}</span>
              <span className={`text-[11px] font-medium ${selected ? "text-indigo-100" : "text-emerald-600 dark:text-emerald-300"}`}>
                {selected ? "✓ Selected" : "Free"}
              </span>
            </button>
          );
        })}
        {availability.unavailable.map((set) => (
          <div
            key={set.id}
            aria-disabled="true"
            className="flex min-h-[60px] cursor-not-allowed flex-col items-center justify-center rounded-xl border-2 border-dashed border-red-300 bg-red-50/70 px-2 py-1.5 text-center text-red-700 opacity-70 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300"
          >
            <span className="max-w-full truncate text-base font-semibold">{set.name}</span>
            <span className="text-[11px] font-medium">Occupied</span>
          </div>
        ))}
      </div>
    </div>
  );
}
