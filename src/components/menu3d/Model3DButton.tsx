import { useState } from "react";
import Model3DViewer from "./Model3DViewer";
import type { PublicItemModelDto } from "../../services/phase4Service";

type Props = { model?: PublicItemModelDto | null; name: string; className?: string };

/** Small "3D" button for menu cards; opens the viewer in a full-screen sheet. */
export default function Model3DButton({ model, name, className = "" }: Props) {
  const [open, setOpen] = useState(false);
  if (!model) return null;
  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpen(true); }}
        className={`rounded-full bg-gray-900/80 px-2.5 py-1 text-xs font-semibold text-white hover:bg-gray-900 ${className}`}
        aria-label={`View ${name} in 3D`}
      >
        3D
      </button>
      {open && (
        <div className="fixed inset-0 z-[100000] flex items-end justify-center bg-black/60 sm:items-center" role="dialog" aria-modal="true" aria-label={`${name} in 3D`} onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg rounded-t-2xl bg-white p-4 dark:bg-gray-900 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white/90">{name}</h2>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5">Close</button>
            </div>
            <Model3DViewer model={model} alt={`3D model of ${name}`} className="h-[60vh] w-full" />
            <p className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">Drag to turn, pinch to zoom. On a phone, tap "View on your table".</p>
          </div>
        </div>
      )}
    </>
  );
}
