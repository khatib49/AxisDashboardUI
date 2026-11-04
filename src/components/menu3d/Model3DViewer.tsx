import { createElement, useEffect, useState } from "react";
import { assetUrl, type PublicItemModelDto } from "../../services/phase4Service";

let loader: Promise<unknown> | null = null;
/** The viewer library is large: load it only when a model is actually shown. */
function loadViewer() { loader ??= import("@google/model-viewer"); return loader; }

type Props = { model: PublicItemModelDto; alt: string; className?: string; autoRotate?: boolean };

/**
 * Spin-and-zoom 3D view of a menu item, with "View on your table" AR on
 * phones (Scene Viewer on Android, Quick Look on iPhone when a USDZ exists).
 */
export default function Model3DViewer({ model, alt, className = "h-72 w-full", autoRotate = true }: Props) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => { loadViewer().then(() => setReady(true)).catch(() => setFailed(true)); }, []);

  if (failed) return <div className={`${className} flex items-center justify-center rounded-xl bg-gray-100 text-sm text-gray-500 dark:bg-gray-800 dark:text-gray-400`}>3D view is not available on this device.</div>;
  if (!ready) return <div className={`${className} animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800`} aria-label="Loading 3D view" />;

  const attrs: Record<string, unknown> = {
    src: assetUrl(model.glbPath),
    alt,
    poster: assetUrl(model.posterPath) ?? undefined,
    "ios-src": assetUrl(model.usdzPath) ?? undefined,
    ar: true,
    "ar-modes": "webxr scene-viewer quick-look",
    "ar-scale": "fixed",
    "camera-controls": true,
    "touch-action": "pan-y",
    "shadow-intensity": "1",
    exposure: "1",
    loading: "eager",
    class: `${className} rounded-xl bg-gray-50 dark:bg-gray-800`,
    style: { width: "100%" },
  };
  if (autoRotate) attrs["auto-rotate"] = true;
  return createElement("model-viewer", attrs,
    createElement("button", {
      slot: "ar-button",
      type: "button",
      className: "absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-white/95 px-4 py-2 text-sm font-semibold text-gray-900 shadow",
    }, "View on your table"));
}
