import { useState } from "react";
import Menu4DViewer, { type Item4D } from "./Menu4DViewer";
import { requestMotionAccess } from "./effects";

type Props = {
  items: Item4D[];
  index: number;
  className?: string;
  label?: string;
  onAdd?: (item: Item4D) => void;
  /** Show even without a photo (e.g. an item that only has a 3D scan). */
  always?: boolean;
};

/** Small "4D" button that opens the 4D viewer at this item, with the rest of the menu one swipe away. */
export default function Menu4DButton({ items, index, className = "", label = "4D", onAdd, always = false }: Props) {
  const [open, setOpen] = useState(false);
  if (!items[index] || (!items[index].imageUrl && !always)) return null;
  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); requestMotionAccess(); setOpen(true); }}
        className={`rounded-full bg-gray-900/85 px-2.5 py-1 text-xs font-bold tracking-wider text-white shadow hover:bg-gray-900 ${className}`}
        aria-label={`View ${items[index].name} in 4D`}
      >
        {label}
      </button>
      {open && <Menu4DViewer items={items} startIndex={index} onClose={() => setOpen(false)} onAdd={onAdd} />}
    </>
  );
}
