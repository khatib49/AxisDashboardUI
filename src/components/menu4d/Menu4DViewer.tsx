import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { QRCodeSVG } from "qrcode.react";
import { useItemModels } from "../menu3d/useItemModels";
import Dish3D, { type Dish3DHandle } from "./Dish3D";
import { effectFor, type Effect4D } from "./effects";
import { useItemParts } from "./useItemParts";
import { playEffectSound, setSoundPreferred, soundPreferred, stopSound } from "./sound4d";
import type { Dish4DPart } from "../../services/menu4dService";
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

/** A sensible life-size width when staff have not set one. */
function defaultSizeCm(text: string, effect: Effect4D) {
  const t = text.toLowerCase();
  if (/(coffee|espresso|latte|cappuccino|tea|mocha|drink|juice|shake|smoothie|soda|water|cola|pepsi|mojito)/.test(t)) return 9;
  if (effect === "foil") return 9;
  if (/(burger|sandwich|wrap)/.test(t)) return 14;
  if (/(pizza)/.test(t)) return 30;
  return effect === "steam" ? 24 : 14;
}

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

/** The living photo, with tappable parts and a zoom that flies to the chosen part. */
function PhotoLayer({ url, alt, parts, active, show, onPart }: { url: string; alt: string; parts: Dish4DPart[]; active: number | null; show: boolean; onPart: (i: number) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Photo percent → card percent (the photo is cropped to fill the card)
  const map = (x: number, y: number) => {
    if (!nat || !size || !size.w || !size.h) return { l: x, t: y };
    const s = Math.max(size.w / nat.w, size.h / nat.h);
    const dx = (size.w - nat.w * s) / 2, dy = (size.h - nat.h * s) / 2;
    return { l: Math.min(96, Math.max(4, ((dx + (x / 100) * nat.w * s) / size.w) * 100)), t: Math.min(96, Math.max(4, ((dy + (y / 100) * nat.h * s) / size.h) * 100)) };
  };
  const a = active != null ? parts[active] : null;
  const ap = a ? map(a.x, a.y) : null;
  const zoom = ap ? 2.2 : 1;
  return (
    <div className={`m4d-wrap ${ap ? "m4d-wrap-still" : ""}`}>
      <div ref={box} className="m4d-zoom" style={{ transform: `scale(${zoom})`, transformOrigin: ap ? `${ap.l}% ${ap.t}%` : "50% 50%", ["--z" as string]: zoom }}>
        <img className="m4d-photo" src={url} alt={alt} draggable={false} onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />
        {show && parts.map((p, i) => {
          const m = map(p.x, p.y);
          return (
            <button key={i} type="button" className={`m4d-dot ${active === i ? "on" : ""} ${m.t < 16 ? "below" : ""} ${m.l < 18 ? "start" : m.l > 82 ? "end" : ""}`} style={{ left: `${m.l}%`, top: `${m.t}%` }}
              onClick={(e) => { e.stopPropagation(); onPart(i); }} aria-label={p.name}>
              <span className="m4d-dot-label">{p.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Full-screen "4D" view of a menu item.
 * - On my table: dishes with a 3D model open in AR, life-size, on the guest's table
 *   (move, turn and pinch to zoom with the phone's own AR controls).
 * - Discover: tappable labels on each part (bun, patty, foam…) with a short line.
 * - Tour: the camera flies from part to part with a caption.
 * - The photo itself lives: tilt with the phone, slow zoom, light, steam / fizz /
 *   foil, and optional sound (sizzle, fizz) with a light buzz on phones.
 * Swipe, arrows or the keyboard move through the whole menu.
 */
export default function Menu4DViewer({ items, startIndex = 0, onClose, onAdd, addLabel = "Add to order" }: Props) {
  const [index, setIndex] = useState(Math.min(Math.max(startIndex, 0), Math.max(items.length - 1, 0)));
  // The item on screen changes only once its photo is decoded, so moving
  // between dishes never flashes an empty card.
  const [shown, setShown] = useState(index);
  const rootRef = useRef<HTMLDivElement>(null);
  const dish = useRef<Dish3DHandle>(null);
  const models = useItemModels();
  const partsMap = useItemParts();
  const item = items[shown] ?? items[index];
  const model = item ? models.get(Number(item.id)) : undefined;
  const effect = item ? effectFor(item.name, `${item.hint ?? ""} ${item.tags ?? ""}`) : "glow";
  const info = item ? partsMap.get(Number(item.id)) : undefined;
  const parts = useMemo(() => info?.parts ?? [], [info]);
  const realSize = info?.realSizeCm ?? (item ? defaultSizeCm(`${item.name} ${item.hint ?? ""}`, effect) : 20);

  const [discover, setDiscover] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const [touring, setTouring] = useState(false);
  const [sound, setSound] = useState(soundPreferred());
  const [canAR, setCanAR] = useState(false);
  const [qr, setQr] = useState(false);

  const go = useCallback((d: number) => setIndex((i) => (items.length ? (i + d + items.length) % items.length : 0)), [items.length]);

  // New dish: reset the part view
  useEffect(() => { setActive(null); setTouring(false); setCanAR(false); setQr(false); }, [shown]);

  // Sound follows the dish on screen
  useEffect(() => { if (sound) playEffectSound(effect); else stopSound(); }, [sound, effect, shown]);
  useEffect(() => () => stopSound(), []);

  // Tour: fly from part to part
  useEffect(() => {
    if (!touring || parts.length === 0) return;
    setDiscover(true);
    setActive((a) => (a == null ? 0 : a));
    const t = window.setInterval(() => setActive((a) => {
      const next = a == null ? 0 : a + 1;
      if (next >= parts.length) { setTouring(false); return null; }
      return next;
    }), 3200);
    return () => window.clearInterval(t);
  }, [touring, parts.length]);

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

  const pickPart = (i: number) => { setTouring(false); setDiscover(true); setActive((a) => (a === i ? null : i)); };
  const onReady3D = useCallback(({ canAR: ok }: { canAR: boolean }) => setCanAR(ok), []);
  const placeOnTable = async () => {
    const ok = await dish.current?.placeOnTable();
    if (!ok) setQr(true);
  };

  if (!item) return null;
  const activePart = active != null ? parts[active] : null;

  return createPortal(
    <div ref={rootRef} className="m4d-root fixed inset-0 z-[100000] flex flex-col bg-[#05070c] text-white select-none" role="dialog" aria-modal="true" aria-label={`${item.name} in 4D`}
      onTouchStart={(e) => { touch.current = (e.target as HTMLElement).closest("model-viewer") ? null : { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
      onTouchEnd={(e) => { const s = touch.current; touch.current = null; if (!s) return; const dx = e.changedTouches[0].clientX - s.x; const dy = e.changedTouches[0].clientY - s.y; if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1); }}>
      {item.imageUrl && <div className="m4d-ambient" style={{ backgroundImage: `url("${item.imageUrl}")` }} aria-hidden="true" />}

      <div className="relative z-10 flex items-center justify-between px-4 pt-4 sm:px-6">
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold tracking-[0.2em] backdrop-blur">4D</span>
        <span className="text-sm text-white/70 tabular-nums">{index + 1} / {items.length}</span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => { const v = !sound; setSound(v); setSoundPreferred(v); }} aria-label={sound ? "Sound off" : "Sound on"} aria-pressed={sound}
            className={`h-10 w-10 rounded-full text-base backdrop-blur ${sound ? "bg-amber-300 text-gray-900" : "bg-white/10 hover:bg-white/20"}`}>{sound ? "🔊" : "🔈"}</button>
          <button type="button" onClick={onClose} aria-label="Close" className="h-10 w-10 rounded-full bg-white/10 text-lg backdrop-blur hover:bg-white/20">✕</button>
        </div>
      </div>

      <div className="m4d-stage relative z-10 flex flex-1 items-center justify-center px-6 py-3">
        <button type="button" onClick={() => go(-1)} aria-label="Previous item" className="absolute left-2 top-1/2 hidden h-12 w-12 -translate-y-1/2 rounded-full bg-white/10 text-2xl backdrop-blur hover:bg-white/20 sm:block">‹</button>
        <div key={item.id} className="m4d-enter relative w-full max-w-[440px]">
          <div className={`m4d-card aspect-[4/5] w-full ${model ? "m4d-card-3d" : ""}`} onClick={() => { if (active != null) setActive(null); }}>
            {model ? (
              <Dish3D ref={dish} model={model} alt={`3D model of ${item.name}`} parts={parts} active={active} onPart={pickPart}
                realSizeCm={realSize} spin={!touring && active == null} showLabels={discover || touring} className="absolute inset-0 h-full w-full" onReady={onReady3D} />
            ) : item.imageUrl ? (
              <PhotoLayer url={item.imageUrl} alt={item.name} parts={parts} active={active} show={discover || touring} onPart={pickPart} />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-white/50">No photo yet</div>
            )}
            {!model && <div className="m4d-vignette" />}
            {active == null && !model && <Effects effect={effect} />}
            {!model && <div className="m4d-light" />}
            {!model && active == null && <div className="m4d-sweep" />}
            {model && <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-bold tracking-wider backdrop-blur">3D · drag to turn</span>}
          </div>
          <div className="m4d-shadow" aria-hidden="true" />
          {qr && (
            <div className="m4d-qr" role="dialog" aria-label="Open on your phone">
              <div className="rounded-2xl bg-white p-3"><QRCodeSVG value={`${window.location.origin}/menu?dish=${encodeURIComponent(String(item.id))}`} size={168} /></div>
              <p className="mt-3 text-base font-bold">Put it on your table</p>
              <p className="mt-1 text-sm text-white/75">Scan with your phone camera. {item.name} opens in 4D, ready to place on your table.</p>
              <button type="button" onClick={() => setQr(false)} className="mt-3 rounded-full bg-white/15 px-4 py-1.5 text-sm hover:bg-white/25">Close</button>
            </div>
          )}
        </div>
        <button type="button" onClick={() => go(1)} aria-label="Next item" className="absolute right-2 top-1/2 hidden h-12 w-12 -translate-y-1/2 rounded-full bg-white/10 text-2xl backdrop-blur hover:bg-white/20 sm:block">›</button>
      </div>

      <div className="relative z-10 mx-auto w-full max-w-[520px] px-5 pb-6">
        {activePart ? (
          <div className="m4d-callout" role="status" aria-live="polite">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-amber-300">{(active ?? 0) + 1} of {parts.length}</span>
              <button type="button" className="text-xs text-white/60 hover:text-white" onClick={() => { setActive(null); setTouring(false); }}>Back to dish</button>
            </div>
            <div className="mt-1 text-xl font-bold">{activePart.name}</div>
            {activePart.detail && <p className="mt-0.5 text-sm text-white/75">{activePart.detail}</p>}
          </div>
        ) : (
          <>
            {item.hint && <div className="text-[11px] uppercase tracking-[0.25em] text-white/60">{item.hint}</div>}
            <div className="mt-1 flex items-end justify-between gap-4">
              <h2 className="text-2xl font-bold leading-tight sm:text-3xl">{item.name}</h2>
              {item.price != null && <div className="shrink-0 text-2xl font-bold text-amber-300">{money(item.price)}</div>}
            </div>
            {item.description && <p className="mt-1.5 line-clamp-2 text-sm text-white/70">{item.description}</p>}
          </>
        )}

        {(discover || touring) && parts.length > 0 && (
          <div className="m4d-chips mt-3" role="tablist" aria-label="Parts of this dish">
            {parts.map((p, i) => (
              <button key={i} type="button" role="tab" aria-selected={active === i} onClick={() => pickPart(i)} className={`m4d-chip ${active === i ? "on" : ""}`}>{p.name}</button>
            ))}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {model && (
            <button type="button" onClick={() => void placeOnTable()} className="m4d-cta flex-1">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Z" /><path d="m4 7.5 8 4.5 8-4.5M12 12v9" /></svg> On my table
            </button>
          )}
          {parts.length > 0 && (
            <>
              <button type="button" onClick={() => { setTouring(false); setDiscover((d) => !d); setActive(null); }} aria-pressed={discover} className={`m4d-pill ${discover && !touring ? "on" : ""}`}>✨ Discover</button>
              <button type="button" onClick={() => { setActive(null); setTouring((t) => !t); }} aria-pressed={touring} className={`m4d-pill ${touring ? "on" : ""}`}>{touring ? "■ Stop" : "▶ Tour"}</button>
            </>
          )}
          {onAdd && <button type="button" onClick={() => onAdd(item)} className={`rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-gray-900 active:scale-[0.98] ${model ? "" : "flex-1"}`}>{addLabel}</button>}
        </div>
        <p className="mt-2 text-xs text-white/50">
          {model ? (canAR ? "Place it on your table, walk around it, pinch to resize." : "Drag to turn · tap On my table to open it on your phone") : "Tilt your phone · Swipe for the next dish"}
        </p>
      </div>
    </div>,
    document.body,
  );
}
