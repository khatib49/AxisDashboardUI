// Loads the website content once per visit and hands it to every site page.
// Shows the brand loader until the API answers (or falls back to the
// built-in defaults when it can't be reached).
//
// Preview mode: when the site runs inside the admin editor's preview iframe,
// the unsaved draft is read from localStorage instead of the API and
// refreshed on every change, so edits show up as they're typed.
import { createContext, useContext, useEffect, useState } from "react";
import { getSiteContent, mergeSiteContent } from "../../services/siteContentService";
import { DEFAULT_SITE_CONTENT, IMAGES, SiteContent } from "./siteContent";

const PREVIEW_STORAGE_KEY = "axis-site-preview";

type SiteContentState = { content: SiteContent; preview: boolean };

const SiteContentContext = createContext<SiteContentState>({ content: DEFAULT_SITE_CONTENT, preview: false });

function readPreviewDraft(): SiteContent | null {
  try {
    if (window.self === window.top) return null; // only inside the editor's iframe
    const raw = localStorage.getItem(PREVIEW_STORAGE_KEY);
    return raw ? mergeSiteContent(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function SiteContentProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SiteContentState | null>(null);

  useEffect(() => {
    let alive = true;
    const framed = window.self !== window.top;

    // Inside the editor's preview iframe: follow the draft as it changes.
    // The draft may land a moment after the iframe starts loading, so the
    // listener is attached regardless of whether one exists yet.
    let onStorage: ((e: StorageEvent) => void) | null = null;
    if (framed) {
      onStorage = (e: StorageEvent) => {
        if (e.key !== null && e.key !== PREVIEW_STORAGE_KEY) return;
        const next = readPreviewDraft();
        if (next && alive) setState({ content: next, preview: true });
      };
      window.addEventListener("storage", onStorage);
    }

    const draft = readPreviewDraft();
    if (draft) {
      setState({ content: draft, preview: true });
    } else {
      getSiteContent()
        .then((c) => alive && setState((prev) => (prev?.preview ? prev : { content: c, preview: false })))
        .catch(() => alive && setState((prev) => (prev?.preview ? prev : { content: DEFAULT_SITE_CONTENT, preview: false })));
    }

    return () => {
      alive = false;
      if (onStorage) window.removeEventListener("storage", onStorage);
    };
  }, []);

  if (!state) {
    return (
      <div className="axis-site grid min-h-screen place-items-center bg-[#050507] px-4 text-white">
        <div className="flex flex-col items-center gap-4">
          <img src={IMAGES.branding} alt="AXIS" className="h-14 w-auto animate-pulse sm:h-16" />
          <p className="text-xs uppercase tracking-[0.28em] text-[#b9d3ee]/80">Loading</p>
        </div>
      </div>
    );
  }

  return <SiteContentContext.Provider value={state}>{children}</SiteContentContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSiteContent(): SiteContent {
  return useContext(SiteContentContext).content;
}

/** True while rendering inside the admin editor's live preview. */
// eslint-disable-next-line react-refresh/only-export-components
export function useSitePreview(): boolean {
  return useContext(SiteContentContext).preview;
}
