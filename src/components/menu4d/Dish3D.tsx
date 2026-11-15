import { createElement, forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { assetUrl, type PublicItemModelDto } from "../../services/phase4Service";
import type { Dish4DPart } from "../../services/menu4dService";

let loader: Promise<unknown> | null = null;
/** The viewer library is large: load it only when a model is shown. */
function loadViewer() { loader ??= import("@google/model-viewer"); return loader; }

type MV = HTMLElement & {
  activateAR?: () => Promise<void>;
  canActivateAR?: boolean;
  getDimensions?: () => { x: number; y: number; z: number };
  positionAndNormalFromPoint?: (x: number, y: number) => { position: { toString(): string }; normal: { toString(): string } } | null;
  cameraTarget?: string; fieldOfView?: string; cameraOrbit?: string; autoRotate?: boolean; scale?: string;
  updateFraming?: () => Promise<void>;
  resetTurntableRotation?: (theta?: number) => void;
};

export type Dish3DHandle = {
  /** Opens "on your table" AR (Scene Viewer / WebXR on Android, Quick Look on iPhone). */
  placeOnTable: () => Promise<boolean>;
  /** Model coordinates under a screen point (used by the staff editor to place labels). */
  pointAt: (clientX: number, clientY: number) => { pos: string; normal: string } | null;
};

type Props = {
  model: PublicItemModelDto;
  alt: string;
  parts?: Dish4DPart[];
  /** Highlighted part (camera turns to it when it has a 3D spot). */
  active?: number | null;
  onPart?: (i: number) => void;
  /** Real width in cm: the model is scaled so it appears life-size on the table. */
  realSizeCm?: number | null;
  spin?: boolean;
  showLabels?: boolean;
  className?: string;
  onReady?: (info: { canAR: boolean }) => void;
  onClick?: (e: React.MouseEvent) => void;
};

/** A dish as a 3D model with labelled hotspots, life-size AR and a camera that flies to the chosen part. */
const Dish3D = forwardRef<Dish3DHandle, Props>(function Dish3D(
  { model, alt, parts = [], active = null, onPart, realSizeCm, spin = true, showLabels = true, className = "", onReady, onClick }, ref) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const el = useRef<MV | null>(null);

  useEffect(() => { loadViewer().then(() => setReady(true)).catch(() => setFailed(true)); }, []);

  useImperativeHandle(ref, () => ({
    placeOnTable: async () => {
      const mv = el.current;
      // No AR here (a laptop, or a phone without AR): the viewer offers a QR code instead.
      if (!mv?.activateAR || !mv.canActivateAR) return false;
      try { await mv.activateAR(); return true; } catch { return false; }
    },
    pointAt: (x, y) => {
      const hit = el.current?.positionAndNormalFromPoint?.(x, y);
      return hit ? { pos: hit.position.toString(), normal: hit.normal.toString() } : null;
    },
  }), []);

  // Life-size: scale the model so its widest side matches the real size.
  useEffect(() => {
    const mv = el.current;
    if (!mv || !ready) return;
    const onLoad = () => {
      const d = mv.getDimensions?.();
      if (d && realSizeCm) {
        const widest = Math.max(d.x, d.z) || 1;
        const f = (realSizeCm / 100) / widest;
        if (Number.isFinite(f) && f > 0) { mv.scale = `${f} ${f} ${f}`; void mv.updateFraming?.(); }
      }
      onReady?.({ canAR: !!mv.canActivateAR });
    };
    mv.addEventListener("load", onLoad);
    return () => mv.removeEventListener("load", onLoad);
  }, [ready, realSizeCm, onReady]);

  // Fly the camera to the chosen part
  useEffect(() => {
    const mv = el.current;
    if (!mv) return;
    const p = active != null ? parts[active] : null;
    if (p?.pos3D) {
      mv.autoRotate = false;
      // Auto-spin turns the model itself: put it back square so the angles below are right.
      mv.resetTurntableRotation?.(0);
      mv.cameraTarget = p.pos3D;
      // Face the part: look along its surface normal so it is never hidden behind the dish.
      const n = (p.normal3D ?? "").split(/\s+/).map((v) => parseFloat(v));
      if (n.length === 3 && n.every(Number.isFinite)) {
        const theta = (Math.atan2(n[0], n[2]) * 180) / Math.PI;
        const phi = Math.min(150, Math.max(20, (Math.acos(Math.max(-1, Math.min(1, n[1]))) * 180) / Math.PI));
        mv.cameraOrbit = `${theta.toFixed(1)}deg ${phi.toFixed(1)}deg auto`;
      }
      mv.fieldOfView = "20deg";
    } else { mv.cameraTarget = "auto auto auto"; mv.cameraOrbit = "auto auto auto"; mv.fieldOfView = "auto"; mv.autoRotate = spin; }
  }, [active, parts, spin]);

  if (failed) return <div className={`${className} flex items-center justify-center text-sm text-white/60`}>3D is not available on this device.</div>;
  if (!ready) return <div className={`${className} animate-pulse bg-white/5`} aria-label="Loading 3D" />;

  const attrs: Record<string, unknown> = {
    ref: (n: MV | null) => { el.current = n; },
    src: assetUrl(model.glbPath),
    alt,
    poster: assetUrl(model.posterPath) ?? undefined,
    "ios-src": assetUrl(model.usdzPath) ?? undefined,
    ar: true,
    // Native AR first on Android (room lighting, steadier tracking); in-browser AR as the fallback.
    "ar-modes": "scene-viewer webxr quick-look",
    "ar-scale": "fixed",
    "ar-placement": "floor",
    "xr-environment": true,
    "camera-controls": true,
    "touch-action": "pan-y",
    "interaction-prompt": "none",
    "shadow-intensity": "1.2",
    "shadow-softness": "0.8",
    exposure: "1.05",
    "environment-image": "neutral",
    "interpolation-decay": "120",
    loading: "eager",
    class: className,
    style: { width: "100%", height: "100%", background: "transparent", ["--poster-color" as string]: "transparent" },
    onClick,
  };
  if (spin && active == null) attrs["auto-rotate"] = true;

  const hotspots = showLabels ? parts.map((p, i) => p.pos3D ? createElement("button", {
    key: `h${i}`,
    slot: `hotspot-${i}`,
    "data-position": p.pos3D,
    "data-normal": p.normal3D ?? undefined,
    "data-visibility-attribute": "visible",
    type: "button",
    onClick: (e: React.MouseEvent) => { e.stopPropagation(); onPart?.(i); },
    className: `m4d-hot ${active === i ? "m4d-hot-on" : ""}`,
    "aria-label": p.name,
  }, createElement("span", { className: "m4d-hot-label" }, p.name)) : null) : [];

  // Hide model-viewer's own AR button: the viewer shows a bigger "On my table" button.
  return createElement("model-viewer", attrs, createElement("span", { slot: "ar-button", style: { display: "none" } }), ...hotspots);
});

export default Dish3D;
