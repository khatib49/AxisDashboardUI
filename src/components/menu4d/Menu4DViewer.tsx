import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Model3DViewer from "../menu3d/Model3DViewer";
import { useItemModels } from "../menu3d/useItemModels";
import { effectFor, type Effect4D } from "./effects";
import "./menu4d.css";

export type Item4D = {
  id: number | string;
  name: string;
  price?: number | null;
  imageUrl: string | null;
  /** Category, shown above the name and used to choose the effect. */
  hint?: string | null;
  /** Extra words (type, ingredients) that only help choose the effect. */
  tags?: string | null;
  description?: string | null;
};

type Props = {
  items: Item4D[];
  startIndex?: number;
  onClose: () => void;
  /** Shown as a button when the menu lets guests order. */
  onAdd?: (item: Item4D) => void;
  addLabel?: string;
};

const money = (n: number) => `$${Number(n).toFixed(2)}`;

function Effects({ effect }: { effect: Effect4D }) {
  const bubbles = useMemo(() => Array.from({ length: 28 }, (_, i) => ({
    left: `${(i * 37) % 96 + 2}%`, size: 6 + ((i * 7) % 12), dur: 3 + ((i * 13) % 30) / 10, delay: ((i * 11) % 40) / 10,
  })), []);
  const glints = useMemo(() => [{ l: "24%", t: "30%", d: "0s" }, { l: "68%", t: "22%", d: "1.2s" }, { l: "55%", t: "62%", d: "2.4s" }], []);
  if (effect === "steam") return <div className="m4d-steam" aria-hidden="true"><span className="m4d-wisp" /><span className="m4d-wisp" /><span className="m4d-wisp" /><span className="m4d-wisp" /><span className="m4d-wisp" /></div>;
  if (effect === "fizz") return <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">{bubbles.map((b, i) => <span key={i} className="m4d-bubble" style={{ left: b.left, width: b.size, height: b.size, animationDuration: `${b.dur}s`, animationDelay: `${b.delay}s` }} />)}</div>;
  if (effect === "foil") return <div className="m4d-foil" aria-hidden="true" />;
  return <div className="absolute inset-0 pointer-events-none" aria-hidden="true">{glints.map((g, i) => <span key={i} className="m4d-glint" style={{ left: g.l, top: g.t, animationDelay: g.d }} />)}</div>;
}

/**
 * Full-screen "4D" view of a menu item: the real photo comes alive (tilts with
 * the phone or the pointer, slow cinematic zoom, moving light, and steam, fizz
 * or foil to suit the item). Items with a scanned 3D model show the model
 * instead, turning, with the same effects and "View on your table" AR.
 * Swipe, arrows or the keyboard move through the whole menu.
 */
