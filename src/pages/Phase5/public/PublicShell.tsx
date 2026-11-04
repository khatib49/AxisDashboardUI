import type { ReactNode } from "react";
import PageMeta from "../../../components/common/PageMeta";
import { LanguageToggle, useI18n } from "../../../i18n/I18nProvider";

/** Light wrapper for guest pages: title, language switch, readable width, dark mode. */
export default function PublicShell({ title, children, wide = false }: { title: string; children: ReactNode; wide?: boolean }) {
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-white/90">
      <PageMeta title={`${t(title)} | Axis`} description={t(title)} />
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/90 backdrop-blur dark:border-gray-800 dark:bg-gray-900/90">
        <div className={`mx-auto flex items-center justify-between gap-3 px-4 py-3 ${wide ? "max-w-6xl" : "max-w-2xl"}`}>
          <span className="text-lg font-black tracking-wide">AXIS</span>
          <LanguageToggle className="h-9 min-w-9" />
        </div>
      </header>
      <main className={`mx-auto px-4 py-5 ${wide ? "max-w-6xl" : "max-w-2xl"}`}>
        <h1 className="mb-4 text-2xl font-bold">{t(title)}</h1>
        {children}
      </main>
    </div>
  );
}

export const pcard = "rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900";
export const pinput = "h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-base text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white";
export const pbtn = "h-11 rounded-xl bg-brand-500 px-5 text-base font-semibold text-white hover:bg-brand-600 disabled:opacity-50";
export function fmtTime(iso: string, lang: string) { return new Date(iso).toLocaleString(lang === "ar" ? "ar-LB" : "en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
export function fmtHour(iso: string, lang: string) { return new Date(iso).toLocaleTimeString(lang === "ar" ? "ar-LB" : "en-GB", { hour: "2-digit", minute: "2-digit" }); }
