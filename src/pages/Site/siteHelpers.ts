import type { SyntheticEvent } from "react";
import { IMAGES } from "./siteContent";

/** Swap a broken image for the brand placeholder. */
export function onImageError(e: SyntheticEvent<HTMLImageElement>) {
  e.currentTarget.src = IMAGES.placeholder;
}

/** Hide a broken decorative/background image entirely. */
export function hideImageOnError(e: SyntheticEvent<HTMLImageElement>) {
  e.currentTarget.style.display = "none";
}

/** "+961 78 729 282" → https://wa.me/96178729282 */
export function whatsappUrl(number: string): string {
  return `https://wa.me/${(number || "").replace(/[^0-9]/g, "")}`;
}

/** "78 729 282" → tel:78729282 */
export function phoneUrl(phone: string): string {
  return `tel:${(phone || "").replace(/\s+/g, "")}`;
}

/** Origin of the API in use (VITE_API_BASE_URL without the trailing /api). */
function apiOrigin(): string {
  const base = ((import.meta.env.VITE_API_BASE_URL as string) || "").trim();
  return base.replace(/\/api\/?$/i, "").replace(/\/$/, "");
}

/**
 * Where an image path points. Images uploaded from Admin → Website are stored
 * as "media/site/x.jpg" on the API host that received them, so they resolve
 * against the API origin; bundled defaults start with "/images/"; absolute
 * URLs pass through; anything else uses the image host.
 */
export function resolveSiteImage(path: string | null | undefined, fallback: string = IMAGES.placeholder): string {
  const p = (path || "").trim();
  if (!p) return fallback;
  if (/^(https?:)?\/\//i.test(p) || p.startsWith("data:") || p.startsWith("blob:")) return p;
  if (p.startsWith("/images/")) return p;
  const rel = p.replace(/^\//, "");
  if (rel.startsWith("media/")) {
    const origin = apiOrigin();
    return origin ? `${origin}/${rel}` : `/${rel}`;
  }
  const base = ((import.meta.env.VITE_API_IMAGE_BASE_URL as string) || "").replace(/\/$/, "");
  return base ? `${base}/${rel}` : `/${rel}`;
}

/** True when at least one of the given strings has content. */
export function hasText(...values: Array<string | null | undefined>): boolean {
  return values.some((v) => !!(v && v.trim()));
}
