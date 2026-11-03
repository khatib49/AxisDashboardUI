/**
 * Offline mode is opt-in. With the flag off (the default) nothing in this
 * folder changes runtime behaviour: no service worker is registered, the
 * queue worker never starts and the *OfflineAware helpers call the API as
 * before.
 */
export const OFFLINE_MODE_ENABLED: boolean =
  import.meta.env.VITE_ENABLE_OFFLINE_MODE === "true";

export const OFFLINE_CLIENT_ID_KEY = "axis_offline_client_id";

/** Stable per-browser id sent with every sync batch (audit only). */
export function getOfflineClientId(): string {
  try {
    const existing = localStorage.getItem(OFFLINE_CLIENT_ID_KEY);
    if (existing) return existing;
    const id = newUuid();
    localStorage.setItem(OFFLINE_CLIENT_ID_KEY, id);
    return id;
  } catch {
    return "anonymous-till";
  }
}

export function newUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // RFC 4122 v4 fallback for very old WebViews.
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
