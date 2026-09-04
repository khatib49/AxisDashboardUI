// Website content document: what the public site shows, edited under
// Admin → Website. Stored as JSON by the API; merged over the defaults here
// so newly added fields always have a value.
import api from "./api";
import { DEFAULT_SITE_CONTENT, SiteContent } from "../pages/Site/siteContent";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/**
 * Deep-merge `stored` over `def`. Objects merge key by key, arrays are taken
 * from `stored` wholesale (each element merged with the default's first
 * element as a template, so an item never misses a field), primitives are
 * taken from `stored` only when they have the expected type.
 */
function mergeInto<T>(def: T, stored: unknown): T {
  if (Array.isArray(def)) {
    if (!Array.isArray(stored)) return def;
    const template = def[0];
    if (isPlainObject(template)) return stored.map((s) => mergeInto(template, s)) as T;
    return stored as T;
  }
  if (isPlainObject(def)) {
    if (!isPlainObject(stored)) return def;
    const out: Record<string, unknown> = { ...def };
    for (const key of Object.keys(def)) out[key] = mergeInto(def[key], stored[key]);
    for (const key of Object.keys(stored)) if (!(key in def)) out[key] = stored[key];
    return out as T;
  }
  return typeof stored === typeof def ? (stored as T) : def;
}

export function mergeSiteContent(stored: unknown): SiteContent {
  return mergeInto(DEFAULT_SITE_CONTENT, stored);
}

/** Public: current content (defaults filled in for anything unset). */
export async function getSiteContent(): Promise<SiteContent> {
  const { data } = await api.get<unknown>("/site-content");
  return mergeSiteContent(data);
}

/** Admin: replace the stored document. */
export async function saveSiteContent(content: SiteContent): Promise<void> {
  await api.put("/admin/site-content", content);
}

/** Admin: upload an image; returns the relative path to store in the content. */
export async function uploadSiteImage(file: File): Promise<{ path: string; url: string }> {
  const fd = new FormData();
  fd.append("file", file);
  const { data } = await api.post<{ path: string; url: string }>("/admin/site-content/images", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}
