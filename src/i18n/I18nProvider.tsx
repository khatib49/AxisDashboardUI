import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AR } from "./ar";

export type Lang = "en" | "ar";
type Ctx = { lang: Lang; dir: "ltr" | "rtl"; setLang: (l: Lang) => void; t: (en: string, vars?: Record<string, string | number>) => string };

const STORAGE_KEY = "lang";
const I18nContext = createContext<Ctx | null>(null);

function initialLang(): Lang {
  try {
    const q = new URLSearchParams(window.location.search).get("lang");
    if (q === "ar" || q === "en") return q;
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "ar" || v === "en") return v;
  } catch { /* storage may be blocked */ }
  return "en";
}

/** Fills {name} placeholders. */
export function fill(s: string, vars?: Record<string, string | number>) {
  return vars ? s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`)) : s;
}

/**
 * Arabic / English. Keys are the English text, so untranslated strings fall
 * back to English. Arabic switches the whole document to right-to-left.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  useEffect(() => {
    const el = document.documentElement;
    el.lang = lang;
    el.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch { /* ignore */ }
  }, []);
  const t = useCallback((en: string, vars?: Record<string, string | number>) => fill(lang === "ar" ? AR[en] ?? en : en, vars), [lang]);
  const value = useMemo<Ctx>(() => ({ lang, dir: lang === "ar" ? "rtl" : "ltr", setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

const fallback: Ctx = { lang: "en", dir: "ltr", setLang: () => undefined, t: (en, vars) => fill(en, vars) };
export function useI18n(): Ctx { return useContext(I18nContext) ?? fallback; }

/** Small EN / عربي switch for the header and public pages. */
export function LanguageToggle({ className = "" }: { className?: string }) {
  const { lang, setLang } = useI18n();
  return (
    <button
      type="button"
      onClick={() => setLang(lang === "ar" ? "en" : "ar")}
      className={`inline-flex h-11 min-w-11 items-center justify-center rounded-full border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 ${className}`}
      aria-label={lang === "ar" ? "Switch to English" : "التبديل إلى العربية"}
      data-testid="lang-toggle"
    >
      {lang === "ar" ? "EN" : "عربي"}
    </button>
  );
}