export default function Menu4DViewer({ items, startIndex = 0, onClose, onAdd, addLabel = "Add to order" }: Props) {
  const [index, setIndex] = useState(Math.min(Math.max(startIndex, 0), Math.max(items.length - 1, 0)));
  // The item on screen changes only once its photo is decoded, so moving
  // between dishes never flashes an empty card.
  const [shown, setShown] = useState(index);
  const rootRef = useRef<HTMLDivElement>(null);
  const models = useItemModels();
  const item = items[shown] ?? items[index];
  const model = item ? models.get(Number(item.id)) : undefined;
  const effect = item ? effectFor(item.name, `${item.hint ?? ""} ${item.tags ?? ""}`) : "glow";

  const go = useCallback((d: number) => setIndex((i) => (items.length ? (i + d + items.length) % items.length : 0)), [items.length]);

  // Tilt: phone motion, pointer, or a slow automatic sway when nothing moves.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let tx = 0, ty = 0, cx = 0, cy = 0, lastInput = 0, raf = 0;
    const set = (x: number, y: number) => { tx = Math.max(-1, Math.min(1, x)); ty = Math.max(-1, Math.min(1, y)); lastInput = performance.now(); };
    const onOrient = (e: DeviceOrientationEvent) => { if (e.gamma == null || e.beta == null) return; set(e.gamma / 25, (e.beta - 45) / 25); };
    const onMove = (e: PointerEvent) => { const r = el.getBoundingClientRect(); set(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1); };
    const tick = (t: number) => {
      if (!reduce && t - lastInput > 2000) { tx = Math.sin(t / 2600) * 0.55; ty = Math.cos(t / 3400) * 0.35; }
      cx += (tx - cx) * 0.08; cy += (ty - cy) * 0.08;
      el.style.setProperty("--ry", `${(cx * 11).toFixed(2)}deg`);
      el.style.setProperty("--rx", `${(-cy * 9).toFixed(2)}deg`);
      el.style.setProperty("--px", `${(-cx * 14).toFixed(1)}px`);
      el.style.setProperty("--py", `${(-cy * 10).toFixed(1)}px`);
      el.style.setProperty("--mx", `${(50 + cx * 35).toFixed(1)}%`);
      el.style.setProperty("--my", `${(40 + cy * 30).toFixed(1)}%`);
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener("deviceorientation", onOrient);
    el.addEventListener("pointermove", onMove);
    if (!reduce) raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("deviceorientation", onOrient); el.removeEventListener("pointermove", onMove); };
  }, []);

  // Keyboard and swipe
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [go, onClose]);
  const touch = useRef<{ x: number; y: number } | null>(null);

  // Show the new item once its photo is ready (or after 1.5 s at most).
  useEffect(() => {
    const url = items[index]?.imageUrl;
    if (!url || models.get(Number(items[index].id))) { setShown(index); return; }
    let done = false;
    const show = () => { if (!done) { done = true; setShown(index); } };
    const im = new Image();
    im.src = url;
    im.decode().then(show, show);
    const t = window.setTimeout(show, 1500);
    return () => { done = true; window.clearTimeout(t); };
  }, [index, items, models]);

  // Preload and decode the neighbours so swiping feels instant
  useEffect(() => {
    for (const d of [1, -1, 2]) {
      const n = items[(index + d + items.length) % items.length];
      if (n?.imageUrl) { const im = new Image(); im.src = n.imageUrl; im.decode().catch(() => undefined); }
    }
  }, [index, items]);

  if (!item) return null;

  return createPortal(
    <div ref={rootRef} className="m4d-root fixed inset-0 z-[100000] flex flex-col bg-[#05070c] text-white select-none" role="dialog" aria-modal="true" aria-label={`${item.name} in 4D`}
      onTouchStart={(e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
      onTouchEnd={(e) => { const s = touch.current; touch.current = null; if (!s) return; const dx = e.changedTouches[0].clientX - s.x; const dy = e.changedTouches[0].clientY - s.y; if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1); }}>
      {item.imageUrl && <div className="m4d-ambient" style={{ backgroundImage: `url("${item.imageUrl}")` }} aria-hidden="true" />}

      <div className="relative z-10 flex items-center justify-between px-4 pt-4 sm:px-6">
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold tracking-[0.2em] backdrop-blur">4D</span>
        <span className="text-sm text-white/70 tabular-nums">{index + 1} / {items.length}</span>
        <button type="button" onClick={onClose} aria-label="Close" className="h-10 w-10 rounded-full bg-white/10 text-lg backdrop-blur hover:bg-white/20">✕</button>
      </div>

      <div className="m4d-stage relative z-10 flex flex-1 items-center justify-center px-6 py-4">
        <button type="button" onClick={() => go(-1)} aria-label="Previous item" className="absolute left-2 top-1/2 hidden h-12 w-12 -translate-y-1/2 rounded-full bg-white/10 text-2xl backdrop-blur hover:bg-white/20 sm:block">‹</button>
        <div key={item.id} className="m4d-enter relative w-full max-w-[460px]">
          <div className="m4d-card aspect-[4/5] w-full">
            {model ? (
              <Model3DViewer model={model} alt={`3D scan of ${item.name}`} className="absolute inset-0 h-full w-full" />
            ) : item.imageUrl ? (
              <img className="m4d-photo" src={item.imageUrl} alt={item.name} draggable={false} />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-white/50">No photo yet</div>
            )}
            {!model && <div className="m4d-vignette" />}
            <Effects effect={effect} />
            {!model && <div className="m4d-light" />}
            {!model && <div className="m4d-sweep" />}
          </div>
          <div className="m4d-shadow" aria-hidden="true" />
        </div>
        <button type="button" onClick={() => go(1)} aria-label="Next item" className="absolute right-2 top-1/2 hidden h-12 w-12 -translate-y-1/2 rounded-full bg-white/10 text-2xl backdrop-blur hover:bg-white/20 sm:block">›</button>
      </div>

      <div className="relative z-10 mx-auto w-full max-w-[520px] px-6 pb-8">
        {item.hint && <div className="text-[11px] uppercase tracking-[0.25em] text-white/60">{item.hint}</div>}
        <div className="mt-1 flex items-end justify-between gap-4">
          <h2 className="text-2xl font-bold leading-tight sm:text-3xl">{item.name}</h2>
          {item.price != null && <div className="shrink-0 text-2xl font-bold text-amber-300">{money(item.price)}</div>}
        </div>
        {item.description && <p className="mt-2 line-clamp-2 text-sm text-white/70">{item.description}</p>}
        <div className="mt-4 flex items-center gap-3">
          {onAdd && <button type="button" onClick={() => onAdd(item)} className="flex-1 rounded-2xl bg-white py-3 text-base font-semibold text-gray-900 active:scale-[0.98]">{addLabel}</button>}
          <p className="text-xs text-white/50">{model ? "Drag to turn · View on your table" : "Tilt your phone · Swipe for the next dish"}</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
